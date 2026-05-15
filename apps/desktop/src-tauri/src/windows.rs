use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::pin;
use crate::pin_attempts::{AttemptResult, PinAttempts};
use crate::profiles;

pub const PICKER_LABEL: &str = "picker";
pub const GUEST_LABEL_PREFIX: &str = "guest-";

pub fn profile_window_label(profile_id: &str) -> String {
    format!("profile-{profile_id}")
}

/// Build a profile window and record usage. Called after PIN is verified (or
/// skipped for auto-launch on startup). Extracted so the startup code in
/// `lib.rs` can call it without needing a `State<'_>` handle.
pub async fn build_profile_window(app: &AppHandle, profile_id: &str) -> Result<(), String> {
    let label = profile_window_label(profile_id);
    let url = WebviewUrl::App(format!("index.html?profileId={profile_id}").into());
    WebviewWindowBuilder::new(app, &label, url)
        .title("Baobab")
        .inner_size(1280.0, 800.0)
        .min_inner_size(800.0, 500.0)
        .decorations(false)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    if let Ok(root) = app.path().app_data_dir() {
        let _ = profiles::record_profile_used(&root, profile_id);
    }

    Ok(())
}

#[tauri::command]
pub async fn open_profile_window(
    app: AppHandle,
    attempts: tauri::State<'_, PinAttempts>,
    profile_id: String,
    pin: Option<String>,
) -> Result<(), String> {
    let label = profile_window_label(&profile_id);
    // A window already open belongs to a session that already proved knowledge
    // of the PIN — focusing it is fine without re-checking.
    if let Some(existing) = app.get_webview_window(&label) {
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let root = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let file = profiles::load(&root)?;
    let profile = file
        .profiles
        .iter()
        .find(|p| p.id == profile_id)
        .ok_or("profile_not_found")?;

    if let Some(hash) = &profile.pin_hash {
        // Rate-limit check first.
        if let AttemptResult::Locked { remaining_seconds } = attempts.check(&profile_id) {
            return Err(format!("locked:{}", remaining_seconds));
        }
        let supplied = pin.as_deref().ok_or("pin_required")?;
        if !pin::verify_pin(hash, supplied).map_err(|e| e.to_string())? {
            if let Some(secs) = attempts.record_wrong(&profile_id) {
                return Err(format!("locked:{}", secs));
            }
            return Err("wrong_pin".into());
        }
        attempts.record_correct(&profile_id);
    }

    let url = WebviewUrl::App(format!("index.html?profileId={}", profile_id).into());
    WebviewWindowBuilder::new(&app, &label, url)
        .title("Baobab")
        .inner_size(1280.0, 800.0)
        .min_inner_size(800.0, 500.0)
        .decorations(false)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    let _ = profiles::record_profile_used(&root, &profile_id);
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
        .inner_size(640.0, 480.0)
        .min_inner_size(480.0, 400.0)
        .decorations(false)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Remove the temporary data directory used by a guest window. Extracted into
/// a plain function so it can be called from both the window-close handler and
/// unit tests without requiring a live Tauri window.
pub fn cleanup_guest_data_dir(label: &str) {
    let dir = std::env::temp_dir().join(format!("baobab-guest-{label}"));
    if dir.exists() {
        let _ = std::fs::remove_dir_all(&dir);
    }
}

#[tauri::command]
pub async fn open_guest_window(app: AppHandle) -> Result<(), String> {
    let label = format!("{}{}", GUEST_LABEL_PREFIX, uuid::Uuid::new_v4());
    let url = WebviewUrl::App("index.html?profileId=guest".into());
    let window = WebviewWindowBuilder::new(&app, &label, url)
        .title("Baobab \u{2014} Guest")
        .inner_size(1280.0, 800.0)
        .min_inner_size(800.0, 500.0)
        .decorations(false)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    // Wipe the guest data directory when the window is destroyed so that
    // cookies, localStorage, and IndexedDB from this session cannot leak
    // into a future guest session (spec AC: close guest → reopen → data gone).
    let label_for_cleanup = label.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            cleanup_guest_data_dir(&label_for_cleanup);
        }
    });

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

    #[test]
    fn cleanup_guest_data_dir_removes_temp_dir() {
        // Use a label that is unlikely to collide with anything real.
        let label = format!("guest-test-cleanup-{}", uuid::Uuid::new_v4());
        let dir = std::env::temp_dir().join(format!("baobab-guest-{label}"));

        // Create the directory to simulate it having been used by a guest window.
        std::fs::create_dir_all(&dir).expect("could not create temp dir for test");
        assert!(dir.exists(), "precondition: dir should exist before cleanup");

        cleanup_guest_data_dir(&label);

        assert!(!dir.exists(), "cleanup_guest_data_dir should have removed the dir");
    }

    #[test]
    fn cleanup_guest_data_dir_is_idempotent_when_dir_absent() {
        // Calling cleanup on a label whose directory was never created (or was
        // already removed) must not panic.
        let label = format!("guest-nonexistent-{}", uuid::Uuid::new_v4());
        cleanup_guest_data_dir(&label); // should not panic
    }
}
