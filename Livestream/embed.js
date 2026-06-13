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

  /* Video sources behind the two tabs. Beam = ad-free relay; Twitch = native player. */
  var VIDEO_SRC = {
    beam:   'https://beamstream.gg/dalek/embed',
    twitch: 'https://player.twitch.tv/?channel=dalekcoffee&' + parentQS()
  };
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
      '#ls-card{--t:.2s;--bg:#0d0d0d;--bg2:#111;--bg3:#191919;--b1:#1a1a1a;--tabH:48px;width:100%;max-width:53.5rem;margin:0 auto;background:var(--bg);color:#fff;border-top:2px solid #fff;border-bottom:1px solid var(--bg2);font-family:"Space Mono",monospace;-webkit-font-smoothing:antialiased}',
      '#ls-card *,#ls-card *::before,#ls-card *::after{box-sizing:border-box;margin:0;padding:0}',

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
      '.ls-chat{flex:1;min-width:350px;display:flex;flex-direction:column;background:#18181b;border-left:1px solid var(--bg2)}',
      '.ls-chat-head{flex-shrink:0;height:var(--tabH);background:#0c0c0c;border-bottom:1px solid var(--b1)}',
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

      /* mobile */
      '@media (min-width:481px){.ls-status{font-size:14px}}',
      '@media (max-width:1024px){',
        '.ls-embeds{flex-direction:column}',
        '.ls-chat{flex:none;width:100%;min-width:0;border-left:none;border-top:1px solid var(--bg2)}',
        '.ls-chat-head{display:none}',
        '.ls-chat-frame{height:522px}',
      '}'
    ].join('');
    document.head.appendChild(st);
  }

  /* ── MARKUP ── */
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
                '<span class="vt-name">Beam</span><span class="vt-tip">Ad-free!</span>' +
              '</button>' +
              '<button class="ls-vtab" type="button" data-tab="twitch" aria-pressed="false" style="--brand:#a970ff">' +
                '<span class="vt-name">Twitch</span><span class="vt-tip">Earns channel points</span>' +
              '</button>' +
            '</div>' +
            '<div class="ls-video" id="ls-video"><div class="ls-skeleton">Loading stream</div></div>' +
          '</div>' +
          '<div class="ls-chat" id="ls-chat">' +
            '<div class="ls-chat-head" aria-hidden="true"></div>' +
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

  /* ── IFRAMES ── */
  function makeIframe(src) {
    var f = document.createElement('iframe');
    f.setAttribute('allowfullscreen', '');
    f.setAttribute('loading', 'lazy');
    f.src = src;
    return f;
  }

  function setVideo(which) {
    videoSlot.innerHTML = '<div class="ls-skeleton">Loading stream</div>';
    var f = makeIframe(VIDEO_SRC[which]);
    f.addEventListener('load', function () {
      var sk = videoSlot.querySelector('.ls-skeleton');
      if (sk) sk.remove();
    });
    videoSlot.appendChild(f);
  }

  function loadIframes() {
    if (iframesLoaded) return;
    iframesLoaded = true;
    setVideo(activeTab);
    var cf = makeIframe(CHAT_SRC);
    cf.addEventListener('load', function () {
      var sk = chatSlot.querySelector('.ls-skeleton');
      if (sk) sk.remove();
    });
    chatSlot.appendChild(cf);
  }

  /* ── TAB SWITCHING ── */
  function selectTab(which) {
    if (!VIDEO_SRC[which] || which === activeTab) return;
    activeTab = which;
    var tabs = vtabs.querySelectorAll('.ls-vtab');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-tab') === which;
      tabs[i].classList.toggle('active', on);
      tabs[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (iframesLoaded) setVideo(which);
  }

  vtabs.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.ls-vtab');
    if (btn) selectTab(btn.getAttribute('data-tab'));
  });

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
