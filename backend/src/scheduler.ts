import * as Sentry from '@sentry/node'
import os from 'os'
import { randomUUID } from 'crypto'
import { insertRun, getActiveRun, claimRun, releaseRun, UpdateRun } from './db/models/updateRun.js'
import { getSetting, setSetting } from './db/models/setting.js'
import { runUpdate } from './updateRunner.js'
import { lastScheduledTime, nextScheduledTime, parseSchedule } from './util/schedule.js'

// Starts the weekly update (default Friday 23:55 Helsinki time) and resumes an unfinished run
// after a restart. State lives in the update_runs table, so nothing is lost when the pod restarts:
// on startup the scheduler finds the unfinished run and continues it from its phase.

const SCHEDULE = parseSchedule(process.env.UPDATE_SCHEDULE)
// A run is created only during the first minutes after the scheduled moment. A deployment or
// restart at any other time never starts a new run; a slot missed because the server was down
// for these minutes is skipped (the next week's run catches up on everything).
const CATCH_UP_MS = 10 * 60 * 1000
const TICK_MS = 60_000
const OWNER = `${os.hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`

let running = false
let timer: NodeJS.Timeout | null = null

// Whether this environment runs the weekly update at all (UPDATE_SCHEDULER, on by default in production)
export const schedulerEnabled = () =>
  process.env.UPDATE_SCHEDULER === 'on' || (process.env.NODE_ENV === 'production' && process.env.UPDATE_SCHEDULER !== 'off')

// An admin can pause the weekly update from the admin page; stored in the database so it survives restarts
const PAUSE_KEY = 'schedule_paused'
export const isSchedulePaused = async () => (await getSetting<boolean>(PAUSE_KEY)) === true
export const setSchedulePaused = (paused: boolean) => setSetting(PAUSE_KEY, paused)

// Weekly update enabled in this environment and not paused by an admin
export const scheduleActive = async () => schedulerEnabled() && !(await isSchedulePaused())

export const nextRunTime = (now = new Date()) => nextScheduledTime(now, SCHEDULE)

export function startScheduler(): void {
  if (timer) return
  // the runner of a resumed or manual run is started by tick() also when the weekly schedule is off
  console.log(`[SCHEDULER] started; weekly update ${schedulerEnabled() ? `next at ${nextRunTime().toISOString()}` : 'disabled'}`)
  timer = setInterval(() => { void tick() }, TICK_MS)
  setTimeout(() => { void tick() }, 5_000)
}

// Wakes the scheduler now, e.g. right after an admin started an update
export function kickScheduler(): void {
  setTimeout(() => { void tick() }, 0)
}

export async function tick(now = new Date()): Promise<void> {
  if (running) return
  try {
    if (await scheduleActive()) {
      const slot = lastScheduledTime(now, SCHEDULE)
      if (now.getTime() - slot.getTime() < CATCH_UP_MS) {
        const created = await insertRun(slot, 'schedule', null)
        if (created) console.log(`[SCHEDULER] created scheduled run ${created.id} for ${slot.toISOString()}`)
      }
    }
    const run = await getActiveRun()
    if (!run || !dueNow(run, now)) return
    await runWithLease(run)
  } catch (error) {
    console.error('[SCHEDULER] tick failed:', error)
    Sentry.captureException(error)
  }
}

// A run that failed is retried only after its retry delay
export function dueNow(run: UpdateRun, now: Date): boolean {
  const retryAfter = run.result?.retryAfter as string | undefined | null
  return !retryAfter || new Date(retryAfter).getTime() <= now.getTime()
}

// The run is leased to this process (see claimRun): a second server, e.g. the old pod during a
// rolling deploy, cannot run the same update in parallel, and a run whose owner died is taken over
// once its lease has expired.
async function runWithLease(run: UpdateRun): Promise<void> {
  const claimed = await claimRun(run.id, OWNER)
  if (!claimed) return
  running = true
  try {
    await runUpdate(claimed)
  } finally {
    running = false
    await releaseRun(run.id, OWNER).catch(() => {})
  }
  // another run may be waiting (e.g. a manual one created during this run)
  kickScheduler()
}

export const isUpdateRunning = () => running
