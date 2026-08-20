import { useEffect, useState } from 'react'
import { computeStreak, dayKey } from './lib/dates'
import { directionOf, translator } from './lib/i18n'
import { loadArabic, loadTranslation } from './lib/quranText'
import { countAyahs } from './lib/refs'
import { StoreProvider, useStore } from './state/store'
import { GitHubBadge, Icon, Modal, useT } from './ui/common'
import { RecitationPicker } from './ui/ReciterPicker'
import { Inventory } from './ui/Inventory'
import { Progress } from './ui/Progress'
import { SettingsView } from './ui/SettingsView'
import { Setup } from './ui/Setup'
import { Today } from './ui/Today'

type Tab = 'today' | 'memorised' | 'progress' | 'settings'

const TABS: { id: Tab; label: 'nav.today'; icon: () => React.ReactNode }[] = [
  { id: 'today', label: 'nav.today', icon: Icon.today },
  { id: 'memorised', label: 'nav.memorised' as 'nav.today', icon: Icon.book },
  { id: 'progress', label: 'nav.progress' as 'nav.today', icon: Icon.chart },
  { id: 'settings', label: 'nav.settings' as 'nav.today', icon: Icon.gear },
]

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

function Shell() {
  const { state, sync, dispatch } = useStore()
  const [tab, setTab] = useState<Tab>('today')
  const [recitationOpen, setRecitationOpen] = useState(false)
  const t = useT()

  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme
    document.documentElement.lang = state.settings.lang
    document.documentElement.dir = directionOf(state.settings.lang)
  }, [state.settings.theme, state.settings.lang])

  // Pull the corpus in early so the service worker has it cached before the
  // user is offline (and before the first passage is opened).
  useEffect(() => {
    void loadArabic(state.settings.riwayah).catch(() => {})
    if (state.settings.showTranslation) void loadTranslation(state.settings.lang).catch(() => {})
  }, [state.settings.riwayah, state.settings.lang, state.settings.showTranslation])

  useReminder()

  if (!state.onboarded) return <Setup />

  const streak = computeStreak(state.activeDays, dayKey())

  return (
    <div className="app">
      {/* Desktop navigation rail; below 900px the bottom bar takes over. */}
      <aside className="rail">
        <div className="brand">
          <span className="mark">ت</span>
          <b>{t('app.name')}</b>
        </div>
        <nav>
          {TABS.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
            >
              <item.icon />
              {t(item.label)}
            </button>
          ))}
          <button onClick={() => setRecitationOpen(true)}>
            <Icon.wave />
            {t('set.audio')}
          </button>
        </nav>
        <div className="rail-foot rail-sync" style={{ marginTop: 'auto' }}>
          {sync.available &&
            (sync.user ? (
              <>
                <div className="row" style={{ gap: 9 }}>
                  {sync.user.avatar && <img src={sync.user.avatar} alt="" width={30} height={30} />}
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div
                      className="tiny"
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {sync.user.name ?? sync.user.email}
                    </div>
                    <div
                      className="tiny"
                      style={{
                        color:
                          sync.status === 'error' ? 'var(--danger)' : 'var(--rail-muted)',
                      }}
                    >
                      {sync.status === 'syncing'
                        ? t('sync.syncing')
                        : sync.status === 'error'
                          ? t('sync.error')
                          : t('sync.synced')}
                    </div>
                  </div>
                </div>
                <button className="btn sm block" onClick={() => void sync.syncNow()}>
                  {t('sync.now')}
                </button>
              </>
            ) : (
              <button className="btn sm block" onClick={() => void sync.signIn()}>
                {t('sync.signIn')}
              </button>
            ))}
        </div>
        <div className="rail-foot">
          <div className="tiny" style={{ color: 'var(--rail-muted)' }}>
            {t('prog.streak')}
          </div>
          <div style={{ fontSize: 26, fontWeight: 620, letterSpacing: '-0.03em' }}>
            {streak} <span style={{ fontSize: 13, fontWeight: 400 }}>{t('prog.days')}</span>
          </div>
          <div className="tiny" style={{ color: 'var(--rail-muted)' }}>
            {countAyahs(state.memorised)} {t('common.verses')}
          </div>
        </div>
        <GitHubBadge />
      </aside>

      <div className="canvas">
        {tab === 'today' && <Today onGoTo={setTab} />}
        {tab === 'memorised' && <Inventory />}
        {tab === 'progress' && <Progress />}
        {tab === 'settings' && <SettingsView />}
      </div>

      <nav className="tabbar">
        {TABS.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id)}
          >
            <item.icon />
            {t(item.label)}
          </button>
        ))}
      </nav>

      {recitationOpen && (
        <Modal title={t('set.audio')} onClose={() => setRecitationOpen(false)}>
          <RecitationPicker
            value={{ riwayah: state.settings.riwayah, reciterId: state.settings.audio.reciterId }}
            onChange={({ riwayah, reciterId }) =>
              dispatch({
                type: 'setSettings',
                settings: {
                  ...state.settings,
                  riwayah,
                  audio: { ...state.settings.audio, reciterId },
                },
              })
            }
          />
          <button className="btn primary block" onClick={() => setRecitationOpen(false)}>
            {t('common.close')}
          </button>
        </Modal>
      )}
    </div>
  )
}

/**
 * Fires one local notification a day once the reminder time has passed and
 * nothing has been recited yet. No server, no push — just the open tab.
 */
function useReminder() {
  const { state } = useStore()
  const reminder = state.settings.reminder

  useEffect(() => {
    if (!reminder.enabled || !reminder.notify) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

    const key = 'tathbit-last-reminder'
    const check = () => {
      const today = dayKey()
      if (localStorage.getItem(key) === today) return
      if (state.activeDays.includes(today)) return
      const [h, m] = reminder.time.split(':').map(Number)
      const now = new Date()
      if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return
      const t = translator(state.settings.lang)
      new Notification(t('app.name'), { body: t('today.title') + ' — ' + t('app.tagline') })
      localStorage.setItem(key, today)
    }

    check()
    const handle = setInterval(check, 60_000)
    return () => clearInterval(handle)
  }, [reminder.enabled, reminder.notify, reminder.time, state.activeDays, state.settings.lang])
}
