# Dalek's Shelf — Unified Music + Watch Embed (Simkl + Plex)

The live embed on dalek.coffee. Music comes from ListenBrainz, the video half
from Simkl, and the live "Now Watching" row straight from Plex — all via n8n.

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

## What changed from the Trakt version

| | Trakt (old) | Simkl (now) |
| --- | --- | --- |
| Feed constant | `N8N_TRAKT_FEED_WEBHOOK` | `N8N_MEDIA_FEED_WEBHOOK` |
| User constant | `TRAKT_USER` | `SIMKL_USER` |
| Entry link field | `traktUrl` | `simklUrl` (old names still accepted) |
| Media button | Trakt (`#9F42C6`) | Simkl (`#111827`) |
| Header source | `Trakt · ListenBrainz` | `Simkl · ListenBrainz` |
| "See More" tile | On Trakt | On Simkl |
| Test param | `?trakt=` | `?feed=` (`?trakt=` still aliased) |

Ratings are shown on Simkl's own **1–10** scale — `9/10` in the detail panel,
`★9` on the poster badge. The Trakt-era card halved the score into five star
glyphs, so a 9 rendered as 4½ stars and disagreed with what Simkl displays.

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
| `poster` | all | direct image URL (Simkl art, TMDB fallback); blank → hatch tile |
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

## n8n workflows

Both workflows change. **The workflow JSON is deliberately not stored in this
repo** — it lives only in n8n, same as the Trakt-era workflows it replaces. What
follows is the design they implement, which is what the embed actually depends
on; the feed contract above is the real interface between the two.

| Old | New | What happened |
| --- | --- | --- |
| `Plex to Trakt Scrobbler` | `Plex Live Session` | Stops writing to any tracker — Plex posts straight to Simkl's webhook. Now only tracks the live session and expires the feed cache. |
| `Carrd Trakt Feed` | `Carrd Media Feed` | Every range re-sourced from Simkl; `?range=now` becomes push-driven. |

The one structurally new piece: **n8n static data is per-workflow**, so the
live session the Plex workflow tracks can't be written into the feed workflow's
storage directly. The Plex workflow calls the feed as a **sub-workflow**
(Execute Workflow node) — running in-process there is what puts it inside the
feed's static data, which is what `?range=now` reads.

Deliberately not HTTP. An earlier revision POSTed to the feed's own webhook and
it went wrong in three separate ways: the public domain hung from inside the
container (NAT hairpinning), loopback needed port 443 rather than the `5678/tcp`
`docker ps` advertises, and the POST then returned `200` with an empty body
while storing nothing. A sub-workflow call has no URL, port, proxy, webhook
method or self-call deadlock to get wrong. Neither workflow makes a single HTTP
request now.

The feed therefore has two entry points: the **Webhook** (GET, serves the
embed) and **Called by Plex Live Session** (Execute Workflow trigger). Both feed
`Config`, and a `mode` check routes sub-workflow calls to `Apply Live Session` —
which never reaches `Respond`, since there's no HTTP response to send.

`mode` takes two values: `now` stores the current session, and `flush` zeroes
the derived caches' timestamps after Simkl records a watch, so the next embed
request re-syncs.

Dropped along the way: the Trakt OAuth credential, the `/scrobble/*` HTTP node,
all three internal HTTP calls and the Wait node, the `extended=progress` /
`extended=full` fallback dance on watched shows, and the per-show genre lookup
that anime detection needed (Simkl keeps anime as its own type, so `isAnime`
comes free from which array the row arrived in).

### Wiring the two together

The Execute Workflow nodes reference the feed workflow by an ID each n8n
instance assigns, so it can never be baked into an export. In the Plex workflow,
open **Push Live Session** and **Expire Feed Cache** and pick *Carrd Media Feed*
from the dropdown — the feed workflow has to exist first.

## How the feed talks to Simkl

Simkl's docs are blunt about bulk syncing:

> Always use `date_from` to sync only small changes. **If you don't follow these
> rules, your client_id will be suspended.**

So the feed never bulk-refetches. Every request:

1. hits `/sync/activities` — cheap, and the response's `all` timestamp says
   whether anything moved at all;
2. if nothing changed, serves the local mirror and stops there (one request);
3. if it did, pulls only the delta via `/sync/all-items/?date_from=…`;
4. merges into a mirror held in workflow static data.

All six ranges derive from that one mirror — `/sync/all-items` carries
`user_rating` and `user_rated_at` per item, so ratings need no separate call.
A `removed_from_list` change forces one full resync, since deletions can't
appear in a `date_from` delta.

**Favorites works differently to Trakt.** Simkl has no heart-list, and custom
lists are still marked *IN DEV* in the API, so the three ratings tabs split the
scale instead — no overlap, no extra requests:

| Tab | Rule |
| --- | --- |
| Favorites | rating = 10 |
| Top Rated | `favMinRating` … 9 |
| All Others | rated below `favMinRating` |

Notes come from Simkl **memos** (`memos=yes`), whose spoiler flag drives the
card's blur — the same field the old Trakt comment spoiler flag fed.

**Posters come from Simkl's own art**, built as
`https://wsrv.nl/?url=https://simkl.in/posters/{poster}_ca.webp` (190×279, the
tile size; Simkl asks that images go via wsrv.nl to spare their servers). Anime
frequently carries no TMDB id — often just `simkl`/`imdb`/`mal` — which is why a
TMDB-only lookup left most anime tiles blank. TMDB remains a fallback.

**Anime seasons are grouped into one card.** Simkl's anime database is
AniDB-derived, so *Mob Psycho 100*, *II* and *III* are three separate titles,
where Trakt's TVDB nested them as seasons of one show. Grouping merges them on
the shared TVDB id: episodes sum (32/37), the highest season rating wins, and
the card links to the show under its base title.

## Simkl setup

1. Create an app at **simkl.com/settings/developer/new/**. Click the app name
   afterwards to reveal the client id and secret — they're hidden until you do.
2. Get an access token once, either flow:
   - **PIN** — `GET /oauth/pin?client_id=…` → enter the code at `simkl.com/pin/`
     → poll `GET /oauth/pin/{USER_CODE}?client_id=…`. No redirect needed.
   - **Code** — browse to `simkl.com/oauth/authorize?response_type=code&client_id=…&redirect_uri=…`,
     then POST `code` / `client_id` / `client_secret` / `redirect_uri` /
     `grant_type=authorization_code` to `api.simkl.com/oauth/token`.

   The 900s `expires_in` on the PIN is the window to *enter* the code. The
   resulting **access token never expires** — it's valid until you revoke the
   app under Connected Apps.
3. **Import from Trakt** at `simkl.com/apps/import/trakt/` — watch history,
   ratings and watchlist. One-way; do it before switching the write path.
4. Add the **Plex webhook** from `simkl.com/apps/plex/` to your Plex webhooks
   list (requires Plex Pass, which you already have — Plex webhooks are a Pass
   feature). Keep your existing n8n webhook alongside it; Plex supports several.
5. In n8n, set the feed workflow's Config node (client id, access token, TMDB
   key) and repoint Plex's existing n8n webhook at `/plex-live-session`.
6. Point `N8N_MEDIA_FEED_WEBHOOK` at the new feed workflow's **production** GET
   URL.

### Container networking

Plex gets **two** webhooks, doing different jobs — Simkl's own
(`simkl.com/apps/plex/`, records watches) and n8n's `/plex-live-session`
(drives the live row). The feed URL is never entered into Plex.

In Docker, a container can't reach a public domain that resolves back to its
own host — NAT hairpinning. Those requests **hang** rather than fail, which
makes them easy to misread as something else. It bites twice here:

There is now exactly **one** network hop in the whole system: Plex → n8n. Point
Plex's webhook at `http://N8n:443/webhook/plex-live-session` — container to
container over the shared `webhooks` network, no public DNS, no NAT, and it
survives the reverse proxy being down. Everything downstream is in-process.

Two traps worth writing down, since both cost time here:

- **The port is 443, not 5678.** `N8N_PORT=443`, and the `5678/tcp` that
  `docker ps` reports is only the image's `EXPOSE` metadata — inert, and not
  what n8n listens on. Check with
  `docker exec -it N8n env | grep -i n8n_port`.
- **The container is `N8n`, capital N.** Read the exact name from `docker ps`.

Confirm any candidate address from inside the calling container before wiring
it in — a `200` here means both directions will work:

```bash
docker exec -it plex curl -sS -o /dev/null -w '%{http_code}\n' \
  http://N8n:443/webhook/media-feed?range=now
```

Distinguish the failures: *"Could not resolve host"* is a DNS or container-name
problem, *"Failed to connect"* means DNS worked and the port is wrong, and a
**hang** is hairpinning.

`Push Now State` deliberately does **not** swallow errors: a silent failure
there means the Now Watching row stops updating with nothing to show why. The
two flush nodes stay fire-and-forget — a missed flush only delays a refresh.

> **The token can't live in an n8n credential.** The Simkl calls run inside a
> Code node via `this.helpers.httpRequest`, and Code nodes can't read n8n's
> credential store — the old Trakt feed had the same constraint. Keep the values
> in the Config node, or set them as n8n env vars and use
> `={{ $env.SIMKL_ACCESS_TOKEN }}` so they stay out of the workflow export.

## Known gaps

- **Live row needs the Plex webhook path kept alive.** If you retire the n8n
  scrobbler entirely, Now Watching goes permanently idle and the card silently
  falls back to music-only. It won't error — it just never lights up.
- **Plex sends no usable `viewOffset`.** The scrobbler estimates progress from
  wall-clock watch time vs duration, which is seek-blind. `progressPct` rides
  along in the live payload but the embed doesn't render it — don't build a
  live progress bar on it without checking the numbers first.
- **Simkl brand hex** on the media button is a placeholder near-black
  (`#111827`); confirm against Simkl's current brand color before production.
- **Anime films** arrive in Simkl's `anime` array, not `movies`, so they read as
  `ANIME` rather than `FILM` and won't appear under the Movies chip. Simkl marks
  them with `anime_type: "movie"` if you want them in both.
- **Recent has no episode titles.** `/sync/all-items` gives `last_watched`
  (`"S01E18"`) but not the episode's name, so the Recent detail panel shows
  `E18` with no title. Fetching them would mean a per-show episodes call.
- **Manual Plex marks don't scrobble.** Plex only fires webhooks on real
  playback; marking watched in the UI syncs nowhere.

## Testing

`test.html` renders the card standalone, served from GitHub Pages:

```
https://dalekcoffee.github.io/DalekCarrdSite/MediaShelf/test.html?mock=1&live=video
```

- `?mock=1` — fixtures, zero network
  - `&live=video|music|both|none` — which sources report activity
  - `&newer=video|music` — who wins when both are live
- `?feed=<url>` / `&music=<url>` — point at real webhooks

Verified with `?mock=1`: all five sections render, Watching and
Recent strips populate (Recent caps at 10 + "On Simkl" tile), progress bars and
percentages compute, ratings render as half-step stars, and both spoiler modes
(whole-note `noteSpoiler` and inline `[spoiler]` segments) blur and reveal.

## The Carrd embed

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@500;600;700&family=Space+Mono:wght@400;700&family=Space+Grotesk:wght@400;500&display=swap">
<link rel="stylesheet" href="https://dalekcoffee.github.io/DalekCarrdSite/MediaShelf/media-shelf.css">
<div id="dks-shelf"></div>
<script src="https://dalekcoffee.github.io/DalekCarrdSite/MediaShelf/media-shelf.js"></script>
```

The script renders the entire shelf into `#dks-shelf`. This card replaces the
production music embed — don't run both on the same page.

