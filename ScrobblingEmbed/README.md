# ScrobblingEmbed — Unified Music + Anime Card

Sandbox clone of `MusicEmbed/` with AniList anime scrobbling merged in. Production
(`MusicEmbed/`) is untouched — test here first, then replace the Carrd markup when happy.

## What it adds on top of the music embed

- **Unified live strip** — one "Now Playing / Now Watching" strip serves both media.
  Each source polls independently; if both are live, whichever activity was received
  most recently wins (anime carries `updated_at` from its last Plex event; music uses
  the moment its track last changed). Stop the anime, play music → strip flips to music.
- **MUSIC | ANIME switcher** under the live strip. Music side is identical to production.
  Anime side: **Watching** (default) | Recent | Completed, fed by the AniList list of
  [DalekCoffee](https://anilist.co/user/DalekCoffee/). Posters come straight from
  AniList (no cover-art fallback chain needed).

## Configuration (top of `scrobbling-embed.js`)

| Constant | Value |
| --- | --- |
| `N8N_NP_WEBHOOK` / `N8N_STATS_WEBHOOK` | unchanged — existing music GET webhook |
| `N8N_ANIME_LIVE_WEBHOOK` | **fill in** — GET URL of the "Plex Anime Live" workflow's *Embed Feed* webhook |
| `N8N_ANIME_STATS_WEBHOOK` | **fill in** — GET URL of the "Carrd AniList Stats" workflow's webhook |

Leave the anime URLs empty and the card runs music-only (anime tabs show a
"webhook not configured" empty state; the live strip just never shows anime).

## n8n setup (workflows are provided separately — NOT stored in this repo)

1. Import the two workflow JSONs (delivered outside the repo), replace the
   `REPLACE-WITH-RANDOM-UUID-*` webhook paths with random UUIDs, and activate them.
2. **Plex Anime Live** exposes a POST webhook — add its **production** URL as a
   *second* webhook in Plex (Settings → Webhooks). Plex sends every event to every
   registered URL, so the existing scrobbler workflow is unaffected.
3. Copy the two GET URLs into the config constants above.

Note: n8n workflow static data only persists for **production** (active) executions —
"Test workflow" runs won't retain live state between calls.

## Sandbox testing (`test.html`)

Serve the repo locally (`python3 -m http.server`) and open
`ScrobblingEmbed/test.html` with query params:

- `?mock=1` — fixture data, zero network. Extra knobs:
  - `&live=anime|music|both|none` — which live sources report activity
  - `&newer=anime|music` — who wins when both are live
- `?animeLive=<url>&animeStats=<url>` — point at the real n8n webhooks
- `?music=<url>` — override the music webhook too

## Deploying to Carrd

Paste the card markup from `test.html` (everything inside `<div class="wrap">`,
minus the sandbox status bar) into the Carrd embed, and load
`scrobbling-embed.css` / `scrobbling-embed.js` from GitHub Pages.

**Do not place this card on the same page as the production music embed** — both
use the same `dkt-` element ids and would collide. This card *replaces* the music
card.
