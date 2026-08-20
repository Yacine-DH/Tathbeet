import { useMemo, useState } from 'react'
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

export function Today({ onGoTo }: { onGoTo: (tab: 'memorised' | 'settings') => void }) {
  const { state, segmentById, segments, dispatch } = useStore()
  const t = useT()
  const today = dayKey()
  const plan = state.plans[today]
  const [session, setSession] = useState<SessionItem[] | null>(null)

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
  const remaining = (plan?.items ?? []).filter((i) => !i.grade)

  const backlog = useMemo(
    () => dueBacklog(segments, state.records, today, new Set(plan?.items.map((i) => i.segmentId))),
    [segments, state.records, today, plan],
  )

  const toItems = (ids: string[]): SessionItem[] =>
    ids.map((id) => ({ id, range: parseSegmentId(id), gradable: true }))

  if (!state.memorised.length) {
    return (
      <div className="screen">
        <div className="card center" style={{ gap: 16, padding: 28 }}>
          <h2>{t('today.empty')}</h2>
          <button className="btn primary" onClick={() => onGoTo('memorised')}>
            {t('today.emptyCta')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      {/* Hero: the day at a glance, and the one button that matters. */}
      <div className="card hero">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="tiny faint">{formatDay(today, state.settings.lang)}</div>
            <div className="row" style={{ gap: 8, alignItems: 'baseline', marginTop: 4 }}>
              <span className="display-number">{done}</span>
              <span className="muted">/ {total}</span>
            </div>
            <div className="tiny faint">{t('today.plan')}</div>
          </div>
          <div className="col" style={{ alignItems: 'flex-end', gap: 8 }}>
            {streak > 0 && <span className="chip gold">🔥 {t('today.streak', { n: streak })}</span>}
            <button className="btn sm ghost" onClick={() => dispatch({ type: 'reshuffle' })}>
              <Icon.shuffle /> {t('today.reshuffle')}
            </button>
          </div>
        </div>

        <Bar value={total ? done / total : 0} />

        <button
          className="btn primary block"
          onClick={() => setSession(toItems(remaining.map((i) => i.segmentId)))}
          disabled={!remaining.length}
        >
          <Icon.play /> {remaining.length ? t('today.startSession') : t('today.done')}
        </button>
      </div>

      <HifzCard onStudy={(item) => setSession([item])} />

      <h3 className="section-label" style={{ marginTop: 4 }}>
        {t('today.plan')}
      </h3>

      {state.settings.prayers
        .filter((p) => (byPrayer.get(p.id) ?? []).length > 0)
        .map((prayer) => {
          const items = byPrayer.get(prayer.id) ?? []
          const prayerDone = items.every((i) => i.grade)
          return (
            <div key={prayer.id} className="card tight">
              <div className="card-head">
                <h3 style={prayerDone ? { color: 'var(--faint)' } : undefined}>
                  {t(`prayer.${prayer.id}` as 'prayer.fajr')}
                </h3>
                <div className="row" style={{ gap: 8 }}>
                  <span className="tiny faint">
                    {items.filter((i) => i.grade).length}/{items.length}
                  </span>
                  <button
                    className="btn sm icon"
                    aria-label={t('today.reciteAll')}
                    onClick={() => setSession(toItems(items.map((i) => i.segmentId)))}
                  >
                    <Icon.play />
                  </button>
                </div>
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
            </div>
          )
        })}

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
    <div
      className="card tight"
      style={{ borderColor: 'color-mix(in srgb, var(--gold) 30%, var(--stroke))' }}
    >
      <div className="card-head">
        <h3 style={{ color: 'var(--gold)' }}>{t('today.hifzTitle')}</h3>
        <span className="chip gold">{targetLabel(goal.target, state.settings.lang)}</span>
      </div>

      <Bar value={progress.percent / 100} tone="linear-gradient(135deg, var(--gold), #f0d9a8)" />
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
