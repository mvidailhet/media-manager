const LOCAL_DESKTOP_APP_STATUS: &str = "Rust command online";

fn local_desktop_app_status() -> &'static str {
    LOCAL_DESKTOP_APP_STATUS
}

#[tauri::command]
fn get_local_desktop_app_status() -> &'static str {
    local_desktop_app_status()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_local_desktop_app_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::local_desktop_app_status;

    #[test]
    fn local_desktop_app_status_describes_the_tauri_bridge() {
        assert_eq!(local_desktop_app_status(), "Rust command online");
    }
}
