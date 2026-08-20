import type { Range } from './refs'

export type Lang = 'ar' | 'en' | 'de' | 'fr'
export type Theme = 'dark' | 'light'

/** Narration of the Qur'anic text — changes the script, not the ayah numbering. */
export type Riwayah = 'hafs' | 'warsh' | 'qalun'

export interface AudioSettings {
  /** Id from the reciter catalogue in `lib/audio.ts`. */
  reciterId: string
  /** Start playback as soon as a passage is revealed. */
  autoplay: boolean
  /** How many times to replay a passage before stopping (1 = play once). */
  repeat: number
}

/** How well the last recall went — drives the scheduler. */
export type Grade = 'forgot' | 'shaky' | 'good' | 'perfect'

export const GRADES: Grade[] = ['forgot', 'shaky', 'good', 'perfect']

export type PrayerId = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'witr' | 'free'

export interface PrayerConfig {
  id: PrayerId
  enabled: boolean
  /** How many passages to suggest for this prayer (≈ one per rak'ah). */
  passages: number
  /** Preferred passage length; `any` lets the engine pick freely. */
  length: 'short' | 'medium' | 'long' | 'any'
}

export interface SegmentationSettings {
  /** Where to cut long memorised runs into recitable passages. */
  mode: 'page' | 'ruku' | 'fixed'
  /** Never build a passage longer than this many ayahs. */
  maxAyahs: number
  /** Absorb leftovers shorter than this into the previous passage. */
  minAyahs: number
  /** A fully memorised surah shorter than this many mushaf lines stays whole. */
  maxLines: number
}

export interface EngineSettings {
  /** Don't suggest the same passage again within this many days, if avoidable. */
  minRepeatGapDays: number
  /** 0 = pure random across what you know, 1 = always the weakest first. */
  weakBias: number
  /** 0 = deterministic ranking, 1 = wide-open shuffle. */
  randomness: number
  /** Avoid suggesting two passages from the same surah on the same day. */
  avoidSameSurahPerDay: boolean
  /** Only ever suggest passages the scheduler considers due. */
  dueOnly: boolean
  /** Give freshly memorised passages priority while they consolidate. */
  boostRecentlyMemorised: boolean
}

export type PaceUnit = 'ayahs' | 'page' | 'juz'

export interface Pace {
  unit: PaceUnit
  /** Amount of `unit` per `perDays` days (0.5 page/day is valid). */
  amount: number
  perDays: number
}

export type HifzTarget =
  | { kind: 'surah'; surah: number }
  | { kind: 'juz'; juz: number }
  | { kind: 'range'; surah: number; start: number; end: number }

export interface HifzGoal {
  enabled: boolean
  target: HifzTarget
  pace: Pace
  startedOn: string
  /** Fractional ayah budget carried between days so slow paces stay accurate. */
  carry: number
  /** Days on which the new portion was confirmed as memorised. */
  completedDays: string[]
  /** Portion proposed today, kept so it doesn't move around during the day. */
  todayPortion: { day: string; range: Range } | null
}

export interface ReminderSettings {
  enabled: boolean
  /** "HH:MM" local time. */
  time: string
  /** Ask the browser to fire a notification (needs permission). */
  notify: boolean
}

export interface Settings {
  lang: Lang
  theme: Theme
  riwayah: Riwayah
  audio: AudioSettings
  showTranslation: boolean
  showTransliteration: boolean
  arabicSize: number
  /** Hide the text first so you recite from memory, then reveal to check. */
  hideByDefault: boolean
  prayers: PrayerConfig[]
  segmentation: SegmentationSettings
  engine: EngineSettings
  reminder: ReminderSettings
}

/** Scheduler state for one passage. */
export interface ReviewRecord {
  id: string
  /** SM-2 style ease factor (1.3–3.0). */
  ease: number
  /** Current scheduling interval in days. */
  interval: number
  /** Day key when this passage becomes due. */
  due: string
  reps: number
  lapses: number
  /** Timestamp of the last graded recall. */
  lastReviewed: number | null
  /** Day key it was last put in a plan (graded or not). */
  lastSuggested: string | null
  /** Day key it entered the memorised set. */
  addedOn: string
}

export interface PlanItem {
  segmentId: string
  prayer: PrayerId
  /** Index within the prayer, i.e. which rak'ah. */
  slot: number
  /** Grade given during this day, if the user recited it. */
  grade?: Grade
}

export interface DailyPlan {
  day: string
  /** Bumped by "reshuffle" so the same day can be regenerated differently. */
  salt: number
  items: PlanItem[]
  generatedAt: number
}

export interface SessionEntry {
  day: string
  at: number
  segmentId: string
  grade: Grade
}

export interface AppState {
  version: number
  /** Set once the setup wizard has been completed. */
  onboarded: boolean
  /** Everything the user currently has memorised, as normalised ranges. */
  memorised: Range[]
  settings: Settings
  hifz: HifzGoal
  records: Record<string, ReviewRecord>
  plans: Record<string, DailyPlan>
  /** Bumped whenever the plan must be rebuilt (reshuffle, settings change). */
  planSalt: number
  /** Recent graded recalls, newest last, capped. */
  log: SessionEntry[]
  /** Day keys on which at least one passage was recited. */
  activeDays: string[]
}
