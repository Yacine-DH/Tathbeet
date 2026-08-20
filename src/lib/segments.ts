import {
  absIndex,
  pageBounds,
  pageBreaksIn,
  pageOf,
  rukuBreaksIn,
  surah,
  type Range,
} from './refs'
import type { SegmentationSettings } from './types'

/** A recitable passage: what the app actually suggests, schedules and grades. */
export interface Segment {
  id: string
  surah: number
  start: number
  end: number
  ayahs: number
  firstPage: number
  lastPage: number
  /** Approximate mushaf lines — a better length proxy than ayah count. */
  lines: number
  length: 'short' | 'medium' | 'long'
}

const LINES_PER_PAGE = 15

export function segmentId(surahId: number, start: number, end: number): string {
  return `${surahId}:${start}-${end}`
}

export function parseSegmentId(id: string): Range {
  const [s, span] = id.split(':')
  const [start, end] = span.split('-').map(Number)
  return { surah: Number(s), start, end }
}

/**
 * Approximate how much mushaf real estate a range occupies, by adding up each
 * overlapped page's share. Keeps "short passage" meaningful in both Al-Baqarah
 * (long ayahs) and Juz 'Amma (short ones).
 */
export function estimateLines(surahId: number, start: number, end: number): number {
  const from = absIndex(surahId, start)
  const to = absIndex(surahId, end)
  let lines = 0
  for (let page = pageOf(surahId, start); page <= pageOf(surahId, end); page++) {
    const bounds = pageBounds(page)
    const overlap = Math.min(to, bounds.to) - Math.max(from, bounds.from) + 1
    if (overlap <= 0) continue
    const pageAyahs = bounds.to - bounds.from + 1
    lines += (overlap / pageAyahs) * LINES_PER_PAGE
  }
  return Math.round(lines * 10) / 10
}

function classify(lines: number): Segment['length'] {
  if (lines <= 4) return 'short'
  if (lines <= 11) return 'medium'
  return 'long'
}

export function makeSegment(surahId: number, start: number, end: number): Segment {
  const lines = estimateLines(surahId, start, end)
  return {
    id: segmentId(surahId, start, end),
    surah: surahId,
    start,
    end,
    ayahs: end - start + 1,
    firstPage: pageOf(surahId, start),
    lastPage: pageOf(surahId, end),
    lines,
    length: classify(lines),
  }
}

/** Cut points (ayah numbers that start a new passage) for the chosen mode. */
function cutPoints(surahId: number, mode: SegmentationSettings['mode']): number[] {
  if (mode === 'page') return pageBreaksIn(surahId)
  if (mode === 'ruku') return rukuBreaksIn(surahId)
  return []
}

/** Split `[start,end]` so no piece exceeds `max`, keeping pieces even. */
function splitEvenly(start: number, end: number, max: number): [number, number][] {
  const total = end - start + 1
  if (total <= max) return [[start, end]]
  const pieces = Math.ceil(total / max)
  const size = Math.ceil(total / pieces)
  const out: [number, number][] = []
  for (let a = start; a <= end; a += size) {
    out.push([a, Math.min(end, a + size - 1)])
  }
  return out
}

/**
 * Turn the memorised inventory into recitation-sized passages. Long surahs get
 * cut on page/ruku boundaries; short surahs stay whole so they can be recited
 * as a unit in prayer.
 */
export function buildSegments(memorised: Range[], settings: SegmentationSettings): Segment[] {
  const out: Segment[] = []
  for (const range of memorised) {
    const meta = surah(range.surah)
    const whole = range.start === 1 && range.end === meta.verses
    const total = range.end - range.start + 1

    // A short surah known in full is one passage, however it was configured.
    if (whole && estimateLines(range.surah, range.start, range.end) <= settings.maxLines) {
      out.push(makeSegment(range.surah, range.start, range.end))
      continue
    }

    const cuts = cutPoints(range.surah, settings.mode).filter(
      (a) => a > range.start && a <= range.end,
    )
    const chunks: [number, number][] = []
    let cursor = range.start
    for (const cut of cuts) {
      chunks.push([cursor, cut - 1])
      cursor = cut
    }
    chunks.push([cursor, range.end])

    // Respect the hard ayah cap, then glue away runt tails.
    const capped = chunks.flatMap(([a, b]) => splitEvenly(a, b, settings.maxAyahs))
    const merged: [number, number][] = []
    for (const chunk of capped) {
      const prev = merged[merged.length - 1]
      const size = chunk[1] - chunk[0] + 1
      if (prev && size < settings.minAyahs && chunk[1] - prev[0] + 1 <= settings.maxAyahs) {
        prev[1] = chunk[1]
      } else merged.push([...chunk] as [number, number])
    }
    if (total < settings.minAyahs && merged.length === 1) {
      out.push(makeSegment(range.surah, range.start, range.end))
      continue
    }
    for (const [a, b] of merged) out.push(makeSegment(range.surah, a, b))
  }
  return out.sort((x, y) => x.surah - y.surah || x.start - y.start)
}

/**
 * When segmentation or the memorised set changes, carry scheduling state over
 * to the new passages by picking the old passage with the biggest overlap.
 */
export function bestOverlap(target: Segment, previousIds: string[]): string | null {
  let best: string | null = null
  let bestScore = 0
  for (const id of previousIds) {
    const r = parseSegmentId(id)
    if (r.surah !== target.surah) continue
    const overlap = Math.min(target.end, r.end) - Math.max(target.start, r.start) + 1
    if (overlap > bestScore) {
      bestScore = overlap
      best = id
    }
  }
  return bestScore > 0 ? best : null
}
