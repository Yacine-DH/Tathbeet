import { useEffect, useMemo, useState } from 'react'
import { arabicNumber, loadPassage, type PassageText } from '../lib/quranText'
import { surah, type Range } from '../lib/refs'
import { nextDueLabel } from '../lib/srs'
import { GRADES, type Grade, type Riwayah } from '../lib/types'
import { useStore } from '../state/store'
import { StrengthRing, useT } from './common'
import { LOOP_STEPS, usePassagePlayer, type Player } from './usePlayer'
import { RecitationSheet, type Recitation } from './ReciterPicker'

export interface SessionItem {
  /** Segment id when the passage is schedulable, else a synthetic id. */
  id: string
  range: Range
  gradable: boolean
  label?: string
}

export function Session({
  items,
  onClose,
  onFinish,
}: {
  items: SessionItem[]
  onClose: () => void
  onFinish?: () => void
}) {
  const { state, dispatch } = useStore()
  const t = useT()
  const settings = state.settings
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(!settings.hideByDefault)
  const [hint, setHint] = useState(false)
  const [graded, setGraded] = useState(0)
  const [done, setDone] = useState(false)

  const item = items[index]

  // Riwayah and reciter can be changed for this session without touching the
  // stored defaults; `null` means "follow settings".
  const [override, setOverride] = useState<Recitation | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const recitation: Recitation = override ?? {
    riwayah: settings.riwayah,
    reciterId: settings.audio.reciterId,
  }
  // Loop-to-drill: overrides the stored repeat count for this session only.
  const [loop, setLoop] = useState<number | null>(null)
  const repeat = loop ?? settings.audio.repeat
  const audio = useMemo(
    () => ({ ...settings.audio, reciterId: recitation.reciterId, repeat }),
    [settings.audio, recitation.reciterId, repeat],
  )
  const player = usePassagePlayer(item?.range ?? { surah: 1, start: 1, end: 1 }, audio)

  useEffect(() => {
    setRevealed(!settings.hideByDefault)
    setHint(false)
  }, [index, settings.hideByDefault])

  // Optionally start the recitation the moment the text is uncovered.
  useEffect(() => {
    if (revealed && settings.audio.autoplay && player.status === 'idle') player.toggle()
  }, [revealed, settings.audio.autoplay, player])

  const advance = () => {
    if (index + 1 < items.length) setIndex(index + 1)
    else setDone(true)
  }

  const onGrade = (grade: Grade) => {
    if (item.gradable) dispatch({ type: 'grade', segmentId: item.id, grade })
    setGraded((n) => n + 1)
    advance()
  }

  if (done) {
    return (
      <div className="overlay">
        <div className="overlay-body center" style={{ justifyContent: 'center', gap: 12 }}>
          <div style={{ fontSize: 44 }}>✦</div>
          <h1>{t('session.finished')}</h1>
          <p className="muted">{t('session.finishedBody', { n: graded || items.length })}</p>
          <button
            className="btn primary"
            onClick={() => {
              onFinish?.()
              onClose()
            }}
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="overlay">
      <div className="overlay-head">
        <button className="btn sm ghost" onClick={onClose}>
          ✕
        </button>
        <div className="small muted">{t('session.of', { i: index + 1, n: items.length })}</div>
        <button className="btn sm ghost" onClick={advance} disabled={index + 1 >= items.length && !item.gradable}>
          {t('session.next')} →
        </button>
      </div>

      <div className="overlay-body">
        <PassageHeader item={item} />
        <PassageBody
          item={item}
          revealed={revealed}
          hint={hint}
          currentAyah={player.currentAyah}
          riwayah={recitation.riwayah}
        />
      </div>

      <div className="overlay-foot">
        <AudioBar
          player={player}
          range={item.range}
          isOverride={override !== null}
          onOpenPicker={() => setPickerOpen(true)}
          repeat={repeat}
          onCycleLoop={() =>
            setLoop(LOOP_STEPS[(LOOP_STEPS.indexOf(repeat as 1) + 1) % LOOP_STEPS.length])
          }
        />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn grow" onClick={() => setHint(true)} disabled={revealed || hint}>
            ✦ {t('session.hint')}
          </button>
          <button className="btn grow primary" onClick={() => setRevealed(!revealed)}>
            {revealed ? t('session.hide') : t('session.reveal')}
          </button>
        </div>
        {item.gradable ? (
          <>
            <div className="tiny faint center">{t('session.gradePrompt')}</div>
            <div className="grades">
              {GRADES.map((g) => (
                <button key={g} className={`g-${g}`} onClick={() => onGrade(g)}>
                  {t(`grade.${g}` as 'grade.good')}
                  <span>{t(`grade.hint.${g}` as 'grade.hint.good')}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <button className="btn primary block" onClick={advance}>
            {t('session.next')}
          </button>
        )}
      </div>

      {pickerOpen && (
        <RecitationSheet
          value={recitation}
          onChange={setOverride}
          onClose={() => setPickerOpen(false)}
          isDefault={override === null}
          onMakeDefault={() => {
            dispatch({
              type: 'setSettings',
              settings: {
                ...settings,
                riwayah: recitation.riwayah,
                audio: { ...settings.audio, reciterId: recitation.reciterId },
              },
            })
            setOverride(null)
          }}
        />
      )}
    </div>
  )
}

/** Play / pause plus the reciter, repeat counter and riwayah-specific caveats. */
function AudioBar({
  player,
  range,
  isOverride,
  onOpenPicker,
  repeat,
  onCycleLoop,
}: {
  player: Player
  range: Range
  isOverride: boolean
  onOpenPicker: () => void
  repeat: number
  onCycleLoop: () => void
}) {
  const { state } = useStore()
  const t = useT()
  const { lang } = state.settings
  const reciter = player.reciter
  const startsAtSurahHead = reciter?.granularity === 'surah' && range.start > 1
  const busy = player.status === 'playing' || player.status === 'loading'

  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="row" style={{ gap: 8 }}>
        <button
          className="btn"
          onClick={player.toggle}
          style={{ minWidth: 52 }}
          aria-label={busy ? t('audio.pause') : t('audio.play')}
        >
          {busy ? '❚❚' : '▶'}
        </button>
        {/* The whole label is the affordance for switching riwayah / reciter. */}
        <button
          className="btn ghost grow"
          onClick={onOpenPicker}
          style={{ minWidth: 0, justifyContent: 'flex-start', textAlign: 'start', padding: '0 8px' }}
          aria-label={t('audio.change')}
        >
          <span className="grow" style={{ minWidth: 0 }}>
            <span
              className="small row"
              style={{ gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {reciter ? (lang === 'ar' ? reciter.nameAr : reciter.name) : '—'}
              {isOverride && <span className="chip accent">{t('audio.sessionOnly')}</span>}
            </span>
            <span className="tiny faint" style={{ display: 'block' }}>
            {player.status === 'error'
              ? t('audio.error')
              : player.status === 'loading'
                ? t('audio.loading')
                : player.currentAyah
                  ? `${t('common.verse')} ${player.currentAyah}${
                      repeat !== 1
                        ? ` · ${t('audio.pass', { i: player.pass, n: repeat === 0 ? '∞' : repeat })}`
                        : ''
                    }`
                  : lang === 'ar'
                    ? reciter?.name
                    : (reciter?.nameAr ?? '')}
            </span>
          </span>
        </button>
        <button
          className={`btn sm ${repeat !== 1 ? 'primary' : ''}`}
          onClick={onCycleLoop}
          title={t('set.repeat')}
          aria-label={t('set.repeat')}
          style={{ minWidth: 46 }}
        >
          {repeat === 0 ? '∞' : `${repeat}×`}
        </button>
        {player.status !== 'idle' && (
          <button className="btn sm ghost" onClick={player.stop}>
            ■
          </button>
        )}
      </div>
      {startsAtSurahHead && <div className="tiny faint">{t('audio.surahOnly')}</div>}
    </div>
  )
}

function PassageHeader({ item }: { item: SessionItem }) {
  const { state } = useStore()
  const t = useT()
  const meta = surah(item.range.surah)
  const record = state.records[item.id]
  return (
    <div className="row between">
      <div>
        <h2>
          {meta.translit}{' '}
          <span className="muted" style={{ fontWeight: 400 }}>
            {item.range.start}
            {item.range.end !== item.range.start ? `–${item.range.end}` : ''}
          </span>
        </h2>
        <div className="tiny faint">
          {item.label ?? `${meta.name} · ${t('common.verses')} ${item.range.end - item.range.start + 1}`}
          {record && ` · ${nextDueLabel(record, t)}`}
        </div>
      </div>
      {record && <StrengthRing value={strengthOf(record.lastReviewed, record.interval)} />}
    </div>
  )
}

function strengthOf(lastReviewed: number | null, interval: number): number {
  if (!lastReviewed) return 0.5
  const elapsed = (Date.now() - lastReviewed) / 86400000
  return 1 / (1 + elapsed / (9 * Math.max(0.5, interval)))
}

function PassageBody({
  item,
  revealed,
  hint,
  currentAyah,
  riwayah,
}: {
  item: SessionItem
  revealed: boolean
  hint: boolean
  currentAyah: number | null
  riwayah: Riwayah
}) {
  const { state } = useStore()
  const t = useT()
  const settings = state.settings
  const [text, setText] = useState<PassageText | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setText(null)
    setError(null)
    loadPassage(item.range.surah, item.range.start, item.range.end, {
      lang: settings.lang,
      riwayah,
      translation: settings.showTranslation,
      transliteration: settings.showTransliteration,
    })
      .then((res) => !cancelled && setText(res))
      .catch((err: Error) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [
    item.range.surah,
    item.range.start,
    item.range.end,
    settings.lang,
    riwayah,
    settings.showTranslation,
    settings.showTransliteration,
  ])

  const firstWords = useMemo(() => {
    if (!text) return ''
    return text.lines[0]?.arabic.split(' ').slice(0, 3).join(' ') ?? ''
  }, [text])

  if (error) return <div className="card small" style={{ color: 'var(--danger)' }}>{error}</div>
  if (!text) return <div className="card small muted">{t('common.loading')}</div>

  return (
    <div className="col" style={{ gap: 14 }}>
      {!revealed && (
        <div className="card tight center small muted">
          {t('session.recallHint')}
          {hint && (
            <div className="arabic" style={{ fontSize: settings.arabicSize, textAlign: 'center' }}>
              {firstWords}…
            </div>
          )}
        </div>
      )}

      <div className={`arabic ${revealed ? '' : 'blurred'}`} style={{ fontSize: settings.arabicSize }}>
        {text.showBasmala && (
          <div style={{ textAlign: 'center', marginBottom: 8 }}>{text.basmala}</div>
        )}
        {text.lines.map((line) => (
          <span key={line.ayah} className={currentAyah === line.ayah ? 'sounding' : undefined}>
            {line.arabic}
            <span className="ayah-mark">﴿{arabicNumber(line.ayah)}﴾</span>{' '}
          </span>
        ))}
      </div>

      {revealed && settings.showTransliteration && (
        <div className="col" style={{ gap: 6 }}>
          {text.lines.map((line) => (
            <div key={line.ayah} className="translit">
              {line.ayah}. {line.transliteration}
            </div>
          ))}
        </div>
      )}

      {revealed && settings.showTranslation && (
        <div className="col" style={{ gap: 8 }}>
          {text.lines.map((line) => (
            <div key={line.ayah} className="translation">
              <b className="tiny faint">{line.ayah}</b> {line.translation}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
