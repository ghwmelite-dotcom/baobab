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

  // Helper: install a MutationObserver as soon as the document has a root
  // element. Tauri's initialization_script runs so early that
  // document.documentElement is null at script-start time; observing it
  // directly throws "parameter 1 is not of type 'Node'". Polling via
  // setTimeout(0) keeps cost trivial and avoids the race.
  function installMutationObserver(callback, options) {
    function attach() {
      const target = document.documentElement || document.body;
      if (!target) { setTimeout(attach, 1); return; }
      new MutationObserver(callback).observe(target, options);
    }
    attach();
  }

  // Hook fetch.
  // Bind to `window` explicitly: native `fetch` rejects with "Illegal
  // invocation" unless its receiver is the Window. Forwarding the caller's
  // `this` breaks any client code that does `this.fetchFn(...)` (e.g. our
  // BaobabClient holds `fetch` as an instance method).
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (isBlocked(url)) return Promise.reject(new TypeError('Blocked by Baobab ad-blocker'));
    return origFetch.call(window, input, init);
  };

  // Hook XHR — silent no-op on send() for blocked URLs. Avoids the CORS
  // noise that came from redirecting to about:blank. Callers waiting on
  // load/error get a synthetic error event so they don't hang.
  const XhrOpen = XMLHttpRequest.prototype.open;
  const XhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__bbBlocked = isBlocked(url);
    return XhrOpen.apply(this, [method, url, ...rest]);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    if (this.__bbBlocked) {
      const self = this;
      setTimeout(function () {
        try {
          const ev = new Event('error');
          self.dispatchEvent(ev);
          if (typeof self.onerror === 'function') self.onerror(ev);
        } catch (_) { /* ignore */ }
      }, 0);
      return;
    }
    return XhrSend.apply(this, args);
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
  installMutationObserver(function (muts) {
    for (const m of muts) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        const tag = node.tagName;
        if (tag !== 'SCRIPT' && tag !== 'IFRAME' && tag !== 'IMG') continue;
        const src = node.getAttribute('src');
        if (src && isBlocked(src)) node.remove();
      }
    }
  }, { childList: true, subtree: true });

  // Expose the helper so YouTube scriptlets can reuse it. (Reassigning to
  // window so the YT block below — which lives in the same IIFE scope —
  // doesn't need its own copy.)
  window.__bbInstallMutationObserver = installMutationObserver;

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
