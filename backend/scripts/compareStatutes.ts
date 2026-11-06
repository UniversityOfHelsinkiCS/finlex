#!/usr/bin/env -S npx tsx
/*
  Compare the full text of statutes on a Tenttilex instance against www.finlex.fi.

  Usage (run from backend/):
    npx tsx scripts/compareStatutes.ts --year 2003 --number 434            # one statute
    npx tsx scripts/compareStatutes.ts --year 2003                         # every statute of a year
    npx tsx scripts/compareStatutes.ts --year 2000 --to 2003 --lang all    # range of years, fin + swe
    npx tsx scripts/compareStatutes.ts --year 2003 --out /tmp/2003.json    # full results incl. diffs as JSON

  Options:
    --year N         year (required)
    --to N           last year of a range (inclusive)
    --number X       single statute number (e.g. 434, 39-001)
    --lang L         fin | swe | all (default fin)
    --tenttilex URL  Tenttilex instance (default production)
    --local          shorthand for --tenttilex http://localhost:3001
    --concurrency N  parallel statutes per year (default 4)
    --out FILE       write results as JSON
    --verbose        print diff hunks for differing statutes
*/

import { writeFileSync } from 'fs';
import { compareStatute, compareYear, DEFAULT_TENTTILEX_URL, StatuteComparison, YearComparison } from '../src/util/statuteCompare.js';

interface Args {
  year?: number; to?: number; number?: string; langs: string[];
  tenttilex: string; concurrency: number; out?: string; verbose: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = { langs: ['fin'], tenttilex: DEFAULT_TENTTILEX_URL, concurrency: 4, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--year') out.year = parseInt(argv[++i], 10);
    else if (a === '--to') out.to = parseInt(argv[++i], 10);
    else if (a === '--number') out.number = argv[++i];
    else if (a === '--lang') { const l = argv[++i]; out.langs = l === 'all' ? ['fin', 'swe'] : [l]; }
    else if (a === '--tenttilex') out.tenttilex = argv[++i];
    else if (a === '--local') out.tenttilex = 'http://localhost:3001';
    else if (a === '--concurrency') out.concurrency = parseInt(argv[++i], 10);
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--verbose') out.verbose = true;
    else { console.error(`Unknown argument: ${a}`); process.exit(2); }
  }
  if (!out.year || out.langs.some(l => !['fin', 'swe'].includes(l))) {
    console.error('Usage: compareStatutes.ts --year N [--to N] [--number X] [--lang fin|swe|all] [--out FILE] [--verbose]');
    process.exit(2);
  }
  return out;
}

function describe(r: StatuteComparison): string {
  const id = `${r.number}/${r.year} ${r.language}`;
  switch (r.status) {
  case 'identical': return `OK          ${id}`;
  case 'different': {
    const labels = (r.labelsOnlyInTenttilex?.length ?? 0) + (r.labelsOnlyInFinlex?.length ?? 0);
    return `DIFFERENT   ${id}  ${r.hunks?.length ?? 0} text diffs, ${labels} label diffs  ${r.finlexUrl}`;
  }
  case 'missing_tenttilex': return `NO_TENTTI   ${id}  ${r.finlexUrl}`;
  case 'missing_finlex': return `NO_FINLEX   ${id}  ${r.tenttilexUrl}`;
  default: return `ERROR       ${id}  ${r.error ?? ''}`;
  }
}

function printHunks(r: StatuteComparison) {
  for (const h of r.hunks ?? []) {
    console.log(`    …${h.contextBefore}`);
    if (h.tenttilex) console.log(`    - ${h.tenttilex}`);
    if (h.finlex) console.log(`    + ${h.finlex}`);
    console.log(`      ${h.contextAfter}…`);
  }
  if (r.labelsOnlyInTenttilex?.length) console.log(`    labels only in Tenttilex: ${r.labelsOnlyInTenttilex.join(' ')}`);
  if (r.labelsOnlyInFinlex?.length) console.log(`    labels only in Finlex:    ${r.labelsOnlyInFinlex.join(' ')}`);
}

async function main() {
  const args = parseArgs();
  const report = (r: StatuteComparison) => {
    if (r.status !== 'identical') {
      console.log(describe(r));
      if (args.verbose) printHunks(r);
    }
  };

  if (args.number) {
    const results = [];
    for (const lang of args.langs) {
      const r = await compareStatute(args.year!, args.number, lang, args.tenttilex);
      console.log(describe(r));
      printHunks(r);
      results.push(r);
    }
    if (args.out) writeFileSync(args.out, JSON.stringify(results, null, 2));
    return;
  }

  const years: YearComparison[] = [];
  for (let year = args.year!; year <= (args.to ?? args.year!); year++) {
    for (const lang of args.langs) {
      console.log(`\n== ${year} ${lang}`);
      const y = await compareYear(year, lang, {
        tenttilexBase: args.tenttilex,
        concurrency: args.concurrency,
        onProgress: (_done, _total, r) => report(r),
      });
      const c = y.counts;
      console.log(`== ${year} ${lang}: ${y.total} statutes, ${c.identical} identical, ${c.different} different, `
        + `${c.missing_tenttilex} missing from Tenttilex, ${c.missing_finlex} missing from Finlex, ${c.error} errors`);
      years.push(y);
    }
  }

  if (years.length > 1) {
    const sum = (k: keyof YearComparison['counts']) => years.reduce((s, y) => s + y.counts[k], 0);
    console.log(`\nTOTAL: ${years.reduce((s, y) => s + y.total, 0)} statutes, ${sum('identical')} identical, ${sum('different')} different, `
      + `${sum('missing_tenttilex')} missing from Tenttilex, ${sum('missing_finlex')} missing from Finlex, ${sum('error')} errors`);
  }
  if (args.out) writeFileSync(args.out, JSON.stringify(years, null, 2));
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
