import { useRef, useState, type ReactNode } from 'react'
import { PACE_PRESETS, paceLabel } from '../lib/hifz'
import { LANGUAGES, localeOf } from '../lib/i18n'
import { BASMALA } from '../lib/quranText'
import { exportBackup, importBackup } from '../lib/storage'
import type { I18nKey } from '../lib/i18n'
import type { PrayerConfig, Settings, Theme } from '../lib/types'
import { useStore, wipeEverything } from '../state/store'
import { Field, GitHubBadge, Icon, Segmented, ToggleRow, useT } from './common'
import { RecitationPicker } from './ReciterPicker'
import { TargetPicker } from './Setup'

type Group =
  | 'recitation'
  | 'prayers'
  | 'engine'
  | 'goal'
  | 'reminder'
  | 'appearance'
  | 'sync'
  | 'data'

const GROUPS: { id: Group; title: I18nKey; desc: I18nKey; icon: () => ReactNode }[] = [
  { id: 'recitation', title: 'set.group.recitation', desc: 'set.group.recitationDesc', icon: Icon.wave },
  { id: 'prayers', title: 'set.prayers', desc: 'set.group.prayersDesc', icon: Icon.prayer },
  { id: 'engine', title: 'set.engine', desc: 'set.group.engineDesc', icon: Icon.sliders },
  { id: 'goal', title: 'set.hifz', desc: 'set.group.goalDesc', icon: Icon.target },
  { id: 'reminder', title: 'set.reminder', desc: 'set.group.reminderDesc', icon: Icon.bell },
  { id: 'appearance', title: 'set.group.appearance', desc: 'set.group.appearanceDesc', icon: Icon.palette },
  { id: 'sync', title: 'set.group.sync', desc: 'set.group.syncDesc', icon: Icon.cloud },
  { id: 'data', title: 'set.data', desc: 'set.group.dataDesc', icon: Icon.database },
]

/**
 * Settings is an index of seven groups, each on its own page. One long scroll of
 * every knob was the thing that felt disorganised.
 */
export function SettingsView() {
  const t = useT()
  const [group, setGroup] = useState<Group | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  if (group) {
    const meta = GROUPS.find((g) => g.id === group)!
    return (
      <div className="screen">
        <button className="btn sm ghost" style={{ alignSelf: 'start' }} onClick={() => setGroup(null)}>
          <Icon.back /> {t('common.back')}
        </button>
        <h2>{t(meta.title)}</h2>
        {group === 'recitation' && <RecitationPage />}
        {group === 'prayers' && <PrayersPage />}
        {group === 'engine' && <EnginePage />}
        {group === 'goal' && <GoalPage />}
        {group === 'reminder' && <ReminderPage onFlash={flash} />}
        {group === 'appearance' && <AppearancePage />}
        {group === 'sync' && <SyncPage />}
        {group === 'data' && <DataPage onFlash={flash} />}
        {toast && <div className="toast">{toast}</div>}
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="col" style={{ gap: 8 }}>
        {GROUPS.map((g) => (
          <button key={g.id} className="nav-row" onClick={() => setGroup(g.id)}>
            <span className="glyph">
              <g.icon />
            </span>
            <span className="grow">
              <span className="name" style={{ display: 'block', fontWeight: 550 }}>
                {t(g.title)}
              </span>
              <span className="tiny faint">{t(g.desc)}</span>
            </span>
            <span className="chev">
              <Icon.chevron />
            </span>
          </button>
        ))}
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        <GitHubBadge />
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function usePatch() {
  const { state, dispatch } = useStore()
  return (next: Partial<Settings>) =>
    dispatch({ type: 'setSettings', settings: { ...state.settings, ...next } })
}

function RecitationPage() {
  const { state } = useStore()
  const t = useT()
  const patch = usePatch()
  const settings = state.settings

  return (
    <>
      <div className="card">
        <RecitationPicker
          value={{ riwayah: settings.riwayah, reciterId: settings.audio.reciterId }}
          onChange={({ riwayah, reciterId }) =>
            patch({ riwayah, audio: { ...settings.audio, reciterId } })
          }
        />
      </div>

      <div className="card">
        <h3 className="section-label">{t('set.audio')}</h3>
        <ToggleRow
          label={t('set.autoplay')}
          on={settings.audio.autoplay}
          onChange={(autoplay) => patch({ audio: { ...settings.audio, autoplay } })}
        />
        <Field label={`${t('set.repeat')} — ${settings.audio.repeat}×`}>
          <input
            type="range"
            min={1}
            max={10}
            value={settings.audio.repeat}
            onChange={(e) => patch({ audio: { ...settings.audio, repeat: Number(e.target.value) } })}
          />
        </Field>
      </div>

      <div className="card">
        <h3 className="section-label">{t('set.display')}</h3>
        <ToggleRow
          label={t('set.translation')}
          on={settings.showTranslation}
          onChange={(showTranslation) => patch({ showTranslation })}
        />
        <ToggleRow
          label={t('set.transliteration')}
          on={settings.showTransliteration}
          onChange={(showTransliteration) => patch({ showTransliteration })}
        />
        <ToggleRow
          label={t('set.hideByDefault')}
          hint={t('set.hideByDefaultHelp')}
          on={settings.hideByDefault}
          onChange={(hideByDefault) => patch({ hideByDefault })}
        />
        <Field label={`${t('set.arabicSize')} — ${settings.arabicSize}px`}>
          <input
            type="range"
            min={20}
            max={48}
            value={settings.arabicSize}
            onChange={(e) => patch({ arabicSize: Number(e.target.value) })}
          />
          <div className="arabic" style={{ fontSize: settings.arabicSize }}>
            {BASMALA[settings.riwayah]}
          </div>
        </Field>
      </div>
    </>
  )
}

function PrayersPage() {
  const { state } = useStore()
  const t = useT()
  const patch = usePatch()
  const settings = state.settings

  const setPrayer = (index: number, next: Partial<PrayerConfig>) =>
    patch({ prayers: settings.prayers.map((p, i) => (i === index ? { ...p, ...next } : p)) })

  return (
    <div className="card">
      <div className="tiny faint">{t('setup.prayersHelp')}</div>
      {settings.prayers.map((p, i) => (
        <div key={p.id} className="col" style={{ gap: 8 }}>
          <div className="row between">
            <span className="grow row" style={{ gap: 9 }}>
              <span
                className="dot"
                style={p.enabled ? undefined : { background: 'var(--stroke-2)', boxShadow: 'none' }}
              />
              {t(`prayer.${p.id}` as 'prayer.fajr')}
            </span>
            <div className="row" style={{ gap: 6 }}>
              <button
                className="btn sm icon"
                onClick={() =>
                  setPrayer(i, { passages: Math.max(0, p.passages - 1), enabled: p.passages - 1 > 0 })
                }
              >
                −
              </button>
              <span className="chip" style={{ minWidth: 42, justifyContent: 'center' }}>
                {p.enabled ? p.passages : 0}
              </span>
              <button
                className="btn sm icon"
                onClick={() => setPrayer(i, { passages: Math.min(8, p.passages + 1), enabled: true })}
              >
                +
              </button>
            </div>
          </div>
          {p.enabled && (
            <Segmented
              value={p.length}
              options={[
                { value: 'any' as const, label: t('length.any') },
                { value: 'short' as const, label: t('length.short') },
                { value: 'medium' as const, label: t('length.medium') },
                { value: 'long' as const, label: t('length.long') },
              ]}
              onChange={(length) => setPrayer(i, { length })}
            />
          )}
          {i < settings.prayers.length - 1 && <div className="divider" />}
        </div>
      ))}
    </div>
  )
}

function EnginePage() {
  const { state } = useStore()
  const t = useT()
  const patch = usePatch()
  const settings = state.settings
  const engine = settings.engine

  return (
    <>
      <div className="card">
        <Field label={`${t('set.gap')} ${engine.minRepeatGapDays} ${t('set.gapUnit')}`}>
          <input
            type="range"
            min={0}
            max={21}
            value={engine.minRepeatGapDays}
            onChange={(e) => patch({ engine: { ...engine, minRepeatGapDays: Number(e.target.value) } })}
          />
        </Field>
        <Field label={`${t('set.weakBias')} — ${Math.round(engine.weakBias * 100)}%`}>
          <input
            type="range"
            min={0}
            max={100}
            value={engine.weakBias * 100}
            onChange={(e) => patch({ engine: { ...engine, weakBias: Number(e.target.value) / 100 } })}
          />
        </Field>
        <Field label={`${t('set.randomness')} — ${Math.round(engine.randomness * 100)}%`}>
          <input
            type="range"
            min={0}
            max={100}
            value={engine.randomness * 100}
            onChange={(e) => patch({ engine: { ...engine, randomness: Number(e.target.value) / 100 } })}
          />
        </Field>
        <div className="divider" />
        <ToggleRow
          label={t('set.avoidSameSurah')}
          on={engine.avoidSameSurahPerDay}
          onChange={(avoidSameSurahPerDay) => patch({ engine: { ...engine, avoidSameSurahPerDay } })}
        />
        <ToggleRow
          label={t('set.dueOnly')}
          on={engine.dueOnly}
          onChange={(dueOnly) => patch({ engine: { ...engine, dueOnly } })}
        />
        <ToggleRow
          label={t('set.boostNew')}
          on={engine.boostRecentlyMemorised}
          onChange={(boostRecentlyMemorised) => patch({ engine: { ...engine, boostRecentlyMemorised } })}
        />
      </div>

      <div className="card">
        <h3 className="section-label">{t('set.segmentation')}</h3>
        <Field label={t('set.segMode')}>
          <Segmented
            value={settings.segmentation.mode}
            options={[
              { value: 'page' as const, label: t('set.segMode.page') },
              { value: 'ruku' as const, label: t('set.segMode.ruku') },
              { value: 'fixed' as const, label: t('set.segMode.fixed') },
            ]}
            onChange={(mode) => patch({ segmentation: { ...settings.segmentation, mode } })}
          />
        </Field>
        <Field label={`${t('set.maxAyahs')} — ${settings.segmentation.maxAyahs}`}>
          <input
            type="range"
            min={3}
            max={40}
            value={settings.segmentation.maxAyahs}
            onChange={(e) =>
              patch({ segmentation: { ...settings.segmentation, maxAyahs: Number(e.target.value) } })
            }
          />
        </Field>
      </div>
    </>
  )
}

function GoalPage() {
  const { state, dispatch } = useStore()
  const t = useT()
  const settings = state.settings

  return (
    <div className="card">
      <ToggleRow
        label={t('set.hifzEnabled')}
        on={state.hifz.enabled}
        onChange={(enabled) => dispatch({ type: 'setHifz', patch: { enabled, todayPortion: null } })}
      />
      {state.hifz.enabled && (
        <>
          <TargetPicker
            value={state.hifz.target}
            onChange={(target) =>
              dispatch({ type: 'setHifz', patch: { target, todayPortion: null, carry: 0 } })
            }
            lang={settings.lang}
          />
          <Field label={`${t('setup.pace')} — ${paceLabel(state.hifz.pace, settings.lang)}`}>
            <div className="col" style={{ gap: 6 }}>
              {PACE_PRESETS.map((p) => {
                const active =
                  p.pace.unit === state.hifz.pace.unit &&
                  p.pace.amount === state.hifz.pace.amount &&
                  p.pace.perDays === state.hifz.pace.perDays
                return (
                  <button
                    key={p.id}
                    className="passage"
                    style={
                      active
                        ? {
                            borderColor: 'color-mix(in srgb, var(--a1) 45%, transparent)',
                            background: 'var(--grad-soft)',
                          }
                        : undefined
                    }
                    onClick={() =>
                      dispatch({
                        type: 'setHifz',
                        patch: { pace: p.pace, todayPortion: null, carry: 0 },
                      })
                    }
                  >
                    <span className="grow">
                      <span className="name">{p.labels[settings.lang]}</span>
                      <span className="meta">
                        {'●'.repeat(p.level)}
                        {'○'.repeat(4 - p.level)}
                      </span>
                    </span>
                    {active && <span className="chip accent">✓</span>}
                  </button>
                )
              })}
            </div>
          </Field>
        </>
      )}
    </div>
  )
}

function ReminderPage({ onFlash }: { onFlash: (msg: string) => void }) {
  const { state } = useStore()
  const t = useT()
  const patch = usePatch()
  const reminder = state.settings.reminder

  return (
    <div className="card">
      <ToggleRow
        label={t('set.reminder')}
        on={reminder.enabled}
        onChange={(enabled) => patch({ reminder: { ...reminder, enabled } })}
      />
      {reminder.enabled && (
        <>
          <Field label={t('set.reminderTime')}>
            <input
              type="time"
              value={reminder.time}
              onChange={(e) => patch({ reminder: { ...reminder, time: e.target.value } })}
            />
          </Field>
          <div className="row between">
            <span className="grow">{t('set.notify')}</span>
            {reminder.notify ? (
              <span className="chip accent">✓</span>
            ) : (
              <button
                className="btn sm"
                onClick={async () => {
                  if (typeof Notification === 'undefined') return onFlash(t('set.notifyDenied'))
                  const res = await Notification.requestPermission()
                  if (res === 'granted') patch({ reminder: { ...reminder, notify: true } })
                  else onFlash(t('set.notifyDenied'))
                }}
              >
                {t('set.notifyAsk')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function AppearancePage() {
  const { state } = useStore()
  const t = useT()
  const patch = usePatch()
  const settings = state.settings

  return (
    <div className="card">
      <Field label={t('set.lang')}>
        <div className="seg" style={{ flexWrap: 'wrap' }}>
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              type="button"
              className={l.id === settings.lang ? 'active' : ''}
              onClick={() => patch({ lang: l.id })}
            >
              {l.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label={t('set.theme')}>
        <Segmented
          value={settings.theme}
          options={[
            { value: 'dark' as Theme, label: t('set.theme.dark') },
            { value: 'light' as Theme, label: t('set.theme.light') },
          ]}
          onChange={(theme) => patch({ theme })}
        />
      </Field>
    </div>
  )
}

/** Google sign-in, sync state, and a manual trigger. */
function SyncPage() {
  const { sync, state } = useStore()
  const t = useT()
  const [busy, setBusy] = useState(false)

  const message =
    sync.status === 'off'
      ? t('sync.off')
      : sync.status === 'syncing'
        ? t('sync.syncing')
        : sync.status === 'error'
          ? t('sync.error')
          : sync.user
            ? t('sync.synced')
            : t('sync.signedOut')

  const tone =
    sync.status === 'error'
      ? 'var(--danger)'
      : sync.user && sync.status === 'synced'
        ? 'var(--ok)'
        : 'var(--muted)'

  return (
    <>
      <div className="card">
        <div className="row between">
          <div className="grow">
            <div style={{ color: tone }}>{message}</div>
            {sync.lastSyncedAt && (
              <div className="tiny faint">
                {new Date(sync.lastSyncedAt).toLocaleTimeString(localeOf(state.settings.lang))}
              </div>
            )}
          </div>
          {sync.user?.avatar && (
            <img
              src={sync.user.avatar}
              alt=""
              width={40}
              height={40}
              style={{ borderRadius: '50%' }}
            />
          )}
        </div>

        {sync.user && (
          <div className="passage" style={{ pointerEvents: 'none' }}>
            <span className="grow">
              <span className="name">{sync.user.name ?? sync.user.email}</span>
              {sync.user.name && sync.user.email && (
                <span className="meta" style={{ display: 'block' }}>
                  {sync.user.email}
                </span>
              )}
            </span>
          </div>
        )}

        {!sync.available ? null : sync.user ? (
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn grow"
              disabled={busy || sync.status === 'syncing'}
              onClick={async () => {
                setBusy(true)
                await sync.syncNow()
                setBusy(false)
              }}
            >
              {t('sync.now')}
            </button>
            <button className="btn grow danger" onClick={() => void sync.signOut()}>
              {t('sync.signOut')}
            </button>
          </div>
        ) : (
          <button
            className="btn primary block"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await sync.signIn()
              } finally {
                setBusy(false)
              }
            }}
          >
            {t('sync.signIn')}
          </button>
        )}
      </div>

      <div className="card tight">
        <div className="small muted">{t('sync.explain')}</div>
      </div>
    </>
  )
}

function DataPage({ onFlash }: { onFlash: (msg: string) => void }) {
  const { state, dispatch } = useStore()
  const t = useT()
  const fileRef = useRef<HTMLInputElement>(null)

  const download = () => {
    const blob = new Blob([exportBackup(state)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tathbit-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const upload = async (file: File) => {
    try {
      dispatch({ type: 'replace', state: importBackup(await file.text()) })
      onFlash(t('set.imported'))
    } catch {
      onFlash(t('set.importFailed'))
    }
  }

  return (
    <div className="card">
      <button className="btn block" onClick={download}>
        {t('set.export')}
      </button>
      <button className="btn block" onClick={() => fileRef.current?.click()}>
        {t('set.import')}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void upload(file)
          e.target.value = ''
        }}
      />
      <div className="divider" />
      <button
        className="btn block danger"
        onClick={async () => {
          if (!confirm(t('set.resetConfirm'))) return
          await wipeEverything()
          dispatch({ type: 'reset' })
        }}
      >
        {t('set.reset')}
      </button>
    </div>
  )
}
