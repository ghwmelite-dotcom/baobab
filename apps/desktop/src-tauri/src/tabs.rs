use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl};

use crate::downloads;
use crate::profiles;
use crate::windows;

// Current chrome layout (post-r9 redesign): tab bar (38) + address bar (48)
// = 86px. The old constant was 132px from the 3-row chrome and was making
// every webview render 46px too low, leaving a black strip above the page.
// Bookmarks bar (28px) is rendered conditionally above main but not added
// here; if/when bookmarks exist we'll need to compute this dynamically.
const CHROME_HEIGHT: f64 = 38.0 + 48.0;
// Status bar was removed in P0c; the webview now extends to the bottom edge.
const STATUS_HEIGHT: f64 = 0.0;

// Cache the latest <title> reported by `on_document_title_changed` for each
// webview label. WebView2 / WKWebView surface the title asynchronously and
// can fire it both before and after `on_page_load(Finished)` — so we keep
// the most recent value and ship it with whichever event lands first.
static TAB_TITLES: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);

fn cache_title(label: &str, title: &str) {
    if let Ok(mut guard) = TAB_TITLES.lock() {
        let map = guard.get_or_insert_with(HashMap::new);
        map.insert(label.to_string(), title.to_string());
    }
}

fn lookup_title(label: &str) -> Option<String> {
    TAB_TITLES
        .lock()
        .ok()
        .and_then(|g| g.as_ref().and_then(|m| m.get(label).cloned()))
        .filter(|s| !s.is_empty())
}

fn forget_title(label: &str) {
    if let Ok(mut guard) = TAB_TITLES.lock() {
        if let Some(map) = guard.as_mut() {
            map.remove(label);
        }
    }
}

#[derive(Debug, Clone, Serialize)]
struct TabLoadedPayload {
    id: String,
    url: String,
    title: Option<String>,
}

fn emit_tab_loaded<R: tauri::Runtime>(
    emitter: &impl Emitter<R>,
    label: &str,
    url: String,
    title: Option<String>,
) {
    let Some(id) = label.strip_prefix("tab-") else {
        return;
    };
    let payload = TabLoadedPayload {
        id: id.to_string(),
        url,
        title,
    };
    let _ = emitter.emit("tab://loaded", payload);
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TabInfo {
    pub id: String,
    pub url: String,
}

fn tab_label(id: &str) -> String {
    format!("tab-{id}")
}

fn data_dir_for_window(app: &AppHandle, window_label: &str) -> Option<std::path::PathBuf> {
    let profile_id = windows::profile_id_from_label(window_label)?;
    if profile_id == "guest" {
        return Some(std::env::temp_dir().join(format!("baobab-guest-{window_label}")));
    }
    let root = app.path().app_data_dir().ok()?;
    let file = profiles::load(&root).ok()?;
    let profile = file.profiles.iter().find(|p| p.id == profile_id)?;
    Some(profiles::resolve_user_data_dir(&root, profile))
}

#[tauri::command]
pub async fn create_tab(
    app: AppHandle,
    window_label: String,
    id: String,
    url: String,
    incognito: Option<bool>,
) -> Result<TabInfo, String> {
    let host = app
        .get_window(&window_label)
        .ok_or_else(|| format!("window {window_label} not found"))?;
    let size = host.inner_size().map_err(|e| e.to_string())?;
    let scale = host.scale_factor().map_err(|e| e.to_string())?;
    let logical_w = size.width as f64 / scale;
    let logical_h = size.height as f64 / scale;

    let label = tab_label(&id);
    let webview_url = WebviewUrl::External(url.parse().map_err(|e: url::ParseError| e.to_string())?);

    let mut builder = tauri::webview::WebviewBuilder::new(&label, webview_url);
    // Webview pre-content background stays at the WebView2 default (white).
    // Painting it dark to mask hide-leak symptoms turned out to bleed into
    // real pages that detect dark mode from the bg colour (e.g. Google's
    // Gmail landing page). The right fix is making the hide reliable.
    // Private browsing: point this webview at an ephemeral per-tab data
    // directory under $TEMP so cookies / localStorage / IndexedDB never
    // bleed back to the persistent profile. The OS reaps $TEMP eventually;
    // for the alpha that's an acceptable cleanup boundary.
    if incognito.unwrap_or(false) {
        let dir = std::env::temp_dir().join(format!("baobab-incognito-{}", id));
        builder = builder.data_directory(dir);
    } else if let Some(dir) = data_dir_for_window(&app, &window_label) {
        builder = builder.data_directory(dir);
    }
    // Adblock: attach initialization script when the calling profile has it enabled.
    // Guest windows are skipped per design (is_enabled_for_profile returns false for "guest").
    let adblock_enabled = match crate::windows::profile_id_from_label(&window_label) {
        Some(pid) => crate::adblock::is_enabled_for_profile(&app, &pid).unwrap_or(true),
        None => false,
    };
    if adblock_enabled {
        let root = app.path().app_data_dir().map_err(|e: tauri::Error| e.to_string())?;
        let payload = crate::adblock::load_payload(&root);
        let script = crate::adblock::build_init_script(&payload);
        builder = builder.initialization_script(&script);
    }
    let builder = downloads::attach(builder, app.clone());
    // Capture the latest <title> reported by the engine so we can ship it
    // with the next `tab://loaded` event. The renderer sets the document
    // title asynchronously, so this hook may fire multiple times per nav.
    let builder = builder.on_document_title_changed(|webview, title| {
        let label = webview.label().to_string();
        if !title.is_empty() {
            cache_title(&label, &title);
        }
        let url = webview.url().map(|u| u.to_string()).unwrap_or_default();
        emit_tab_loaded(
            &webview,
            &label,
            url,
            if title.is_empty() { None } else { Some(title) },
        );
    });
    // Emit `tab://loaded` when the page finishes loading. Title may not be
    // available yet (engines fire `document_title_changed` separately) — in
    // that case we ship whatever the cache currently holds.
    let builder = builder.on_page_load(|webview, payload| {
        use tauri::webview::PageLoadEvent;
        if payload.event() != PageLoadEvent::Finished {
            return;
        }
        let label = webview.label().to_string();
        let url = payload.url().to_string();
        let title = lookup_title(&label);
        emit_tab_loaded(&webview, &label, url, title);
    });
    host.add_child(
        builder,
        LogicalPosition::new(0.0, CHROME_HEIGHT),
        LogicalSize::new(logical_w, (logical_h - CHROME_HEIGHT - STATUS_HEIGHT).max(0.0)),
    )
    .map_err(|e| e.to_string())?;

    // Webviews are added visible by default. Hide immediately so the React
    // side controls visibility — otherwise newly-created about:blank tabs
    // flash their default white page on top of the NewTabPage, and tabs
    // hydrated from persistence at launch leak through every overlay
    // until the show/hide effect catches up.
    if let Some(wv) = app.get_webview(&label) {
        let _ = wv.hide();
    }

    Ok(TabInfo { id, url })
}

#[tauri::command]
pub async fn close_tab(app: AppHandle, id: String) -> Result<(), String> {
    let label = tab_label(&id);
    if let Some(wv) = app.get_webview(&label) {
        wv.close().map_err(|e| e.to_string())?;
    }
    forget_title(&label);
    Ok(())
}

#[tauri::command]
pub async fn show_tab(app: AppHandle, window_label: String, id: String) -> Result<(), String> {
    let host = app
        .get_window(&window_label)
        .ok_or_else(|| format!("window {window_label} not found"))?;
    for wv in host.webviews() {
        if wv.label() == window_label {
            continue;
        }
        let _ = wv.hide();
    }
    let label = tab_label(&id);
    if let Some(wv) = app.get_webview(&label) {
        wv.show().map_err(|e| e.to_string())?;
        wv.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn navigate_tab(app: AppHandle, id: String, url: String) -> Result<(), String> {
    let label = tab_label(&id);
    let parsed = url.parse().map_err(|e: url::ParseError| e.to_string())?;
    if let Some(wv) = app.get_webview(&label) {
        wv.navigate(parsed).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn hide_tab(app: AppHandle, id: String) -> Result<(), String> {
    let label = tab_label(&id);
    if let Some(wv) = app.get_webview(&label) {
        wv.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Hide every non-host child webview. Used when the canvas should show
// the NewTabPage or an overlay, and no webview should be visible —
// hide_tab(activeId) alone leaves any previously-shown tab's webview
// dangling on top of React content.
#[tauri::command]
pub async fn hide_all_tabs(app: AppHandle, window_label: String) -> Result<(), String> {
    let host = app
        .get_window(&window_label)
        .ok_or_else(|| format!("window {window_label} not found"))?;
    for wv in host.webviews() {
        if wv.label() == window_label {
            continue;
        }
        let _ = wv.hide();
    }
    Ok(())
}

// Fire-and-forget: WebView2 silently no-ops if there's no entry to go to.
// The TS side tracks an approximate depth/max counter to drive the UI enablement.
#[tauri::command]
pub async fn tab_go_back(app: AppHandle, tab_id: String) -> Result<(), String> {
    let label = tab_label(&tab_id);
    let wv = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview {label} not found"))?;
    wv.eval("history.back()").map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn tab_go_forward(app: AppHandle, tab_id: String) -> Result<(), String> {
    let label = tab_label(&tab_id);
    let wv = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview {label} not found"))?;
    wv.eval("history.forward()").map_err(|e| e.to_string())?;
    Ok(())
}

// Fire-and-forget reload via webview.eval. WebView2 honours its own
// cache rules, so this behaves like a normal browser refresh — no
// cache-skip semantics (that would be a separate hard-reload command).
#[tauri::command]
pub async fn tab_reload(app: AppHandle, tab_id: String) -> Result<(), String> {
    let label = tab_label(&tab_id);
    let wv = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview {label} not found"))?;
    wv.eval("location.reload()").map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn list_tabs(app: AppHandle, window_label: String) -> Result<Vec<TabInfo>, String> {
    let host = app
        .get_window(&window_label)
        .ok_or_else(|| format!("window {window_label} not found"))?;
    let mut tabs = Vec::new();
    for wv in host.webviews() {
        let label = wv.label().to_string();
        if let Some(id) = label.strip_prefix("tab-") {
            let url = wv.url().map(|u| u.to_string()).unwrap_or_default();
            tabs.push(TabInfo { id: id.to_string(), url });
        }
    }
    Ok(tabs)
}
