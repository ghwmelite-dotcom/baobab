(function () {
  // BAOBAB_ADBLOCK is injected as a JSON literal by the Rust builder
  // before this script runs. Shape: { blockedHostnames, youtubeScriptlets, lastUpdated, source }.
  if (typeof BAOBAB_ADBLOCK === 'undefined') return;

  // Approximate byte counters. Tauri picks them up via record_tab_usage.
  // We're a passive observer; numbers underreport (TLS handshake, DNS,
  // chunked-encoding overhead are invisible to JS) but useful for trends.
  const usage = { used: 0, saved: 0 };

  // Conservative per-blocked-resource savings estimate. These are
  // 10th-percentile sizes for common ad/tracker payloads; we'd rather
  // undercount than overpromise.
  const SAVED_BY_KIND = {
    image: 30 * 1024,
    iframe: 150 * 1024,
    script: 60 * 1024,
    other: 25 * 1024,
  };

  function kindForUrl(url) {
    if (/\.(?:png|jpe?g|gif|webp|avif|svg|ico)(?:[?#]|$)/i.test(url)) return 'image';
    if (/\.(?:js|mjs)(?:[?#]|$)/i.test(url)) return 'script';
    return 'other';
  }

  function flushUsage() {
    if (usage.used === 0 && usage.saved === 0) return;
    if (!window.__TAURI_INTERNALS__ || !window.__TAURI_INTERNALS__.invoke) return;
    const u = usage.used, s = usage.saved;
    usage.used = 0; usage.saved = 0;
    window.__TAURI_INTERNALS__.invoke('record_tab_usage', { bytesUsed: u, bytesSaved: s }).catch(() => {});
  }

  setInterval(flushUsage, 1000);
  window.addEventListener('beforeunload', flushUsage);

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
      const sweep = document.querySelectorAll('img:not([loading]), iframe:not([loading])');
      for (const el of sweep) el.setAttribute('loading', 'lazy');
      // Slow-mode CSS: kill animations and font preloads when the host has
      // flagged this page (slow connection OR over budget OR user forced).
      if (BAOBAB_ADBLOCK.slowMode === true) {
        const style = document.createElement('style');
        style.setAttribute('data-baobab', 'slow-mode');
        style.textContent =
          '* { animation-duration: 0.001s !important; transition-duration: 0.001s !important; }' +
          'link[rel="preload"][as="font"] { display: none !important; }' +
          '@font-face { font-display: optional !important; }';
        (document.head || document.documentElement).appendChild(style);
      }
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
    if (isBlocked(url)) {
      usage.saved += SAVED_BY_KIND[kindForUrl(url)] || SAVED_BY_KIND.other;
      return Promise.reject(new TypeError('Blocked by Baobab ad-blocker'));
    }
    return origFetch.call(window, input, init).then(function (resp) {
      // Best-effort: read Content-Length when present, else 0. Cloning to
      // read the stream would double bandwidth, so we accept the under-
      // report for chunked/streaming responses.
      const cl = resp.headers && resp.headers.get && resp.headers.get('Content-Length');
      if (cl) { const n = parseInt(cl, 10); if (!isNaN(n)) usage.used += n; }
      return resp;
    });
  };

  // Hook XHR — silent no-op on send() for blocked URLs. Avoids the CORS
  // noise that came from redirecting to about:blank. Callers waiting on
  // load/error get a synthetic error event so they don't hang.
  const XhrOpen = XMLHttpRequest.prototype.open;
  const XhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__bbBlocked = isBlocked(url);
    this.__bbKind = kindForUrl(url || '');
    return XhrOpen.apply(this, [method, url, ...rest]);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    if (this.__bbBlocked) {
      usage.saved += SAVED_BY_KIND[this.__bbKind] || SAVED_BY_KIND.other;
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
    // Count actually-downloaded bytes via progress events. `e.loaded` is
    // cumulative, so we track the previous reading and add only the delta.
    this.addEventListener('progress', function (e) {
      if (this.__bbLastLoaded === undefined) this.__bbLastLoaded = 0;
      const delta = (e.loaded || 0) - this.__bbLastLoaded;
      if (delta > 0) usage.used += delta;
      this.__bbLastLoaded = e.loaded || 0;
    });
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
        if ((tag === 'IMG' || tag === 'IFRAME') && !node.hasAttribute('loading')) {
          node.setAttribute('loading', 'lazy');
        }
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
