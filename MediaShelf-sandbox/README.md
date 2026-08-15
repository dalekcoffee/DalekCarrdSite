# Dalek's Shelf — Simkl rebuild (sandbox)

Sandbox rebuild of the video half on **Simkl + Plex**, replacing the Trakt feed
that went dark. Production (`MediaShelf/`) is untouched and still runs
music-only — test here, then swap the Carrd embed when happy.

## Why this exists

Trakt limited free accounts to **one connected community app** (July 2026), and
raised VIP to $60/yr. The old feed read Trakt's public endpoints with just a
client id, and those stopped returning complete data — progress bars, ratings
and Now Watching all went stale or wrong, so `VIDEO_ENABLED` was flipped off in
production.

Simkl is the replacement: free, no app-connection limit, and it treats TV, film
and anime as equal first-class types (which the Anime / TV Shows / Movies chips
depend on). It also has a native Plex webhook and a one-shot **Trakt importer**,
so the back catalogue moves over.

## Architecture

```
                    ┌─ Simkl (history · watching · ratings · lists)
Plex ──webhook──┬──►│         ▲
                │   └─────────┼──── n8n "Carrd Media Feed" ──GET──► this embed
                │             │        ?range=watching|recent|
                └──►n8n───────┘        favorites|toprated|rated
                   (live session state)
                          └────────────────GET──────────────► ?range=now
```

Two independent paths, on purpose:

- **Simkl** backs everything historical — On Screen (Watching / Recent) and
  Ratings & Reviews. Plex posts straight to Simkl's own webhook; n8n is not in
  that write path at all.
- **Plex → n8n** backs the live **Now Watching** row. Simkl cannot do this:
  its Plex webhook only records a watch at the **90% mark**, so a Simkl-backed
  live row would light up as you finish, not as you start. Plex pushes
  `media.play` / `media.pause` / `media.resume` / `media.stop` as they happen,
  and n8n holds that as the current session.

The old "Plex to Trakt Scrobbler" workflow's Trakt write step is now dead
weight — keep the webhook receiver (it feeds the live row), drop the Trakt call.

## What changed from `MediaShelf/`

| | Production | Sandbox |
| --- | --- | --- |
| `VIDEO_ENABLED` | `false` | `true` |
| Feed constant | `N8N_TRAKT_FEED_WEBHOOK` | `N8N_MEDIA_FEED_WEBHOOK` |
| User constant | `TRAKT_USER` | `SIMKL_USER` |
| Entry link field | `traktUrl` | `simklUrl` (old names still accepted) |
| Media button | Trakt (`#9F42C6`) | Simkl (`#111827`) |
| Header source | `Trakt · ListenBrainz` | `Simkl · ListenBrainz` |
| "See More" tile | On Trakt | On Simkl |
| Sandbox param | `?trakt=` | `?feed=` (`?trakt=` still aliased) |

Rating scale is unchanged: Simkl stores 1–10 exactly as Trakt did, and the card
renders 5 stars in half-steps, so `score` carries over with no conversion.

Music (Now Playing + Top Listens, ListenBrainz via the existing webhook) is
untouched.

## Feed contract

The embed is provider-agnostic — it only knows the JSON below, so the n8n
workflow can be rebuilt on anything that produces these shapes.

### `?range=now` → live session (Plex-backed)

```json
{ "watching": true, "type": "episode", "title": "Frieren: Beyond Journey's End",
  "season": 1, "episode": 18, "episodeTitle": "The Land Where Souls Rest",
  "totalEpisodes": 28, "poster": "https://…", "isAnime": true,
  "simklUrl": "https://simkl.com/tv/…", "imdbUrl": "https://…",
  "updated_at": 1755240000 }
```

`watching: false` (or any falsey/empty body) clears the row. `updated_at` is
what decides music-vs-video when both are live — most recent activity wins — so
it must move on every play/resume.

### `?range=watching` · `recent` · `favorites` · `toprated` · `rated`

All return `{ "entries": [ … ] }`. Fields per entry:

| Field | Used by | Notes |
| --- | --- | --- |
| `title` | all | required |
| `poster` | all | direct image URL (TMDB); blank → hatch tile |
| `kind` | all | `ANIME` / `SERIES` / `FILM` — shown in meta |
| `isAnime` | all | drives the Anime chip + Crunchyroll button |
| `type` | recent | `movie` or `episode` |
| `epWatched` / `epTotal` | watching, recent | watched vs **aired** episodes |
| `season` / `number` | recent | episode coordinates |
| `episodeTitle` | recent | optional |
| `watchedAt` | recent | unix s/ms or ISO |
| `updatedAt` | watching | unix s/ms or ISO |
| `score` | ratings tabs | 1–10 |
| `meta` | ratings tabs | e.g. `ANIME · 26 EP` |
| `note` | ratings tabs | memo/review text; `[spoiler]…[/spoiler]` supported |
| `noteDate` | ratings tabs | display string |
| `noteSpoiler` | ratings tabs | `true` blurs the whole note |
| `simklUrl` / `imdbUrl` | all | button targets; fall back to search |

snake_case is accepted for every camelCase field (`ep_watched`, `watched_at`,
`note_spoiler`, …) — see `FIELD_ALIASES` in the JS.

**Watching must list every show with `epWatched < epTotal`.** Recent leans on
that: a series in Recent that is *absent* from Watching is treated as finished
and gets a full bar. If Watching is partial, finished shows will read as
"unknown progress" instead.

## Simkl setup

1. Create an app at Simkl's developer settings → note the **client id** and
   **client secret**.
2. Authorize once (PIN flow is easiest from n8n) and store the token. Simkl
   access tokens are long-lived — they advertise a 5-year `expires_in` and in
   practice stay valid until you revoke the app — so no refresh step is needed.
3. **Import from Trakt** at `simkl.com/apps/import/trakt/` — watch history,
   ratings and watchlist. One-way; do it before switching the write path.
4. Add the **Plex webhook** from `simkl.com/apps/plex/` to your Plex webhooks
   list (requires Plex Pass, which you already have — Plex webhooks are a Pass
   feature). Keep your existing n8n webhook alongside it; Plex supports several.
5. Point `N8N_MEDIA_FEED_WEBHOOK` at the new feed workflow's **production** GET
   URL.

> Endpoint paths and exact response shapes live at **api.simkl.org** — that host
> was unreachable from the machine this was built on, so the n8n side needs to be
> mapped against the live docs. Everything above the feed boundary (the JSON
> contract) is verified against this code; the Simkl-call side is not.

## Known gaps

- **Live row needs the Plex webhook path kept alive.** If you retire the n8n
  scrobbler entirely, Now Watching goes permanently idle and the card silently
  falls back to music-only. It won't error — it just never lights up.
- **Plex `viewOffset`** is present in webhook payloads but is reportedly
  unreliable on replay-from-start (reads as a resume). The live row doesn't
  render a progress bar today, so this doesn't bite — but don't build one on
  `viewOffset` alone without checking.
- **Simkl brand hex** on the media button is a placeholder near-black
  (`#111827`); confirm against Simkl's current brand color before production.
- **Anime detection** moves from Trakt genre tags to Simkl's type/genre data —
  worth spot-checking that anime films still land in both Anime and Movies.
- **Manual Plex marks don't scrobble.** Plex only fires webhooks on real
  playback; marking watched in the UI syncs nowhere.

## Sandbox testing

```bash
python3 -m http.server 8000
# → http://localhost:8000/MediaShelf-sandbox/test.html?mock=1&live=video
```

- `?mock=1` — fixtures, zero network
  - `&live=video|music|both|none` — which sources report activity
  - `&newer=video|music` — who wins when both are live
- `?feed=<url>` / `&music=<url>` — point at real webhooks

Verified in this sandbox with `?mock=1`: all five sections render, Watching and
Recent strips populate (Recent caps at 10 + "On Simkl" tile), progress bars and
percentages compute, ratings render as half-step stars, and both spoiler modes
(whole-note `noteSpoiler` and inline `[spoiler]` segments) blur and reveal.

## Deploying to a sandbox Carrd page

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@500;600;700&family=Space+Mono:wght@400;700&family=Space+Grotesk:wght@400;500&display=swap">
<link rel="stylesheet" href="https://dalekcoffee.github.io/DalekCarrdSite/MediaShelf-sandbox/media-shelf.css">
<div id="dks-shelf"></div>
<script src="https://dalekcoffee.github.io/DalekCarrdSite/MediaShelf-sandbox/media-shelf.js"></script>
```

Put this on a **test Carrd page**, not the live one — don't run it on the same
page as the production shelf. Until the n8n feed exists, the video sections show
"Nothing here yet" and the live row stays on music; that's the expected
pre-wiring state, not a bug.

## Promoting to production

Copy `media-shelf.js` / `media-shelf.css` over `MediaShelf/`, keep the
production Carrd embed URLs as they are, and the swap is invisible to the page.
