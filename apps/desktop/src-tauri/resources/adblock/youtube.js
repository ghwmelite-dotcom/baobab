// === Baobab YouTube ad scriptlets ===
// Run only on YouTube hostnames. The Rust template inlines this block
// inside the matching `if` in engine.js.
//
// Strategy (defence in depth, most-reliable-first):
//   1. DOM fast-forward — when the player enters .ad-showing mode,
//      jump the <video> element to its end. This works at the player
//      level regardless of how YouTube serves the ad.
//   2. Auto-click skip buttons (multiple selector variants).
//   3. Hide ad UI containers via CSS (cosmetic).
//   4. Best-effort response-rewrite to strip adPlacements (may or may
//      not catch anything depending on YouTube's current player config
//      delivery, but cheap to try).

// 1. Fast-forward through ads at the <video> element level.
(function () {
  function skipAdIfShowing() {
    // The main video player carries .ad-showing while a pre/mid/post-roll
    // is playing, and .ad-interrupting during a transition.
    const player =
      document.querySelector('.html5-video-player') ||
      document.querySelector('#movie_player');
    if (!player) return;
    const isAd =
      player.classList.contains('ad-showing') ||
      player.classList.contains('ad-interrupting');
    if (!isAd) return;

    const video = player.querySelector('video');
    if (!video || !isFinite(video.duration) || video.duration <= 0) return;

    // Jump to end. YouTube will move on to the next item (the real video)
    // or call the next ad — either way, the current ad is over instantly.
    try {
      video.muted = true;
      video.playbackRate = 16;
      video.currentTime = video.duration;
    } catch (_) {
      /* swallow — best effort */
    }
  }

  const obs = new MutationObserver(skipAdIfShowing);
  obs.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  // Also run on a slow interval as a final safety net. The MutationObserver
  // should catch every relevant change, but some YouTube codepaths set the
  // class before the player element is in the DOM tree we're observing.
  setInterval(skipAdIfShowing, 500);
})();

// 2. Auto-click skip buttons as they appear (covers the "wait 5s then
//    skip" UI YouTube shows before our fast-forward kicks in).
(function () {
  const SKIP_SELECTORS = [
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button-container button',
    'button[id*="skip"]',
    'button[class*="skip"]',
  ].join(',');

  function clickSkips() {
    const buttons = document.querySelectorAll(SKIP_SELECTORS);
    for (const b of buttons) {
      if (b instanceof HTMLElement && b.offsetParent !== null) {
        try { b.click(); } catch (_) { /* ignore */ }
      }
    }
  }

  new MutationObserver(clickSkips).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  setInterval(clickSkips, 500);
})();

// 3. Hide ad UI containers via CSS (cosmetic — keeps the player from
//    flashing an ad overlay even when our fast-forward kicks in instantly).
(function () {
  const style = document.createElement('style');
  style.textContent = [
    'ytd-ad-slot-renderer',
    'ytd-banner-promo-renderer',
    'ytd-statement-banner-renderer',
    'ytd-in-feed-ad-layout-renderer',
    'ytd-promoted-sparkles-text-search-renderer',
    'ytd-promoted-video-renderer',
    'ytd-display-ad-renderer',
    'ytd-action-companion-ad-renderer',
    'ytd-companion-slot-renderer',
    'ytd-rich-item-renderer:has(ytd-ad-slot-renderer)',
    '.ytp-ad-module',
    '.ytp-ad-overlay-container',
    '.ytp-ad-image-overlay',
    '.ytp-ad-text-overlay',
    '#masthead-ad',
    '#player-ads',
  ].join(',') + ' { display: none !important; }';
  (document.head || document.documentElement).appendChild(style);
})();

// 4. Best-effort player config rewrite. Newer YouTube serves player
//    metadata via /youtubei/v1/player and /youtubei/v1/next. If the
//    response is JSON we can read, strip ad markers; if it's protobuf
//    or fails to parse, we silently fall through to the DOM defences.
(function () {
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const res = await origFetch.call(this, input, init);
    if (!/\/youtubei\/v1\/(player|next)/.test(url)) return res;
    try {
      const text = await res.clone().text();
      if (!text.startsWith('{')) return res;
      const obj = JSON.parse(text);
      delete obj.adPlacements;
      delete obj.playerAds;
      delete obj.adSlots;
      delete obj.adBreakHeartbeatParams;
      if (obj.playabilityStatus) delete obj.playabilityStatus.adChoices;
      if (obj.playerConfig) delete obj.playerConfig.adsConfig;
      return new Response(JSON.stringify(obj), {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    } catch (_) {
      return res;
    }
  };
})();
