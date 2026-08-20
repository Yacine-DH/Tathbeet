import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { findReciter, playlistFor, type Reciter } from '../lib/audio'
import type { Range } from '../lib/refs'
import type { AudioSettings } from '../lib/types'

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

export interface Player {
  status: PlayerStatus
  reciter: Reciter | undefined
  /** Ayah currently sounding, or null. Always the surah start for surah files. */
  currentAyah: number | null
  /** Which pass through the passage we are on, 1-based. */
  pass: number
  toggle: () => void
  stop: () => void
  error: string | null
}

/** The loop steps the session control cycles through; 0 = forever. */
export const LOOP_STEPS = [1, 3, 5, 10, 0] as const

/**
 * Plays a passage with the configured reciter. Ayah-by-ayah reciters get a real
 * playlist (and can repeat the passage); whole-surah reciters play their single
 * file, which necessarily starts at the top of the surah.
 */
export function usePassagePlayer(range: Range, audio: AudioSettings): Player {
  const reciter = useMemo(() => findReciter(audio.reciterId), [audio.reciterId])
  const playlist = useMemo(
    () => (reciter ? playlistFor(reciter, range.surah, range.start, range.end) : []),
    [reciter, range.surah, range.start, range.end],
  )

  const elementRef = useRef<HTMLAudioElement | null>(null)
  const indexRef = useRef(0)
  const passRef = useRef(1)

  const [status, setStatus] = useState<PlayerStatus>('idle')
  const [currentAyah, setCurrentAyah] = useState<number | null>(null)
  const [pass, setPass] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const element = () => {
    if (!elementRef.current) elementRef.current = new Audio()
    return elementRef.current
  }

  const playIndex = useCallback(
    (index: number) => {
      const entry = playlist[index]
      if (!entry) return
      const el = element()
      indexRef.current = index
      setCurrentAyah(entry.ayah)
      setStatus('loading')
      el.src = entry.url
      el.play().catch(() => {
        setStatus('error')
        setError('audio')
      })
    },
    [playlist],
  )

  const stop = useCallback(() => {
    const el = elementRef.current
    if (el) {
      el.pause()
      el.removeAttribute('src')
    }
    indexRef.current = 0
    passRef.current = 1
    setPass(1)
    setCurrentAyah(null)
    setStatus('idle')
  }, [])

  const toggle = useCallback(() => {
    const el = element()
    if (status === 'playing' || status === 'loading') {
      el.pause()
      setStatus('paused')
      return
    }
    if (status === 'paused' && el.src) {
      void el.play()
      return
    }
    setError(null)
    passRef.current = 1
    setPass(1)
    playIndex(0)
  }, [status, playIndex])

  // Wire the element's events once; handlers read the latest refs.
  useEffect(() => {
    const el = element()
    const onPlaying = () => setStatus('playing')
    const onPause = () => setStatus((s) => (s === 'playing' || s === 'loading' ? 'paused' : s))
    const onError = () => {
      setStatus('error')
      setError('audio')
    }
    const onEnded = () => {
      const next = indexRef.current + 1
      if (next < playlist.length) {
        playIndex(next)
        return
      }
      // repeat <= 0 = loop forever (drill mode); otherwise a fixed pass count.
      if (audio.repeat <= 0 || passRef.current < audio.repeat) {
        passRef.current += 1
        setPass(passRef.current)
        playIndex(0)
        return
      }
      stop()
    }

    el.addEventListener('playing', onPlaying)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    el.addEventListener('error', onError)
    return () => {
      el.removeEventListener('playing', onPlaying)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('error', onError)
    }
  }, [playlist, playIndex, stop, audio.repeat])

  // Changing passage (or reciter) resets playback.
  useEffect(() => {
    stop()
  }, [range.surah, range.start, range.end, audio.reciterId, stop])

  // Never leave audio running behind a closed session.
  useEffect(
    () => () => {
      const el = elementRef.current
      if (el) {
        el.pause()
        el.removeAttribute('src')
      }
    },
    [],
  )

  return { status, reciter, currentAyah, pass, toggle, stop, error }
}
