(function () {
  var mount = document.getElementById('nv-root');

  /* ── STYLES ── */
  var st = document.createElement('style');
  st.textContent = '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
    'body{background:transparent;font-family:\'Space Mono\',monospace;-webkit-font-smoothing:antialiased}' +
    ':root{--t:0.2s;--bg:#0d0d0d;--bg2:#111;--bg3:#191919;--b1:#1a1a1a;--b2:#111}' +
    '#nv-card{background:var(--bg);color:#fff;border-top:2px solid #fff;border-bottom:1px solid var(--b2)}' +
    '.nv-section{padding:14px 16px}' +
    '.nv-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}' +
    '.nv-item{position:relative;display:flex;align-items:center;justify-content:center;padding:16px 14px;background:var(--bg2);border:1px solid var(--b1);color:rgba(255,255,255,.65);text-decoration:none;overflow:hidden;transition:background var(--t),color var(--t),border-color var(--t),box-shadow var(--t)}' +
    '.nv-item::before{content:\'\';position:absolute;top:0;bottom:0;left:0;width:2px;background:#222;transition:background var(--t)}' +
    '.nv-item:hover,.nv-item:active{background:var(--bg3);color:#fff}' +
    '.nv-item:focus-visible{outline:2px solid var(--brand,#fff);outline-offset:-2px}' +
    '.nv-text{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}' +
    '.nv-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;line-height:1}' +
    '.nv-sub{font-size:8px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.35);line-height:1;transition:color var(--t)}' +
    '.nv-item:hover .nv-sub,.nv-item:active .nv-sub{color:rgba(255,255,255,.6)}' +
    '.nv-item .nv-arrow{position:absolute;top:8px;right:10px;font-size:12px;color:#2a2a2a;transition:color var(--t),transform var(--t);pointer-events:none}' +
    '.nv-item:hover .nv-arrow,.nv-item:active .nv-arrow{color:rgba(255,255,255,.35);transform:translate(2px,-2px)}' +
    '.nv-item.nv-here{background:var(--bg3);color:#fff}' +
    '.nv-item.nv-here::before{background:var(--brand,#fff)}' +
    '.foil{position:relative;--b-lt:#fff;--b-lt:color-mix(in srgb,var(--brand,#888) 40%,#fff);--b-a2:var(--brand2,var(--brand,#888))}' +
    '.foil > *{position:relative;z-index:2}' +
    '.foil::after{content:\'\';position:absolute;top:0;right:0;bottom:0;left:0;z-index:1;pointer-events:none;opacity:0;background:linear-gradient(115deg,rgba(255,255,255,0) 10%,rgba(255,255,255,.07) 28%,rgba(255,255,255,.10) 45%,rgba(255,255,255,.07) 65%,rgba(255,255,255,0) 92%);background:linear-gradient(115deg,transparent 10%,color-mix(in srgb,var(--brand,#888) 17%,transparent) 25%,color-mix(in srgb,var(--b-lt) 13%,transparent) 36%,rgba(255,255,255,.10) 45%,color-mix(in srgb,var(--b-a2) 16%,transparent) 55%,color-mix(in srgb,var(--brand,#888) 15%,transparent) 70%,transparent 92%);background-size:250% 100%;background-position:120% 0;transition:opacity var(--t)}' +
    '.foil:hover,.foil:active{border-color:transparent;border-image:linear-gradient(115deg,var(--brand,#888),var(--b-lt),var(--b-a2),var(--brand,#888)) 1;box-shadow:0 0 12px rgba(255,255,255,.12),0 0 22px rgba(255,255,255,.06);box-shadow:0 0 12px color-mix(in srgb,var(--brand,#888) 22%,transparent),0 0 22px color-mix(in srgb,var(--b-a2) 10%,transparent)}' +
    '.foil:hover::before,.foil:active::before{background:linear-gradient(180deg,var(--brand,#888),var(--b-lt),var(--b-a2))}' +
    '.foil:hover::after,.foil:active::after{opacity:1;animation:foil-sweep 2.6s linear infinite}' +
    '@keyframes foil-sweep{0%{background-position:120% 0}100%{background-position:-20% 0}}' +
    '@media (prefers-reduced-motion:reduce){.foil:hover::after,.foil:active::after{animation:none;background-position:50% 0}}' +
    '@media (max-width:760px){.nv-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
    '@media (max-width:400px){.nv-grid{grid-template-columns:minmax(0,1fr);gap:6px}.nv-item{padding:14px 12px}.nv-section{padding:12px 12px}}';
  document.head.appendChild(st);

  /* ── MARKUP ── */
  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div id="nv-card">' +
    '<nav class="nv-section" aria-label="Site sections">' +
    '<div class="nv-grid">' +

    '<a class="nv-item foil" href="https://dalek.coffee/#about" style="--brand:#fff; --brand2:#D6DCE5">' +
    '<span class="nv-text"><span class="nv-label">About</span><span class="nv-sub">who i am</span></span></a>' +

    '<a class="nv-item foil" href="https://dalek.coffee/#Links" style="--brand:#fff; --brand2:#D6DCE5">' +
    '<span class="nv-text"><span class="nv-label">Links</span><span class="nv-sub">find me</span></span></a>' +

    '<a class="nv-item foil" href="https://dalek.coffee/#projects" style="--brand:#fff; --brand2:#D6DCE5">' +
    '<span class="nv-text"><span class="nv-label">Projects</span><span class="nv-sub">side quests</span></span></a>' +

    '<a class="nv-item foil" href="https://www.youtube.com/watch?v=q-YyKGoBHh8&t=2s" target="_blank" rel="noopener noreferrer" style="--brand:#fff; --brand2:#D6DCE5">' +
    '<span class="nv-arrow" aria-hidden="true">↗</span>' +
    '<span class="nv-text"><span class="nv-label">OnlyFans</span><span class="nv-sub">click at own risk</span></span></a>' +

    '</div></nav></div>';

  (mount || document.body).appendChild(wrap);

  /* ── CURRENT SECTION ──
     Marks the section in view when the embed shares the page with the
     site; a no-op inside a cross-origin frame. */
  var items = wrap.querySelectorAll('.nv-item[href*="#"]');
  function sync() {
    var hash;
    try { hash = (window.top.location.hash || '').toLowerCase(); }
    catch (e) { hash = (location.hash || '').toLowerCase(); }
    items.forEach(function (a) {
      var target = (a.getAttribute('href').split('#')[1] || '').toLowerCase();
      a.classList.toggle('nv-here', !!hash && !!target && hash === '#' + target);
    });
  }
  sync();
  window.addEventListener('hashchange', sync);
}());
