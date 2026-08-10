# dotto

Browser game: stare at a dot, tap when it goes hollow.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # no browser needed
npm run build    # tsc --noEmit && vite build
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
src/ui/         DOM
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
| `VITE_SHARE_URL` | Share text uses `window.location.origin`. |
| `VITE_WAITLIST_ENDPOINT` | "I want the app" shows app-not-out text instead of email field. |
| `VITE_TRACK_ENDPOINT` | `track()` no-ops. |
| `VITE_STATS_ENDPOINT` | Chart omits dotto-players band. |
| `VITE_META_PIXEL_ID` | No pixel. |

`VITE_STATS_ENDPOINT` returns `{ sampleSize: number, buckets: [{ upToMs: number, count: number }] }` for `GET <endpoint>?level=<id>`.

Only stored data is local save under `dotto.v1`.

