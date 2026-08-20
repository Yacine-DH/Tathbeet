import { useMemo, useState } from 'react'
import { addDays, computeStreak, dayKey } from '../lib/dates'
import { localeOf } from '../lib/i18n'
import { weakest } from '../lib/engine'
import { hifzProgress, targetLabel } from '../lib/hifz'
import { countAyahs } from '../lib/refs'
import { parseSegmentId } from '../lib/segments'
import { strength } from '../lib/srs'
import { useStore } from '../state/store'
import { Bar, strengthColor, useT } from './common'
import { memorisedPages } from './Inventory'
import { Session, type SessionItem } from './Session'
import { PassageRow } from './Today'

/** Ayah thresholds for each level — roughly one level per meaningful milestone. */
const LEVELS = [0, 10, 25, 50, 100, 200, 350, 600, 1000, 1500, 2200, 3200, 4500, 6236]

export function levelOf(ayahs: number): { level: number; next: number; progress: number } {
  let level = 1
  for (let i = 1; i < LEVELS.length; i++) if (ayahs >= LEVELS[i]) level = i + 1
  const floor = LEVELS[level - 1] ?? 0
  const next = LEVELS[level] ?? LEVELS[LEVELS.length - 1]
  return { level, next, progress: next > floor ? (ayahs - floor) / (next - floor) : 1 }
}

export function Progress() {
  const { state, segments } = useStore()
  const t = useT()
  const today = dayKey()
  const [session, setSession] = useState<SessionItem[] | null>(null)

  const ayahs = countAyahs(state.memorised)
  const level = levelOf(ayahs)
  const streak = computeStreak(state.activeDays, today)
  const pages = useMemo(() => memorisedPages(state.memorised), [state.memorised])

  const recent = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000
    return state.log.filter((e) => e.at >= cutoff).length
  }, [state.log])

  const avgStrength = useMemo(() => {
    const records = segments.map((s) => state.records[s.id]).filter(Boolean)
    if (!records.length) return 0
    return records.reduce((sum, r) => sum + strength(r), 0) / records.length
  }, [segments, state.records])

  const weak = useMemo(() => weakest(segments, state.records, 6), [segments, state.records])

  const heat = useMemo(() => {
    const days: { day: string; count: number }[] = []
    const counts = new Map<string, number>()
    for (const e of state.log) counts.set(e.day, (counts.get(e.day) ?? 0) + 1)
    for (let i = 55; i >= 0; i--) {
      const day = addDays(today, -i)
      days.push({ day, count: counts.get(day) ?? 0 })
    }
    return days
  }, [state.log, today])

  const goal = state.hifz.enabled ? hifzProgress(state.hifz, state.memorised, today) : null

  return (
    <div className="screen">
      <div className="card">
        <div className="row between">
          <div>
            <h2>{t('prog.level', { n: level.level })}</h2>
            <div className="tiny faint">
              {ayahs} / {level.next} {t('common.verses')}
            </div>
          </div>
          <div className="chip gold">{Math.round((ayahs / 6236) * 1000) / 10}%</div>
        </div>
        <Bar value={level.progress} tone="var(--gold)" />
      </div>

      <div className="stats">
        <div className="stat">
          <b>{ayahs}</b>
          <span>{t('prog.memorised')}</span>
        </div>
        <div className="stat">
          <b>{pages}</b>
          <span>{t('prog.pages')} / 604</span>
        </div>
        <div className="stat">
          <b>{streak}</b>
          <span>
            {t('prog.streak')} ({t('prog.days')})
          </span>
        </div>
        <div className="stat">
          <b>{recent}</b>
          <span>{t('prog.reviewed7')}</span>
        </div>
      </div>

      <div className="card tight">
        <div className="row between">
          <h3>{t('prog.avgStrength')}</h3>
          <span className="chip" style={{ color: strengthColor(avgStrength) }}>
            {Math.round(avgStrength * 100)}%
          </span>
        </div>
        <Bar value={avgStrength} tone={strengthColor(avgStrength)} />
      </div>

      {goal && (
        <div className="card tight">
          <div className="card-head">
            <h3>{t('prog.goal')}</h3>
            <span className="chip gold">{targetLabel(state.hifz.target, state.settings.lang)}</span>
          </div>
          <Bar value={goal.percent / 100} tone="var(--gold)" />
          <div className="row between tiny faint">
            <span>{t('prog.remaining', { n: goal.remainingAyahs })}</span>
            {goal.finishDay && (
              <span>
                {t('prog.eta', {
                  date: new Date(goal.finishDay).toLocaleDateString(localeOf(state.settings.lang)),
                })}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="card tight">
        <h3>{t('prog.activity')}</h3>
        <div className="heat">
          {heat.map((d) => (
            <i
              key={d.day}
              title={`${d.day} — ${d.count}`}
              style={
                d.count
                  ? {
                      background: `color-mix(in srgb, var(--a1) ${Math.min(100, 22 + d.count * 16)}%, var(--s2))`,
                      borderColor: 'color-mix(in srgb, var(--a1) 35%, transparent)',
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      {weak.length > 0 ? (
        <div className="card tight">
          <h3>{t('prog.weakest')}</h3>
          <div className="col" style={{ gap: 6 }}>
            {weak.map((c) => (
              <PassageRow
                key={c.segment.id}
                segment={c.segment}
                onClick={() =>
                  setSession([
                    { id: c.segment.id, range: parseSegmentId(c.segment.id), gradable: true },
                  ])
                }
              />
            ))}
          </div>
          <button
            className="btn block"
            onClick={() =>
              setSession(
                weak.map((c) => ({
                  id: c.segment.id,
                  range: parseSegmentId(c.segment.id),
                  gradable: true,
                })),
              )
            }
          >
            {t('today.reciteAll')}
          </button>
        </div>
      ) : (
        <div className="card small muted center">{t('prog.noData')}</div>
      )}

      {session && <Session items={session} onClose={() => setSession(null)} />}
    </div>
  )
}
