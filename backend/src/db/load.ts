import { parseStringPromise } from 'xml2js';
import axios, { AxiosResponse } from 'axios'
import { Statute, StatuteKey, StatuteKeyWord } from '../types/statute.js';
import { Judgment, JudgmentKey, JudgmentKeyWord } from '../types/judgment.js';
import { StatuteVersionResponse } from '../types/versions.js';
import { Image } from '../types/image.js';
import { CommonName } from '../types/commonName.js';
import { v4 as uuidv4 } from 'uuid';
import { setStatute } from './models/statute.js';
import { setJudgment } from './models/judgment.js';
import { setImage, mapImageToStatute } from './models/image.js';
import { setJudgmentKeyword, setStatuteKeyword } from './models/keyword.js';
import { setCommonName } from './models/commonName.js';
import xmldom from '@xmldom/xmldom';
import { JSDOM } from 'jsdom';
import { XMLParser } from 'fast-xml-parser';
import { getLatestStatuteVersions } from '../util/parse.js';


function parseFinlexUrl(url: string): { docYear: number; docNumber: string; docLanguage: string; docVersion: string | null } {
  try {
    const urlObj = new URL(url);
    const [basePath, version] = urlObj.pathname.split('@');
    const segments = basePath.split('/').filter(Boolean);

    if (segments.length < 9) {
      throw new Error("Invalid URL format: Not enough segments");
    }

    const docYear = parseInt(segments[7]);
    const docNumber = segments[8];
    const docLanguage = segments[9];

    const docVersion = version ? version : null;

    return { docYear, docNumber, docLanguage, docVersion };
  } catch (error) {
    console.error("Failed to parse URL:", error);
    throw error;
  }
}

function buildFinlexUrl(statute: StatuteKey): { uri: string, uriOld: string }  {
  const oldBaseUrl = 'https://opendata.finlex.fi/finlex/avoindata/v1/akn/fi/act/statute-consolidated';
  const baseUrl = 'https://opendata.finlex.fi/finlex/avoindata/v1/akn/fi/act/statute'
  return {
    uri: `${baseUrl}/${statute.year}/${statute.number}/${statute.language}@`,
    uriOld: `${baseUrl}/${statute.year}/${statute.number}/${statute.language}@`,
    //uriOld: `${oldBaseUrl}/${statute.year}/${statute.number}/${statute.language}@${statute.version ? statute.version : ''}`,
    //uri: `${oldBaseUrl}/${statute.year}/${statute.number}/${statute.language}@${statute.version ? statute.version : ''}`
  };
}

function parseJudgmentUrl(url: string): JudgmentKey {
  const u = new URL(url)
  const parts = u.pathname.split("/").filter(p => p !== "")

  let language = parts[0]
  language = language === 'fi' ? 'fin' : 'swe'
  if (language !== 'fin' && language !== 'swe') {
    throw new Error(`Unknown language segment: ${language}`);
  }
  const courtSegment = parts[2]
  const year = parseInt(parts[4])
  const number = parts[5]

  let level: "kho" | "kko";
  if (courtSegment === "korkein-hallinto-oikeus" || courtSegment === "hogsta-forvaltningsdomstolen") {
    level = "kho";
  } else if (courtSegment === "korkein-oikeus" || courtSegment === "hogsta-domstolen") {
    level = "kko";
  } else {
    throw new Error(`Unknown court segment: ${courtSegment}`);
  }

  return { level, year, number, language }
}

function buildJudgmentUrl(judgment: JudgmentKey): string {
  const casestatute = judgment.language === 'fin' ? 'fi/oikeuskaytanto' : 'sv/rattspraxis';
  const baseUrl = 'https://finlex.fi';
  const path = `${judgment.year}/${judgment.number}`;
  let prefix
  if (judgment.level === 'kho') {
    prefix = judgment.language === 'fin' ? 'korkein-hallinto-oikeus/ennakkopaatokset' : 'hogsta-forvaltningsdomstolen/prejudikat';
  } else if (judgment.level === 'kko') {
    prefix = judgment.language === 'fin' ? 'korkein-oikeus/ennakkopaatokset' : 'hogsta-domstolen/prejudikat';
  } else {
    throw new Error(`Unknown court level: ${judgment.level}`);
  }
  return `${baseUrl}/${casestatute}/${prefix}/${path}`;
}




async function parseTitlefromXML(result: AxiosResponse<unknown>): Promise<string> {
  const xmlData = result.data as Promise<string>;
  const parsedXmlData = await parseStringPromise(xmlData, { explicitArray: false })

  const resultNode = parsedXmlData?.akomaNtoso
  if (!resultNode) {
    throw new Error('Result node not found in XML')
  }

  const docTitle = resultNode?.act?.preface?.p?.docTitle ||
    resultNode?.decree?.preface?.p?.docTitle;
  if (!docTitle) {
    throw new Error('docTitle not found')
  }

  return docTitle
}

async function parseImagesfromXML(result: AxiosResponse<unknown>): Promise<string[]> {
  const xmlData = await result.data as string;
  const doc = new xmldom.DOMParser().parseFromString(xmlData, 'text/xml');

  const imageNodes = doc.getElementsByTagNameNS('*', 'img');
  const imageLinks: string[] = [];

  Array.from(imageNodes).forEach((node: xmldom.Element) => {
    imageLinks.push(node.getAttribute('src') || '');
  });

  return imageLinks
}

async function parseCommonNamesFromXML(result: AxiosResponse<unknown>): Promise<string[]> {
  const xmlData = await result.data as string;
  const doc = new xmldom.DOMParser().parseFromString(xmlData, 'text/xml');

  const nodes = doc.getElementsByTagNameNS('*', 'commonName');
  const names: string[] = [];

  Array.from(nodes).forEach((node: xmldom.Element) => {
    if (node.textContent) {
      names.push(node.textContent);
    }
  });

  return names
}

async function parseKeywordsfromXML(result: AxiosResponse<unknown>): Promise<[string, string][]> {
  const keyword_list: [string, string][] = [];

  const xmlData = result.data as Promise<string>;
  const parsedXmlData = await parseStringPromise(xmlData, { explicitArray: false })

  const resultNode = parsedXmlData?.akomaNtoso
  if (!resultNode) {
    throw new Error('Result node not found in XML')
  }
  const classificationNode = resultNode?.act?.meta?.classification
  const keywords = classificationNode?.keyword
  if (keywords) {
    if (Array.isArray(keywords)) {
      for (const word of keywords) {
        if (word?.$ && word?.$?.showAs && word?.$?.value) {
          const id = word?.$?.value.substr(word?.$?.value.length - 4)
          keyword_list.push([word?.$?.showAs, id])
        }
      }
    } else if (classificationNode?.keyword?.$?.showAs && classificationNode?.keyword?.$?.value) {
      const id = classificationNode?.keyword?.$?.value.substr(classificationNode?.keyword?.$?.value.length - 4)
      keyword_list.push([classificationNode?.keyword?.$?.showAs, id])
    }
  }
  return keyword_list
}

export function parseKeywordsfromHTML(html: string, lang: string): string[] {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const keywordTag = lang === 'fin' ? 'Asiasanat' : 'Ämnesord';

  const dt = Array.from(doc.querySelectorAll('dt'))
    .find(el => el.textContent?.trim() === keywordTag);
  if (!dt) {
    return [];
  }

  const dd = dt.nextElementSibling;
  if (!dd || dd.tagName.toLowerCase() !== 'dd') {
    return [];
  }

  const wrapper = Array.from(dd.children)
    .find(el => el.tagName.toLowerCase() === 'div') as HTMLElement | undefined;
  if (!wrapper) {
    return [];
  }

  const children = Array.from(wrapper.children);
  const lines: string[] = [];

  const divChildren = children.filter(c => c.tagName.toLowerCase() === 'div');
  if (divChildren.length > 0) {
    for (const div of divChildren) {
      const raw = div.textContent || '';
      const clean = raw.trim().replace(/\s+/g, ' ');
      if (clean) lines.push(clean);
    }
    return lines;
  }

  const spanChildren = children.filter(c => c.tagName.toLowerCase() === 'span');
  for (const span of spanChildren) {
    const firstInner = span.querySelector('span');
    const txt = firstInner?.textContent?.trim();
    if (txt) lines.push(txt);
  }

  return lines;
}

function parseJudgmentList(inputHTML: string, language: string, level: string): string[] {
  const courtLevel = {fin: level === 'kho' ? 'KHO' : 'KKO', swe: level === 'kho' ? 'HFD' : 'HD'};
  const courtID = language === 'fin' ? courtLevel.fin : courtLevel.swe;
  const re = new RegExp(`${courtID}:\\d{4}(:\\d+|-[A-Za-z]+-\\d+)`, 'g');
  const matches = inputHTML.matchAll(re);
  return Array.from(matches, match => match[0]);
}

function parseURLfromJudgmentID(judgmentID: string): string {
  const parts = judgmentID.split(':');
  let IDparts: string[];

  if (parts[1].includes("-")) {
    const [year, number] = parts[1].split(/-(.+)/);
    IDparts = [parts[0], year, number];
  } else {
    IDparts = [parts[0], parts[1], parts[2]];
  }

  if (parts[0] === 'KHO') {
    return `https://finlex.fi/fi/oikeuskaytanto/korkein-hallinto-oikeus/ennakkopaatokset/${IDparts[1]}/${IDparts[2]}`;
  } else if (IDparts[0] === 'KKO') {
    return `https://finlex.fi/fi/oikeuskaytanto/korkein-oikeus/ennakkopaatokset/${IDparts[1]}/${IDparts[2]}`;
  } else if (IDparts[0] === 'HFD') {
    return `https://finlex.fi/sv/rattspraxis/hogsta-forvaltningsdomstolen/prejudikat/${IDparts[1]}/${IDparts[2]}`;
  }
  else if (IDparts[0] === 'HD') {
    return `https://finlex.fi/sv/rattspraxis/hogsta-domstolen/prejudikat/${IDparts[1]}/${IDparts[2]}`;
  } else {
    throw new Error(`Unknown court level: ${IDparts[0]}`);
  }
}

async function parseAkomafromURL(inputURL: string, lang: string): Promise<{ content: string; is_empty: boolean, keywords: string[] }> {
  const result = await axios.get(inputURL, {
    headers: { 'Accept': 'text/html', 'Accept-Encoding': 'gzip' }
  });
  const inputHTML = result.data as string;
  const keywords = parseKeywordsfromHTML(inputHTML, lang);
  const dom = new JSDOM(inputHTML);
  const doc = dom.window.document;
  const section = doc.querySelector('section[class*="akomaNtoso"]');

  let is_empty = true;

  if (section) {
    const paragraphs = section.querySelectorAll('p');
    is_empty = !Array.from(paragraphs).some(p => (p.textContent ?? '').trim() !== '');
  }

  const content = section ? section.outerHTML : '';

  return { content, is_empty, keywords };
}

async function checkIsXMLEmpty(xmlString: string): Promise<boolean> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });
  const parsed = parser.parse(xmlString);

  const body = parsed?.['akomaNtoso']?.['act']?.['body'];

  if (!body) return false;

  const container = body['hcontainer'];
  if (!container) return false;

  if (Array.isArray(container)) {
    return container.some(c => c?.['@_name'] === 'contentAbsent');
  } else {
    return container?.['@_name'] === 'contentAbsent';
  }
}


const baseURL = 'https://opendata.finlex.fi/finlex/avoindata/v1';

async function setImages(statuteUuid: string, docYear: number, docNumber: string, language: string, version: string | null, uris: string[]) {
  for (const uri of uris) {
    const path = `/akn/fi/act/statute-consolidated/${docYear}/${docNumber}/${language}@${version ?? ''}/${uri}`
    const url = `${baseURL}${path}`
    try {
      const result = await axios.get(url, {
        headers: { 'Accept': 'image/*', 'Accept-Encoding': 'gzip' },
        responseType: 'arraybuffer'
      })

      const name = uri.split('/').pop()
      if (!name) {
        console.error(`Failed to extract name from URI: ${uri}`);
        continue;
      }
      let imageUuid = uuidv4();
      const image: Image = {
        uuid: imageUuid,
        name: name,
        mime_type: result.headers['content-type'],
        content: result.data as Buffer,
      }

      imageUuid = await setImage(image)
      mapImageToStatute(statuteUuid, imageUuid)
    }
    catch {
      console.error(`Failed to fetch image from ${url}:`);
    }
  }
}

async function fetchStatute(uri: string) {
  try {
    const result = await axios.get(`${uri}`, {
      headers: { 'Accept': 'application/xml', 'Accept-Encoding': 'gzip' }
    })
    return result
  } catch {
    return null
  }
}

async function setSingleStatute(uris : { uri: string, uriOld: string}) {
  const { uri, uriOld } = uris
  let result = await fetchStatute(uri)
  if (!result) {
    result = await fetchStatute(uriOld)
    if (!result) {
      console.log(' --> not found: ', uri)
      console.log('          --> : ', uriOld)
      return null
    }
  }

  const docTitle = await parseTitlefromXML(result)
  const imageLinks = await parseImagesfromXML(result)
  const keywordList = await parseKeywordsfromXML(result)
  const commonNames = await parseCommonNamesFromXML(result)

  const xmlContent = result.data as string;
  const is_empty = await checkIsXMLEmpty(xmlContent);

  const { docYear, docNumber, docLanguage, docVersion } = parseFinlexUrl(uri)
  let statuteUuid = uuidv4()
  const statute: Statute = {
    uuid: statuteUuid,
    title: docTitle,
    number: docNumber,
    year: docYear,
    language: docLanguage,
    version: docVersion,
    content: result.data as string,
    is_empty: is_empty
  }

  statuteUuid = await setStatute(statute)

  for (const keyword of keywordList) {
    const key: StatuteKeyWord = {
      id: keyword[1],
      keyword: keyword[0],
      statute_uuid: statuteUuid,
      language: docLanguage
    }
    await setStatuteKeyword(key)
  }

  for (const commonName of commonNames) {
    const commonNameObj: CommonName = {
      uuid: uuidv4(),
      commonName: commonName,
      statuteUuid: statuteUuid,
    }
    await setCommonName(commonNameObj)
  }

  setImages(statuteUuid, docYear, docNumber, docLanguage, docVersion, imageLinks)
}

async function setSingleJudgment(uri: string) {
  const parts = uri.split('/');
  let courtLevel = 'kko'
  if (parts.includes('korkein-hallinto-oikeus')) {
    courtLevel = 'kho'
  }
  else if (parts.includes('hogsta-forvaltningsdomstolen')) {
    courtLevel = 'kho'
  }

  let language = 'fin'
  if (parts[parts.length - 6] === 'sv') {
    language = 'swe'
  }

  let html: { content: string; is_empty: boolean, keywords: string[] }
  try {
    html = await parseAkomafromURL(uri, language)
  } catch {
    console.error(`Failed to set judgment for URL: ${uri}`);
    return;
  }

  const judgment: Judgment = {
    uuid: uuidv4(),
    level: courtLevel,
    number: parts[parts.length - 1],
    year: parts[parts.length - 2],
    language: language,
    content: html.content,
    is_empty: html.is_empty,
  }
  const judgmentUuid = await setJudgment(judgment)

  let i = 0
  for (const keyword of html.keywords) {
    ++i;
    const key: JudgmentKeyWord = {
      id: `${judgment.level}:${judgment.year}:${judgment.number}-${i}`,
      keyword: keyword,
      judgment_uuid: judgmentUuid,
      language: language
    }
    await setJudgmentKeyword(key)
  }
}


async function listStatutesByYear(year: number, language: string): Promise<string[]> {
  const path = '/akn/fi/act/statute-consolidated/list';
  const uris: string[] = [];
  for (const typeStatute of ['act', 'decree']) {
    const queryParams = {
      format: 'json',
      page: 1,
      limit: 10,
      startYear: year,
      endYear: year,
      typeStatute
    };

    try {
      while (true) {
        const result = await axios.get<StatuteVersionResponse[]>(`${baseURL}${path}`, {
          params: queryParams,
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip'
          }
        });

        if (!Array.isArray(result.data)) {
          throw new Error('Invalid response format: expected an array');
        }

        const newUris = result.data.map(item => item.akn_uri);
        uris.push(...newUris);

        if (result.data.length < queryParams.limit) {
          break;
        }

        queryParams.page += 1;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`Failed to fetch statute versions for year ${year}, type ${typeStatute}: ${error.message}`);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
        }
      } else {
        console.error(`Unexpected error while fetching statute versions: ${error}`);
      }
    }
  }

  const latestVersions = getLatestStatuteVersions(uris)
    .filter(uri => uri.includes(`/${language}@`));

  console.log(`listStatutesByYear: ${year} filtered to ${latestVersions.length} latest versions in ${language}`);

  return latestVersions;
}

async function listJudgmentNumbersByYear(year: number, language: string, level: string): Promise<string[]> {
  let courtLevel = {
    fi: '',
    sv: ''
  };
  if (level === 'kho') {
    courtLevel = {fi: 'korkein-hallinto-oikeus', sv: 'hogsta-forvaltningsdomstolen'};
  } else if (level === 'kko') {
    courtLevel = {fi: 'korkein-oikeus', sv: 'hogsta-domstolen'};
  }
  const inputUrl = language === 'fin'
    ? `https://finlex.fi/fi/oikeuskaytanto/${courtLevel.fi}/ennakkopaatokset/${year}`
    : `https://finlex.fi/sv/rattspraxis/${courtLevel.sv}/prejudikat/${year}`;
  let parsedList: string[] = [];
  try {
    const result = await axios.get(inputUrl, {
      headers: { 'Accept': 'text/html', 'Accept-Encoding': 'gzip' }
    });
    const inputHTML = result.data as string;
    parsedList = parseJudgmentList(inputHTML, language, level);
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    } else {
      console.error(`Failed to fetch judgment numbers for year ${year}, language ${language}, level ${level}:`, error);
      return [];
    }
  }
  return parsedList
}

async function listJudgmentsByYear(year: number, language: string, level: string): Promise<string[]> {
  const judgmentNumbers = await listJudgmentNumbersByYear(year, language, level);
  const judgmentURLsSet = new Set<string>();
  for (const judgmentID of judgmentNumbers) {
    const url = parseURLfromJudgmentID(judgmentID);
    judgmentURLsSet.add(url);
  }
  return Array.from(judgmentURLsSet);
}

export { listStatutesByYear, setSingleStatute, listJudgmentNumbersByYear, listJudgmentsByYear, parseURLfromJudgmentID, setSingleJudgment, parseAkomafromURL, parseFinlexUrl, parseJudgmentUrl, buildFinlexUrl, buildJudgmentUrl }
