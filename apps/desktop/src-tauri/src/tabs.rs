use serde::{Deserialize, Serialize};
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl};

const CHROME_HEIGHT: f64 = 36.0 + 40.0 + 56.0; // titlebar + tabstrip + omnibar
const STATUS_HEIGHT: f64 = 28.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TabInfo {
    pub id: String,
    pub url: String,
}

fn tab_label(id: &str) -> String {
    format!("tab-{id}")
}

#[tauri::command]
pub async fn create_tab(app: AppHandle, id: String, url: String) -> Result<TabInfo, String> {
    let main = app
        .get_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    let size = main.inner_size().map_err(|e| e.to_string())?;
    let scale = main.scale_factor().map_err(|e| e.to_string())?;
    let logical_w = size.width as f64 / scale;
    let logical_h = size.height as f64 / scale;

    let label = tab_label(&id);
    let webview_url = WebviewUrl::External(url.parse().map_err(|e: url::ParseError| e.to_string())?);

    let builder = tauri::webview::WebviewBuilder::new(label, webview_url);
    main.add_child(
        builder,
        LogicalPosition::new(0.0, CHROME_HEIGHT),
        LogicalSize::new(logical_w, (logical_h - CHROME_HEIGHT - STATUS_HEIGHT).max(0.0)),
    )
    .map_err(|e| e.to_string())?;

    Ok(TabInfo { id, url })
}

#[tauri::command]
pub async fn close_tab(app: AppHandle, id: String) -> Result<(), String> {
    let label = tab_label(&id);
    if let Some(wv) = app.get_webview(&label) {
        wv.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn show_tab(app: AppHandle, id: String) -> Result<(), String> {
    let main = app
        .get_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    for wv in main.webviews() {
        if wv.label() == "main" {
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

#[tauri::command]
pub async fn list_tabs(app: AppHandle) -> Result<Vec<TabInfo>, String> {
    let main = app
        .get_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    let mut tabs = Vec::new();
    for wv in main.webviews() {
        let label = wv.label().to_string();
        if let Some(id) = label.strip_prefix("tab-") {
            let url = wv.url().map(|u| u.to_string()).unwrap_or_default();
            tabs.push(TabInfo { id: id.to_string(), url });
        }
    }
    Ok(tabs)
}
