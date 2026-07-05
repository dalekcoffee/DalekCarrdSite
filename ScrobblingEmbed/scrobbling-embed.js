(function () {

var LB_USER    = 'Dalek.coffee';
var TRAKT_USER = 'dalekcoffee';

/*
 * ─── n8n webhook URLs ─────────────────────────────────────────────────────────
 * Music (unchanged from production MusicEmbed):
 *   GET N8N_STATS_WEBHOOK + '?range=' + range
 *   range: 'now_playing' | 'recent' | 'this_month' | 'this_year' | 'all_time'
 *
 * Video (fill in after importing the "Carrd Trakt Feed" n8n workflow — README):
 *   GET N8N_TRAKT_FEED_WEBHOOK + '?range=now'
 *     → { watching, type, title, episodeTitle, season, episode, totalEpisodes,
 *         isAnime, poster, siteUrl, updated_at }
 *   GET N8N_TRAKT_FEED_WEBHOOK + '?media=tv|anime&range=watching|recent|completed'
 *     → { entries: [...] }
 *
 * Leave the Trakt URL empty to run music-only (video tabs show empty states).
 */
var N8N_NP_WEBHOOK    = 'https://n8n.bakalabs.dev/webhook/f84033fe-a000-47f5-986a-e5444ab230e6';
var N8N_STATS_WEBHOOK = 'https://n8n.bakalabs.dev/webhook/f84033fe-a000-47f5-986a-e5444ab230e6';
var N8N_TRAKT_FEED_WEBHOOK = '';

/*
 * ─── Sandbox overrides ────────────────────────────────────────────────────────
 * test.html only — production Carrd pages carry no query string, so these are
 * inert there. ?mock=1 renders fixture data with no network calls.
 *   ?mock=1&live=video|music|both|none&newer=video|music
 *   ?trakt=<url>&music=<url> to point at real webhooks.
 */
var QS = null;
try { QS = new URLSearchParams(window.location.search); } catch (e) {}
function qp(k) { return QS ? QS.get(k) : null; }
var MOCK = qp('mock') === '1';
if (qp('trakt')) N8N_TRAKT_FEED_WEBHOOK = qp('trakt');
if (qp('music')) { N8N_NP_WEBHOOK = qp('music'); N8N_STATS_WEBHOOK = qp('music'); }

var BRANDS = [
  {id:'yt', name:'YouTube',   short:'YT', color:'#FF0000', textOnHover:'#fff', icon:'https://cdn.simpleicons.org/youtube/black',    url:'https://www.youtube.com/results?search_query='},
  {id:'sp', name:'Spotify',   short:'SP', color:'#1DB954', textOnHover:'#fff', icon:'https://cdn.simpleicons.org/spotify/black',    url:'https://open.spotify.com/search/'},
  {id:'sc', name:'SoundCloud',short:'SC', color:'#FF5500', textOnHover:'#fff', icon:'https://cdn.simpleicons.org/soundcloud/black', url:'https://soundcloud.com/search?q='},
  {id:'ge', name:'Genius',    short:'GE', color:'#FFFF00', textOnHover:'#000', icon:'https://cdn.simpleicons.org/genius/black',     url:'https://genius.com/search?q='}
];

/* Trakt button links straight to the matched show/movie when siteUrl is known */
var TRAKT_BRAND = {id:'tk', name:'Trakt',       short:'TK', color:'#ED1C24', textOnHover:'#fff', icon:'https://cdn.simpleicons.org/trakt/black',       url:'https://trakt.tv/search?query='};
var VIDEO_BRANDS = {
  tv: [
    TRAKT_BRAND,
    {id:'yt', name:'YouTube',     short:'YT', color:'#FF0000', textOnHover:'#fff', icon:'https://cdn.simpleicons.org/youtube/black',     url:'https://www.youtube.com/results?search_query='}
  ],
  anime: [
    TRAKT_BRAND,
    {id:'cr', name:'Crunchyroll', short:'CR', color:'#F47521', textOnHover:'#fff', icon:'https://cdn.simpleicons.org/crunchyroll/black', url:'https://www.crunchyroll.com/search?q='},
    {id:'al', name:'AniList',     short:'AL', color:'#02A9FF', textOnHover:'#fff', icon:'https://cdn.simpleicons.org/anilist/black',     url:'https://anilist.co/search/anime?search='}
  ]
};

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

function makeVideoBtns(container, media, title, siteUrl) {
  container.innerHTML = '';
  var brands = VIDEO_BRANDS[media] || VIDEO_BRANDS.tv;
  var q = encodeURIComponent(title);
  for (var b = 0; b < brands.length; b++) {
    var brand = brands[b];
    container.appendChild(makeBtn(brand, q, (brand.id === 'tk' && siteUrl) ? siteUrl : null));
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

/* ─── Direct poster loader — the n8n feed hands us final TMDB URLs ─── */
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

/* ─── Relative time for video rows (feed emits unix seconds) ─── */
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
 * Video ranges use '<media>_'-prefixed keys, so they never collide with music.
 */
var dataCache = {};

/*
 * ═══ UNIFIED LIVE STRIP ════════════════════════════════════════════════════════
 * One strip serves music and video. Each source polls independently and writes
 * into liveState; updateLiveStrip() picks what to show:
 *   - one source active            → show it
 *   - both active                  → most recent activity wins (video carries
 *     updated_at = Trakt started_at; music tracks the client-observed moment
 *     its track key last changed)
 *   - neither                     → "Nothing Playing", body collapses
 */
var liveState = {
  music: { active: false, key: null, track: null, changedAt: 0 },
  video: { active: false, key: null, data:  null, changedAt: 0 }
};
var liveRenderedKey = null;

function updateLiveStrip() {
  var m = liveState.music, v = liveState.video;
  var mode = null;
  if (m.active && v.active) mode = (v.changedAt >= m.changedAt) ? 'video' : 'music';
  else if (m.active) mode = 'music';
  else if (v.active) mode = 'video';

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
  if (card) card.classList.toggle('dka-live-anime', mode === 'video');

  var key = mode + ':' + (mode === 'music' ? m.key : v.key);
  if (key === liveRenderedKey) return;
  liveRenderedKey = key;

  if (mode === 'music') renderMusicNP(m.track);
  else renderVideoNW(v.data);
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

function renderVideoNW(d) {
  var title = d.title || 'Unknown';
  var sub;
  if (d.type === 'movie') {
    sub = 'Movie';
  } else {
    sub = (d.season && d.season > 1 ? 'S' + d.season + ' · ' : '') + 'EP ' + (d.episode || '?');
    if (d.totalEpisodes) sub += ' / ' + d.totalEpisodes;
    if (d.episodeTitle)  sub += ' — ' + d.episodeTitle;
  }
  document.getElementById('dkt-np-title').textContent  = title;
  document.getElementById('dkt-np-artist').textContent = sub;
  makeVideoBtns(document.getElementById('dkt-np-btns'), d.isAnime ? 'anime' : 'tv', title, d.siteUrl);
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
 * ─── Video Now Watching polling ───────────────────────────────────────────────
 * The n8n feed proxies Trakt's /users/:id/watching with a 60 s server cache,
 * so a 90 s client poll keeps the strip fresh without hammering anything.
 */
var nwTimer     = null;
var NW_INTERVAL = 90000; /* 1.5 min */

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

function applyVideoNW(d) {
  var active = !!(d && d.watching);
  liveState.video.active = active;
  liveState.video.data   = active ? d : null;
  liveState.video.key    = active ? (d.title + ':' + (d.season || '') + ':' + (d.episode || '')) : null;
  if (d && d.updated_at) liveState.video.changedAt = d.updated_at;
  updateLiveStrip();
}

function pollNowWatching() {
  if (MOCK) { applyVideoNW(mockVideoLive()); return; }
  if (!N8N_TRAKT_FEED_WEBHOOK) return;
  fetch(N8N_TRAKT_FEED_WEBHOOK + '?range=now&t=' + Date.now())
    .then(function(r) {
      if (!r.ok) { scheduleNextNWPoll(); return null; }
      scheduleNextNWPoll();
      return r.json();
    })
    .then(function(d) { if (d) applyVideoNW(d); })
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

/* ─── Build a video (TV/anime) row ─── */
function buildVideoRow(e, idx, range, media) {
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
  if (range === 'recent') {
    if (e.type === 'movie') {
      sub = 'Movie';
    } else {
      sub = (e.season && e.season > 1 ? 'S' + e.season + ' · ' : '') + 'EP ' + (e.number || '?');
      if (e.episodeTitle) sub += ' — ' + e.episodeTitle;
    }
  } else if (range === 'completed') {
    sub = e.episodes ? e.episodes + ' EP' : '';
  } else {
    sub = 'EP ' + (e.progress || 0) + (e.episodes ? ' / ' + e.episodes : '');
  }

  var infoDiv   = document.createElement('div'); infoDiv.className = 'dkt-info';
  var titleDiv  = document.createElement('div'); titleDiv.className = 'dkt-title';  titleDiv.textContent = title;
  var subDiv    = document.createElement('div'); subDiv.className = 'dkt-artist';   subDiv.textContent = sub;
  var btnsDiv   = document.createElement('div'); btnsDiv.className = 'dkt-btns';
  makeVideoBtns(btnsDiv, media, title, e.siteUrl);
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

function renderVideo(entries, range, media) {
  var list = document.getElementById('dkt-list');
  var colLabel = range === 'watching' ? 'EP' : (range === 'completed' ? 'Score' : 'When');
  document.getElementById('dkt-h-plays-label').textContent = colLabel;
  list.innerHTML = '';
  if (!entries || !entries.length) {
    var empty = document.createElement('div');
    empty.className = 'dkt-empty';
    empty.textContent = N8N_TRAKT_FEED_WEBHOOK || MOCK
      ? 'Nothing here yet.'
      : 'Trakt webhook not configured yet.';
    list.appendChild(empty);
    return;
  }
  for (var i = 0; i < entries.length; i++) list.appendChild(buildVideoRow(entries[i], i, range, media));
}

/* ─── loadVideoData — TV and ANIME share this, differing only in ?media= ─── */
function loadVideoData(media, range) {
  if (uiMode !== media) return;
  var cacheKey = media + '_' + range;
  if (dataCache[cacheKey]) { renderVideo(dataCache[cacheKey], range, media); return; }
  if (MOCK) { dataCache[cacheKey] = mockVideoEntries(media, range); renderVideo(dataCache[cacheKey], range, media); return; }
  if (!N8N_TRAKT_FEED_WEBHOOK) { renderVideo([], range, media); return; }

  fetch(N8N_TRAKT_FEED_WEBHOOK + '?media=' + media + '&range=' + encodeURIComponent(range) + '&t=' + Date.now())
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(d) {
      var entries = (d && d.entries) || [];
      dataCache[cacheKey] = entries;
      if (uiMode === media) renderVideo(entries, range, media);
    })
    .catch(function() {});
}

/*
 * ─── MUSIC | TV | ANIME mode switcher ─────────────────────────────────────────
 * Swaps the tab row + list content; the live strip is unified and ignores this
 * (it always shows whichever medium is actually playing). TV and ANIME share
 * the video tab row and renderer — only the feed's ?media= param differs.
 */
var uiMode = 'music';
var currentMusicRange = 'this_year';
var currentVideoRange = 'watching';

var MODE_META = {
  music: { heading: 'Top Listens',   col: 'Track', foot: 'dkt-foot-lb' },
  tv:    { heading: 'On The Screen', col: 'Show',  foot: 'dkt-foot-tk' },
  anime: { heading: 'My Anime',      col: 'Anime', foot: 'dkt-foot-al' }
};

function setMode(mode) {
  uiMode = mode;
  var modes = ['music', 'tv', 'anime'];
  for (var i = 0; i < modes.length; i++) {
    var btn = document.getElementById('dka-mode-' + modes[i]);
    if (btn) btn.classList.toggle('active', mode === modes[i]);
    var foot = document.getElementById(MODE_META[modes[i]].foot);
    if (foot) foot.classList.toggle('dka-hidden', mode !== modes[i]);
  }

  var musicTabs = document.getElementById('dkt-tab-container');
  var videoTabs = document.getElementById('dka-tab-container');
  if (musicTabs) musicTabs.classList.toggle('dka-hidden', mode !== 'music');
  if (videoTabs) videoTabs.classList.toggle('dka-hidden', mode === 'music');

  var heading = document.querySelector('#dkt-card .dkt-heading');
  if (heading) heading.textContent = MODE_META[mode].heading;
  var trackLabel = document.getElementById('dkt-h-track-label');
  if (trackLabel) trackLabel.textContent = MODE_META[mode].col;

  if (mode === 'music') loadData(currentMusicRange);
  else loadVideoData(mode, currentVideoRange);
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

var videoTabContainer = document.getElementById('dka-tab-container');
if (videoTabContainer) {
  videoTabContainer.addEventListener('click', function(e) {
    var r = e.target.dataset && e.target.dataset.r;
    if (!r) return;
    var tabs = document.querySelectorAll('#dka-tab-container .dkt-tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
    e.target.classList.add('active');
    currentVideoRange = r;
    loadVideoData(uiMode, r);
  });
}

/*
 * ═══ MOCK FIXTURES (sandbox only — ?mock=1) ═══════════════════════════════════
 * ?live=video|music|both|none controls which live sources report activity;
 * ?newer=video|music decides the winner when both are live.
 */
var MOCK_LIVE  = qp('live')  || 'video';
var MOCK_NEWER = qp('newer') || 'video';

function mockMusicNP() {
  if (MOCK_LIVE !== 'music' && MOCK_LIVE !== 'both') return { playing: false, track: null };
  return { playing: true, track: { track_metadata: {
    track_name: 'Idol', artist_name: 'YOASOBI', release_name: 'THE BOOK 3'
  } } };
}

function mockVideoLive() {
  if (MOCK_LIVE !== 'video' && MOCK_LIVE !== 'both') return { watching: false, updated_at: Date.now() - 3600000 };
  return {
    watching: true, type: 'episode',
    title: 'Frieren: Beyond Journey’s End', episodeTitle: 'The Land Where Souls Rest',
    season: 1, episode: 7, totalEpisodes: 28, isAnime: true,
    poster: 'https://image.tmdb.org/t/p/w342/dqZENchTd7lp5zht7BdlqM7RBhD.jpg',
    siteUrl: 'https://trakt.tv/shows/frieren-beyond-journey-s-end',
    updated_at: MOCK_NEWER === 'video' ? Date.now() + 5000 : Date.now() - 600000
  };
}

function mockVideoEntries(media, range) {
  var nowSec = Math.floor(Date.now() / 1000);
  var mk = function(title, eps, prog, score, daysAgo, extra) {
    var e = { title: title, episodes: eps, progress: prog, score: score,
      updatedAt: nowSec - daysAgo * 86400, poster: '', siteUrl: '' };
    for (var k in (extra || {})) e[k] = extra[k];
    return e;
  };
  if (media === 'anime') {
    if (range === 'completed') return [
      mk('Solo Leveling', 12, 12, 9, 2),
      mk('Cowboy Bebop', 26, 26, 10, 5)
    ];
    if (range === 'recent') return [
      mk('Frieren: Beyond Journey’s End', 28, 7, 0, 0, { type: 'episode', season: 1, number: 7, episodeTitle: 'The Land Where Souls Rest' }),
      mk('One Piece', null, 1088, 0, 1, { type: 'episode', season: 21, number: 1088 })
    ];
    return [ /* watching — inference case: completed < aired */
      mk('Frieren: Beyond Journey’s End', 28, 7, 0, 0),
      mk('One Piece', 1122, 1088, 0, 1)
    ];
  }
  if (range === 'completed') return [
    mk('The Bear', 28, 28, 9, 3),
    mk('Severance', 19, 19, 0, 12)
  ];
  if (range === 'recent') return [
    mk('Severance', 19, 12, 0, 0, { type: 'episode', season: 2, number: 3, episodeTitle: 'Who Is Alive?' }),
    mk('Dune: Part Two', null, 1, 8, 1, { type: 'movie' })
  ];
  return [
    mk('Severance', 19, 12, 0, 0),
    mk('Slow Horses', 24, 18, 0, 4)
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
