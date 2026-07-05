(function () {

var LB_USER      = 'Dalek.coffee';
var ANILIST_USER = 'DalekCoffee';

/*
 * ─── n8n webhook URLs ─────────────────────────────────────────────────────────
 * Music (unchanged from production MusicEmbed):
 *   GET N8N_STATS_WEBHOOK + '?range=' + range
 *   range: 'now_playing' | 'recent' | 'this_month' | 'this_year' | 'all_time'
 *
 * Anime (fill these in after importing the two new n8n workflows — see README):
 *   N8N_ANIME_LIVE_WEBHOOK   GET → { watching, show, matchedTitle, season,
 *                            episode, totalEpisodes, poster, siteUrl, updated_at }
 *   N8N_ANIME_STATS_WEBHOOK  GET ?range=watching|recent|completed → { entries: [...] }
 *
 * Leave the anime URLs empty to run music-only (anime side shows empty states).
 */
var N8N_NP_WEBHOOK    = 'https://n8n.bakalabs.dev/webhook/f84033fe-a000-47f5-986a-e5444ab230e6';
var N8N_STATS_WEBHOOK = 'https://n8n.bakalabs.dev/webhook/f84033fe-a000-47f5-986a-e5444ab230e6';
var N8N_ANIME_LIVE_WEBHOOK  = '';
var N8N_ANIME_STATS_WEBHOOK = '';

/*
 * ─── Sandbox overrides ────────────────────────────────────────────────────────
 * test.html only — production Carrd pages carry no query string, so these are
 * inert there. ?mock=1 renders fixture data with no network calls.
 *   ?mock=1&live=anime|music|both|none&newer=anime|music
 *   ?animeLive=<url>&animeStats=<url>&music=<url> to point at real webhooks.
 */
var QS = null;
try { QS = new URLSearchParams(window.location.search); } catch (e) {}
function qp(k) { return QS ? QS.get(k) : null; }
var MOCK = qp('mock') === '1';
if (qp('animeLive'))  N8N_ANIME_LIVE_WEBHOOK  = qp('animeLive');
if (qp('animeStats')) N8N_ANIME_STATS_WEBHOOK = qp('animeStats');
if (qp('music'))      { N8N_NP_WEBHOOK = qp('music'); N8N_STATS_WEBHOOK = qp('music'); }

var BRANDS = [
  {id:'yt', name:'YouTube',   short:'YT', color:'#FF0000', textOnHover:'#fff', icon:'https://cdn.simpleicons.org/youtube/black',    url:'https://www.youtube.com/results?search_query='},
  {id:'sp', name:'Spotify',   short:'SP', color:'#1DB954', textOnHover:'#fff', icon:'https://cdn.simpleicons.org/spotify/black',    url:'https://open.spotify.com/search/'},
  {id:'sc', name:'SoundCloud',short:'SC', color:'#FF5500', textOnHover:'#fff', icon:'https://cdn.simpleicons.org/soundcloud/black', url:'https://soundcloud.com/search?q='},
  {id:'ge', name:'Genius',    short:'GE', color:'#FFFF00', textOnHover:'#000', icon:'https://cdn.simpleicons.org/genius/black',     url:'https://genius.com/search?q='}
];

/* AniList button links straight to the matched entry when siteUrl is known */
var ANIME_BRANDS = [
  {id:'al', name:'AniList',     short:'AL', color:'#02A9FF', textOnHover:'#fff', icon:'https://cdn.simpleicons.org/anilist/black',     url:'https://anilist.co/search/anime?search='},
  {id:'cr', name:'Crunchyroll', short:'CR', color:'#F47521', textOnHover:'#fff', icon:'https://cdn.simpleicons.org/crunchyroll/black', url:'https://www.crunchyroll.com/search?q='},
  {id:'yt', name:'YouTube',     short:'YT', color:'#FF0000', textOnHover:'#fff', icon:'https://cdn.simpleicons.org/youtube/black',     url:'https://www.youtube.com/results?search_query='}
];

/* ─── Strip feat. artists + brackets so iTunes queries are clean ─── */
function cleanStr(s) {
  if (!s) return '';
  s = s.replace(/\s+(feat\.|ft\.|featuring)\s+.*/i, '');
  s = s.split('(')[0].split('[')[0];
  return s.replace(/\s+/g, ' ').trim();
}

/* ─── Build a search button (hrefOverride = direct link instead of search) ─── */
function makeBtn(brand, q, hrefOverride) {
  var isGe = (brand.id === 'ge');
  var a = document.createElement('a');
  a.className = 'dkt-btn' + (isGe ? ' dkt-btn-ge' : '');
  a.href = hrefOverride || (brand.url + q);
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.addEventListener('mouseover', function() {
    a.style.background = brand.color;
    a.style.color = brand.textOnHover;
  });
  a.addEventListener('mouseout', function() {
    a.style.background = '#fff';
    a.style.color = '#000';
  });
  a.addEventListener('touchstart', function() { a.style.background = brand.color; a.style.color = brand.textOnHover; }, {passive:true});
  a.addEventListener('touchend', function()   { a.style.background = '#fff'; a.style.color = '#000'; }, {passive:true});
  var icon = document.createElement('img');
  icon.src = brand.icon;
  icon.setAttribute('aria-hidden', 'true');
  var span = document.createElement('span');
  var fl = document.createElement('em'); fl.className = 'full-label'; fl.textContent = brand.name;
  var sl = document.createElement('em'); sl.className = 'short-label'; sl.textContent = brand.short;
  span.appendChild(fl); span.appendChild(sl);
  a.appendChild(icon); a.appendChild(span);
  return a;
}

function makeAnimeBtns(container, title, siteUrl) {
  container.innerHTML = '';
  var q = encodeURIComponent(title);
  for (var b = 0; b < ANIME_BRANDS.length; b++) {
    var brand = ANIME_BRANDS[b];
    container.appendChild(makeBtn(brand, q, (brand.id === 'al' && siteUrl) ? siteUrl : null));
  }
}

/* ─── Artwork: extract MusicBrainz identifiers from API payload ─── */
function getCoverInfo(t) {
  var meta = t.track_metadata || t;
  var map  = meta.mbid_mapping || {};
  var add  = meta.additional_info || {};
  var caaId  = map.caa_id           || t.caa_id           || null;
  var caaRel = map.caa_release_mbid  || t.caa_release_mbid  || null;
  if (caaId && caaRel) {
    return {type:'direct', url:'https://archive.org/download/mbid-' + caaRel + '/mbid-' + caaRel + '-' + caaId + '_thumb250.jpg'};
  }
  var mbid = map.release_mbid || add.release_mbid || t.release_mbid || null;
  if (mbid) return {type:'caa', mbid:mbid, isGroup:false};
  var rgmbid = add.release_group_mbid || t.release_group_mbid || null;
  if (rgmbid) return {type:'caa', mbid:rgmbid, isGroup:true};
  return null;
}

/* ─── CAA: resolve MBID → cover URL ─── */
function fetchCaaUrl(mbid, isGroup) {
  var endpoint = 'https://coverartarchive.org/' + (isGroup ? 'release-group' : 'release') + '/' + mbid;
  var ctrl  = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, 8000) : null;
  return fetch(endpoint, ctrl ? {signal:ctrl.signal} : {})
    .then(function(r) { if (timer) clearTimeout(timer); if (!r.ok) return null; return r.json(); })
    .then(function(data) {
      if (!data || !data.images || !data.images.length) return null;
      var img = null;
      for (var i = 0; i < data.images.length; i++) { if (data.images[i].front) { img = data.images[i]; break; } }
      if (!img) img = data.images[0];
      return (img.thumbnails && (img.thumbnails['250'] || img.thumbnails.small)) || img.image || null;
    })
    .catch(function() { if (timer) clearTimeout(timer); return null; });
}

/* ─── Normalize a title/name for fuzzy comparison ─── */
function normTitle(s) {
  if (!s) return '';
  s = cleanStr(s).toLowerCase().replace(/&/g, ' and ');
  s = s.replace(/[^a-z0-9]+/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

/* ─── Loose match: equal, or either contains the other (post-normalize) ─── */
function titlesMatch(a, b) {
  a = normTitle(a); b = normTitle(b);
  if (!a || !b) return false;
  return a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
}

/*
 * ─── Score a candidate result against what we know ──────────────────────────
 * Artist MUST match, and at least one of track / album must agree. Returns 0
 * to reject. This is what stops "any cover by this artist" and "same title,
 * wrong artist" from ever being shown — a correct ♫ placeholder beats wrong art.
 */
function scoreCandidate(cArtist, cTrack, cAlbum, artist, track, album) {
  if (!titlesMatch(cArtist, artist)) return 0;
  var tOk   = titlesMatch(cTrack, track);
  var albOk = album ? titlesMatch(cAlbum, album) : false;
  if (!tOk && !albOk) return 0;
  return 1 + (tOk ? 2 : 0) + (albOk ? 2 : 0);
}

/* ─── JSONP loader — for sources without CORS (Deezer) ─── */
var jsonpSeq = 0;
function jsonp(url, timeoutMs) {
  return new Promise(function(resolve) {
    var cb = '__dktJsonp' + (jsonpSeq++);
    var script = document.createElement('script');
    var done = false;
    function finish(data) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { delete window[cb]; } catch (e) { window[cb] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
      resolve(data);
    }
    var timer = setTimeout(function() { finish(null); }, timeoutMs || 8000);
    window[cb] = function(data) { finish(data); };
    script.onerror = function() { finish(null); };
    script.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'output=jsonp&callback=' + cb;
    (document.head || document.documentElement).appendChild(script);
  });
}

/* ─── Deezer: global coverage, validated match (JSONP, no auth) ─── */
function fetchDeezerUrl(artist, track, album) {
  var url = 'https://api.deezer.com/search?q=' + encodeURIComponent(cleanStr(artist) + ' ' + cleanStr(track)) + '&limit=10';
  return jsonp(url, 8000).then(function(data) {
    if (!data || !data.data || !data.data.length) return null;
    var best = null, bestScore = 0;
    for (var i = 0; i < data.data.length; i++) {
      var r = data.data[i];
      var s = scoreCandidate(r.artist && r.artist.name, r.title, r.album && r.album.title, artist, track, album);
      if (s > bestScore) { bestScore = s; best = r; }
    }
    if (!best || !best.album) return null;
    var u = best.album.cover_medium || best.album.cover_big || best.album.cover || '';
    /* Deezer returns a placeholder URL with an empty hash when there's no real cover */
    if (!u || u.indexOf('/cover//') !== -1) return null;
    return u;
  });
}

/* ─── iTunes: validated fallback, cleaned query ─── */
function fetchItunesUrl(artist, track, album) {
  var q     = encodeURIComponent(cleanStr(artist) + ' ' + cleanStr(track));
  var ctrl  = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, 8000) : null;
  return fetch('https://itunes.apple.com/search?term=' + q + '&entity=song&limit=10&media=music', ctrl ? {signal:ctrl.signal} : {})
    .then(function(r) { if (timer) clearTimeout(timer); if (!r.ok) return null; return r.json(); })
    .then(function(data) {
      if (!data || !data.results || !data.results.length) return null;
      var best = null, bestScore = 0;
      for (var i = 0; i < data.results.length; i++) {
        var r = data.results[i];
        var s = scoreCandidate(r.artistName, r.trackName, r.collectionName, artist, track, album);
        if (s > bestScore) { bestScore = s; best = r; }
      }
      if (!best || !best.artworkUrl100) return null;
      return best.artworkUrl100.replace('100x100bb', '250x250bb');
    })
    .catch(function() { if (timer) clearTimeout(timer); return null; });
}

/* ─── loadCoverArt ─── */
var artCache = {};

function loadCoverArt(imgEl, wipeEl, info, artist, track, album) {
  var cacheKey = (artist + '||' + track).toLowerCase();
  if (artCache[cacheKey]) {
    var cached = artCache[cacheKey];
    if (cached !== 'none') {
      imgEl.onload = function() {
        imgEl.style.display = 'block';
        if (wipeEl) wipeEl.style.display = 'none';
        if (imgEl.parentNode) imgEl.parentNode.classList.add('dkt-loaded');
      };
      imgEl.src = cached;
    } else {
      if (wipeEl) wipeEl.style.display = 'none';
    }
    return;
  }

  /* Fuzzy fallbacks — used when there's no MBID, and if a resolved image 404s.
     Deezer first (better global coverage), then iTunes; both validate the match. */
  function resolveFallbacks() {
    return fetchDeezerUrl(artist, track, album).then(function(url) {
      return url ? url : fetchItunesUrl(artist, track, album);
    });
  }

  function done(url) {
    if (url) { showUrl(url); return; }
    artCache[cacheKey] = 'none';
    if (wipeEl) wipeEl.style.display = 'none';
  }

  function showUrl(url) {
    artCache[cacheKey] = url;
    imgEl.onload = function() {
      imgEl.style.display = 'block';
      if (wipeEl) wipeEl.style.display = 'none';
      if (imgEl.parentNode) imgEl.parentNode.classList.add('dkt-loaded');
    };
    imgEl.onerror = function() {
      /* A resolved URL failed to load as an image — try the fuzzy sources once, then give up */
      if (!imgEl.dataset.fallbackTried) {
        imgEl.dataset.fallbackTried = '1';
        resolveFallbacks().then(done);
      } else {
        artCache[cacheKey] = 'none';
        if (wipeEl) wipeEl.style.display = 'none';
      }
    };
    imgEl.src = url;
  }

  if (!info)                  { resolveFallbacks().then(done); return; }
  if (info.type === 'direct') { showUrl(info.url); return; }
  fetchCaaUrl(info.mbid, info.isGroup).then(function(url) {
    if (url) { showUrl(url); return; }
    if (!info.isGroup) {
      fetchCaaUrl(info.mbid, true).then(function(url2) {
        if (url2) { showUrl(url2); return; }
        resolveFallbacks().then(done);
      });
    } else {
      resolveFallbacks().then(done);
    }
  });
}

/* ─── Direct poster loader — AniList gives us a final URL, no resolution chain ─── */
function loadPoster(imgEl, wipeEl, url) {
  imgEl.style.display = 'none';
  imgEl.removeAttribute('src');
  if (imgEl.parentNode) imgEl.parentNode.classList.remove('dkt-loaded');
  if (!url) { if (wipeEl) wipeEl.style.display = 'none'; return; }
  if (wipeEl) wipeEl.style.display = '';
  imgEl.onload = function() {
    imgEl.style.display = 'block';
    if (wipeEl) wipeEl.style.display = 'none';
    if (imgEl.parentNode) imgEl.parentNode.classList.add('dkt-loaded');
  };
  imgEl.onerror = function() { if (wipeEl) wipeEl.style.display = 'none'; };
  imgEl.src = url;
}

/* ─── Relative time for anime rows (AniList updatedAt is unix seconds) ─── */
function relTime(unixSec) {
  if (!unixSec) return '';
  var s = Math.max(0, Math.floor(Date.now() / 1000) - unixSec);
  if (s < 3600)        return Math.max(1, Math.floor(s / 60)) + 'm ago';
  if (s < 86400)       return Math.floor(s / 3600) + 'h ago';
  if (s < 86400 * 30)  return Math.floor(s / 86400) + 'd ago';
  if (s < 86400 * 365) return Math.floor(s / (86400 * 30)) + 'mo ago';
  return Math.floor(s / (86400 * 365)) + 'y ago';
}

/*
 * ─── Tab data cache ───────────────────────────────────────────────────────────
 * In-memory only — no sessionStorage needed since n8n owns the hour-level cache.
 * This just prevents re-hitting n8n on tab switches within the same page load.
 * Anime ranges use 'anime_'-prefixed keys, so they never collide with music.
 */
var dataCache = {};

/*
 * ═══ UNIFIED LIVE STRIP ════════════════════════════════════════════════════════
 * One strip serves both media types. Each source polls independently and writes
 * into liveState; updateLiveStrip() picks what to show:
 *   - one source active            → show it
 *   - both active                  → most recent activity wins (anime carries
 *     updated_at from its last Plex event; music tracks the client-observed
 *     moment its track key last changed)
 *   - neither                     → "Nothing Playing", body collapses
 */
var liveState = {
  music: { active: false, key: null, track: null, changedAt: 0 },
  anime: { active: false, key: null, data:  null, changedAt: 0 }
};
var liveRenderedKey = null;

function updateLiveStrip() {
  var m = liveState.music, a = liveState.anime;
  var mode = null;
  if (m.active && a.active) mode = (a.changedAt >= m.changedAt) ? 'anime' : 'music';
  else if (m.active) mode = 'music';
  else if (a.active) mode = 'anime';

  var card  = document.getElementById('dkt-card');
  var dot   = document.getElementById('dkt-np-dot');
  var label = document.getElementById('dkt-np-label');
  var body  = document.getElementById('dkt-np-body');

  if (!mode) {
    liveRenderedKey = null;
    dot.classList.remove('active');
    label.textContent = 'Nothing Playing'; label.classList.remove('active');
    body.classList.remove('open');
    if (card) card.classList.remove('dka-live-anime');
    return;
  }

  dot.classList.add('active');
  label.textContent = (mode === 'music') ? 'Now Playing' : 'Now Watching';
  label.classList.add('active');
  body.classList.add('open');
  if (card) card.classList.toggle('dka-live-anime', mode === 'anime');

  var key = mode + ':' + (mode === 'music' ? m.key : a.key);
  if (key === liveRenderedKey) return;
  liveRenderedKey = key;

  if (mode === 'music') renderMusicNP(m.track);
  else renderAnimeNW(a.data);
}

function renderMusicNP(track) {
  var md = track.track_metadata;
  document.getElementById('dkt-np-title').textContent  = md.track_name;
  document.getElementById('dkt-np-artist').textContent = md.artist_name;
  var btns = document.getElementById('dkt-np-btns');
  btns.innerHTML = '';
  var q = encodeURIComponent(md.track_name + ' ' + md.artist_name);
  for (var b = 0; b < BRANDS.length; b++) btns.appendChild(makeBtn(BRANDS[b], q));
  var npImg  = document.getElementById('dkt-np-img');
  var npWipe = document.getElementById('dkt-np-wipe');
  npImg.style.display = 'none'; npImg.removeAttribute('src'); delete npImg.dataset.fallbackTried;
  if (npImg.parentNode) npImg.parentNode.classList.remove('dkt-loaded');
  if (npWipe) { npWipe.style.display = ''; }
  loadCoverArt(npImg, npWipe, getCoverInfo(track), md.artist_name, md.track_name, md.release_name);
}

function renderAnimeNW(d) {
  var title = d.matchedTitle || d.show || 'Unknown';
  var sub = '';
  if (d.isMovie) sub = 'Movie';
  else {
    if (d.season && d.season > 1) sub = 'S' + d.season + ' · ';
    sub += 'EP ' + (d.episode || '?') + (d.totalEpisodes ? ' / ' + d.totalEpisodes : '');
  }
  document.getElementById('dkt-np-title').textContent  = title;
  document.getElementById('dkt-np-artist').textContent = sub;
  makeAnimeBtns(document.getElementById('dkt-np-btns'), title, d.siteUrl);
  loadPoster(document.getElementById('dkt-np-img'), document.getElementById('dkt-np-wipe'), d.poster);
}

/*
 * ─── Music Now Playing polling ────────────────────────────────────────────────
 * n8n caches the playing-now response server-side, so concurrent visitors share
 * one LB call. Interval: 3.5 min, visibility-aware.
 */
var npTimer     = null;
var NP_INTERVAL = 210000; /* 3.5 min */

function scheduleNextPoll(delay) {
  if (MOCK) return;
  clearTimeout(npTimer);
  npTimer = setTimeout(function() {
    if (!document.hidden) {
      pollNowPlaying();
    } else {
      scheduleNextPoll(NP_INTERVAL);
    }
  }, delay !== undefined ? delay : NP_INTERVAL);
}

function applyMusicNP(d) {
  var track = (d && d.playing) ? d.track : null;
  var key = (track && track.track_metadata)
    ? track.track_metadata.track_name + '||' + track.track_metadata.artist_name
    : null;
  if (key !== liveState.music.key) liveState.music.changedAt = Date.now();
  liveState.music.key    = key;
  liveState.music.active = !!key;
  liveState.music.track  = key ? track : null;
  updateLiveStrip();
}

function pollNowPlaying() {
  if (MOCK) { applyMusicNP(mockMusicNP()); return; }
  fetch(N8N_NP_WEBHOOK + '?range=now_playing&t=' + Date.now())
    .then(function(r) {
      if (!r.ok) { scheduleNextPoll(); return null; }
      scheduleNextPoll();
      return r.json();
    })
    .then(function(d) { if (d) applyMusicNP(d); })
    .catch(function() { scheduleNextPoll(); });
}

/*
 * ─── Anime Now Watching polling ───────────────────────────────────────────────
 * The n8n live endpoint only reads workflow static data (no upstream call), so
 * polling every 2 min is cheap. State is event-driven from Plex webhooks.
 */
var nwTimer     = null;
var NW_INTERVAL = 120000; /* 2 min */

function scheduleNextNWPoll(delay) {
  if (MOCK) return;
  clearTimeout(nwTimer);
  nwTimer = setTimeout(function() {
    if (!document.hidden) {
      pollNowWatching();
    } else {
      scheduleNextNWPoll(NW_INTERVAL);
    }
  }, delay !== undefined ? delay : NW_INTERVAL);
}

function applyAnimeNW(d) {
  var active = !!(d && d.watching);
  liveState.anime.active = active;
  liveState.anime.data   = active ? d : null;
  liveState.anime.key    = active ? ((d.mediaId || d.matchedTitle || d.show) + ':' + (d.episode || '')) : null;
  if (d && d.updated_at) liveState.anime.changedAt = d.updated_at;
  updateLiveStrip();
}

function pollNowWatching() {
  if (MOCK) { applyAnimeNW(mockAnimeLive()); return; }
  if (!N8N_ANIME_LIVE_WEBHOOK) return;
  fetch(N8N_ANIME_LIVE_WEBHOOK + '?t=' + Date.now())
    .then(function(r) {
      if (!r.ok) { scheduleNextNWPoll(); return null; }
      scheduleNextNWPoll();
      return r.json();
    })
    .then(function(d) { if (d) applyAnimeNW(d); })
    .catch(function() { scheduleNextNWPoll(); });
}

document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    clearTimeout(npTimer);
    pollNowPlaying();
    clearTimeout(nwTimer);
    pollNowWatching();
  }
});

/* ─── Build a music chart row ─── */
function buildRow(t, idx, isRecent) {
  var meta   = t.track_metadata || t;
  var name   = meta.track_name   || 'Unknown';
  var artist = meta.artist_name  || 'Unknown';
  var album  = meta.release_name || '';
  var q      = encodeURIComponent(name + ' ' + artist);

  var row = document.createElement('div'); row.className = 'dkt-row';

  var rankCol  = document.createElement('div'); rankCol.className = 'dkt-rank-col';
  var rankSpan = document.createElement('span'); rankSpan.className = 'dkt-rank'; rankSpan.textContent = idx + 1;
  rankCol.appendChild(rankSpan);

  var artDiv  = document.createElement('div'); artDiv.className = 'dkt-art';
  var wipeDiv = document.createElement('div'); wipeDiv.className = 'dkt-wipe';
  var mainImg = document.createElement('img'); mainImg.className = 'dkt-main-img'; mainImg.alt = '';
  artDiv.appendChild(wipeDiv); artDiv.appendChild(mainImg);

  var infoDiv   = document.createElement('div'); infoDiv.className = 'dkt-info';
  var titleDiv  = document.createElement('div'); titleDiv.className = 'dkt-title';  titleDiv.textContent = name;
  var artistDiv = document.createElement('div'); artistDiv.className = 'dkt-artist'; artistDiv.textContent = artist;
  var btnsDiv   = document.createElement('div'); btnsDiv.className = 'dkt-btns';
  for (var b = 0; b < BRANDS.length; b++) btnsDiv.appendChild(makeBtn(BRANDS[b], q));
  infoDiv.appendChild(titleDiv); infoDiv.appendChild(artistDiv); infoDiv.appendChild(btnsDiv);

  var countCol = document.createElement('div'); countCol.className = 'dkt-count-col';
  if (isRecent) {
    var ws = document.createElement('span'); ws.className = 'dkt-rel-time'; ws.textContent = 'RECENT';
    countCol.appendChild(ws);
  } else {
    var cs = document.createElement('span'); cs.className = 'dkt-count-num'; cs.textContent = t.listen_count || '0';
    countCol.appendChild(cs);
  }

  row.appendChild(rankCol); row.appendChild(artDiv); row.appendChild(infoDiv); row.appendChild(countCol);

  var coverInfo = getCoverInfo(t);
  setTimeout(function() { loadCoverArt(mainImg, wipeDiv, coverInfo, artist, name, album); }, idx * 80);

  return row;
}

function render(tracks, isRecent, range) {
  var list = document.getElementById('dkt-list');
  document.getElementById('dkt-h-plays-label').textContent = isRecent ? 'When' : 'Plays';
  list.innerHTML = '';
  if (!tracks || !tracks.length) {
    var empty = document.createElement('div');
    empty.className = 'dkt-empty';
    empty.textContent = range === 'this_month'
      ? 'Monthly stats are still processing — check back in a few days.'
      : 'No listens for this range yet.';
    list.appendChild(empty);
    return;
  }
  for (var i = 0; i < tracks.length; i++) list.appendChild(buildRow(tracks[i], i, isRecent));
}

/*
 * ─── loadData (music) ─────────────────────────────────────────────────────────
 * All tab data goes through n8n; n8n owns the hourly LB cache.
 * Falls back to direct LB calls if N8N_STATS_WEBHOOK is empty (dev/test mode).
 */
function loadData(range) {
  if (uiMode !== 'music') return;
  if (dataCache[range]) { render(dataCache[range], range === 'recent', range); return; }
  if (MOCK) { dataCache[range] = mockTracks(range); render(dataCache[range], range === 'recent', range); return; }

  var url;
  if (N8N_STATS_WEBHOOK) {
    url = N8N_STATS_WEBHOOK + '?range=' + encodeURIComponent(range) + '&t=' + Date.now();
  } else {
    /* Fallback: direct LB (same as original embed) */
    url = range === 'recent'
      ? 'https://api.listenbrainz.org/1/user/' + LB_USER + '/listens?count=10'
      : 'https://api.listenbrainz.org/1/stats/user/' + LB_USER + '/recordings?range=' + range + '&count=10';
  }

  fetch(url)
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(d) {
      if (uiMode !== 'music') { dataCache[range] = d.tracks || []; return; }
      /*
       * n8n returns { tracks: [...] } — a normalised wrapper.
       * Direct LB returns the full payload; unwrap the same way as before.
       */
      var tracks;
      if (d.tracks) {
        /* n8n normalised format */
        tracks = d.tracks;
      } else {
        /* Direct LB format (fallback path) */
        tracks = range === 'recent' ? d.payload.listens : d.payload.recordings;
      }
      tracks = tracks || [];
      dataCache[range] = tracks;
      render(tracks, range === 'recent', range);
    })
    .catch(function() {});
}

/* ─── Build an anime row ─── */
function buildAnimeRow(e, idx, range) {
  var title = e.title || 'Unknown';

  var row = document.createElement('div'); row.className = 'dkt-row';

  var rankCol  = document.createElement('div'); rankCol.className = 'dkt-rank-col';
  var rankSpan = document.createElement('span'); rankSpan.className = 'dkt-rank'; rankSpan.textContent = idx + 1;
  rankCol.appendChild(rankSpan);

  var artDiv  = document.createElement('div'); artDiv.className = 'dkt-art dka-poster';
  var wipeDiv = document.createElement('div'); wipeDiv.className = 'dkt-wipe';
  var mainImg = document.createElement('img'); mainImg.className = 'dkt-main-img'; mainImg.alt = '';
  artDiv.appendChild(wipeDiv); artDiv.appendChild(mainImg);

  var sub;
  if (range === 'completed') {
    sub = (e.episodes ? e.episodes + ' EP' : '') + (e.completedAt ? (e.episodes ? ' · ' : '') + e.completedAt : '');
  } else {
    sub = 'EP ' + (e.progress || 0) + (e.episodes ? ' / ' + e.episodes : '');
    if (range === 'recent' && e.status && e.status !== 'CURRENT') sub += ' · ' + e.status.toLowerCase();
  }

  var infoDiv   = document.createElement('div'); infoDiv.className = 'dkt-info';
  var titleDiv  = document.createElement('div'); titleDiv.className = 'dkt-title';  titleDiv.textContent = title;
  var subDiv    = document.createElement('div'); subDiv.className = 'dkt-artist';   subDiv.textContent = sub;
  var btnsDiv   = document.createElement('div'); btnsDiv.className = 'dkt-btns';
  makeAnimeBtns(btnsDiv, title, e.siteUrl);
  infoDiv.appendChild(titleDiv); infoDiv.appendChild(subDiv); infoDiv.appendChild(btnsDiv);

  var countCol = document.createElement('div'); countCol.className = 'dkt-count-col';
  if (range === 'watching') {
    var num = document.createElement('span'); num.className = 'dkt-count-num'; num.textContent = e.progress || 0;
    countCol.appendChild(num);
    var subEl = document.createElement('span'); subEl.className = 'dkt-count-sub';
    subEl.textContent = 'of ' + (e.episodes || '?');
    countCol.appendChild(subEl);
  } else if (range === 'completed') {
    var sc = document.createElement('span'); sc.className = 'dkt-count-num'; sc.textContent = e.score ? e.score : '—';
    countCol.appendChild(sc);
  } else {
    var rt = document.createElement('span'); rt.className = 'dkt-rel-time'; rt.textContent = relTime(e.updatedAt) || 'RECENT';
    countCol.appendChild(rt);
  }

  row.appendChild(rankCol); row.appendChild(artDiv); row.appendChild(infoDiv); row.appendChild(countCol);

  setTimeout(function() { loadPoster(mainImg, wipeDiv, e.poster); }, idx * 60);

  return row;
}

function renderAnime(entries, range) {
  var list = document.getElementById('dkt-list');
  var colLabel = range === 'watching' ? 'EP' : (range === 'completed' ? 'Score' : 'When');
  document.getElementById('dkt-h-plays-label').textContent = colLabel;
  list.innerHTML = '';
  if (!entries || !entries.length) {
    var empty = document.createElement('div');
    empty.className = 'dkt-empty';
    empty.textContent = N8N_ANIME_STATS_WEBHOOK || MOCK
      ? 'Nothing here yet.'
      : 'Anime webhook not configured yet.';
    list.appendChild(empty);
    return;
  }
  for (var i = 0; i < entries.length; i++) list.appendChild(buildAnimeRow(entries[i], i, range));
}

/* ─── loadAnimeData — mirrors loadData via the anime stats webhook ─── */
function loadAnimeData(range) {
  if (uiMode !== 'anime') return;
  var cacheKey = 'anime_' + range;
  if (dataCache[cacheKey]) { renderAnime(dataCache[cacheKey], range); return; }
  if (MOCK) { dataCache[cacheKey] = mockAnimeEntries(range); renderAnime(dataCache[cacheKey], range); return; }
  if (!N8N_ANIME_STATS_WEBHOOK) { renderAnime([], range); return; }

  fetch(N8N_ANIME_STATS_WEBHOOK + '?range=' + encodeURIComponent(range) + '&t=' + Date.now())
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(d) {
      var entries = (d && d.entries) || [];
      dataCache[cacheKey] = entries;
      if (uiMode === 'anime') renderAnime(entries, range);
    })
    .catch(function() {});
}

/*
 * ─── MUSIC | ANIME mode switcher ──────────────────────────────────────────────
 * Only swaps the tab row + list content; the live strip is unified and ignores
 * this (it always shows whichever medium is actually playing).
 */
var uiMode = 'music';
var currentMusicRange = 'this_year';
var currentAnimeRange = 'watching';

function setMode(mode) {
  uiMode = mode;
  var musicBtn = document.getElementById('dka-mode-music');
  var animeBtn = document.getElementById('dka-mode-anime');
  if (musicBtn) musicBtn.classList.toggle('active', mode === 'music');
  if (animeBtn) animeBtn.classList.toggle('active', mode === 'anime');

  var musicTabs = document.getElementById('dkt-tab-container');
  var animeTabs = document.getElementById('dka-tab-container');
  if (musicTabs) musicTabs.classList.toggle('dka-hidden', mode !== 'music');
  if (animeTabs) animeTabs.classList.toggle('dka-hidden', mode !== 'anime');

  var heading = document.querySelector('#dkt-card .dkt-heading');
  if (heading) heading.textContent = mode === 'music' ? 'Top Listens' : 'My Anime';
  var trackLabel = document.getElementById('dkt-h-track-label');
  if (trackLabel) trackLabel.textContent = mode === 'music' ? 'Track' : 'Anime';

  var lbLink = document.getElementById('dkt-foot-lb');
  var alLink = document.getElementById('dkt-foot-al');
  if (lbLink) lbLink.classList.toggle('dka-hidden', mode !== 'music');
  if (alLink) alLink.classList.toggle('dka-hidden', mode !== 'anime');

  if (mode === 'music') loadData(currentMusicRange);
  else loadAnimeData(currentAnimeRange);
}

var modeContainer = document.getElementById('dka-mode-container');
if (modeContainer) {
  modeContainer.addEventListener('click', function(e) {
    var mode = e.target.dataset && e.target.dataset.mode;
    if (!mode || mode === uiMode) return;
    setMode(mode);
  });
}

document.getElementById('dkt-tab-container').addEventListener('click', function(e) {
  var r = e.target.dataset && e.target.dataset.r;
  if (!r) return;
  var tabs = document.querySelectorAll('#dkt-tab-container .dkt-tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  e.target.classList.add('active');
  currentMusicRange = r;
  loadData(r);
});

var animeTabContainer = document.getElementById('dka-tab-container');
if (animeTabContainer) {
  animeTabContainer.addEventListener('click', function(e) {
    var r = e.target.dataset && e.target.dataset.r;
    if (!r) return;
    var tabs = document.querySelectorAll('#dka-tab-container .dkt-tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
    e.target.classList.add('active');
    currentAnimeRange = r;
    loadAnimeData(r);
  });
}

/*
 * ═══ MOCK FIXTURES (sandbox only — ?mock=1) ═══════════════════════════════════
 * ?live=anime|music|both|none controls which live sources report activity;
 * ?newer=anime|music decides the winner when both are live.
 */
var MOCK_LIVE  = qp('live')  || 'anime';
var MOCK_NEWER = qp('newer') || 'anime';

function mockMusicNP() {
  if (MOCK_LIVE !== 'music' && MOCK_LIVE !== 'both') return { playing: false, track: null };
  return { playing: true, track: { track_metadata: {
    track_name: 'Idol', artist_name: 'YOASOBI', release_name: 'THE BOOK 3'
  } } };
}

function mockAnimeLive() {
  if (MOCK_LIVE !== 'anime' && MOCK_LIVE !== 'both') return { watching: false, updated_at: Date.now() - 3600000 };
  return {
    watching: true,
    show: 'Frieren: Beyond Journey’s End',
    matchedTitle: 'Frieren: Beyond Journey’s End',
    season: 1, episode: 7, totalEpisodes: 28, isMovie: false,
    mediaId: 154587,
    poster: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-gHSraOSa0nBG.jpg',
    siteUrl: 'https://anilist.co/anime/154587',
    event: 'media.play',
    updated_at: MOCK_NEWER === 'anime' ? Date.now() + 5000 : Date.now() - 600000
  };
}

function mockAnimeEntries(range) {
  var mk = function(title, eps, prog, score, daysAgo, poster, url, status) {
    return { title: title, episodes: eps, progress: prog, score: score, status: status || 'CURRENT',
      updatedAt: Math.floor(Date.now() / 1000) - daysAgo * 86400,
      completedAt: score ? '2026-06-1' + daysAgo : null,
      poster: poster || '', siteUrl: url || '' };
  };
  if (range === 'completed') return [
    mk('Solo Leveling', 12, 12, 9, 2, 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iwfx0Vl.jpg', 'https://anilist.co/anime/151807', 'COMPLETED'),
    mk('Cowboy Bebop', 26, 26, 10, 5, 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1-CXtrrkMpJ8Zq.png', 'https://anilist.co/anime/1', 'COMPLETED'),
    mk('Bocchi the Rock!', 12, 12, 0, 8, '', 'https://anilist.co/anime/130003', 'COMPLETED')
  ];
  if (range === 'recent') return [
    mk('Frieren: Beyond Journey’s End', 28, 7, 0, 0, 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-gHSraOSa0nBG.jpg', 'https://anilist.co/anime/154587'),
    mk('One Piece', null, 1088, 0, 1, '', 'https://anilist.co/anime/21'),
    mk('Solo Leveling', 12, 12, 9, 2, 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iwfx0Vl.jpg', 'https://anilist.co/anime/151807', 'COMPLETED')
  ];
  return [
    mk('Frieren: Beyond Journey’s End', 28, 7, 0, 0, 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-gHSraOSa0nBG.jpg', 'https://anilist.co/anime/154587'),
    mk('One Piece', null, 1088, 0, 1, '', 'https://anilist.co/anime/21'),
    mk('Delicious in Dungeon', 24, 15, 0, 3, '', 'https://anilist.co/anime/153518')
  ];
}

function mockTracks(range) {
  var mk = function(name, artist, album, count) {
    return { track_metadata: { track_name: name, artist_name: artist, release_name: album }, listen_count: count };
  };
  return [
    mk('Racing Into The Night', 'YOASOBI', 'THE BOOK', 42),
    mk('KICK BACK', 'Kenshi Yonezu', 'KICK BACK', 31),
    mk('Bling-Bang-Bang-Born', 'Creepy Nuts', 'Bling-Bang-Bang-Born', 27)
  ];
}

/* ─── Init ─── */
setTimeout(function() {
  pollNowPlaying();
  pollNowWatching();
  var tabs = document.querySelectorAll('#dkt-tab-container .dkt-tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  var yearTab = document.querySelector('#dkt-tab-container .dkt-tab[data-r="this_year"]');
  if (yearTab) yearTab.classList.add('active');
  currentMusicRange = 'this_year';
  setMode('music');
}, 100);

})();
