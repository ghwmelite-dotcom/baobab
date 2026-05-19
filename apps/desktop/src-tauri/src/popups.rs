// Popup window support for `window.open()` calls inside tab webviews.
//
// Why this exists:
//   Sites like Gmail's "Add Account" flow call `window.open()` to launch
//   accounts.google.com in a popup. WebView2 silently drops these by default —
//   the click does nothing, the OAuth flow is unreachable. To fix this we
//   inject a JS shim that:
//     1. Overrides `window.open()` to invoke `open_popup` (here)
//     2. Returns a Proxy that proxies postMessage/close/closed/location
//        through Tauri events
//   The popup itself is a real Tauri WebviewWindow with cookie isolation
//   inherited from the opener (so login sessions persist back).
//
// What it covers:
//   ✓ Real popup window appears for window.open() and target=_blank links
//   ✓ Opener can read popup.closed and call popup.close()
//   ✓ Opener can read popup.location.href (proxied via on_navigation hook)
//   ✓ Bidirectional postMessage between opener and popup
//   ✓ Cookies shared with opener (data_directory inheritance)
//
// What it doesn't cover (cross-origin DOM access is intentionally blocked):
//   ✗ Direct opener.document / popup.document access across origins
//   ✗ Synchronous reads of popup.location.href when popup is mid-redirect

use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};

use crate::tabs;

#[derive(Default)]
pub struct PopupRegistry {
    // popup_id -> popup window label
    pub by_id: Mutex<HashMap<String, String>>,
    // popup window label -> opener window label (so on-close events route home)
    pub opener_of: Mutex<HashMap<String, String>>,
    // popup_id -> latest known URL (updated on each navigation)
    pub url_of: Mutex<HashMap<String, String>>,
}

fn popup_label(popup_id: &str) -> String {
    format!("popup-{popup_id}")
}

#[derive(Serialize, Clone)]
struct PopupNavPayload {
    #[serde(rename = "popupId")]
    popup_id: String,
    url: String,
}

#[derive(Serialize, Clone)]
struct PopupClosedPayload {
    #[serde(rename = "popupId")]
    popup_id: String,
}

/// Spawn a new popup window owned by `opener_label`. Cookies inherit from the
/// opener's data directory.
#[tauri::command]
pub async fn open_popup(
    app: AppHandle,
    opener_label: String,
    popup_id: String,
    url: String,
    width: Option<u32>,
    height: Option<u32>,
) -> Result<(), String> {
    let label = popup_label(&popup_id);
    let webview_url = WebviewUrl::External(
        url.parse().map_err(|e: url::ParseError| e.to_string())?,
    );

    // Use sensible bounds — Google's account chooser is happiest at ~500x600.
    let w = width.unwrap_or(500).clamp(360, 1400) as f64;
    let h = height.unwrap_or(640).clamp(400, 1000) as f64;

    let mut builder = WebviewWindowBuilder::new(&app, &label, webview_url)
        .title("Baobab")
        .inner_size(w, h)
        .resizable(true)
        .focused(true);

    // Inherit the opener's data directory so cookies / localStorage / etc.
    // are shared with the originating profile. Without this, signing in to a
    // popup wouldn't carry back to the opener tab.
    if let Some(dir) = tabs::data_dir_for_window(&app, &opener_label) {
        builder = builder.data_directory(dir);
    }

    // Inject the popup-side bridge BEFORE the page loads. This runs once per
    // popup window. The __BAOBAB_POPUP_ID__ / __BAOBAB_OPENER_LABEL__ tokens
    // are substituted so the popup knows how to talk back to its opener.
    let popup_side = include_str!("popup-side.js")
        .replace("__BAOBAB_POPUP_ID__", &json_str(&popup_id))
        .replace("__BAOBAB_OPENER_LABEL__", &json_str(&opener_label));
    builder = builder.initialization_script(&popup_side);

    // Page-load hook lives on the BUILDER (not the built window). Each
    // navigation fires Finished once the DOM is ready; we cache the URL
    // for `popup.location.href` proxying + emit a `popup:navigated` event
    // so OAuth-detect-via-polling flows see the redirect.
    let app_for_nav = app.clone();
    let popup_id_for_nav = popup_id.clone();
    let opener_label_for_nav = opener_label.clone();
    builder = builder.on_page_load(move |webview, payload| {
        use tauri::webview::PageLoadEvent;
        if payload.event() != PageLoadEvent::Finished {
            return;
        }
        let url = payload.url().to_string();
        let registry = app_for_nav.state::<PopupRegistry>();
        if let Ok(mut map) = registry.url_of.lock() {
            map.insert(popup_id_for_nav.clone(), url.clone());
        }
        let _ = webview.emit_to(
            &opener_label_for_nav,
            "popup:navigated",
            PopupNavPayload {
                popup_id: popup_id_for_nav.clone(),
                url,
            },
        );
    });

    // Build the window. Errors here are usually wry / OS resource exhaustion;
    // surface them rather than silently dropping the popup.
    let window = builder.build().map_err(|e| e.to_string())?;

    // Register before any close events fire.
    {
        let registry = app.state::<PopupRegistry>();
        let mut by_id = registry.by_id.lock().map_err(|e| e.to_string())?;
        by_id.insert(popup_id.clone(), label.clone());
        drop(by_id);
        let mut opener_of = registry.opener_of.lock().map_err(|e| e.to_string())?;
        opener_of.insert(label.clone(), opener_label.clone());
        drop(opener_of);
        let mut url_of = registry.url_of.lock().map_err(|e| e.to_string())?;
        url_of.insert(popup_id.clone(), url.clone());
    }

    // When the popup closes (user hits X, calls window.close(), or app
    // shutdown), notify the opener and clean up the registry. Use Destroyed
    // (not CloseRequested) so we only act after the window is actually gone.
    let app_for_close = app.clone();
    let popup_id_for_close = popup_id.clone();
    let opener_label_for_close = opener_label.clone();
    let label_for_close = label.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            let registry = app_for_close.state::<PopupRegistry>();
            if let Ok(mut map) = registry.by_id.lock() {
                map.remove(&popup_id_for_close);
            }
            if let Ok(mut map) = registry.opener_of.lock() {
                map.remove(&label_for_close);
            }
            if let Ok(mut map) = registry.url_of.lock() {
                map.remove(&popup_id_for_close);
            }
            let _ = app_for_close.emit_to(
                &opener_label_for_close,
                "popup:closed",
                PopupClosedPayload {
                    popup_id: popup_id_for_close.clone(),
                },
            );
        }
    });

    Ok(())
}

/// Close a popup window by id. Idempotent — closing an already-closed popup
/// is not an error.
#[tauri::command]
pub async fn close_popup(app: AppHandle, popup_id: String) -> Result<(), String> {
    let label = {
        let registry = app.state::<PopupRegistry>();
        let map = registry.by_id.lock().map_err(|e| e.to_string())?;
        map.get(&popup_id).cloned()
    };
    if let Some(label) = label {
        if let Some(w) = app.get_webview_window(&label) {
            w.close().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Read the latest known URL of a popup. Returns None if the popup is gone
/// (closed, or never existed).
#[tauri::command]
pub async fn popup_location(
    app: AppHandle,
    popup_id: String,
) -> Result<Option<String>, String> {
    let registry = app.state::<PopupRegistry>();
    let map = registry.url_of.lock().map_err(|e| e.to_string())?;
    Ok(map.get(&popup_id).cloned())
}

#[derive(Serialize, Clone)]
struct PopupMessagePayload {
    data: serde_json::Value,
    #[serde(rename = "popupId")]
    popup_id: String,
}

/// Send a postMessage from opener → popup. The popup's bridge dispatches it
/// as a native `window.message` event.
#[tauri::command]
pub async fn popup_post_to_popup(
    app: AppHandle,
    popup_id: String,
    data: serde_json::Value,
) -> Result<(), String> {
    let label = {
        let registry = app.state::<PopupRegistry>();
        let map = registry.by_id.lock().map_err(|e| e.to_string())?;
        map.get(&popup_id).cloned()
    };
    if let Some(label) = label {
        app.emit_to(
            &label,
            "popup:message-from-opener",
            PopupMessagePayload {
                data,
                popup_id,
            },
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Serialize, Clone)]
struct OpenerMessagePayload {
    data: serde_json::Value,
    #[serde(rename = "popupId")]
    popup_id: String,
}

/// Send a postMessage from popup → opener (called from the popup-side bridge
/// when popup code calls `window.opener.postMessage`).
#[tauri::command]
pub async fn popup_post_to_opener(
    app: AppHandle,
    popup_id: String,
    data: serde_json::Value,
) -> Result<(), String> {
    let opener_label = {
        let registry = app.state::<PopupRegistry>();
        let label = popup_label(&popup_id);
        let map = registry.opener_of.lock().map_err(|e| e.to_string())?;
        map.get(&label).cloned()
    };
    if let Some(opener_label) = opener_label {
        app.emit_to(
            &opener_label,
            "popup:message-from-popup",
            OpenerMessagePayload {
                data,
                popup_id,
            },
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// JSON-encode a string for safe inline substitution inside a JS literal.
/// `serde_json::to_string("foo")` → `"\"foo\""` (includes the surrounding
/// quotes), which is exactly what we want — drop the result anywhere a JS
/// string literal would go.
fn json_str(s: &str) -> String {
    serde_json::to_string(s).unwrap_or_else(|_| "\"\"".to_string())
}
