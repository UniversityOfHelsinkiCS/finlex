import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lastScheduledTime, nextScheduledTime, parseSchedule, DEFAULT_SCHEDULE } from '../src/util/schedule.js'
import { isCosmeticHunk } from '../src/util/statuteCompare.js'

const last = (iso: string) => lastScheduledTime(new Date(iso)).toISOString()

test('weekly slot is Friday 23:55 Helsinki time (UTC+2 in winter)', () => {
  assert.equal(last('2026-11-14T08:00:00Z'), '2026-11-13T21:55:00.000Z')
  assert.equal(last('2026-11-13T21:55:00Z'), '2026-11-13T21:55:00.000Z')
  assert.equal(last('2026-11-13T21:54:59Z'), '2026-11-06T21:55:00.000Z')
})

test('weekly slot follows summer time (UTC+3)', () => {
  assert.equal(last('2026-06-06T00:00:00Z'), '2026-06-05T20:55:00.000Z')
  // the week in which summer time starts (Sunday 29.3.2026)
  assert.equal(last('2026-04-03T21:00:00Z'), '2026-04-03T20:55:00.000Z')
  assert.equal(nextScheduledTime(new Date('2026-03-28T12:00:00Z')).toISOString(), '2026-04-03T20:55:00.000Z')
  // and in which it ends (Sunday 25.10.2026)
  assert.equal(nextScheduledTime(new Date('2026-10-24T12:00:00Z')).toISOString(), '2026-10-30T21:55:00.000Z')
})

test('schedule can be overridden, invalid values fall back to the default', () => {
  assert.deepEqual(parseSchedule('2 03:15'), { ...DEFAULT_SCHEDULE, weekday: 2, hour: 3, minute: 15 })
  assert.deepEqual(parseSchedule('friday'), DEFAULT_SCHEDULE)
  assert.deepEqual(parseSchedule(undefined), DEFAULT_SCHEDULE)
})

test('finlex.fi display quirks are not counted as text differences', () => {
  assert.ok(isCosmeticHunk({ tenttilex: '. Aineettomat oikeudet 2.', finlex: 'Aineettomat oikeudet 2' }))
  assert.ok(isCosmeticHunk({ tenttilex: '10', finlex: '1', contextBefore: 'Lyijyn tuotanto 24.' }))
  assert.ok(!isCosmeticHunk({ tenttilex: '10', finlex: '1', contextBefore: 'enintään' }))
  assert.ok(isCosmeticHunk({ tenttilex: '01630 Sadon', finlex: '1630 Sadon' }))
  assert.ok(isCosmeticHunk({ tenttilex: '', finlex: 'Observera:' }))
  assert.ok(!isCosmeticHunk({ tenttilex: 'kulttuuriministeriö', finlex: 'kulttuuriministeriön' }))
})
