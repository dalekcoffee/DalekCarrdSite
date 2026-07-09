# Dalek's Shelf — Unified Music + Watch Embed (Trakt-backed)

Sandbox implementation of the hi-fi "Dalek's Shelf" design (from the
`design_handoff_media_embed` handoff) on the Trakt/n8n architecture. Production
(`MusicEmbed/`) is untouched — test here first, then replace the Carrd embed
when happy.

## Sections (one 720px card, top to bottom)

1. **Header** — "Dalek's Shelf" · "Trakt · ListenBrainz".
2. **Now Playing** — collapsible; unified across media: shows the live music
   track *or* the live Trakt session ("NOW WATCHING" + media buttons),
   whichever activity was received most recently. Muted "Nothing Playing" row
   when idle.
3. **Top Listens** — Month / Year (default) / All Time tabs from the existing
   music webhook; scrollable ranked list; hover a row for platform buttons.
   Album art via CoverArtArchive → Deezer → iTunes (hatch tile fallback).
4. **On Screen** — two tabs: **Watching** (Trakt poster strip with EP x/n + % +
   progress bar; watching = shows where episodes watched < episodes aired) and
   **Recent** (the 10 most recent watches). Hovering a poster rings it, slides
   the accent caret, and fills the detail panel. Recent posters and their detail
   panel now carry the same episode progress bar (`epWatched` / `epTotal` from
   the feed), so a full bar reads "finished" and a partial + stale timestamp
   reads "dropped"; movies and shows with no known total omit the bar. The 11th
   Recent tile is a **See More** card linking to your Trakt history
   (`trakt.tv/users/<user>/history`).
5. **Best Of** — two tabs: **Favorites** (Trakt's heart-icon Favorites list,
   in your curated order) and **Top Rated** (everything rated ≥ `favMinRating`,
   highest score then most recently rated). Detail panel shows literal star
   glyphs (Trakt's 5-star half-step scale), meta, and a note row (up to 4
   lines) fed by your Trakt notes or reviews.

Anime is detected from Trakt genre tags; anime items add a Crunchyroll button
to the media set (YouTube · IMDb · Trakt). Accent color is a single CSS var
(`--dks-accent`, currently white) in `media-shelf.css`.

## Configuration (top of `media-shelf.js`)

| Constant | Value |
| --- | --- |
| `N8N_NP_WEBHOOK` / `N8N_STATS_WEBHOOK` | unchanged — existing music GET webhook |
| `N8N_TRAKT_FEED_WEBHOOK` | **fill in** — GET URL of the "Carrd Trakt Feed" workflow |

Feed ranges: `?range=now` (live session) · `?range=watching` · `?range=favorites`.
Leave the Trakt URL empty and the card runs music-only.

## n8n setup (workflows are provided separately — NOT stored in this repo)

1. Create a Trakt API app (`trakt.tv/oauth/applications`) and a free TMDB API
   key (`themoviedb.org`) — both live only in n8n.
2. Import the two workflow JSONs (delivered outside the repo), replace the
   `REPLACE-WITH-*` placeholders, attach the Trakt OAuth2 credential to the
   scrobbler's HTTP node, and activate.
3. **Plex to Trakt Scrobbler** exposes a POST webhook — add its **production**
   URL as an additional webhook in Plex. The AniList scrobbler is unaffected
   (anime scrobbles to both services).
4. Copy the feed's GET URL into `N8N_TRAKT_FEED_WEBHOOK`.

Notes:
- The feed reads Trakt public endpoints with just the client id — your Trakt
  profile must be public.
- n8n static data (caches, playback progress) persists only on **production**
  executions.

## Sandbox testing (`test.html`)

Serve the repo locally (`python3 -m http.server`) and open
`MediaShelf/test.html`:

- `?mock=1` — fixture data, zero network:
  - `&live=video|music|both|none` — which live sources report activity
  - `&newer=video|music` — who wins when both are live
- `?trakt=<feed-url>` / `&music=<url>` — point at real webhooks

## Deploying to Carrd

Paste into a Carrd embed:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@500;600;700&family=Space+Mono:wght@400;700&family=Space+Grotesk:wght@400;500&display=swap">
<link rel="stylesheet" href="https://dalekcoffee.github.io/DalekCarrdSite/MediaShelf/media-shelf.css">
<div id="dks-shelf"></div>
<script src="https://dalekcoffee.github.io/DalekCarrdSite/MediaShelf/media-shelf.js"></script>
```

The script renders the entire shelf into `#dks-shelf`. This card replaces the
production music embed — don't run both on the same page.
