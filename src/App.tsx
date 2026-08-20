import { useEffect, useState } from 'react'
import { dayKey } from './lib/dates'
import { loadArabic, loadTranslation } from './lib/quranText'
import { directionOf, translator } from './lib/i18n'
import { StoreProvider, useStore } from './state/store'
import { Icon, useT } from './ui/common'
import { Inventory } from './ui/Inventory'
import { Progress } from './ui/Progress'
import { SettingsView } from './ui/SettingsView'
import { Setup } from './ui/Setup'
import { Today } from './ui/Today'

type Tab = 'today' | 'memorised' | 'progress' | 'settings'

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

function Shell() {
  const { state } = useStore()
  const [tab, setTab] = useState<Tab>('today')
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

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <h1>{tabTitle(tab, t)}</h1>
          <div className="sub">{t('app.tagline')}</div>
        </div>
      </div>

      {tab === 'today' && <Today onGoTo={setTab} />}
      {tab === 'memorised' && <Inventory />}
      {tab === 'progress' && <Progress />}
      {tab === 'settings' && <SettingsView />}

      <nav className="tabbar">
        <button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}>
          <Icon.today />
          {t('nav.today')}
        </button>
        <button className={tab === 'memorised' ? 'active' : ''} onClick={() => setTab('memorised')}>
          <Icon.book />
          {t('nav.memorised')}
        </button>
        <button className={tab === 'progress' ? 'active' : ''} onClick={() => setTab('progress')}>
          <Icon.chart />
          {t('nav.progress')}
        </button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          <Icon.gear />
          {t('nav.settings')}
        </button>
      </nav>
    </div>
  )
}

function tabTitle(tab: Tab, t: ReturnType<typeof translator>): string {
  if (tab === 'today') return t('nav.today')
  if (tab === 'memorised') return t('nav.memorised')
  if (tab === 'progress') return t('nav.progress')
  return t('nav.settings')
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
