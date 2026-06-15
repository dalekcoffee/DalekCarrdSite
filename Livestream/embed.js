(function () {
  'use strict';

  /* dalek.coffee livestream widget.
     Hosted: https://dalekcoffee.github.io/DalekCarrdSite/Livestream/embed.js
     Carrd:  <div id="ls-root"></div>
             <script src="https://dalekcoffee.github.io/DalekCarrdSite/Livestream/embed.js"></script>
     The mount div is optional — the script appends its own if absent. */

  var WEBHOOK = 'https://n8n.bakalabs.dev/webhook/93ca9fde-c08b-4e52-b9da-559011cb3665';

  /* Every domain the Twitch player/chat is embedded on must be listed as a parent.
     localhost is harmless in prod and lets the local preview load Twitch. */
  var PARENTS = ['dalek.coffee', 'dalekcoffeesandbox.carrd.co', 'localhost'];
  function parentQS() {
    return PARENTS.map(function (p) { return 'parent=' + p; }).join('&');
  }

  /* Beam = ad-free relay (raw iframe). Twitch = native JS player so we can mute/unmute
     it and drop its quality while it runs muted in the background. */
  var BEAM_SRC = 'https://beamstream.gg/dalek/embed';
  var TWITCH_CHANNEL = 'dalekcoffee';
  var CHAT_SRC = 'https://www.twitch.tv/embed/dalekcoffee/chat?' + parentQS() + '&darkpopout';

  var PLATFORMS = [
    { enabled: true,  name: 'Beamstream', url: 'https://beamstream.gg/dalek',             hover: '#285680', text: '#fff' },
    { enabled: true,  name: 'Twitch',     url: 'https://www.twitch.tv/dalekcoffee',       hover: '#a970ff', text: '#000' },
    { enabled: false, name: 'YouTube',    url: 'https://www.youtube.com/@dalek.coffee/live', hover: '#cc0000', text: '#fff' },
    { enabled: true,  name: 'TikTok',     url: 'https://www.tiktok.com/@dalekcoffee/live', hover: '#69c9d0', text: '#000' },
    { enabled: true,  name: 'Kick',       url: 'https://kick.com/dalekcoffee',            hover: '#53fc18', text: '#000' },
    { enabled: true,  name: 'Nimo.tv',    url: 'https://www.nimo.tv/live/1592342521',     hover: '#412771', text: '#fff' }
  ];

  /* ── MOUNT ── */
  var mount = document.getElementById('ls-root');
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'ls-root';
    (document.currentScript && document.currentScript.parentNode || document.body).appendChild(mount);
  }

  /* ── STYLES ── */
  if (!document.getElementById('ls-style')) {
    var st = document.createElement('style');
    st.id = 'ls-style';
    st.textContent = [
      '#ls-card{--t:.2s;--bg:#0d0d0d;--bg2:#111;--bg3:#191919;--b1:#1a1a1a;--tabH:48px;width:100%;max-width:63.5rem;margin:0 auto;background:var(--bg);color:#fff;border-top:2px solid #fff;border-bottom:1px solid var(--bg2);font-family:"Space Mono",monospace;-webkit-font-smoothing:antialiased}',
      '#ls-card *,#ls-card *::before,#ls-card *::after{box-sizing:border-box;margin:0}',

      /* strip */
      '.ls-strip{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid var(--bg2);cursor:pointer;user-select:none}',
      '.ls-strip:hover{background:rgba(255,255,255,.03)}',
      '.ls-strip-left{display:flex;align-items:center;gap:12px}',
      '.ls-status{font-size:12px;letter-spacing:.25em;text-transform:uppercase;font-weight:700;color:#fff}',
      '.ls-dot{width:10px;height:10px;border-radius:50%;background:#555}',
      '.ls-dot.ls-live{background:#ff3333;box-shadow:0 0 0 0 rgba(255,51,51,.7);animation:ls-pulse-red 1.5s infinite}',
      '.ls-toggle{display:flex;align-items:center;color:#555;transition:color .2s,transform .35s ease;flex-shrink:0;pointer-events:none}',
      '.ls-strip:hover .ls-toggle{color:#aaa}',
      '#ls-card.ls-open .ls-toggle{transform:rotate(180deg)}',

      /* body */
      '.ls-body{display:flex;flex-direction:column;overflow:hidden;max-height:0;opacity:0;background:var(--bg);transition:max-height .8s cubic-bezier(.4,0,.2,1),opacity .6s ease}',
      '#ls-card.ls-open .ls-body{max-height:3000px;opacity:1}',
      '.ls-banner{padding:10px 20px;border-bottom:1px solid var(--bg2);font-size:11px;letter-spacing:.05em;color:#fff;background:var(--bg)}',
      '.ls-embeds{display:flex;flex-direction:row}',
      '.ls-main{flex:3.5;min-width:0;display:flex;flex-direction:column;background:var(--bg)}',

      /* tabs */
      '.ls-vtabs{display:flex;height:var(--tabH);border-bottom:1px solid var(--b1);background:#0c0c0c}',
      '.ls-vtab{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:0 6px;text-align:center;cursor:pointer;background:none;border:none;border-right:1px solid var(--b1);border-bottom:2px solid transparent;color:rgba(255,255,255,.5);font-family:inherit;transition:background .2s,color .2s,border-color .2s,box-shadow .2s}',
      /* Beam is the primary choice — give it a wider tab than Twitch (+25% / -25%) */
      '.ls-vtab[data-tab="beam"]{flex:1.25}',
      '.ls-vtab[data-tab="twitch"]{flex:.75}',
      '.ls-vtab:last-child{border-right:none}',
      '.ls-vtab .vt-name{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;line-height:1}',
      '.ls-vtab .vt-tip{font-size:9px;letter-spacing:.04em;opacity:.7;line-height:1.1}',
      '.ls-vtab:hover{background:#141414;color:#fff}',
      '.ls-vtab:focus-visible{outline:2px solid var(--brand,#fff);outline-offset:-2px}',
      '.ls-vtab.active{background:#141414;color:#fff;border-bottom-color:var(--brand)}',
      '.ls-vtab.active .vt-name{color:var(--brand)}',
      '.ls-vtab.active{box-shadow:inset 0 -14px 20px -14px rgba(255,255,255,.18)}',
      '.ls-vtab.active{box-shadow:inset 0 -14px 20px -14px color-mix(in srgb,var(--brand) 60%,transparent)}',

      /* embeds */
      '.ls-video{position:relative;aspect-ratio:16/9;min-height:0;background:var(--bg)}',
      '.ls-vlayer{position:absolute;top:0;right:0;bottom:0;left:0}',
      '#ls-video.ls-show-beam #ls-beam,#ls-video.ls-show-twitch #ls-twitch{z-index:2}',
      '#ls-video.ls-show-beam #ls-twitch,#ls-video.ls-show-twitch #ls-beam{z-index:1}',
      '.ls-chat{flex:1;min-width:350px;display:flex;flex-direction:column;background:#18181b;border-left:1px solid var(--bg2)}',
      '.ls-chat-head{flex-shrink:0;display:flex;align-items:stretch;height:var(--tabH);background:#0c0c0c;border-bottom:1px solid var(--b1)}',
      '.ls-chat-head-spacer{flex:1;min-width:0}',
      '.ls-points{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;text-align:center;text-decoration:none;color:#fff;cursor:pointer;--brand:#a970ff;transition:background .2s,color .2s,box-shadow .2s}',
      '.ls-points .pts-main{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;line-height:1.1}',
      '.ls-points .pts-sub{font-size:8px;letter-spacing:.03em;opacity:.65;line-height:1.1}',
      '.ls-points .pts-launch{vertical-align:-2px;flex-shrink:0}',
      '.ls-points:hover,.ls-points:active{background:#141414;box-shadow:inset 0 -2px 0 var(--brand)}',
      '.ls-points:hover .pts-main,.ls-points:active .pts-main{color:var(--brand)}',
      '.ls-points:focus-visible{outline:2px solid var(--brand);outline-offset:-2px}',
      '.ls-points.ls-pulse{animation:ls-pts-pulse 4.2s ease-out}',
      '.ls-points.ls-pulse .pts-main{animation:ls-pts-text 4.2s ease-out}',
      '@keyframes ls-pts-pulse{0%{box-shadow:0 0 0 0 rgba(169,112,255,.5)}35%{background:#171029}70%{box-shadow:0 0 0 12px rgba(169,112,255,0)}100%{background:#0c0c0c;box-shadow:0 0 0 0 rgba(169,112,255,0)}}',
      '@keyframes ls-pts-text{0%,100%{color:#fff}30%{color:var(--brand)}}',
      '.ls-chat-frame{position:relative;flex:1;min-height:0;background:#18181b}',
      '#ls-card iframe{position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;display:block;border:none;background:transparent}',

      /* skeleton */
      '.ls-skeleton{position:absolute;top:0;right:0;bottom:0;left:0;z-index:2;display:flex;align-items:center;justify-content:center;font-size:10px;letter-spacing:.25em;text-transform:uppercase;color:rgba(255,255,255,.25);background:var(--bg);overflow:hidden}',
      '.ls-chat .ls-skeleton{background:#18181b}',
      '.ls-skeleton::before{content:"";position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.04),transparent);animation:ls-wipe 1.8s infinite linear}',
      '@keyframes ls-wipe{0%{left:-100%}100%{left:100%}}',

      /* platforms */
      '.ls-platforms{padding:15px 20px;border-top:1px solid var(--bg2);background:var(--bg);display:flex;flex-direction:column;gap:10px}',
      '.ls-also{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#fff;font-weight:700}',
      '.ls-btns{display:flex;gap:8px;flex-wrap:wrap}',
      '.ls-btn{display:inline-flex;align-items:center;background:#fff;color:#000;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;padding:8px 12px;opacity:.7;transition:background .2s,color .2s,box-shadow .2s}',
      '.ls-btn:hover{opacity:1;background:var(--b-hover);color:var(--b-text);box-shadow:0 0 10px var(--b-hover)}',

      '@keyframes ls-pulse-red{0%{transform:scale(.95);box-shadow:0 0 0 0 rgba(255,51,51,.7)}70%{transform:scale(1);box-shadow:0 0 0 8px rgba(255,51,51,0)}100%{transform:scale(.95);box-shadow:0 0 0 0 rgba(255,51,51,0)}}',

      /* fullscreen control — a single theater toggle, in the chat header */
      '.ls-fs-btn{display:inline-flex;align-items:center;justify-content:center;width:46px;flex-shrink:0;padding:0;background:none;border:none;color:rgba(255,255,255,.55);cursor:pointer;font-family:inherit;transition:background .2s,color .2s,box-shadow .2s}',
      '.ls-fs-btn svg{width:17px;height:17px;display:block}',
      '.ls-fs-btn:hover,.ls-fs-btn:active{color:var(--brand,#fff);background:#141414}',
      '.ls-fs-btn:focus-visible{outline:2px solid var(--brand,#fff);outline-offset:-2px}',
      '.fs-i-contract{display:none}',
      '.ls-fs-btn.is-active .fs-i-expand{display:none}',
      '.ls-fs-btn.is-active .fs-i-contract{display:block}',
      '.ls-theater-btn{border-left:1px solid var(--b1);--brand:#a970ff}',
      /* fullscreen states — driven by our own classes so the same CSS covers the */
      /* native Fullscreen API and the iOS fixed-position fallback below */
      '.ls-pseudofs{position:fixed;top:0;left:0;width:100%;height:100%;max-width:none;z-index:2147483646;background:#000}',
      '.ls-fs-lock{overflow:hidden}',
      '.ls-embeds.ls-fs-theater{width:100%;height:100%;max-width:none;background:#000}',
      /* once fullscreen, the trigger hides and the injected close (✕) takes over */
      '.ls-embeds.ls-fs-theater .ls-theater-btn{display:none}',
      '@media (min-width:1025px){.ls-embeds.ls-fs-theater .ls-main{height:100%}.ls-embeds.ls-fs-theater .ls-video{aspect-ratio:auto;flex:1;min-height:0;max-width:none}}',
      '@media (max-width:1024px){.ls-embeds.ls-fs-theater{flex-direction:column}.ls-embeds.ls-fs-theater .ls-main{flex:0 0 auto}.ls-embeds.ls-fs-theater .ls-chat{flex:1 1 auto;min-height:0}.ls-embeds.ls-fs-theater .ls-chat-frame{height:auto;flex:1;min-height:0}}',
      /* injected close button (top-right) — the in-fullscreen exit affordance */
      '.ls-fs-exit{position:absolute;top:10px;right:10px;z-index:12;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.25);color:#fff;cursor:pointer}',
      '.ls-fs-exit svg{width:18px;height:18px;display:block}',
      '.ls-fs-exit:hover,.ls-fs-exit:active{background:rgba(0,0,0,.85)}',
      '.ls-fs-exit:focus-visible{outline:2px solid #fff;outline-offset:-2px}',

      /* mobile */
      '@media (min-width:481px){.ls-status{font-size:14px}}',
      '@media (max-width:1024px){',
        '.ls-embeds{flex-direction:column}',
        '.ls-chat{flex:none;width:100%;min-width:0;border-left:none;border-top:1px solid var(--bg2)}',
        '.ls-chat-frame{height:522px}',
      '}'
    ].join('');
    document.head.appendChild(st);
  }

  /* ── MARKUP ── */
  /* Expand + contract glyphs live together in the toggle button; CSS swaps which
     one shows via the .is-active class. FS_X_ICON is the in-fullscreen close (✕). */
  var FS_ICONS =
    '<svg class="fs-i-expand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M21 3l-7 7M9 21H3v-6M3 21l7-7"/></svg>' +
    '<svg class="fs-i-contract" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14h6v6M10 14l-7 7M20 10h-6V4M14 10l7-7"/></svg>';
  var FS_X_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  mount.innerHTML =
    '<div id="ls-card">' +
      '<div class="ls-strip" id="ls-strip">' +
        '<div class="ls-strip-left">' +
          '<div class="ls-dot" id="ls-dot"></div>' +
          '<div class="ls-status" id="ls-status">Connecting…</div>' +
        '</div>' +
        '<div class="ls-toggle" aria-hidden="true">' +
          '<svg width="16" height="10" viewBox="0 0 16 10" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M1 1L8 8.5L15 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
        '</div>' +
      '</div>' +
      '<div class="ls-body">' +
        '<div class="ls-banner">Enjoy this stream, ad-free with Twitch chat! :3</div>' +
        '<div class="ls-embeds">' +
          '<div class="ls-main">' +
            '<div class="ls-vtabs" id="ls-vtabs">' +
              '<button class="ls-vtab active" type="button" data-tab="beam" aria-pressed="true" style="--brand:#5b9bd5">' +
                '<span class="vt-name">Beam</span><span class="vt-tip">Ad-free player!</span>' +
              '</button>' +
              '<button class="ls-vtab" type="button" data-tab="twitch" aria-pressed="false" style="--brand:#a970ff">' +
                '<span class="vt-name">Twitch</span><span class="vt-tip">Backup player, has ads!</span>' +
              '</button>' +
            '</div>' +
            '<div class="ls-video" id="ls-video">' +
              '<div class="ls-vlayer" id="ls-twitch"></div>' +
              '<div class="ls-vlayer" id="ls-beam"><div class="ls-skeleton">Loading stream</div></div>' +
            '</div>' +
          '</div>' +
          '<div class="ls-chat" id="ls-chat">' +
            '<div class="ls-chat-head">' +
              '<div class="ls-chat-head-spacer"></div>' +     /* points CTA removed — left as dead space for now */
              '<button class="ls-fs-btn ls-theater-btn" type="button" aria-label="Theater mode — fullscreen player and chat">' + FS_ICONS + '</button>' +
            '</div>' +
            '<div class="ls-chat-frame" id="ls-chatframe"><div class="ls-skeleton">Loading chat</div></div>' +
          '</div>' +
        '</div>' +
        '<div class="ls-platforms">' +
          '<div class="ls-also">Also available on:</div>' +
          '<div class="ls-btns" id="ls-btns"></div>' +
        '</div>' +
      '</div>' +
    '</div>';

  var card      = mount.querySelector('#ls-card');
  var dot       = mount.querySelector('#ls-dot');
  var statusEl  = mount.querySelector('#ls-status');
  var strip     = mount.querySelector('#ls-strip');
  var btnsEl    = mount.querySelector('#ls-btns');
  var vtabs     = mount.querySelector('#ls-vtabs');
  var videoSlot = mount.querySelector('#ls-video');
  var chatSlot  = mount.querySelector('#ls-chatframe');

  var userOverride  = null;
  var currentlyLive = false;
  var iframesLoaded = false;
  var activeTab     = 'beam';

  /* ── PLATFORM BUTTONS ── */
  btnsEl.innerHTML = PLATFORMS.filter(function (p) { return p.enabled; }).map(function (p) {
    return '<a class="ls-btn" href="' + p.url + '" target="_blank" rel="noopener noreferrer"' +
           ' style="--b-hover:' + p.hover + ';--b-text:' + p.text + '">' + p.name + '</a>';
  }).join('');

  /* ── PLAYERS — Option B: Twitch stays loaded + muted behind Beam ── */
  function makeIframe(src) {
    var f = document.createElement('iframe');
    f.setAttribute('allowfullscreen', '');
    f.setAttribute('loading', 'lazy');
    f.src = src;
    return f;
  }

  /* Twitch via its JS API so we can mute/unmute and drop quality in the background. */
  var twitchPlayer = null;
  var twitchRequested = false;   /* guards against double-creation during the async API load */
  function loadTwitchAPI(cb) {
    if (window.Twitch && window.Twitch.Player) { cb(); return; }
    var s = document.getElementById('ls-twitch-api');
    if (s) { s.addEventListener('load', cb); return; }
    s = document.createElement('script');
    s.id = 'ls-twitch-api';
    s.src = 'https://embed.twitch.tv/embed/v1.js';
    s.onload = cb;
    document.head.appendChild(s);
  }
  function ensureTwitch() {
    if (twitchPlayer || twitchRequested) return;
    twitchRequested = true;
    loadTwitchAPI(function () {
      twitchPlayer = new Twitch.Player('ls-twitch', {
        channel: TWITCH_CHANNEL, width: '100%', height: '100%',
        muted: true, autoplay: true, parent: PARENTS
      });
      /* The autoplay flag alone is unreliable: Safari/iOS ignore muted autoplay, and the widget
         auto-opens with no user gesture. Nudge it into a playing — and so viewer-counted — state
         on ready, and again on the first interaction (see the first-gesture unlock below). */
      twitchPlayer.addEventListener(Twitch.Player.READY, nudgeTwitchPlay);
      twitchPlayer.addEventListener(Twitch.Player.PLAY, function () {
        if (activeTab === 'twitch') twitchForeground(); else twitchBackground();
      });
    });
  }
  /* Best-effort play(); no-op if the player isn't ready yet or is already playing. */
  function nudgeTwitchPlay() {
    if (!twitchPlayer) return;
    try { if (twitchPlayer.play) twitchPlayer.play(); } catch (e) {}
  }
  /* Background: muted + lowest quality (keeps it streaming cheaply behind Beam). */
  function twitchBackground() {
    if (!twitchPlayer) return;
    try {
      twitchPlayer.setMuted(true);
      twitchPlayer.setVolume(0);
      /* If the viewer paused Twitch while watching it, resume it (muted) when they flip
         back to Beam — a paused player stops counting toward Twitch's live viewers. */
      if (twitchPlayer.isPaused && twitchPlayer.isPaused()) twitchPlayer.play();
      var qs = twitchPlayer.getQualities ? twitchPlayer.getQualities() : null, low = null, i;
      if (qs) for (i = 0; i < qs.length; i++) { if (qs[i].group && qs[i].group !== 'auto') low = qs[i].group; }
      if (low) twitchPlayer.setQuality(low);
    } catch (e) {}
  }
  /* Foreground: audible + auto quality (user swapped over to watch it). */
  function twitchForeground() {
    if (!twitchPlayer) return;
    try { twitchPlayer.play(); twitchPlayer.setQuality('auto'); twitchPlayer.setMuted(false); twitchPlayer.setVolume(0.5); } catch (e) {}
  }

  /* Beam has no mute API — load it when shown, unload it when hidden so its audio stops. */
  function loadBeam() {
    var el = mount.querySelector('#ls-beam');
    if (el.querySelector('iframe')) return;
    el.innerHTML = '<div class="ls-skeleton">Loading stream</div>';
    var f = makeIframe(BEAM_SRC);
    f.addEventListener('load', function () { var sk = el.querySelector('.ls-skeleton'); if (sk) sk.remove(); });
    el.appendChild(f);
  }
  function unloadBeam() { mount.querySelector('#ls-beam').innerHTML = ''; }

  function applyVideoStack() {
    videoSlot.classList.toggle('ls-show-twitch', activeTab === 'twitch');
    videoSlot.classList.toggle('ls-show-beam', activeTab !== 'twitch');
  }

  function loadIframes() {
    if (iframesLoaded) return;
    iframesLoaded = true;
    ensureTwitch();                         /* Twitch loads once and stays muted behind Beam */
    if (activeTab === 'beam') loadBeam();
    applyVideoStack();
    var cf = makeIframe(CHAT_SRC);
    cf.addEventListener('load', function () {
      var sk = chatSlot.querySelector('.ls-skeleton');
      if (sk) sk.remove();
    });
    chatSlot.appendChild(cf);
  }

  /* ── TAB SWITCHING ── */
  function selectTab(which) {
    if ((which !== 'beam' && which !== 'twitch') || which === activeTab) return;
    activeTab = which;
    var tabs = vtabs.querySelectorAll('.ls-vtab'), i, on;
    for (i = 0; i < tabs.length; i++) {
      on = tabs[i].getAttribute('data-tab') === which;
      tabs[i].classList.toggle('active', on);
      tabs[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (!iframesLoaded) return;
    if (which === 'twitch') { unloadBeam(); twitchForeground(); }
    else { loadBeam(); twitchBackground(); }
    applyVideoStack();
  }

  vtabs.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.ls-vtab');
    if (btn) selectTab(btn.getAttribute('data-tab'));
  });

  /* ── FIRST-GESTURE UNLOCK ──
     Permissive browsers (Chrome/Edge/Firefox desktop) start the muted background Twitch player on
     load, so it counts a viewer while someone watches Beam. Safari/iOS won't autoplay without a
     user gesture, and the widget auto-opens with none — so on the first press anywhere in the card,
     make sure Twitch is loaded and playing. */
  card.addEventListener('pointerdown', function () {
    ensureTwitch();
    nudgeTwitchPlay();
  }, { once: true });

  /* ── POINTS CTA PULSE ── */
  var ptsBtn = mount.querySelector('.ls-points');
  var PTS_PULSE_MS = 45000;  /* pulse the points CTA every 45 seconds */
  if (ptsBtn) {
    var ptsPulse = setInterval(function () {
      ptsBtn.classList.add('ls-pulse');
      setTimeout(function () { ptsBtn.classList.remove('ls-pulse'); }, 4200);
    }, PTS_PULSE_MS);
    /* Once they click through, stop nagging for this page load (no persistence — resets on reload/close). */
    ptsBtn.addEventListener('click', function () {
      clearInterval(ptsPulse);
      ptsBtn.classList.remove('ls-pulse');
    });
  }

  /* ── FULLSCREEN (theater) ──
     One toggle (in the chat header) fullscreens the whole embed together — the tab
     bar, both players, the points CTA, and chat. iPhone Safari has no element-level
     Fullscreen API (only bare <video>), so there we fall back to a fixed-position
     "pseudo" fullscreen that fills the viewport; both paths share the .ls-fs-theater
     classes. While fullscreen the trigger hides and an injected ✕ (top-right) exits. */
  var embedsEl   = mount.querySelector('.ls-embeds');
  var theaterBtn = mount.querySelector('.ls-theater-btn');
  var fsActive   = null;                 /* {el, mode, pseudo} or null */
  var fsPendingEl = null, fsPendingMode = null;

  function fsSupported(el) { return !!(el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen); }
  function fsRequest(el) { return (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen).call(el); }
  function fsExitApi() { var fn = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen; if (fn) fn.call(document); }
  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null; }

  function applyFsClasses(el, mode) {
    el.classList.add('ls-fs-' + mode);
    document.documentElement.classList.add('ls-fs-lock');
    if (mode === 'theater') injectExit(el);   /* trigger hides in fullscreen, so add a ✕ close */
    updateFsBtns();
  }
  function clearFsClasses(el, mode) {
    el.classList.remove('ls-fs-' + mode, 'ls-pseudofs');
    document.documentElement.classList.remove('ls-fs-lock');
    removeExit(el);
    updateFsBtns();
  }
  function enterPseudo(el, mode) {
    fsActive = { el: el, mode: mode, pseudo: true };
    el.classList.add('ls-pseudofs');
    applyFsClasses(el, mode);
  }
  function enterFs(el, mode) {
    if (fsActive) return;
    if (fsSupported(el)) {
      fsPendingEl = el; fsPendingMode = mode;
      var p;
      try { p = fsRequest(el); } catch (e) { fsPendingEl = null; enterPseudo(el, mode); return; }
      /* If the request is rejected (e.g. not user-activated), fall back to pseudo. */
      if (p && p.then) p.catch(function () { fsPendingEl = null; enterPseudo(el, mode); });
    } else {
      enterPseudo(el, mode);
    }
  }
  function exitFs() {
    if (!fsActive) return;
    if (fsActive.pseudo) {
      var el = fsActive.el, mode = fsActive.mode;
      fsActive = null;
      clearFsClasses(el, mode);
    } else {
      fsExitApi();   /* fullscreenchange finishes the cleanup */
    }
  }
  function toggleFs(el, mode) {
    if (fsActive && fsActive.mode === mode) exitFs();
    else if (!fsActive) enterFs(el, mode);
  }

  /* Native fullscreen enters/leaves asynchronously — sync our classes off the events
     so Esc / browser-chrome exits are handled too. */
  function onFsChange() {
    var fe = fsElement();
    if (fe && fe === fsPendingEl) {
      var el = fsPendingEl, mode = fsPendingMode;
      fsActive = { el: el, mode: mode, pseudo: false };
      fsPendingEl = null;
      applyFsClasses(el, mode);
    } else if (!fe && fsActive && !fsActive.pseudo) {
      var el2 = fsActive.el, mode2 = fsActive.mode;
      fsActive = null;
      clearFsClasses(el2, mode2);
    }
  }
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && fsActive && fsActive.pseudo) exitFs(); });

  function updateFsBtns() {
    setFsBtn(theaterBtn, !!(fsActive && fsActive.mode === 'theater'), 'Theater mode — fullscreen player and chat', 'Exit theater mode');
  }
  function setFsBtn(btn, active, labelOff, labelOn) {
    if (!btn) return;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-label', active ? labelOn : labelOff);
  }

  function injectExit(el) {
    if (el.querySelector('.ls-fs-exit')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ls-fs-exit';
    b.setAttribute('aria-label', 'Exit fullscreen');
    b.innerHTML = FS_X_ICON;
    b.addEventListener('click', function (e) { e.stopPropagation(); exitFs(); });
    el.appendChild(b);
  }
  function removeExit(el) { var b = el.querySelector('.ls-fs-exit'); if (b) b.parentNode.removeChild(b); }

  if (theaterBtn) theaterBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); toggleFs(embedsEl, 'theater'); });

  /* ── COLLAPSE / LIVE STATE ── */
  function applyOpenState(open) {
    card.classList.toggle('ls-open', open);
    if (open) loadIframes();
  }

  function setLive(isLive) {
    if (isLive !== currentlyLive) { userOverride = null; }
    currentlyLive = isLive;
    dot.className = isLive ? 'ls-dot ls-live' : 'ls-dot';
    statusEl.textContent = isLive ? 'Live Now' : 'Livestream Offline';
    if (userOverride === null) { applyOpenState(isLive); }
  }

  strip.addEventListener('click', function () {
    var isOpen = card.classList.contains('ls-open');
    userOverride = !isOpen;
    applyOpenState(userOverride);
  });

  /* ── LIVE POLL ── */
  function poll() {
    fetch(WEBHOOK + '?t=' + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var rec = Array.isArray(d) ? d[0] : d;
        setLive(!!(rec && (rec.live === true || rec.live === 'true')));
      })
      .catch(function () { setLive(false); });
  }
  poll();
  setInterval(poll, 90000);
})();
