# Tathbeet · تَثْبِيت

**Your grip on what you have memorised:** each day it picks the passages to recite in your prayers,
weighted toward whatever is starting to fade. New memorisation advances at a pace you set, in your
riwayah — offline, on your device.

The name comes from *"kadhālika li-nuthabbita bihi fu'ādak"* — "so that We may make your heart firm
thereby" (25:32), the verse explaining why the Qur'an was revealed gradually rather than at once.
Spaced repetition, thirteen centuries early.

Everything runs in the browser. No account, no server: your hifz inventory, scheduling and history
live in IndexedDB on your device, and the whole Qur'an is bundled so it works offline.

## What it does

**1. You declare what you already know.** Tick whole surahs, or open one and select the exact verses
you master. Presets cover Al-Fatihah, the common short surahs, and the whole of Juz 'Amma.

**2. It cuts that into recitable passages.** Long surahs are split on mushaf page (or ruku)
boundaries; a surah short enough to recite in one rak'ah stays whole. Length is measured in mushaf
*lines*, not ayah count, so "short passage" means the same thing in Al-Baqarah and in Juz 'Amma.

**3. It suggests what to recite, prayer by prayer.** Each day you get a plan — a couple of passages
per prayer, plus free-reading suggestions. Selection is random but weighted: weak and overdue
passages float up, anything recited in the last few days is held back, and two passages from the same
surah won't land on the same day. The plan is stable for the whole day (it won't reshuffle when you
reopen the app) and there's a button to deliberately reshuffle it.

**4. It learns from how it went.** After reciting, grade yourself — *forgot / shaky / good / perfect*.
An SM-2 style scheduler adjusts the interval, and a forgetting curve turns that into a live
"strength" score per passage. Nothing goes unrevised for more than 120 days.

**5. It speaks your language.** Arabic (default, full right-to-left layout), English, German and
French — interface and verse translation both follow the choice. Arabic pairs the text with Tafsir
al-Muyassar, German with Bubenheim & Elyas.

**6. It reads in your riwayah.** Qalun 'an Nafi' (the default), Warsh 'an Nafi' or Hafs 'an 'Asim —
the displayed rasm changes with the reading, basmala included. All three editions share the standard
6236-ayah numbering, so switching riwayah never disturbs your inventory or scheduling.

**7. It recites to you.** Each passage has a player with a reciter picked from your riwayah, plus a
repeat count for drilling. Hafs and Warsh play ayah by ayah, with the sounding ayah highlighted;
Qalun is only published as whole-surah recordings, so playback starts at the top of the surah and the
app says so.

**8. It paces new memorisation.** Set a target (a surah or a juz) and a level: 1–5 ayahs a day, a page
a week, a page every 3 days, half a page a day, a full page a day, a juz a month. Page-based paces
adapt to the mushaf — a page of Al-Baqarah is ~7 long ayahs, a page of Juz 'Amma can be 30 short
ones. Confirm today's portion and it joins the review rotation with short consolidation intervals.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

```bash
npm run build      # production build into dist/
npm run preview    # serve the build
npm run dev:lan    # dev server reachable from other devices on your Wi-Fi
npm test           # domain test suite (scheduling, segmentation, pacing, engine)
npm run build:data # re-generate the Qur'an data (only needed if you change the pipeline)
```

## Putting it on your phone

The app is a PWA: install it once and it behaves like a native app, works offline and keeps your
data on the device. Nothing is ever uploaded — there is no server to upload to.

**Recommended — deploy the build, install from the phone.** A PWA can only be installed over HTTPS,
so it needs a host. Any static host works; `dist/` is a plain folder of files:

```bash
npm run build
npx vercel deploy --prod dist
```

Netlify Drop (drag `dist/` onto app.netlify.com/drop), Cloudflare Pages and GitHub Pages all work
the same way. Then open the URL on the phone and choose **Install app** (Android/Chrome) or
**Share → Add to Home Screen** (iOS/Safari). After the first launch everything but the audio works
with no connection.

**Quick look without deploying.** On the same Wi-Fi, run `npm run dev:lan` and open
`http://<your-computer-ip>:5173` on the phone. Good for trying it out, but plain HTTP means no
install and no offline mode, and the computer has to stay on.

Two notes: on iOS, reminder notifications only work from an installed PWA on iOS 16.4+; and the
Settings screen can export a backup file you can import on another device.

## Syncing between devices (optional)

Out of the box the app is local-only. Turn on sync and each person signs in with
their own Google account, gets their own private row, and the phone and laptop stay
in step. It is genuinely optional: with no keys configured, nothing about the app
changes and no network call is made.

**Revisions are merged, never overwritten.** Two devices used on the same day is the
normal case, not the edge case, so each collection is combined on its own terms:

| Data | Rule |
| --- | --- |
| Memorised ranges | union of both |
| Review schedule | whichever device graded that passage last |
| Session log, active days | union, de-duplicated |
| Day plan | the copy with more passages actually recited |
| Settings, hifz target | most recently changed device wins |
| Onboarding | done on either = done everywhere |

### Setting it up

1. Create a project at [supabase.com](https://supabase.com) (free tier is plenty).
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql). It creates the
   table and the Row Level Security policies that scope every row to its owner.
3. In **Authentication → Providers → Google**, enable Google. It asks for a client ID
   and secret from a [Google Cloud OAuth client](https://console.cloud.google.com/apis/credentials);
   add the callback URL Supabase shows you as an authorised redirect URI.
4. Copy `.env.example` to `.env` and fill in the project URL and anon key from
   **Project Settings → API**.
5. For the deployed build, add the same two values as repository secrets
   (**Settings → Secrets and variables → Actions**): `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`. The workflow already passes them to the build.

Then **Settings → Sync → Sign in with Google** on each device.

Both values are public — they ship inside the JavaScript bundle, which is how Supabase
is designed to work. Security comes from Row Level Security, not from hiding the anon
key. Never put the *service role* key in this project.

## How it is put together

| Path | Role |
| --- | --- |
| `scripts/build-data.mjs` | One-off pipeline: fetches the three riwayat, the AR/EN/DE/FR translations, transliteration and the mushaf structure, and writes `public/data/*.json` + `src/data/quranMeta.ts`. |
| `src/lib/refs.ts` | Ayah ↔ absolute index, page/juz/ruku lookups, range algebra (merge, subtract, invert). |
| `src/lib/audio.ts` | Reciter catalogue per riwayah and the URL/playlist rules behind playback. |
| `src/lib/segments.ts` | Turns the memorised inventory into recitable passages; estimates length in mushaf lines. |
| `src/lib/srs.ts` | Scheduling: ease, intervals, lapses, and the retrievability curve behind the strength score. |
| `src/lib/engine.ts` | Daily plan builder: weighted sampling, anti-repetition, per-prayer constraints with graceful relaxation when the pool is small. |
| `src/lib/hifz.ts` | Memorisation goal: targets, pace presets, daily portion, completion estimate. |
| `src/lib/storage.ts` | IndexedDB persistence (localStorage fallback), defaults, migration, backup import/export. |
| `src/lib/merge.ts` | Combines two devices' state without losing a revision — the heart of sync. |
| `src/lib/cloud.ts` | Supabase auth and state transfer; a no-op when unconfigured. |
| `src/state/store.tsx` | Reducer + a `derive` pass that keeps passages, records and today's plan consistent with the inventory. |
| `src/lib/i18n.ts` | The four interface languages, their locales and text direction. |
| `src/ui/` | Setup wizard, Today, recitation session, inventory editor, progress, settings. |

### Two details worth knowing

**Re-segmenting never loses history.** Change the splitting mode or add verses to a surah, and each
new passage inherits the scheduling record of the old passage it overlaps most.

**The plan is seeded, not stored blindly.** `(day, salt)` seeds a deterministic PRNG, so the same day
always produces the same suggestions until you reshuffle — which just bumps the salt.

**Audio is the one online part.** Everything else works offline; recitation streams from
everyayah.com (Hafs, Warsh) and mp3quran.net (Qalun), so it needs a connection.

## Data sources

Hafs text, EN/FR translations and transliteration from
[`quran-json`](https://www.npmjs.com/package/quran-json). Warsh and Qalun texts from the King Fahd
Complex, distributed via [`fawazahmed0/quran-api`](https://github.com/fawazahmed0/quran-api) with
ayah numbering aligned to the Uthmani scheme; German translation by Bubenheim & Elyas and the Arabic Tafsir al-Muyassar come from the same collection. Mushaf page, juz, ruku and hizb boundaries from the
[AlQuran Cloud](https://alquran.cloud/) metadata endpoint. All fetched once at build time and
vendored into the repo. Arabic rendering uses the bundled Amiri Quran font.

Note on pagination: the 604-page boundaries are those of the Madani Hafs mushaf. Printed Warsh and
Qalun mushafs paginate differently, so page-based splitting and page paces are an approximation for
those readings — switch passage splitting to rukus in Settings if you prefer.
