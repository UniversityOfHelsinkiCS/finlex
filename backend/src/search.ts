import { Heading } from "./types/structure.js";
import { StatuteSearchResult } from "./types/statute.js";
import { JudgmentSearchResult } from "./types/judgment.js";
import Typesense from "typesense";
import { Errors } from "typesense";
import { CollectionCreateSchema } from "typesense/lib/Typesense/Collections.js";
import { SearchParams } from "typesense/lib/Typesense/Documents.js";
import { parseStringPromise } from "xml2js";
import xmldom from '@xmldom/xmldom';
import { parseXmlHeadings, parseHtmlHeadings } from './util/parse.js';
import { addStatusRow, query } from "./db/db.js"
import { dropWords, dropwords_set_fin, dropwords_set_swe } from "./util/dropwords.js";
import { JSDOM } from "jsdom";
import { yearFrom, yearTo } from './util/config.js';
import { getCommonNamesByStatuteUuid } from "./db/models/commonName.js";
import { getJudgmentKeywordsByJudgmentUuid, getStatuteKeywordsByStatuteUuid } from "./db/models/keyword.js";

if (!process.env.TYPESENSE_API_KEY) {
  console.error("TYPESENSE_API_KEY environment variable is not set.");
  process.exit(1);
}

const tsClient = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST || "localhost",
      port: process.env.TYPESENSE_PORT ? parseInt(process.env.TYPESENSE_PORT) : 8108,
      protocol: "http",
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 2
});

function flattenHeadings(headings: Heading[]) {
  const out: string[] = [];
  function recurse(arr: Heading[]) {
    for (const h of arr) {
      out.push(h.name);
      if (h.content && h.content.length) {
        recurse(h.content);
      }
    }
  }
  recurse(headings);
  return out;
}

function normalizeText(input: string[], lang: "fin" | "swe"): string[];
function normalizeText(input: string, lang: "fin" | "swe"): string;
function normalizeText(input: string | string[], lang: "fin" | "swe"): string | string[] {
  const dropwords_set = lang === "fin" ? dropwords_set_fin : dropwords_set_swe;
  const process = (str: string): string => {
    const words = str
      .toLowerCase()
      .replace(/\p{Punctuation}+/gu, ' ')
      .split(/\s+/);

    const filtered = words
      .map(word => word.trim())
      .filter(word => word.length > 3);

    const cleaned = dropWords(dropwords_set, filtered);

    return cleaned.join(' ').trim();
  };

  if (Array.isArray(input)) {
    return input.map(process).filter((str) => str.length > 0);
  } else {
    return process(input);
  }
}


export function extractParagraphs(xmlString: string): string[] {
  const doc = new xmldom.DOMParser().parseFromString(xmlString, "application/xml");
  const pNodes = doc.getElementsByTagName("p");
  return Array.from(pNodes, p => (p.textContent || '').trim()).filter(t => t);
}

export function extractParagraphsHtml(html: string): string[] {
  const dom = new JSDOM(html);
  const ps = dom.window.document.querySelectorAll('p');

  return Array.from(ps, p => (p.textContent || '').trim()).filter(t => t);
}

function localeLevel(level: string, lang: string): string {
  if (lang === "fin") {
    if (level === "kho") return "KHO";
    if (level === "kko") return "KKO";
    throw new Error(`Unsupported level: ${level} for language: ${lang}`);
  } else if (lang === "swe") {
    if (level === "kho") return "HD";
    if (level === "kko") return "HFD";
    throw new Error(`Unsupported level: ${level} for language: ${lang}`);
  } else throw new Error(`Unsupported language: ${lang}`);
}

function localeLevelInverse(level: string): string {
  if (level === "KHO" || level === "HD") return "kho";
  if (level === "KKO" || level === "HFD") return "kko";
  throw new Error(`Unsupported level: ${level}`);
}

async function upsertWithRetry(collectionName: string, document: Record<string, any>, maxRetries = 10) { //eslint-disable-line @typescript-eslint/no-explicit-any
  let upserted = false;
  let retries = 0;
  while (!upserted && retries < maxRetries) {
    try {
      await tsClient
        .collections(collectionName)
        .documents()
        .upsert(document);
      upserted = true;
    } catch (error: unknown) {
      if (error instanceof Typesense.Errors.ServerError && error.httpStatus === 503) {
        retries++;
        const delay = 1000 * retries;
        console.warn(`Typesense lagging behind (503), retrying in ${delay}ms... (attempt ${retries})`);
        await new Promise(res => setTimeout(res, delay));
      } else {
        throw error;
      }
    }
  }
}


export async function syncStatutes(lang: string) {
  let lang_short
  if (lang === "fin") {
    lang_short = "fi";
  } else if (lang === "swe") {
    lang_short = "sv";
  } else {
    throw new Error(`Unsupported language: ${lang}`);
  }
  const collectionName = `statutes_${lang}`;
  console.log(`Indexing: ${lang} -> ${collectionName}`);

  const schema: CollectionCreateSchema = {
    name: collectionName,
    fields: [
      { name: "id", type: "string", index: false },
      { name: "title", type: "string", locale: lang_short },
      { name: "year_num", type: "int32" },
      { name: "year", type: "string" },
      { name: "number", type: "string" },
      { name: "common_names", type: "string[]", locale: lang_short },
      { name: "keywords", type: "string[]", locale: lang_short },
      { name: "version", type: "string", index: false },
      { name: "headings", type: "string[]", locale: lang_short },
      { name: "paragraphs", type: "string[]", locale: lang_short },
      { name: "has_content", type: "int32" },
    ],
  };

  try {
    await tsClient.collections().create(schema);
    console.log(`Created collection ${collectionName}`);
  } catch (err) {
    if (!(err instanceof Errors.ObjectAlreadyExists)) {
      throw err;
    }
    console.log(`Collection ${collectionName} already exists`);
  }

  for (let year = yearFrom(); year <= yearTo(); year++) {

    await addStatusRow({ message: 'syncStatutes ' + lang, year }, true)

    const { rows } = await query(
      `
      SELECT
          uuid   AS id,
          title  AS title,
          number AS number,
          year   AS year,
          is_empty AS is_empty,
          version AS version,
          content::text AS content
      FROM statutes
      WHERE language = $1 AND year = $2
      ORDER BY uuid
      `,
      [lang, year]
    )
    if (rows.length === 0) continue

    await addStatusRow({ message: `syncStatutes ${year}, total rows ` + rows.length }, true)

    while (rows.length > 0) {
      const row = rows.pop()

      try {
        const parsed_xml = await parseStringPromise(row.content, { explicitArray: false })
        const headingTree: Heading[] = parseXmlHeadings(parsed_xml) ?? [];
        const headings = flattenHeadings(headingTree);
        const paragraphs = extractParagraphs(row.content);
        const commonNames = await getCommonNamesByStatuteUuid(row.id);
        const keywords = await getStatuteKeywordsByStatuteUuid(row.id);

        if (rows.length % 100 === 0) {
          await addStatusRow({ message: `syncStatutes ${year}, rows left ` + rows.length }, true)
        }

        await upsertWithRetry(collectionName, {
          id: row.id,
          title: row.title,
          year: String(row.year),
          year_num: parseInt(row.year, 10),
          number: row.number,
          has_content: row.is_empty ? 0 : 1,
          common_names: commonNames,
          keywords: keywords,
          version: row.version ?? '',
          headings: normalizeText(headings, lang),
          paragraphs: normalizeText(paragraphs, lang),
        });
      } catch (error){
        console.log('--- errored -->',row.id)
        console.log(row)
        console.log(error)
      }

    }
  }
}

export async function syncJudgments(lang: string) {
  let lang_short
  if (lang === "fin") {
    lang_short = "fi";
  } else if (lang === "swe") {
    lang_short = "sv";
  } else {
    throw new Error(`Unsupported language: ${lang}`);
  }
  const collectionName = `judgments_${lang}`;
  console.log(`\n=== Indexing: ${lang} -> ${collectionName}`);

  await addStatusRow({ message: 'syncJudgments ' + lang}, true)

  const schema: CollectionCreateSchema = {
    name: collectionName,
    fields: [
      { name: "id", type: "string", index: false },
      { name: "year_num", type: "int32" },
      { name: "year", type: "string" },
      { name: "number", type: "string" },
      { name: "level", type: "string" },
      { name: "keywords", type: "string[]", locale: lang_short },
      { name: "headings", type: "string[]", locale: lang_short },
      { name: "paragraphs", type: "string[]", locale: lang_short },
      { name: "has_content", type: "int32" },
    ],
  };

  try {
    await tsClient.collections().create(schema);
    console.log(`Created collection ${collectionName}`);
  } catch (err) {
    if (!(err instanceof Errors.ObjectAlreadyExists)) {
      throw err;
    }
    console.log(`Collection ${collectionName} already exists`);
  }

  for (let year = yearFrom(); year <= yearTo(); year++) {
    const { rows } = await query(
      `
      SELECT
          uuid   AS id,
          number AS number,
          year   AS year,
          level  AS level,
          is_empty AS is_empty,
          content::text AS content
      FROM judgments
      WHERE language = $1 AND year = $2
      ORDER BY uuid
      `,
      [lang, year]
    )
    if (rows.length === 0) continue

    await addStatusRow({ message: `syncJudgements ${year} total rows ` + rows.length }, true)

    while (rows.length > 0) {
      const row = rows.pop()
      const headingTree: Heading[] = parseHtmlHeadings(row.content) ?? [];
      const headings = flattenHeadings(headingTree);
      const paragraphs = extractParagraphsHtml(row.content);
      const keywords = await getJudgmentKeywordsByJudgmentUuid(row.id);


      if (rows.length % 100 === 0) {
        await addStatusRow({ message:  `syncJudgements ${year}, rows left` + rows.length }, true)
      }

      await upsertWithRetry(collectionName, {
        id: row.id,
        year: String(row.year),
        year_num: parseInt(row.year, 10),
        level: localeLevel(row.level, lang),
        number: row.number,
        keywords: keywords,
        headings: normalizeText(headings, lang),
        paragraphs: normalizeText(paragraphs, lang),
        has_content: row.is_empty ? 0 : 1,
      });
    }
  }
}


export async function deleteCollection(name: string, lang: string) {
  const collectionName = `${name}_${lang}`;
  try {
    await tsClient.collections(collectionName).delete();
    console.log(`Deleted collection ${collectionName}`);
  } catch (err) {
    if (!(err instanceof Errors.ObjectNotFound)) {
      throw err;
    }
    console.log(`Collection ${collectionName} does not exist`);
  }
}


export async function searchStatutes(lang: string, queryStr: string): Promise<StatuteSearchResult[]> {
  const searchParameters: SearchParams = {
    q: queryStr,
    query_by: "title,common_names,keywords,headings,year,number,paragraphs",
    query_by_weights: "50,49,48,20,15,10,1",
    prefix: "true",
    num_typos: 2,
    text_match_type: "max_weight",
    sort_by: "has_content:desc,_text_match:desc,year_num:desc",
    per_page: 20,
    include_fields: "year_num,number,title,has_content,version",
  };

  const searchResults = await tsClient
    .collections(`statutes_${lang}`)
    .documents()
    .search(searchParameters);

  return searchResults.hits?.map((hit) => (hit.document as StatuteSearchResult)) || [];
}


export async function searchJudgments(lang: string, queryStr: string, level: string): Promise<JudgmentSearchResult[]> {
  const searchParameters: SearchParams = {
    q: queryStr,
    query_by: "keywords,level,year,number,headings,paragraphs",
    query_by_weights: "60,50,49,48,10,1",
    prefix: "true",
    num_typos: 2,
    text_match_type: "max_weight",
    sort_by: "has_content:desc,_text_match:desc,year_num:desc",
    per_page: 20,
    include_fields: "year_num,number,level,has_content,keywords",
  };
  if (level !== "any") {
    searchParameters.filter_by = `level:0${localeLevel(level, lang)}`;
  }

  const searchResults = await tsClient
    .collections(`judgments_${lang}`)
    .documents()
    .search(searchParameters);

  return searchResults.hits?.map((hit) => {
    const doc = hit.document as JudgmentSearchResult;
    doc.level = localeLevelInverse(doc.level);
    return hit.document as JudgmentSearchResult
  }) || [];
}
