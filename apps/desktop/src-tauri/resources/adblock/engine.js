(function () {
  // BAOBAB_ADBLOCK is injected as a JSON literal by the Rust builder
  // before this script runs. Shape: { blockedHostnames, youtubeScriptlets, lastUpdated, source }.
  if (typeof BAOBAB_ADBLOCK === 'undefined') return;
  const blocked = new Set(BAOBAB_ADBLOCK.blockedHostnames);

  function hostnameOf(url) {
    try { return new URL(url, location.href).hostname; } catch { return ''; }
  }

  function isBlocked(url) {
    const h = hostnameOf(url);
    if (!h) return false;
    if (blocked.has(h)) return true;
    // Subdomain wildcarding: example.com in the list also blocks api.example.com.
    const parts = h.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      if (blocked.has(parts.slice(i).join('.'))) return true;
    }
    return false;
  }

  // Hook fetch
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (isBlocked(url)) return Promise.reject(new TypeError('Blocked by Baobab ad-blocker'));
    return origFetch.call(this, input, init);
  };

  // Hook XHR
  const XhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (isBlocked(url)) {
      this.__bbBlocked = true;
      return XhrOpen.call(this, method, 'about:blank', ...rest);
    }
    return XhrOpen.call(this, method, url, ...rest);
  };

  // Hook Image src setter
  const ImgSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    set(v) {
      if (isBlocked(v)) return;
      ImgSrc.set.call(this, v);
    },
    get() { return ImgSrc.get.call(this); },
    configurable: true,
  });

  // MutationObserver for late-injected <script>/<iframe>/<img>
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        const tag = node.tagName;
        if (tag !== 'SCRIPT' && tag !== 'IFRAME' && tag !== 'IMG') continue;
        const src = node.getAttribute('src');
        if (src && isBlocked(src)) node.remove();
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // YouTube-specific scriptlets, inlined by Rust when host matches.
  const host = location.hostname;
  if (
    host === 'www.youtube.com' ||
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'youtube-nocookie.com'
  ) {
    /* BAOBAB_YT_SCRIPTLETS_INJECTED_HERE */
  }
})();
