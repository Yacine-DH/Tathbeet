import { useMemo, useState, type ReactNode } from 'react'
import { computeStreak, dayKey, formatDay } from '../lib/dates'
import { dueBacklog } from '../lib/engine'
import { hifzProgress, targetLabel } from '../lib/hifz'
import { surah } from '../lib/refs'
import { parseSegmentId, type Segment } from '../lib/segments'
import { nextDueLabel, strength } from '../lib/srs'
import type { PlanItem, PrayerId } from '../lib/types'
import { useStore } from '../state/store'
import { Bar, Icon, StrengthRing, useT } from './common'
import { Session, type SessionItem } from './Session'

/** Time-of-day glyph per prayer, so the tile reads without language. */
const PRAYER_ICON: Record<PrayerId, () => ReactNode> = {
  fajr: Icon.dawn,
  dhuhr: Icon.sun,
  asr: Icon.sunLow,
  maghrib: Icon.sunset,
  isha: Icon.moon,
  witr: Icon.star,
  free: Icon.book,
}

const toItems = (ids: string[]): SessionItem[] =>
  ids.map((id) => ({ id, range: parseSegmentId(id), gradable: true }))

export function Today({ onGoTo }: { onGoTo: (tab: 'memorised' | 'settings') => void }) {
  const { state, segmentById, segments, dispatch } = useStore()
  const t = useT()
  const today = dayKey()
  const plan = state.plans[today]
  const [session, setSession] = useState<SessionItem[] | null>(null)
  const [openPrayer, setOpenPrayer] = useState<PrayerId | null>(null)

  const streak = useMemo(() => computeStreak(state.activeDays, today), [state.activeDays, today])

  const byPrayer = useMemo(() => {
    const map = new Map<PrayerId, PlanItem[]>()
    for (const item of plan?.items ?? []) {
      const list = map.get(item.prayer) ?? []
      list.push(item)
      map.set(item.prayer, list)
    }
    return map
  }, [plan])

  const done = plan?.items.filter((i) => i.grade).length ?? 0
  const total = plan?.items.length ?? 0
  const percent = total ? Math.round((done / total) * 100) : 0
  const remaining = (plan?.items ?? []).filter((i) => !i.grade)

  const backlog = useMemo(
    () => dueBacklog(segments, state.records, today, new Set(plan?.items.map((i) => i.segmentId))),
    [segments, state.records, today, plan],
  )

  if (!state.memorised.length) {
    return (
      <div className="screen">
        <div className="card center" style={{ gap: 16, padding: 30 }}>
          <h2>{t('today.empty')}</h2>
          <button className="btn primary" onClick={() => onGoTo('memorised')}>
            {t('today.emptyCta')}
          </button>
        </div>
      </div>
    )
  }

  const activePrayers = state.settings.prayers.filter(
    (p) => (byPrayer.get(p.id) ?? []).length > 0,
  )

  // ---- per-prayer detail: its own passages, its own shuffle ----
  if (openPrayer) {
    const items = byPrayer.get(openPrayer) ?? []
    const ungraded = items.filter((i) => !i.grade)
    const Glyph = PRAYER_ICON[openPrayer]
    return (
      <div className="screen">
        <button className="btn sm ghost" style={{ alignSelf: 'start' }} onClick={() => setOpenPrayer(null)}>
          <Icon.back /> {t('common.back')}
        </button>

        <div className="today-head">
          <span className="prayer-hero-glyph">
            <Glyph />
          </span>
          <h1 className="greeting" style={{ margin: 0 }}>
            {t(`prayer.${openPrayer}` as 'prayer.fajr')}
          </h1>
          <span className="tiny faint">
            {items.filter((i) => i.grade).length}/{items.length} · {t('today.plan')}
          </span>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn grow"
            onClick={() => dispatch({ type: 'reshufflePrayer', prayer: openPrayer })}
            disabled={!ungraded.length}
          >
            <Icon.shuffle /> {t('today.reshuffle')}
          </button>
          <button
            className="btn primary grow"
            onClick={() => setSession(toItems(ungraded.map((i) => i.segmentId)))}
            disabled={!ungraded.length}
          >
            <Icon.play /> {ungraded.length ? t('today.startSession') : t('today.done')}
          </button>
        </div>

        <div className="col" style={{ gap: 6 }}>
          {items.map((item) => {
            const seg = segmentById.get(item.segmentId)
            if (!seg) return null
            return (
              <PassageRow
                key={item.segmentId}
                segment={seg}
                done={!!item.grade}
                onClick={() => setSession(toItems([item.segmentId]))}
              />
            )
          })}
        </div>

        {session && <Session items={session} onClose={() => setSession(null)} />}
      </div>
    )
  }

  // ---- dashboard ----
  return (
    <div className="screen">
      <div className="today-head">
        <span className="date-chip">{formatDay(today, state.settings.lang)}</span>
        <h1 className="greeting" style={{ margin: 0, maxWidth: 'none' }}>
          {t('today.greeting')}
        </h1>
        {streak > 0 && <span className="chip accent">🔥 {t('today.streak', { n: streak })}</span>}
      </div>

      {/* Daily goal — overall progress plus the whole-day actions. */}
      <div className="card hero">
        <div className="row between">
          <div className="grow">
            <div className="small muted">{t('today.goalLine', { p: percent })}</div>
            <div className="row" style={{ gap: 6, alignItems: 'baseline', marginTop: 2 }}>
              <span className="display-number">{done}</span>
              <span className="muted">/ {total}</span>
            </div>
          </div>
          <button
            className="btn primary round"
            aria-label={t('today.startSession')}
            onClick={() => setSession(toItems(remaining.map((i) => i.segmentId)))}
            disabled={!remaining.length}
          >
            <Icon.play />
          </button>
        </div>
        <Bar value={total ? done / total : 0} />
        <div className="row between tiny faint">
          <span>{t('today.plan')}</span>
          <button className="btn sm ghost" onClick={() => dispatch({ type: 'reshuffle' })}>
            <Icon.shuffle /> {t('today.reshuffle')}
          </button>
        </div>
      </div>

      <HifzCard onStudy={(item) => setSession([item])} />

      {/* One tile per prayer — click through for that prayer's own view. */}
      <span className="section-label">{t('today.summary')}</span>
      <div className="prayer-grid">
        {activePrayers.map((p) => {
          const items = byPrayer.get(p.id) ?? []
          const graded = items.filter((i) => i.grade).length
          const finished = graded === items.length
          const Glyph = PRAYER_ICON[p.id]
          return (
            <button
              key={p.id}
              className={`prayer-tile ${finished ? 'done' : ''}`}
              onClick={() => setOpenPrayer(p.id)}
            >
              <span className="row between" style={{ width: '100%' }}>
                <span className="glyph">
                  <Glyph />
                </span>
                {finished ? (
                  <span className="chip accent">✓</span>
                ) : (
                  <span className="tiny faint">
                    {graded}/{items.length}
                  </span>
                )}
              </span>
              <span className="name">{t(`prayer.${p.id}` as 'prayer.fajr')}</span>
              <span className="bar thin" style={{ width: '100%' }}>
                <i style={{ width: `${items.length ? (graded / items.length) * 100 : 0}%` }} />
              </span>
            </button>
          )
        })}
      </div>

      {backlog.length > 0 && (
        <div className="card tight">
          <div className="card-head">
            <h3>{t('today.backlog')}</h3>
            <span className="chip warn">{backlog.length}</span>
          </div>
          <div className="small muted">{t('today.backlogCount', { n: backlog.length })}</div>
          <button
            className="btn block"
            onClick={() => setSession(toItems(backlog.slice(0, 10).map((s) => s.id)))}
          >
            <Icon.play /> {t('today.reciteAll')}
          </button>
        </div>
      )}

      {session && <Session items={session} onClose={() => setSession(null)} />}
    </div>
  )
}

export function PassageRow({
  segment,
  done,
  onClick,
}: {
  segment: Segment
  done?: boolean
  onClick: () => void
}) {
  const { state } = useStore()
  const t = useT()
  const record = state.records[segment.id]
  const meta = surah(segment.surah)
  const value = record ? strength(record) : 0.5
  return (
    <button className={`passage ${done ? 'done' : ''}`} onClick={onClick}>
      <StrengthRing value={value} />
      <span className="grow">
        <span className="name">
          {meta.translit}{' '}
          <span className="muted" style={{ fontWeight: 400 }}>
            {segment.start}
            {segment.end !== segment.start ? `–${segment.end}` : ''}
          </span>
        </span>
        <span className="meta" style={{ display: 'block' }}>
          {segment.ayahs} {t('common.verses')} · {t('common.page')} {segment.firstPage}
          {segment.lastPage !== segment.firstPage ? `–${segment.lastPage}` : ''} ·{' '}
          {t(`length.${segment.length}` as 'length.short')}
          {record && ` · ${nextDueLabel(record, t)}`}
        </span>
      </span>
      {done && <span className="chip accent">✓</span>}
    </button>
  )
}

function HifzCard({ onStudy }: { onStudy: (item: SessionItem) => void }) {
  const { state, dispatch } = useStore()
  const t = useT()
  const goal = state.hifz
  if (!goal.enabled) return null

  const progress = hifzProgress(goal, state.memorised)
  const portion = goal.todayPortion
  const doneToday = goal.completedDays.includes(dayKey())

  return (
    <div className="card tight">
      <div className="card-head">
        <h3>{t('today.hifzTitle')}</h3>
        <span className="chip gold">{targetLabel(goal.target, state.settings.lang)}</span>
      </div>

      <Bar value={progress.percent / 100} />
      <div className="row between tiny faint">
        <span>
          {progress.memorisedAyahs}/{progress.totalAyahs} {t('common.verses')} · {progress.percent}%
        </span>
        {progress.finishDay && !progress.done && (
          <span>
            ≈ {progress.daysLeft} {t('prog.days')}
          </span>
        )}
      </div>

      {progress.done ? (
        <div className="small muted">{t('today.hifzFinished')}</div>
      ) : doneToday && !portion ? (
        <div className="small" style={{ color: 'var(--ok)' }}>
          ✓ {t('today.hifzDone')}
        </div>
      ) : portion ? (
        <>
          <div className="passage" style={{ pointerEvents: 'none' }}>
            <span className="grow">
              <span className="name">
                {surah(portion.range.surah).translit} {portion.range.start}
                {portion.range.end !== portion.range.start ? `–${portion.range.end}` : ''}
              </span>
              <span className="meta" style={{ display: 'block' }}>
                {portion.range.end - portion.range.start + 1} {t('common.verses')} · {t('common.new')}
              </span>
            </span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn grow"
              onClick={() =>
                onStudy({
                  id: `hifz:${portion.range.surah}:${portion.range.start}-${portion.range.end}`,
                  range: portion.range,
                  gradable: false,
                  label: t('today.hifzTitle'),
                })
              }
            >
              {t('today.hifzOpen')}
            </button>
            <button className="btn primary grow" onClick={() => dispatch({ type: 'completePortion' })}>
              <Icon.check /> {t('today.hifzConfirm')}
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
