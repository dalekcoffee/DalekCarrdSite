(function () {
  'use strict';

  var LB_USER    = 'Dalek.coffee';
  var TRAKT_USER = 'dalekcoffee';

  /*
   * ─── n8n webhook URLs ───────────────────────────────────────────────────────
   * Music (unchanged from production MusicEmbed):
   *   GET N8N_STATS_WEBHOOK + '?range=' + (now_playing | this_month | this_year | all_time)
   *
   * Trakt feed (fill in after importing the "Carrd Trakt Feed" workflow — README):
   *   GET N8N_TRAKT_FEED_WEBHOOK + '?range=now'        → live session
   *   GET N8N_TRAKT_FEED_WEBHOOK + '?range=watching'   → { entries: [...] }
   *   GET N8N_TRAKT_FEED_WEBHOOK + '?range=favorites'  → { entries: [...] }
   *
   * Leave the Trakt URL empty to run music-only (video sections show empty states).
   */
  var N8N_NP_WEBHOOK    = 'https://n8n.bakalabs.dev/webhook/f84033fe-a000-47f5-986a-e5444ab230e6';
  var N8N_STATS_WEBHOOK = 'https://n8n.bakalabs.dev/webhook/f84033fe-a000-47f5-986a-e5444ab230e6';
  var N8N_TRAKT_FEED_WEBHOOK = 'https://n8n.bakalabs.dev/webhook/trakt-scrobbling-feed';

  /*
   * ─── Sandbox overrides (test.html only; inert on Carrd) ────────────────────
   *   ?mock=1&live=video|music|both|none&newer=video|music
   *   ?trakt=<feed-url>&music=<url>
   */
  var QS = null;
  try { QS = new URLSearchParams(window.location.search); } catch (e) {}
  function qp(k) { return QS ? QS.get(k) : null; }
  var MOCK = qp('mock') === '1';
  if (qp('trakt')) N8N_TRAKT_FEED_WEBHOOK = qp('trakt');
  if (qp('music')) { N8N_NP_WEBHOOK = qp('music'); N8N_STATS_WEBHOOK = qp('music'); }
  /* preview an accent from the design palette, e.g. ?accent=%23caa27a */
  if (qp('accent')) { try { document.documentElement.style.setProperty('--dks-accent', qp('accent')); } catch (e) {} }

  /* ─── Platform button sets (design: PlatformButtons.dc.html) ─────────────────
   * Brand icons come pre-tinted in the resting gray from simpleicons (same CDN
   * the production music embed uses); on hover a filter pushes them to white,
   * or to black for the light brands (Genius, IMDb).
   */
  var ICO_REST  = '9a9aa0';
  var TO_WHITE  = 'brightness(0) invert(1)';
  var TO_BLACK  = 'brightness(0)';

  var MUSIC_BRANDS = [
    { label: 'YouTube',    icon: 'youtube',    bb: '#FF0000', bt: '#ffffff', bi: TO_WHITE, url: 'https://www.youtube.com/results?search_query=' },
    { label: 'Spotify',    icon: 'spotify',    bb: '#1DB954', bt: '#ffffff', bi: TO_WHITE, url: 'https://open.spotify.com/search/' },
    { label: 'SoundCloud', icon: 'soundcloud', bb: '#FF5500', bt: '#ffffff', bi: TO_WHITE, url: 'https://soundcloud.com/search?q=' },
    { label: 'Genius',     icon: 'genius',     bb: '#FFE24B', bt: '#000000', bi: TO_BLACK, url: 'https://genius.com/search?q=' }
  ];

  function mediaBrandDefs(item) {
    var q = encodeURIComponent(item.title || '');
    var defs = [
      { label: 'YouTube', icon: 'youtube', bb: '#FF0000', bt: '#ffffff', bi: TO_WHITE, href: 'https://www.youtube.com/results?search_query=' + q },
      { label: 'IMDb',    icon: 'imdb',    bb: '#F5C518', bt: '#000000', bi: TO_BLACK, href: item.imdbUrl || ('https://www.imdb.com/find/?q=' + q) },
      { label: 'Trakt',   icon: 'trakt',   bb: '#9F42C6', bt: '#ffffff', bi: TO_WHITE, href: item.traktUrl || ('https://trakt.tv/search?query=' + q) }
    ];
    if (item.isAnime) defs.push({ label: 'Crunchyroll', icon: 'crunchyroll', bb: '#F47521', bt: '#ffffff', bi: TO_WHITE, href: 'https://www.crunchyroll.com/search?q=' + q });
    return defs;
  }

  function fillBtns(container, defs) {
    container.innerHTML = '';
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      var a = document.createElement('a');
      a.className = 'dks-btn';
      a.style.setProperty('--bb', d.bb);
      a.style.setProperty('--bt', d.bt);
      a.style.setProperty('--bi', d.bi);
      a.href = d.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      if (d.icon) {
        var ico = document.createElement('img');
        ico.src = 'https://cdn.simpleicons.org/' + d.icon + '/' + ICO_REST;
        ico.alt = '';
        ico.setAttribute('aria-hidden', 'true');
        a.appendChild(ico);
      }
      a.appendChild(document.createTextNode(d.label));
      container.appendChild(a);
    }
  }

  function musicBtnDefs(track, artist) {
    var q = encodeURIComponent(track + ' ' + artist);
    return MUSIC_BRANDS.map(function (b) {
      return { label: b.label, icon: b.icon, bb: b.bb, bt: b.bt, bi: b.bi, href: b.url + q };
    });
  }

  /* ─── 2-letter tile code from a title ─── */
  function codeFor(title) {
    if (!title) return '··';
    var words = String(title).replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
    if (!words.length) return String(title).slice(0, 2).toUpperCase();
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  /* ─── Trakt stores ratings as 1-10; its UI shows 5 stars in .5 steps ─── */
  function stars(score10) {
    var s = Math.round(score10) / 2;
    return (s % 1 === 0) ? String(s) : s.toFixed(1);
  }

  /* Literal star glyphs: 9/10 → ★★★★ + half star (clipped glyph) */
  function starsMarkup(score10) {
    var s = Math.round(score10) / 2;
    var full = Math.floor(s);
    var html = '';
    for (var i = 0; i < full; i++) html += '<span class="dks-star">★</span>';
    if (s - full >= 0.5) html += '<span class="dks-star-half">★</span>';
    return html;
  }

  /* ─── Relative time (unix seconds) ─── */
  function relTime(unixSec) {
    if (!unixSec) return '';
    var s = Math.max(0, Math.floor(Date.now() / 1000) - unixSec);
    if (s < 3600)        return Math.max(1, Math.floor(s / 60)) + 'm ago';
    if (s < 86400)       return Math.floor(s / 3600) + 'h ago';
    if (s < 86400 * 7)   return Math.floor(s / 86400) + 'd ago';
    if (s < 86400 * 30)  return Math.floor(s / (86400 * 7)) + 'w ago';
    if (s < 86400 * 365) return Math.floor(s / (86400 * 30)) + 'mo ago';
    return Math.floor(s / (86400 * 365)) + 'y ago';
  }

  /* ═══ Music cover-art resolution (unchanged plumbing: CAA → Deezer → iTunes) ═══ */
  function cleanStr(s) {
    if (!s) return '';
    s = s.replace(/\s+(feat\.|ft\.|featuring)\s+.*/i, '');
    s = s.split('(')[0].split('[')[0];
    return s.replace(/\s+/g, ' ').trim();
  }
  function normTitle(s) {
    if (!s) return '';
    s = cleanStr(s).toLowerCase().replace(/&/g, ' and ');
    s = s.replace(/[^a-z0-9]+/g, ' ');
    return s.replace(/\s+/g, ' ').trim();
  }
  function titlesMatch(a, b) {
    a = normTitle(a); b = normTitle(b);
    if (!a || !b) return false;
    return a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
  }
  function scoreCandidate(cArtist, cTrack, cAlbum, artist, track, album) {
    if (!titlesMatch(cArtist, artist)) return 0;
    var tOk = titlesMatch(cTrack, track);
    var albOk = album ? titlesMatch(cAlbum, album) : false;
    if (!tOk && !albOk) return 0;
    return 1 + (tOk ? 2 : 0) + (albOk ? 2 : 0);
  }
  function getCoverInfo(t) {
    var meta = t.track_metadata || t;
    var map = meta.mbid_mapping || {};
    var add = meta.additional_info || {};
    var caaId = map.caa_id || t.caa_id || null;
    var caaRel = map.caa_release_mbid || t.caa_release_mbid || null;
    if (caaId && caaRel) {
      return { type: 'direct', url: 'https://archive.org/download/mbid-' + caaRel + '/mbid-' + caaRel + '-' + caaId + '_thumb250.jpg' };
    }
    var mbid = map.release_mbid || add.release_mbid || t.release_mbid || null;
    if (mbid) return { type: 'caa', mbid: mbid, isGroup: false };
    var rgmbid = add.release_group_mbid || t.release_group_mbid || null;
    if (rgmbid) return { type: 'caa', mbid: rgmbid, isGroup: true };
    return null;
  }
  function fetchCaaUrl(mbid, isGroup) {
    var endpoint = 'https://coverartarchive.org/' + (isGroup ? 'release-group' : 'release') + '/' + mbid;
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 8000) : null;
    return fetch(endpoint, ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { if (timer) clearTimeout(timer); if (!r.ok) return null; return r.json(); })
      .then(function (data) {
        if (!data || !data.images || !data.images.length) return null;
        var img = null;
        for (var i = 0; i < data.images.length; i++) { if (data.images[i].front) { img = data.images[i]; break; } }
        if (!img) img = data.images[0];
        return (img.thumbnails && (img.thumbnails['250'] || img.thumbnails.small)) || img.image || null;
      })
      .catch(function () { if (timer) clearTimeout(timer); return null; });
  }
  var jsonpSeq = 0;
  function jsonp(url, timeoutMs) {
    return new Promise(function (resolve) {
      var cb = '__dksJsonp' + (jsonpSeq++);
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
      var timer = setTimeout(function () { finish(null); }, timeoutMs || 8000);
      window[cb] = function (data) { finish(data); };
      script.onerror = function () { finish(null); };
      script.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'output=jsonp&callback=' + cb;
      (document.head || document.documentElement).appendChild(script);
    });
  }
  function fetchDeezerUrl(artist, track, album) {
    var url = 'https://api.deezer.com/search?q=' + encodeURIComponent(cleanStr(artist) + ' ' + cleanStr(track)) + '&limit=10';
    return jsonp(url, 8000).then(function (data) {
      if (!data || !data.data || !data.data.length) return null;
      var best = null, bestScore = 0;
      for (var i = 0; i < data.data.length; i++) {
        var r = data.data[i];
        var s = scoreCandidate(r.artist && r.artist.name, r.title, r.album && r.album.title, artist, track, album);
        if (s > bestScore) { bestScore = s; best = r; }
      }
      if (!best || !best.album) return null;
      var u = best.album.cover_medium || best.album.cover_big || best.album.cover || '';
      if (!u || u.indexOf('/cover//') !== -1) return null;
      return u;
    });
  }
  function fetchItunesUrl(artist, track, album) {
    var q = encodeURIComponent(cleanStr(artist) + ' ' + cleanStr(track));
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 8000) : null;
    return fetch('https://itunes.apple.com/search?term=' + q + '&entity=song&limit=10&media=music', ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { if (timer) clearTimeout(timer); if (!r.ok) return null; return r.json(); })
      .then(function (data) {
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
      .catch(function () { if (timer) clearTimeout(timer); return null; });
  }
  var artCache = {};
  function loadCoverArt(imgEl, artist, track, album, info) {
    var cacheKey = (artist + '||' + track).toLowerCase();
    function show(url) {
      artCache[cacheKey] = url;
      imgEl.onload = function () { imgEl.style.display = 'block'; };
      imgEl.onerror = function () {
        if (!imgEl.dataset.fallbackTried) {
          imgEl.dataset.fallbackTried = '1';
          fallbacks().then(done);
        } else { artCache[cacheKey] = 'none'; }
      };
      imgEl.src = url;
    }
    function done(url) { if (url) show(url); else artCache[cacheKey] = 'none'; }
    function fallbacks() {
      return fetchDeezerUrl(artist, track, album).then(function (url) {
        return url ? url : fetchItunesUrl(artist, track, album);
      });
    }
    if (artCache[cacheKey]) {
      if (artCache[cacheKey] !== 'none') show(artCache[cacheKey]);
      return;
    }
    if (!info) { fallbacks().then(done); return; }
    if (info.type === 'direct') { show(info.url); return; }
    fetchCaaUrl(info.mbid, info.isGroup).then(function (url) {
      if (url) { show(url); return; }
      if (!info.isGroup) {
        fetchCaaUrl(info.mbid, true).then(function (url2) {
          if (url2) { show(url2); return; }
          fallbacks().then(done);
        });
      } else { fallbacks().then(done); }
    });
  }
  function loadPoster(imgEl, url) {
    if (!url) return;
    imgEl.onload = function () { imgEl.style.display = 'block'; };
    imgEl.onerror = function () { imgEl.style.display = 'none'; };
    imgEl.src = url;
  }

  /* ═══ SKELETON ═══════════════════════════════════════════════════════════ */
  var mount = document.getElementById('dks-shelf');
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'dks-shelf';
    (document.currentScript && document.currentScript.parentNode || document.body).appendChild(mount);
  }
  mount.innerHTML =
    '<div class="dks-card">' +
      '<div class="dks-header">' +
        '<span class="dks-title">Dalek’s Shelf</span>' +
        '<span class="dks-src">' +
          '<a class="dks-src-link" href="https://trakt.tv/users/dalekcoffee" target="_blank" rel="noopener noreferrer">Trakt</a>' +
          ' · ' +
          '<a class="dks-src-link" href="https://listenbrainz.org/user/Dalek.coffee/stats/?range=year" target="_blank" rel="noopener noreferrer">ListenBrainz</a>' +
        '</span>' +
      '</div>' +
      '<div class="dks-np idle" id="dks-np">' +
        '<div class="dks-np-head" id="dks-np-head">' +
          '<div class="dks-np-left">' +
            '<span class="dks-np-dot"></span>' +
            '<span class="dks-np-label" id="dks-np-label">Nothing Playing</span>' +
            '<span class="dks-np-sub dks-hide" id="dks-np-sub"></span>' +
          '</div>' +
          '<span class="dks-np-chev dks-hide" id="dks-np-chev">▾</span>' +
        '</div>' +
        '<div class="dks-np-body" id="dks-np-body">' +
          '<div class="dks-np-grid">' +
            '<div class="dks-tile dks-tile-64" id="dks-np-tile"><span id="dks-np-code"></span><img id="dks-np-img" alt=""></div>' +
            '<div style="min-width:0">' +
              '<div class="dks-np-title" id="dks-np-title"></div>' +
              '<div class="dks-np-artist" id="dks-np-artist"></div>' +
            '</div>' +
          '</div>' +
          '<div class="dks-np-btns dks-btns" id="dks-np-btns"></div>' +
        '</div>' +
      '</div>' +
      '<div class="dks-section">' +
        '<div class="dks-sec-head">' +
          '<span class="dks-sec-label">♪ Top Listens</span>' +
          '<div class="dks-tabs" id="dks-tabs">' +
            '<button class="dks-tab" data-r="this_month">Month</button>' +
            '<button class="dks-tab active" data-r="this_year">Year</button>' +
            '<button class="dks-tab" data-r="all_time">All Time</button>' +
          '</div>' +
        '</div>' +
        '<div class="dks-list" id="dks-list"></div>' +
      '</div>' +
      '<div class="dks-section">' +
        '<div class="dks-sec-head">' +
          '<span class="dks-sec-label">▤ On Screen</span>' +
          '<div class="dks-tabs" id="dks-watch-tabs">' +
            '<button class="dks-tab active" data-r="watching">Watching</button>' +
            '<button class="dks-tab" data-r="recent">Recent</button>' +
          '</div>' +
        '</div>' +
        '<div class="dks-strip" id="dks-watch-strip"></div>' +
        '<div class="dks-zone" id="dks-watch-zone">' +
          '<div class="dks-caret" id="dks-watch-caret"></div>' +
          '<div class="dks-prompt"><span>Hover a poster for progress + platform links</span></div>' +
          '<div class="dks-detail" id="dks-watch-detail"></div>' +
        '</div>' +
      '</div>' +
      '<div class="dks-section">' +
        '<div class="dks-sec-head">' +
          '<span class="dks-sec-label">★ Best Of</span>' +
          '<div class="dks-tabs" id="dks-fav-tabs">' +
            '<button class="dks-tab active" data-r="favorites">Favorites</button>' +
            '<button class="dks-tab" data-r="toprated">Top Rated</button>' +
          '</div>' +
        '</div>' +
        '<div class="dks-strip" id="dks-fav-strip"></div>' +
        '<div class="dks-zone" id="dks-fav-zone">' +
          '<div class="dks-caret" id="dks-fav-caret"></div>' +
          '<div class="dks-prompt"><span>Hover a poster for rating + platform links</span></div>' +
          '<div class="dks-detail" id="dks-fav-detail"></div>' +
        '</div>' +
      '</div>' +
    '</div>';

  function el(id) { return document.getElementById(id); }

  /* ═══ UNIFIED NOW PLAYING (music + Trakt, latest activity wins) ═══════════ */
  var npOpen = true;
  var liveState = {
    music: { active: false, key: null, track: null, changedAt: 0 },
    video: { active: false, key: null, data: null, changedAt: 0 }
  };
  var liveRenderedKey = null;

  el('dks-np-head').addEventListener('click', function () {
    if (el('dks-np').classList.contains('idle')) return;
    npOpen = !npOpen;
    syncNpChrome();
  });

  function currentLiveMode() {
    var m = liveState.music, v = liveState.video;
    if (m.active && v.active) return (v.changedAt >= m.changedAt) ? 'video' : 'music';
    if (m.active) return 'music';
    if (v.active) return 'video';
    return null;
  }

  function syncNpChrome() {
    var mode = currentLiveMode();
    var np = el('dks-np');
    var sub = el('dks-np-sub');
    var chev = el('dks-np-chev');
    var body = el('dks-np-body');
    if (!mode) {
      np.classList.add('idle');
      el('dks-np-label').textContent = 'Nothing Playing';
      sub.classList.add('dks-hide');
      chev.classList.add('dks-hide');
      body.classList.remove('open');
      return;
    }
    np.classList.remove('idle');
    el('dks-np-label').textContent = mode === 'music' ? 'Now Playing' : 'Now Watching';
    chev.classList.remove('dks-hide');
    chev.textContent = npOpen ? '▾' : '▸';
    body.classList.toggle('open', npOpen);
    var title = mode === 'music'
      ? (liveState.music.track ? liveState.music.track.track_metadata.track_name : '')
      : (liveState.video.data ? liveState.video.data.title : '');
    sub.textContent = '— ' + title;
    sub.classList.toggle('dks-hide', npOpen);
  }

  function updateLiveStrip() {
    var mode = currentLiveMode();
    syncNpChrome();
    if (!mode) { liveRenderedKey = null; return; }

    var key = mode + ':' + (mode === 'music' ? liveState.music.key : liveState.video.key);
    if (key === liveRenderedKey) return;
    liveRenderedKey = key;

    var img = el('dks-np-img');
    img.style.display = 'none';
    img.removeAttribute('src');
    delete img.dataset.fallbackTried;

    if (mode === 'music') {
      var md = liveState.music.track.track_metadata;
      el('dks-np-code').textContent = codeFor(md.track_name);
      el('dks-np-title').textContent = md.track_name;
      el('dks-np-artist').textContent = md.artist_name;
      fillBtns(el('dks-np-btns'), musicBtnDefs(md.track_name, md.artist_name));
      loadCoverArt(img, md.artist_name, md.track_name, md.release_name, getCoverInfo(liveState.music.track));
    } else {
      var d = liveState.video.data;
      var sub;
      if (d.type === 'movie') {
        sub = 'Film';
      } else {
        sub = (d.season && d.season > 1 ? 'S' + d.season + ' · ' : '') + 'EP ' + (d.episode || '?');
        if (d.totalEpisodes) sub += ' / ' + d.totalEpisodes;
        if (d.episodeTitle) sub += ' — ' + d.episodeTitle;
      }
      el('dks-np-code').textContent = codeFor(d.title);
      el('dks-np-title').textContent = d.title || 'Unknown';
      el('dks-np-artist').textContent = sub;
      fillBtns(el('dks-np-btns'), mediaBrandDefs(d));
      loadPoster(img, d.poster);
    }
  }

  /* ── Music now-playing poll (3.5 min, visibility-aware) ── */
  var npTimer = null;
  var NP_INTERVAL = 210000;
  function scheduleNextPoll(delay) {
    if (MOCK) return;
    clearTimeout(npTimer);
    npTimer = setTimeout(function () {
      if (!document.hidden) pollNowPlaying();
      else scheduleNextPoll(NP_INTERVAL);
    }, delay !== undefined ? delay : NP_INTERVAL);
  }
  function applyMusicNP(d) {
    var track = (d && d.playing) ? d.track : null;
    var key = (track && track.track_metadata)
      ? track.track_metadata.track_name + '||' + track.track_metadata.artist_name
      : null;
    if (key !== liveState.music.key) liveState.music.changedAt = Date.now();
    liveState.music.key = key;
    liveState.music.active = !!key;
    liveState.music.track = key ? track : null;
    updateLiveStrip();
  }
  function pollNowPlaying() {
    if (MOCK) { applyMusicNP(mockMusicNP()); return; }
    fetch(N8N_NP_WEBHOOK + '?range=now_playing&t=' + Date.now())
      .then(function (r) {
        if (!r.ok) { scheduleNextPoll(); return null; }
        scheduleNextPoll();
        return r.json();
      })
      .then(function (d) { if (d) applyMusicNP(d); })
      .catch(function () { scheduleNextPoll(); });
  }

  /* ── Trakt now-watching poll (90 s; server caches 60 s) ── */
  var nwTimer = null;
  var NW_INTERVAL = 90000;
  function scheduleNextNWPoll(delay) {
    if (MOCK) return;
    clearTimeout(nwTimer);
    nwTimer = setTimeout(function () {
      if (!document.hidden) pollNowWatching();
      else scheduleNextNWPoll(NW_INTERVAL);
    }, delay !== undefined ? delay : NW_INTERVAL);
  }
  function applyVideoNW(d) {
    var active = !!(d && d.watching);
    liveState.video.active = active;
    liveState.video.data = active ? d : null;
    liveState.video.key = active ? (d.title + ':' + (d.season || '') + ':' + (d.episode || '')) : null;
    if (d && d.updated_at) liveState.video.changedAt = d.updated_at;
    updateLiveStrip();
  }
  function pollNowWatching() {
    if (MOCK) { applyVideoNW(mockVideoLive()); return; }
    if (!N8N_TRAKT_FEED_WEBHOOK) return;
    fetch(N8N_TRAKT_FEED_WEBHOOK + '?range=now&t=' + Date.now())
      .then(function (r) {
        if (!r.ok) { scheduleNextNWPoll(); return null; }
        scheduleNextNWPoll();
        return r.json();
      })
      .then(function (d) { if (d) applyVideoNW(d); })
      .catch(function () { scheduleNextNWPoll(); });
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      clearTimeout(npTimer); pollNowPlaying();
      clearTimeout(nwTimer); pollNowWatching();
    }
  });

  /* ═══ TOP LISTENS ══════════════════════════════════════════════════════════ */
  var dataCache = {};
  var currentRange = 'this_year';

  el('dks-tabs').addEventListener('click', function (e) {
    var r = e.target.dataset && e.target.dataset.r;
    if (!r || r === currentRange) return;
    var tabs = el('dks-tabs').querySelectorAll('.dks-tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
    e.target.classList.add('active');
    currentRange = r;
    loadMusic(r);
  });

  function buildMusicRow(t, idx) {
    var meta = t.track_metadata || t;
    var name = meta.track_name || 'Unknown';
    var artist = meta.artist_name || 'Unknown';
    var album = meta.release_name || '';

    var row = document.createElement('div'); row.className = 'dks-row';

    var rank = document.createElement('div'); rank.className = 'dks-rank'; rank.textContent = idx + 1;

    var tile = document.createElement('div'); tile.className = 'dks-tile dks-tile-60';
    var code = document.createElement('span'); code.textContent = codeFor(name);
    var img = document.createElement('img'); img.alt = '';
    tile.appendChild(code); tile.appendChild(img);

    var info = document.createElement('div'); info.className = 'dks-row-info';
    var title = document.createElement('div'); title.className = 'dks-row-title'; title.textContent = name;
    var art = document.createElement('div'); art.className = 'dks-row-artist'; art.textContent = artist;
    var btns = document.createElement('div'); btns.className = 'dks-row-btns dks-btns';
    fillBtns(btns, musicBtnDefs(name, artist));
    info.appendChild(title); info.appendChild(art); info.appendChild(btns);

    var plays = document.createElement('div'); plays.className = 'dks-plays';
    plays.textContent = t.listen_count || '0';

    row.appendChild(rank); row.appendChild(tile); row.appendChild(info); row.appendChild(plays);

    var coverInfo = getCoverInfo(t);
    setTimeout(function () { loadCoverArt(img, artist, name, album, coverInfo); }, idx * 80);
    return row;
  }

  function renderMusic(tracks, range) {
    var list = el('dks-list');
    list.innerHTML = '';
    if (!tracks || !tracks.length) {
      var empty = document.createElement('div');
      empty.className = 'dks-empty';
      empty.textContent = range === 'this_month'
        ? 'Monthly stats are still processing — check back soon'
        : 'No listens for this range yet';
      list.appendChild(empty);
      return;
    }
    for (var i = 0; i < tracks.length; i++) list.appendChild(buildMusicRow(tracks[i], i));
  }

  function loadMusic(range) {
    if (dataCache[range]) { renderMusic(dataCache[range], range); return; }
    if (MOCK) { dataCache[range] = mockTracks(range); renderMusic(dataCache[range], range); return; }

    var url = N8N_STATS_WEBHOOK
      ? N8N_STATS_WEBHOOK + '?range=' + encodeURIComponent(range) + '&t=' + Date.now()
      : 'https://api.listenbrainz.org/1/stats/user/' + LB_USER + '/recordings?range=' + range + '&count=10';

    fetch(url)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        var tracks = d.tracks || (d.payload && d.payload.recordings) || [];
        dataCache[range] = tracks;
        if (range === currentRange) renderMusic(tracks, range);
      })
      .catch(function () {});
  }

  /* ═══ POSTER STRIPS (Currently Watching / Favorites) ══════════════════════ */
  var POSTER_PITCH = 118; /* 104 poster + 14 gap */
  var stripState = { watch: { idx: 0, entries: [], mode: 'watching' }, fav: { idx: 0, entries: [], mode: 'favorites' } };

  function caretUpdate(kind) {
    var st = stripState[kind];
    var strip = el('dks-' + kind + '-strip');
    el('dks-' + kind + '-caret').style.left = (st.idx * POSTER_PITCH + 45 - strip.scrollLeft) + 'px';
  }

  function fillWatchDetail(e) {
    var d = el('dks-watch-detail');
    var epText = 'EP ' + (e.epWatched || 0) + (e.epTotal ? ' / ' + e.epTotal : '');
    var pct = e.epTotal ? Math.round((e.epWatched / e.epTotal) * 100) : null;
    d.innerHTML =
      '<div class="dks-d-row1"><span class="dks-d-title"></span><span class="dks-d-ep"></span></div>' +
      '<div class="dks-d-bar"><div class="dks-bar-fill"></div></div>' +
      '<div class="dks-d-meta-row"><span class="dks-d-meta"></span><div class="dks-btns"></div></div>';
    d.querySelector('.dks-d-title').textContent = e.title;
    d.querySelector('.dks-d-ep').textContent = epText + (pct !== null ? ' · ' + pct + '%' : '');
    d.querySelector('.dks-bar-fill').style.width = (pct || 0) + '%';
    d.querySelector('.dks-d-meta').textContent = (e.kind || 'SERIES') + ' · ' + (relTime(e.updatedAt) || 'recently');
    fillBtns(d.querySelector('.dks-btns'), mediaBrandDefs(e));
  }

  function epLabel(e) {
    if (e.type === 'movie') return 'Movie';
    var s = (e.season && e.season > 1 ? 'S' + e.season + ' · ' : '') + 'E' + (e.number || '?');
    if (e.episodeTitle) s += ' — ' + e.episodeTitle;
    return s;
  }

  function fillRecentDetail(e) {
    var d = el('dks-watch-detail');
    d.innerHTML =
      '<div class="dks-d-row1"><span class="dks-d-title"></span><span class="dks-d-ep"></span></div>' +
      '<div class="dks-d-meta-row"><span class="dks-d-meta"></span><div class="dks-btns"></div></div>';
    d.querySelector('.dks-d-title').textContent = e.title;
    d.querySelector('.dks-d-ep').textContent = epLabel(e);
    d.querySelector('.dks-d-meta').textContent = (e.kind || 'SERIES') + ' · ' + (relTime(e.watchedAt) || 'recently');
    fillBtns(d.querySelector('.dks-btns'), mediaBrandDefs(e));
  }

  function fillFavDetail(e) {
    var d = el('dks-fav-detail');
    d.innerHTML =
      '<div class="dks-d-row1"><span class="dks-d-title"></span><span class="dks-d-score"></span></div>' +
      '<div class="dks-d-meta fav"></div>' +
      '<div class="dks-d-note"></div>' +
      '<div class="dks-d-notedate"></div>' +
      '<div class="dks-btns"></div>';
    d.querySelector('.dks-d-title').textContent = e.title;
    if (e.score) {
      d.querySelector('.dks-d-score').innerHTML = starsMarkup(e.score);
      d.querySelector('.dks-d-score').title = stars(e.score) + '/5';
    } else {
      d.querySelector('.dks-d-score').textContent = '—';
    }
    d.querySelector('.dks-d-meta').textContent = e.meta || (e.kind || '');
    var noteEl = d.querySelector('.dks-d-note');
    noteEl.textContent = e.note || '';
    noteEl.classList.toggle('dks-hide', !e.note);
    var dateEl = d.querySelector('.dks-d-notedate');
    var showDate = e.note && e.noteDate;
    dateEl.textContent = showDate ? 'Reviewed ' + e.noteDate : '';
    dateEl.classList.toggle('dks-hide', !showDate);
    fillBtns(d.querySelector('.dks-btns'), mediaBrandDefs(e));
  }

  function selectPoster(kind, idx) {
    var st = stripState[kind];
    st.idx = idx;
    var strip = el('dks-' + kind + '-strip');
    var posters = strip.querySelectorAll('.dks-poster');
    for (var i = 0; i < posters.length; i++) posters[i].classList.toggle('ring', i === idx);
    el('dks-' + kind + '-zone').classList.add('live');
    caretUpdate(kind);
    if (kind === 'watch') {
      if (st.mode === 'recent') fillRecentDetail(st.entries[idx]);
      else fillWatchDetail(st.entries[idx]);
    } else fillFavDetail(st.entries[idx]);
  }

  function renderStrip(kind, entries, mode) {
    var st = stripState[kind];
    st.entries = entries || [];
    st.mode = mode || (kind === 'fav' ? 'favorites' : 'watching');
    st.idx = 0;
    var strip = el('dks-' + kind + '-strip');
    var zone = el('dks-' + kind + '-zone');
    strip.innerHTML = '';
    zone.classList.remove('live');

    if (!st.entries.length) {
      var empty = document.createElement('div');
      empty.className = 'dks-empty';
      empty.style.width = '100%';
      empty.textContent = (N8N_TRAKT_FEED_WEBHOOK || MOCK) ? 'Nothing here yet' : 'Trakt webhook not configured yet';
      strip.appendChild(empty);
      zone.classList.add('dks-hide');
      return;
    }
    zone.classList.remove('dks-hide');

    st.entries.forEach(function (e, i) {
      var wrap = document.createElement('div'); wrap.className = 'dks-poster-wrap';
      var poster = document.createElement('div'); poster.className = 'dks-poster';
      var code = document.createElement('span'); code.textContent = codeFor(e.title);
      poster.appendChild(code);
      var img = document.createElement('img'); img.alt = '';
      poster.appendChild(img);
      loadPoster(img, e.poster);

      if (kind === 'watch' && st.mode === 'recent') {
        var rol = document.createElement('div'); rol.className = 'dks-poster-ol';
        var rrow = document.createElement('div'); rrow.className = 'dks-ol-row';
        var rlab = document.createElement('span'); rlab.className = 'dks-ol-ep';
        rlab.textContent = e.type === 'movie' ? 'MOVIE' : ('S' + (e.season || 1) + 'E' + (e.number || '?'));
        var rtime = document.createElement('span'); rtime.className = 'dks-ol-ep';
        rtime.textContent = relTime(e.watchedAt) || '';
        rrow.appendChild(rlab); rrow.appendChild(rtime);
        rol.appendChild(rrow);
        poster.appendChild(rol);
      } else if (kind === 'watch') {
        var pct = e.epTotal ? Math.round((e.epWatched / e.epTotal) * 100) : null;
        var ol = document.createElement('div'); ol.className = 'dks-poster-ol';
        var row = document.createElement('div'); row.className = 'dks-ol-row';
        var ep = document.createElement('span'); ep.className = 'dks-ol-ep';
        ep.textContent = 'EP ' + (e.epWatched || 0) + (e.epTotal ? ' / ' + e.epTotal : '');
        row.appendChild(ep);
        if (pct !== null) {
          var pctEl = document.createElement('span'); pctEl.className = 'dks-ol-pct';
          pctEl.textContent = pct + '%';
          row.appendChild(pctEl);
        }
        ol.appendChild(row);
        if (pct !== null) {
          var bar = document.createElement('div'); bar.className = 'dks-bar';
          var fill = document.createElement('div'); fill.className = 'dks-bar-fill';
          fill.style.width = pct + '%';
          bar.appendChild(fill);
          ol.appendChild(bar);
        }
        poster.appendChild(ol);
      } else if (e.score) {
        var badge = document.createElement('span'); badge.className = 'dks-badge';
        badge.textContent = '★' + stars(e.score);
        poster.appendChild(badge);
      }

      var title = document.createElement('div'); title.className = 'dks-poster-title';
      title.textContent = e.title;

      wrap.appendChild(poster); wrap.appendChild(title);
      wrap.addEventListener('mouseenter', function () { selectPoster(kind, i); });
      wrap.addEventListener('click', function () { selectPoster(kind, i); }); /* touch */
      strip.appendChild(wrap);
    });

    /* Final prototype behavior: poster 0 pre-selected (ring + caret + detail),
       so the panel is populated without hover — required on touch devices. */
    selectPoster(kind, 0);
  }

  /* keep the caret glued to its poster while the strip scrolls (bound once) */
  ['watch', 'fav'].forEach(function (kind) {
    el('dks-' + kind + '-strip').addEventListener('scroll', function () { caretUpdate(kind); }, { passive: true });
  });

  /* which range is currently selected per strip, so a slow fetch from an
     inactive tab can't clobber the active one */
  var activeRange = { watch: 'watching', fav: 'favorites' };

  function loadFeedRange(range, kind) {
    var cacheKey = 'feed_' + range;
    if (dataCache[cacheKey]) { renderStrip(kind, dataCache[cacheKey], range); return; }
    if (MOCK) { dataCache[cacheKey] = mockFeedEntries(range); renderStrip(kind, dataCache[cacheKey], range); return; }
    if (!N8N_TRAKT_FEED_WEBHOOK) { renderStrip(kind, [], range); return; }
    fetch(N8N_TRAKT_FEED_WEBHOOK + '?range=' + range + '&t=' + Date.now())
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        var entries = (d && d.entries) || [];
        dataCache[cacheKey] = entries;
        if (!activeRange[kind] || range === activeRange[kind]) renderStrip(kind, entries, range);
      })
      .catch(function () { renderStrip(kind, [], range); });
  }

  function bindStripTabs(tabsId, kind) {
    var tabsEl = el(tabsId);
    if (!tabsEl) return;
    tabsEl.addEventListener('click', function (e) {
      var r = e.target.dataset && e.target.dataset.r;
      if (!r || r === activeRange[kind]) return;
      var tabs = tabsEl.querySelectorAll('.dks-tab');
      for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
      e.target.classList.add('active');
      activeRange[kind] = r;
      loadFeedRange(r, kind);
    });
  }

  /* ▤ On Screen → Watching | Recent, and ★ Best Of → Favorites | Top Rated */
  bindStripTabs('dks-watch-tabs', 'watch');
  bindStripTabs('dks-fav-tabs', 'fav');

  /* ═══ MOCK FIXTURES (sandbox only — ?mock=1) ══════════════════════════════ */
  var MOCK_LIVE = qp('live') || 'video';
  var MOCK_NEWER = qp('newer') || 'video';

  function mockMusicNP() {
    if (MOCK_LIVE !== 'music' && MOCK_LIVE !== 'both') return { playing: false, track: null };
    return { playing: true, track: { track_metadata: {
      track_name: 'Drive Off A Bridge', artist_name: 'JAKEY', release_name: 'Romcom'
    } } };
  }

  function mockVideoLive() {
    if (MOCK_LIVE !== 'video' && MOCK_LIVE !== 'both') return { watching: false, updated_at: Date.now() - 3600000 };
    return {
      watching: true, type: 'episode',
      title: 'Frieren: Beyond Journey’s End', episodeTitle: 'The Land Where Souls Rest',
      season: 1, episode: 18, totalEpisodes: 28, kind: 'ANIME', isAnime: true,
      poster: '', traktUrl: 'https://trakt.tv/shows/frieren-beyond-journey-s-end',
      imdbUrl: 'https://www.imdb.com/title/tt22248376/',
      updated_at: MOCK_NEWER === 'video' ? Date.now() + 5000 : Date.now() - 600000
    };
  }

  function mockFeedEntries(range) {
    var nowSec = Math.floor(Date.now() / 1000);
    if (range === 'toprated') return [
      { title: 'Mob Psycho 100', kind: 'ANIME', isAnime: true, score: 10, meta: 'ANIME · 37 EP', note: 'ONE writes restraint better than anyone — the whole show builds to quiet moments instead of shouting matches, and it lands every single time because the animation carries the emotion the dialogue refuses to spell out.', noteDate: '14 Mar 2026', poster: '', traktUrl: '', imdbUrl: '' },
      { title: 'The Bear', kind: 'SERIES', isAnime: false, score: 10, meta: 'SERIES · 46 EP', note: '', poster: '', traktUrl: '', imdbUrl: '' },
      { title: 'Vinland Saga', kind: 'ANIME', isAnime: true, score: 9, meta: 'ANIME · 48 EP', note: 'Best redemption arc in anime, full stop.', noteDate: '2 Jan 2026', poster: '', traktUrl: '', imdbUrl: '' }
    ];
    if (range === 'recent') return [
      { title: 'Frieren: Beyond Journey’s End', kind: 'ANIME', isAnime: true, type: 'episode', season: 1, number: 18, episodeTitle: 'Aura the Guillotine', watchedAt: nowSec - 3 * 3600, poster: '', traktUrl: '', imdbUrl: '' },
      { title: 'Rick and Morty', kind: 'SERIES', isAnime: false, type: 'episode', season: 9, number: 2, episodeTitle: 'Rick, Bts, Sev...', watchedAt: nowSec - 86400, poster: '', traktUrl: '', imdbUrl: '' },
      { title: 'Blade Runner 2049', kind: 'FILM', isAnime: false, type: 'movie', watchedAt: nowSec - 2 * 86400, poster: '', traktUrl: '', imdbUrl: '' },
      { title: 'Dan Da Dan', kind: 'ANIME', isAnime: true, type: 'episode', season: 1, number: 7, episodeTitle: 'A Dangerous Woman Arrives', watchedAt: nowSec - 4 * 86400, poster: '', traktUrl: '', imdbUrl: '' },
      { title: 'Severance', kind: 'SERIES', isAnime: false, type: 'episode', season: 2, number: 3, episodeTitle: 'Who Is Alive?', watchedAt: nowSec - 6 * 86400, poster: '', traktUrl: '', imdbUrl: '' }
    ];
    if (range === 'favorites') return [
      { title: 'Cowboy Bebop', kind: 'ANIME', isAnime: true, score: 10, meta: 'ANIME · 26 EP', note: 'Still the gold standard — every episode is a short film.', noteDate: '9 Feb 2026', poster: '', traktUrl: '', imdbUrl: '' },
      { title: 'Arcane', kind: 'SERIES', isAnime: false, score: 0, meta: 'SERIES · 18 EP', note: 'The animation ruined every other show for me.', noteDate: '21 Nov 2025', poster: '', traktUrl: '', imdbUrl: '' },
      { title: 'Vinland Saga', kind: 'ANIME', isAnime: true, score: 9, meta: 'ANIME · 48 EP', note: 'Best redemption arc in anime, full stop.', noteDate: '2 Jan 2026', poster: '', traktUrl: '', imdbUrl: '' },
      { title: 'Blade Runner 2049', kind: 'FILM', isAnime: false, score: 10, meta: 'FILM · 2H 44M', note: '', poster: '', traktUrl: '', imdbUrl: '' },
      { title: 'Perfect Blue', kind: 'FILM', isAnime: true, score: 9, meta: 'FILM · 1H 21M', note: 'Watched it once, thought about it for a year.', noteDate: '30 Dec 2025', poster: '', traktUrl: '', imdbUrl: '' }
    ];
    return [
      { title: 'Frieren: Beyond Journey’s End', kind: 'ANIME', isAnime: true, epWatched: 18, epTotal: 28, updatedAt: nowSec - 2 * 86400, poster: '', traktUrl: '', imdbUrl: '' },
      { title: 'Jujutsu Kaisen', kind: 'ANIME', isAnime: true, epWatched: 15, epTotal: 23, updatedAt: nowSec - 5 * 3600, poster: '', traktUrl: '', imdbUrl: '' },
      { title: 'Dan Da Dan', kind: 'ANIME', isAnime: true, epWatched: 7, epTotal: 12, updatedAt: nowSec - 86400, poster: '', traktUrl: '', imdbUrl: '' },
      { title: 'Severance', kind: 'SERIES', isAnime: false, epWatched: 4, epTotal: 10, updatedAt: nowSec - 3 * 86400, poster: '', traktUrl: '', imdbUrl: '' },
      { title: 'One Piece', kind: 'ANIME', isAnime: true, epWatched: 1088, epTotal: null, updatedAt: nowSec - 6 * 86400, poster: '', traktUrl: '', imdbUrl: '' },
      { title: 'The Bear', kind: 'SERIES', isAnime: false, epWatched: 5, epTotal: 10, updatedAt: nowSec - 7 * 86400, poster: '', traktUrl: '', imdbUrl: '' }
    ];
  }

  function mockTracks() {
    var mk = function (name, artist, album, count) {
      return { track_metadata: { track_name: name, artist_name: artist, release_name: album }, listen_count: count };
    };
    return [
      mk('Prize Fighter', 'Jean Dawson', 'Glimmer of God', 112),
      mk('Heavy Metal', 'Paris Texas', 'MID AIR', 95),
      mk('Rock A Bye Baby', 'Jean Dawson', 'CHAOS NOW*', 93),
      mk('Superstar Sh*t', 'Dominic Fike', 'Sunburn', 92),
      mk("Darlin'", 'Jean Dawson', 'Pixel Bath', 91),
      mk('DTMF', 'Bad Bunny', 'Debí Tirar Más Fotos', 90)
    ];
  }

  /* ═══ LOADING SKELETON — card renders full-size before any data arrives ═══ */
  function renderListPlaceholders() {
    var list = el('dks-list');
    list.innerHTML = '';
    for (var i = 0; i < 6; i++) {
      var row = document.createElement('div'); row.className = 'dks-row';
      var rank = document.createElement('div'); rank.className = 'dks-rank'; rank.textContent = i + 1;
      var tile = document.createElement('div'); tile.className = 'dks-tile dks-tile-60';
      var info = document.createElement('div'); info.className = 'dks-row-info';
      var l1 = document.createElement('div'); l1.className = 'dks-ph-line'; l1.style.width = (46 - i * 3) + '%';
      var l2 = document.createElement('div'); l2.className = 'dks-ph-line sub'; l2.style.width = (24 + (i % 3) * 5) + '%';
      info.appendChild(l1); info.appendChild(l2);
      row.appendChild(rank); row.appendChild(tile); row.appendChild(info); row.appendChild(document.createElement('div'));
      list.appendChild(row);
    }
  }

  function renderStripPlaceholders(kind) {
    var strip = el('dks-' + kind + '-strip');
    strip.innerHTML = '';
    for (var i = 0; i < 5; i++) {
      var wrap = document.createElement('div'); wrap.className = 'dks-poster-wrap'; wrap.style.cursor = 'default';
      var poster = document.createElement('div'); poster.className = 'dks-poster';
      var title = document.createElement('div'); title.className = 'dks-poster-title';
      var bar = document.createElement('div'); bar.className = 'dks-ph-line sub'; bar.style.width = (55 + (i % 3) * 15) + '%'; bar.style.marginTop = '0';
      title.appendChild(bar);
      wrap.appendChild(poster); wrap.appendChild(title);
      strip.appendChild(wrap);
    }
  }

  /* ═══ INIT ═════════════════════════════════════════════════════════════════ */
  renderListPlaceholders();
  renderStripPlaceholders('watch');
  renderStripPlaceholders('fav');
  setTimeout(function () {
    pollNowPlaying();
    pollNowWatching();
    loadMusic(currentRange);
    loadFeedRange('watching', 'watch');
    loadFeedRange('favorites', 'fav');
  }, 50);

})();
