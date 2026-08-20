/**
 * Downloads the Qur'an corpus + mushaf structure once and writes:
 *   public/data/ar_hafs.json    Arabic text, riwayat Hafs 'an 'Asim
 *   public/data/ar_warsh.json   Arabic text, riwayat Warsh 'an Nafi'
 *   public/data/ar_qalun.json   Arabic text, riwayat Qalun 'an Nafi'
 *   public/data/tr_fr.json      French translation, keyed by surah
 *   public/data/tr_de.json      German translation (Bubenheim & Elyas)
 *   public/data/tr_ar.json      Arabic tafsir al-Muyassar (King Fahd Complex)
 *   public/data/tr_en.json      English translation, keyed by surah
 *   public/data/translit.json   Latin transliteration, keyed by surah
 *   src/data/quranMeta.ts       surah metadata + page / juz / ruku start refs
 *
 * The Warsh and Qalun editions come from the King Fahd Complex via
 * fawazahmed0/quran-api, renumbered to the standard 6236-ayah Uthmani scheme so
 * all three riwayat share one set of ayah references.
 *
 * Run with `npm run build:data`. The generated files are committed so the app
 * works fully offline afterwards.
 */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDN = 'https://cdn.jsdelivr.net/npm/quran-json@3.1.2/dist'
const CACHE = join(root, 'node_modules', '.cache', 'quran-src')

const FAWAZ = 'https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions'

const SOURCES = {
  ar: `${CDN}/quran.json`,
  fr: `${CDN}/quran_fr.json`,
  en: `${CDN}/quran_en.json`,
  translit: `${CDN}/quran_transliteration.json`,
  meta: 'https://api.alquran.cloud/v1/meta',
  warsh: `${FAWAZ}/ara-quranwarsh.json`,
  de: `${FAWAZ}/deu-frankbubenheima.json`,
  arTafsir: `${FAWAZ}/ara-kingfahadquranc.json`,
  qalun: `${FAWAZ}/ara-quranqaloon.json`,
}

async function fetchCached(name, url) {
  const file = join(CACHE, `${name}.json`)
  try {
    await access(file)
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    process.stdout.write(`  fetching ${name}… `)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
    const json = await res.json()
    await mkdir(CACHE, { recursive: true })
    await writeFile(file, JSON.stringify(json))
    console.log('ok')
    return json
  }
}

/** `[{surah, ayah}]` -> flat `[surah, ayah]` pairs, dropping the API's extras. */
const refs = (list) => list.map((r) => [r.surah, r.ayah])

async function main() {
  console.log('Building Qur\'an data…')
  const [ar, fr, en, translit, metaRes, warshSrc, deSrc, arTafsirSrc, qalunSrc] = await Promise.all(
    Object.entries(SOURCES).map(([k, u]) => fetchCached(k, u)),
  )
  const meta = metaRes.data

  /** fawazahmed0 ships a flat verse list; fold it into `{surah: [ayah, …]}`. */
  const foldEdition = (edition) => {
    const out = {}
    for (const verse of edition.quran) {
      ;(out[verse.chapter] ??= [])[verse.verse - 1] = verse.text
    }
    return out
  }
  const warsh = foldEdition(warshSrc)
  const trDe = foldEdition(deSrc)
  const trAr = foldEdition(arTafsirSrc)
  const qalun = foldEdition(qalunSrc)

  const byId = (list) => Object.fromEntries(list.map((s) => [s.id, s]))
  const frById = byId(fr)
  const enById = byId(en)
  const trById = byId(translit)

  const text = {}
  const trFr = {}
  const trEn = {}
  const trLat = {}
  const surahs = []

  for (const s of ar) {
    text[s.id] = s.verses.map((v) => v.text)
    trFr[s.id] = frById[s.id].verses.map((v) => v.translation)
    trEn[s.id] = enById[s.id].verses.map((v) => v.translation)
    trLat[s.id] = trById[s.id].verses.map((v) => v.transliteration)
    surahs.push({
      id: s.id,
      name: s.name,
      translit: s.transliteration,
      nameEn: enById[s.id].translation,
      nameFr: frById[s.id].translation,
      revelation: s.type === 'meccan' ? 'meccan' : 'medinan',
      verses: s.total_verses,
    })
  }

  const pageStarts = refs(meta.pages.references)
  const juzStarts = refs(meta.juzs.references)
  const rukuStarts = refs(meta.rukus.references)
  const hizbStarts = refs(meta.hizbQuarters.references)

  // Absolute ayah index (1-based, 1..6236) makes range maths trivial elsewhere.
  const offsets = []
  let running = 0
  for (const s of surahs) {
    offsets.push(running)
    running += s.verses
  }
  const absolute = (surah, ayah) => offsets[surah - 1] + ayah

  // Page number for every surah, so surah pickers can show "pages 2-49".
  const pageOfAbs = (abs) => {
    let lo = 0
    let hi = pageStarts.length - 1
    let found = 0
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (absolute(pageStarts[mid][0], pageStarts[mid][1]) <= abs) {
        found = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    return found + 1
  }
  for (const s of surahs) {
    s.firstPage = pageOfAbs(absolute(s.id, 1))
    s.lastPage = pageOfAbs(absolute(s.id, s.verses))
    s.firstJuz = juzStarts.findLastIndex(
      ([su, ay]) => absolute(su, ay) <= absolute(s.id, 1),
    ) + 1
  }

  await mkdir(join(root, 'public', 'data'), { recursive: true })
  await mkdir(join(root, 'src', 'data'), { recursive: true })

  const write = async (p, data) => {
    await writeFile(p, JSON.stringify(data))
    const kb = (JSON.stringify(data).length / 1024).toFixed(0)
    console.log(`  ${p.replace(root + '\\', '').replace(root + '/', '')} (${kb} KB)`)
  }

  // Every riwayah must line up with the shared ayah numbering.
  for (const [name, corpus] of [['warsh', warsh], ['qalun', qalun], ['de', trDe], ['ar-tafsir', trAr]]) {
    for (const s of surahs) {
      const got = corpus[s.id]?.length ?? 0
      if (got !== s.verses) {
        throw new Error(`${name}: surah ${s.id} has ${got} ayahs, expected ${s.verses}`)
      }
    }
  }

  await write(join(root, 'public', 'data', 'ar_hafs.json'), text)
  await write(join(root, 'public', 'data', 'ar_warsh.json'), warsh)
  await write(join(root, 'public', 'data', 'ar_qalun.json'), qalun)
  await write(join(root, 'public', 'data', 'tr_fr.json'), trFr)
  await write(join(root, 'public', 'data', 'tr_de.json'), trDe)
  await write(join(root, 'public', 'data', 'tr_ar.json'), trAr)
  await write(join(root, 'public', 'data', 'tr_en.json'), trEn)
  await write(join(root, 'public', 'data', 'translit.json'), trLat)

  const ts = `// GENERATED by scripts/build-data.mjs — do not edit by hand.
export type Revelation = 'meccan' | 'medinan'

export interface SurahMeta {
  id: number
  /** Arabic name, e.g. الفاتحة */
  name: string
  /** Latin transliteration, e.g. Al-Fatihah */
  translit: string
  nameEn: string
  nameFr: string
  revelation: Revelation
  verses: number
  firstPage: number
  lastPage: number
  firstJuz: number
}

export const SURAHS: SurahMeta[] = ${JSON.stringify(surahs, null, 0)}

export const TOTAL_AYAHS = ${running}

/** Cumulative ayah count before each surah; index 0 is surah 1. */
export const SURAH_OFFSETS: number[] = ${JSON.stringify(offsets)}

/** Start ref [surah, ayah] of each of the 604 mushaf pages. */
export const PAGE_STARTS: [number, number][] = ${JSON.stringify(pageStarts)}

/** Start ref of each of the 30 juz. */
export const JUZ_STARTS: [number, number][] = ${JSON.stringify(juzStarts)}

/** Start ref of each of the 556 rukus (natural recitation stops). */
export const RUKU_STARTS: [number, number][] = ${JSON.stringify(rukuStarts)}

/** Start ref of each of the 240 hizb quarters. */
export const HIZB_STARTS: [number, number][] = ${JSON.stringify(hizbStarts)}
`
  await writeFile(join(root, 'src', 'data', 'quranMeta.ts'), ts)
  console.log(`  src/data/quranMeta.ts (${(ts.length / 1024).toFixed(0)} KB)`)
  console.log(`Done. ${surahs.length} surahs, ${running} ayahs.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
