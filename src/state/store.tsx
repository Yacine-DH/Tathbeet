import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  cloudConfigured,
  currentUser,
  onAuthChange,
  pullState,
  pushState,
  signInWithGoogle,
  signOut as cloudSignOut,
  type CloudUser,
} from '../lib/cloud'
import { dayKey } from '../lib/dates'
import { mergeStates } from '../lib/merge'
import { buildPlan, reshufflePrayer } from '../lib/engine'
import { carryAfter, nextPortion } from '../lib/hifz'
import { normalizeRanges, type Range } from '../lib/refs'
import { bestOverlap, buildSegments, type Segment } from '../lib/segments'
import { grade as gradeRecord, newRecord } from '../lib/srs'
import {
  defaultState,
  loadState,
  prune,
  saveState,
  clearState,
} from '../lib/storage'
import type { AppState, Grade, HifzGoal, PrayerId, ReviewRecord, Settings } from '../lib/types'

type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'replace'; state: AppState }
  | { type: 'setMemorised'; ranges: Range[] }
  | { type: 'setSettings'; settings: Settings }
  | { type: 'setHifz'; patch: Partial<HifzGoal> }
  | { type: 'grade'; segmentId: string; grade: Grade }
  | { type: 'reshuffle' }
  | { type: 'reshufflePrayer'; prayer: PrayerId }
  | { type: 'completePortion' }
  | { type: 'onboarded' }
  | { type: 'reset' }
  | { type: 'tick' }

/**
 * Keeps the parts of state that are a pure function of the inventory in sync:
 * passages, their scheduling records, today's plan and today's new portion.
 */
function derive(state: AppState, today = dayKey()): AppState {
  const segments = buildSegments(state.memorised, state.settings.segmentation)
  const ids = new Set(segments.map((s) => s.id))
  const previousIds = Object.keys(state.records)

  const records: Record<string, ReviewRecord> = {}
  for (const seg of segments) {
    const existing = state.records[seg.id]
    if (existing) {
      records[seg.id] = existing
      continue
    }
    // Re-segmenting shouldn't wipe history: inherit from the biggest overlap.
    const donorId = bestOverlap(seg, previousIds)
    const donor = donorId ? state.records[donorId] : null
    records[seg.id] = donor ? { ...donor, id: seg.id } : newRecord(seg.id, today)
  }

  let plans = state.plans
  const current = plans[today]
  const stale =
    !current ||
    current.salt !== state.planSalt ||
    current.items.some((item) => !ids.has(item.segmentId))

  if (stale) {
    const fresh = buildPlan({
      day: today,
      salt: state.planSalt,
      segments,
      records,
      settings: state.settings,
      plans,
    })
    const grades = new Map(
      (current?.items ?? []).filter((i) => i.grade).map((i) => [i.segmentId, i.grade]),
    )
    fresh.items = fresh.items.map((item) =>
      grades.has(item.segmentId) ? { ...item, grade: grades.get(item.segmentId) } : item,
    )
    plans = { ...plans, [today]: fresh }
  }

  let hifz = state.hifz
  if (hifz.enabled && (!hifz.todayPortion || hifz.todayPortion.day !== today)) {
    const portion = nextPortion(hifz, state.memorised)
    hifz = { ...hifz, todayPortion: portion ? { day: today, range: portion } : null }
  }

  return { ...state, records, plans, hifz }
}

/** Actions that represent a real user edit, and so bump `updatedAt`. */
const LOCAL_EDITS = new Set<Action['type']>([
  'setMemorised',
  'setSettings',
  'setHifz',
  'grade',
  'reshuffle',
  'reshufflePrayer',
  'completePortion',
  'onboarded',
  'reset',
])

function reducer(state: AppState, action: Action): AppState {
  const next = reduce(state, action)
  return LOCAL_EDITS.has(action.type) && next !== state
    ? { ...next, updatedAt: Date.now() }
    : next
}

function reduce(state: AppState, action: Action): AppState {
  const today = dayKey()
  switch (action.type) {
    case 'hydrate':
    case 'replace':
      return derive(action.state, today)

    case 'tick':
      return derive(state, today)

    case 'setMemorised':
      return derive(
        { ...state, memorised: normalizeRanges(action.ranges), planSalt: state.planSalt + 1 },
        today,
      )

    case 'setSettings':
      return derive({ ...state, settings: action.settings, planSalt: state.planSalt + 1 }, today)

    case 'setHifz':
      return derive({ ...state, hifz: { ...state.hifz, ...action.patch } }, today)

    case 'reshuffle':
      return derive({ ...state, planSalt: state.planSalt + 1 }, today)

    case 'reshufflePrayer': {
      const plan = state.plans[today]
      if (!plan) return state
      const segments = buildSegments(state.memorised, state.settings.segmentation)
      const next = reshufflePrayer({
        day: today,
        prayerId: action.prayer,
        plan,
        segments,
        records: state.records,
        settings: state.settings,
        plans: state.plans,
      })
      return { ...state, plans: { ...state.plans, [today]: next } }
    }

    case 'onboarded':
      return derive({ ...state, onboarded: true }, today)

    case 'grade': {
      const record = state.records[action.segmentId]
      if (!record) return state
      const records = {
        ...state.records,
        [action.segmentId]: gradeRecord(record, action.grade, today),
      }
      const plan = state.plans[today]
      const plans = plan
        ? {
            ...state.plans,
            [today]: {
              ...plan,
              items: plan.items.map((item) =>
                item.segmentId === action.segmentId ? { ...item, grade: action.grade } : item,
              ),
            },
          }
        : state.plans
      return {
        ...state,
        records,
        plans,
        log: [...state.log, { day: today, at: Date.now(), segmentId: action.segmentId, grade: action.grade }],
        activeDays: state.activeDays.includes(today)
          ? state.activeDays
          : [...state.activeDays, today],
      }
    }

    case 'completePortion': {
      const portion = state.hifz.todayPortion
      if (!portion) return state
      const memorised = normalizeRanges([...state.memorised, portion.range])
      const carry = carryAfter(state.hifz, portion.range, portion.range)
      const hifz: HifzGoal = {
        ...state.hifz,
        carry,
        completedDays: state.hifz.completedDays.includes(today)
          ? state.hifz.completedDays
          : [...state.hifz.completedDays, today],
        todayPortion: null,
      }
      return derive(
        {
          ...state,
          memorised,
          hifz,
          planSalt: state.planSalt + 1,
          activeDays: state.activeDays.includes(today)
            ? state.activeDays
            : [...state.activeDays, today],
        },
        today,
      )
    }

    case 'reset':
      return derive(defaultState(), today)

    default:
      return state
  }
}

export type SyncStatus = 'off' | 'signed-out' | 'syncing' | 'synced' | 'error'

interface StoreValue {
  state: AppState
  segments: Segment[]
  segmentById: Map<string, Segment>
  today: string
  ready: boolean
  dispatch: (action: Action) => void
  /** Cloud sync — inert unless Supabase keys are configured. */
  sync: {
    available: boolean
    user: CloudUser | null
    status: SyncStatus
    lastSyncedAt: number | null
    signIn: () => Promise<void>
    signOut: () => Promise<void>
    syncNow: () => Promise<void>
  }
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultState())
  const ready = useRef(false)
  const [, force] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    let cancelled = false
    loadState().then((loaded) => {
      if (cancelled) return
      dispatch({ type: 'hydrate', state: loaded })
      ready.current = true
      force()
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Debounced persistence — grading taps shouldn't hit IndexedDB one by one.
  useEffect(() => {
    if (!ready.current) return
    const handle = setTimeout(() => void saveState(prune(state)), 250)
    return () => clearTimeout(handle)
  }, [state])

  // Roll over to a new day while the app stays open.
  useEffect(() => {
    const handle = setInterval(() => {
      if (state.plans[dayKey()]) return
      dispatch({ type: 'tick' })
    }, 60_000)
    return () => clearInterval(handle)
  }, [state.plans])

  const sync = useCloudSync(state, dispatch, ready)

  const segments = useMemo(
    () => buildSegments(state.memorised, state.settings.segmentation),
    [state.memorised, state.settings.segmentation],
  )
  const segmentById = useMemo(() => new Map(segments.map((s) => [s.id, s])), [segments])

  const value = useMemo<StoreValue>(
    () => ({ state, segments, segmentById, today: dayKey(), ready: ready.current, dispatch, sync }),
    [state, segments, segmentById, sync],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

/**
 * Pulls the account's state on sign-in, merges it with whatever this device
 * has, and pushes local changes back on a debounce. Everything keeps working
 * while signed out — sync is additive, never a prerequisite.
 */
function useCloudSync(
  state: AppState,
  dispatch: (action: Action) => void,
  ready: { current: boolean },
): StoreValue['sync'] {
  const [user, setUser] = useState<CloudUser | null>(null)
  const [status, setStatus] = useState<SyncStatus>(cloudConfigured ? 'signed-out' : 'off')
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const latest = useRef(state)
  latest.current = state

  useEffect(() => {
    if (!cloudConfigured) return
    void currentUser().then(setUser)
    return onAuthChange(setUser)
  }, [])

  const reconcile = useCallback(
    async (account: CloudUser) => {
      setStatus('syncing')
      try {
        const remote = await pullState()
        const merged = remote ? mergeStates(latest.current, remote) : latest.current
        if (remote) dispatch({ type: 'replace', state: merged })
        await pushState(account.id, merged)
        setLastSyncedAt(Date.now())
        setStatus('synced')
      } catch {
        setStatus('error')
      }
    },
    [dispatch],
  )

  // First reconcile after signing in (and on every fresh session).
  useEffect(() => {
    if (!user) {
      setStatus(cloudConfigured ? 'signed-out' : 'off')
      return
    }
    if (!ready.current) return
    void reconcile(user)
  }, [user, reconcile, ready])

  // Push local edits, debounced so a burst of grading is one write.
  const pushedAt = useRef(0)
  useEffect(() => {
    if (!user || !ready.current) return
    if (state.updatedAt === pushedAt.current) return
    const handle = setTimeout(() => {
      pushedAt.current = state.updatedAt
      pushState(user.id, state)
        .then(() => {
          setLastSyncedAt(Date.now())
          setStatus('synced')
        })
        .catch(() => setStatus('error'))
    }, 2500)
    return () => clearTimeout(handle)
  }, [state, user, ready])

  return useMemo(
    () => ({
      available: cloudConfigured,
      user,
      status,
      lastSyncedAt,
      signIn: signInWithGoogle,
      signOut: async () => {
        await cloudSignOut()
        setUser(null)
      },
      syncNow: async () => {
        if (user) await reconcile(user)
      },
    }),
    [user, status, lastSyncedAt, reconcile],
  )
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}

export function useSettings(): Settings {
  return useStore().state.settings
}

export async function wipeEverything() {
  await clearState()
}
