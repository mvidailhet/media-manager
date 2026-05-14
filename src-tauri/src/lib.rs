mod catalog;

use std::{
    env, fs, io,
    path::{Path, PathBuf},
    sync::Mutex,
};

use catalog::{Catalog, CatalogVideo};
use serde::{Deserialize, Serialize};
use tauri::Manager;

const LOCAL_DESKTOP_APP_STATUS: &str = "Rust command online";
const CATALOG_DATABASE_FILENAME: &str = "catalog.sqlite3";
const FFMPEG_BINARY_NAME: &str = "ffmpeg";
const FFPROBE_BINARY_NAME: &str = "ffprobe";
const FFMPEG_SETTINGS_FILE_NAME: &str = "ffmpeg-settings.json";

struct CatalogState {
    catalog: Mutex<Catalog>,
}

fn local_desktop_app_status() -> &'static str {
    LOCAL_DESKTOP_APP_STATUS
}

fn catalog_path(app: &tauri::App) -> Result<PathBuf, String> {
    let app_data_folder = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&app_data_folder).map_err(|error| error.to_string())?;

    Ok(app_data_folder.join(CATALOG_DATABASE_FILENAME))
}

fn initialize_catalog(app: &tauri::App) -> Result<(), String> {
    let catalog_path = catalog_path(app)?;
    let catalog = Catalog::open(&catalog_path)?;
    let catalog_state = CatalogState {
        catalog: Mutex::new(catalog),
    };

    app.manage(catalog_state);

    Ok(())
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct FfmpegConfiguration {
    ffmpeg_path: Option<String>,
    ffprobe_path: Option<String>,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct FfmpegToolsStatus {
    ffmpeg: FfmpegToolStatus,
    ffprobe: FfmpegToolStatus,
    configuration: FfmpegConfiguration,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct FfmpegToolStatus {
    binary_name: &'static str,
    is_available: bool,
    resolved_path: Option<String>,
    status_message: String,
}

fn discover_ffmpeg_tools_status(
    path_value: &str,
    configuration: FfmpegConfiguration,
) -> FfmpegToolsStatus {
    FfmpegToolsStatus {
        ffmpeg: discover_ffmpeg_tool_status(
            FFMPEG_BINARY_NAME,
            configuration.ffmpeg_path.as_deref(),
            path_value,
        ),
        ffprobe: discover_ffmpeg_tool_status(
            FFPROBE_BINARY_NAME,
            configuration.ffprobe_path.as_deref(),
            path_value,
        ),
        configuration,
    }
}

fn discover_ffmpeg_tool_status(
    binary_name: &'static str,
    configured_path: Option<&str>,
    path_value: &str,
) -> FfmpegToolStatus {
    if let Some(configured_path) = configured_path.filter(|path| !path.trim().is_empty()) {
        return status_for_candidate(binary_name, Path::new(configured_path), "configured path");
    }

    if let Some(discovered_path) = find_binary_on_path(binary_name, path_value) {
        return available_tool_status(binary_name, discovered_path, "discovered from PATH");
    }

    FfmpegToolStatus {
        binary_name,
        is_available: false,
        resolved_path: None,
        status_message: format!("{binary_name} is not available from PATH or settings"),
    }
}

fn status_for_candidate(
    binary_name: &'static str,
    candidate_path: &Path,
    source_description: &str,
) -> FfmpegToolStatus {
    if candidate_path.is_file() {
        available_tool_status(
            binary_name,
            candidate_path.to_path_buf(),
            source_description,
        )
    } else {
        FfmpegToolStatus {
            binary_name,
            is_available: false,
            resolved_path: Some(candidate_path.to_string_lossy().into_owned()),
            status_message: format!("{binary_name} was not found at the {source_description}"),
        }
    }
}

fn available_tool_status(
    binary_name: &'static str,
    resolved_path: PathBuf,
    source_description: &str,
) -> FfmpegToolStatus {
    FfmpegToolStatus {
        binary_name,
        is_available: true,
        resolved_path: Some(resolved_path.to_string_lossy().into_owned()),
        status_message: format!("{binary_name} is available ({source_description})"),
    }
}

fn find_binary_on_path(binary_name: &str, path_value: &str) -> Option<PathBuf> {
    env::split_paths(path_value)
        .map(|path_directory| path_directory.join(binary_name))
        .find(|candidate_path| candidate_path.is_file())
}

fn load_ffmpeg_configuration(settings_path: &Path) -> Result<FfmpegConfiguration, String> {
    match fs::read_to_string(settings_path) {
        Ok(settings_json) => {
            serde_json::from_str(&settings_json).map_err(|error| error.to_string())
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(FfmpegConfiguration::default()),
        Err(error) => Err(error.to_string()),
    }
}

fn save_ffmpeg_configuration_to_path(
    settings_path: &Path,
    configuration: &FfmpegConfiguration,
) -> Result<(), String> {
    if let Some(settings_directory) = settings_path.parent() {
        fs::create_dir_all(settings_directory).map_err(|error| error.to_string())?;
    }

    let settings_json =
        serde_json::to_string_pretty(configuration).map_err(|error| error.to_string())?;
    fs::write(settings_path, settings_json).map_err(|error| error.to_string())
}

fn ffmpeg_settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_config_directory = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;

    Ok(app_config_directory.join(FFMPEG_SETTINGS_FILE_NAME))
}

#[tauri::command]
fn get_local_desktop_app_status() -> &'static str {
    local_desktop_app_status()
}

#[tauri::command]
fn list_catalog_videos(
    catalog_state: tauri::State<'_, CatalogState>,
) -> Result<Vec<CatalogVideo>, String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.listed_videos()
}

#[tauri::command]
fn get_ffmpeg_tools_status(app: tauri::AppHandle) -> Result<FfmpegToolsStatus, String> {
    let settings_path = ffmpeg_settings_path(&app)?;
    let configuration = load_ffmpeg_configuration(&settings_path)?;
    let path_value = env::var_os("PATH").unwrap_or_default();
    let path_value = path_value.to_string_lossy();

    Ok(discover_ffmpeg_tools_status(&path_value, configuration))
}

#[tauri::command]
fn save_ffmpeg_configuration(
    app: tauri::AppHandle,
    configuration: FfmpegConfiguration,
) -> Result<FfmpegToolsStatus, String> {
    let settings_path = ffmpeg_settings_path(&app)?;

    save_ffmpeg_configuration_to_path(&settings_path, &configuration)?;

    let path_value = env::var_os("PATH").unwrap_or_default();
    let path_value = path_value.to_string_lossy();

    Ok(discover_ffmpeg_tools_status(&path_value, configuration))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            initialize_catalog(app)
                .map_err(|error| Box::<dyn std::error::Error>::from(std::io::Error::other(error)))
        })
        .invoke_handler(tauri::generate_handler![
            get_local_desktop_app_status,
            list_catalog_videos,
            get_ffmpeg_tools_status,
            save_ffmpeg_configuration
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::{
        discover_ffmpeg_tools_status, load_ffmpeg_configuration, local_desktop_app_status,
        save_ffmpeg_configuration_to_path, FfmpegConfiguration, CATALOG_DATABASE_FILENAME,
    };

    #[test]
    fn local_desktop_app_status_describes_the_tauri_bridge() {
        assert_eq!(local_desktop_app_status(), "Rust command online");
    }

    #[test]
    fn catalog_database_filename_is_app_private_sqlite_storage() {
        assert_eq!(CATALOG_DATABASE_FILENAME, "catalog.sqlite3");
    }

    #[test]
    fn ffmpeg_tools_status_discovers_binaries_from_path() {
        let test_bin_dir =
            std::env::temp_dir().join(format!("media-manager-ffmpeg-test-{}", std::process::id()));
        fs::create_dir_all(&test_bin_dir).expect("test bin directory should be created");
        fs::write(test_bin_dir.join("ffmpeg"), "").expect("ffmpeg test binary should exist");
        fs::write(test_bin_dir.join("ffprobe"), "").expect("ffprobe test binary should exist");

        let ffmpeg_tools_status = discover_ffmpeg_tools_status(
            test_bin_dir.to_string_lossy().as_ref(),
            FfmpegConfiguration::default(),
        );

        assert!(ffmpeg_tools_status.ffmpeg.is_available);
        assert!(ffmpeg_tools_status.ffprobe.is_available);

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
}
