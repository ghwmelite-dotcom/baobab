// Popup-side bridge — runs INSIDE the popup webview.
//
// Two responsibilities:
//   1. Synthesize a `window.opener` that routes postMessage back to the
//      original tab via Tauri events. Cross-window references don't survive
//      separate WebviewWindows, so opener has to be faked.
//   2. Listen for inbound messages from the opener and dispatch them as
//      native `window.message` events so popup code that does
//      `window.addEventListener('message', ...)` works unchanged.
//
// Token substitution: the Rust side replaces __BAOBAB_POPUP_ID__ and
// __BAOBAB_OPENER_LABEL__ with JSON-encoded string literals before injection.

(function () {
  if (window.__BAOBAB_POPUP_INSTALLED__) return;
  window.__BAOBAB_POPUP_INSTALLED__ = true;

  const POPUP_ID = __BAOBAB_POPUP_ID__;
  const OPENER_LABEL = __BAOBAB_OPENER_LABEL__;

  function invoke(cmd, args) {
    // Tauri 2 puts internals at window.__TAURI_INTERNALS__.invoke. Guard
    // against early-load timing where __TAURI_INTERNALS__ isn't ready yet.
    try {
      return window.__TAURI_INTERNALS__.invoke(cmd, args);
    } catch (e) {
      // Init-script runs before Tauri's runtime is fully wired in some
      // builds — re-queue on rAF so the postMessage actually lands.
      requestAnimationFrame(() => {
        try {
          window.__TAURI_INTERNALS__.invoke(cmd, args);
        } catch (_) {
          /* drop — opener will see the popup close anyway */
        }
      });
      return undefined;
    }
  }

  // Synthetic opener. postMessage routes through Tauri back to the opener
  // tab's webview, which re-dispatches as a native `window.message` event.
  // postMessage's second argument (targetOrigin) is informational only here —
  // we always deliver, since both ends are in the same Baobab profile and
  // cross-origin isolation between them is enforced by webview separation
  // rather than by the postMessage origin filter.
  const synthOpener = {
    postMessage(data, _targetOrigin) {
      invoke('popup_post_to_opener', {
        popupId: POPUP_ID,
        // Structured clone of data — passing through Tauri requires JSON.
        // Functions, DOM nodes, etc. are dropped. This matches the real
        // postMessage spec which uses the structured clone algorithm.
        data: cloneable(data),
      });
    },
    closed: false,
  };

  try {
    Object.defineProperty(window, 'opener', {
      value: synthOpener,
      writable: false,
      configurable: true,
    });
  } catch (_) {
    // If `opener` is already defined and non-configurable, skip. The
    // browser may have set a real opener; in that case our synthetic one
    // isn't needed.
  }

  // Inbound: messages sent by the opener via popup_post_to_popup land here.
  // Dispatch as native MessageEvent so window.addEventListener('message')
  // handlers work without modification.
  if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.event) {
    window.__TAURI_INTERNALS__.event.listen('popup:message-from-opener', (event) => {
      try {
        const me = new MessageEvent('message', {
          data: event.payload?.data,
          origin: window.location.origin,
          source: synthOpener,
        });
        window.dispatchEvent(me);
      } catch (_) {
        /* discard malformed events */
      }
    });
  }

  // Cloneable filter: strip values that don't survive structured clone /
  // JSON serialization. Conservative but matches what real postMessage
  // would drop anyway.
  function cloneable(v) {
    try {
      return JSON.parse(JSON.stringify(v));
    } catch (_) {
      return null;
    }
  }
})();
