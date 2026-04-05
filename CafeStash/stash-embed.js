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
    var imgTag = src
      ? '<img src="' + esc(src) + '" alt="" ' +
        'onload="this.classList.add(\'loaded\');var c=this.parentNode;c.querySelector(\'.shimmer\').style.display=\'none\';c.querySelector(\'.ph-icon\').style.display=\'none\';" ' +
        'onerror="this.parentNode.querySelector(\'.shimmer\').style.display=\'none\';">'
      : '<img src="" alt="">';
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

  var ALT_BADGE = '<span class="alt-badge" data-tooltip="Alt Pick items are alternatives Dalek found after his original item was discontinued — compatibility between parts has not been verified.">Alt Pick</span>';

  function tabFooter(text) {
    return '<div class="tab-footer">' + ALT_BADGE + '<p>' + esc(text) + '</p></div>';
  }

  /* ── Build compact row ── */
  function buildCRow(item, extraClass) {
    var cls    = 'c-row' + (extraClass ? ' ' + extraClass : '');
    var hasLink = item.url && item.url.length > 0;
    if (!hasLink) cls += ' no-link';
    var tag   = hasLink ? 'a' : 'div';
    var attrs = hasLink ? ' href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer"' : '';
    var badge = item.alt ? ALT_BADGE : '';
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
    return '<div class="tab-panel active">' +
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
    var disclaimer = c.disclaimer ? tabFooter(c.disclaimer) : '';
    return '<div class="tab-panel">' +
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
    var disclaimer = s.disclaimer ? tabFooter(s.disclaimer) : '';
    return '<div class="tab-panel">' +
      secHead(s.heading, s.tag) +
      '<div class="dual-col">' +
        '<div class="dual-col-side">' + buildColumn(s.left)  + '</div>' +
        '<div class="dual-col-side">' + buildColumn(s.right) + '</div>' +
      '</div>' +
      disclaimer +
      '</div>';
  }

  /* ── Render card footer ── */
  function renderFooter() {
    return '<div class="footer-bar">' +
      '<span class="footer-note"><a href="https://dalek.coffee" target="_blank" rel="noopener noreferrer">dalek.coffee</a>&nbsp;·&nbsp;affiliate links used</span>' +
      '<div class="footer-badges"><span class="badge badge-fw">Fourthwall</span><span class="badge badge-amz">Amazon</span></div>' +
      '</div>';
  }

  /* ── Wire up tabs (index-based) ── */
  function initTabs() {
    var tabs   = document.querySelectorAll('.tab');
    var panels = document.querySelectorAll('.tab-panel');
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t)   { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        panels.forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        if (panels[i]) panels[i].classList.add('active');
      });
    });
  }

  /* ── Boot ── */
  function boot(data) {
    var card = document.querySelector('.card');
    if (!card) return;

    // Insert intro above the tab bar
    var tabsEl = card.querySelector('.tabs');
    if (tabsEl && data.intro) {
      tabsEl.insertAdjacentHTML('beforebegin', renderIntro(data));
    }

    // Inject panels + card footer after the tab bar
    var panelsHTML = renderMerch(data) + renderCoffee(data) + renderSetup(data) + renderFooter();
    card.insertAdjacentHTML('beforeend', panelsHTML);
    initTabs();
  }

  /* ── Fetch data and go ── */
  fetch(DATA_URL + '?t=' + Date.now())
    .then(function (r) { return r.json(); })
    .then(function (data) { boot(data); })
    .catch(function (e) {
      console.error('[CafeStash] Failed to load shop-data.json', e);
      var card = document.querySelector('.card');
      if (card) card.insertAdjacentHTML('beforeend',
        '<div style="padding:20px;font-family:monospace;font-size:10px;color:rgba(255,255,255,.3)">cafe stash unavailable</div>');
    });

}());
