import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { translator, type Translator } from '../lib/i18n'
import { useStore } from '../state/store'

export function useT(): Translator {
  const { state } = useStore()
  return useMemo(() => translator(state.settings.lang), [state.settings.lang])
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`switch ${on ? 'on' : ''}`}
      onClick={() => onChange(!on)}
    />
  )
}

export function ToggleRow({
  label,
  hint,
  on,
  onChange,
}: {
  label: string
  hint?: string
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="row between">
      <div className="grow">
        <div>{label}</div>
        {hint && <div className="tiny faint">{hint}</div>}
      </div>
      <Switch on={on} onChange={onChange} />
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Bar({ value, tone }: { value: number; tone?: string }) {
  return (
    <div className="bar">
      <i style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, background: tone }} />
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}

export function strengthColor(value: number): string {
  if (value >= 0.8) return 'var(--ok)'
  if (value >= 0.55) return 'var(--gold)'
  if (value >= 0.3) return 'var(--warn)'
  return 'var(--danger)'
}

/** Small circular gauge showing how solid a passage currently is. */
export function StrengthRing({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(value * 100)
  const color = strengthColor(value)
  return (
    <div
      className="strength-ring"
      title={label}
      style={{
        background: `conic-gradient(${color} ${pct * 3.6}deg, var(--s2) 0)`,
      }}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: 'var(--bg-2)',
          color,
        }}
      >
        {pct}
      </span>
    </div>
  )
}

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2>{title}</h2>
          <button className="btn sm ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
        {footer}
      </div>
    </div>
  )
}

const REPO_URL = 'https://github.com/Yacine-DH/Tathbeet'

/**
 * GitHub mark linking to the repo, with a star count fetched once and cached
 * for six hours. Offline or rate-limited, the count simply stays hidden.
 */
export function GitHubBadge() {
  const [stars, setStars] = useState<number | null>(null)

  useEffect(() => {
    const KEY = 'tathbit-gh-stars'
    try {
      const cached = JSON.parse(localStorage.getItem(KEY) ?? 'null') as {
        n: number
        at: number
      } | null
      if (cached && Date.now() - cached.at < 6 * 3_600_000) {
        setStars(cached.n)
        return
      }
    } catch {
      /* corrupt cache — refetch */
    }
    fetch('https://api.github.com/repos/Yacine-DH/Tathbeet')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { stargazers_count?: number } | null) => {
        if (typeof json?.stargazers_count !== 'number') return
        setStars(json.stargazers_count)
        try {
          localStorage.setItem(KEY, JSON.stringify({ n: json.stargazers_count, at: Date.now() }))
        } catch {
          /* storage full — count still shows this session */
        }
      })
      .catch(() => {})
  }, [])

  return (
    <a className="gh-badge" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub">
      <svg viewBox="0 0 16 16" width="17" height="17" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
        />
      </svg>
      <span>GitHub</span>
      {stars !== null && <span className="gh-stars">★ {stars}</span>}
    </a>
  )
}


export const Icon = {
  // Prayer-time glyphs: language-neutral, readable at 20px.
  dawn: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0" />
      <path d="M12 5.5V3M5.6 8.6 4.2 7.2M18.4 8.6l1.4-1.4" />
    </svg>
  ),
  sun: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </svg>
  ),
  sunLow: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="13" r="3.6" />
      <path d="M12 5.5v1.6M4.6 13H3M21 13h-1.6M6.6 7.6 5.5 6.5M17.4 7.6l1.1-1.1M3 20h18" />
    </svg>
  ),
  sunset: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0" />
      <path d="M12 3v2.5M9.5 7 12 9.5 14.5 7" />
    </svg>
  ),
  moon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </svg>
  ),
  star: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
    </svg>
  ),
  cloud: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 18a4 4 0 0 1-.4-8A6 6 0 0 1 18 9.5a3.75 3.75 0 0 1-.4 8.5z" />
      <path d="M12 12v6M9.5 15.5 12 18l2.5-2.5" />
    </svg>
  ),
  wave: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <path d="M3 12h2M8 6v12M12 3v18M16 7v10M20 11h1" />
    </svg>
  ),
  prayer: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 21v-8a8 8 0 0 1 16 0v8" />
      <path d="M2 21h20M12 5V2" />
      <circle cx="12" cy="5" r="1.4" />
    </svg>
  ),
  sliders: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  ),
  target: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  ),
  bell: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
      <path d="M10.5 20a2 2 0 0 0 3 0" />
    </svg>
  ),
  palette: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 21a9 9 0 1 1 9-9c0 2-1.6 3-3 3h-1.5a2 2 0 0 0-1.4 3.4c.4.5.4 1.3-.1 1.9-.5.5-1.3.7-2 .7z" />
      <circle cx="7.5" cy="12" r="1.1" fill="currentColor" />
      <circle cx="10" cy="8" r="1.1" fill="currentColor" />
      <circle cx="15" cy="8.5" r="1.1" fill="currentColor" />
    </svg>
  ),
  database: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <ellipse cx="12" cy="6" rx="7.5" ry="3" />
      <path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" />
      <path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
    </svg>
  ),
  chevron: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
      <path d="m9 5 7 7-7 7" />
    </svg>
  ),
  back: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="17" height="17">
      <path d="M15 5 8 12l7 7" />
    </svg>
  ),
  today: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  ),
  book: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 0-2 2z" />
      <path d="M20 5a2 2 0 0 0-2-2h-5v18h5a2 2 0 0 1 2 2z" />
    </svg>
  ),
  chart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
  gear: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.6 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H7a1.7 1.7 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V7a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
  shuffle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" width="15" height="15">
      <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
    </svg>
  ),
  check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="15" height="15">
      <path d="m5 13 4 4L19 7" />
    </svg>
  ),
  play: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
}
