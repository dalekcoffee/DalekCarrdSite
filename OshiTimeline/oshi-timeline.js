(function () {
  'use strict';

  /* ───────────────────────────── Config ──────────────────────────── */
  var USERNAME  = 'dalekcoffee';
  var BASE      = 'https://oshi.social';
  var CSS_URL   = 'https://dalekcoffee.github.io/DalekCarrdSite/OshiTimeline/oshi-timeline.css';
  var PAGE_SIZE = 10;
  var FRESH_MS  = 6 * 3600 * 1000;          // "new post" window: 6 hours
  var SEEN_KEY  = 'ofsSeen:' + USERNAME;    // localStorage: newest post ts this visitor has seen

  /* ──────────────────────── Mount + stylesheet ───────────────────── */
  var mount = document.getElementById('ofs-root') || document.body;

  if (!document.querySelector('link[href*="oshi-timeline.css"]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    document.head.appendChild(link);
  }

  mount.insertAdjacentHTML('beforeend',
    '<div id="ofs"><div id="_c">' +
      '<div class="_hd" id="_hdr"></div>' +
      '<div class="_fb">' +
        '<div class="_lb"><span class="_ld"></span>Fediverse &middot; Oshi.Social</div>' +
        '<div class="_ti"><div id="_tl"><div class="_os">···</div></div></div>' +
        '<div class="_lw"><button class="_lm" id="_lb2" style="display:none">Load more</button></div>' +
      '</div>' +
    '</div></div>');

  var timeline    = document.getElementById('_tl');
  var loadMoreBtn = document.getElementById('_lb2');

  /* ───────────────────────────── State ───────────────────────────── */
  var userId     = null;      // resolved from users/show
  var untilId    = null;      // pagination cursor
  var emojiCache = {};        // normalized shortcode -> image url
  var prevSeenTs = Infinity;  // newest post ts from the visitor's previous visit;
                              // Infinity until captureFreshness runs (⇒ no "New" badges,
                              // the correct first-visit / storage-unreadable behavior)

  /* ────────────────────────────── API ────────────────────────────── */
  function api(endpoint, body) {
    return fetch(BASE + '/api/' + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json(); });
  }

  /* ────────────────────────── Emoji helpers ──────────────────────── */
  // Misskey custom-emoji names may carry a remote "@domain" suffix; key on the
  // bare lowercase shortcode so local and federated copies collapse to one entry.
  function normalizeEmojiName(name) {
    return name.replace(/@[^@]*$/, '').toLowerCase();
  }

  // Accepts either an array of {name,url} (note/instance packs) or a plain
  // {name: url} map (reactionEmojis), folding both into emojiCache.
  function cacheEmojis(emojis) {
    if (!emojis) return;
    if (Array.isArray(emojis)) {
      emojis.forEach(function (e) {
        if (e && e.name && e.url) emojiCache[normalizeEmojiName(e.name)] = e.url;
      });
    } else {
      for (var key in emojis) emojiCache[normalizeEmojiName(key)] = emojis[key];
    }
  }

  // Replace :shortcode: tokens with <img>; size (em) is caller-controlled.
  function renderEmojis(str, size) {
    return str.replace(/:([a-zA-Z0-9_.@-]+):/g, function (match, name) {
      var url = emojiCache[normalizeEmojiName(name)];
      return url
        ? '<img style="height:' + size + ';vertical-align:middle;margin:0 1px;" src="' + escapeHtml(url) + '">'
        : match;
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ───────────────────────── Text rendering ──────────────────────── */
  // MFM function-tag allow-lists — fixed sets so no user string reaches a CSS
  // class or font-family unsanitised.
  var MFM_FONTS = { serif: 'serif', monospace: 'monospace', cursive: 'cursive', fantasy: 'fantasy' };
  var MFM_ANIM  = { spin: 1, jelly: 1, shake: 1, tada: 1, bounce: 1, jump: 1, rainbow: 1 };

  // Resolve one layer of $[name(.params) content] function tags. The inner group
  // forbids brackets, so the caller runs this a few times to unwind nesting from
  // the inside out. Unknown tags degrade to their bare content.
  function applyMfmFns(s) {
    // params is a flat run (not a nested quantifier) to avoid catastrophic
    // backtracking; each handler still parses it with its own .match/.indexOf.
    return s.replace(/\$\[([a-z0-9]+)([^\s\]]*)\s([^\[\]]*)\]/gi, function (m, name, params, inner) {
      name = name.toLowerCase();

      var scale = name.match(/^x([2-4])$/);
      if (scale) return '<span style="font-size:' + scale[1] + 'em">' + inner + '</span>';

      if (name === 'fg' || name === 'bg') {
        var c = (params.match(/\.color=([0-9a-f]{3,6})\b/i) || [])[1];
        if (!c) return inner;
        return '<span style="' + (name === 'fg' ? 'color' : 'background-color') + ':#' + c + '">' + inner + '</span>';
      }
      if (name === 'font') {
        var f = MFM_FONTS[params.replace(/^\./, '').toLowerCase()];
        return f ? '<span style="font-family:' + f + '">' + inner + '</span>' : inner;
      }
      if (name === 'flip') {
        var hasV = params.indexOf('v') !== -1, hasH = params.indexOf('h') !== -1 || !hasV;
        return '<span class="_fx" style="transform:scale(' + (hasH ? -1 : 1) + ',' + (hasV ? -1 : 1) + ')">' + inner + '</span>';
      }
      if (name === 'rotate') {
        var deg = (params.match(/\.deg=(-?\d{1,3})/) || [])[1] || '90';
        return '<span class="_fx" style="transform:rotate(' + deg + 'deg)">' + inner + '</span>';
      }
      if (MFM_ANIM[name]) return '<span class="_fx _fx-' + name + '">' + inner + '</span>';

      return inner;
    });
  }

  // Full MFM-ish renderer. Passes run in this exact order so each sees the
  // previous one's output. Code/links/mentions are stashed in placeholders
  // (\x00-\x03) up front so escaping and inline formatting can't mangle them.
  function renderText(text, emojis) {
    if (!text) return '';
    cacheEmojis(emojis);

    // Hide a trailing hashtag block that sits on its own line(s) at the end of
    // the post; hashtags used inline within the body are left untouched.
    text = text.replace(/\n\s*#[^\s#]+(?:\s+#[^\s#]+)*\s*$/, '');
    if (!text) return '';

    var codeBlocks = [], inlineCodes = [], links = [], mentions = [];

    // Fenced code first (so its ``` aren't seen as inline code), then inline code.
    var out = text.replace(/```(?:[a-zA-Z0-9]*\n)?([\s\S]*?)```/g, function (m, code) {
      return '\x02' + (codeBlocks.push(code) - 1) + '\x02';
    });
    out = out.replace(/`([^`\n]+)`/g, function (m, code) {
      return '\x03' + (inlineCodes.push(code) - 1) + '\x03';
    });

    // [label](url) markdown links.
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, function (m, label, url) {
      return '\x00' + (links.push([label, url]) - 1) + '\x00';
    });

    // @user(@host) mentions. The leading delimiter (start / non-word / not "/")
    // keeps us off emails (foo@bar) and in-URL handles (.../@user).
    out = out.replace(/(^|[^A-Za-z0-9_/])@([A-Za-z0-9_]+)(?:@([A-Za-z0-9.-]+[A-Za-z0-9]))?/g,
      function (m, pre, user, host) {
        return pre + '\x01' + (mentions.push([user, host || null]) - 1) + '\x01';
      });

    out = escapeHtml(out);

    // Block-level: fold consecutive "> " lines into one <blockquote> before the
    // newline→<br> conversion (escaping turned "> " into "&gt; ").
    var lines = out.split('\n'), folded = [], i = 0;
    while (i < lines.length) {
      if (/^&gt; ?/.test(lines[i])) {
        var quote = [];
        while (i < lines.length && /^&gt; ?/.test(lines[i])) { quote.push(lines[i].replace(/^&gt; ?/, '')); i++; }
        folded.push('<blockquote>' + quote.join('<br>') + '</blockquote>');
      } else { folded.push(lines[i++]); }
    }
    out = folded.join('\n').replace(/\n/g, '<br>');

    // Inline formatting — bold before italic so ** isn't eaten by *.
    out = out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/__([^_]+)__/g, '<b>$1</b>');
    out = out.replace(/~~([^~]+)~~/g, '<s>$1</s>');
    out = out.replace(/\*([^*\n]+)\*/g, '<i>$1</i>')
             .replace(/(^|\W)_([^_\n]+)_(?=\W|$)/g, '$1<i>$2</i>');

    // MFM function tags ($[…]); loop unwinds nesting from the inside out.
    // 6 passes handles up to 6 levels deep, covering all real-world MFM posts.
    for (var pass = 0; pass < 6; pass++) out = applyMfmFns(out);

    // Re-enable a small allow-list of inline tags that were escaped above.
    // Backreference \1 prevents &lt;center&gt; being closed by the first &lt;/small&gt;.
    // Loop until stable so nested pairs (e.g. <small><small>) fully resolve.
    var _tagRe = /&lt;(small|center|i|b|s)&gt;(.*?)&lt;\/\1&gt;/g;
    var _restoreTag = function (m, tag, inner) { return '<' + tag + '>' + inner + '</' + tag + '>'; };
    var _prev;
    do { _prev = out; out = out.replace(_tagRe, _restoreTag); } while (out !== _prev);

    out = out.replace(/(https?:\/\/[^\s<"]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    out = renderEmojis(out, '1.3em');

    // Reinsert placeholders: mentions, links, then code (escaped raw).
    out = out.replace(/\x01(\d+)\x01/g, function (m, n) {
      var mu = mentions[+n], handle = '@' + mu[0] + (mu[1] ? '@' + mu[1] : '');
      return '<a href="' + BASE + '/' + handle + '" target="_blank" rel="noopener noreferrer">' + handle + '</a>';
    });
    out = out.replace(/\x00(\d+)\x00/g, function (m, n) {
      var link = links[+n];
      return '<a href="' + escapeHtml(link[1]) + '" target="_blank" rel="noopener noreferrer">' + renderEmojis(escapeHtml(link[0]), '1.3em') + '</a>';
    });
    out = out.replace(/\x03(\d+)\x03/g, function (m, n) { return '<code>' + escapeHtml(inlineCodes[+n]) + '</code>'; });
    return out.replace(/\x02(\d+)\x02/g, function (m, n) { return '<pre><code>' + escapeHtml(codeBlocks[+n]) + '</code></pre>'; });
  }

  // Escape + emoji only — for display names, handles, CW labels.
  function renderInline(text, emojis) {
    if (!text) return '';
    cacheEmojis(emojis);
    return renderEmojis(escapeHtml(text), '1.1em');
  }

  function timeAgo(date) {
    if (!date) return '';
    var s = Math.floor((Date.now() - new Date(date)) / 1000);
    if (s < 60)    return s + 's';
    if (s < 3600)  return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    return Math.floor(s / 86400) + 'd';
  }

  /* ───────────────────────────  Reactions ────────────────────────── */
  var HEART_KEYS = ['heart', '❤', '❤️'];

  function renderReactions(reactions) {
    if (!reactions) return '';
    var html = '';
    for (var key in reactions) {
      var count = reactions[key];
      if (count <= 0) continue;

      var name  = key.replace(/^:|:$/g, '');
      var label = normalizeEmojiName(name);
      var url   = emojiCache[label];
      var icon;

      if (url) {
        icon = '<img style="height:1.875em;vertical-align:middle" src="' + escapeHtml(url) + '">';
      } else if (HEART_KEYS.indexOf(label) !== -1 || label.indexOf('heart') !== -1) {
        icon = '<span style="color:#e0334c">❤</span>';
      } else {
        icon = '<span>' + escapeHtml(label) + '</span>';
      }

      html += '<span class="_rc">' + icon + ' ' + (parseInt(count, 10) || 0) + '</span>';
    }
    return html ? '<div class="_rs">' + html + '</div>' : '';
  }

  // One media element with optional alt-text badge/caption and a sensitive blur
  // overlay (both toggled via the delegated click handler below).
  function mediaTile(f) {
    var media;
    if (f.type.indexOf('image') !== -1) {
      media = '<img src="' + escapeHtml(f.url) + '" loading="lazy" draggable="false"' +
        (f.comment ? ' alt="' + escapeHtml(f.comment) + '"' : '') + '>';
    } else {
      media = '<video src="' + escapeHtml(f.url) + '" controls draggable="false"></video>';
    }
    if (f.isSensitive) {
      media = '<div class="_sens">' + media + '</div>' +
        '<div class="_sx">Sensitive — tap to reveal</div>';
    }
    if (f.comment) {
      media += '<button class="_alt" type="button">ALT</button>' +
        '<div class="_altcap">' + escapeHtml(f.comment) + '</div>';
    }
    return media;
  }

  // Image/video attachments as a tile (single) or carousel (multiple); shared by
  // notes and quotes. Non-media files (audio, etc.) are skipped.
  function buildMedia(note) {
    if (!note.files || !note.files.length) return '';

    var tiles = [];
    note.files.forEach(function (f) {
      if (f.type && (f.type.indexOf('image') !== -1 || f.type.indexOf('video') !== -1)) {
        tiles.push(mediaTile(f));
      }
    });
    if (!tiles.length) return '';

    // Single attachment: plain full-width tile.
    if (tiles.length === 1) return '<div class="_md">' + tiles[0] + '</div>';

    // Multiple: peek carousel — the active slide is centred while its neighbours
    // peek at the edges; clicking a neighbour (delegated below) brings it in.
    var slides = tiles.map(function (t) { return '<div class="_ms">' + t + '</div>'; }).join('');
    return '<div class="_md _mc"><div class="_mt" data-i="0" style="transform:translateX(8%)">' +
      slides + '</div></div>';
  }

  /* ─────────────────────────── Note markup ───────────────────────── */
  // Returns the HTML for one timeline entry, or '' if it should be skipped.
  function buildNote(n) {
    // A pure boost (renote with no text of its own) renders as the boosted note
    // plus a "Boosted by" banner; a renote *with* text is treated as a quote.
    var isBoost = !!n.renote && !(n.text || '').trim();
    var note    = isBoost ? n.renote : n;
    var quoted  = (!isBoost && n.renote) || null;

    if (isBoost) {
      cacheEmojis(n.emojis);
      cacheEmojis(n.user.emojis);
    }
    cacheEmojis(note.emojis);
    cacheEmojis(note.reactionEmojis);
    cacheEmojis(note.user.emojis);
    if (quoted) {
      cacheEmojis(quoted.emojis);
      cacheEmojis(quoted.user.emojis);
    }

    // Skip plain replies (text opens with a mention) — they read as
    // out-of-context fragments — but never drop a quote post.
    if (!isBoost && !quoted && n.text && n.text.trim()[0] === '@') return '';

    var cwText  = note.cw || (isBoost && n.cw) || null;
    var cwBlock = '';
    if (cwText) {
      // Tally what sits behind the warning so the button reads like Misskey's
      // native "Show content (N characters, M files)".
      var hiddenChars = (note.text || '').length;
      var hiddenFiles = (note.files || []).length;
      var parts = [];
      if (hiddenChars) parts.push(hiddenChars + ' character' + (hiddenChars === 1 ? '' : 's'));
      if (hiddenFiles) parts.push(hiddenFiles + ' file' + (hiddenFiles === 1 ? '' : 's'));
      var cwMeta = parts.length ? '(' + parts.join(', ') + ')' : '';

      cwBlock =
        '<div class="_cwt">' + renderInline(cwText, note.emojis) + '</div>' +
        '<button class="_cwb" type="button" data-meta="' + cwMeta + '">Show content' +
          (cwMeta ? '<span class="_cwn"> ' + cwMeta + '</span>' : '') +
        '</button>';
    }

    var quote = quoted
      ? '<div class="_qt">' +
          '<a href="' + BASE + '/notes/' + escapeHtml(quoted.id) + '" target="_blank" rel="noopener noreferrer" class="_qh">' +
            renderInline(quoted.user.name || quoted.user.username, quoted.user.emojis) +
            ' @' + escapeHtml(quoted.user.username) +
          '</a>' +
          '<div class="_nx">' + renderText(quoted.text || '', quoted.emojis) + '</div>' +
          buildMedia(quoted) +
        '</div>'
      : '';

    var bodyText = renderText(note.text || '', note.emojis);
    var bodyHtml = bodyText.indexOf('$[') !== -1
      ? '<div class="_nx">' +
          '<span class="_mfm-msg">Preview unavailable</span>' +
          '<a href="' + BASE + '/notes/' + escapeHtml(note.id) + '" target="_blank" rel="noopener noreferrer" class="_cwb">View on Oshi.Social ↗</a>' +
        '</div>'
      : '<div class="_nx">' + bodyText + '</div>';

    var content = bodyHtml + quote + buildMedia(note) + renderReactions(note.reactions);

    // Collapse the body inside ._cwx when a CW is present (toggle reveals it).
    var body = cwText ? '<div class="_cwx">' + content + '</div>' : content;

    var boostBanner = isBoost
      ? '<div class="_bb">↻ Boosted by ' +
          renderInline(n.user.name || n.user.username, n.user.emojis) + '</div>'
      : '';

    // "New" pill: an original post (not a pure boost) made since the visitor's last
    // visit (prevSeenTs) and still under FRESH_MS. See captureFreshness.
    var noteTs = note.createdAt ? new Date(note.createdAt).getTime() : 0;
    var isNew  = !isBoost && noteTs > prevSeenTs && (Date.now() - noteTs) < FRESH_MS;

    var author = note.user;
    return '<div class="_no">' + boostBanner +
      '<div class="_nr"><img src="' + escapeHtml(author.avatarUrl) + '" class="_na" loading="lazy">' +
      '<div class="_nb">' +
        '<div class="_nt">' +
          '<span class="_nn">' + renderInline(author.name || author.username, author.emojis) + '</span>' +
          '<span class="_nh">@' + escapeHtml(author.username) + '</span>' +
          (isNew ? '<span class="_nnew">New</span>' : '') +
          '<span class="_ts">' + timeAgo(note.createdAt) + '</span>' +
        '</div>' +
        cwBlock + body +
        '<div class="_ft">' +
          '<div class="_st">' +
            '<span>↩ ' + (note.repliesCount || 0) + '</span>' +
            '<span>↺ ' + (note.renoteCount || 0) + '</span>' +
          '</div>' +
          '<a href="' + BASE + '/notes/' + escapeHtml(note.id) + '" target="_blank" rel="noopener noreferrer" class="_op">View ↗</a>' +
        '</div>' +
      '</div></div></div>';
  }

  /* ────────────────────────── New-post baseline ──────────────────── */
  // Capture the "last visit" baseline into prevSeenTs, then advance the stored
  // baseline to the newest post now on screen. buildNote badges any post that is
  // newer than prevSeenTs (and under FRESH_MS) — so a returning visitor only sees
  // posts made since they last loaded the page, and those badges self-dismiss next
  // visit. Must run on the reset page BEFORE notes are rendered.
  //
  // Ordering matters: read the *previous* value first, hold it in prevSeenTs, and
  // only then overwrite storage. A first-time visitor (no stored value) or blocked
  // storage leaves prevSeenTs = Infinity ⇒ nothing is "newer" ⇒ no badges, which is
  // the intended behavior (everything is technically new to them). Baselines use
  // post timestamps, not Date.now(), to avoid client/server clock skew.
  function captureFreshness(notes) {
    // Newest note that isn't a pure boost (same test as buildNote's isBoost).
    var newest = null;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (n.renote && !(n.text || '').trim()) continue; // pure boost — skip
      newest = n;
      break;
    }
    if (!newest || !newest.createdAt) return; // nothing postable to baseline

    var storedTs = null;
    try {
      var raw = localStorage.getItem(SEEN_KEY);
      if (raw !== null) storedTs = parseInt(raw, 10) || 0;
    } catch (e) {}

    // Only a real prior visit lowers prevSeenTs from Infinity into badge-able range.
    if (storedTs !== null) prevSeenTs = storedTs;

    // Advance the stored baseline to the newest post seen this visit.
    var newestTs = new Date(newest.createdAt).getTime();
    try { localStorage.setItem(SEEN_KEY, String(Math.max(storedTs || 0, newestTs))); } catch (e) {}
  }

  /* ─────────────────────────── Timeline load ─────────────────────── */
  function load(reset) {
    var params = { userId: userId, limit: PAGE_SIZE, withReplies: false };
    if (untilId) params.untilId = untilId;

    return api('users/notes', params).then(function (notes) {
      if (reset) timeline.innerHTML = '';
      if (!notes || !notes.length) return;

      if (reset) captureFreshness(notes);

      var html = '';
      notes.forEach(function (n) { html += buildNote(n); });
      timeline.insertAdjacentHTML('beforeend', html);

      // Cursor is the raw last note (incl. any we skipped) so paging advances.
      untilId = notes[notes.length - 1].id;
      loadMoreBtn.style.display = 'block';
    });
  }

  /* ──────────────────────────── Interaction ──────────────────────── */
  // Snap a carousel track to a slide index (clamped, no wrap).
  function carouselGo(track, idx) {
    var max = track.children.length - 1;
    idx = idx < 0 ? 0 : (idx > max ? max : idx);
    track.setAttribute('data-i', idx);
    track.style.transition = '';
    track.style.transform = 'translateX(' + (8 - 84 * idx) + '%)';
  }

  var drag = null;           // active pointer-drag state
  var suppressClick = false; // skip the click synthesized after a drag

  // Delegated click / tap — covers notes added by pagination.
  timeline.addEventListener('click', function (e) {
    // CW reveal: toggle the matching ._cwx body; the char/file meta only shows
    // in the collapsed "Show content" state.
    var cwBtn = e.target.closest('._cwb');
    if (cwBtn) {
      var body = cwBtn.closest('._nb').querySelector('._cwx');
      if (body) {
        var shown = body.classList.toggle('_cwv');
        var meta = cwBtn.getAttribute('data-meta') || '';
        cwBtn.innerHTML = shown
          ? 'Hide content'
          : 'Show content' + (meta ? '<span class="_cwn"> ' + meta + '</span>' : '');
      }
      return;
    }

    // Sensitive media: tapping the overlay un-blurs that one tile.
    var sx = e.target.closest('._sx');
    if (sx) {
      var sens = sx.previousElementSibling;
      if (sens) sens.classList.add('_seen');
      sx.style.display = 'none';
      return;
    }

    // Alt-text badge: toggle the caption for that image.
    var altBtn = e.target.closest('._alt');
    if (altBtn) {
      var cap = altBtn.nextElementSibling;
      if (cap) cap.classList.toggle('_altv');
      return;
    }

    // Carousel: tapping a peeking neighbour brings it to centre. Skip the
    // synthetic click that follows a drag so we don't double-step.
    var slide = e.target.closest('._ms');
    if (slide) {
      if (suppressClick) { suppressClick = false; return; }
      var track = slide.parentNode;
      var idx = Array.prototype.indexOf.call(track.children, slide);
      if (idx !== (+track.getAttribute('data-i') || 0)) carouselGo(track, idx);
    }
  });

  // Pointer drag — one path for mouse click-drag, touch swipe and pen.
  timeline.addEventListener('pointerdown', function (e) {
    suppressClick = false;
    if (e.button > 0) return; // ignore non-primary mouse buttons
    var track = e.target.closest('._mt');
    if (!track) { drag = null; return; }
    drag = { track: track, id: e.pointerId, x0: e.clientX, y0: e.clientY,
             w: track.offsetWidth, i: +track.getAttribute('data-i') || 0,
             horiz: null, dx: 0 };
  });

  timeline.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;

    // First real move decides intent: horizontal drags the carousel; vertical
    // is left alone (touch scroll, or a no-op for mouse).
    if (drag.horiz === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      drag.horiz = Math.abs(dx) > Math.abs(dy);
      if (!drag.horiz) { drag = null; return; }
      drag.track.style.transition = 'none';
      try { drag.track.setPointerCapture(e.pointerId); } catch (err) {}
      suppressClick = true;
    }

    e.preventDefault();
    drag.dx = dx;
    var basePx = (8 - 84 * drag.i) / 100 * drag.w;
    drag.track.style.transform = 'translateX(' + (basePx + dx) + 'px)';
  });

  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    var d = drag; drag = null;
    if (!d.horiz) return;
    var step = d.dx <= -d.w * 0.12 ? 1 : (d.dx >= d.w * 0.12 ? -1 : 0);
    carouselGo(d.track, d.i + step);
  }
  timeline.addEventListener('pointerup', endDrag);
  timeline.addEventListener('pointercancel', endDrag);

  loadMoreBtn.onclick = function () { load(false); };

  /* ──────────────────────────── Bootstrap ────────────────────────── */
  // Instance-wide emoji pack (best-effort; per-note packs fill any gaps).
  api('emojis', {}).then(function (r) { cacheEmojis(r.emojis); }).catch(function () {});

  api('users/show', { username: USERNAME }).then(function (user) {
    userId = user.id;
    cacheEmojis(user.emojis);

    var header = document.getElementById('_hdr');
    if (user.bannerUrl && /^https?:\/\//.test(user.bannerUrl))
      header.style.backgroundImage = 'url("' + user.bannerUrl.replace(/["'()\\]/g, '') + '")';
    header.innerHTML =
      '<a href="' + BASE + '/@' + escapeHtml(user.username) + '" target="_blank" rel="noopener noreferrer" class="_bt">View on Oshi.Social ↗</a>' +
      '<div class="_hc"><div class="_hl">' +
        '<img src="' + escapeHtml(user.avatarUrl) + '" class="_av">' +
        '<div class="_on">' + renderInline(user.name || user.username, user.emojis) + '</div>' +
        '<div class="_oh">@' + escapeHtml(user.username) + '@oshi.social</div>' +
      '</div>' +
      '</div>';

    load(true);
  }).catch(function () {
    timeline.innerHTML = '<div class="_os">Error.</div>';
  });
}());
