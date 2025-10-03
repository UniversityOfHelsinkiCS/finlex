import { JSDOM } from 'jsdom';
import { Heading, Chapter, hContainer } from '../types/structure.js';
import { StatuteVersion } from '../types/versions.js';

export function toArray<T>(input: T | T[]): T[] {
  return Array.isArray(input) ? input : [input];
}

export function parseHtmlHeadings(html: string): Heading[] {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const elements = Array.from(doc.querySelectorAll('h1,h2,h3,h4,h5,h6'));
  const root: Heading[] = [];
  const stack: { level: number; node: Heading }[] = [];

  for (const el of elements) {
    const level = parseInt(el.tagName.substring(1), 10);
    const heading: Heading = {
      name: el.textContent?.trim() || '',
      id: el.id || '',
      content: [],
    };

    while (stack.length && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(heading);
    } else {
      stack[stack.length - 1].node.content.push(heading);
    }

    stack.push({ level, node: heading });
  }

  return root;
}

export function parseXmlHeadings(parsed_xml : hContainer) {
  const headings: Heading[] = []

  const obj = parsed_xml.akomaNtoso.act.body.hcontainer[0]
  if (!obj) return;

  if ('chapter' in obj) {
    const chapters = toArray(obj.chapter)
    for (const chap of chapters) {
      let sub_headings: Heading[]

      if (chap.section) {
        sub_headings = parseXmlSubSections(chap)
      } else {
        sub_headings = []
      }

      let chap_name
      if (typeof chap.heading === 'object') {
        chap_name = chap.heading._.trim()
      } else if (typeof chap.heading === 'string') {
        chap_name = chap.heading.trim()
      }

      const chap_id = chap['$'].eId
      let chap_key
      const chapter_num = chap.num && typeof chap.num.trim === 'function' ? chap.num.trim() : ''
      if (chap_name === undefined) {
        chap_name = ""
        chap_key = chapter_num
      }
      else {
        chap_key = chapter_num + " - " + chap_name
      }

      headings.push({name: chap_key, id: chap_id, content: sub_headings})
    }
    return headings
  } else {
    return parseXmlSubSections(obj as Chapter)
  }
}

function parseXmlSubSections(obj: Chapter) {
  const sub_headings: Heading[] = []
  const sections = toArray(obj.section)
  for (const sec of sections) {
    if (!sec || !sec.num) {
      continue
    }
    const sec_num = sec.num.trim()
    let sec_key;
    let sec_name;
    if (typeof sec.heading === 'object') {
      sec_name = sec.heading._?.trim();
    } else if (typeof sec.heading === 'string') {
      sec_name = sec.heading.trim();
    }
    if (sec_name === undefined) {
      sec_name = ""
      sec_key = sec_num
    }
    else {
      sec_key = sec_num + " - " + sec_name
    }

    const sec_id = sec?.['$']?.eId
    sub_headings.push({name: sec_key, id: sec_id, content:[]})
  }
  return sub_headings
}

function parseStatuteVersion(uri: string): StatuteVersion {
  const match = uri.match(/^(.+\/\d+\/\d+\/(fin|swe))@(.+)?$/);
  if (!match) {
    return {
      baseUri: uri.split('@')[0],
      language: uri.includes('/fin@') ? 'fin' : 'swe',
      year: '',
      number: '',
      fullUri: uri
    };
  }

  const [, baseUri, language, version = ''] = match;
  const versionMatch = version.match(/^(\d+)?(\d+)?$/);

  return {
    baseUri,
    language,
    year: versionMatch?.[1] || '',
    number: versionMatch?.[2] || '',
    fullUri: uri
  };
}

export function getLatestStatuteVersions(uris: string[]): string[] {
  const groups = new Map<string, StatuteVersion[]>();

  uris.forEach(uri => {
    const version = parseStatuteVersion(uri);
    const key = version.baseUri;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(version);
  });

  return Array.from(groups.values()).map(versions => {
    if (versions.length === 1 && !versions[0].year && !versions[0].number) {
      return versions[0].fullUri;
    }

    const sorted = versions.sort((a, b) => {
      if (a.year !== b.year) {
        return (b.year || '0').localeCompare(a.year || '0');
      }
      return (b.number || '0').localeCompare(a.number || '0');
    });

    return sorted[0].fullUri;
  });
}
