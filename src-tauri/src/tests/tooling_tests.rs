use super::*;

#[test]
fn ffmpeg_tools_status_discovers_binaries_from_path() {
    let test_bin_dir =
        std::env::temp_dir().join(format!("media-manager-ffmpeg-test-{}", std::process::id()));
    fs::create_dir_all(&test_bin_dir).expect("test bin directory should be created");
    fs::write(test_bin_dir.join("ffmpeg"), "").expect("ffmpeg test binary should exist");
    fs::write(test_bin_dir.join("ffprobe"), "").expect("ffprobe test binary should exist");
    make_test_binary_executable(&test_bin_dir.join("ffmpeg"));
    make_test_binary_executable(&test_bin_dir.join("ffprobe"));

    let ffmpeg_tools_status = discover_ffmpeg_tools_status(
        test_bin_dir.to_string_lossy().as_ref(),
        FfmpegConfiguration::default(),
    );

    assert!(ffmpeg_tools_status.ffmpeg.is_available);
    assert!(ffmpeg_tools_status.ffprobe.is_available);

    fs::remove_dir_all(test_bin_dir).expect("test bin directory should be removed");
}

#[cfg(unix)]
#[test]
fn ffmpeg_tools_status_does_not_accept_non_executable_files_from_path() {
    let test_bin_dir = std::env::temp_dir().join(format!(
        "media-manager-ffmpeg-non-executable-test-{}",
        std::process::id()
    ));
    fs::create_dir_all(&test_bin_dir).expect("test bin directory should be created");
    fs::write(test_bin_dir.join("ffmpeg"), "").expect("ffmpeg test file should exist");

    let ffmpeg_tools_status = discover_ffmpeg_tools_status(
        test_bin_dir.to_string_lossy().as_ref(),
        FfmpegConfiguration::default(),
    );

    assert!(!ffmpeg_tools_status.ffmpeg.is_available);

    fs::remove_dir_all(test_bin_dir).expect("test bin directory should be removed");
}

#[test]
fn executable_binary_names_include_windows_exe_candidate() {
    let binary_names = executable_binary_names("ffmpeg");

    assert!(binary_names.contains(&"ffmpeg".to_string()));
    assert!(binary_names.contains(&"ffmpeg.exe".to_string()));
}

#[test]
fn ffmpeg_tools_status_discovers_windows_exe_binary_from_path() {
    let test_bin_dir = std::env::temp_dir().join(format!(
        "media-manager-ffmpeg-windows-path-test-{}",
        std::process::id()
    ));
    fs::create_dir_all(&test_bin_dir).expect("test bin directory should be created");
    fs::write(test_bin_dir.join("ffmpeg.exe"), "").expect("ffmpeg exe test binary should exist");
    make_test_binary_executable(&test_bin_dir.join("ffmpeg.exe"));

    let ffmpeg_tools_status = discover_ffmpeg_tools_status(
        test_bin_dir.to_string_lossy().as_ref(),
        FfmpegConfiguration::default(),
    );

    assert!(ffmpeg_tools_status.ffmpeg.is_available);

    fs::remove_dir_all(test_bin_dir).expect("test bin directory should be removed");
}

#[test]
fn ffmpeg_tools_status_reports_missing_configured_binary_without_crashing() {
    let configuration = FfmpegConfiguration {
        ffmpeg_path: Some("/definitely/missing/ffmpeg".to_string()),
        ffprobe_path: None,
    };

    let ffmpeg_tools_status = discover_ffmpeg_tools_status("", configuration);

    assert!(!ffmpeg_tools_status.ffmpeg.is_available);
    assert_eq!(
        ffmpeg_tools_status.ffmpeg.status_message,
        "ffmpeg was not found at the configured path"
    );
}

#[test]
fn ffmpeg_configuration_round_trips_through_settings_file() {
    let settings_dir = std::env::temp_dir().join(format!(
        "media-manager-ffmpeg-settings-test-{}",
        std::process::id()
    ));
    let settings_path = settings_dir.join("ffmpeg-settings.json");
    let configuration = FfmpegConfiguration {
        ffmpeg_path: Some("/usr/local/bin/ffmpeg".to_string()),
        ffprobe_path: Some("/usr/local/bin/ffprobe".to_string()),
    };

    save_ffmpeg_configuration_to_path(&settings_path, &configuration)
        .expect("settings should be saved");
    let saved_configuration =
        load_ffmpeg_configuration(&settings_path).expect("settings should be loaded");

    assert_eq!(saved_configuration, configuration);

    fs::remove_dir_all(settings_dir).expect("settings directory should be removed");
}

#[cfg(unix)]
fn make_test_binary_executable(path: &std::path::Path) {
    let mut permissions = fs::metadata(path)
        .expect("test binary metadata should be available")
        .permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions).expect("test binary should be executable");
}

#[cfg(not(unix))]
fn make_test_binary_executable(_path: &std::path::Path) {}
