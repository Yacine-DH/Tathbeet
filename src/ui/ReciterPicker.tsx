import { defaultReciter, findReciter, recitersFor, RIWAYAT } from '../lib/audio'
import { BASMALA } from '../lib/quranText'
import type { Riwayah } from '../lib/types'
import { Field, Modal, Segmented, useT } from './common'

export interface Recitation {
  riwayah: Riwayah
  reciterId: string
}

/**
 * Riwayah + reciter in one control. Used for the stored default in Settings and
 * for the per-session override, so both offer exactly the same choices.
 */
export function RecitationPicker({
  value,
  onChange,
  showBasmala = true,
}: {
  value: Recitation
  onChange: (next: Recitation) => void
  showBasmala?: boolean
}) {
  const t = useT()
  const reciters = recitersFor(value.riwayah)

  return (
    <div className="col" style={{ gap: 13 }}>
      <Field label={t('set.riwayah')}>
        <Segmented
          value={value.riwayah}
          options={RIWAYAT.map((r) => ({ value: r.id, label: r.nameAr }))}
          // A reciter belongs to one riwayah, so the pair moves together.
          onChange={(riwayah) => onChange({ riwayah, reciterId: defaultReciter(riwayah).id })}
        />
        <div className="tiny faint">
          {RIWAYAT.find((r) => r.id === value.riwayah)?.name} · {t('set.riwayahHelp')}
        </div>
        {showBasmala && (
          <div className="arabic" style={{ fontSize: 24, marginTop: 2 }}>
            {BASMALA[value.riwayah]}
          </div>
        )}
      </Field>

      <Field label={t('set.reciter')}>
        <div className="col" style={{ gap: 6 }}>
          {reciters.map((r) => {
            const active = r.id === value.reciterId
            return (
              <button
                key={r.id}
                className="passage"
                style={
                  active
                    ? {
                        borderColor: 'color-mix(in srgb, var(--a1) 45%, transparent)',
                        background: 'var(--grad-soft)',
                      }
                    : undefined
                }
                onClick={() => onChange({ ...value, reciterId: r.id })}
              >
                <span className="grow">
                  <span className="name">{r.name}</span>
                  <span className="meta arabic" style={{ display: 'block', textAlign: 'start' }}>
                    {r.nameAr}
                  </span>
                </span>
                {active && <span className="chip accent">✓</span>}
              </button>
            )
          })}
        </div>
        {findReciter(value.reciterId)?.granularity === 'surah' && (
          <div className="tiny faint">{t('audio.surahOnly')}</div>
        )}
      </Field>
    </div>
  )
}

/** Bottom sheet wrapper used from inside a recitation session. */
export function RecitationSheet({
  value,
  onChange,
  onClose,
  onMakeDefault,
  isDefault,
}: {
  value: Recitation
  onChange: (next: Recitation) => void
  onClose: () => void
  onMakeDefault: () => void
  isDefault: boolean
}) {
  const t = useT()
  return (
    <Modal
      title={t('audio.change')}
      onClose={onClose}
      footer={
        <div className="row" style={{ gap: 8 }}>
          {!isDefault && (
            <button className="btn grow" onClick={onMakeDefault}>
              {t('audio.makeDefault')}
            </button>
          )}
          <button className="btn primary grow" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      }
    >
      <RecitationPicker value={value} onChange={onChange} />
    </Modal>
  )
}
