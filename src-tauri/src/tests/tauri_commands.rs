use super::*;

#[test]
fn local_desktop_app_status_describes_the_tauri_bridge() {
    assert_eq!(local_desktop_app_status(), "Rust command online");
}

#[test]
fn catalog_database_filename_is_app_private_sqlite_storage() {
    assert_eq!(CATALOG_DATABASE_FILENAME, "catalog.sqlite3");
}

#[test]
fn preview_strip_cache_folder_name_is_app_private_cache_storage() {
    assert_eq!(PREVIEW_STRIP_CACHE_FOLDER_NAME, "preview-strips");
}

#[test]
fn file_location_open_command_uses_the_platform_launcher() {
    let video_path = std::path::Path::new("/Volumes/Archive/Videos/family trip.mp4");

    let macos_command = file_location_open_command_for_platform(video_path, "macos");
    let linux_command = file_location_open_command_for_platform(video_path, "linux");
    let windows_command = file_location_open_command_for_platform(video_path, "windows");

    assert_eq!(macos_command.program, "open");
    assert_eq!(
        macos_command.arguments,
        vec!["/Volumes/Archive/Videos/family trip.mp4"]
    );
    assert_eq!(linux_command.program, "xdg-open");
    assert_eq!(
        linux_command.arguments,
        vec!["/Volumes/Archive/Videos/family trip.mp4"]
    );
    assert_eq!(windows_command.program, "cmd");
    assert_eq!(
        windows_command.arguments,
        vec!["/C", "start", "", "/Volumes/Archive/Videos/family trip.mp4"]
    );
}

#[test]
fn video_start_time_open_command_reuses_the_macos_vlc_player() {
    let video_path = std::path::Path::new("/Volumes/Archive/Videos/family trip.mp4");

    let macos_command = video_start_time_open_command_for_platform(video_path, 83, "macos");

    assert_eq!(macos_command.program, "osascript");
    assert_eq!(macos_command.arguments[0], "-e");
    assert!(macos_command.arguments[1].contains("tell application \"VLC\""));
    assert!(macos_command.arguments[1]
        .contains("OpenURL \"file:///Volumes/Archive/Videos/family%20trip.mp4\""));
    assert!(macos_command.arguments[1].contains("set current time to 83"));
    assert!(macos_command.arguments[1].contains("if playing is false then play"));
    assert!(!macos_command.arguments[1].contains("Media Manager"));
    assert_eq!(macos_command.arguments[1].matches("end tell").count(), 1);
    assert!(!macos_command.arguments[1].contains("\n            play\n"));
    assert!(!macos_command.should_detach);
}

#[test]
fn video_start_time_open_command_uses_vlc_on_linux() {
    let video_path = std::path::Path::new("/Volumes/Archive/Videos/family trip.mp4");

    let linux_command = video_start_time_open_command_for_platform(video_path, 83, "linux");

    assert_eq!(
        linux_command.arguments,
        vec!["--start-time=83", "/Volumes/Archive/Videos/family trip.mp4"]
    );
    assert_eq!(linux_command.program, "vlc");
    assert!(linux_command.should_detach);
}
