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
import Bottleneck from 'bottleneck';

const finlexLimiter = new Bottleneck({
  minTime: 350,
  maxConcurrent: 1,
  reservoir: 200,
  reservoirRefreshInterval: 60 * 1000,
  reservoirRefreshAmount: 200,
});

let finlexRequestCount = 0;
let lastMinuteCount = 0;
finlexLimiter.on('executing', () => {
  finlexRequestCount += 1;
});

// Report request count every minute
const finlexLogInterval = setInterval(() => {
  const requestsThisMinute = finlexRequestCount - lastMinuteCount;
  console.log(`[finlexLimiter] ${requestsThisMinute} requests in last minute (${finlexRequestCount} total)`);
  lastMinuteCount = finlexRequestCount;
}, 60 * 1000);

export function stopFinlexLimiterLogging() {
  clearInterval(finlexLogInterval);
}

// Generic fetch with exponential backoff and jitter, still honoring the limiter.
async function fetchWithBackoff<T = unknown>(url: string, config: any, opts?: { maxRetries?: number; baseDelayMs?: number; maxDelayMs?: number; retryOn?: (status: number) => boolean }): Promise<AxiosResponse<T>> {
  const maxRetries = opts?.maxRetries ?? 10;
  const baseDelayMs = opts?.baseDelayMs ?? 500; // initial backoff
  const maxDelayMs = opts?.maxDelayMs ?? 8000; // cap
  const retryOn = opts?.retryOn ?? ((status) => status === 429 || (status >= 500 && status < 600));

  let attempt = 0;
  while (true) {
    try {
      // Schedule on limiter to enforce rate limits
      const resp = await finlexLimiter.schedule(() => axios.get<T>(url, config));
      return resp;
    } catch (error) {
      if (!axios.isAxiosError(error)) throw error;
      const status = error.response?.status ?? 0;
      attempt += 1;
      if (attempt > maxRetries || !retryOn(status)) {
        throw error;
      }
      // Respect Retry-After header when present
      const retryAfterHeader = error.response?.headers?.['retry-after'];
      let delayMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
      // Apply jitter (+/- 30%)
      const jitter = delayMs * (Math.random() * 0.6 - 0.3);
      delayMs = Math.max(250, delayMs + jitter);
      console.log(`[backoff] attempt ${attempt}/${maxRetries} status ${status}, delaying ${Math.round(delayMs)}ms for ${url}`);
      await new Promise(res => setTimeout(res, delayMs));
      // Loop and retry
    }
  }
}


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
  const baseUrl = 'https://opendata.finlex.fi/finlex/avoindata/v1/akn/fi/act'

  return {
    uri: `${baseUrl}/statute/${statute.year}/${statute.number}/${statute.language}@`,
    uriOld: `${baseUrl}/statute/${statute.year}/${statute.number}/${statute.language}@${statute.version ? statute.version : ''}`
  };
  /*
  return {
    uriOld: `${baseUrl}/statute-consolidated/${statute.year}/${statute.number}/${statute.language}@${statute.version ? statute.version : ''}`,
    uri: `${baseUrl}/statute-consolidated/${statute.year}/${statute.number}/${statute.language}@${statute.version ? statute.version : ''}`
  };
  */
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

function detectLanguage(text: string): 'fin' | 'swe' | 'unknown' {
  // Simple heuristic language detection for Finnish vs Swedish
  const lowerText = text.toLowerCase();
  
  // Common Finnish words and patterns
  const finnishIndicators = [
    'että', 'jossa', 'jonka', 'kanssa', 'mukaan', 'joiden', 'jotka',
    'vuonna', 'vuoden', 'korkein oikeus', 'hovioikeus', 'käräjäoikeus',
    'asiassa', 'kanne', 'valitus', 'tuomio', 'päätös', 'perustuslaki',
    'laki', 'säännös', 'oikeus', 'velvollisuus', 'sopimusrikkomus',
    'olla', 'ollut', 'ollut', 'ollaan', 'olleet', 'ovat', 'ole', 
    'tämä', 'näin', 'sekä', 'myös', 'vain', 'kuin', 'ilman',
    'saada', 'tehdä', 'antaa', 'pitää', 'tulla', 'voida', 'käydä',
  ];
  
  // Common Swedish words and patterns
  const swedishIndicators = [
    'att', 'som', 'med', 'enligt', 'från', 'till', 'har', 'eller',
    'år', 'året', 'högsta domstolen', 'hovrätt', 'tingsrätt',
    'ärende', 'talan', 'besvär', 'dom', 'beslut', 'grundlag',
    'lag', 'bestämmelse', 'rätt', 'skyldighet', 'avtalsbrott',
    'vara', 'varit', 'är', 'var', 'hade', 'skulle', 'kunde',
    'denna', 'detta', 'den', 'det', 'och', 'även', 'bara',
    'få', 'göra', 'ge', 'hålla', 'komma', 'kunna', 'skall',
  ];
  
  let finnishScore = 0;
  let swedishScore = 0;
  
  for (const indicator of finnishIndicators) {
    if (lowerText.includes(indicator)) finnishScore++;
  }
  
  for (const indicator of swedishIndicators) {
    if (lowerText.includes(indicator)) swedishScore++;
  }
  
  // Character patterns: å is Swedish-specific (strong signal)
  const aRingCount = (text.match(/å/gi) || []).length;
  swedishScore += aRingCount * 3;
  
  // Finnish tends to have more double vowels
  const doubleVowels = text.match(/(aa|ee|ii|oo|uu|yy|ää|öö)/gi);
  if (doubleVowels && doubleVowels.length > 1) finnishScore += 2;
  
  // Default to unknown if score is too low to be confident
  const totalScore = finnishScore + swedishScore;
  if (totalScore < 2) return 'unknown';
  
  if (finnishScore > swedishScore) return 'fin';
  if (swedishScore > finnishScore) return 'swe';
  return 'unknown';
}

function parseFlightStreamContent(html: string, lang?: 'fin' | 'swe'): string[] {
  const scriptRegex = /<script>self\.__next_f\.push\(\[1,(.*?)\]\)<\/script>/gs;
  const matches = Array.from(html.matchAll(scriptRegex));
  
  if (matches.length === 0) {
    return [];
  }
  
  const combinedPayload = matches.map(m => m[1]).join('\n');
  
  const highlightableRegex = /\\"className\\":\\"highlightable\\",\\"children\\":\\"((?:[^"\\]|\\.)*?)\\"[}\]]/g;
  const contentMatches = Array.from(combinedPayload.matchAll(highlightableRegex));
  
  const fragments: string[] = [];
  for (const match of contentMatches) {
    let text = match[1]
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .trim();
    
    if (text && 
        text.length > 3 &&
        !text.match(/^[a-f0-9]+:/) &&
        !text.match(/^\$/) && 
        !text.includes('$undefined') &&
        !text.includes('"className"') &&
        !text.includes('"style"')) {
      
      // If language filtering is requested, detect the language of this paragraph
      if (lang) {
        const detectedLang = detectLanguage(text);
        // Only include paragraphs that definitively match the target language
        if (detectedLang !== lang) {
          continue; // Skip paragraphs that are wrong language OR unknown
        }
      }
      
      fragments.push(text);
    }
  }
  
  return fragments;
}

function extractLangSectionFromDom(inputHTML: string, lang: 'fin' | 'swe'): { content: string; is_empty: boolean } | null {
  const dom = new JSDOM(inputHTML);
  const doc = dom.window.document;

  // Finlex uses two-letter language tags in the rendered Akomantoso section
  const langCode = lang === 'fin' ? 'fi' : 'sv';
  const section = doc.querySelector(`section[class*="akomaNtoso"][lang="${langCode}"]`) as HTMLElement | null;
  if (!section) return null;

  const is_empty = (section.textContent ?? '').trim() === '';
  return { content: section.outerHTML, is_empty };
}

async function parseAkomafromURL(inputURL: string, lang: string): Promise<{ content: string; is_empty: boolean, keywords: string[] }> {
  const result = await fetchWithBackoff<string>(inputURL, {
    headers: { 'Accept': 'text/html', 'Accept-Encoding': 'gzip' }
  });
  const inputHTML = result.data as string;
  const keywords = parseKeywordsfromHTML(inputHTML, lang);
  // Prefer DOM extraction scoped by the explicit lang attribute to avoid mixed-language payloads.
  const domSection = extractLangSectionFromDom(inputHTML, lang === 'fin' ? 'fin' : 'swe');
  if (domSection) {
    return { content: domSection.content, is_empty: domSection.is_empty, keywords };
  }
  
  const flightFragments = parseFlightStreamContent(inputHTML, lang === 'fin' ? 'fin' : 'swe');
  
  if (flightFragments.length > 0) {
    const paragraphs = flightFragments
      .map(text => `<p class="highlightable">${text}</p>`)
      .join('\n');
    
    const content = `<section class="styles_akomaNtoso__parsed">\n${paragraphs}\n</section>`;
    const is_empty = flightFragments.length === 0 || flightFragments.every(f => f.trim() === '');
    
    return { content, is_empty, keywords };
  }
  
  // Fallback to DOM parsing for older pages
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
      const result = await fetchWithBackoff<ArrayBuffer>(url, {
        headers: { 'Accept': 'image/*', 'Accept-Encoding': 'gzip' },
        responseType: 'arraybuffer'
      });

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
        content: Buffer.from(result.data as ArrayBuffer),
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
    const result = await fetchWithBackoff<string>(`${uri}`, {
      headers: { 'Accept': 'application/xml', 'Accept-Encoding': 'gzip' }
    });
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
        const result = await finlexLimiter.schedule(() => axios.get<StatuteVersionResponse[]>(`${baseURL}${path}`, {
          params: queryParams,
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip'
          }
        }));
        // Optionally we could use fetchWithBackoff here as well, but since pagination drives many calls
        // and limiter already smooths throughput, keeping as-is to avoid excessive retries.

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
          //console.error('Response status:', error.response.status);
          //console.error('Response data:', error.response.data);
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
    const result = await fetchWithBackoff<string>(inputUrl, {
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
