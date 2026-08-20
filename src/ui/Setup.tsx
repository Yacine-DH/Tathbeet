import { useEffect, useMemo, useState } from 'react'
import { defaultReciter, RIWAYAT } from '../lib/audio'
import { LANGUAGES, localeOf } from '../lib/i18n'
import { PACE_PRESETS, hifzProgress, remainingRanges, targetLabel } from '../lib/hifz'
import { BASMALA } from '../lib/quranText'
import { countAyahs, SURAHS, surah, type Range } from '../lib/refs'
import type { HifzTarget, Lang, PrayerConfig } from '../lib/types'
import { useStore } from '../state/store'
import { Field, Segmented, ToggleRow, useT } from './common'
import { PRESETS, SurahPicker } from './SurahPicker'

const STEPS = 4

export function Setup() {
  const { state, dispatch } = useStore()
  const t = useT()
  const [step, setStep] = useState(0)
  const [memorised, setMemorised] = useState<Range[]>(state.memorised)
  const [target, setTarget] = useState<HifzTarget>(state.hifz.target)
  const [paceId, setPaceId] = useState('ayahs-3')
  const [goalOn, setGoalOn] = useState(true)
  const [prayers, setPrayers] = useState<PrayerConfig[]>(state.settings.prayers)

  const lang = state.settings.lang
  const setLang = (next: Lang) =>
    dispatch({ type: 'setSettings', settings: { ...state.settings, lang: next } })

  const pace = PACE_PRESETS.find((p) => p.id === paceId)!.pace
  const knownAyahs = countAyahs(memorised)

  // Suggest the next surah worth learning: Juz 'Amma first, then the surahs
  // people usually take on next, then anything still unlearned.
  const suggestedTarget = useMemo<HifzTarget>(() => {
    const hasGaps = (id: number) => remainingRanges({ kind: 'surah', surah: id }, memorised).length > 0
    const order = [
      ...Array.from({ length: 37 }, (_, i) => 78 + i),
      67, 36, 18, 55, 56, 32, 76,
      ...Array.from({ length: 114 }, (_, i) => i + 1),
    ]
    for (const id of order) if (hasGaps(id)) return { kind: 'surah', surah: id }
    return { kind: 'surah', surah: 1 }
  }, [memorised])

  // Don't leave the user staring at a target they already know by heart.
  useEffect(() => {
    if (target.kind !== 'surah') return
    if (remainingRanges(target, memorised).length) return
    if (suggestedTarget.kind === 'surah' && suggestedTarget.surah !== target.surah) {
      setTarget(suggestedTarget)
    }
  }, [memorised, suggestedTarget, target])

  const finish = () => {
    dispatch({ type: 'setMemorised', ranges: memorised })
    dispatch({ type: 'setSettings', settings: { ...state.settings, prayers } })
    dispatch({
      type: 'setHifz',
      patch: {
        enabled: goalOn,
        target,
        pace,
        carry: 0,
        todayPortion: null,
      },
    })
    dispatch({ type: 'onboarded' })
  }

  const canNext = step !== 1 || memorised.length > 0

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <h1>{step === 0 ? t('setup.title') : t('app.name')}</h1>
          <div className="sub">{t('setup.step', { n: step + 1, total: STEPS })}</div>
        </div>
        <div className="chip accent">{knownAyahs} {t('common.verses')}</div>
      </div>

      <div className="screen">
        <div className="bar thin">
          <i style={{ width: `${((step + 1) / STEPS) * 100}%` }} />
        </div>

        {step === 0 && (
          <div className="card">
            <h2>{t('app.name')} — {t('app.tagline')}</h2>
            <p className="small muted" style={{ margin: 0 }}>
              {t('setup.intro')}
            </p>
            <Field label={t('setup.lang')}>
              <div className="seg" style={{ flexWrap: 'wrap' }}>
                {LANGUAGES.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={l.id === lang ? 'active' : ''}
                    onClick={() => setLang(l.id)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={t('setup.riwayah')}>
              <Segmented
                value={state.settings.riwayah}
                options={RIWAYAT.map((r) => ({ value: r.id, label: r.nameAr }))}
                onChange={(riwayah) =>
                  dispatch({
                    type: 'setSettings',
                    settings: {
                      ...state.settings,
                      riwayah,
                      audio: { ...state.settings.audio, reciterId: defaultReciter(riwayah).id },
                    },
                  })
                }
              />
              <div className="tiny faint">
                {RIWAYAT.find((r) => r.id === state.settings.riwayah)?.name} · {t('setup.riwayahHelp')}
              </div>
              <div className="arabic" style={{ fontSize: 26 }}>
                {BASMALA[state.settings.riwayah]}
              </div>
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="card">
            <h2>{t('setup.pickMemorised')}</h2>
            <p className="small muted" style={{ margin: 0 }}>
              {t('setup.pickMemorisedHelp')}
            </p>
            <div className="row wrap" style={{ gap: 6 }}>
              <span className="tiny faint">{t('setup.presets')}:</span>
              <button className="btn sm" onClick={() => setMemorised(PRESETS.fatiha())}>
                {t('setup.preset.fatiha')}
              </button>
              <button className="btn sm" onClick={() => setMemorised(PRESETS.common())}>
                {t('setup.preset.common')}
              </button>
              <button className="btn sm" onClick={() => setMemorised(PRESETS.juzAmma())}>
                {t('setup.preset.juzAmma')}
              </button>
              <button className="btn sm ghost" onClick={() => setMemorised([])}>
                {t('setup.preset.clear')}
              </button>
            </div>
            <SurahPicker ranges={memorised} onChange={setMemorised} lang={lang} />
            {!memorised.length && <div className="tiny" style={{ color: 'var(--warn)' }}>{t('setup.nothingSelected')}</div>}
          </div>
        )}

        {step === 2 && (
          <div className="card">
            <h2>{t('setup.goal')}</h2>
            <p className="small muted" style={{ margin: 0 }}>
              {t('setup.goalHelp')}
            </p>
            <ToggleRow label={t('set.hifzEnabled')} on={goalOn} onChange={setGoalOn} />
            {goalOn && (
              <>
                <TargetPicker
                  value={target}
                  onChange={setTarget}
                  lang={lang}
                  suggestion={suggestedTarget}
                />
                <Field label={t('setup.pace')}>
                  <div className="col" style={{ gap: 6 }}>
                    {PACE_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        className={`passage ${paceId === p.id ? 'known' : ''}`}
                        onClick={() => setPaceId(p.id)}
                        style={
                          paceId === p.id
                            ? { borderColor: 'color-mix(in srgb, var(--a1) 45%, transparent)', background: 'var(--grad-soft)' }
                            : undefined
                        }
                      >
                        <span className="grow">
                          <div className="name">{p.labels[lang]}</div>
                          <div className="meta">{'●'.repeat(p.level)}{'○'.repeat(4 - p.level)}</div>
                        </span>
                        {paceId === p.id && <span className="chip accent">✓</span>}
                      </button>
                    ))}
                  </div>
                </Field>
                <GoalPreview target={target} pace={paceId} memorised={memorised} lang={lang} />
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="card">
            <h2>{t('setup.prayers')}</h2>
            <p className="small muted" style={{ margin: 0 }}>
              {t('setup.prayersHelp')}
            </p>
            <div className="col" style={{ gap: 8 }}>
              {prayers.map((p, i) => (
                <div key={p.id} className="row between">
                  <div className="grow row" style={{ gap: 8 }}>
                    <span
                      className="dot"
                      style={p.enabled ? undefined : { background: 'var(--stroke-2)', boxShadow: 'none' }}
                    />
                    <span>{t(`prayer.${p.id}` as 'prayer.fajr')}</span>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      className="btn sm"
                      onClick={() => {
                        const next = [...prayers]
                        next[i] = { ...p, passages: Math.max(0, p.passages - 1), enabled: p.passages - 1 > 0 }
                        setPrayers(next)
                      }}
                    >
                      −
                    </button>
                    <span className="chip" style={{ minWidth: 34, justifyContent: 'center' }}>
                      {p.enabled ? p.passages : 0}
                    </span>
                    <button
                      className="btn sm"
                      onClick={() => {
                        const next = [...prayers]
                        next[i] = { ...p, passages: Math.min(8, p.passages + 1), enabled: true }
                        setPrayers(next)
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="row" style={{ gap: 8 }}>
          {step > 0 && (
            <button className="btn grow" onClick={() => setStep(step - 1)}>
              {t('setup.back')}
            </button>
          )}
          {step < STEPS - 1 ? (
            <button className="btn primary grow" disabled={!canNext} onClick={() => setStep(step + 1)}>
              {t('setup.next')}
            </button>
          ) : (
            <button className="btn primary grow" onClick={finish}>
              {t('setup.finish')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function TargetPicker({
  value,
  onChange,
  lang,
  suggestion,
}: {
  value: HifzTarget
  onChange: (t: HifzTarget) => void
  lang: Lang
  suggestion?: HifzTarget
}) {
  const t = useT()
  return (
    <Field label={t('set.target')}>
      <Segmented
        value={value.kind === 'juz' ? 'juz' : 'surah'}
        options={[
          { value: 'surah' as const, label: t('common.surah') },
          { value: 'juz' as const, label: t('common.juz') },
        ]}
        onChange={(kind) =>
          onChange(kind === 'juz' ? { kind: 'juz', juz: 30 } : { kind: 'surah', surah: 78 })
        }
      />
      {value.kind === 'juz' ? (
        <select
          value={value.juz}
          onChange={(e) => onChange({ kind: 'juz', juz: Number(e.target.value) })}
        >
          {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
            <option key={j} value={j}>
              {t('common.juz')} {j}
            </option>
          ))}
        </select>
      ) : (
        <select
          value={value.kind === 'surah' ? value.surah : 78}
          onChange={(e) => onChange({ kind: 'surah', surah: Number(e.target.value) })}
        >
          {SURAHS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id}. {s.translit} ({s.verses})
            </option>
          ))}
        </select>
      )}
      {suggestion && suggestion.kind === 'surah' && value.kind === 'surah' && suggestion.surah !== value.surah && (
        <button
          className="btn sm ghost"
          onClick={() => onChange(suggestion)}
          style={{ alignSelf: 'start' }}
        >
          → {surah(suggestion.surah).translit}
        </button>
      )}
      <div className="tiny faint">{targetLabel(value, lang)}</div>
    </Field>
  )
}

function GoalPreview({
  target,
  pace,
  memorised,
  lang,
}: {
  target: HifzTarget
  pace: string
  memorised: Range[]
  lang: Lang
}) {
  const t = useT()
  const preset = PACE_PRESETS.find((p) => p.id === pace)!
  const progress = hifzProgress(
    {
      enabled: true,
      target,
      pace: preset.pace,
      startedOn: '',
      carry: 0,
      completedDays: [],
      todayPortion: null,
    },
    memorised,
  )
  return (
    <div className="card tight">
      <div className="row between small">
        <span className="muted">{t('prog.remaining', { n: progress.remainingAyahs })}</span>
        <span className="chip accent">
          ≈ {progress.daysLeft} {t('prog.days')}
        </span>
      </div>
      {progress.finishDay && (
        <div className="tiny faint">
          {t('prog.eta', {
            date: new Date(progress.finishDay).toLocaleDateString(localeOf(lang)),
          })}
        </div>
      )}
    </div>
  )
}
