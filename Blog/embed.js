(function () {
  'use strict';

  var BASE  = 'https://dalekcoffee.github.io/DalekCarrdSite/Blog';
  var mount = document.getElementById('bl-root');
  var cache = {}; /* slug -> parsed entry data */
  var activeTag = null;

  /* ── FONTS ── */
  if (!document.querySelector('link[href*="Bebas+Neue"]')) {
    var lp1 = document.createElement('link'); lp1.rel = 'preconnect'; lp1.href = 'https://fonts.googleapis.com';
    var lp2 = document.createElement('link'); lp2.rel = 'preconnect'; lp2.href = 'https://fonts.gstatic.com'; lp2.crossOrigin = '';
    var lf  = document.createElement('link'); lf.rel  = 'stylesheet'; lf.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap';
    document.head.appendChild(lp1);
    document.head.appendChild(lp2);
    document.head.appendChild(lf);
  }

  /* ── STYLES ── */
  var st = document.createElement('style');
  st.textContent = [
    /* reset */
    '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}',
    /* tokens */
    ':root{--t:0.2s;--bg:#0d0d0d;--bg2:#111;--bg3:#191919;--b1:#1a1a1a;--b2:#111;--blog:#EC4729}',
    /* card shell */
    '#bl-card{background:var(--bg);color:#fff;border-top:2px solid #fff;border-bottom:1px solid var(--b2);font-family:\'Space Mono\',monospace;-webkit-font-smoothing:antialiased}',
    /* header */
    '.bl-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--b2)}',
    '.bl-header-label{font-family:\'Bebas Neue\',sans-serif;font-size:25px;letter-spacing:0.15em;color:#fff}',
    '.bl-count{font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,.3)}',
    /* tag filter bar */
    '.bl-filter{display:flex;gap:6px;flex-wrap:wrap;padding:12px 20px;border-bottom:1px solid var(--b2)}',
    '.bl-filter-btn{font-family:\'Space Mono\',monospace;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,.3);background:none;border:1px solid rgba(255,255,255,.1);padding:4px 9px;cursor:pointer;transition:color var(--t),border-color var(--t),background var(--t)}',
    '.bl-filter-btn:hover{color:rgba(255,255,255,.7);border-color:rgba(255,255,255,.3)}',
    '.bl-filter-btn:focus-visible{outline:2px solid #fff;outline-offset:-2px}',
    '.bl-filter-btn.active{color:#fff;border-color:rgba(255,255,255,.5);background:rgba(255,255,255,.06)}',
    /* post row */
    '.bl-post{border-bottom:1px solid var(--b2)}',
    '.bl-post:last-child{border-bottom:none}',
    '.bl-post.bl-hidden{display:none}',
    /* strip */
    '.bl-strip{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 20px;cursor:pointer;user-select:none;transition:background var(--t);position:relative}',
    '.bl-strip::before{content:\'\';position:absolute;top:0;bottom:0;left:0;width:2px;background:var(--b1);transition:background var(--t)}',
    '.bl-strip:hover,.bl-strip:active,.bl-post.open>.bl-strip{background:rgba(255,255,255,.025)}',
    '.bl-strip:hover::before,.bl-strip:active::before,.bl-post.open>.bl-strip::before{background:var(--blog)}',
    '.bl-strip:focus-visible{outline:2px solid #fff;outline-offset:-2px}',
    '.bl-strip-left{flex:1;min-width:0}',
    /* meta row */
    '.bl-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}',
    '.bl-postid{font-size:9px;font-weight:700;letter-spacing:0.12em;color:rgba(255,255,255,.2);font-family:\'Bebas Neue\',sans-serif}',
    '.bl-date{font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,.3)}',
    '.bl-tags{display:flex;gap:5px;flex-wrap:wrap}',
    '.bl-tag{font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,.25);border:1px solid rgba(255,255,255,.1);padding:1px 5px;transition:color var(--t),border-color var(--t)}',
    '.bl-strip:hover .bl-tag,.bl-strip:active .bl-tag,.bl-post.open>.bl-strip .bl-tag{color:#fff;border-color:rgba(255,255,255,.3)}',
    /* title + summary */
    '.bl-title{font-family:\'Bebas Neue\',sans-serif;font-size:21px;letter-spacing:0.07em;color:rgba(255,255,255,.85);margin-bottom:6px;line-height:1.25;transition:color var(--t)}',
    '.bl-strip:hover .bl-title,.bl-strip:active .bl-title,.bl-post.open>.bl-strip .bl-title{color:#fff}',
    '.bl-summary{font-size:12px;line-height:1.65;color:rgba(255,255,255,.35)}',
    /* chevron */
    '.bl-toggle{flex-shrink:0;margin-left:16px;padding-top:4px;color:#333;transition:color var(--t),transform 0.35s ease}',
    '.bl-strip:hover .bl-toggle,.bl-strip:active .bl-toggle{color:#555}',
    '.bl-post.open>.bl-strip .bl-toggle{color:#fff;transform:rotate(180deg)}',
    /* collapsible body */
    '.bl-body{max-height:0;overflow:hidden;opacity:0;transition:max-height 0.8s cubic-bezier(0.4,0,0.2,1),opacity 0.5s ease}',
    '.bl-post.open>.bl-body{max-height:12000px;opacity:1}',
    /* body inner */
    '.bl-body-inner{padding:0 20px 22px;border-top:1px solid var(--b1)}',
    /* disclosure */
    '.bl-disclosure{font-size:11px;line-height:1.8;color:rgba(255,255,255,.3);font-style:italic;padding:14px 0;border-bottom:1px solid var(--b1)}',
    /* platform note */
    '.bl-platform-note{font-size:10px;color:rgba(255,255,255,.3);padding:10px 0;border-bottom:1px solid var(--b1)}',
    '.bl-link{color:rgba(255,255,255,.7);text-decoration:none;transition:color var(--t)}',
    '.bl-link:hover{color:#fff;text-decoration:underline}',
    /* sections */
    '.bl-section{padding:16px 0;border-bottom:1px solid var(--b1)}',
    '.bl-section:last-child{border-bottom:none;padding-bottom:0}',
    '.bl-section-heading{font-family:\'Bebas Neue\',sans-serif;font-size:15px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,.65);margin-bottom:12px}',
    /* paragraphs */
    '.bl-para{font-size:13px;line-height:1.8;color:rgba(255,255,255,.7);margin-bottom:10px}',
    '.bl-para:last-child{margin-bottom:0}',
    /* inline code */
    '.bl-para code,.bl-list-text code{font-family:\'Space Mono\',monospace;font-size:12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);padding:1px 5px;color:rgba(255,255,255,.85)}',
    /* lists */
    '.bl-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}',
    '.bl-list-item{font-size:13px;line-height:1.65;color:rgba(255,255,255,.7);display:flex;align-items:baseline;gap:10px}',
    '.bl-list-num{font-family:\'Bebas Neue\',sans-serif;font-size:16px;color:rgba(255,255,255,.65);flex-shrink:0;width:18px;text-align:right;line-height:1}',
    '.bl-list-bullet{color:rgba(255,255,255,.5);flex-shrink:0;font-size:13px;line-height:1.65}',
    '.bl-list-text{flex:1}',
    /* timeline */
    '.bl-timeline{display:flex;flex-direction:column}',
    '.bl-tl-entry{display:flex;gap:16px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05)}',
    '.bl-tl-entry:last-child{border-bottom:none}',
    '.bl-tl-date{font-family:\'Space Mono\',monospace;font-size:10px;font-weight:700;color:rgba(255,255,255,.65);letter-spacing:0.05em;flex-shrink:0;width:108px;padding-top:1px}',
    '.bl-tl-text{font-size:13px;line-height:1.65;color:rgba(255,255,255,.65);flex:1}',
    /* images */
    '.bl-img-wrap{margin-top:12px}',
    '.bl-img{width:100%;display:block;border:1px solid var(--b1)}',
    '.bl-img-placeholder{margin-top:12px;padding:18px;background:rgba(255,255,255,.02);border:1px dashed rgba(255,255,255,.1);text-align:center;font-size:10px;color:rgba(255,255,255,.18);letter-spacing:0.2em;text-transform:uppercase}',
    /* loading shimmer */
    '.bl-loading{padding:20px;display:flex;flex-direction:column;gap:9px;border-top:1px solid var(--b1)}',
    '.bl-shimmer{height:9px;background:linear-gradient(90deg,var(--b1),rgba(255,255,255,.04),var(--b1));background-size:200% 100%;animation:bl-shim 1.6s infinite linear}',
    '.bl-s-wide{width:85%}.bl-s-mid{width:62%}.bl-s-short{width:40%}',
    '@keyframes bl-shim{0%{background-position:200% 0}100%{background-position:-200% 0}}',
    /* error / empty */
    '.bl-error{padding:24px 20px;font-size:13px;color:rgba(255,255,255,.3);text-align:center;letter-spacing:0.1em;text-transform:uppercase}',
    /* mobile */
    '@media(max-width:640px){',
    '.bl-filter{padding:10px 16px}',
    '.bl-strip{padding:14px 16px}',
    '.bl-title{font-size:17px}',
    '.bl-summary{font-size:10px}',
    '.bl-body-inner{padding:0 16px 18px}',
    '.bl-para{font-size:12px}',
    '.bl-list-item{font-size:12px}',
    '.bl-tl-entry{flex-direction:column;gap:3px}',
    '.bl-tl-date{width:auto;font-size:9px}',
    '.bl-tl-text{font-size:12px}',
    '.bl-section-heading{font-size:14px}',
    '}'
  ].join('');
  document.head.appendChild(st);

  /* ── CARD SHELL ── */
  var card = document.createElement('div');
  card.id = 'bl-card';
  card.innerHTML =
    '<div class="bl-header">' +
      '<span class="bl-header-label">Blog</span>' +
      '<span class="bl-count" id="bl-count"></span>' +
    '</div>';
  (mount || document.body).appendChild(card);

  /* ── FETCH INDEX ── */
  fetch(BASE + '/index.json')
    .then(function (r) { return r.json(); })
    .then(renderIndex)
    .catch(function () {
      card.insertAdjacentHTML('beforeend', '<div class="bl-error">Unable to load posts.</div>');
    });

  /* ── RENDER INDEX ── */
  function renderIndex(posts) {
    var countEl = document.getElementById('bl-count');
    if (countEl) countEl.textContent = posts.length + (posts.length === 1 ? ' entry' : ' entries');

    renderFilter(posts);

    posts.forEach(function (meta) {
      card.appendChild(buildStrip(meta));
    });
  }

  /* ── TAG FILTER BAR ── */
  function renderFilter(posts) {
    var seen = {};
    var tags = [];
    posts.forEach(function (p) {
      (p.tags || []).forEach(function (t) {
        if (!seen[t]) { seen[t] = true; tags.push(t); }
      });
    });
    if (tags.length === 0) return;

    var bar = document.createElement('div');
    bar.className = 'bl-filter';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Filter by tag');

    bar.innerHTML = '<button class="bl-filter-btn active" data-tag="">ALL</button>' +
      tags.map(function (t) {
        return '<button class="bl-filter-btn" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('');

    bar.addEventListener('click', function (e) {
      var btn = e.target.closest
        ? e.target.closest('.bl-filter-btn')
        : (e.target.className.indexOf('bl-filter-btn') !== -1 ? e.target : null);
      if (!btn) return;
      bar.querySelectorAll('.bl-filter-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      applyFilter(btn.dataset.tag || null);
    });

    card.appendChild(bar);
  }

  function applyFilter(tag) {
    activeTag = tag;
    card.querySelectorAll('.bl-post').forEach(function (post) {
      var postTags = (post.dataset.tags || '').split(',');
      var match = !tag || postTags.indexOf(tag) !== -1;
      post.classList.toggle('bl-hidden', !match);
    });
  }

  /* ── BUILD STRIP ── */
  function buildStrip(meta) {
    var post = document.createElement('div');
    post.className = 'bl-post';
    post.dataset.tags = (meta.tags || []).join(',');

    var tagsHtml = (meta.tags || []).map(function (t) {
      return '<span class="bl-tag">' + esc(t) + '</span>';
    }).join('');

    var idHtml = meta.id ? '<span class="bl-postid">#' + esc(meta.id) + '</span>' : '';

    post.innerHTML =
      '<div class="bl-strip" role="button" tabindex="0" aria-expanded="false">' +
        '<div class="bl-strip-left">' +
          '<div class="bl-meta">' +
            idHtml +
            '<span class="bl-date">' + fmtDate(meta.date) + '</span>' +
            '<span class="bl-tags">' + tagsHtml + '</span>' +
          '</div>' +
          '<div class="bl-title">' + esc(meta.title) + '</div>' +
          '<div class="bl-summary">' + esc(meta.summary) + '</div>' +
        '</div>' +
        '<div class="bl-toggle" aria-hidden="true">' +
          '<svg width="14" height="9" viewBox="0 0 14 9" fill="none">' +
            '<path d="M1 1L7 7.5L13 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
        '</div>' +
      '</div>' +
      '<div class="bl-body"></div>';

    var strip = post.querySelector('.bl-strip');
    var body  = post.querySelector('.bl-body');

    strip.addEventListener('click', function () { toggle(post, strip, body, meta.slug); });
    strip.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle(post, strip, body, meta.slug);
      }
    });

    return post;
  }

  /* ── TOGGLE OPEN/CLOSE ── */
  function toggle(post, strip, body, slug) {
    var isOpen = post.classList.contains('open');
    if (isOpen) {
      post.classList.remove('open');
      strip.setAttribute('aria-expanded', 'false');
      return;
    }
    post.classList.add('open');
    strip.setAttribute('aria-expanded', 'true');

    if (body.dataset.loaded) return; /* already rendered */

    body.innerHTML = shimmerHTML();

    if (cache[slug]) {
      body.innerHTML = renderEntry(cache[slug], slug);
      body.dataset.loaded = '1';
      return;
    }

    fetch(BASE + '/posts/' + slug + '/post.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        cache[slug] = data;
        body.innerHTML = renderEntry(data, slug);
        body.dataset.loaded = '1';
      })
      .catch(function () {
        body.innerHTML = '<div class="bl-body-inner"><p class="bl-para">Failed to load entry.</p></div>';
      });
  }

  /* ── RENDER ENTRY ── */
  function renderEntry(d, slug) {
    var postBase = BASE + '/posts/' + slug;
    var images = {};
    Object.keys(d.images || {}).forEach(function (k) {
      var v = d.images[k];
      images[k] = v ? postBase + '/' + v : null;
    });
    var html = '<div class="bl-body-inner">';

    if (d.disclosure) {
      html += '<div class="bl-disclosure">' + mi(d.disclosure) + '</div>';
    }

    if (d.platform && d.platform_url) {
      html += '<div class="bl-platform-note">Platform: ' +
        '<a class="bl-link" href="' + esc(d.platform_url) + '" target="_blank" rel="noopener noreferrer">' +
        esc(d.platform) + '</a></div>';
    }

    (d.sections || []).forEach(function (sec) {
      html += renderSection(sec, images);
    });

    html += '</div>';
    return html;
  }

  /* ── RENDER SECTION ── */
  function renderSection(sec, images) {
    var h = '<div class="bl-section">';
    h += '<div class="bl-section-heading">' + esc(sec.heading) + '</div>';

    if (sec.body) {
      sec.body.split('\n\n').forEach(function (p) {
        p = p.trim();
        if (p) h += '<p class="bl-para">' + mi(p) + '</p>';
      });
    }

    if (sec.items) {
      h += '<ul class="bl-list">';
      sec.items.forEach(function (item, i) {
        h += '<li class="bl-list-item">';
        if (sec.numbered) {
          h += '<span class="bl-list-num" aria-hidden="true">' + (i + 1) + '</span>';
        } else {
          h += '<span class="bl-list-bullet" aria-hidden="true">—</span>';
        }
        h += '<span class="bl-list-text">' + mi(item) + '</span></li>';
      });
      h += '</ul>';
    }

    if (sec.timeline) {
      h += '<div class="bl-timeline">';
      sec.timeline.forEach(function (entry) {
        h += '<div class="bl-tl-entry">' +
          '<div class="bl-tl-date">' + esc(entry.date) + '</div>' +
          '<div class="bl-tl-text">' + mi(entry.text) + '</div>' +
          '</div>';
      });
      h += '</div>';
    }

    if (sec.image_after) {
      var src = images[sec.image_after];
      if (src) {
        h += '<div class="bl-img-wrap">' +
          '<img class="bl-img" src="' + esc(src) + '" alt="" loading="lazy">' +
          '</div>';
      } else {
        h += '<div class="bl-img-placeholder">[ screenshot — ' + esc(sec.image_after) + ' ]</div>';
      }
    }

    h += '</div>';
    return h;
  }

  /* ── SHIMMER ── */
  function shimmerHTML() {
    return '<div class="bl-loading">' +
      '<div class="bl-shimmer bl-s-wide"></div>' +
      '<div class="bl-shimmer bl-s-mid"></div>' +
      '<div class="bl-shimmer bl-s-short"></div>' +
      '<div class="bl-shimmer bl-s-wide"></div>' +
      '<div class="bl-shimmer bl-s-mid"></div>' +
      '</div>';
  }

  /* ── HELPERS ── */

  /* safe HTML escape, then apply inline markdown: `code`, **bold** */
  function mi(str) {
    var s = esc(str);
    s = s.replace(/`([^`\n]{1,120})`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*\n]{1,120})\*\*/g, '<strong>$1</strong>');
    return s;
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtDate(iso) {
    var p = String(iso).split('-');
    var m = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return m[parseInt(p[1], 10) - 1] + ' ' + parseInt(p[2], 10) + ', ' + p[0];
  }

}());
