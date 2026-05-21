(function () {
  'use strict';

  var BASE = 'https://dalekcoffee.github.io/DalekCarrdSite/HeaderStatus';
  var MOTD_URL = BASE + '/MOTD.txt';
  var MAIN_ID = '252367431274725377';
  var WORK_ID = '1476219861289144394';

  /* ── MOUNT ── */
  var mount = document.getElementById('hs-root');
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'hs-root';
    (document.currentScript && document.currentScript.parentNode || document.body).appendChild(mount);
  }

  /* ── STYLES ── */
  if (!document.getElementById('hs-style')) {
    var st = document.createElement('style');
    st.id = 'hs-style';
    st.textContent = [
      '#hs-container{display:flex;justify-content:center;width:100%;box-sizing:border-box;padding:0.5rem 0}',
      '#hs-wrapper{display:flex;flex-direction:column;align-items:center;font-family:\'Inter\',sans-serif;font-weight:900;text-transform:uppercase;color:#fff;-webkit-text-stroke:3.5px #000;paint-order:stroke fill;font-variant-numeric:tabular-nums;font-size:16px;letter-spacing:0.15em;line-height:1.35;white-space:nowrap}',
      '#hs-clock{width:100%;text-align:center;margin-bottom:4px}',
      '.hs-row{display:flex;align-items:center;justify-content:center;width:100%;gap:8px;margin-bottom:4px}',
      '#hs-status,#hs-activity{display:inline-flex;align-items:center;gap:6px;padding:3px 14px;border-radius:999px;border:2px solid currentColor;box-shadow:0 0 0 2px #000;font-size:0.8em;font-weight:800;background:rgba(0,0,0,0.75);-webkit-text-stroke:0 transparent !important;text-shadow:none !important}',
      '.hs-icon{font-style:normal !important;display:inline-block;line-height:1}',
      '.hs-emoji{display:inline-block;-webkit-text-stroke:0 transparent;text-shadow:-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,2px 2px 0 #000,-2px 0 0 #000,2px 0 0 #000,0 -2px 0 #000,0 2px 0 #000}',
      '#hs-status[data-status="online"]{color:#43b581}',
      '#hs-status[data-status="idle"]{color:#faa81a}',
      '#hs-status[data-status="dnd"]{color:#f04747}',
      '#hs-status[data-status="offline"]{color:#bbb}',
      '#hs-status[data-status="live"]{color:#9146FF}',
      '#hs-status[data-status="live"] .hs-icon{font-size:0;width:10px;height:10px;background:#ff3333;border-radius:50%;align-self:center;animation:hs-live-pulse 1.5s infinite}',
      '@keyframes hs-live-pulse{0%{transform:scale(0.95);box-shadow:0 0 0 0 rgba(255,51,51,0.7)}70%{transform:scale(1);box-shadow:0 0 0 8px rgba(255,51,51,0)}100%{transform:scale(0.95);box-shadow:0 0 0 0 rgba(255,51,51,0)}}',
      '#hs-activity{color:#fff;border-color:#fff}',
      '#hs-activity.rainbow [data-role=activity-text]{background:linear-gradient(90deg,#f00,#f80,#ff0,#0c0,#08f,#80f);-webkit-background-clip:text;background-clip:text;color:transparent}',
      '#hs-motd-text{display:inline-block}',
      '.hs-blink{animation:hs-pulse 1s step-end infinite}',
      '@keyframes hs-pulse{0%,100%{opacity:1}50%{opacity:0}}',
      '.hs-hidden{display:none !important}',
      '@media screen and (max-width:768px){',
        '#hs-wrapper{font-size:12px;-webkit-text-stroke:2.5px #000}',
        '.hs-row{gap:6px}',
        '#hs-status,#hs-activity{padding:2px 10px;border-width:1.5px;box-shadow:0 0 0 1.5px #000}',
        '#hs-status[data-status="live"] .hs-icon{width:8px;height:8px}',
        '.hs-emoji{text-shadow:-1.5px -1.5px 0 #000,1.5px -1.5px 0 #000,-1.5px 1.5px 0 #000,1.5px 1.5px 0 #000,-1.5px 0 0 #000,1.5px 0 0 #000,0 -1.5px 0 #000,0 1.5px 0 #000}',
      '}'
    ].join('');
    document.head.appendChild(st);
  }

  /* ── MARKUP ── */
  mount.innerHTML =
    '<div id="hs-container"><div id="hs-wrapper">' +
      '<div id="hs-clock">MY TIME: --<span class="hs-blink">:</span>-- --- ---</div>' +
      '<div class="hs-row">' +
        '<span id="hs-status" data-status="offline">' +
          '<i class="hs-icon" data-role="status-icon">○</i>' +
          '<span data-role="status-text">···</span>' +
        '</span>' +
        '<span id="hs-activity" class="hs-hidden">' +
          '<i class="hs-icon" data-role="activity-icon">🎮</i>' +
          '<span data-role="activity-text"></span>' +
        '</span>' +
      '</div>' +
      '<div id="hs-motd-row" class="hs-row hs-hidden">' +
        '<span id="hs-motd-text"></span>' +
      '</div>' +
    '</div></div>';

  var clockEl    = mount.querySelector('#hs-clock');
  var statusEl   = mount.querySelector('#hs-status');
  var statusIcon = statusEl.querySelector('[data-role="status-icon"]');
  var statusText = statusEl.querySelector('[data-role="status-text"]');
  var actEl      = mount.querySelector('#hs-activity');
  var actIcon    = actEl.querySelector('[data-role="activity-icon"]');
  var actText    = actEl.querySelector('[data-role="activity-text"]');
  var motdRow    = mount.querySelector('#hs-motd-row');
  var motdText   = mount.querySelector('#hs-motd-text');

  /* ── CLOCK ── */
  var STATUS_MAP = {
    live:    { icon: '●',  label: 'LIVE NOW' },
    online:  { icon: '●',  label: 'ONLINE' },
    idle:    { icon: '🌙', label: 'IDLE' },
    dnd:     { icon: '⛔', label: 'BUSY' },
    offline: { icon: '○',  label: 'OFFLINE' }
  };

  var chicagoFormatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', minute: '2-digit',
    hour12: true, timeZone: 'America/Chicago', timeZoneName: 'short'
  });

  function renderClock() {
    var parts = chicagoFormatter.formatToParts(new Date());
    var h = '', m = '', tz = '', ampm = '';
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.type === 'hour') h = p.value;
      else if (p.type === 'minute') m = p.value;
      else if (p.type === 'timeZoneName') tz = p.value;
      else if (p.type === 'dayPeriod') ampm = p.value;
    }
    clockEl.innerHTML = 'MY TIME: ' + h + '<span class="hs-blink">:</span>' + m + ' ' + ampm + ' ' + tz;
  }
  renderClock();
  setInterval(renderClock, 1000);

  /* ── STATUS + ACTIVITY ── */
  function applyStatus(raw) {
    var key = STATUS_MAP[raw] ? raw : 'offline';
    var info = STATUS_MAP[key];
    statusEl.dataset.status = key;
    statusIcon.textContent = info.icon;
    statusText.textContent = info.label;
  }

  var APP_MAP = [
    { match: ['plex'],                                    icon: '🍿', color: '#e5a00d' },
    { match: ['blender'],                                 icon: '🎨', color: '#EA7600' },
    { match: ['davinci', 'resolve'],                      icon: '🎬' },
    { match: ['figma'],                                   icon: '✏️' },
    { match: ['vs code', 'vscode', 'visual studio code'], icon: '💻' },
    { match: ['visual studio'],                           icon: '💻' },
    { match: ['discord'],                                 icon: '💬' },
    { match: ['resonite'],                               icon: '🔮', rainbow: true }
  ];

  function appStyle(name) {
    var lower = name.toLowerCase();
    for (var i = 0; i < APP_MAP.length; i++) {
      var entry = APP_MAP[i];
      for (var j = 0; j < entry.match.length; j++) {
        if (lower.indexOf(entry.match[j]) !== -1) {
          return { icon: entry.icon, color: entry.color || null, rainbow: entry.rainbow || false };
        }
      }
    }
    return { icon: '🎮', color: null };
  }

  function findStream(activities) {
    if (!activities) return null;
    for (var i = 0; i < activities.length; i++) {
      if (activities[i].type === 1) return activities[i];
    }
    return null;
  }

  function showActivity(name, style) {
    actText.textContent = name;
    actIcon.textContent = style.icon;
    if (style.rainbow) {
      actEl.style.color = '';
      actEl.style.borderColor = 'transparent';
      actEl.style.background = 'linear-gradient(#2B2B2B,#2B2B2B) padding-box,linear-gradient(135deg,#f00,#f80,#ff0,#0c0,#08f,#80f) border-box';
      actEl.classList.add('rainbow');
    } else {
      actEl.classList.remove('rainbow');
      actEl.style.color = style.color || '';
      actEl.style.borderColor = style.color || '';
      actEl.style.background = '';
    }
    actEl.classList.remove('hs-hidden');
  }
  function hideActivity() {
    actEl.classList.add('hs-hidden');
    actEl.classList.remove('rainbow');
    actEl.style.color = '';
    actEl.style.borderColor = '';
    actEl.style.background = '';
  }

  function applyActivity(activities) {
    for (var i = 0; i < activities.length; i++) {
      var a = activities[i];
      if (a.type === 0 || a.type === 3) {
        showActivity(a.name, appStyle(a.name));
        return;
      }
    }
    hideActivity();
  }

  function fetchLanyard(id) {
    return fetch('https://api.lanyard.rest/v1/users/' + id)
      .then(function (r) { return r.json(); })
      .then(function (j) { return j.data; });
  }

  function refresh() {
    Promise.all([fetchLanyard(WORK_ID), fetchLanyard(MAIN_ID)]).then(function (results) {
      var workData = results[0];
      var mainData = results[1];
      var stream   = findStream(mainData.activities);

      if (stream) {
        applyStatus('live');
        applyActivity(mainData.activities || []);
        return;
      }
      if (workData.discord_status === 'online') {
        applyStatus('dnd');
        showActivity('At Work', { icon: '💼', color: null });
        return;
      }
      applyStatus(mainData.discord_status);
      if (mainData.discord_status === 'idle') {
        hideActivity();
      } else {
        applyActivity(mainData.activities || []);
      }
    }).catch(function () {
      applyStatus('offline');
      hideActivity();
    });
  }
  refresh();
  setInterval(refresh, 60000);

  /* ── MOTD ── */
  function wrapEmoji(str) {
    var div = document.createElement('div');
    div.textContent = str;
    var escaped = div.innerHTML;
    return escaped.replace(/(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)/gu,
      '<span class="hs-emoji">$1</span>');
  }

  fetch(MOTD_URL, { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.text() : ''; })
    .then(function (text) {
      if (!text) return;
      var lines = text.split('\n').map(function (l) { return l.trim(); })
        .filter(function (l) { return l && l.charAt(0) !== '#'; });
      if (!lines.length) return;
      motdText.innerHTML = wrapEmoji(lines[Math.floor(Math.random() * lines.length)]);
      motdRow.classList.remove('hs-hidden');
    })
    .catch(function () { /* leave hidden on failure */ });
})();
