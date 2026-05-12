mod tabs;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let main = app.get_webview_window("main").expect("main window");
                main.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            tabs::create_tab,
            tabs::close_tab,
            tabs::show_tab,
            tabs::hide_tab,
            tabs::navigate_tab,
            tabs::list_tabs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Baobab");
}
