import { daysBetween } from './dates'
import { makeRng, weightedPick, type Rng } from './rng'
import type { Segment } from './segments'
import { isDue, overdueFactor, strength } from './srs'
import type { DailyPlan, PlanItem, PrayerConfig, ReviewRecord, Settings } from './types'

export interface Candidate {
  segment: Segment
  record: ReviewRecord
  strength: number
  weight: number
}

/**
 * Turn one passage into a sampling weight. Weak and overdue passages float up,
 * `weakBias` decides how strongly, and `randomness` flattens or sharpens the
 * whole distribution so the rotation never feels mechanical.
 */
export function candidateWeight(
  record: ReviewRecord,
  settings: Settings,
  day: string,
  now = Date.now(),
): number {
  const e = settings.engine
  const weakness = 1 - strength(record, now)
  const urgency = overdueFactor(record, day) / 3
  const merit = 0.6 * weakness + 0.4 * urgency

  let w = (1 - e.weakBias) * 0.5 + e.weakBias * merit * 1.5 + 0.05
  if (e.boostRecentlyMemorised && record.reps < 3) w *= 1.6

  const temperature = 0.2 + e.randomness * 1.8
  return Math.pow(Math.max(w, 0.001), 1 / temperature)
}

/** Passage ids that appeared in a plan within the last `gapDays` days. */
export function recentlySuggested(
  plans: Record<string, DailyPlan>,
  day: string,
  gapDays: number,
): Set<string> {
  const seen = new Set<string>()
  if (gapDays <= 0) return seen
  for (const plan of Object.values(plans)) {
    const age = daysBetween(plan.day, day)
    if (age >= 0 && age < gapDays) {
      for (const item of plan.items) seen.add(item.segmentId)
    }
  }
  return seen
}

interface PickContext {
  candidates: Candidate[]
  usedToday: Set<string>
  surahsToday: Set<number>
  recent: Set<string>
  settings: Settings
  day: string
  rng: Rng
}

/**
 * Constraints are dropped one at a time when the pool is too small to satisfy
 * them — someone who has only memorised Al-Fatihah still gets a plan.
 */
function passesAtLevel(
  c: Candidate,
  ctx: PickContext,
  prayer: PrayerConfig,
  level: number,
): boolean {
  const e = ctx.settings.engine
  if (level < 6 && ctx.usedToday.has(c.segment.id)) return false
  if (level < 1 && prayer.length !== 'any' && c.segment.length !== prayer.length) return false
  if (level < 2 && e.avoidSameSurahPerDay && ctx.surahsToday.has(c.segment.surah)) return false
  if (level < 3 && e.dueOnly && !isDue(c.record, ctx.day)) return false
  if (level < 4 && ctx.recent.has(c.segment.id)) return false
  return true
}

function pick(ctx: PickContext, prayer: PrayerConfig): Candidate | null {
  for (let level = 0; level <= 6; level++) {
    const pool = ctx.candidates.filter((c) => passesAtLevel(c, ctx, prayer, level))
    if (!pool.length) continue
    const index = weightedPick(
      pool.map((c) => c.weight),
      ctx.rng,
    )
    if (index >= 0) return pool[index]
  }
  return null
}

export function buildCandidates(
  segments: Segment[],
  records: Record<string, ReviewRecord>,
  settings: Settings,
  day: string,
  now = Date.now(),
): Candidate[] {
  return segments
    .filter((s) => records[s.id])
    .map((segment) => {
      const record = records[segment.id]
      return {
        segment,
        record,
        strength: strength(record, now),
        weight: candidateWeight(record, settings, day, now),
      }
    })
}

/**
 * Build the day's recitation plan: a handful of passages per enabled prayer,
 * stable for the whole day because the RNG is seeded with (day, salt).
 */
export function buildPlan(input: {
  day: string
  salt: number
  segments: Segment[]
  records: Record<string, ReviewRecord>
  settings: Settings
  plans: Record<string, DailyPlan>
  now?: number
}): DailyPlan {
  const { day, salt, segments, records, settings, plans } = input
  const now = input.now ?? Date.now()
  const candidates = buildCandidates(segments, records, settings, day, now)

  const ctx: PickContext = {
    candidates,
    usedToday: new Set(),
    surahsToday: new Set(),
    recent: recentlySuggested(plans, day, settings.engine.minRepeatGapDays),
    settings,
    day,
    rng: makeRng(`${day}|${salt}`),
  }

  const items: PlanItem[] = []
  if (candidates.length) {
    for (const prayer of settings.prayers) {
      if (!prayer.enabled || prayer.passages <= 0) continue
      for (let slot = 0; slot < prayer.passages; slot++) {
        const chosen = pick(ctx, prayer)
        if (!chosen) break
        ctx.usedToday.add(chosen.segment.id)
        ctx.surahsToday.add(chosen.segment.surah)
        items.push({ segmentId: chosen.segment.id, prayer: prayer.id, slot })
      }
    }
  }

  return { day, salt, items, generatedAt: now }
}

/** Passages that are due today and not already in the plan — for extra drilling. */
export function dueBacklog(
  segments: Segment[],
  records: Record<string, ReviewRecord>,
  day: string,
  exclude: Set<string> = new Set(),
): Segment[] {
  return segments
    .filter((s) => records[s.id] && !exclude.has(s.id) && isDue(records[s.id], day))
    .sort((a, b) => overdueFactor(records[b.id], day) - overdueFactor(records[a.id], day))
}

/** Weakest passages regardless of due date — what the progress screen highlights. */
export function weakest(
  segments: Segment[],
  records: Record<string, ReviewRecord>,
  limit = 5,
  now = Date.now(),
): Candidate[] {
  return segments
    .filter((s) => records[s.id])
    .map((segment) => {
      const record = records[segment.id]
      return { segment, record, strength: strength(record, now), weight: 0 }
    })
    .sort((a, b) => a.strength - b.strength)
    .slice(0, limit)
}
