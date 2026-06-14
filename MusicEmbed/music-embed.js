(function () {

var LB_USER = 'Dalek.coffee';

/*
 * ─── n8n webhook URL ─────────────────────────────────────────────────────────
 * Set this to your n8n webhook endpoint once deployed.
 * The embed sends: GET N8N_STATS_WEBHOOK + '?range=' + range
 *   range values: 'recent' | 'this_month' | 'this_year' | 'all_time'
 *
 * n8n should return the same JSON shape ListenBrainz does so the embed
 * can process it identically. See the n8n workflow notes at the bottom
 * of this file for the expected workflow structure.
 *
 * Leave as empty string to fall back to direct LB calls (useful during testing).
 */
var N8N_NP_WEBHOOK    = 'https://n8n.bakalabs.dev/webhook/f84033fe-a000-47f5-986a-e5444ab230e6';
var N8N_STATS_WEBHOOK = 'https://n8n.bakalabs.dev/webhook/f84033fe-a000-47f5-986a-e5444ab230e6';

var BRANDS = [
  {id:'yt', name:'YouTube',   short:'YT', color:'#FF0000', textOnHover:'#fff', icon:'https://cdn.simpleicons.org/youtube/black',    url:'https://www.youtube.com/results?search_query='},
  {id:'sp', name:'Spotify',   short:'SP', color:'#1DB954', textOnHover:'#fff', icon:'https://cdn.simpleicons.org/spotify/black',    url:'https://open.spotify.com/search/'},
  {id:'sc', name:'SoundCloud',short:'SC', color:'#FF5500', textOnHover:'#fff', icon:'https://cdn.simpleicons.org/soundcloud/black', url:'https://soundcloud.com/search?q='},
  {id:'ge', name:'Genius',    short:'GE', color:'#FFFF00', textOnHover:'#000', icon:'https://cdn.simpleicons.org/genius/black',     url:'https://genius.com/search?q='}
];

/* ─── Strip feat. artists + brackets so iTunes queries are clean ─── */
function cleanStr(s) {
  if (!s) return '';
  s = s.replace(/\s+(feat\.|ft\.|featuring)\s+.*/i, '');
  s = s.split('(')[0].split('[')[0];
  return s.replace(/\s+/g, ' ').trim();
}

/* ─── Build a search button ─── */
function makeBtn(brand, q) {
  var isGe = (brand.id === 'ge');
  var a = document.createElement('a');
  a.className = 'dkt-btn' + (isGe ? ' dkt-btn-ge' : '');
  a.href = brand.url + q;
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

/*
 * ─── Tab data cache ───────────────────────────────────────────────────────────
 * In-memory only — no sessionStorage needed since n8n owns the hour-level cache.
 * This just prevents re-hitting n8n on tab switches within the same page load.
 */
var dataCache = {};

/*
 * ─── Now Playing polling ──────────────────────────────────────────────────────
 * Still hits ListenBrainz directly — NP data is ephemeral and doesn't benefit
 * from an hourly cache. Interval: 3.5 min with 429 back-off.
 */
var npTrackKey  = null;
var npTimer     = null;
var NP_INTERVAL = 210000; /* 3.5 min */

function scheduleNextPoll(delay) {
  clearTimeout(npTimer);
  npTimer = setTimeout(function() {
    if (!document.hidden) {
      pollNowPlaying();
    } else {
      scheduleNextPoll(NP_INTERVAL);
    }
  }, delay !== undefined ? delay : NP_INTERVAL);
}

function pollNowPlaying() {
  /*
   * Polls n8n instead of ListenBrainz directly.
   * n8n caches the playing-now response for 30 seconds server-side,
   * so concurrent visitors share one LB call and no CORS issues reach the browser.
   * Response shape: { playing: bool, track: listen_object | null }
   */
  fetch(N8N_NP_WEBHOOK + '?range=now_playing&t=' + Date.now())
    .then(function(r) {
      if (!r.ok) { scheduleNextPoll(); return null; }
      scheduleNextPoll();
      return r.json();
    })
    .then(function(d) {
      if (!d) return;
      var track = d.playing ? d.track : null;
      var dot   = document.getElementById('dkt-np-dot');
      var label = document.getElementById('dkt-np-label');
      var body  = document.getElementById('dkt-np-body');
      if (track && track.track_metadata) {
        var key = track.track_metadata.track_name + '||' + track.track_metadata.artist_name;
        dot.classList.add('active');
        label.textContent = 'Now Playing'; label.classList.add('active');
        body.classList.add('open');
        document.getElementById('dkt-np-title').textContent  = track.track_metadata.track_name;
        document.getElementById('dkt-np-artist').textContent = track.track_metadata.artist_name;
        if (key !== npTrackKey) {
          npTrackKey = key;
          var btns = document.getElementById('dkt-np-btns');
          btns.innerHTML = '';
          var q = encodeURIComponent(track.track_metadata.track_name + ' ' + track.track_metadata.artist_name);
          for (var b = 0; b < BRANDS.length; b++) btns.appendChild(makeBtn(BRANDS[b], q));
          var npImg  = document.getElementById('dkt-np-img');
          var npWipe = document.getElementById('dkt-np-wipe');
          npImg.style.display = 'none'; npImg.removeAttribute('src'); delete npImg.dataset.fallbackTried;
          if (npWipe) { npWipe.style.display = ''; }
          loadCoverArt(npImg, npWipe, getCoverInfo(track), track.track_metadata.artist_name, track.track_metadata.track_name, track.track_metadata.release_name);
        }
      } else {
        npTrackKey = null;
        dot.classList.remove('active');
        label.textContent = 'Nothing Playing'; label.classList.remove('active');
        body.classList.remove('open');
      }
    })
    .catch(function() { scheduleNextPoll(); });
}

document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    clearTimeout(npTimer);
    pollNowPlaying();
  }
});

/* ─── Build a chart row ─── */
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
 * ─── loadData ─────────────────────────────────────────────────────────────────
 * If N8N_STATS_WEBHOOK is set, all tab data goes through n8n.
 * n8n is responsible for the hourly LB cache — the embed just asks for data.
 * In-memory dataCache prevents re-requests on tab switches within the same load.
 *
 * Falls back to direct LB calls if N8N_STATS_WEBHOOK is empty (dev/test mode).
 */
function loadData(range) {
  if (dataCache[range]) { render(dataCache[range], range === 'recent', range); return; }

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

document.getElementById('dkt-tab-container').addEventListener('click', function(e) {
  var r = e.target.dataset && e.target.dataset.r;
  if (!r) return;
  var tabs = document.querySelectorAll('.dkt-tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  e.target.classList.add('active');
  loadData(r);
});

setTimeout(function() {
  pollNowPlaying();
  var tabs = document.querySelectorAll('.dkt-tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  var yearTab = document.querySelector('.dkt-tab[data-r="this_year"]');
  if (yearTab) yearTab.classList.add('active');
  loadData('this_year');
}, 100);

})();

/*
 * ═══════════════════════════════════════════════════════════════════════════════
 * n8n WORKFLOW NOTES
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Webhook node (GET, path: /webhook/music-cache)
 *   → receives ?range= (recent | this_month | this_year | all_time)
 *
 * Static Data node (or n8n Variables)
 *   → stores { [range]: { tracks: [...], fetched_at: ISO timestamp } }
 *
 * Logic (Function / IF node):
 *   1. Read cached entry for this range from static data.
 *   2. If cache is empty OR fetched_at is more than 1 hour ago → fetch from LB.
 *   3. LB URL for 'recent':
 *        https://api.listenbrainz.org/1/user/Dalek.coffee/listens?count=10
 *      LB URL for stats ranges:
 *        https://api.listenbrainz.org/1/stats/user/Dalek.coffee/recordings?range={{range}}&count=10
 *   4. Extract tracks array:
 *        recent  → body.payload.listens
 *        stats   → body.payload.recordings
 *   5. Store { tracks, fetched_at: new Date().toISOString() } in static data.
 *   6. Return cached or freshly-fetched tracks.
 *
 * Response node:
 *   → { "tracks": [ ...same shape as LB returns... ] }
 *   → Set header:  Access-Control-Allow-Origin: *   (required for browser fetch)
 *   → Set header:  Cache-Control: public, max-age=1800
 *
 * Result: visitors poll n8n; n8n hits LB at most once per hour per range.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
