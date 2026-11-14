import * as Sentry from '@sentry/node'
import { query, dbIsUpToDate, fillDb, addStatusRow, clearStatusRows } from './db/db.js'
import { UpdateRun, startAttempt, updateRun, heartbeat, getRun } from './db/models/updateRun.js'
import {
  INDEXES, IndexKind, buildIndex, buildIndexName, swapIndex, dropOrphanIndexes,
  collectionDocumentCount, searchStatutes, searchJudgments, isTransientTypesenseError, SyncResult,
} from './search.js'
import { compareYear, isCosmeticHunk, StatuteComparison } from './util/statuteCompare.js'
import { yearFrom, yearTo } from './util/config.js'

// Runs one update from its stored phase to the end: fetch → index → verify → swap.
// Every phase can be started again after a restart: fetch skips what is already up to date,
// index rebuilds its own collection from scratch, verify and swap only read or repoint.

export const MAX_ATTEMPTS = 5
const RETRY_DELAY_MS = 15 * 60 * 1000

interface Check { ok: boolean; detail: string; [key: string]: unknown }

const PORT = process.env.PORT ?? '3001'

export async function runUpdate(initial: UpdateRun): Promise<void> {
  const run = await startAttempt(initial.id, `run${initial.id}`)
  const suffix = run.index_suffix as string
  const startYear = run.start_year ?? yearFrom()
  const beat = setInterval(() => { heartbeat(run.id).catch(() => {}) }, 60_000)
  console.log(`[UPDATE] run ${run.id} (${run.trigger}) attempt ${run.attempts}, phase ${run.phase}`)

  try {
    let phase = run.phase

    if (phase === 'fetch') {
      await clearStatusRows()
      await addStatusRow({ message: 'updating', runId: run.id, trigger: run.trigger, from: startYear, to: yearTo() }, true)
      const { statutes, judgments } = await dbIsUpToDate(startYear)
      console.log(`[UPDATE] fetching ${statutes.length} statutes, ${judgments.length} judgments`)
      await fillDb(statutes, judgments)
      phase = 'index'
      await updateRun(run.id, { phase, result: { fetched: { statutes: statutes.length, judgments: judgments.length } } })
      // the database is current again; the site works normally while the index is built
      await addStatusRow({ message: 'indexing', runId: run.id }, false)
    }

    if (phase === 'index') {
      await dropOrphanIndexes(suffix)
      const index: Record<string, { processed: number; failed: number; failures: string[] }> = {}
      for (const k of INDEXES) {
        const r: SyncResult = await buildIndex(k, suffix)
        // documents that failed because Typesense was unreachable: build again on the next attempt
        const transient = r.failures.filter(f => isTransientTypesenseError({ message: f.error }))
        if (transient.length > 0) {
          throw new Error(`${transient.length} documents of ${buildIndexName(k, suffix)} failed to index: ${transient[0].error}`)
        }
        index[buildIndexName(k, suffix)] = {
          processed: r.totalProcessed, failed: r.failureCount,
          failures: r.failures.slice(0, 10).map(f => `${f.year}/${f.number}: ${f.error}`),
        }
        await heartbeat(run.id)
      }
      phase = 'verify'
      await updateRun(run.id, { phase, result: { index } })
    }

    if (phase === 'verify') {
      await addStatusRow({ message: 'verifying', runId: run.id }, false)
      const checks = await verify(suffix, startYear)
      const indexOk = checks.indexCounts.ok && checks.search.ok
      phase = indexOk ? 'swap' : 'failed'
      await updateRun(run.id, { phase, result: { checks } })
      if (!indexOk) {
        // keep the live index; drop the rejected one (it is not behind an alias)
        await dropOrphanIndexes()
        return await finish(run, false, checks)
      }
    }

    if (phase === 'swap') {
      for (const k of INDEXES) await swapIndex(k, suffix)
      // collections no alias points to any more (e.g. left over from an interrupted swap)
      await dropOrphanIndexes(suffix)
      const live = await smokeSearch()
      const fresh = await getRun(run.id)
      const checks = { ...((fresh?.result?.checks ?? {}) as Record<string, Check>), live }
      return await finish(run, Object.values(checks).every(c => c.ok), checks)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[UPDATE] run ${run.id} failed in attempt ${run.attempts}:`, error)
    Sentry.captureException(error)
    if (run.attempts >= MAX_ATTEMPTS) {
      await updateRun(run.id, { phase: 'failed', finished: true, result: { error: message } })
      await addStatusRow({ message: 'setup_failed', runId: run.id, error: message, timestamp: new Date().toISOString() }, false)
      Sentry.captureMessage(`Tenttilex update run ${run.id} gave up after ${run.attempts} attempts: ${message}`, 'error')
    } else {
      // the scheduler starts the next attempt after the delay
      await updateRun(run.id, { result: { error: message, retryAfter: new Date(Date.now() + RETRY_DELAY_MS).toISOString() } })
    }
  } finally {
    clearInterval(beat)
  }
}

async function finish(run: UpdateRun, ok: boolean, checks: Record<string, Check>): Promise<void> {
  await updateRun(run.id, { phase: ok ? 'done' : 'failed', finished: true, result: { ok, checks, error: null, retryAfter: null } })
  await addStatusRow({ message: ok ? 'updated' : 'update_check_failed', runId: run.id, checks: summarize(checks), from: run.start_year ?? yearFrom(), to: yearTo() }, false)
  if (ok) {
    console.log(`[UPDATE] run ${run.id} completed, all checks passed`)
  } else {
    console.error(`[UPDATE] run ${run.id} completed with failed checks`, checks)
    Sentry.captureMessage(`Tenttilex update run ${run.id}: checks failed: ${failedChecks(checks).join('; ')}`, 'error')
  }
}

const summarize = (checks: Record<string, Check>) =>
  Object.fromEntries(Object.entries(checks).map(([k, c]) => [k, { ok: c.ok, detail: c.detail }]))
const failedChecks = (checks: Record<string, Check>) =>
  Object.entries(checks).filter(([, c]) => !c.ok).map(([k, c]) => `${k}: ${c.detail}`)

// ---------- checks ----------

export async function verify(suffix: string, startYear: number): Promise<Record<string, Check>> {
  return {
    upToDate: await checkUpToDate(startYear),
    finlex: await checkAgainstFinlex(yearTo()),
    indexCounts: await checkIndexCounts(suffix),
    search: await smokeSearch(suffix),
  }
}

// Every statute version and judgment listed by Finlex is in the database. Whatever is still
// missing (a fetch that failed) is fetched once more before giving up.
async function checkUpToDate(startYear: number): Promise<Check> {
  let { statutes, judgments } = await dbIsUpToDate(startYear, false)
  if (statutes.length + judgments.length > 0) {
    console.log(`[UPDATE] verify: ${statutes.length} statutes, ${judgments.length} judgments still missing, fetching again`)
    await fillDb(statutes, judgments);
    ({ statutes, judgments } = await dbIsUpToDate(startYear, false))
  }
  const ok = statutes.length === 0 && judgments.length === 0
  return {
    ok,
    detail: ok ? 'kaikki Finlexin listaamat lait ja ratkaisut ovat kannassa'
      : `puuttuu ${statutes.length} lakia ja ${judgments.length} ratkaisua`,
    missingStatutes: statutes.slice(0, 20).map(s => `${s.year}/${s.number} ${s.language}${s.version ? '@' + s.version : ''}`),
    missingJudgments: judgments.slice(0, 20).map(j => `${j.level} ${j.year}/${j.number} ${j.language}`),
  }
}

// The statutes of the current year read the same here as on finlex.fi
async function checkAgainstFinlex(year: number): Promise<Check> {
  const cmp = await compareYear(year, 'fin', { tenttilexBase: `http://localhost:${PORT}`, concurrency: 3 })
  const real = (r: StatuteComparison) => r.status === 'different' && (r.hunks ?? []).some(h => !isCosmeticHunk(h))
  const differing = cmp.results.filter(real)
  const missing = cmp.results.filter(r => r.status === 'missing_tenttilex')
  const errors = cmp.results.filter(r => r.status === 'error')
  const ok = differing.length === 0 && missing.length === 0 && errors.length <= Math.ceil(cmp.total * 0.05)
  return {
    ok,
    detail: `${year}: ${cmp.total - differing.length - missing.length - errors.length}/${cmp.total} samat`
      + (differing.length ? `, ${differing.length} eroaa` : '')
      + (missing.length ? `, ${missing.length} puuttuu` : '')
      + (errors.length ? `, ${errors.length} ei voitu verrata` : ''),
    differing: differing.slice(0, 20).map(r => `${r.year}/${r.number}`),
    missing: missing.slice(0, 20).map(r => `${r.year}/${r.number}`),
  }
}

// The new index has a document for every row in the database (a few documents that cannot be
// indexed at all are tolerated and reported)
async function checkIndexCounts(suffix: string): Promise<Check> {
  const counts: Record<string, { index: number; db: number }> = {}
  let ok = true
  for (const k of INDEXES) {
    const { rows } = await query(`SELECT COUNT(*)::int AS n FROM ${k.type} WHERE language = $1`, [k.lang])
    const db = rows[0].n as number
    const index = await collectionDocumentCount(buildIndexName(k, suffix))
    counts[buildIndexName(k, suffix)] = { index, db }
    if (db === 0 || index < db - 10) ok = false
  }
  return {
    ok,
    detail: Object.entries(counts).map(([n, c]) => `${n} ${c.index}/${c.db}`).join(', '),
    counts,
  }
}

// Searches that must find known documents, run against the new index (suffix) or the live one
export async function smokeSearch(suffix?: string): Promise<Check> {
  const col = (k: IndexKind) => (suffix ? buildIndexName(k, suffix) : undefined)
  const [sf, ss, jf, js] = INDEXES
  const { rows } = await query(
    `SELECT year, number, title FROM statutes WHERE language = 'fin' AND NOT is_empty AND title <> ''
     ORDER BY year DESC, length(number) DESC, number DESC LIMIT 1`,
  )
  const newest = rows[0] as { year: number; number: string; title: string } | undefined
  const found = (hits: { docYear?: number; year_num?: number; docNumber?: string; number?: string }[], year: number, number: string) =>
    hits.some(h => (h.year_num ?? h.docYear) === year && (h.number ?? h.docNumber) === number)

  // probes for documents that are not in the database (e.g. a dev database without old years) are
  // skipped; the up-to-date check reports missing documents
  const inDb = async (year: number, number: string, language: string) =>
    (await query('SELECT 1 FROM statutes WHERE year = $1 AND number = $2 AND language = $3', [year, number, language])).rows.length > 0
  const results: Record<string, boolean> = {}
  if (await inDb(1889, '39-001', 'fin')) results['rikoslaki (fi)'] = found(await searchStatutes('fin', 'rikoslaki', col(sf)), 1889, '39-001')
  if (await inDb(1889, '39-001', 'swe')) results['strafflag (sv)'] = found(await searchStatutes('swe', 'strafflag', col(ss)), 1889, '39-001')
  results['vahingonkorvaus (KKO/KHO fi)'] = (await searchJudgments('fin', 'vahingonkorvaus', 'any', col(jf))).length > 0
  results['skadestånd (KKO/KHO sv)'] = (await searchJudgments('swe', 'skadestånd', 'any', col(js))).length > 0
  if (newest) {
    results[`uusin laki ${newest.year}/${newest.number}`] =
      found(await searchStatutes('fin', newest.title, col(sf)), Number(newest.year), newest.number)
  }
  const failed = Object.entries(results).filter(([, v]) => !v).map(([k]) => k)
  return {
    ok: failed.length === 0,
    detail: failed.length === 0 ? `${Object.keys(results).length}/${Object.keys(results).length} hakua löysi oikean tuloksen` : `ei löytynyt: ${failed.join(', ')}`,
    results,
  }
}
