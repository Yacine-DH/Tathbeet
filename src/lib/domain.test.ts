import { describe, expect, it } from 'vitest'
import {
  ayahUrl,
  defaultReciter,
  findReciter,
  playlistFor,
  RECITERS,
  recitersFor,
} from './audio'
import { buildPlan, recentlySuggested } from './engine'
import { dailyBudget, hifzProgress, nextPortion, remainingRanges, targetRanges } from './hifz'
import {
  absIndex,
  countAyahs,
  fromAbs,
  invertInSurah,
  juzOf,
  normalizeRanges,
  pageOf,
  subtractRange,
  surah,
  type Range,
} from './refs'
import { buildSegments, estimateLines, parseSegmentId } from './segments'
import { grade, isDue, MAX_INTERVAL, newRecord, strength } from './srs'
import { defaultSettings } from './storage'
import type { DailyPlan, HifzGoal, ReviewRecord, Settings } from './types'

const JUZ_AMMA: Range[] = Array.from({ length: 37 }, (_, i) => {
  const id = 78 + i
  return { surah: id, start: 1, end: surah(id).verses }
})

describe('refs', () => {
  it('maps absolute indexes both ways', () => {
    expect(absIndex(1, 1)).toBe(1)
    expect(absIndex(2, 1)).toBe(8)
    expect(fromAbs(8)).toEqual({ surah: 2, ayah: 1 })
    expect(fromAbs(6236)).toEqual({ surah: 114, ayah: 6 })
    for (const abs of [1, 200, 3000, 6000, 6236]) {
      const ref = fromAbs(abs)
      expect(absIndex(ref.surah, ref.ayah)).toBe(abs)
    }
  })

  it('locates well-known ayahs in the mushaf', () => {
    expect(pageOf(2, 255)).toBe(42) // Ayat al-Kursi
    expect(pageOf(1, 1)).toBe(1)
    expect(pageOf(114, 6)).toBe(604)
    expect(juzOf(2, 142)).toBe(2)
    expect(juzOf(78, 1)).toBe(30)
  })

  it('normalises, subtracts and inverts ranges', () => {
    const merged = normalizeRanges([
      { surah: 2, start: 5, end: 9 },
      { surah: 2, start: 10, end: 12 },
      { surah: 2, start: 1, end: 3 },
    ])
    expect(merged).toEqual([
      { surah: 2, start: 1, end: 3 },
      { surah: 2, start: 5, end: 12 },
    ])

    expect(subtractRange(merged, { surah: 2, start: 6, end: 8 })).toEqual([
      { surah: 2, start: 1, end: 3 },
      { surah: 2, start: 5, end: 5 },
      { surah: 2, start: 9, end: 12 },
    ])

    const gaps = invertInSurah([{ surah: 112, start: 1, end: 2 }], 112)
    expect(gaps).toEqual([{ surah: 112, start: 3, end: 4 }])
  })
})

describe('segments', () => {
  const settings = defaultSettings().segmentation

  it('keeps a short surah whole so it can be recited in one rak’ah', () => {
    const segs = buildSegments([{ surah: 112, start: 1, end: 4 }], settings)
    expect(segs).toHaveLength(1)
    expect(segs[0].id).toBe('112:1-4')
    expect(segs[0].length).toBe('short')
  })

  it('splits a long surah into passages that respect the ayah cap', () => {
    const segs = buildSegments([{ surah: 2, start: 1, end: 286 }], settings)
    expect(segs.length).toBeGreaterThan(20)
    for (const seg of segs) expect(seg.ayahs).toBeLessThanOrEqual(settings.maxAyahs)
    // Contiguous and complete.
    expect(segs[0].start).toBe(1)
    expect(segs[segs.length - 1].end).toBe(286)
    for (let i = 1; i < segs.length; i++) expect(segs[i].start).toBe(segs[i - 1].end + 1)
  })

  it('covers every memorised ayah exactly once', () => {
    const segs = buildSegments(JUZ_AMMA, defaultSettings().segmentation)
    expect(countAyahs(segs.map((s) => ({ surah: s.surah, start: s.start, end: s.end })))).toBe(
      countAyahs(JUZ_AMMA),
    )
    const ids = new Set(segs.map((s) => s.id))
    expect(ids.size).toBe(segs.length)
  })

  it('estimates length from mushaf lines, not ayah count', () => {
    // 30 short ayahs of Al-Fajr sit on one page; 7 long ones of Al-Baqarah too.
    expect(estimateLines(89, 1, 30)).toBeLessThan(estimateLines(2, 1, 25))
    expect(parseSegmentId('12:1-11')).toEqual({ surah: 12, start: 1, end: 11 })
  })

  it('keeps a surah whole up to ~1.3 mushaf pages, and splits beyond that', () => {
    const whole = (id: number) =>
      buildSegments([{ surah: id, start: 1, end: surah(id).verses }], settings).length === 1
    expect(whole(80)).toBe(true) // 'Abasa — 42 short ayahs, one page
    expect(whole(83)).toBe(true) // Al-Mutaffifin — 19.7 lines
    expect(whole(78)).toBe(false) // An-Naba — 21 lines
    expect(whole(36)).toBe(false) // Ya-Sin — 88.8 lines
  })

  it('reacts to the maxAyahs setting', () => {
    const tight = buildSegments([{ surah: 2, start: 1, end: 50 }], { ...settings, maxAyahs: 5 })
    for (const seg of tight) expect(seg.ayahs).toBeLessThanOrEqual(5)
  })
})

describe('srs', () => {
  it('grows the interval on success and resets it on a lapse', () => {
    let record = newRecord('112:1-4', '2026-01-01')
    record = grade(record, 'good', '2026-01-01')
    expect(record.interval).toBe(2)
    record = grade(record, 'good', '2026-01-03')
    expect(record.interval).toBe(6)
    record = grade(record, 'perfect', '2026-01-09')
    expect(record.interval).toBeGreaterThan(6)
    const before = record.interval
    record = grade(record, 'forgot', '2026-02-01')
    expect(record.interval).toBe(1)
    expect(record.lapses).toBe(1)
    expect(record.reps).toBe(0)
    expect(before).toBeGreaterThan(record.interval)
  })

  it('never lets a passage drift beyond the maximum interval', () => {
    let record = newRecord('1:1-7', '2026-01-01')
    for (let i = 0; i < 30; i++) record = grade(record, 'perfect', '2026-01-01')
    expect(record.interval).toBeLessThanOrEqual(MAX_INTERVAL)
  })

  it('decays strength with time since the last recall', () => {
    const base: ReviewRecord = { ...newRecord('1:1-7'), interval: 10, lastReviewed: Date.now() }
    const fresh = strength(base)
    const old = strength({ ...base, lastReviewed: Date.now() - 30 * 86400000 })
    expect(fresh).toBeGreaterThan(0.95)
    expect(old).toBeLessThan(fresh)
    expect(strength(newRecord('1:1-7'))).toBe(0.5) // declared but never recited
  })

  it('reports due state by day', () => {
    const record = { ...newRecord('1:1-7', '2026-01-01'), due: '2026-01-05' }
    expect(isDue(record, '2026-01-04')).toBe(false)
    expect(isDue(record, '2026-01-05')).toBe(true)
    expect(isDue(record, '2026-01-09')).toBe(true)
  })
})

function recordsFor(ranges: Range[], settings: Settings, day: string) {
  const segs = buildSegments(ranges, settings.segmentation)
  const records = Object.fromEntries(segs.map((s) => [s.id, newRecord(s.id, day)]))
  return { segs, records }
}

describe('suggestion engine', () => {
  const day = '2026-08-17'

  it('is deterministic for a given day and salt, and changes when reshuffled', () => {
    const settings = defaultSettings()
    const { segs, records } = recordsFor(JUZ_AMMA, settings, day)
    const args = { day, segments: segs, records, settings, plans: {} }

    const a = buildPlan({ ...args, salt: 1 })
    const b = buildPlan({ ...args, salt: 1 })
    const c = buildPlan({ ...args, salt: 2 })

    expect(a.items.map((i) => i.segmentId)).toEqual(b.items.map((i) => i.segmentId))
    expect(a.items.map((i) => i.segmentId)).not.toEqual(c.items.map((i) => i.segmentId))
  })

  it('fills every enabled prayer without repeating a passage in the day', () => {
    const settings = defaultSettings()
    const { segs, records } = recordsFor(JUZ_AMMA, settings, day)
    const plan = buildPlan({ day, salt: 3, segments: segs, records, settings, plans: {} })

    const expected = settings.prayers
      .filter((p) => p.enabled)
      .reduce((n, p) => n + p.passages, 0)
    expect(plan.items).toHaveLength(expected)
    expect(new Set(plan.items.map((i) => i.segmentId)).size).toBe(plan.items.length)
  })

  it('honours the same-surah rule when the pool is large enough', () => {
    const settings = defaultSettings()
    const { segs, records } = recordsFor(JUZ_AMMA, settings, day)
    const plan = buildPlan({ day, salt: 4, segments: segs, records, settings, plans: {} })
    const surahs = plan.items.map((i) => parseSegmentId(i.segmentId).surah)
    expect(new Set(surahs).size).toBe(surahs.length)
  })

  it('avoids passages used within the repeat gap', () => {
    const settings = defaultSettings()
    const { segs, records } = recordsFor(JUZ_AMMA, settings, day)
    const yesterday = buildPlan({ day: '2026-08-16', salt: 1, segments: segs, records, settings, plans: {} })
    const plans: Record<string, DailyPlan> = { '2026-08-16': yesterday }

    const recent = recentlySuggested(plans, day, settings.engine.minRepeatGapDays)
    expect(recent.size).toBe(yesterday.items.length)

    const today = buildPlan({ day, salt: 1, segments: segs, records, settings, plans })
    const overlap = today.items.filter((i) => recent.has(i.segmentId))
    expect(overlap).toHaveLength(0)
  })

  it('still produces a plan when only one short surah is memorised', () => {
    const settings = defaultSettings()
    const only: Range[] = [{ surah: 1, start: 1, end: 7 }]
    const { segs, records } = recordsFor(only, settings, day)
    const plan = buildPlan({ day, salt: 1, segments: segs, records, settings, plans: {} })
    expect(plan.items.length).toBeGreaterThan(0)
    expect(plan.items.every((i) => i.segmentId === '1:1-7')).toBe(true)
  })

  it('prefers weak passages when weakBias is high', () => {
    const settings: Settings = {
      ...defaultSettings(),
      engine: { ...defaultSettings().engine, weakBias: 1, randomness: 0, minRepeatGapDays: 0 },
      prayers: [{ id: 'fajr', enabled: true, passages: 3, length: 'any' }],
    }
    const { segs, records } = recordsFor(JUZ_AMMA, settings, day)
    const ids = Object.keys(records)
    const now = Date.now()
    // Everything solid except three passages left to rot.
    for (const id of ids) records[id] = { ...records[id], reps: 5, interval: 60, lastReviewed: now }
    // One per surah, so the same-surah rule can't be what selects them.
    const seen = new Set<number>()
    const weakIds = ids
      .filter((id) => {
        const s = parseSegmentId(id).surah
        if (seen.has(s)) return false
        seen.add(s)
        return true
      })
      .slice(0, 3)
    for (const id of weakIds) {
      records[id] = { ...records[id], interval: 2, lastReviewed: now - 90 * 86400000, due: '2026-06-01' }
    }
    const plan = buildPlan({ day, salt: 7, segments: segs, records, settings, plans: {} })
    expect(plan.items.map((i) => i.segmentId).sort()).toEqual(weakIds.sort())
  })

  it('respects a prayer’s length preference when such passages exist', () => {
    const settings: Settings = {
      ...defaultSettings(),
      prayers: [{ id: 'dhuhr', enabled: true, passages: 3, length: 'short' }],
    }
    const { segs, records } = recordsFor(JUZ_AMMA, settings, day)
    const plan = buildPlan({ day, salt: 11, segments: segs, records, settings, plans: {} })
    const lengths = plan.items.map(
      (i) => segs.find((s) => s.id === i.segmentId)!.length,
    )
    expect(lengths.every((l) => l === 'short')).toBe(true)
  })
})

describe('recitation catalogue', () => {
  it('offers reciters for every riwayah, with unique ids', () => {
    const ids = RECITERS.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const riwayah of ['hafs', 'warsh', 'qalun'] as const) {
      const list = recitersFor(riwayah)
      expect(list.length).toBeGreaterThan(0)
      expect(list.every((r) => r.riwayah === riwayah)).toBe(true)
      expect(defaultReciter(riwayah).riwayah).toBe(riwayah)
    }
  })

  it('ships a default reciter that matches the default riwayah', () => {
    const settings = defaultSettings()
    expect(findReciter(settings.audio.reciterId)?.riwayah).toBe(settings.riwayah)
  })

  it('builds zero-padded ayah urls', () => {
    const alafasy = findReciter('hafs-alafasy')!
    expect(ayahUrl(alafasy, 1, 1)).toBe('https://everyayah.com/data/Alafasy_128kbps/001001.mp3')
    expect(ayahUrl(alafasy, 114, 6)).toBe('https://everyayah.com/data/Alafasy_128kbps/114006.mp3')
  })

  it('plays a passage ayah by ayah when the reciter allows it', () => {
    const warsh = findReciter('warsh-dosary')!
    const list = playlistFor(warsh, 78, 5, 8)
    expect(list.map((x) => x.ayah)).toEqual([5, 6, 7, 8])
    expect(list[0].url).toContain('/warsh/warsh_ibrahim_aldosary_128kbps/078005.mp3')
  })

  it('falls back to one whole-surah file for Qalun', () => {
    const qalun = findReciter('qalun-husary')!
    expect(qalun.granularity).toBe('surah')
    const list = playlistFor(qalun, 67, 10, 20)
    expect(list).toHaveLength(1)
    expect(list[0]).toEqual({
      url: 'https://server13.mp3quran.net/husr/Rewayat-Qalon-A-n-Nafi/067.mp3',
      ayah: 1,
    })
  })
})

describe('hifz pacing', () => {
  const goal = (over: Partial<HifzGoal> = {}): HifzGoal => ({
    enabled: true,
    target: { kind: 'surah', surah: 67 },
    pace: { unit: 'ayahs', amount: 3, perDays: 1 },
    startedOn: '2026-08-17',
    carry: 0,
    completedDays: [],
    todayPortion: null,
    ...over,
  })

  it('cuts the target into a portion of the requested size', () => {
    const portion = nextPortion(goal(), [])
    expect(portion).toEqual({ surah: 67, start: 1, end: 3 })
  })

  it('continues where the memorised set stops', () => {
    const portion = nextPortion(goal(), [{ surah: 67, start: 1, end: 10 }])
    expect(portion).toEqual({ surah: 67, start: 11, end: 13 })
  })

  it('translates page paces into an ayah budget that follows the mushaf', () => {
    // A page of Al-Baqarah holds far fewer ayahs than a page of Juz 'Amma.
    const inBaqarah = dailyBudget({ unit: 'page', amount: 1, perDays: 1 }, { surah: 2, start: 30, end: 30 })
    const inAmma = dailyBudget({ unit: 'page', amount: 1, perDays: 1 }, { surah: 93, start: 1, end: 1 })
    expect(inBaqarah).toBeLessThan(inAmma)
    expect(inBaqarah).toBeGreaterThan(0)

    const weekly = dailyBudget({ unit: 'page', amount: 1, perDays: 7 }, { surah: 2, start: 30, end: 30 })
    expect(weekly).toBeCloseTo(inBaqarah / 7, 5)
  })

  it('never proposes a portion that crosses a surah boundary', () => {
    const g = goal({ target: { kind: 'juz', juz: 30 }, pace: { unit: 'ayahs', amount: 50, perDays: 1 } })
    const portion = nextPortion(g, [])!
    expect(portion.surah).toBe(78)
    expect(portion.end).toBeLessThanOrEqual(surah(78).verses)
  })

  it('reports progress and an estimated finish', () => {
    const g = goal()
    const before = hifzProgress(g, [], '2026-08-17')
    expect(before.totalAyahs).toBe(30)
    expect(before.remainingAyahs).toBe(30)
    expect(before.daysLeft).toBe(10)
    expect(before.finishDay).toBe('2026-08-27')

    const after = hifzProgress(g, [{ surah: 67, start: 1, end: 30 }], '2026-08-17')
    expect(after.done).toBe(true)
    expect(after.percent).toBe(100)
    expect(after.finishDay).toBeNull()
  })

  it('knows what a juz target covers', () => {
    const ranges = targetRanges({ kind: 'juz', juz: 30 })
    expect(countAyahs(ranges)).toBe(564)
    expect(ranges[0].surah).toBe(78)
    expect(ranges[ranges.length - 1].surah).toBe(114)
    expect(remainingRanges({ kind: 'juz', juz: 30 }, JUZ_AMMA)).toHaveLength(0)
  })
})
