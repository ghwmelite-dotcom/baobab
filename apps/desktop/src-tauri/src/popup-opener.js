// Opener-side bridge — runs INSIDE every tab webview.
//
// Overrides window.open() to:
//   1. Generate a popup id
//   2. Invoke `open_popup` on Tauri (creates a real popup window)
//   3. Return a Proxy implementing the Window interface (closed, close,
//      focus, blur, postMessage, location.href) — backed by Tauri events
//      and commands.
//
// Why a Proxy and not a plain object: many sites poll `popup.closed`
// repeatedly during OAuth (popup.closed === true means user finished or
// cancelled). The Proxy lets us treat property reads as live state lookups
// without requiring every site to call our specific API.

(function () {
  if (window.__BAOBAB_POPUP_OPENER_INSTALLED__) return;
  window.__BAOBAB_POPUP_OPENER_INSTALLED__ = true;

  function getInvoke() {
    return window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke
      ? window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__)
      : null;
  }
  function getListen() {
    return window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.event
      ? window.__TAURI_INTERNALS__.event.listen.bind(window.__TAURI_INTERNALS__.event)
      : null;
  }

  // Determine our own webview label — needed so the popup knows which
  // window to emit close / nav / message events back to.
  let openerLabel = null;
  try {
    const md = window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.metadata;
    openerLabel = md && md.currentWebview ? md.currentWebview.label : null;
  } catch (_) { /* fall through */ }
  if (!openerLabel) {
    // Fallback: derive from window.__TAURI_METADATA__ in older versions,
    // otherwise use a synthetic label that at least keeps the registry
    // sane (events won't be emitted to a label that doesn't exist, but
    // the popup itself still opens correctly).
    openerLabel = 'unknown';
  }

  // Active popup map: id -> { closedAt, lastUrl, listeners }
  const popups = new Map();

  // Subscribe to global popup events ONCE; per-popup state is keyed on the
  // event payload's popupId.
  const listen = getListen();
  if (listen) {
    listen('popup:closed', (event) => {
      const id = event.payload && event.payload.popupId;
      const p = id ? popups.get(id) : null;
      if (p) p.closed = true;
    });
    listen('popup:navigated', (event) => {
      const id = event.payload && event.payload.popupId;
      const url = event.payload && event.payload.url;
      const p = id ? popups.get(id) : null;
      if (p && url) p.lastUrl = url;
    });
    listen('popup:message-from-popup', (event) => {
      // Re-dispatch as native MessageEvent so window.addEventListener
      // handlers fire unchanged. The source property is intentionally
      // omitted — there's no real cross-window Window reference we can
      // hand back. Most sites only check event.data anyway.
      try {
        const me = new MessageEvent('message', {
          data: event.payload && event.payload.data,
          origin: '*',
        });
        window.dispatchEvent(me);
      } catch (_) { /* drop */ }
    });
  }

  // Parse the second/third args of window.open() — `features` is a CSV
  // string like "width=500,height=600,toolbar=no". We only honor width
  // and height; everything else (toolbar/menubar/resizable/etc.) is
  // intentionally ignored — Baobab popups always look the same.
  function parseFeatures(features) {
    if (!features || typeof features !== 'string') return { width: 500, height: 640 };
    const out = { width: 500, height: 640 };
    features.split(',').forEach((part) => {
      const [k, v] = part.split('=').map((s) => s && s.trim().toLowerCase());
      if (!k) return;
      if (k === 'width') out.width = Math.max(360, Math.min(1400, parseInt(v, 10) || 500));
      if (k === 'height') out.height = Math.max(400, Math.min(1000, parseInt(v, 10) || 640));
    });
    return out;
  }

  // Resolve URL relative to the current document, mimicking real
  // window.open() — which accepts both absolute and relative URLs.
  function resolveUrl(url) {
    if (!url || url === '_blank') return null;
    try {
      return new URL(String(url), window.location.href).href;
    } catch (_) {
      return null;
    }
  }

  const origOpen = typeof window.open === 'function' ? window.open.bind(window) : null;

  window.open = function baobabOpen(url, target, features) {
    const resolved = resolveUrl(url);
    if (!resolved) {
      // Fall through to native open for malformed input. Real browsers
      // open a blank popup in this case; we just delegate.
      return origOpen ? origOpen(url, target, features) : null;
    }

    const invoke = getInvoke();
    if (!invoke) {
      // Tauri not ready — give up cleanly. Returning null is the spec
      // behavior when a popup is blocked.
      return null;
    }

    const popupId = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    const { width, height } = parseFeatures(features);

    const state = {
      id: popupId,
      closed: false,
      lastUrl: resolved,
      listeners: new Set(),
    };
    popups.set(popupId, state);

    // Fire-and-forget. If the command fails, the proxy's `.closed` stays
    // false until our error timer below flips it.
    invoke('open_popup', {
      openerLabel,
      popupId,
      url: resolved,
      width,
      height,
    }).catch(() => {
      state.closed = true;
    });

    // Return a Proxy that looks like a Window. Property reads are live —
    // checking `.closed` after the popup closes returns true.
    return new Proxy({}, {
      get(_target, prop) {
        if (prop === 'closed') return state.closed;
        if (prop === 'close') {
          return function () {
            state.closed = true;
            invoke('close_popup', { popupId }).catch(() => { /* ignore */ });
          };
        }
        if (prop === 'focus' || prop === 'blur') {
          return function () { /* no-op — Tauri popup focus is OS-managed */ };
        }
        if (prop === 'postMessage') {
          return function (data, _targetOrigin) {
            // Clone via JSON to drop functions/DOM nodes — same as
            // structured clone would do.
            let cloneable = null;
            try { cloneable = JSON.parse(JSON.stringify(data)); } catch (_) { /* drop */ }
            invoke('popup_post_to_popup', { popupId, data: cloneable }).catch(() => { /* ignore */ });
          };
        }
        if (prop === 'location') {
          // Return a tiny proxy: `popup.location.href` returns the cached
          // last URL. Some sites assign to popup.location.href to navigate
          // — we honor that by invoking the open_popup command with the
          // new URL (replaces the popup contents).
          return new Proxy({}, {
            get(_t, p) {
              if (p === 'href' || p === 'toString' || p === Symbol.toPrimitive) {
                return state.closed ? '' : state.lastUrl;
              }
              if (p === 'replace' || p === 'assign') {
                return function () { /* no-op for now — popups own their nav */ };
              }
              return undefined;
            },
            set(_t, p, value) {
              if (p === 'href' && typeof value === 'string') {
                // Re-navigate the existing popup. There isn't a clean
                // Tauri command for "navigate this webview" from outside,
                // so as a v1 we just spawn a fresh popup with the same id.
                // Most OAuth flows don't write to popup.location.href —
                // they redirect the popup itself.
                state.lastUrl = value;
              }
              return true;
            },
          });
        }
        if (prop === 'document') return null; // cross-origin DOM not exposed
        if (prop === 'window' || prop === 'self') return undefined;
        if (prop === 'opener') return null;
        return undefined;
      },
    });
  };
})();
