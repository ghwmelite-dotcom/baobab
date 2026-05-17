// Native OS context menus.
//
// We tried rendering menus in HTML (apps/desktop/src/chrome/ContextMenu.tsx
// in commit 2dab7b9) but that approach breaks on this multi-webview setup:
// each tab's page content is a NATIVE WebView2 child window that always
// composites above the chrome's HTML — no z-index will let an HTML menu
// render over it. OS-native menus are on the OS compositor layer and work
// correctly. They also give us free keyboard nav, screen-reader support,
// platform-correct styling, and accelerator hints.
//
// JS side fires `show_context_menu` with a flat list of items. Selection
// is reported back as a Tauri event `menu:select` (one global handler in
// lib.rs re-emits whatever id the user clicked). When the user dismisses
// the menu without selecting, NO event fires — the JS-side wrapper just
// times out and treats that as a no-op.

use serde::Deserialize;
use tauri::menu::{ContextMenu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::{AppHandle, Window};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuItemSpec {
    /// Stable identifier echoed back to JS on selection. Required for
    /// regular items; ignored for separators.
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub label: Option<String>,
    /// Display-only accelerator hint, e.g. "Ctrl+R". The OS shows it on
    /// the right side of the item. It does NOT bind the shortcut — that
    /// is handled separately by the app's keyboard layer.
    #[serde(default)]
    pub accelerator: Option<String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub separator: bool,
}

fn default_enabled() -> bool {
    true
}

#[tauri::command]
pub async fn show_context_menu(
    app: AppHandle,
    window: Window,
    items: Vec<MenuItemSpec>,
) -> Result<(), String> {
    let mut builder = MenuBuilder::new(&app);
    for item in &items {
        if item.separator {
            let sep = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
            builder = builder.item(&sep);
            continue;
        }
        let Some(id) = item.id.as_deref() else { continue };
        let label = item.label.as_deref().unwrap_or("");
        let mut mi = MenuItemBuilder::with_id(id, label).enabled(item.enabled);
        if let Some(accel) = &item.accelerator {
            // accelerator() is a display hint only. Empty string would
            // render as a blank right column on some platforms; skip if
            // missing rather than passing "".
            mi = mi.accelerator(accel);
        }
        let built = mi.build(&app).map_err(|e| e.to_string())?;
        builder = builder.item(&built);
    }
    let menu = builder.build().map_err(|e| e.to_string())?;

    // popup() shows the menu at the OS cursor position. On Windows this
    // is the natural right-click anchor; on macOS/Linux too. The call
    // returns immediately — selection is delivered via on_menu_event in
    // lib.rs, which re-emits a `menu:select` Tauri event.
    menu.popup(window).map_err(|e| e.to_string())?;
    Ok(())
}
