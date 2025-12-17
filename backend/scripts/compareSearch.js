#!/usr/bin/env node
/*
  Compare search results between two Finlex services.
  Usage:
    node scripts/compareSearch.js --q tupakka --language fin 
    node scripts/compareSearch.js --q tupakka --language fin --prod https://... --staging https://...
    node scripts/compareSearch.js --file words.txt --language fin
*/

import axios from 'axios';
import { readFileSync } from 'fs';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { q: null, file: null, language: 'fin', prod: 'https://finlex.ext.ocp-prod-0.k8s.it.helsinki.fi', staging: 'https://finlex-lukija-ohtuprojekti-staging.ext.ocp-prod-0.k8s.it.helsinki.fi' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--q') out.q = args[++i];
    else if (a === '--file') out.file = args[++i];
    else if (a === '--language') out.language = args[++i];
    else if (a === '--prod') out.prod = args[++i];
    else if (a === '--staging') out.staging = args[++i];
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

async function compareQuery(q, language, prod, staging) {
  const prodUrl = buildUrl(prod, q, language);
  const stagingUrl = buildUrl(staging, q, language);

  try {
    const [prodResp, stagingResp] = await Promise.all([
      axios.get(prodUrl, { headers: { Accept: 'application/json' } }),
      axios.get(stagingUrl, { headers: { Accept: 'application/json' } }),
    ]);

    const prodList = asArray(prodResp.data);
    const stagingList = asArray(stagingResp.data);

    const { onlyA: onlyProd, onlyB: onlyStaging } = diffLists(prodList, stagingList);
    
    return {
      q,
      prodCount: prodList.length,
      stagingCount: stagingList.length,
      onlyProd,
      onlyStaging,
      match: onlyProd.length === 0 && onlyStaging.length === 0
    };
  } catch (err) {
    return {
      q,
      error: err.response ? `${err.response.status} ${err.config?.url}` : err.message
    };
  }
}

async function main() {
  const { q, file, language, prod, staging } = parseArgs();
  
  let queries = [];
  if (file) {
    const content = readFileSync(file, 'utf-8');
    queries = content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  } else {
    queries = [q];
  }

  console.log(`Testing ${queries.length} queries against prod and staging (language=${language})\n`);

  const results = [];
  for (const query of queries) {
    process.stdout.write(`Testing "${query}"... `);
    const result = await compareQuery(query, language, prod, staging);
    results.push(result);
    
    if (result.error) {
      console.log(`ERROR: ${result.error}`);
    } else if (result.match) {
      console.log(`✓ Match (prod: ${result.prodCount}, staging: ${result.stagingCount})`);
    } else {
      console.log(`✗ Diff (prod: ${result.prodCount}, staging: ${result.stagingCount}, only-prod: ${result.onlyProd.length}, only-staging: ${result.onlyStaging.length})`);
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
        console.log(`\n"${result.q}": prod=${result.prodCount}, staging=${result.stagingCount}`);
        if (result.onlyProd.length > 0) {
          console.log(`  Only in prod (${result.onlyProd.length}):`, result.onlyProd.map(i => `${i.docYear}/${i.docNumber}`).join(', '));
        }
        if (result.onlyStaging.length > 0) {
          console.log(`  Only in staging (${result.onlyStaging.length}):`, result.onlyStaging.map(i => `${i.docYear}/${i.docNumber}`).join(', '));
        }
      }
    }
  }
}

main();
