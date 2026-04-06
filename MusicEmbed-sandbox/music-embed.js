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

/* ─── iTunes: fuzzy fallback, cleaned query ─── */
function fetchItunesUrl(artist, track) {
  var q     = encodeURIComponent(cleanStr(artist) + ' ' + cleanStr(track));
  var ctrl  = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, 8000) : null;
  return fetch('https://itunes.apple.com/search?term=' + q + '&entity=song&limit=5&media=music', ctrl ? {signal:ctrl.signal} : {})
    .then(function(r) { if (timer) clearTimeout(timer); if (!r.ok) return null; return r.json(); })
    .then(function(data) {
      if (!data || !data.results || !data.results.length) return null;
      var tl = cleanStr(track).toLowerCase();
      var al = cleanStr(artist).toLowerCase();
      var result = null;
      for (var i = 0; i < data.results.length; i++) {
        var tn = data.results[i].trackName;
        var an = data.results[i].artistName;
        if (tn && tn.toLowerCase().indexOf(tl) !== -1 &&
            an && an.toLowerCase().indexOf(al) !== -1) { result = data.results[i]; break; }
      }
      if (!result) {
        for (var i = 0; i < data.results.length; i++) {
          var tn = data.results[i].trackName;
          if (tn && tn.toLowerCase().indexOf(tl) !== -1) { result = data.results[i]; break; }
        }
      }
      if (!result || !result.artworkUrl100) return null;
      return result.artworkUrl100.replace('100x100bb', '250x250bb');
    })
    .catch(function() { if (timer) clearTimeout(timer); return null; });
}

/* ─── iTunes: artist album art fallback ─── */
function fetchItunesArtistUrl(artist) {
  var q    = encodeURIComponent(cleanStr(artist));
  var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, 8000) : null;
  return fetch('https://itunes.apple.com/search?term=' + q + '&entity=album&attribute=artistTerm&limit=5&media=music', ctrl ? {signal:ctrl.signal} : {})
    .then(function(r) { if (timer) clearTimeout(timer); if (!r.ok) return null; return r.json(); })
    .then(function(data) {
      if (!data || !data.results || !data.results.length) return null;
      var al = cleanStr(artist).toLowerCase();
      for (var i = 0; i < data.results.length; i++) {
        var an = data.results[i].artistName;
        if (an && an.toLowerCase().indexOf(al) !== -1 && data.results[i].artworkUrl100) {
          return data.results[i].artworkUrl100.replace('100x100bb', '250x250bb');
        }
      }
      return null;
    })
    .catch(function() { if (timer) clearTimeout(timer); return null; });
}

/* ─── loadCoverArt ─── */
var artCache = {};

function loadCoverArt(imgEl, wipeEl, info, artist, track) {
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
  function showUrl(url) {
    artCache[cacheKey] = url;
    imgEl.onload = function() {
      imgEl.style.display = 'block';
      if (wipeEl) wipeEl.style.display = 'none';
      if (imgEl.parentNode) imgEl.parentNode.classList.add('dkt-loaded');
    };
    imgEl.onerror = function() {
      if (!imgEl.dataset.fallbackTried) {
        imgEl.dataset.fallbackTried = '1';
        tryItunes();
      } else {
        if (wipeEl) wipeEl.style.display = 'none';
      }
    };
    imgEl.src = url;
  }
  function tryItunesArtist() {
    fetchItunesArtistUrl(artist).then(function(url) {
      if (url) { showUrl(url); return; }
      artCache[cacheKey] = 'none';
      if (wipeEl) wipeEl.style.display = 'none';
    });
  }
  function tryItunes() {
    fetchItunesUrl(artist, track).then(function(url) {
      if (url) showUrl(url);
      else tryItunesArtist();
    });
  }
  if (!info) { tryItunes(); return; }
  if (info.type === 'direct') { showUrl(info.url); return; }
  fetchCaaUrl(info.mbid, info.isGroup).then(function(url) {
    if (url) { showUrl(url); return; }
    if (!info.isGroup) {
      fetchCaaUrl(info.mbid, true).then(function(url2) {
        if (url2) showUrl(url2); else tryItunes();
      });
    } else {
      tryItunes();
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
  fetch(N8N_STATS_WEBHOOK + '?range=now_playing&t=' + Date.now())
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
          npImg.style.display = 'none'; npImg.removeAttribute('src'); delete npImg.dataset.itunesTried;
          if (npWipe) { npWipe.style.display = ''; }
          loadCoverArt(npImg, npWipe, getCoverInfo(track), track.track_metadata.artist_name, track.track_metadata.track_name);
        }
      } else {
        npTrackKey = null;
        dot.classList.remove('active');
        label.textContent = 'Nothing Playing'; label.classList.remove('active');
        /* body stays open — last track info lingers, dot + label communicate the idle state */
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
  setTimeout(function() { loadCoverArt(mainImg, wipeDiv, coverInfo, artist, name); }, idx * 300);

  return row;
}

function render(tracks, isRecent) {
  var list = document.getElementById('dkt-list');
  document.getElementById('dkt-h-plays-label').textContent = isRecent ? 'When' : 'Plays';
  list.innerHTML = '';
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
  if (dataCache[range]) { render(dataCache[range], range === 'recent'); return; }

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
      if (tracks && tracks.length) {
        dataCache[range] = tracks;
        render(tracks, range === 'recent');
      }
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
  loadData('this_month');
}, 800);

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
