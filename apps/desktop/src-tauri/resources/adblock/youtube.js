// === Baobab YouTube ad scriptlets ===
// Run only on YouTube hostnames. The Rust template inlines this block
// inside the matching `if` in engine.js. We reuse the
// `window.__bbInstallMutationObserver` helper exposed by engine.js
// because document.documentElement is `null` at the moment
// initialization_script runs.

// 1. Fast-forward through ads at the <video> element level.
(function () {
  function skipAdIfShowing() {
    const player =
      document.querySelector('.html5-video-player') ||
      document.querySelector('#movie_player');
    if (!player) return;
    const cls = player.classList;
    const isAd = cls.contains('ad-showing') || cls.contains('ad-interrupting');
    if (!isAd) return;

    const video = player.querySelector('video');
    if (!video) return;

    try {
      video.muted = true;
      video.playbackRate = 16;
      // Shove currentTime to a huge value. WebView2 clamps to the actual
      // ad duration, which ends the ad immediately. Avoids depending on
      // video.duration being finite (it can be NaN during MSE setup).
      video.currentTime = 9999;
    } catch (_) {
      /* swallow */
    }
  }

  window.__bbInstallMutationObserver(skipAdIfShowing, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });
  // Safety-net poll in case the observer misses an attribute mutation.
  setInterval(skipAdIfShowing, 500);
})();

// 2. Auto-click any visible skip button.
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

  window.__bbInstallMutationObserver(clickSkips, {
    childList: true,
    subtree: true,
  });
  setInterval(clickSkips, 500);
})();

// 3. Hide ad UI containers via CSS.
(function () {
  function injectStyle() {
    if (!document.head && !document.documentElement) {
      setTimeout(injectStyle, 10);
      return;
    }
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
  }
  injectStyle();
})();

// 4. Best-effort player config rewrite (cheap defensive layer).
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
