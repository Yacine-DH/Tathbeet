import { describe, expect, it } from 'vitest'
import { mergeLog, mergePlans, mergeRecords, mergeStates } from './merge'
import { newRecord } from './srs'
import { defaultState } from './storage'
import type { AppState, DailyPlan, ReviewRecord } from './types'

function device(over: Partial<AppState> = {}, updatedAt = 1000): AppState {
  return { ...defaultState(), updatedAt, onboarded: true, ...over }
}

const record = (id: string, over: Partial<ReviewRecord> = {}): ReviewRecord => ({
  ...newRecord(id, '2026-08-01'),
  ...over,
})

const plan = (day: string, graded: number, generatedAt = 1): DailyPlan => ({
  day,
  salt: 1,
  generatedAt,
  items: [0, 1, 2].map((slot) => ({
    segmentId: `78:${slot + 1}-${slot + 2}`,
    prayer: 'fajr' as const,
    slot,
    ...(slot < graded ? { grade: 'good' as const } : {}),
  })),
})

describe('merging two devices', () => {
  it('keeps every memorised passage from both sides', () => {
    const phone = device({ memorised: [{ surah: 78, start: 1, end: 20 }] })
    const laptop = device({ memorised: [{ surah: 114, start: 1, end: 6 }] }, 2000)
    const merged = mergeStates(phone, laptop)
    expect(merged.memorised).toEqual([
      { surah: 78, start: 1, end: 20 },
      { surah: 114, start: 1, end: 6 },
    ])
  })

  it('merges adjacent ranges learned separately', () => {
    const a = device({ memorised: [{ surah: 67, start: 1, end: 10 }] })
    const b = device({ memorised: [{ surah: 67, start: 11, end: 20 }] }, 2000)
    expect(mergeStates(a, b).memorised).toEqual([{ surah: 67, start: 1, end: 20 }])
  })

  it('takes the schedule from whichever device graded last', () => {
    const older = record('78:1-10', { lastReviewed: 100, interval: 2, reps: 1 })
    const newer = record('78:1-10', { lastReviewed: 500, interval: 9, reps: 3 })
    expect(mergeRecords({ '78:1-10': older }, { '78:1-10': newer })['78:1-10'].interval).toBe(9)
    expect(mergeRecords({ '78:1-10': newer }, { '78:1-10': older })['78:1-10'].interval).toBe(9)
  })

  it('keeps records that exist on only one device', () => {
    const merged = mergeRecords({ a: record('a') }, { b: record('b') })
    expect(Object.keys(merged).sort()).toEqual(['a', 'b'])
  })

  it('prefers real history when neither side was ever graded', () => {
    const fresh = record('x', { reps: 0 })
    const used = record('x', { reps: 4 })
    expect(mergeRecords({ x: fresh }, { x: used }).x.reps).toBe(4)
  })

  it('never drops a recorded recall', () => {
    const a = [{ day: '2026-08-20', at: 10, segmentId: 's1', grade: 'good' as const }]
    const b = [{ day: '2026-08-20', at: 20, segmentId: 's2', grade: 'shaky' as const }]
    const merged = mergeLog(a, b)
    expect(merged).toHaveLength(2)
    expect(merged.map((e) => e.at)).toEqual([10, 20])
    // The same entry arriving twice collapses.
    expect(mergeLog(a, a)).toHaveLength(1)
  })

  it('keeps the copy of a day plan that was actually recited', () => {
    const idle = plan('2026-08-20', 0, 5)
    const worked = plan('2026-08-20', 2, 1)
    expect(mergePlans({ d: idle }, { d: worked }).d.items.filter((i) => i.grade)).toHaveLength(2)
    expect(mergePlans({ d: worked }, { d: idle }).d.items.filter((i) => i.grade)).toHaveLength(2)
  })

  it('unions the days each device was active', () => {
    const a = device({ activeDays: ['2026-08-18', '2026-08-19'] })
    const b = device({ activeDays: ['2026-08-19', '2026-08-20'] }, 2000)
    expect(mergeStates(a, b).activeDays).toEqual(['2026-08-18', '2026-08-19', '2026-08-20'])
  })

  it('lets the most recent edit win for single-valued settings', () => {
    const a = device({ settings: { ...defaultState().settings, arabicSize: 24 } }, 1000)
    const b = device({ settings: { ...defaultState().settings, arabicSize: 40 } }, 5000)
    expect(mergeStates(a, b).settings.arabicSize).toBe(40)
    expect(mergeStates(b, a).settings.arabicSize).toBe(40)
  })

  it('treats onboarding as done if either device finished it', () => {
    const fresh = device({ onboarded: false }, 9000)
    const setUp = device({ onboarded: true }, 1000)
    expect(mergeStates(fresh, setUp).onboarded).toBe(true)
  })

  it('keeps hifz portions confirmed on either device', () => {
    const a = device({ hifz: { ...defaultState().hifz, completedDays: ['2026-08-18'] } })
    const b = device({ hifz: { ...defaultState().hifz, completedDays: ['2026-08-19'] } }, 2000)
    expect(mergeStates(a, b).hifz.completedDays).toEqual(['2026-08-18', '2026-08-19'])
  })

  it('survives the real conflict: both devices used on the same day', () => {
    const phone = device(
      {
        memorised: [{ surah: 78, start: 1, end: 40 }],
        records: { '78:1-10': record('78:1-10', { lastReviewed: 900, interval: 6, reps: 2 }) },
        log: [{ day: '2026-08-20', at: 900, segmentId: '78:1-10', grade: 'good' }],
        activeDays: ['2026-08-20'],
      },
      900,
    )
    const laptop = device(
      {
        memorised: [{ surah: 114, start: 1, end: 6 }],
        records: { '114:1-6': record('114:1-6', { lastReviewed: 1200, interval: 4, reps: 1 }) },
        log: [{ day: '2026-08-20', at: 1200, segmentId: '114:1-6', grade: 'perfect' }],
        activeDays: ['2026-08-20'],
      },
      1200,
    )

    const merged = mergeStates(phone, laptop)
    expect(merged.memorised).toHaveLength(2)
    expect(Object.keys(merged.records).sort()).toEqual(['114:1-6', '78:1-10'])
    expect(merged.log).toHaveLength(2)
    expect(merged.activeDays).toEqual(['2026-08-20'])
    expect(merged.updatedAt).toBe(1200)
    // Order of the merge must not change the outcome.
    const other = mergeStates(laptop, phone)
    expect(other.log).toEqual(merged.log)
    expect(other.memorised).toEqual(merged.memorised)
    expect(Object.keys(other.records).sort()).toEqual(Object.keys(merged.records).sort())
  })
})
