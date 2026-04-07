(function () {
  var mount = document.getElementById('pj-root');

  /* ── STYLES ── */
  var st = document.createElement('style');
  st.textContent =
    '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
    'body{background:transparent;font-family:\'Space Mono\',monospace;-webkit-font-smoothing:antialiased}' +
    ':root{--t:0.2s;--bg:#0d0d0d;--bg2:#111;--bg3:#191919;--b1:#1a1a1a;--b2:#111;--rainbow:linear-gradient(180deg,#f00,#f80,#ff0,#0c0,#08f,#80f)}' +
    '#pj-card{background:var(--bg);color:#fff;font-family:\'Space Mono\',monospace;-webkit-font-smoothing:antialiased;border-top:2px solid #fff;border-bottom:1px solid var(--b2)}' +
    '.pj-section{padding:19px 23px;border-bottom:1px solid var(--b2)}' +
    '.pj-section:last-child{border-bottom:none}' +
    '.pj-subhead{font-size:11px;letter-spacing:.08em;color:rgba(255,255,255,.4);font-weight:400;margin-bottom:16px;text-align:center}' +
    '.pj-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}' +
    '.pj-item{position:relative;display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px 14px 18px;background:var(--bg2);border:1px solid var(--b1);color:rgba(255,255,255,.65);text-decoration:none;text-align:center;overflow:hidden;transition:background var(--t),border-color var(--t),box-shadow var(--t),color var(--t)}' +
    '.pj-item::before{content:\'\';position:absolute;top:0;bottom:0;left:0;width:2px;background:#222;transition:background var(--t)}' +
    '.pj-item:hover,.pj-item:active{background:var(--bg3);color:#fff;border-color:var(--brand,#333);box-shadow:0 0 10px rgba(255,255,255,.08);box-shadow:0 0 10px color-mix(in srgb,var(--brand,#333) 20%,transparent)}' +
    '.pj-item:hover::before,.pj-item:active::before{background:var(--brand,#fff)}' +
    '.pj-item:focus-visible{outline:2px solid var(--brand,#fff);outline-offset:-2px}' +
    '.pj-logo{width:72px;height:72px;object-fit:contain;flex-shrink:0;opacity:0.9;transition:transform var(--t),opacity var(--t)}' +
    '.pj-item:hover .pj-logo,.pj-item:active .pj-logo{opacity:1;transform:scale(1.05)}' +
    '.pj-name{font-family:\'Bebas Neue\',sans-serif;font-size:22px;letter-spacing:.08em;color:#fff;line-height:1;transition:color var(--t)}' +
    '.pj-item:hover .pj-name,.pj-item:active .pj-name{color:var(--brand,#fff)}' +
    '.pj-desc{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.4);line-height:1.5;transition:color var(--t)}' +
    '.pj-item:hover .pj-desc,.pj-item:active .pj-desc{color:rgba(255,255,255,.65)}' +
    '.pj-item.rainbow:hover,.pj-item.rainbow:active{border-color:transparent;border-image:linear-gradient(135deg,#f00,#f80,#ff0,#0c0,#08f,#80f) 1;box-shadow:0 0 14px rgba(100,60,200,.25),0 0 4px rgba(255,100,0,.15)}' +
    '.pj-item.rainbow:hover::before,.pj-item.rainbow:active::before{background:var(--rainbow)}' +
    '.pj-item.rainbow:hover .pj-name,.pj-item.rainbow:active .pj-name{background:linear-gradient(90deg,#f00,#f80,#ff0,#0c0,#08f,#80f);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}' +
    '.pj-arrow{position:absolute;top:10px;right:12px;font-size:14px;color:#2a2a2a;transition:color var(--t),transform var(--t);pointer-events:none}' +
    '.pj-item:hover .pj-arrow,.pj-item:active .pj-arrow{color:rgba(255,255,255,.3);transform:translate(2px,-2px)}' +
    '@media (max-width:640px){.pj-grid{grid-template-columns:1fr}.pj-logo{width:60px;height:60px}.pj-name{font-size:20px}.pj-section{padding:16px}}';
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
  var BASE = 'https://dalekcoffee.github.io/DalekCarrdSite/ProjectLinks/';
  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div id="pj-card">' +
    '<div class="pj-section">' +
    '<div class="pj-subhead">Some of my side projects :3</div>' +
    '<div class="pj-grid">' +

    '<a class="pj-item rainbow" href="https://resomeow.com" target="_blank" rel="noopener noreferrer">' +
    '<span class="pj-arrow" aria-hidden="true">↗</span>' +
    '<img class="pj-logo" src="' + BASE + 'CarrdResomeowLogo.png" alt="Resomeow logo">' +
    '<div class="pj-name">Resomeow</div>' +
    '<div class="pj-desc">Resonite appreciation<br>Channel</div>' +
    '</a>' +

    '<a class="pj-item" href="https://hub.oshi.social" target="_blank" rel="noopener noreferrer" style="--brand:#666BF7">' +
    '<span class="pj-arrow" aria-hidden="true">↗</span>' +
    '<img class="pj-logo" src="' + BASE + 'CarrdOshiNetworkLogo.png" alt="OshiNetwork logo">' +
    '<div class="pj-name">OshiNetwork</div>' +
    '<div class="pj-desc">Free Services for<br>fellow VR Creators</div>' +
    '</a>' +

    '</div>' +
    '</div>' +
    '</div>';

  (mount || document.body).appendChild(wrap);
}());
