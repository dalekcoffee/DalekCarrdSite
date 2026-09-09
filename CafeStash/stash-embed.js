(function () {
  'use strict';

  var BASE     = 'https://dalekcoffee.github.io/DalekCarrdSite/CafeStash/';
  var DATA_URL = BASE + 'stash-data.json';

  /* ── SVG snippets ── */
  var ARROW_SVG   = '<svg class="c-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 6h7M6.5 3L9.5 6l-3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var MERCH_ARROW = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 5h6M5.5 2.5L8 5l-2.5 2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var PHOTO_ICON  = '<div class="ph-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="1" stroke="white" stroke-width="1.2"/><circle cx="8" cy="8" r="2.5" stroke="white" stroke-width="1.2"/><path d="M12 4.5h1" stroke="white" stroke-width="1.2" stroke-linecap="round"/></svg></div>';

  /* ── Helpers ── */
  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  }

  function shimmerThumb(src) {
    /* No image yet: skip the shimmer entirely and leave the photo placeholder. */
    if (!src) return '<div class="c-thumb">' + PHOTO_ICON + '</div>';
    var imgTag = '<img src="' + esc(src) + '" alt="" ' +
      'onload="this.classList.add(\'loaded\');var c=this.parentNode;c.querySelector(\'.shimmer\').style.display=\'none\';c.querySelector(\'.ph-icon\').style.display=\'none\';" ' +
      'onerror="this.parentNode.querySelector(\'.shimmer\').style.display=\'none\';">';
    return '<div class="c-thumb"><div class="shimmer"></div>' + PHOTO_ICON + imgTag + '</div>';
  }

  function imgUrl(path) {
    return path ? BASE + encodeURI(path) : '';
  }

  function merch_imgWrap(item) {
    var src = imgUrl(item.img) || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2'%3E%3Crect width='2' height='2' fill='%23111'/%3E%3C/svg%3E";
    return '<div class="merch-img-wrap"><div class="shimmer"></div>' +
      '<img src="' + src + '" alt="' + esc(item.name) + '" class="loading" ' +
      'onload="this.classList.remove(\'loading\');this.previousElementSibling.style.display=\'none\'" ' +
      'onerror="this.previousElementSibling.style.display=\'none\'"></div>';
  }

  function secHead(heading, tag) {
    return '<div class="sec-head"><h2>' + esc(heading) + '</h2><span class="sec-tag">' + esc(tag) + '</span></div>';
  }

  function colGroup(icon, label) {
    return '<div class="col-group"><span class="col-group-icon" aria-hidden="true">' + icon +
      '</span><span class="col-group-label">' + esc(label) + '</span></div>';
  }

  function noteBadge(text, label) {
    return '<span class="note-badge" data-tooltip="' + esc(text) + '">' +
      esc(label || 'Note') + '</span>';
  }

  var ALT_BADGE  = '<span class="alt-badge" data-tooltip="Alt Picks are alternatives Dalek found after his original item if his current items are no longer available for purchase. These are the items he would probably buy next. - Compatibility between items has not been verified.">Alt Pick</span>';
  var DISC_BADGE = '<span class="disc-badge">Discontinued</span>';

  function sectionFooter(text) {
    var paras = text.split('\n\n');
    var last  = paras.pop();
    var body  = paras.map(function(p) { return '<p>' + esc(p) + '</p>'; }).join('');
    body += '<div class="sec-footer-alt">' + ALT_BADGE + '<p>' + esc(last) + '</p></div>';
    return '<div class="sec-footer">' + body + '</div>';
  }

  /* ── Build compact row ── */
  function buildCRow(item, extraClass) {
    var cls    = 'c-row' + (extraClass ? ' ' + extraClass : '');
    var hasLink = item.url && item.url.length > 0;
    if (!hasLink) cls += ' no-link';
    var tag   = hasLink ? 'a' : 'div';
    var attrs = hasLink ? ' href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer"' : '';
    var badge = item.alt ? ALT_BADGE : (item.discontinued ? DISC_BADGE : '');
    if (item.note) badge += noteBadge(item.note, item.noteLabel);
    var desc  = item.desc ? '<div class="c-desc">' + esc(item.desc) + '</div>' : '';
    return '<' + tag + ' class="' + cls + '"' + attrs + '>' +
      shimmerThumb(imgUrl(item.img)) +
      '<div class="c-text">' +
        '<div class="c-label">' + esc(item.label) + '</div>' +
        '<div class="c-name">'  + esc(item.name)  + '</div>' +
        badge +
        desc +
      '</div>' +
      (hasLink ? ARROW_SVG : '') +
      '</' + tag + '>';
  }

  /* ── Build column from groups array ── */
  function buildColumn(groups, rowExtraClass) {
    return groups.map(function (g) {
      var rows = g.items.map(function (item) {
        return buildCRow(item, rowExtraClass);
      }).join('');
      return colGroup(g.icon, g.group) + rows;
    }).join('');
  }

  /* ── Build full-width group: rows sit in a 2-up grid on desktop ── */
  function buildFullColumn(groups, rowExtraClass) {
    return groups.map(function (g) {
      var rows = g.items.map(function (item) {
        return buildCRow(item, rowExtraClass);
      }).join('');
      return colGroup(g.icon, g.group) + '<div class="full-rows">' + rows + '</div>';
    }).join('');
  }

  /* ── Render intro description ── */
  function renderIntro(data) {
    if (!data.intro) return '';
    return '<div class="intro-bar"><p class="intro-text">' + esc(data.intro) + '</p></div>';
  }

  /* ── Render merch panel ── */
  function renderMerch(data) {
    var items = data.merch.items.map(function (item) {
      var desc = item.desc ? '<span class="merch-desc">' + esc(item.desc) + '</span>' : '';
      return '<a class="merch-item" href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">' +
        merch_imgWrap(item) +
        '<div class="merch-info">' +
          '<span class="merch-sub">'  + esc(item.sub)  + '</span>' +
          '<span class="merch-name">' + esc(item.name) + '</span>' +
          desc +
          '<span class="merch-cta">Shop now ' + MERCH_ARROW + '</span>' +
        '</div></a>';
    }).join('');
    return '<div class="stash-panel">' +
      secHead(data.merch.heading, data.merch.tag) +
      '<div class="merch-grid">' + items + '</div>' +
      '</div>';
  }

  /* ── Build coffee card (grid item) ── */
  function buildCoffeeCard(item) {
    var hasLink = item.url && item.url.length > 0;
    var cls   = 'coffee-card' + (hasLink ? '' : ' no-link');
    var tag   = hasLink ? 'a' : 'div';
    var attrs = hasLink ? ' href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer"' : '';
    var src   = imgUrl(item.img);
    var imgTag = src
      ? '<img src="' + esc(src) + '" alt="' + esc(item.name) + '" ' +
        'onload="this.classList.add(\'loaded\');var c=this.parentNode;c.querySelector(\'.shimmer\').style.display=\'none\';c.querySelector(\'.ph-icon\').style.display=\'none\';" ' +
        'onerror="this.parentNode.querySelector(\'.shimmer\').style.display=\'none\';">'
      : '<img src="" alt="">';
    var badge = item.alt ? ALT_BADGE : '';
    var fav   = item.favorite ? '<div class="coffee-fav"><span class="coffee-fav-star">★</span>Favorite</div>' : '';
    var desc  = item.desc ? '<span class="coffee-card-desc">' + esc(item.desc) + '</span>' : '';
    return '<' + tag + ' class="' + cls + '"' + attrs + '>' +
      '<div class="coffee-card-img"><div class="shimmer"></div>' + PHOTO_ICON + imgTag + fav + '</div>' +
      '<div class="coffee-card-info">' +
        '<span class="coffee-card-label">' + esc(item.label) + '</span>' +
        '<span class="coffee-card-name">'  + esc(item.name)  + '</span>' +
        badge +
        desc +
      '</div>' +
      '</' + tag + '>';
  }

  /* ── Render coffee panel ── */
  function renderCoffee(data) {
    var c = data.coffee;
    var beans = c.left.items.map(buildCoffeeCard).join('');
    var gear  = c.right.items.map(buildCoffeeCard).join('');
    var disclaimer = c.disclaimer ? sectionFooter(c.disclaimer) : '';
    return '<div class="stash-panel">' +
      secHead(c.heading, c.tag) +
      colGroup(c.left.icon, c.left.label) +
      '<div class="coffee-beans-grid">' + beans + '</div>' +
      colGroup(c.right.icon, c.right.label) +
      '<div class="gear-grid">' + gear + '</div>' +
      disclaimer +
      '</div>';
  }

  /* ── Render setup panel ── */
  function renderSetup(data) {
    var s = data.setup;
    var disclaimer = s.disclaimer ? sectionFooter(s.disclaimer) : '';
    var full = (s.full && s.full.length)
      ? '<div class="full-col">' + buildFullColumn(s.full) + '</div>'
      : '';
    return '<div class="stash-panel">' +
      secHead(s.heading, s.tag) +
      '<div class="dual-col">' +
        '<div class="dual-col-side">' + buildColumn(s.left)  + '</div>' +
        '<div class="dual-col-side">' + buildColumn(s.right) + '</div>' +
      '</div>' +
      full +
      disclaimer +
      '</div>';
  }

  /* ── Render card footer ── */
  function renderFooter(section) {
    var badges = section.badges.map(function (b) {
      return '<span class="badge ' + b.cls + '">' + esc(b.label) + '</span>';
    }).join('');
    return '<div class="footer-bar">' +
      '<span class="footer-note"><a href="https://dalek.coffee" target="_blank" rel="noopener noreferrer">dalek.coffee</a>&nbsp;·&nbsp;affiliate links used</span>' +
      '<div class="footer-badges">' + badges + '</div>' +
      '</div>';
  }

  /* ── Sections ──
     One Carrd page per section, one card each. A card says which section it
     is with data-stash-section; nothing else on the page has to match.

     There is no tab bar here on purpose — moving between Merch, Coffee and
     Setup is plain Carrd navigation, driven by the header buttons on the
     Carrd side. That means each section gets a real page id, so deep links,
     the back button and open-in-new-tab all work the way they do for every
     other page on the site, with no help from this script. */
  var PRINTIFY = { label: 'Printify', cls: 'badge-pf'  };
  var AMAZON   = { label: 'Amazon',   cls: 'badge-amz' };

  var SECTIONS = {
    merch:  { render: renderMerch,  badges: [PRINTIFY] },
    coffee: { render: renderCoffee, badges: [AMAZON]   },
    setup:  { render: renderSetup,  badges: [AMAZON]   }
  };

  /* ── Alt badge: block product link on mobile so tooltip can show ── */
  function initAltBadgeBlock() {
    document.querySelectorAll('.alt-badge').forEach(function (badge) {
      badge.addEventListener('click', function (e) {
        if (window.innerWidth > 1280) return; // desktop: CSS tooltip handles it
        e.stopPropagation();
        e.preventDefault();
      });
    });
  }

  /* ── Collect every stash card in the document ── */
  function collectCards() {
    var cards = [];
    document.querySelectorAll('.card[data-stash-section]').forEach(function (el) {
      var slug    = (el.getAttribute('data-stash-section') || '').toLowerCase().trim();
      var section = SECTIONS[slug];
      if (section) {
        cards.push({ el: el, section: section });
      } else {
        console.error('[CafeStash] unknown data-stash-section "' + slug +
          '" — expected one of: merch, coffee, setup');
      }
    });
    return cards;
  }

  function boot(data, cards) {
    cards.forEach(function (c) {
      c.el.insertAdjacentHTML('beforeend',
        renderIntro(data) + c.section.render(data) + renderFooter(c.section));
    });
    initAltBadgeBlock();
  }

  function fail(cards) {
    cards.forEach(function (c) {
      c.el.insertAdjacentHTML('beforeend',
        '<div style="padding:20px;font-family:monospace;font-size:10px;' +
        'color:rgba(255,255,255,.3)">cafe stash unavailable</div>');
    });
  }

  /* ── Go ──
     Each stash page carries its own copy of this script tag, but Carrd serves
     every page as a single document — so the first copy to run claims the job
     and renders all three cards. Waiting for DOMContentLoaded matters: at
     script-execution time only the cards parsed so far exist. */
  if (window.__cafeStashBooted) { return; }
  window.__cafeStashBooted = true;

  function start() {
    var cards = collectCards();
    if (!cards.length) { return; }

    fetch(DATA_URL + '?t=' + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (data) { boot(data, cards); })
      .catch(function (e) {
        console.error('[CafeStash] Failed to load stash-data.json', e);
        fail(cards);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

}());
