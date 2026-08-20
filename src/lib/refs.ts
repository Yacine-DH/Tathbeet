import type { Lang } from './types'
import {
  JUZ_STARTS,
  PAGE_STARTS,
  RUKU_STARTS,
  SURAHS,
  SURAH_OFFSETS,
  TOTAL_AYAHS,
  type SurahMeta,
} from '../data/quranMeta'

export interface AyahRef {
  surah: number
  ayah: number
}

/** Inclusive ayah range inside a single surah. */
export interface Range {
  surah: number
  start: number
  end: number
}

const SURAH_BY_ID = new Map<number, SurahMeta>(SURAHS.map((s) => [s.id, s]))

export function surah(id: number): SurahMeta {
  const s = SURAH_BY_ID.get(id)
  if (!s) throw new Error(`Unknown surah ${id}`)
  return s
}

export { SURAHS, TOTAL_AYAHS }

/** 1-based position of an ayah in the whole mushaf (1…6236). */
export function absIndex(surahId: number, ayah: number): number {
  return SURAH_OFFSETS[surahId - 1] + ayah
}

export function fromAbs(abs: number): AyahRef {
  let lo = 0
  let hi = SURAH_OFFSETS.length - 1
  let found = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (SURAH_OFFSETS[mid] < abs) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return { surah: found + 1, ayah: abs - SURAH_OFFSETS[found] }
}

/** Index of the last entry in `starts` that begins at or before `abs`. */
function lastStartBefore(starts: readonly [number, number][], abs: number): number {
  let lo = 0
  let hi = starts.length - 1
  let found = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (absIndex(starts[mid][0], starts[mid][1]) <= abs) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found
}

/** Mushaf page (1…604) holding this ayah. */
export function pageOf(surahId: number, ayah: number): number {
  return lastStartBefore(PAGE_STARTS, absIndex(surahId, ayah)) + 1
}

export function juzOf(surahId: number, ayah: number): number {
  return lastStartBefore(JUZ_STARTS, absIndex(surahId, ayah)) + 1
}

/** First and last ayah (absolute index) of a mushaf page. */
export function pageBounds(page: number): { from: number; to: number } {
  const start = PAGE_STARTS[page - 1]
  const from = absIndex(start[0], start[1])
  const next = PAGE_STARTS[page]
  const to = next ? absIndex(next[0], next[1]) - 1 : TOTAL_AYAHS
  return { from, to }
}

/** Ayah numbers inside `surahId` where a new mushaf page begins (excluding its first ayah). */
export function pageBreaksIn(surahId: number): number[] {
  const meta = surah(surahId)
  const breaks: number[] = []
  for (let p = meta.firstPage; p <= meta.lastPage; p++) {
    const [s, a] = PAGE_STARTS[p - 1]
    if (s === surahId && a > 1) breaks.push(a)
  }
  return breaks
}

/** Ayah numbers inside `surahId` where a new ruku (natural recitation stop) begins. */
export function rukuBreaksIn(surahId: number): number[] {
  const breaks: number[] = []
  for (const [s, a] of RUKU_STARTS) {
    if (s === surahId && a > 1) breaks.push(a)
    if (s > surahId) break
  }
  return breaks
}

export function rangeLength(r: Range): number {
  return r.end - r.start + 1
}

export function countAyahs(ranges: Range[]): number {
  return ranges.reduce((n, r) => n + rangeLength(r), 0)
}

/** Merge overlapping/adjacent ranges of the same surah; drops empties. */
export function normalizeRanges(ranges: Range[]): Range[] {
  const clean = ranges
    .map((r) => ({
      surah: r.surah,
      start: Math.max(1, Math.min(r.start, r.end)),
      end: Math.min(surah(r.surah).verses, Math.max(r.start, r.end)),
    }))
    .filter((r) => r.end >= r.start)
    .sort((a, b) => a.surah - b.surah || a.start - b.start)

  const out: Range[] = []
  for (const r of clean) {
    const prev = out[out.length - 1]
    if (prev && prev.surah === r.surah && r.start <= prev.end + 1) {
      prev.end = Math.max(prev.end, r.end)
    } else out.push({ ...r })
  }
  return out
}

/** Remove `cut` from `ranges` (same surah only), splitting ranges where needed. */
export function subtractRange(ranges: Range[], cut: Range): Range[] {
  const out: Range[] = []
  for (const r of ranges) {
    if (r.surah !== cut.surah || cut.end < r.start || cut.start > r.end) {
      out.push(r)
      continue
    }
    if (cut.start > r.start) out.push({ surah: r.surah, start: r.start, end: cut.start - 1 })
    if (cut.end < r.end) out.push({ surah: r.surah, start: cut.end + 1, end: r.end })
  }
  return normalizeRanges(out)
}

export function rangesContain(ranges: Range[], surahId: number, ayah: number): boolean {
  return ranges.some((r) => r.surah === surahId && ayah >= r.start && ayah <= r.end)
}

/** Ayahs of `surahId` that are NOT covered by `ranges`, as ranges. */
export function invertInSurah(ranges: Range[], surahId: number): Range[] {
  const total = surah(surahId).verses
  return ranges
    .filter((r) => r.surah === surahId)
    .reduce<Range[]>(
      (gaps, r) => subtractRange(gaps, r),
      [{ surah: surahId, start: 1, end: total }],
    )
}

export function formatRange(r: Range): string {
  const meta = surah(r.surah)
  return rangeLength(r) === 1
    ? `${meta.translit} ${r.start}`
    : `${meta.translit} ${r.start}–${r.end}`
}

/**
 * The surah's meaning-name in the interface language. Arabic shows the Arabic
 * name itself; German falls back to the English meaning, which is the only one
 * the corpus ships.
 */
export function surahDisplayName(meta: SurahMeta, lang: Lang): string {
  if (lang === 'ar') return meta.name
  if (lang === 'fr') return meta.nameFr
  return meta.nameEn
}
