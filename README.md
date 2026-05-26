# Project Hailstorm

A personal J.A.R.V.I.S. command center. The homepage (`index.html`) is a
cinematic HUD with a live arc-reactor orb; `js/live.js` feeds it real-time data.

## Live data feeds

| Feed | Source | Proxy / auth |
|------|--------|--------------|
| Weather (Norman, OK) | Open-Meteo | direct, keyless |
| Stock watchlist | Yahoo Finance | `/api/yahoo` (keyless) |
| Macro (10Y / DXY / VIX) | Treasury + Yahoo | direct + `/api/yahoo` |
| Dallas sports | ESPN | direct, keyless |
| News ticker | RSS via rss2json | direct, keyless |
| Prediction markets | Polymarket | `/api/polymarket` (keyless) |
| OU Canvas assignments | Canvas LMS | `/api/canvas-events` (`CANVAS_TOKEN`) |
| Email | SimplyHQ | `/api/simplyhq` (`SIMPLYHQ_PASSWORD`) |
| Now playing | Spotify Web API | in-browser PKCE (no secret) |

> The `/api/*` proxies only run on Vercel. Use `vercel dev` locally, or just
> deploy — opening `index.html` as a `file://` only lights up the direct feeds
> (weather, sports, news, 10Y, Spotify).

## Setup

1. Copy `.env.example` to `.env` and fill in the values (see below).
2. Set the same variables in Vercel: **Project → Settings → Environment Variables**.

| Variable | Used by | Notes |
|----------|---------|-------|
| `CANVAS_TOKEN` | `/api/canvas-events` | Canvas → Account → Settings → New Access Token |
| `SIMPLYHQ_PASSWORD` | `/api/simplyhq` | SimplyHQ portal password |

## ⚠️ Rotate leaked credentials

These secrets were previously hardcoded in client-side code and remain in git
history. They are effectively public — **rotate them now**:

- **Alpaca API key + secret** — revoke in the Alpaca dashboard. (Live streaming
  is now disabled; the ticker uses the keyless Yahoo proxy.)
- **Canvas token** — delete the old token in Canvas, generate a new one, set
  `CANVAS_TOKEN`.
- **SimplyHQ password** — change it, set `SIMPLYHQ_PASSWORD`.
