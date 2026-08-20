import type { Riwayah } from './types'

export interface Reciter {
  id: string
  /** Latin name shown in the picker. */
  name: string
  nameAr: string
  riwayah: Riwayah
  /**
   * `ayah` — one file per ayah, so a passage can start anywhere.
   * `surah` — one file per surah; playback necessarily starts at ayah 1.
   */
  granularity: 'ayah' | 'surah'
  base: string
}

const everyayah = (folder: string) => `https://everyayah.com/data/${folder}/`

/**
 * Ayah-by-ayah recitations come from everyayah.com; Qalun is only published as
 * whole-surah files (mp3quran.net), which is why it is marked `surah`.
 */
export const RECITERS: Reciter[] = [
  // ---- Hafs 'an 'Asim ----
  {
    id: 'hafs-alafasy',
    name: 'Mishary Rashid Al-Afasy',
    nameAr: 'مشاري راشد العفاسي',
    riwayah: 'hafs',
    granularity: 'ayah',
    base: everyayah('Alafasy_128kbps'),
  },
  {
    id: 'hafs-husary',
    name: 'Mahmoud Khalil Al-Husary',
    nameAr: 'محمود خليل الحصري',
    riwayah: 'hafs',
    granularity: 'ayah',
    base: everyayah('Husary_128kbps'),
  },
  {
    id: 'hafs-abdulbasit',
    name: 'Abdul Basit (murattal)',
    nameAr: 'عبد الباسط عبد الصمد',
    riwayah: 'hafs',
    granularity: 'ayah',
    base: everyayah('Abdul_Basit_Murattal_192kbps'),
  },
  {
    id: 'hafs-minshawi',
    name: 'Mohamed Siddiq Al-Minshawi',
    nameAr: 'محمد صديق المنشاوي',
    riwayah: 'hafs',
    granularity: 'ayah',
    base: everyayah('Minshawy_Murattal_128kbps'),
  },
  {
    id: 'hafs-sudais',
    name: 'Abdurrahman As-Sudais',
    nameAr: 'عبد الرحمن السديس',
    riwayah: 'hafs',
    granularity: 'ayah',
    base: everyayah('Abdurrahmaan_As-Sudais_192kbps'),
  },

  // ---- Warsh 'an Nafi' ----
  {
    id: 'warsh-dosary',
    name: 'Ibrahim Al-Dosary',
    nameAr: 'إبراهيم الدوسري',
    riwayah: 'warsh',
    granularity: 'ayah',
    base: everyayah('warsh/warsh_ibrahim_aldosary_128kbps'),
  },
  {
    id: 'warsh-jazaery',
    name: 'Yassin Al-Jazaery',
    nameAr: 'ياسين الجزائري',
    riwayah: 'warsh',
    granularity: 'ayah',
    base: everyayah('warsh/warsh_yassin_al_jazaery_64kbps'),
  },
  {
    id: 'warsh-abdulbasit',
    name: 'Abdul Basit (Warsh)',
    nameAr: 'عبد الباسط عبد الصمد',
    riwayah: 'warsh',
    granularity: 'ayah',
    base: everyayah('warsh/warsh_Abdul_Basit_128kbps'),
  },

  // ---- Qalun 'an Nafi' ----
  {
    id: 'qalun-husary',
    name: 'Mahmoud Khalil Al-Husary',
    nameAr: 'محمود خليل الحصري',
    riwayah: 'qalun',
    granularity: 'surah',
    base: 'https://server13.mp3quran.net/husr/Rewayat-Qalon-A-n-Nafi/',
  },
  {
    id: 'qalun-trabulsi',
    name: 'Ahmad Al-Trabulsi',
    nameAr: 'أحمد الطرابلسي',
    riwayah: 'qalun',
    granularity: 'surah',
    base: 'https://server10.mp3quran.net/trablsi/',
  },
  {
    id: 'qalun-dokali',
    name: 'Al-Dukali Muhammad Al-Alim',
    nameAr: 'الدوكالي محمد العالم',
    riwayah: 'qalun',
    granularity: 'surah',
    base: 'https://server7.mp3quran.net/dokali/',
  },
  {
    id: 'qalun-daoub',
    name: 'Tareq Abdul-Ghani Daoub',
    nameAr: 'طارق عبد الغني دعوب',
    riwayah: 'qalun',
    granularity: 'surah',
    base: 'https://server10.mp3quran.net/tareq/',
  },
  {
    id: 'qalun-akri',
    name: 'Marwan Al-Akri',
    nameAr: 'مروان العكري',
    riwayah: 'qalun',
    granularity: 'surah',
    base: 'https://server16.mp3quran.net/m_akri/Rewayat-Qalon-A-n-Nafi/',
  },
  {
    id: 'qalun-deban',
    name: 'Ahmed Deban',
    nameAr: 'أحمد ديبان',
    riwayah: 'qalun',
    granularity: 'surah',
    base: 'https://server16.mp3quran.net/deban/Rewayat-Qalon-A-n-Nafi/',
  },
  {
    id: 'qalun-sneineh',
    name: 'Muhammad Abu Sneineh',
    nameAr: 'محمد أبو سنينة',
    riwayah: 'qalun',
    granularity: 'surah',
    base: 'https://server16.mp3quran.net/sneineh/Rewayat-Qalon-A-n-Nafi/',
  },
  {
    id: 'qalun-qeniwa',
    name: 'Muhammad Al-Amin Qeniwa',
    nameAr: 'محمد الأمين قنيوة',
    riwayah: 'qalun',
    granularity: 'surah',
    base: 'https://server16.mp3quran.net/qeniwa/Rewayat-Qalon-A-n-Nafi/',
  },
]

const pad3 = (n: number) => String(n).padStart(3, '0')

export function recitersFor(riwayah: Riwayah): Reciter[] {
  return RECITERS.filter((r) => r.riwayah === riwayah)
}

export function findReciter(id: string): Reciter | undefined {
  return RECITERS.find((r) => r.id === id)
}

/** The reciter to fall back to when the riwayah changes. */
export function defaultReciter(riwayah: Riwayah): Reciter {
  return recitersFor(riwayah)[0] ?? RECITERS[0]
}

export function ayahUrl(reciter: Reciter, surah: number, ayah: number): string {
  if (reciter.granularity === 'surah') return `${reciter.base}${pad3(surah)}.mp3`
  return `${reciter.base}${pad3(surah)}${pad3(ayah)}.mp3`
}

export function surahUrl(reciter: Reciter, surah: number): string {
  return `${reciter.base}${pad3(surah)}.mp3`
}

/**
 * The list of files to play for a passage. Surah-granularity reciters yield a
 * single file that necessarily starts at the beginning of the surah.
 */
export function playlistFor(
  reciter: Reciter,
  surah: number,
  start: number,
  end: number,
): { url: string; ayah: number }[] {
  if (reciter.granularity === 'surah') return [{ url: surahUrl(reciter, surah), ayah: 1 }]
  const out: { url: string; ayah: number }[] = []
  for (let ayah = start; ayah <= end; ayah++) out.push({ url: ayahUrl(reciter, surah, ayah), ayah })
  return out
}

export const RIWAYAT: { id: Riwayah; name: string; nameAr: string }[] = [
  { id: 'qalun', name: "Qalun 'an Nafi'", nameAr: 'قالون عن نافع' },
  { id: 'warsh', name: "Warsh 'an Nafi'", nameAr: 'ورش عن نافع' },
  { id: 'hafs', name: "Hafs 'an 'Asim", nameAr: 'حفص عن عاصم' },
]
