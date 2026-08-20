import { JUZ_STARTS } from '../data/quranMeta'
import { addDays, dayKey } from './dates'
import {
  absIndex,
  countAyahs,
  fromAbs,
  juzOf,
  normalizeRanges,
  pageBounds,
  pageOf,
  subtractRange,
  surah,
  TOTAL_AYAHS,
  type Range,
} from './refs'
import type { HifzGoal, HifzTarget, Lang, Pace } from './types'

/** Convert an absolute ayah span into per-surah ranges. */
export function absRangeToRanges(fromAbsIndex: number, toAbsIndex: number): Range[] {
  const out: Range[] = []
  let cursor = fromAbsIndex
  while (cursor <= toAbsIndex) {
    const ref = fromAbs(cursor)
    const meta = surah(ref.surah)
    const endAyah = Math.min(meta.verses, ref.ayah + (toAbsIndex - cursor))
    out.push({ surah: ref.surah, start: ref.ayah, end: endAyah })
    cursor += endAyah - ref.ayah + 1
  }
  return out
}

export function juzBounds(juz: number): { from: number; to: number } {
  const start = JUZ_STARTS[juz - 1]
  const from = absIndex(start[0], start[1])
  const next = JUZ_STARTS[juz]
  return { from, to: next ? absIndex(next[0], next[1]) - 1 : TOTAL_AYAHS }
}

/** Everything the goal covers, in mushaf order. */
export function targetRanges(target: HifzTarget): Range[] {
  if (target.kind === 'surah') {
    return [{ surah: target.surah, start: 1, end: surah(target.surah).verses }]
  }
  if (target.kind === 'juz') {
    const { from, to } = juzBounds(target.juz)
    return absRangeToRanges(from, to)
  }
  return [{ surah: target.surah, start: target.start, end: target.end }]
}

/** Parts of the goal not yet memorised, in order. */
export function remainingRanges(target: HifzTarget, memorised: Range[]): Range[] {
  let gaps = targetRanges(target)
  for (const known of memorised) gaps = subtractRange(gaps, known)
  return normalizeRanges(gaps)
}

const JUZ_WORD: Record<Lang, string> = { ar: 'جزء', en: 'Juz', de: 'Juz', fr: "Juz'" }

export function targetLabel(target: HifzTarget, lang: Lang): string {
  if (target.kind === 'juz') return `${JUZ_WORD[lang]} ${target.juz}`
  const meta = surah(target.surah)
  if (target.kind === 'surah') return meta.translit
  return `${meta.translit} ${target.start}–${target.end}`
}

/**
 * Ayahs to learn today. Page-based paces adapt to the mushaf: a page of
 * Al-Baqarah is ~7 long ayahs, a page of Juz 'Amma can be 30 short ones, and
 * "one page a day" should mean a page either way.
 */
export function dailyBudget(pace: Pace, at: Range | null): number {
  const perDay = pace.amount / Math.max(1, pace.perDays)
  if (pace.unit === 'ayahs') return perDay

  const ref = at ?? { surah: 1, start: 1, end: 1 }
  if (pace.unit === 'page') {
    const bounds = pageBounds(pageOf(ref.surah, ref.start))
    return (bounds.to - bounds.from + 1) * perDay
  }
  const juz = juzBounds(juzOf(ref.surah, ref.start))
  return (juz.to - juz.from + 1) * perDay
}

/**
 * The portion proposed for today: the next unmemorised ayahs of the goal,
 * sized by the pace, never crossing a surah boundary.
 */
export function nextPortion(goal: HifzGoal, memorised: Range[]): Range | null {
  const gaps = remainingRanges(goal.target, memorised)
  if (!gaps.length) return null
  const head = gaps[0]
  const budget = dailyBudget(goal.pace, head) + goal.carry
  const count = Math.max(1, Math.round(budget))
  return { surah: head.surah, start: head.start, end: Math.min(head.end, head.start + count - 1) }
}

/** Leftover fraction to carry into tomorrow, so slow paces stay honest. */
export function carryAfter(goal: HifzGoal, portion: Range, at: Range): number {
  const budget = dailyBudget(goal.pace, at) + goal.carry
  const used = portion.end - portion.start + 1
  return Math.max(-1, Math.min(1, budget - used))
}

export interface HifzProgress {
  totalAyahs: number
  memorisedAyahs: number
  remainingAyahs: number
  percent: number
  perDay: number
  daysLeft: number
  finishDay: string | null
  done: boolean
}

export function hifzProgress(goal: HifzGoal, memorised: Range[], today = dayKey()): HifzProgress {
  const all = targetRanges(goal.target)
  const gaps = remainingRanges(goal.target, memorised)
  const totalAyahs = countAyahs(all)
  const remainingAyahs = countAyahs(gaps)
  const memorisedAyahs = totalAyahs - remainingAyahs
  const perDay = Math.max(0.1, dailyBudget(goal.pace, gaps[0] ?? all[0]))
  const daysLeft = Math.ceil(remainingAyahs / perDay)
  return {
    totalAyahs,
    memorisedAyahs,
    remainingAyahs,
    percent: totalAyahs ? Math.round((memorisedAyahs / totalAyahs) * 100) : 0,
    perDay: Math.round(perDay * 10) / 10,
    daysLeft,
    finishDay: remainingAyahs ? addDays(today, daysLeft) : null,
    done: remainingAyahs === 0,
  }
}

export interface PacePreset {
  id: string
  pace: Pace
  labels: Record<Lang, string>
  level: 1 | 2 | 3 | 4
}

/** Levels the user picks from during setup; `level` drives the difficulty badge. */
export const PACE_PRESETS: PacePreset[] = [
  {
    id: 'ayahs-1',
    pace: { unit: 'ayahs', amount: 1, perDays: 1 },
    labels: { ar: 'آية واحدة يوميًا', en: '1 ayah a day', de: '1 Vers pro Tag', fr: '1 verset par jour' },
    level: 1,
  },
  {
    id: 'ayahs-2',
    pace: { unit: 'ayahs', amount: 2, perDays: 1 },
    labels: { ar: 'آيتان يوميًا', en: '2 ayahs a day', de: '2 Verse pro Tag', fr: '2 versets par jour' },
    level: 1,
  },
  {
    id: 'ayahs-3',
    pace: { unit: 'ayahs', amount: 3, perDays: 1 },
    labels: { ar: '3 آيات يوميًا', en: '3 ayahs a day', de: '3 Verse pro Tag', fr: '3 versets par jour' },
    level: 2,
  },
  {
    id: 'ayahs-5',
    pace: { unit: 'ayahs', amount: 5, perDays: 1 },
    labels: { ar: '5 آيات يوميًا', en: '5 ayahs a day', de: '5 Verse pro Tag', fr: '5 versets par jour' },
    level: 3,
  },
  {
    id: 'page-week',
    pace: { unit: 'page', amount: 1, perDays: 7 },
    labels: { ar: 'صفحة كل أسبوع', en: '1 page a week', de: '1 Seite pro Woche', fr: '1 page par semaine' },
    level: 1,
  },
  {
    id: 'page-3days',
    pace: { unit: 'page', amount: 1, perDays: 3 },
    labels: { ar: 'صفحة كل 3 أيام', en: '1 page every 3 days', de: '1 Seite alle 3 Tage', fr: '1 page tous les 3 jours' },
    level: 2,
  },
  {
    id: 'page-half',
    pace: { unit: 'page', amount: 0.5, perDays: 1 },
    labels: { ar: 'نصف صفحة يوميًا', en: 'half a page a day', de: 'eine halbe Seite pro Tag', fr: '½ page par jour' },
    level: 3,
  },
  {
    id: 'page-day',
    pace: { unit: 'page', amount: 1, perDays: 1 },
    labels: { ar: 'صفحة كل يوم', en: '1 page a day', de: '1 Seite pro Tag', fr: '1 page par jour' },
    level: 4,
  },
  {
    id: 'juz-month',
    pace: { unit: 'juz', amount: 1, perDays: 30 },
    labels: { ar: 'جزء كل شهر', en: '1 juz a month', de: '1 Juz pro Monat', fr: "1 juz’ par mois" },
    level: 3,
  },
]

const UNIT_WORD: Record<Pace['unit'], Record<Lang, string>> = {
  ayahs: { ar: 'آية', en: 'ayahs', de: 'Verse', fr: 'versets' },
  page: { ar: 'صفحة', en: 'page(s)', de: 'Seite(n)', fr: 'page(s)' },
  juz: { ar: 'جزء', en: 'juz', de: 'Juz', fr: "juz’" },
}

const DAY_WORD: Record<Lang, [one: string, many: string]> = {
  ar: ['يوم', 'أيام'],
  en: ['day', 'days'],
  de: ['Tag', 'Tagen'],
  fr: ['jour', 'jours'],
}

export function paceLabel(pace: Pace, lang: Lang): string {
  const preset = PACE_PRESETS.find(
    (p) =>
      p.pace.unit === pace.unit && p.pace.amount === pace.amount && p.pace.perDays === pace.perDays,
  )
  if (preset) return preset.labels[lang]
  const [one, many] = DAY_WORD[lang]
  const per = pace.perDays === 1 ? one : `${pace.perDays} ${many}`
  return `${pace.amount} ${UNIT_WORD[pace.unit][lang]} / ${per}`
}
