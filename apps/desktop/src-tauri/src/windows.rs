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

#[tauri::command]
pub async fn open_picker_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(PICKER_LABEL) {
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let url = WebviewUrl::App("picker.html".into());
    WebviewWindowBuilder::new(&app, PICKER_LABEL, url)
        .title("Baobab \u{2014} Profiles")
        .inner_size(960.0, 720.0)
        .min_inner_size(640.0, 560.0)
        .decorations(false)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn open_guest_window(app: AppHandle) -> Result<(), String> {
    let label = format!("{}{}", GUEST_LABEL_PREFIX, uuid::Uuid::new_v4());
    let url = WebviewUrl::App("index.html?profileId=guest".into());
    WebviewWindowBuilder::new(&app, &label, url)
        .title("Baobab \u{2014} Guest")
        .inner_size(1280.0, 800.0)
        .min_inner_size(800.0, 500.0)
        .decorations(false)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn current_profile_id(window: tauri::Window) -> Option<String> {
    profile_id_from_label(window.label())
}

pub fn profile_id_from_label(label: &str) -> Option<String> {
    if let Some(id) = label.strip_prefix("profile-") {
        return Some(id.to_string());
    }
    if label.starts_with(GUEST_LABEL_PREFIX) {
        return Some("guest".to_string());
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_id_from_label_recognizes_profile_prefix() {
        assert_eq!(
            profile_id_from_label("profile-abc-123"),
            Some("abc-123".to_string())
        );
    }

    #[test]
    fn profile_id_from_label_recognizes_guest_prefix() {
        assert_eq!(
            profile_id_from_label("guest-xyz"),
            Some("guest".to_string())
        );
    }

    #[test]
    fn profile_id_from_label_returns_none_for_picker() {
        assert_eq!(profile_id_from_label("picker"), None);
    }
}
