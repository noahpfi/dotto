# dotto

Browser game: stare at a dot, tap when it goes hollow.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # no browser needed
npm run build    # tsc --noEmit, vite build, scripts/check-bundle.mjs
```

Static output in `dist/`.

## Gameplay

Every 16–65s, level-dependent, dot goes hollow; player has 2.2–3s to tap. Tapping at any other time, missing, or leaving screen ends run.

## Levels

| | | |
|---|---|---|
| | **47s** | average screen dwell, reference only |
| 1 | 1:00 | |
| 2 | 2:30 | |
| 3 | 5:00 | |
| 4 | 10:00 | |
| 5 | 20:00 | |

Sources in `src/benchmarks.ts`; each entry cites a named study.

## Prediction

On `ask` arm of a 50/50 session split, player guesses hold time before first run; guess is stored in `sessionStorage` and shown on result screens.

A guess longer than chosen level raises that run to match (`levelForPrediction`); later runs use any level.

## Result chart

1. Lognormal dwell curve from mean 47s, median 40s.
2. dotto-players band, p10–p90 from `VITE_STATS_ENDPOINT`, hidden below 50 samples.
3. Player's run.

X-axis is logarithmic.

## Daily and dares

Level 0 is daily dot, one schedule per UTC day seeded from date, same worldwide.

Dare links on `/d` carry target time, level, chain hop and day as query integers. `api/dare.ts` rewrites og tags per dare for chat link previews.

## Code layout

```
src/engine/     pure logic, clock and RNG injected
  gauntlet.ts   run state machine
  rng.ts        seedable mulberry32
src/benchmarks.ts  cited figures, lognormal fit
src/stats.ts    dotto-players band data
src/prediction.ts  session guess
src/levels.ts   levels
src/copy.ts     user-facing strings
src/storage.ts  localStorage save
src/daily.ts    daily seed
src/dare.ts     dare link parse and build
src/analytics/  PostHog, Meta Pixel, geo gate
src/ui/         DOM
api/dare.ts     per-dare og tags, edge
api/geo.ts      country verdict for pixel gate, edge
scripts/check-bundle.mjs  fails build if env data leaks into dist
```

## Analytics

PostHog, EU host, memory persistence, no cookies, autocapture off.

Meta Pixel loads only for US / CA / AU, gated by `api/geo.ts`.

`api_host` is `/ingest`, proxied by `vercel.json` and vite; leave `VITE_POSTHOG_HOST` unset.

## Icons

`node scripts/make-icons.mjs` regenerates `public/` icons and `og.png`.

## Deploy

`vercel.json` sets build, `dist` output, caching and security headers.

Set `.env.example` variables in Vercel; `VITE_*` values are inlined at build.

## Configuration

Copy `.env.example` to `.env`. All optional.

| Variable | Unset behaviour |
| --- | --- |
| `VITE_POSTHOG_KEY` | No analytics. |
| `VITE_SHARE_URL` | Share text uses `window.location.origin`. |
| `VITE_WAITLIST_ENDPOINT` | "I want the app" shows app-not-out text instead of email field. |
| `VITE_TRACK_ENDPOINT` | No sendBeacon copy of events. |
| `VITE_STATS_ENDPOINT` | Chart omits dotto-players band. |
| `VITE_META_PIXEL_ID` | No pixel. |

`VITE_STATS_ENDPOINT` returns `{ sampleSize: number, buckets: [{ upToMs: number, count: number }] }` for `GET <endpoint>?level=<id>`.

Stored on device: `dotto.v1` in localStorage, `dotto.prediction` and `dotto.predictionArm` in sessionStorage.

