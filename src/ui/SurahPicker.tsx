import { useMemo, useState } from 'react'
import {
  countAyahs,
  normalizeRanges,
  subtractRange,
  surah,
  SURAHS,
  surahDisplayName,
  type Range,
} from '../lib/refs'
import type { Lang } from '../lib/types'
import { Modal, Segmented, useT } from './common'

type Coverage = 'none' | 'partial' | 'all'

function coverageOf(ranges: Range[], surahId: number): { state: Coverage; known: number } {
  const known = countAyahs(ranges.filter((r) => r.surah === surahId))
  const total = surah(surahId).verses
  if (known === 0) return { state: 'none', known }
  return { state: known >= total ? 'all' : 'partial', known }
}

export const PRESETS: Record<string, () => Range[]> = {
  fatiha: () => [{ surah: 1, start: 1, end: 7 }],
  common: () => [
    { surah: 1, start: 1, end: 7 },
    { surah: 2, start: 255, end: 255 },
    ...Array.from({ length: 16 }, (_, i) => {
      const id = 99 + i
      return { surah: id, start: 1, end: surah(id).verses }
    }),
  ],
  juzAmma: () =>
    Array.from({ length: 37 }, (_, i) => {
      const id = 78 + i
      return { surah: id, start: 1, end: surah(id).verses }
    }),
}

/** Full-surah checkbox list with a per-surah verse editor for partial hifz. */
export function SurahPicker({
  ranges,
  onChange,
  lang,
  filterKnownOnly,
}: {
  ranges: Range[]
  onChange: (next: Range[]) => void
  lang: Lang
  filterKnownOnly?: boolean
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return SURAHS.filter((s) => {
      if (filterKnownOnly && !ranges.some((r) => r.surah === s.id)) return false
      if (!q) return true
      return (
        s.translit.toLowerCase().includes(q) ||
        s.nameEn.toLowerCase().includes(q) ||
        s.nameFr.toLowerCase().includes(q) ||
        s.name.includes(q) ||
        String(s.id) === q
      )
    })
  }, [query, ranges, filterKnownOnly])

  const setSurahRanges = (surahId: number, next: Range[]) => {
    const others = ranges.filter((r) => r.surah !== surahId)
    onChange(normalizeRanges([...others, ...next]))
  }

  const toggleWhole = (surahId: number) => {
    const { state } = coverageOf(ranges, surahId)
    if (state === 'all') setSurahRanges(surahId, [])
    else setSurahRanges(surahId, [{ surah: surahId, start: 1, end: surah(surahId).verses }])
  }

  return (
    <div className="col">
      <input
        type="search"
        placeholder={t('inv.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="surah-list">
        {list.map((s) => {
          const { state, known } = coverageOf(ranges, s.id)
          return (
            <div key={s.id} className={`surah-row ${state === 'all' ? 'known' : state === 'partial' ? 'partial' : ''}`}>
              <span className="num">{s.id}</span>
              <button className="grow row" onClick={() => setOpenId(s.id)} style={{ background: 'none' }}>
                <span className="grow" style={{ textAlign: 'start' }}>
                  <span className="row" style={{ gap: 8 }}>
                    <b style={{ fontSize: 14 }}>{s.translit}</b>
                    <span className="ar">{s.name}</span>
                  </span>
                  <span className="tiny faint">
                    {surahDisplayName(s, lang)} · {s.verses} {t('common.verses')} ·{' '}
                    {t('common.page')} {s.firstPage}
                    {s.lastPage !== s.firstPage ? `–${s.lastPage}` : ''}
                  </span>
                </span>
              </button>
              {state === 'partial' && (
                <span className="chip gold">
                  {known}/{s.verses}
                </span>
              )}
              <button
                className="btn sm"
                onClick={() => toggleWhole(s.id)}
                aria-label={t('inv.all')}
                style={{
                  minWidth: 42,
                  color: state === 'all' ? 'var(--accent)' : 'var(--faint)',
                }}
              >
                {state === 'all' ? '✓' : '+'}
              </button>
            </div>
          )
        })}
        {!list.length && <div className="small faint center">—</div>}
      </div>

      {openId !== null && (
        <VerseEditor
          surahId={openId}
          ranges={ranges.filter((r) => r.surah === openId)}
          onChange={(next) => setSurahRanges(openId, next)}
          onClose={() => setOpenId(null)}
          lang={lang}
        />
      )}
    </div>
  )
}

function VerseEditor({
  surahId,
  ranges,
  onChange,
  onClose,
  lang,
}: {
  surahId: number
  ranges: Range[]
  onChange: (next: Range[]) => void
  onClose: () => void
  lang: Lang
}) {
  const t = useT()
  const meta = surah(surahId)
  const { state } = coverageOf(ranges, surahId)
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(meta.verses)

  const known = useMemo(() => {
    const set = new Set<number>()
    for (const r of ranges) for (let a = r.start; a <= r.end; a++) set.add(a)
    return set
  }, [ranges])

  const toggleAyah = (ayah: number) => {
    if (known.has(ayah)) onChange(subtractRange(ranges, { surah: surahId, start: ayah, end: ayah }))
    else onChange(normalizeRanges([...ranges, { surah: surahId, start: ayah, end: ayah }]))
  }

  return (
    <Modal title={`${meta.translit} · ${meta.name}`} onClose={onClose}>
      <div className="tiny faint">
        {surahDisplayName(meta, lang)} · {meta.verses} {t('common.verses')} ·{' '}
        {meta.revelation === 'meccan' ? t('common.meccan') : t('common.medinan')}
      </div>

      <Segmented
        value={state}
        options={[
          { value: 'none' as const, label: t('inv.none') },
          { value: 'partial' as const, label: t('inv.partial') },
          { value: 'all' as const, label: t('inv.all') },
        ]}
        onChange={(v) => {
          if (v === 'none') onChange([])
          else if (v === 'all') onChange([{ surah: surahId, start: 1, end: meta.verses }])
          else if (!ranges.length) onChange([{ surah: surahId, start: 1, end: Math.min(3, meta.verses) }])
        }}
      />

      <div className="row" style={{ gap: 8 }}>
        <div className="field grow">
          <label>{t('inv.from')}</label>
          <input
            type="number"
            min={1}
            max={meta.verses}
            value={from}
            onChange={(e) => setFrom(Number(e.target.value))}
          />
        </div>
        <div className="field grow">
          <label>{t('inv.to')}</label>
          <input
            type="number"
            min={1}
            max={meta.verses}
            value={to}
            onChange={(e) => setTo(Number(e.target.value))}
          />
        </div>
        <button
          className="btn sm primary"
          style={{ alignSelf: 'end', height: 40 }}
          onClick={() =>
            onChange(normalizeRanges([...ranges, { surah: surahId, start: from, end: to }]))
          }
        >
          {t('inv.addRange')}
        </button>
      </div>

      <div className="field">
        <label>{t('inv.selectVerses')}</label>
        <div className="verse-grid">
          {Array.from({ length: meta.verses }, (_, i) => i + 1).map((a) => (
            <button
              key={a}
              className={known.has(a) ? 'on' : ''}
              onClick={() => toggleAyah(a)}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <button className="btn primary block" onClick={onClose}>
        {t('common.close')}
      </button>
    </Modal>
  )
}
