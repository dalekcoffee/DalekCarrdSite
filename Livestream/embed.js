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
      /* --lsChatW = the chat column's resting width, so hiding never resizes the */
      /* control strip. Mirrors the 3.5:1 flex ratio (clamped to a 350px minimum). */
      '.ls-embeds{display:flex;flex-direction:row;position:relative;--lsChatW:max(350px,calc(100% / 4.5))}',
      '.ls-main{flex:3.5;min-width:0;display:flex;flex-direction:column;background:var(--bg)}',

      /* tabs */
      '.ls-vtabs{display:flex;height:var(--tabH);border-bottom:1px solid var(--b1);background:#0c0c0c}',
      '.ls-vtab{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:0 6px;text-align:center;cursor:pointer;background:none;border:none;border-right:1px solid var(--b1);border-bottom:2px solid transparent;color:rgba(255,255,255,.5);font-family:inherit;transition:background .2s,color .2s,border-color .2s,box-shadow .2s}',
      /* Beam is the primary choice — 80% of the tab bar vs Twitch's 20% (4:1) */
      '.ls-vtab[data-tab="beam"]{flex:4}',
      '.ls-vtab[data-tab="twitch"]{flex:1}',
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
      '.ls-chat{flex:1;min-width:var(--lsChatW);display:flex;flex-direction:column;background:#18181b;border-left:1px solid var(--bg2)}',
      '.ls-chat-head{flex-shrink:0;position:relative;display:flex;align-items:stretch;height:var(--tabH);background:#0c0c0c;border-bottom:1px solid var(--b1)}',
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

      /* rotating call-to-action — fills the chat-header dead space; slides in from */
      /* the left, out to the right. Icons/links mirror the Links embed. */
      '.ls-cta-slot{position:absolute;top:0;right:56px;bottom:0;left:56px;overflow:hidden}',
      '.ls-cta{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;gap:9px;padding:0 14px;text-decoration:none;color:rgba(255,255,255,.7);font-size:12px;font-weight:700;letter-spacing:.03em;white-space:nowrap;pointer-events:none;transform:translateX(-120%);opacity:0;transition:transform .7s cubic-bezier(.33,0,.2,1),opacity .7s ease,background .2s,color .2s}',
      '.ls-cta.is-active{transform:translateX(0);opacity:1;pointer-events:auto}',
      '.ls-cta.is-right{transform:translateX(120%);opacity:0}',
      '.ls-cta.no-anim{transition:none}',
      '.ls-cta:hover,.ls-cta:active{background:#141414;color:#fff}',
      '.ls-cta:focus-visible{outline:2px solid var(--brand,#fff);outline-offset:-2px}',
      '.ls-cta-arrow{flex-shrink:0;color:rgba(255,255,255,.35);font-size:13px;transition:color .2s,transform .2s}',
      '.ls-cta:hover .ls-cta-arrow{color:var(--brand,#fff);transform:translate(2px,-2px)}',
      '.ls-cta-icon{display:block;flex-shrink:0;width:18px;height:18px;background-color:rgba(255,255,255,.6);-webkit-mask:var(--mi) no-repeat center/contain;mask:var(--mi) no-repeat center/contain;transition:background-color .2s,transform .2s,filter .2s}',
      '.ls-cta:hover .ls-cta-icon{background-color:var(--brand,#fff);transform:scale(1.05)}',
      '.ls-cta-icon.failed{display:none}',
      '.ls-cta-icon.failed+.ls-cta-fb{display:flex}',
      '.ls-cta-fb{display:none;align-items:center;justify-content:center;flex-shrink:0;width:18px;font-family:"Bebas Neue",sans-serif;font-size:13px;color:rgba(255,255,255,.6)}',
      '.ls-cta:hover .ls-cta-fb{color:var(--brand,#fff)}',
      '.ls-cta-inline{flex-shrink:0;width:18px;height:18px;transition:transform .2s}',
      '.ls-cta-inline .fedi-rest{opacity:.55;transition:opacity .2s}',
      '.ls-cta-inline .fedi-color{opacity:0;transition:opacity .2s}',
      '.ls-cta:hover .ls-cta-inline{transform:scale(1.05)}',
      '.ls-cta:hover .ls-cta-inline .fedi-rest{opacity:0}',
      '.ls-cta:hover .ls-cta-inline .fedi-color{opacity:1}',
      '.ls-cta-tiktok:hover .ls-cta-icon,.ls-cta-tiktok:active .ls-cta-icon{background-color:#fff;filter:drop-shadow(-1px 0 0 #ee1d52) drop-shadow(1px 0 0 #69c9d0)}',

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
      /* right-aligned (dead space to its left). Shows the expand glyph when closed */
      /* and swaps in place to the X when in theater mode — same control, one icon. */
      '.ls-theater-btn{position:absolute;top:0;right:0;bottom:0;width:56px;z-index:2;--brand:#a970ff}',
      '.ls-theater-btn svg{width:24px;height:24px}',
      '.ls-fs-btn .fs-i-close{display:none}',
      '.ls-theater-btn.is-active .fs-i-expand{display:none}',
      '.ls-theater-btn.is-active .fs-i-close{display:block}',
      /* chat show/hide — ONE toggle in the chat header (left of the CTA, mirrors the close */
      /* on the right). The header bar stays put in every state; only the messages collapse. */
      '.ls-chat-toggle{position:absolute;top:0;left:0;bottom:0;width:56px;z-index:2;--brand:#5b9bd5}',
      '.ls-chat-toggle svg{width:22px;height:22px}',
      '.ls-chat-toggle .fs-i-chat-show{display:none}',
      '.ls-embeds.ls-chat-hidden .ls-chat-toggle .fs-i-chat-hide{display:none}',
      '.ls-embeds.ls-chat-hidden .ls-chat-toggle .fs-i-chat-show{display:block}',
      /* hidden: collapse ONLY the messages. The header bar (tabs + controls) stays put */
      /* in the top strip; the player widens into the freed space below it. */
      '.ls-embeds.ls-chat-hidden .ls-chat-frame{display:none}',
      /* desktop: keep the row, give the player the full width, and float the control */
      /* bar back into the top-right strip (tab row reserves that width so nothing overlaps). */
      '@media (min-width:1025px){',
        '.ls-embeds.ls-chat-hidden .ls-main{flex:1 1 100%}',
        '.ls-embeds.ls-chat-hidden .ls-vtabs{padding-right:var(--lsChatW)}',
        '.ls-embeds.ls-chat-hidden .ls-chat{position:absolute;top:0;right:0;bottom:auto;width:var(--lsChatW);min-width:0;height:var(--tabH);border-top:none;z-index:3}',
      '}',
      /* one-shot attention pulse (3 slow cycles ~= 5s); fired on open / enter / exit */
      '.ls-theater-btn.ls-fs-pulse{animation:ls-fs-pulse 1.667s ease-out 3}',
      '@keyframes ls-fs-pulse{0%{box-shadow:0 0 0 0 rgba(169,112,255,.5);background:#0c0c0c;color:rgba(255,255,255,.55)}40%{background:#171029;color:#a970ff}70%{box-shadow:0 0 0 10px rgba(169,112,255,0)}100%{box-shadow:0 0 0 0 rgba(169,112,255,0);background:#0c0c0c;color:rgba(255,255,255,.55)}}',
      /* fullscreen states — driven by our own classes so the same CSS covers the */
      /* native Fullscreen API and the iOS fixed-position fallback below */
      '.ls-pseudofs{position:fixed;top:0;left:0;width:100%;height:100%;max-width:none;z-index:2147483646;background:#000}',
      '.ls-fs-lock{overflow:hidden}',
      '.ls-embeds.ls-fs-theater{width:100%;height:100%;max-width:none;background:#000}',
      '@media (min-width:1025px){.ls-embeds.ls-fs-theater .ls-main{height:100%}.ls-embeds.ls-fs-theater .ls-video{aspect-ratio:auto;flex:1;min-height:0;max-width:none}}',
      '@media (max-width:1024px){.ls-embeds.ls-fs-theater{flex-direction:column}.ls-embeds.ls-fs-theater .ls-main{flex:0 0 auto}.ls-embeds.ls-fs-theater .ls-chat{flex:1 1 auto;min-height:0}.ls-embeds.ls-fs-theater .ls-chat-frame{height:auto;flex:1;min-height:0}}',
      /* landscape phone: side-by-side (big player + slim chat), like desktop theater */
      '@media (max-width:1024px) and (orientation:landscape){.ls-embeds.ls-fs-theater{flex-direction:row;--lsChatW:clamp(220px,35%,320px)}.ls-embeds.ls-fs-theater .ls-main{flex:1 1 auto;height:100%}.ls-embeds.ls-fs-theater .ls-video{aspect-ratio:auto;flex:1;min-height:0;max-width:none}.ls-embeds.ls-fs-theater .ls-chat{flex:0 0 auto;width:var(--lsChatW);height:100%;min-height:0}.ls-embeds.ls-fs-theater .ls-chat-frame{height:auto;flex:1;min-height:0}.ls-embeds.ls-fs-theater .ls-chat-toggle,.ls-embeds.ls-fs-theater .ls-theater-btn{width:44px}.ls-embeds.ls-fs-theater .ls-cta-slot{left:44px;right:44px}.ls-embeds.ls-fs-theater .ls-cta{font-size:11px;gap:7px;padding:0 8px}',
      /* hidden in landscape FS — same as desktop: control strip stays a top-right */
      /* bar beside the tabs, player widens (no full-width overlay over the video) */
      '.ls-embeds.ls-fs-theater.ls-chat-hidden{flex-direction:row}.ls-embeds.ls-fs-theater.ls-chat-hidden .ls-vtabs{padding-right:var(--lsChatW)}.ls-embeds.ls-fs-theater.ls-chat-hidden .ls-chat{position:absolute;top:0;right:0;bottom:auto;width:var(--lsChatW);height:var(--tabH);min-height:0;border-top:none;border-left:1px solid var(--bg2);z-index:3}}',
      /* portrait phone in theater: hiding chat just leaves a black void, so disable */
      /* the toggle and keep the messages shown */
      '@media (max-width:1024px) and (orientation:portrait){.ls-embeds.ls-fs-theater .ls-chat-toggle{display:none}.ls-embeds.ls-fs-theater.ls-chat-hidden .ls-chat-frame{display:block}}',

      /* mobile */
      '@media (min-width:481px){.ls-status{font-size:14px}}',
      '@media (max-width:1024px){',
        '.ls-embeds{flex-direction:column}',
        '.ls-chat{flex:none;width:100%;min-width:0;border-left:none;border-top:1px solid var(--bg2)}',
        /* flex:none so the 522px basis sticks — otherwise the base flex:1 collapses it to 0 */
        '.ls-chat-frame{flex:none;height:522px}',
      '}'
    ].join('');
    document.head.appendChild(st);
  }

  /* ── MARKUP ── */
  /* Expand + close glyphs live together in the toggle; CSS shows only one at a time
     via .is-active (expand when closed, X when in theater). */
  var FS_ICONS =
    '<svg class="fs-i-expand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M21 3l-7 7M9 21H3v-6M3 21l7-7"/></svg>' +
    '<svg class="fs-i-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  /* rounded chat bubble: plain = show chat, slashed = hide chat. Both live in the one */
  /* toggle; CSS shows whichever matches the state (single glyph at a time). */
  var CHAT_HIDE_ICON =
    '<svg class="fs-i-chat-hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/><line x1="4" y1="4" x2="20" y2="20"/></svg>';
  var CHAT_SHOW_ICON =
    '<svg class="fs-i-chat-show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

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
              '<button class="ls-fs-btn ls-chat-toggle" type="button" aria-label="Hide chat" title="Hide chat">' + CHAT_HIDE_ICON + CHAT_SHOW_ICON + '</button>' +
              '<div class="ls-cta-slot" id="ls-cta-slot"></div>' +
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

  /* ── ROTATING CTA (chat-header dead space) ──
     One CTA visible at a time; the current slides out to the right while the next
     slides in from the left. Pauses on hover so people can read/click. Icons + links
     mirror the Links embed (CSS-mask via simpleicons, with abbr fallback on CDN fail;
     Fediverse uses the inline pentagram). */
  var ctaSlot = mount.querySelector('#ls-cta-slot');
  if (ctaSlot) {
    var FEDI_SVG =
      '<svg class="ls-cta-inline" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<g class="fedi-rest">' +
      '<line x1="12" y1="3" x2="20.6" y2="9.2" stroke="white" stroke-width="1.4"/>' +
      '<line x1="12" y1="3" x2="17.3" y2="19.3" stroke="white" stroke-width="1.4"/>' +
      '<line x1="12" y1="3" x2="6.7" y2="19.3" stroke="white" stroke-width="1.4"/>' +
      '<line x1="12" y1="3" x2="3.4" y2="9.2" stroke="white" stroke-width="1.4"/>' +
      '<line x1="20.6" y1="9.2" x2="17.3" y2="19.3" stroke="white" stroke-width="1.4"/>' +
      '<line x1="20.6" y1="9.2" x2="6.7" y2="19.3" stroke="white" stroke-width="1.4"/>' +
      '<line x1="20.6" y1="9.2" x2="3.4" y2="9.2" stroke="white" stroke-width="1.4"/>' +
      '<line x1="17.3" y1="19.3" x2="6.7" y2="19.3" stroke="white" stroke-width="1.4"/>' +
      '<line x1="17.3" y1="19.3" x2="3.4" y2="9.2" stroke="white" stroke-width="1.4"/>' +
      '<line x1="6.7" y1="19.3" x2="3.4" y2="9.2" stroke="white" stroke-width="1.4"/>' +
      '<circle cx="12" cy="3" r="2.1" fill="white"/>' +
      '<circle cx="20.6" cy="9.2" r="2.1" fill="white"/>' +
      '<circle cx="17.3" cy="19.3" r="2.1" fill="white"/>' +
      '<circle cx="6.7" cy="19.3" r="2.1" fill="white"/>' +
      '<circle cx="3.4" cy="9.2" r="2.1" fill="white"/>' +
      '</g>' +
      '<g class="fedi-color">' +
      '<line x1="12" y1="3" x2="20.6" y2="9.2" stroke="#aadd00" stroke-width="1.4"/>' +
      '<line x1="12" y1="3" x2="17.3" y2="19.3" stroke="#ffcc00" stroke-width="1.4"/>' +
      '<line x1="12" y1="3" x2="6.7" y2="19.3" stroke="#ff8800" stroke-width="1.4"/>' +
      '<line x1="12" y1="3" x2="3.4" y2="9.2" stroke="#ff4400" stroke-width="1.4"/>' +
      '<line x1="20.6" y1="9.2" x2="17.3" y2="19.3" stroke="#33dd66" stroke-width="1.4"/>' +
      '<line x1="20.6" y1="9.2" x2="6.7" y2="19.3" stroke="#44aaff" stroke-width="1.4"/>' +
      '<line x1="20.6" y1="9.2" x2="3.4" y2="9.2" stroke="#aa3300" stroke-width="1.4"/>' +
      '<line x1="17.3" y1="19.3" x2="6.7" y2="19.3" stroke="#5566ff" stroke-width="1.4"/>' +
      '<line x1="17.3" y1="19.3" x2="3.4" y2="9.2" stroke="#6688cc" stroke-width="1.4"/>' +
      '<line x1="6.7" y1="19.3" x2="3.4" y2="9.2" stroke="#cc22aa" stroke-width="1.4"/>' +
      '<circle cx="12" cy="3" r="2.1" fill="#ffcc00"/>' +
      '<circle cx="20.6" cy="9.2" r="2.1" fill="#66ff00"/>' +
      '<circle cx="17.3" cy="19.3" r="2.1" fill="#00ccff"/>' +
      '<circle cx="6.7" cy="19.3" r="2.1" fill="#8833ff"/>' +
      '<circle cx="3.4" cy="9.2" r="2.1" fill="#ff2200"/>' +
      '</g></svg>';

    var ctaMaskIcon = function (slug, fb) {
      return '<span class="ls-cta-icon" style="--mi:url(\'https://cdn.simpleicons.org/' + slug + '\')" data-fb="' + fb + '" aria-hidden="true"></span>' +
             '<span class="ls-cta-fb" aria-hidden="true">' + fb + '</span>';
    };

    var CTA_ITEMS = [
      { text: 'Join the Discord',       href: 'https://discord.com/invite/h6JerzYnpY',  brand: '#5865f2', icon: ctaMaskIcon('discord', 'DC') },
      { text: 'Support me',             href: 'https://ko-fi.com/dalekcoffee',          brand: '#FF5E5B', icon: ctaMaskIcon('kofi', 'KO') },
      { text: 'Follow me on TikTok',    href: 'https://www.tiktok.com/@dalekcoffee',    brand: '#69c9d0', icon: ctaMaskIcon('tiktok', 'TT'), cls: 'ls-cta-tiktok' },
      { text: 'Follow me on Twitter',   href: 'https://x.com/DalekCoffee',              brand: '#aaa',    icon: ctaMaskIcon('x', 'X') },
      { text: 'Follow me on Instagram', href: 'https://www.instagram.com/dalekcoffee/', brand: '#e1306c', icon: ctaMaskIcon('instagram', 'IN') },
      { text: 'Follow me on Fediverse', href: 'https://oshi.social/@dalekcoffee',        brand: '#a970ff', icon: FEDI_SVG, cls: 'rainbow' },
      { text: 'Follow me on Bluesky',   href: 'https://bsky.app/profile/dalek.coffee',  brand: '#0085ff', icon: ctaMaskIcon('bluesky', 'BS') }
    ];

    CTA_ITEMS.forEach(function (it) {
      var a = document.createElement('a');
      a.className = 'ls-cta' + (it.cls ? ' ' + it.cls : '');
      a.href = it.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.style.setProperty('--brand', it.brand);
      a.setAttribute('aria-label', it.text);
      a.innerHTML = it.icon + '<span class="ls-cta-text">' + it.text + '</span><span class="ls-cta-arrow" aria-hidden="true">↗</span>';
      ctaSlot.appendChild(a);
    });

    /* same CDN-failure probe as the Links embed: hide the mask, reveal the abbr */
    var ctaChecked = {};
    ctaSlot.querySelectorAll('.ls-cta-icon[data-fb]').forEach(function (el) {
      var url = (el.style.getPropertyValue('--mi') || '').replace(/url\(['"]?|['"]?\)/g, '');
      if (!url || ctaChecked[url] !== undefined) return;
      ctaChecked[url] = null;
      var img = new Image();
      img.onerror = function () {
        ctaSlot.querySelectorAll('.ls-cta-icon[data-fb]').forEach(function (m) {
          var u = (m.style.getPropertyValue('--mi') || '').replace(/url\(['"]?|['"]?\)/g, '');
          if (u === url) m.classList.add('failed');
        });
      };
      img.src = url;
    });

    /* Discord + Ko-fi run ~1.25x as often as the five follow links. A smooth weighted
       round-robin pre-builds an evenly spread playlist (no clumping / adjacent repeats). */
    var ctaEls = ctaSlot.querySelectorAll('.ls-cta');
    var CTA_WEIGHTS = [5, 5, 4, 4, 4, 4, 4];   /* matches CTA_ITEMS: Discord, Ko-fi, then 5 follows */
    var ctaPlaylist = (function (w) {
      var n = w.length, cw = [], total = 0, seq = [], i, s, best, bestVal;
      for (i = 0; i < n; i++) { cw[i] = 0; total += w[i]; }
      for (s = 0; s < total; s++) {
        best = 0; bestVal = -Infinity;
        for (i = 0; i < n; i++) { cw[i] += w[i]; if (cw[i] > bestVal) { bestVal = cw[i]; best = i; } }
        cw[best] -= total;
        seq.push(best);
      }
      return seq;
    })(CTA_WEIGHTS);
    var ctaPos = 0, ctaCur = ctaPlaylist[0], ctaPaused = false;
    if (ctaEls.length) {
      ctaEls[ctaCur].classList.add('is-active');
      if (ctaEls.length > 1) {
        setInterval(function () {
          if (ctaPaused || !card.classList.contains('ls-open')) return;   /* hold on the first item until opened */
          ctaPos = (ctaPos + 1) % ctaPlaylist.length;
          var nextIdx = ctaPlaylist[ctaPos];
          if (nextIdx === ctaCur) { ctaPos = (ctaPos + 1) % ctaPlaylist.length; nextIdx = ctaPlaylist[ctaPos]; }
          var cur = ctaEls[ctaCur], next = ctaEls[nextIdx];
          ctaCur = nextIdx;
          cur.classList.remove('is-active');
          cur.classList.add('is-right');        /* slide current out to the right */
          next.classList.add('is-active');       /* slide next in from the left */
          setTimeout(function () {               /* once it's gone, park it back on the left */
            cur.classList.add('no-anim');
            cur.classList.remove('is-right');
            void cur.offsetWidth;
            cur.classList.remove('no-anim');
          }, 760);
        }, 10000);
      }
      ctaSlot.addEventListener('mouseenter', function () { ctaPaused = true; });
      ctaSlot.addEventListener('mouseleave', function () { ctaPaused = false; });
    }
  }

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
    setTimeout(pulseTheaterBtn, 700);       /* embed just opened — hint the theater toggle */
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
     bar, both players, and chat. The same button swaps its glyph to an X while
     fullscreen and acts as the exit (no separate floating button). iPhone Safari has
     no element-level Fullscreen API (only bare <video>), so there we fall back to a
     fixed-position "pseudo" fullscreen that fills the viewport; both paths share the
     .ls-fs-theater classes. */
  var embedsEl      = mount.querySelector('.ls-embeds');
  var theaterBtn    = mount.querySelector('.ls-theater-btn');
  var chatToggle    = mount.querySelector('.ls-chat-toggle');
  var fsActive   = null;                 /* {el, mode, pseudo} or null */
  var fsPendingEl = null, fsPendingMode = null;

  /* One-shot 5s pulse to hint the toggle is interactive — fired when the embed first
     opens and on each theater enter/exit. No repeating loop; just a gentle nudge. */
  var fsPulseTimer = null;
  function pulseTheaterBtn() {
    if (!theaterBtn) return;
    theaterBtn.classList.remove('ls-fs-pulse');
    void theaterBtn.offsetWidth;          /* reflow so re-adding restarts the animation */
    theaterBtn.classList.add('ls-fs-pulse');
    if (fsPulseTimer) clearTimeout(fsPulseTimer);
    fsPulseTimer = setTimeout(function () { theaterBtn.classList.remove('ls-fs-pulse'); }, 5000);
  }

  function fsSupported(el) { return !!(el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen); }
  function fsRequest(el) { return (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen).call(el); }
  function fsExitApi() { var fn = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen; if (fn) fn.call(document); }
  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null; }

  function applyFsClasses(el, mode) {
    el.classList.add('ls-fs-' + mode);
    document.documentElement.classList.add('ls-fs-lock');
    updateFsBtns();         /* swaps the toggle's glyph to the X via .is-active */
    pulseTheaterBtn();      /* fullscreen opened — pulse the (now X) close button */
  }
  function clearFsClasses(el, mode) {
    el.classList.remove('ls-fs-' + mode, 'ls-pseudofs');
    document.documentElement.classList.remove('ls-fs-lock');
    updateFsBtns();
    pulseTheaterBtn();      /* fullscreen closed — pulse the (now expand) toggle */
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

  if (theaterBtn) theaterBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); toggleFs(embedsEl, 'theater'); });

  /* Chat show/hide (landscape fullscreen only): collapse the chat column so the player
     fills the width, or bring it back. Two buttons so only the relevant one is on screen —
     hide embeds in the chat header, show floats on the video once chat is gone. */
  if (chatToggle) chatToggle.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    var hidden = embedsEl.classList.toggle('ls-chat-hidden');
    chatToggle.setAttribute('aria-label', hidden ? 'Show chat' : 'Hide chat');
    chatToggle.setAttribute('title', hidden ? 'Show chat' : 'Hide chat');
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
