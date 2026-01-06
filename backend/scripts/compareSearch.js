#!/usr/bin/env node
/*
  Compare search results between two Finlex services.
  Usage (run from repo root):
    node backend/scripts/compareSearch.js --q tupakka --language fin 
    node backend/scripts/compareSearch.js --q tupakka --language fin --app1 http://... --app2 http://...
    node backend/scripts/compareSearch.js --file backend/scripts/queries.txt --language fin
*/

import axios from 'axios';
import { readFileSync } from 'fs';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { q: null, file: null, language: 'fin', app1: 'https://finlex-lukija-ohtuprojekti-staging.ext.ocp-prod-0.k8s.it.helsinki.fi', app2: 'https://finlex-lukija2-ohtuprojekti-staging.ext.ocp-prod-0.k8s.it.helsinki.fi' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--q') out.q = args[++i];
    else if (a === '--file') out.file = args[++i];
    else if (a === '--language') out.language = args[++i];
    else if (a === '--app1') out.app1 = args[++i];
    else if (a === '--app2') out.app2 = args[++i];
  }
  if (!out.q && !out.file) {
    console.error('Missing --q query parameter or --file path');
    process.exit(1);
  }
  return out;
}

function buildUrl(base, q, language) {
  const params = new URLSearchParams({ q, language });
  return `${base}/api/statute/search?${params.toString()}`;
}

function asArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.content)) return data.content; // Finlex API wraps in {type, content}
  if (data && Array.isArray(data.results)) return data.results; // fallback
  return [];
}

function indexById(list) {
  const map = new Map();
  for (const item of list) {
    // API returns docYear, docNumber, docTitle (not year, number, title)
    const key = item.id || `${item.docYear || ''}:${item.docNumber || ''}:${item.docTitle || ''}`;
    map.set(key, item);
  }
  return map;
}

function diffLists(aList, bList) {
  const aMap = indexById(aList);
  const bMap = indexById(bList);
  const onlyA = [];
  const onlyB = [];

  for (const [id, item] of aMap.entries()) {
    if (!bMap.has(id)) onlyA.push(item);
  }
  for (const [id, item] of bMap.entries()) {
    if (!aMap.has(id)) onlyB.push(item);
  }
  return { onlyA, onlyB };
}

async function compareQuery(q, language, app1, app2) {
  const app1Url = buildUrl(app1, q, language);
  const app2Url = buildUrl(app2, q, language);

  try {
    const [app1Resp, app2Resp] = await Promise.all([
      axios.get(app1Url, { headers: { Accept: 'application/json' } }),
      axios.get(app2Url, { headers: { Accept: 'application/json' } }),
    ]);

    const app1List = asArray(app1Resp.data);
    const app2List = asArray(app2Resp.data);

    const { onlyA: onlyApp1, onlyB: onlyApp2 } = diffLists(app1List, app2List);
    
    return {
      q,
      app1Count: app1List.length,
      app2Count: app2List.length,
      onlyApp1,
      onlyApp2,
      match: onlyApp1.length === 0 && onlyApp2.length === 0
    };
  } catch (err) {
    return {
      q,
      error: err.response ? `${err.response.status} ${err.config?.url}` : err.message
    };
  }
}

async function main() {
  const { q, file, language, app1, app2 } = parseArgs();
  
  let queries = [];
  if (file) {
    const content = readFileSync(file, 'utf-8');
    queries = content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  } else {
    queries = [q];
  }

  console.log(`Testing ${queries.length} queries against app1 and app2 (language=${language})\n`);

  const results = [];
  for (const query of queries) {
    process.stdout.write(`Testing "${query}"... `);
    const result = await compareQuery(query, language, app1, app2);
    results.push(result);
    
    if (result.error) {
      console.log(`ERROR: ${result.error}`);
    } else if (result.match) {
      console.log(`✓ Match (app1: ${result.app1Count}, app2: ${result.app2Count})`);
    } else {
      console.log(`✗ Diff (app1: ${result.app1Count}, app2: ${result.app2Count}, only-app1: ${result.onlyApp1.length}, only-app2: ${result.onlyApp2.length})`);
    }
  }

  console.log('\n=== Summary ===');
  const matches = results.filter(r => !r.error && r.match).length;
  const diffs = results.filter(r => !r.error && !r.match).length;
  const errors = results.filter(r => r.error).length;
  console.log(`Total: ${results.length}, Matches: ${matches}, Diffs: ${diffs}, Errors: ${errors}`);

  const problemResults = results.filter(r => r.error || !r.match);
  if (problemResults.length > 0) {
    console.log('\n=== Details for non-matching queries ===');
    for (const result of problemResults) {
      if (result.error) {
        console.log(`\n"${result.q}": ERROR - ${result.error}`);
      } else {
        console.log(`\n"${result.q}": app1=${result.app1Count}, app2=${result.app2Count}`);
        if (result.onlyApp1.length > 0) {
          console.log(`  Only in app1 (${result.onlyApp1.length}):`, result.onlyApp1.map(i => `${i.docYear}/${i.docNumber}`).join(', '));
        }
        if (result.onlyApp2.length > 0) {
          console.log(`  Only in app2 (${result.onlyApp2.length}):`, result.onlyApp2.map(i => `${i.docYear}/${i.docNumber}`).join(', '));
        }
      }
    }
  }
}

main();
