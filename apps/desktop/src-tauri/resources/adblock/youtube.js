// === Baobab YouTube ad scriptlets ===
// Run only on YouTube hostnames. The Rust template inlines this block
// inside the matching `if` in engine.js.

// 1. Strip adPlacements from player config responses.
(function () {
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const res = await origFetch.call(this, input, init);
    if (!url.includes('/youtubei/v1/player')) return res;
    const clone = res.clone();
    try {
      const text = await clone.text();
      const obj = JSON.parse(text);
      delete obj.adPlacements;
      delete obj.playerAds;
      delete obj.adSlots;
      if (obj.playabilityStatus) delete obj.playabilityStatus.adChoices;
      return new Response(JSON.stringify(obj), {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    } catch {
      return res;
    }
  };
})();

// 2. Hide ad slot containers via CSS.
(function () {
  const style = document.createElement('style');
  style.textContent =
    'ytd-ad-slot-renderer,' +
    'ytd-banner-promo-renderer,' +
    'ytd-statement-banner-renderer,' +
    'ytd-in-feed-ad-layout-renderer,' +
    'ytd-promoted-sparkles-text-search-renderer,' +
    'ytd-promoted-video-renderer,' +
    'ytd-display-ad-renderer,' +
    '.ytp-ad-module,' +
    '.ytp-ad-overlay-container { display: none !important; }';
  (document.head || document.documentElement).appendChild(style);
})();

// 3. Auto-skip stragglers.
(function () {
  new MutationObserver(() => {
    const skip = document.querySelector(
      '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button'
    );
    if (skip) skip.click();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
