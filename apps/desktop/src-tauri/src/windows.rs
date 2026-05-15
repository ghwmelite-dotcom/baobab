use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::profiles;

pub const PICKER_LABEL: &str = "picker";
pub const GUEST_LABEL_PREFIX: &str = "guest-";

pub fn profile_window_label(profile_id: &str) -> String {
    format!("profile-{profile_id}")
}

#[tauri::command]
pub async fn open_profile_window(app: AppHandle, profile_id: String) -> Result<(), String> {
    let label = profile_window_label(&profile_id);

    if let Some(win) = app.get_webview_window(&label) {
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let url = WebviewUrl::App(format!("index.html?profileId={profile_id}").into());
    WebviewWindowBuilder::new(&app, &label, url)
        .title("Baobab")
        .inner_size(1280.0, 800.0)
        .min_inner_size(800.0, 500.0)
        .decorations(false)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    // Record the profile as used (best-effort; ignore error)
    if let Ok(root) = app.path().app_data_dir() {
        let _ = profiles::record_profile_used(&root, &profile_id);
    }

    Ok(())
}
