import axios from 'axios';
import xmldom from '@xmldom/xmldom';

// Compares the full text content of a statute as served by a Tenttilex instance
// (AkomaNtoso XML from /api/statute/id/...) against the same statute on www.finlex.fi.
// www.finlex.fi is a Next.js app: the statute text is not in the SSR HTML but in the
// React Server Components payload (self.__next_f.push(...) scripts), which we parse here.

export const DEFAULT_TENTTILEX_URL = 'https://finlex.ext.ocp-prod-0.k8s.it.helsinki.fi';
const FINLEX_URL = 'https://www.finlex.fi';

const LANG_MAP: Record<string, { finlexPath: string; htmlLang: string }> = {
  fin: { finlexPath: 'fi/lainsaadanto', htmlLang: 'fi' },
  swe: { finlexPath: 'sv/lagstiftning', htmlLang: 'sv' },
};

// Inline elements do not break words; every other element boundary is treated as whitespace.
const INLINE_HTML = new Set(['i', 'b', 'em', 'strong', 'sup', 'sub', 'u', 'a', 'abbr', 'small', 'mark']);
const INLINE_XML = new Set(['i', 'b', 'u', 'sup', 'sub', 'span', 'ref', 'term', 'abbr', 'inline', 'mref', 'rref', 'date', 'docTitle', 'docNumber', 'docDate', 'docType']);
// XML elements whose text is not shown as statute text
const SKIP_XML = new Set(['meta', 'preface']);

// ---------- Tenttilex (AkomaNtoso XML) ----------

const OVL = 'finlex:originalVersionLabel';
const childElement = (el: xmldom.Element, name: string): xmldom.Element | null => {
  for (let c = el.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === 1 && (c as xmldom.Element).localName === name) return c as xmldom.Element;
  }
  return null;
};

// The "(label)"s Tenttilex shows for an element, mirroring frontend/public/akomo_ntoso.xsl
function versionLabelsShown(el: xmldom.Element): string[] {
  const name = el.localName ?? '';
  if (['part', 'chapter', 'section', 'subsection'].includes(name)) {
    const heading = childElement(el, 'heading');
    if (name === 'subsection' && !heading && !childElement(el, 'num')) return [];
    // the element and its heading may have been amended separately: show both labels,
    // except one the heading text already contains as a <ref>
    const headingText = heading?.textContent ?? '';
    const labels = [el.getAttribute(OVL), heading?.getAttribute(OVL)]
      .filter((l): l is string => !!l && !headingText.includes(l));
    return [...new Set(labels)];
  }
  const label = versionLabelShown(el);
  return label ? [label] : [];
}

function versionLabelShown(el: xmldom.Element): string | null {
  const name = el.localName ?? '';
  if (['paragraph', 'subparagraph', 'intro'].includes(name)) return el.getAttribute(OVL) || null;
  if (name === 'crossHeading') {
    const label = el.getAttribute(OVL);
    return label && !(el.textContent ?? '').includes(label) ? label : null;
  }
  if (name === 'p') {
    // a p without following p siblings repeats its subsection's label; p in table cells and
    // in numbered items have their own templates in the XSL and get no label
    const parentName = (el.parentNode as xmldom.Element | null)?.localName ?? '';
    const grandName = (el.parentNode?.parentNode as xmldom.Element | null)?.localName ?? '';
    if (['td', 'th'].includes(parentName)) return null;
    if (['content', 'intro'].includes(parentName) && ['paragraph', 'subparagraph'].includes(grandName)) return null;
    for (let s = el.nextSibling; s; s = s.nextSibling) {
      if (s.nodeType === 1 && (s as xmldom.Element).localName === 'p') return null;
    }
    for (let a = el.parentNode; a; a = a.parentNode) {
      if (a.nodeType === 1 && (a as xmldom.Element).localName === 'subsection') {
        return (a as xmldom.Element).getAttribute(OVL) || null;
      }
    }
  }
  return null;
}

export function extractTextFromAkomaNtoso(xml: string): string {
  const doc = new xmldom.DOMParser().parseFromString(xml, 'text/xml');
  const out: string[] = [];
  const walk = (node: xmldom.Node) => {
    if (node.nodeType === 3 || node.nodeType === 4) { // text / CDATA
      out.push(node.nodeValue ?? '');
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 9) return;
    const name = node.nodeType === 1 ? (node as xmldom.Element).localName ?? '' : '';
    if (SKIP_XML.has(name)) return;
    const block = name !== '' && !INLINE_XML.has(name);
    if (block) out.push('\n');
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
    if (node.nodeType === 1) {
      for (const label of versionLabelsShown(node as xmldom.Element)) out.push(` (${label}) `);
    }
    if (block) out.push('\n');
  };
  walk(doc);
  return normalizeWhitespace(out.join(''));
}

// ---------- www.finlex.fi (Next.js RSC payload) ----------

type RscRows = Record<string, unknown>;

export function parseRscPayload(html: string): RscRows {
  let payload = '';
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    payload += JSON.parse(m[1]) as string;
  }
  // Rows are "<hex id>:<json>\n", except text rows "<hex id>:T<hex byte length>,<text>" which
  // carry long strings (e.g. whole paragraphs) and have no terminator, so the payload is read
  // sequentially and text rows are cut by their UTF-8 byte length.
  const buf = Buffer.from(payload, 'utf8');
  const rows: RscRows = {};
  let pos = 0;
  while (pos < buf.length) {
    const colon = buf.indexOf(0x3a, pos); // ':'
    if (colon < 0) break;
    const id = buf.toString('utf8', pos, colon).trim();
    if (buf[colon + 1] === 0x54) { // 'T'
      const comma = buf.indexOf(0x2c, colon + 2); // ','
      const len = parseInt(buf.toString('utf8', colon + 2, comma), 16);
      rows[id] = buf.toString('utf8', comma + 1, comma + 1 + len);
      pos = comma + 1 + len;
      continue;
    }
    let nl = buf.indexOf(0x0a, colon + 1);
    if (nl < 0) nl = buf.length;
    try {
      rows[id] = JSON.parse(buf.toString('utf8', colon + 1, nl));
    } catch {
      // module/hint rows ("I[...]", "HL[...]") are not plain JSON; not needed
    }
    pos = nl + 1;
  }
  return rows;
}

const isElement = (n: unknown): n is ['$', string, unknown, Record<string, unknown> | null] =>
  Array.isArray(n) && n[0] === '$' && n.length === 4 && typeof n[1] === 'string';

export function extractTextFromFinlexHtml(html: string, htmlLang: string): string | null {
  const rows = parseRscPayload(html);
  const resolve = (v: unknown): unknown => {
    if (typeof v === 'string' && /^\$L?[0-9a-f]+$/.test(v)) return rows[v.replace(/^\$L?/, '')];
    return v;
  };

  const findSection = (node: unknown, depth = 0): unknown => {
    node = resolve(node);
    if (!node || typeof node !== 'object' || depth > 500) return null;
    if (isElement(node)) {
      const props = node[3] ?? {};
      if (typeof props.className === 'string' && props.className.includes('__akomaNtoso') && props.lang === htmlLang) {
        return node;
      }
      for (const v of Object.values(props)) {
        const r = findSection(v, depth + 1);
        if (r) return r;
      }
      return null;
    }
    const values = Array.isArray(node) ? node : Object.values(node);
    for (const c of values) {
      const r = findSection(c, depth + 1);
      if (r) return r;
    }
    return null;
  };

  let section: unknown = null;
  for (const row of Object.values(rows)) {
    section = findSection(row);
    if (section) break;
  }
  if (!section) return null;

  const out: string[] = [];
  const walk = (node: unknown, depth = 0) => {
    node = resolve(node);
    if (node == null || typeof node === 'boolean' || depth > 2000) return;
    if (typeof node === 'string') {
      if (node.startsWith('$$')) out.push(node.slice(1));
      else if (!node.startsWith('$')) out.push(node);
      return;
    }
    if (typeof node === 'number') { out.push(String(node)); return; }
    if (isElement(node)) {
      const type = node[1];
      const props = node[3] ?? {};
      // "Tästä säädöksestä on saatavilla vain perustiedot…" placeholder is not statute text
      if (typeof props.className === 'string' && props.className.includes('__contentAbsent')) return;
      const block = !INLINE_HTML.has(type);
      if (block) out.push('\n');
      const inner = props.dangerouslySetInnerHTML as { __html?: string } | undefined;
      if (inner?.__html) out.push(inner.__html.replace(/<[^>]+>/g, ' '));
      walk(props.children, depth + 1);
      if (block) out.push('\n');
      return;
    }
    if (Array.isArray(node)) for (const c of node) walk(c, depth + 1);
  };
  walk(section);
  return normalizeWhitespace(out.join(''));
}

// ---------- diff ----------

function normalizeWhitespace(s: string): string {
  return s
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/ *\n[\s]*/g, '\n')
    .trim();
}

// Words and single punctuation characters are separate tokens, so that "(x)." and "( x ) ." compare equal
const TOKEN = /[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu;
const tokenize = (s: string): string[] => s.match(TOKEN) ?? [];

// Tokens with a flag telling whether whitespace preceded them, to rebuild readable text for hunks
function tokenizeWithSpacing(s: string): { tokens: string[]; spaced: boolean[] } {
  const tokens: string[] = [], spaced: boolean[] = [];
  let last = 0;
  for (const m of s.matchAll(TOKEN)) {
    tokens.push(m[0]);
    spaced.push(m.index > last);
    last = m.index + m[0].length;
  }
  return { tokens, spaced };
}

// Amendment labels like "(29.6.2021/637)" are positioned differently by Tenttilex and Finlex
// (after vs. before a heading), so they are compared separately as a multiset.
const VERSION_LABEL = /\(\s*\d{1,2}\.\d{1,2}\.\d{4}\s*\/\s*\d+\s*\)/g;

// finlex.fi prints the label of an attachment heading twice in a row, e.g.
// "Liite (1.3.2018/164) (1.3.2018/164)"; a label repeated back to back is counted once
const REPEATED_LABEL = /(\(\s*\d{1,2}\.\d{1,2}\.\d{4}\s*\/\s*\d+\s*\))(?:\s*\1)+/g;

export function splitVersionLabels(text: string, collapseRepeats = false): { text: string; labels: string[] } {
  const deduped = collapseRepeats ? text.replace(REPEATED_LABEL, '$1') : text;
  const labels = (deduped.match(VERSION_LABEL) ?? []).map(l => l.replace(/\s+/g, ''));
  return { text: deduped.replace(VERSION_LABEL, ' '), labels };
}

function multisetDiff(a: string[], b: string[]): string[] {
  const counts = new Map<string, number>();
  for (const x of b) counts.set(x, (counts.get(x) ?? 0) + 1);
  const out: string[] = [];
  for (const x of a) {
    const c = counts.get(x) ?? 0;
    if (c > 0) counts.set(x, c - 1); else out.push(x);
  }
  return out;
}

export interface DiffHunk {
  tenttilex: string;
  finlex: string;
  contextBefore: string;
  contextAfter: string;
}

// Myers O(ND) diff on token arrays. Returns null if more than maxD edits are needed.
type Op = ['=' | '-' | '+', number, number]; // kind, index in a, index in b

function myersDiff(a: string[], b: string[], maxD: number): Op[] | null {
  const n = a.length, m = b.length, max = n + m;
  const limit = Math.min(max, maxD);
  const offset = limit + 1;
  let v = new Int32Array(2 * limit + 3);
  const trace: Int32Array[] = [];
  let found = false;
  for (let d = 0; d <= limit; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[offset + k] = x;
      if (x >= n && y >= m) { found = true; break; }
    }
    if (found) break;
  }
  if (!found) return null;
  // backtrack
  const ops: Op[] = [];
  let x = n, y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    v = trace[d];
    const k = x - y;
    const prevK = (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) ? k + 1 : k - 1;
    const prevX = d === 0 ? 0 : v[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) { ops.push(['=', x - 1, y - 1]); x--; y--; }
    if (d > 0) {
      if (x === prevX) ops.push(['+', x, y - 1]); else ops.push(['-', x - 1, y]);
      x = prevX; y = prevY;
    }
  }
  while (x > 0 && y > 0) { ops.push(['=', x - 1, y - 1]); x--; y--; }
  return ops.reverse();
}

// Patience-style diff: anchor on K-grams that occur exactly once in both texts (kept in
// increasing order via LIS), then run Myers only on the gaps between anchors. Keeps large
// statutes with many changes (e.g. rikoslaki, ~90k tokens) tractable.
function anchoredDiff(a: string[], b: string[], maxGapD: number): Op[] {
  const K = 6;
  const key = (t: string[], i: number) => t.slice(i, i + K).join('\u0001');
  const countA = new Map<string, number>(), posB = new Map<string, number>(), countB = new Map<string, number>();
  for (let i = 0; i + K <= a.length; i++) { const k = key(a, i); countA.set(k, (countA.get(k) ?? 0) + 1); }
  for (let i = 0; i + K <= b.length; i++) { const k = key(b, i); countB.set(k, (countB.get(k) ?? 0) + 1); posB.set(k, i); }
  const pairs: [number, number][] = [];
  for (let i = 0; i + K <= a.length; i++) {
    const k = key(a, i);
    if (countA.get(k) === 1 && countB.get(k) === 1) pairs.push([i, posB.get(k)!]);
  }
  // longest increasing subsequence on b-index
  const tails: number[] = [], prev = new Int32Array(pairs.length).fill(-1);
  for (let i = 0; i < pairs.length; i++) {
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (pairs[tails[mid]][1] < pairs[i][1]) lo = mid + 1; else hi = mid; }
    if (lo > 0) prev[i] = tails[lo - 1];
    tails[lo] = i;
  }
  const anchors: [number, number][] = [];
  for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = prev[i]) anchors.push(pairs[i]);
  anchors.reverse();

  const ops: Op[] = [];
  let x = 0, y = 0;
  const gap = (ax: number, by: number) => {
    const sub = myersDiff(a.slice(x, ax), b.slice(y, by), maxGapD);
    if (sub) for (const [k, i, j] of sub) ops.push([k, i + x, j + y]);
    else {
      for (let i = x; i < ax; i++) ops.push(['-', i, y]);
      for (let j = y; j < by; j++) ops.push(['+', ax, j]);
    }
    x = ax; y = by;
  };
  for (const [ia, ib] of anchors) {
    if (ia < x || ib < y) continue; // overlaps a region already matched
    gap(ia, ib);
    while (x < a.length && y < b.length && a[x] === b[y]) { ops.push(['=', x, y]); x++; y++; }
  }
  gap(a.length, b.length);
  return ops;
}

export function diffTexts(tenttilexText: string, finlexText: string, opts?: { context?: number; maxD?: number }) {
  const context = opts?.context ?? 8;
  const ta = tokenizeWithSpacing(tenttilexText);
  const tb = tokenizeWithSpacing(finlexText);
  const a = ta.tokens, b = tb.tokens;
  const join = (idx: number[], t: { tokens: string[]; spaced: boolean[] }) =>
    idx.map((i, n) => (n > 0 && t.spaced[i] ? ' ' : '') + t.tokens[i]).join('');
  const ops = anchoredDiff(a, b, opts?.maxD ?? 2000);

  const hunks: DiffHunk[] = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i][0] === '=') { i++; continue; }
    // collect a change block; merge blocks separated by short runs of equal tokens
    const start = i;
    let end = i;
    while (end < ops.length) {
      if (ops[end][0] !== '=') { end++; continue; }
      let j = end;
      while (j < ops.length && ops[j][0] === '=') j++;
      if (j < ops.length && j - end <= 3) { end = j; continue; }
      break;
    }
    const block = ops.slice(start, end);
    const before = ops.slice(Math.max(0, start - context), start).filter(o => o[0] === '=').map(o => o[1]);
    const after: number[] = [];
    for (let j = end; j < ops.length && after.length < context && ops[j][0] === '='; j++) after.push(ops[j][1]);
    hunks.push({
      tenttilex: join(block.filter(o => o[0] !== '+').map(o => o[1]), ta),
      finlex: join(block.filter(o => o[0] !== '-').map(o => o[2]), tb),
      contextBefore: join(before, ta),
      contextAfter: join(after, ta),
    });
    i = end;
  }
  return hunks;
}

// ---------- fetch + compare ----------

// A difference finlex.fi only shows differently: list numbers "1." vs "1", "24.10" vs "24.1",
// a "Huomautus:"/"Observera:" heading word
export function isCosmeticHunk(h: { tenttilex: string; finlex: string; contextBefore?: string }): boolean {
  const norm = (s: string) => s.replace(/Huomautus:|Observera:/g, '').replace(/\./g, '').replace(/\b0+(\d)/g, '$1').split(/\s+/).filter(Boolean).join(' ')
  if (norm(h.tenttilex) === norm(h.finlex)) return true
  // "24.10" shown as "24.1": the hunk is the decimal part right after "24."
  return /\d\.$/.test(h.contextBefore ?? '') && /^\d+$/.test(h.tenttilex) && h.tenttilex.replace(/0+$/, '') === h.finlex
}

export interface StatuteComparison {
  year: number;
  number: string;
  language: string;
  tenttilexUrl: string;
  finlexUrl: string;
  status: 'identical' | 'different' | 'missing_tenttilex' | 'missing_finlex' | 'error';
  error?: string;
  tenttilexWords?: number;
  finlexWords?: number;
  hunks?: DiffHunk[];
  // amendment labels such as "(29.6.2021/637)" present on only one side
  labelsOnlyInTenttilex?: string[];
  labelsOnlyInFinlex?: string[];
}

// GET as text; retries rate limiting (429) and server errors with exponential backoff,
// honouring Retry-After when given. Other statuses are returned to the caller.
async function getWithRetry(url: string, headers?: Record<string, string>, maxRetries = 8) {
  for (let attempt = 0; ; attempt++) {
    const res = await axios.get<string>(url, { responseType: 'text', validateStatus: () => true, timeout: 60000, headers });
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= maxRetries) return res;
    const retryAfter = parseInt(String(res.headers['retry-after'] ?? ''), 10);
    const delay = Number.isFinite(retryAfter)
      ? retryAfter * 1000
      : Math.min(30000, 1000 * 2 ** attempt) * (0.5 + Math.random() / 2);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

export async function compareStatute(
  year: number, number: string, language: string,
  tenttilexBase: string = DEFAULT_TENTTILEX_URL,
): Promise<StatuteComparison> {
  const lang = LANG_MAP[language];
  const base = tenttilexBase.replace(/\/+$/, '');
  const tenttilexApi = `${base}/api/statute/id/${year}/${encodeURIComponent(number)}/${language}`;
  const finlexUrl = `${FINLEX_URL}/${lang.finlexPath}/${year}/${encodeURIComponent(number)}`;
  const result: StatuteComparison = {
    year, number, language,
    tenttilexUrl: `${base}/lainsaadanto/${year}/${encodeURIComponent(number)}`,
    finlexUrl,
    status: 'error',
  };

  try {
    const [tRes, fRes] = await Promise.all([
      getWithRetry(tenttilexApi),
      getWithRetry(finlexUrl, { 'User-Agent': 'tenttilex-compare' }),
    ]);
    if (tRes.status === 404) return { ...result, status: 'missing_tenttilex' };
    if (tRes.status !== 200) return { ...result, error: `Tenttilex HTTP ${tRes.status}` };
    if (fRes.status === 404) return { ...result, status: 'missing_finlex' };
    if (fRes.status !== 200) return { ...result, error: `Finlex HTTP ${fRes.status}` };

    const fRaw = extractTextFromFinlexHtml(fRes.data, lang.htmlLang);
    if (fRaw === null) return { ...result, status: 'missing_finlex', error: 'Statute text not found on finlex.fi page' };
    const t = splitVersionLabels(extractTextFromAkomaNtoso(tRes.data));
    const f = splitVersionLabels(fRaw, true);

    const countWords = (text: string) => tokenize(text).filter(tok => /[\p{L}\p{N}]/u.test(tok)).length;
    result.tenttilexWords = countWords(t.text);
    result.finlexWords = countWords(f.text);
    result.labelsOnlyInTenttilex = multisetDiff(t.labels, f.labels);
    result.labelsOnlyInFinlex = multisetDiff(f.labels, t.labels);

    const hunks = diffTexts(t.text, f.text);
    const identical = hunks.length === 0
      && result.labelsOnlyInTenttilex.length === 0 && result.labelsOnlyInFinlex.length === 0;
    return { ...result, status: identical ? 'identical' : 'different', hunks };
  } catch (error) {
    return { ...result, error: error instanceof Error ? error.message : String(error) };
  }
}

// ---------- year level ----------

export interface YearComparison {
  year: number;
  language: string;
  total: number;
  counts: Record<StatuteComparison['status'], number>;
  results: StatuteComparison[];
}

// Statute numbers of a year on a Tenttilex instance
async function listTenttilexNumbers(base: string, year: number, language: string): Promise<string[]> {
  const res = await axios.get<{ docNumber: string }[]>(`${base}/api/statute/${year}/${language}`, { timeout: 60000 });
  if (!Array.isArray(res.data)) throw new Error(`Tenttilex statute list for ${year} is not an array`);
  return res.data.map(s => String(s.docNumber));
}

// Statute numbers of a year in Finlex (open API), so statutes missing from Tenttilex are found too
async function listFinlexNumbers(year: number, language: string): Promise<string[]> {
  const { listStatutesByYear, parseFinlexUrl } = await import('../db/load.js');
  const uris = await listStatutesByYear(year, language);
  return uris.map(uri => parseFinlexUrl(uri).docNumber);
}

// Natural sort: "2" < "10" < "39-001"
const compareNumbers = (a: string, b: string) => a.localeCompare(b, 'fi', { numeric: true });

export async function compareYear(
  year: number, language: string,
  opts?: {
    tenttilexBase?: string;
    concurrency?: number;
    onProgress?: (done: number, total: number, latest: StatuteComparison) => void;
  },
): Promise<YearComparison> {
  const base = (opts?.tenttilexBase ?? DEFAULT_TENTTILEX_URL).replace(/\/+$/, '');
  const [tNumbers, fNumbers] = await Promise.all([
    listTenttilexNumbers(base, year, language),
    listFinlexNumbers(year, language),
  ]);
  const numbers = [...new Set([...tNumbers, ...fNumbers])].sort(compareNumbers);

  const results: StatuteComparison[] = new Array(numbers.length);
  let next = 0, done = 0;
  const worker = async () => {
    while (next < numbers.length) {
      const i = next++;
      results[i] = await compareStatute(year, numbers[i], language, base);
      done++;
      opts?.onProgress?.(done, numbers.length, results[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts?.concurrency ?? 4) }, worker));

  const counts: YearComparison['counts'] = { identical: 0, different: 0, missing_tenttilex: 0, missing_finlex: 0, error: 0 };
  for (const r of results) counts[r.status]++;
  return { year, language, total: numbers.length, counts, results };
}
