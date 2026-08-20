import { useMemo, useState } from 'react'
import { countAyahs, pageOf, surah, type Range } from '../lib/refs'
import { parseSegmentId } from '../lib/segments'
import { strength } from '../lib/srs'
import { useStore } from '../state/store'
import { Segmented, useT } from './common'
import { Session, type SessionItem } from './Session'
import { SurahPicker } from './SurahPicker'
import { PassageRow } from './Today'

export function memorisedPages(ranges: Range[]): number {
  const pages = new Set<number>()
  for (const r of ranges) {
    for (let a = r.start; a <= r.end; a++) pages.add(pageOf(r.surah, a))
  }
  return pages.size
}

/** Two jobs, two tabs: edit what you know, or drill the passages it produced. */
export function Inventory() {
  const { state, segments, dispatch } = useStore()
  const t = useT()
  const [tab, setTab] = useState<'surahs' | 'passages'>('surahs')
  const [scope, setScope] = useState<'known' | 'all'>('known')
  const [session, setSession] = useState<SessionItem[] | null>(null)

  const surahCount = useMemo(
    () => new Set(state.memorised.map((r) => r.surah)).size,
    [state.memorised],
  )

  // Weakest first: that is what actually needs attention.
  const sorted = useMemo(() => {
    const value = (id: string) => {
      const record = state.records[id]
      return record ? strength(record) : 0.5
    }
    return segments.slice().sort((a, b) => value(a.id) - value(b.id))
  }, [segments, state.records])

  const open = (ids: string[]) =>
    setSession(ids.map((id) => ({ id, range: parseSegmentId(id), gradable: true })))

  return (
    <div className="screen">
      <div className="card tight">
        <div className="row between">
          <div>
            <span className="display-number" style={{ fontSize: 30 }}>
              {countAyahs(state.memorised)}
            </span>
            <div className="tiny faint">{t('prog.memorised')}</div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <span className="chip">
              {segments.length} {t('inv.tabPassages')}
            </span>
            <span className="chip">
              {surahCount} {t('common.surah')}
            </span>
          </div>
        </div>
      </div>

      <Segmented
        value={tab}
        options={[
          { value: 'surahs' as const, label: t('inv.tabSurahs') },
          { value: 'passages' as const, label: t('inv.tabPassages') },
        ]}
        onChange={setTab}
      />

      {tab === 'surahs' ? (
        <div className="card tight">
          <Segmented
            value={scope}
            options={[
              { value: 'known' as const, label: t('inv.filterKnown') },
              { value: 'all' as const, label: t('inv.filterAll') },
            ]}
            onChange={setScope}
          />
          <SurahPicker
            ranges={state.memorised}
            onChange={(ranges) => dispatch({ type: 'setMemorised', ranges })}
            lang={state.settings.lang}
            filterKnownOnly={scope === 'known'}
          />
        </div>
      ) : (
        <div className="card tight">
          <div className="card-head">
            <h3 className="section-label">{t('prog.weakest')}</h3>
            <span className="chip">{segments.length}</span>
          </div>
          <div className="col" style={{ gap: 6 }}>
            {sorted.slice(0, 80).map((seg) => (
              <PassageRow key={seg.id} segment={seg} onClick={() => open([seg.id])} />
            ))}
            {!sorted.length && <div className="small faint center">{t('today.empty')}</div>}
            {sorted.length > 80 && <div className="tiny faint center">+{sorted.length - 80}</div>}
          </div>
        </div>
      )}

      {session && <Session items={session} onClose={() => setSession(null)} />}
    </div>
  )
}

export { surah }
