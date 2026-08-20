import { normalizeRanges } from './refs'
import type { AppState, DailyPlan, ReviewRecord, SessionEntry } from './types'

/**
 * Combine the same account's state from two devices.
 *
 * Sync must never lose a revision. Overwriting wholesale (last device to save
 * wins) would silently discard a morning's work on the phone the moment the
 * laptop saves, so every collection is merged on its own terms and only the
 * genuinely single-valued things fall back to "most recently changed wins".
 */
export function mergeStates(a: AppState, b: AppState): AppState {
  // For anything that can only hold one value, the more recent edit wins.
  const newer = a.updatedAt >= b.updatedAt ? a : b

  return {
    ...newer,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    version: Math.max(a.version, b.version),
    // Finishing onboarding anywhere counts everywhere.
    onboarded: a.onboarded || b.onboarded,
    // Knowing a passage is not something the other device can undo by being newer.
    memorised: normalizeRanges([...a.memorised, ...b.memorised]),
    settings: newer.settings,
    hifz: {
      ...newer.hifz,
      completedDays: unique([...a.hifz.completedDays, ...b.hifz.completedDays]).sort(),
    },
    records: mergeRecords(a.records, b.records),
    plans: mergePlans(a.plans, b.plans),
    planSalt: Math.max(a.planSalt, b.planSalt),
    log: mergeLog(a.log, b.log),
    activeDays: unique([...a.activeDays, ...b.activeDays]).sort(),
  }
}

const unique = (values: string[]): string[] => [...new Set(values)]

/**
 * A passage's schedule is owned by whichever device graded it last. When
 * neither has been graded, keep whichever is further along.
 */
export function mergeRecords(
  a: Record<string, ReviewRecord>,
  b: Record<string, ReviewRecord>,
): Record<string, ReviewRecord> {
  const out: Record<string, ReviewRecord> = { ...a }
  for (const [id, theirs] of Object.entries(b)) {
    const mine = out[id]
    if (!mine) {
      out[id] = theirs
      continue
    }
    out[id] = pickRecord(mine, theirs)
  }
  return out
}

function pickRecord(a: ReviewRecord, b: ReviewRecord): ReviewRecord {
  const at = a.lastReviewed ?? 0
  const bt = b.lastReviewed ?? 0
  if (at !== bt) return at > bt ? a : b
  // Never graded on either side: the one with more history is the safer keep.
  if (a.reps !== b.reps) return a.reps > b.reps ? a : b
  if (a.lapses !== b.lapses) return a.lapses > b.lapses ? a : b
  return a
}

/**
 * One plan per day. The device that actually recited more of it is the one
 * whose copy carries the real work.
 */
export function mergePlans(
  a: Record<string, DailyPlan>,
  b: Record<string, DailyPlan>,
): Record<string, DailyPlan> {
  const out: Record<string, DailyPlan> = { ...a }
  for (const [day, theirs] of Object.entries(b)) {
    const mine = out[day]
    if (!mine) {
      out[day] = theirs
      continue
    }
    const mineGraded = mine.items.filter((i) => i.grade).length
    const theirsGraded = theirs.items.filter((i) => i.grade).length
    if (theirsGraded > mineGraded) out[day] = theirs
    else if (theirsGraded === mineGraded && theirs.generatedAt > mine.generatedAt) out[day] = theirs
  }
  return out
}

/** Every recorded recall is kept; identical entries collapse. */
export function mergeLog(a: SessionEntry[], b: SessionEntry[]): SessionEntry[] {
  const seen = new Map<string, SessionEntry>()
  for (const entry of [...a, ...b]) {
    seen.set(`${entry.at}|${entry.segmentId}|${entry.grade}`, entry)
  }
  return [...seen.values()].sort((x, y) => x.at - y.at)
}
