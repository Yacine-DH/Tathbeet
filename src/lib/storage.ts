import { dayKey } from './dates'
import type { AppState, PrayerConfig, Settings } from './types'

const DB_NAME = 'quran-hifz'
const STORE = 'state'
const KEY = 'app'
const LS_KEY = 'quran-hifz-state'

export const STATE_VERSION = 1

export const DEFAULT_PRAYERS: PrayerConfig[] = [
  { id: 'fajr', enabled: true, passages: 2, length: 'medium' },
  { id: 'dhuhr', enabled: true, passages: 2, length: 'short' },
  { id: 'asr', enabled: true, passages: 2, length: 'short' },
  { id: 'maghrib', enabled: true, passages: 2, length: 'short' },
  { id: 'isha', enabled: true, passages: 2, length: 'medium' },
  { id: 'witr', enabled: false, passages: 3, length: 'any' },
  { id: 'free', enabled: true, passages: 3, length: 'any' },
]

export function defaultSettings(): Settings {
  return {
    lang: 'ar',
    theme: 'light',
    riwayah: 'qalun',
    audio: { reciterId: 'qalun-husary', autoplay: false, repeat: 1 },
    showTranslation: true,
    showTransliteration: false,
    arabicSize: 30,
    hideByDefault: true,
    prayers: DEFAULT_PRAYERS.map((p) => ({ ...p })),
    segmentation: { mode: 'page', maxAyahs: 12, minAyahs: 3, maxLines: 20 },
    engine: {
      minRepeatGapDays: 3,
      weakBias: 0.55,
      randomness: 0.45,
      avoidSameSurahPerDay: true,
      dueOnly: false,
      boostRecentlyMemorised: true,
    },
    reminder: { enabled: false, time: '20:00', notify: false },
  }
}

export function defaultState(): AppState {
  return {
    version: STATE_VERSION,
    updatedAt: Date.now(),
    onboarded: false,
    memorised: [],
    settings: defaultSettings(),
    hifz: {
      enabled: false,
      target: { kind: 'surah', surah: 78 },
      pace: { unit: 'ayahs', amount: 3, perDays: 1 },
      startedOn: dayKey(),
      carry: 0,
      completedDays: [],
      todayPortion: null,
    },
    records: {},
    plans: {},
    planSalt: 1,
    log: [],
    activeDays: [],
  }
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

async function idbGet<T>(): Promise<T | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY)
    req.onsuccess = () => resolve((req.result as T) ?? null)
    req.onerror = () => resolve(null)
  })
}

async function idbSet(value: unknown): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, KEY)
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => resolve(false)
  })
}

/** Fill in anything a newer version added, so old saves keep working. */
export function migrate(raw: Partial<AppState> | null): AppState {
  const base = defaultState()
  if (!raw) return base
  const settings: Settings = {
    ...base.settings,
    ...raw.settings,
    segmentation: { ...base.settings.segmentation, ...raw.settings?.segmentation },
    engine: { ...base.settings.engine, ...raw.settings?.engine },
    reminder: { ...base.settings.reminder, ...raw.settings?.reminder },
    audio: { ...base.settings.audio, ...raw.settings?.audio },
    prayers: raw.settings?.prayers?.length ? raw.settings.prayers : base.settings.prayers,
  }
  return {
    ...base,
    ...raw,
    version: STATE_VERSION,
    updatedAt: raw.updatedAt ?? Date.now(),
    settings,
    hifz: { ...base.hifz, ...raw.hifz },
    records: raw.records ?? {},
    plans: raw.plans ?? {},
    planSalt: raw.planSalt ?? 1,
    log: raw.log ?? [],
    activeDays: raw.activeDays ?? [],
    memorised: raw.memorised ?? [],
  }
}

export async function loadState(): Promise<AppState> {
  const fromIdb = await idbGet<AppState>()
  if (fromIdb) return migrate(fromIdb)
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return migrate(JSON.parse(raw))
  } catch {
    /* corrupt or unavailable — fall through to defaults */
  }
  return defaultState()
}

export async function saveState(state: AppState): Promise<void> {
  const ok = await idbSet(state)
  if (!ok) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state))
    } catch {
      /* quota exceeded — the in-memory state stays usable for this session */
    }
  }
}

export async function clearState(): Promise<void> {
  await idbSet(null)
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
}

/** Keep saves from growing without bound. */
export function prune(state: AppState): AppState {
  const plans = Object.fromEntries(
    Object.entries(state.plans)
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .slice(0, 120),
  )
  return {
    ...state,
    plans,
    log: state.log.slice(-2000),
    activeDays: state.activeDays.slice(-800),
  }
}

export function exportBackup(state: AppState): string {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)
}

export function importBackup(text: string): AppState {
  const parsed = JSON.parse(text) as Partial<AppState>
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid backup file')
  return migrate(parsed)
}
