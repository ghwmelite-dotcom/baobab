mod downloads;
mod profiles;
mod tabs;
mod windows;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|_app| {
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
            windows::open_profile_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Baobab");
}
