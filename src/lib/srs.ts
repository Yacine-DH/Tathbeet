import { addDays, dayKey, daysBetween, daysSince } from './dates'
import type { Grade, ReviewRecord } from './types'

const MIN_EASE = 1.3
const MAX_EASE = 3.0
/** Nothing you have memorised should go unrevised longer than this. */
export const MAX_INTERVAL = 120

export function newRecord(id: string, today: string = dayKey()): ReviewRecord {
  return {
    id,
    ease: 2.5,
    interval: 1,
    due: today,
    reps: 0,
    lapses: 0,
    lastReviewed: null,
    lastSuggested: null,
    addedOn: today,
  }
}

const EASE_DELTA: Record<Grade, number> = {
  forgot: -0.25,
  shaky: -0.15,
  good: 0,
  perfect: 0.1,
}

/** Fixed ladder for the first two recalls, while the passage is consolidating. */
const FIRST_INTERVALS: Record<Grade, number> = {
  forgot: 1,
  shaky: 1,
  good: 2,
  perfect: 4,
}

const SECOND_INTERVALS: Record<Grade, number> = {
  forgot: 1,
  shaky: 2,
  good: 6,
  perfect: 10,
}

export function grade(
  record: ReviewRecord,
  result: Grade,
  today: string = dayKey(),
  now: number = Date.now(),
): ReviewRecord {
  const ease = clamp(record.ease + EASE_DELTA[result], MIN_EASE, MAX_EASE)
  let interval: number

  if (result === 'forgot') {
    interval = 1
  } else if (record.reps === 0) {
    interval = FIRST_INTERVALS[result]
  } else if (record.reps === 1) {
    interval = SECOND_INTERVALS[result]
  } else if (result === 'shaky') {
    interval = Math.max(1, record.interval * 1.2)
  } else if (result === 'good') {
    interval = record.interval * ease
  } else {
    interval = record.interval * ease * 1.3
  }

  interval = Math.min(MAX_INTERVAL, Math.max(1, Math.round(interval)))

  return {
    ...record,
    ease,
    interval,
    due: addDays(today, interval),
    reps: result === 'forgot' ? 0 : record.reps + 1,
    lapses: record.lapses + (result === 'forgot' ? 1 : 0),
    lastReviewed: now,
  }
}

/**
 * Probability the passage is still recallable, from the FSRS forgetting curve:
 * ~0.9 right when it falls due, decaying from there. Passages you have declared
 * memorised but never recited here sit at 0.5 until you first grade them.
 */
export function strength(record: ReviewRecord, now: number = Date.now()): number {
  if (!record.lastReviewed) return 0.5
  const elapsed = daysSince(record.lastReviewed, now)
  const stability = Math.max(0.5, record.interval)
  return clamp(1 / (1 + elapsed / (9 * stability)), 0, 1)
}

export function isDue(record: ReviewRecord, today: string = dayKey()): boolean {
  return daysBetween(record.due, today) >= 0
}

/** How far past due, relative to its own interval. 0 = not due yet. */
export function overdueFactor(record: ReviewRecord, today: string = dayKey()): number {
  const late = daysBetween(record.due, today)
  if (late <= 0) return 0
  return clamp(late / Math.max(1, record.interval), 0, 3)
}

export function nextDueLabel(
  record: ReviewRecord,
  t: (key: 'due.now' | 'due.tomorrow' | 'due.in', vars?: Record<string, number>) => string,
  today: string = dayKey(),
): string {
  const days = daysBetween(today, record.due)
  if (days <= 0) return t('due.now')
  if (days === 1) return t('due.tomorrow')
  return t('due.in', { n: days })
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
