mod downloads;
mod migration;
mod pin;
mod pin_attempts;
mod profiles;
mod tabs;
mod windows;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(crate::pin_attempts::PinAttempts::new())
        .setup(|app| {
            use tauri::Manager;
            let handle = app.handle().clone();
            let root = handle.path().app_data_dir().map_err(|e| e.to_string())?;

            // One-shot migration creates "My Baobab" on fresh install.
            let _ = migration::maybe_migrate(&root);

            let file = profiles::load(&root).map_err(|e| e.to_string())?;
            let count = file.profiles.len();
            let any_locked = file.profiles.iter().any(|p| p.pin_hash.is_some());
            let show_picker = any_locked || match count {
                0 => false,
                1 => file.picker_prefs.show_on_startup,
                _ => true,
            };

            if show_picker {
                tauri::async_runtime::block_on(windows::open_picker_window(handle.clone()))
                    .map_err(|e| e.to_string())?;
            } else if let Some(p) = file.profiles.first() {
                tauri::async_runtime::block_on(windows::build_profile_window(&handle, &p.id))
                    .map_err(|e| e.to_string())?;
            } else {
                tauri::async_runtime::block_on(windows::open_picker_window(handle.clone()))
                    .map_err(|e| e.to_string())?;
            }

            #[cfg(debug_assertions)]
            {
                for (_label, win) in handle.webview_windows() {
                    win.open_devtools();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            tabs::create_tab,
            tabs::close_tab,
            tabs::show_tab,
            tabs::hide_tab,
            tabs::hide_all_tabs,
            tabs::navigate_tab,
            tabs::list_tabs,
            tabs::tab_go_back,
            tabs::tab_go_forward,
            downloads::download_show_in_folder,
            downloads::download_open_file,
            profiles::cmd_list_profiles,
            profiles::cmd_get_picker_prefs,
            profiles::cmd_create_profile,
            profiles::cmd_rename_profile,
            profiles::cmd_update_profile_color,
            profiles::cmd_delete_profile,
            profiles::cmd_set_show_on_startup,
            profiles::cmd_record_profile_used,
            profiles::cmd_set_profile_pin,
            profiles::cmd_remove_profile_pin,
            windows::open_profile_window,
            windows::open_picker_window,
            windows::open_guest_window,
            windows::current_profile_id,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Baobab");
}
