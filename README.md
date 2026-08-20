# Tathbeet · تَثْبِيت

**Your grip on what you have memorised.** Each day it picks the passages to recite in your
prayers, weighted toward whatever is starting to fade, and paces new memorisation at a speed
you choose. Local-first PWA: your data lives on your device, the whole Qur'an is bundled, and
everything except audio works offline.

The name is from *"so that We may make your heart firm thereby"* (25:32) — the verse on why
the Qur'an came down gradually. Spaced repetition, thirteen centuries early.

## Features

- **Declare what you know** — whole surahs or exact verse ranges, with presets (Juz 'Amma, common surahs).
- **Daily plan per prayer** — weighted random: weak and overdue passages float up, recent ones are held back, no two passages from one surah per day. Stable all day; reshuffle on demand.
- **Grade yourself** — *forgot / shaky / good / perfect* drives an SM-2 style scheduler and a live strength score per passage.
- **Three riwayat** — Qalun (default), Warsh, Hafs; the rasm follows your reading, ayah numbering stays shared.
- **Recitation audio** — reciters per riwayah, repeat count, ayah highlighting (Hafs/Warsh are ayah-by-ayah; Qalun is published per surah).
- **Four languages** — Arabic (RTL, default), English, German, French; translation follows the interface language.
- **Paced hifz goal** — 1–5 ayahs/day up to a page/day or a juz/month, page-aware, with a finish estimate.
- **Optional sync** — sign in with Google and devices merge (see below).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

`npm test` runs the domain suite; `npm run build` outputs `dist/`; `npm run dev:lan` exposes
the dev server on your Wi-Fi; `npm run build:data` regenerates the Qur'an data.

## On your phone

Deploy `dist/` to any static HTTPS host (GitHub Pages workflow included — this repo deploys to
`https://yacine-dh.github.io/Tathbeet/`). Open the URL on the phone → **Install app**
(Android/Chrome) or **Share → Add to Home Screen** (iOS). Runs offline after first launch.

## Sync (optional)

Without keys the app is purely local. With a free [Supabase](https://supabase.com) project,
each user signs in with Google and gets a private row (Row Level Security). Devices are
**merged, never overwritten**: memorised ranges union, each passage's schedule comes from the
device that graded it last, logs union, and single-valued settings take the latest edit.

Setup: run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor, enable the Google
provider (Client ID/Secret from a Google Cloud OAuth client), set Site + redirect URLs, then
put the project URL and publishable key in `.env` (see `.env.example`) and as the repo secrets
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Both values are public by design; never use
the secret/service-role key here.

## Code map

`src/lib/` holds the domain: `refs` (ayah maths), `segments` (passage splitting),
`srs` (scheduling), `engine` (daily plan), `hifz` (goal pacing), `merge` + `cloud` (sync),
`audio`, `i18n`, `storage`. `src/state/store.tsx` ties it together; `src/ui/` is the screens;
`scripts/build-data.mjs` regenerates `public/data/`.

Worth knowing: re-segmenting inherits scheduling history from overlapping passages, and the
daily plan is seeded by `(day, salt)` so it stays stable until you reshuffle.

## Data sources

Hafs text, EN/FR translations and transliteration from
[`quran-json`](https://www.npmjs.com/package/quran-json); Warsh and Qalun texts (King Fahd
Complex), the German translation (Bubenheim & Elyas) and Tafsir al-Muyassar via
[`fawazahmed0/quran-api`](https://github.com/fawazahmed0/quran-api); mushaf structure from
[AlQuran Cloud](https://alquran.cloud/). All vendored at build time. Note: page boundaries are
the Madani Hafs mushaf's — an approximation for Warsh/Qalun prints; ruku splitting is available
in Settings.
