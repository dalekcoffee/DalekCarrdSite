(function () {
  var s = document.currentScript;

  /* ── STYLES ── */
  var st = document.createElement('style');
  st.textContent = '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
    'body{background:transparent;font-family:\'Space Mono\',monospace;-webkit-font-smoothing:antialiased}' +
    ':root{--t:0.2s;--bg:#0d0d0d;--bg2:#111;--bg3:#191919;--b1:#1a1a1a;--b2:#111;--rainbow:linear-gradient(180deg,#f00,#f80,#ff0,#0c0,#08f,#80f)}' +
    '#lk-card{background:var(--bg);color:#fff;border-top:2px solid #fff;border-bottom:1px solid var(--b2)}' +
    '.lk-section{padding:19px 23px;border-bottom:1px solid var(--b2)}' +
    '.lk-section:last-child{border-bottom:none}' +
    '.lk-section-label{font-size:14px;letter-spacing:.22em;text-transform:uppercase;font-weight:700;color:#fff;margin-bottom:16px}' +
    '.lk-links{display:flex;flex-direction:column;gap:8px}' +
    '.lk-link{position:relative;display:flex;align-items:center;gap:16px;padding:17px 20px;background:var(--bg2);border:1px solid var(--b1);color:rgba(255,255,255,.65);text-decoration:none;font-size:14px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;overflow:hidden;transition:background var(--t),color var(--t),border-color var(--t),box-shadow var(--t)}' +
    '.lk-link::before{content:\'\';position:absolute;top:0;bottom:0;left:0;width:2px;background:#222;transition:background var(--t)}' +
    '.lk-link:hover,.lk-link:active{background:var(--bg3);color:#fff;border-color:var(--brand,#333);box-shadow:0 0 10px rgba(255,255,255,.08);box-shadow:0 0 10px color-mix(in srgb,var(--brand,#333) 20%,transparent)}' +
    '.lk-link:hover::before,.lk-link:active::before{background:var(--brand,#fff)}' +
    '.lk-link.rainbow:hover,.lk-link.rainbow:active{border-color:transparent;border-image:linear-gradient(135deg,#f00,#f80,#ff0,#0c0,#08f,#80f) 1;box-shadow:0 0 14px rgba(100,60,200,.25),0 0 4px rgba(255,100,0,.15)}' +
    '.lk-link.rainbow:hover::before,.lk-link.rainbow:active::before{background:var(--rainbow)}' +
    '.lk-link:focus-visible{outline:2px solid var(--brand,#fff);outline-offset:-2px}' +
    '.lk-link-text{flex:1}' +
    '.lk-arrow{color:#333;font-size:19px;flex-shrink:0;transition:color var(--t),transform var(--t)}' +
    '.lk-link:hover .lk-arrow,.lk-link:active .lk-arrow{color:rgba(255,255,255,.5);transform:translate(2px,-2px)}' +
    '.lk-icon-mask{display:block;flex-shrink:0;width:21px;height:21px;background-color:rgba(255,255,255,.4);-webkit-mask:var(--mi) no-repeat center/contain;mask:var(--mi) no-repeat center/contain;transition:background-color var(--t)}' +
    '.lk-link:hover .lk-icon-mask,.lk-link:active .lk-icon-mask{background-color:var(--brand,#fff)}' +
    '.lk-icon-abbr{display:flex;align-items:center;justify-content:center;flex-shrink:0;width:26px;height:26px;font-family:\'Bebas Neue\',sans-serif;font-size:19px;color:rgba(255,255,255,.65);transition:color var(--t)}' +
    '.lk-social:hover .lk-icon-abbr,.lk-social:active .lk-icon-abbr,.lk-link:hover .lk-icon-abbr,.lk-link:active .lk-icon-abbr{color:var(--brand,#fff)}' +
    '.lk-icon-img{display:block;flex-shrink:0;width:21px;height:21px;object-fit:contain;filter:brightness(0) invert(1);opacity:.4;transition:filter var(--t),opacity var(--t)}' +
    '.lk-link:hover .lk-icon-img,.lk-link:active .lk-icon-img{filter:none;opacity:1}' +
    '.lk-social .lk-icon-img{width:23px;height:23px;opacity:.65}' +
    '.lk-social:hover .lk-icon-img,.lk-social:active .lk-icon-img{filter:none;opacity:1}' +
    '.lk-icon-fb{display:none;flex-shrink:0;width:16px;font-family:\'Bebas Neue\',sans-serif;font-size:14px;color:rgba(255,255,255,.4);text-align:center;transition:color var(--t)}' +
    '.lk-icon-mask.failed{display:none}' +
    '.lk-icon-mask.failed+.lk-icon-fb{display:block}' +
    '.lk-link:hover .lk-icon-fb,.lk-link:active .lk-icon-fb{color:var(--brand,#fff)}' +
    '.lk-icon-inline{flex-shrink:0}' +
    '.lk-icon-inline .fedi-rest{opacity:.4;transition:opacity var(--t)}' +
    '.lk-icon-inline .fedi-color{opacity:0;transition:opacity var(--t)}' +
    '.lk-link.rainbow:hover .lk-icon-inline .fedi-rest,.lk-link.rainbow:active .lk-icon-inline .fedi-rest{opacity:0}' +
    '.lk-link.rainbow:hover .lk-icon-inline .fedi-color,.lk-link.rainbow:active .lk-icon-inline .fedi-color{opacity:1}' +
    '.lk-socials{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}' +
    '.lk-social{display:flex;flex-direction:column;align-items:center;gap:8px;padding:15px 9px 12px;background:var(--bg2);border:1px solid var(--b1);color:#fff;text-decoration:none;font-size:8px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;transition:background var(--t),border-color var(--t),box-shadow var(--t)}' +
    '.lk-social:hover,.lk-social:active{background:var(--bg3);border-color:var(--brand,#333);box-shadow:0 0 10px rgba(255,255,255,.08);box-shadow:0 0 10px color-mix(in srgb,var(--brand,#333) 25%,transparent)}' +
    '.lk-social:focus-visible{outline:2px solid var(--brand,#fff);outline-offset:-2px}' +
    '.lk-social .lk-icon-mask{width:23px;height:23px;background-color:rgba(255,255,255,.65)}' +
    '.lk-social:hover .lk-icon-mask,.lk-social:active .lk-icon-mask{background-color:var(--brand,#fff)}' +
    '.lk-social .lk-icon-fb{width:23px;font-size:19px;color:rgba(255,255,255,.65)}' +
    '.lk-social:hover .lk-icon-fb,.lk-social:active .lk-icon-fb{color:var(--brand,#fff)}' +
    '.lk-tiktok:hover,.lk-tiktok:active{border-color:#69c9d0;box-shadow:-2px 0 6px rgba(238,29,82,.5),2px 0 6px rgba(105,201,208,.5)}' +
    '.lk-tiktok:hover .lk-icon-mask,.lk-tiktok:active .lk-icon-mask{background-color:#fff;filter:drop-shadow(-1px 0 0 #ee1d52) drop-shadow(1px 0 0 #69c9d0)}';
  document.head.appendChild(st);

  /* ── GOOGLE FONTS ── */
  if (!document.querySelector('link[href*="Bebas+Neue"]')) {
    var lp1 = document.createElement('link'); lp1.rel = 'preconnect'; lp1.href = 'https://fonts.googleapis.com';
    var lp2 = document.createElement('link'); lp2.rel = 'preconnect'; lp2.href = 'https://fonts.gstatic.com'; lp2.crossOrigin = '';
    var lf  = document.createElement('link'); lf.rel  = 'stylesheet'; lf.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap';
    document.head.appendChild(lp1);
    document.head.appendChild(lp2);
    document.head.appendChild(lf);
  }

  /* ── HTML ── */
  var wrap = document.createElement('div');
  wrap.innerHTML = '<div id="lk-card">' +

    '<div class="lk-section">' +
    '<div class="lk-section-label">Main Links</div>' +
    '<div class="lk-links">' +

    '<a class="lk-link rainbow" href="https://oshi.social/@dalekcoffee" target="_blank" rel="noopener noreferrer">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="lk-icon-inline" aria-hidden="true">' +
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
    '</g></svg>' +
    '<span class="lk-link-text">Fediverse</span><span class="lk-arrow" aria-hidden="true">↗</span></a>' +

    '<a class="lk-link" href="https://discord.com/invite/h6JerzYnpY" target="_blank" rel="noopener noreferrer" style="--brand:#5865f2">' +
    '<span class="lk-icon-mask" style="--mi:url(\'https://cdn.simpleicons.org/discord\')" data-fb="DC" aria-hidden="true"></span>' +
    '<span class="lk-icon-fb" aria-hidden="true">DC</span>' +
    '<span class="lk-link-text">Discord</span><span class="lk-arrow" aria-hidden="true">↗</span></a>' +

    '<a class="lk-link" href="https://cults3d.com/en/users/DalekCoffee/3d-models" target="_blank" rel="noopener noreferrer" style="--brand:#7b3fe4">' +
    '<img class="lk-icon-img" src="https://cults3d.com/favicon.ico" alt="" aria-hidden="true" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
    '<span class="lk-icon-abbr" style="display:none" aria-hidden="true">C3</span>' +
    '<span class="lk-link-text">3D Printables</span><span class="lk-arrow" aria-hidden="true">↗</span></a>' +

    '</div></div>' +

    '<div class="lk-section">' +
    '<div class="lk-section-label">Socials</div>' +
    '<div class="lk-socials">' +

    '<a class="lk-social lk-tiktok" href="https://www.tiktok.com/@dalekcoffee" target="_blank" rel="noopener noreferrer" style="--brand:#69c9d0">' +
    '<span class="lk-icon-mask" style="--mi:url(\'https://cdn.simpleicons.org/tiktok\')" data-fb="TT" aria-hidden="true"></span>' +
    '<span class="lk-icon-fb" aria-hidden="true">TT</span><span>TikTok</span></a>' +

    '<a class="lk-social" href="https://x.com/DalekCoffee" target="_blank" rel="noopener noreferrer" style="--brand:#aaa">' +
    '<span class="lk-icon-mask" style="--mi:url(\'https://cdn.simpleicons.org/x\')" data-fb="X" aria-hidden="true"></span>' +
    '<span class="lk-icon-fb" aria-hidden="true">X</span><span>X</span></a>' +

    '<a class="lk-social" href="https://www.twitch.tv/dalekcoffee" target="_blank" rel="noopener noreferrer" style="--brand:#9146ff">' +
    '<span class="lk-icon-mask" style="--mi:url(\'https://cdn.simpleicons.org/twitch\')" data-fb="TW" aria-hidden="true"></span>' +
    '<span class="lk-icon-fb" aria-hidden="true">TW</span><span>Twitch</span></a>' +

    '<a class="lk-social" href="https://www.instagram.com/dalekcoffee/" target="_blank" rel="noopener noreferrer" style="--brand:#e1306c">' +
    '<span class="lk-icon-mask" style="--mi:url(\'https://cdn.simpleicons.org/instagram\')" data-fb="IN" aria-hidden="true"></span>' +
    '<span class="lk-icon-fb" aria-hidden="true">IN</span><span>Instagram</span></a>' +

    '<a class="lk-social" href="https://bsky.app/profile/dalek.coffee" target="_blank" rel="noopener noreferrer" style="--brand:#0085ff">' +
    '<span class="lk-icon-mask" style="--mi:url(\'https://cdn.simpleicons.org/bluesky\')" data-fb="BS" aria-hidden="true"></span>' +
    '<span class="lk-icon-fb" aria-hidden="true">BS</span><span>Bluesky</span></a>' +

    '<a class="lk-social" href="https://www.youtube.com/@DalekCoffee" target="_blank" rel="noopener noreferrer" style="--brand:#f00">' +
    '<span class="lk-icon-mask" style="--mi:url(\'https://cdn.simpleicons.org/youtube\')" data-fb="YT" aria-hidden="true"></span>' +
    '<span class="lk-icon-fb" aria-hidden="true">YT</span><span>YouTube</span></a>' +

    '<a class="lk-social" href="https://www.threads.com/@dalekcoffee" target="_blank" rel="noopener noreferrer" style="--brand:#aaa">' +
    '<span class="lk-icon-mask" style="--mi:url(\'https://cdn.simpleicons.org/threads\')" data-fb="TH" aria-hidden="true"></span>' +
    '<span class="lk-icon-fb" aria-hidden="true">TH</span><span>Threads</span></a>' +

    '<a class="lk-social" href="https://beamstream.gg/dalekcoffee" target="_blank" rel="noopener noreferrer" style="--brand:#285680">' +
    '<img class="lk-icon-img" src="https://beamstream.gg/favicon.ico" alt="" aria-hidden="true" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
    '<span class="lk-icon-abbr" style="display:none" aria-hidden="true">BE</span><span>Beam</span></a>' +

    '<a class="lk-social" href="https://fluxer.gg/Lj10zbjx" target="_blank" rel="noopener noreferrer" style="--brand:#4641d9">' +
    '<span class="lk-icon-mask" style="--mi:url(\'https://fluxerstatic.com/marketing/branding/symbol-black.svg\')" data-fb="FL" aria-hidden="true"></span>' +
    '<span class="lk-icon-fb" aria-hidden="true">FL</span><span>Fluxer</span></a>' +

    '</div></div>' +
    '</div>';

  s.parentNode.insertBefore(wrap, s);

  /* ── ICON PROBE ── */
  var masks = wrap.querySelectorAll('.lk-icon-mask[data-fb]');
  var checked = {};
  masks.forEach(function (el) {
    var url = (el.style.getPropertyValue('--mi') || '').replace(/url\(['"]?|['"]?\)/g, '');
    if (!url || checked[url] !== undefined) return;
    checked[url] = null;
    var img = new Image();
    img.onload = function () { checked[url] = true; };
    img.onerror = function () {
      checked[url] = false;
      wrap.querySelectorAll('.lk-icon-mask[data-fb]').forEach(function (m) {
        var u = (m.style.getPropertyValue('--mi') || '').replace(/url\(['"]?|['"]?\)/g, '');
        if (u === url) m.classList.add('failed');
      });
    };
    img.src = url;
  });
}());
