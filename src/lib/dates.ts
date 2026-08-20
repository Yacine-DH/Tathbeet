import { localeOf } from './i18n'
import type { Lang } from './types'

/** Local-time day helpers. Everything scheduling-related is day-granular. */

export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, days: number): string {
  const d = parseDayKey(key)
  d.setDate(d.getDate() + days)
  return dayKey(d)
}

export function daysBetween(from: string, to: string): number {
  const a = parseDayKey(from).getTime()
  const b = parseDayKey(to).getTime()
  return Math.round((b - a) / 86400000)
}

/** Fractional days elapsed since a timestamp — used for memory decay. */
export function daysSince(timestamp: number | null, now: number = Date.now()): number {
  if (!timestamp) return Infinity
  return Math.max(0, (now - timestamp) / 86400000)
}

export function formatDay(key: string, lang: Lang): string {
  return parseDayKey(key).toLocaleDateString(localeOf(lang), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** Consecutive-day streak ending today (or yesterday, if today isn't done yet). */
export function computeStreak(doneDays: string[], today: string = dayKey()): number {
  const set = new Set(doneDays)
  let cursor = set.has(today) ? today : addDays(today, -1)
  if (!set.has(cursor)) return 0
  let streak = 0
  while (set.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}
