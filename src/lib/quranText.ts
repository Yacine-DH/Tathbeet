import type { Lang, Riwayah } from './types'

type Corpus = Record<string, string[]>

const cache = new Map<string, Promise<Corpus>>()

function load(file: string): Promise<Corpus> {
  let pending = cache.get(file)
  if (!pending) {
    pending = fetch(`${import.meta.env.BASE_URL}data/${file}`).then((res) => {
      if (!res.ok) throw new Error(`Cannot load ${file} (HTTP ${res.status})`)
      return res.json() as Promise<Corpus>
    })
    cache.set(file, pending)
  }
  return pending
}

export const loadArabic = (riwayah: Riwayah) => load(`ar_${riwayah}.json`)
export const loadTranslation = (lang: Lang) => load(`tr_${lang}.json`)
export const loadTransliteration = () => load('translit.json')

export interface AyahLine {
  ayah: number
  arabic: string
  translation?: string
  transliteration?: string
}

export interface PassageText {
  lines: AyahLine[]
  /** True when the passage starts a surah other than Al-Fatihah or At-Tawbah. */
  showBasmala: boolean
  /** Basmala in the active riwayah — its spelling differs between them. */
  basmala: string
}

export async function loadPassage(
  surahId: number,
  start: number,
  end: number,
  opts: { lang: Lang; riwayah: Riwayah; translation: boolean; transliteration: boolean },
): Promise<PassageText> {
  const [ar, tr, translit] = await Promise.all([
    loadArabic(opts.riwayah),
    opts.translation ? loadTranslation(opts.lang) : Promise.resolve(null),
    opts.transliteration ? loadTransliteration() : Promise.resolve(null),
  ])
  const key = String(surahId)
  const lines: AyahLine[] = []
  for (let a = start; a <= end; a++) {
    lines.push({
      ayah: a,
      arabic: ar[key]?.[a - 1] ?? '',
      translation: tr?.[key]?.[a - 1],
      transliteration: translit?.[key]?.[a - 1],
    })
  }
  return {
    lines,
    showBasmala: start === 1 && surahId !== 9 && surahId !== 1,
    basmala: ar['1']?.[0] ?? '',
  }
}

/** Basmala per riwayah — handy for previews without loading a whole corpus. */
export const BASMALA: Record<Riwayah, string> = {
  hafs: 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ',
  warsh: 'بِسْمِ اِ۬للَّهِ اِ۬لرَّحْمَٰنِ اِ۬لرَّحِيمِ',
  qalun: 'بِسْمِ اِ۬للَّهِ اِ۬لرَّحْمَٰنِ اِ۬لرَّحِيمِ',
}

/** Arabic-Indic digits for the ayah markers. */
export function arabicNumber(n: number): string {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
}
