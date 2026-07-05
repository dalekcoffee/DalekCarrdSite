# ScrobblingEmbed — Unified Music + TV + Anime Card (Trakt-backed)

Sandbox clone of `MusicEmbed/` with a Trakt.tv watch section merged in. Production
(`MusicEmbed/`) is untouched — test here first, then replace the Carrd markup when happy.

## Architecture

- **Music** — unchanged from production: ListenBrainz via the existing n8n stats webhook.
- **Video (TV + anime)** — Plex scrobbles *everything* to Trakt through a new n8n
  workflow ("Plex to Trakt Scrobbler"); a second workflow ("Carrd Trakt Feed") serves
  this embed. Anime is detected from **Trakt genre tags**, not the Plex library.
  The existing Plex→AniList scrobbler keeps running unchanged — anime lands on both
  services.
- **Unified live strip** — one "Now Playing / Now Watching" strip. Music and Trakt
  (`/users/:id/watching`) poll independently; if both are live, whichever activity
  was received most recently wins.
- **Watching vs Completed is inferred from progress**: the feed compares episodes
  you've watched against episodes aired (`completed < aired` ⇒ Watching `EP 34/48`,
  otherwise Completed with your Trakt rating).
- **Posters** come from TMDB, resolved and cached inside the n8n feed — the embed
  just receives final image URLs.

## Modes & tabs

`MUSIC | TV | ANIME` switcher under the live strip. Music side is identical to
production. TV and ANIME share one tab set — **Watching** (default) | Recent |
Completed — differing only in the feed's `?media=tv|anime` param.

## Configuration (top of `scrobbling-embed.js`)

| Constant | Value |
| --- | --- |
| `N8N_NP_WEBHOOK` / `N8N_STATS_WEBHOOK` | unchanged — existing music GET webhook |
| `N8N_TRAKT_FEED_WEBHOOK` | **fill in** — GET URL of the "Carrd Trakt Feed" workflow |
| `TRAKT_USER` | `dalekcoffee` (footer link) |

Leave the Trakt URL empty and the card runs music-only (video tabs show a
"webhook not configured" empty state; the live strip just never shows video).

## n8n setup (workflows are provided separately — NOT stored in this repo)

1. Create a Trakt API app at `trakt.tv/oauth/applications` (client id/secret) and a
   free TMDB API key at `themoviedb.org` — both live only in n8n.
2. Import the two workflow JSONs (delivered outside the repo), replace the
   `REPLACE-WITH-*` placeholders (webhook paths, Trakt client id, TMDB key),
   attach the Trakt OAuth2 credential to the scrobbler's HTTP node, and activate.
3. **Plex to Trakt Scrobbler** exposes a POST webhook — add its **production** URL
   as an additional webhook in Plex (Settings → Webhooks). Plex sends every event
   to every registered URL, so the AniList scrobbler is unaffected.
4. Copy the feed's GET URL into `N8N_TRAKT_FEED_WEBHOOK`.

Notes:
- The feed reads Trakt's public user endpoints with just the client id — your
  Trakt profile (and watch history) must be set to public.
- n8n workflow static data (caches, playback progress) only persists for
  **production** executions — "Test workflow" runs won't retain state.

## Sandbox testing (`test.html`)

Serve the repo locally (`python3 -m http.server`) and open
`ScrobblingEmbed/test.html` with query params:

- `?mock=1` — fixture data, zero network. Extra knobs:
  - `&live=video|music|both|none` — which live sources report activity
  - `&newer=video|music` — who wins when both are live
- `?trakt=<feed-url>` — point at the real Trakt feed webhook
- `?music=<url>` — override the music webhook too

## Deploying to Carrd

Paste the card markup from `test.html` (everything inside `<div class="wrap">`,
minus the sandbox status bar) into the Carrd embed, and load
`scrobbling-embed.css` / `scrobbling-embed.js` from GitHub Pages.

**Do not place this card on the same page as the production music embed** — both
use the same `dkt-` element ids and would collide. This card *replaces* the music
card.
