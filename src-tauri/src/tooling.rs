#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::{
    env, fs, io,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use tauri::Manager;

const FFMPEG_BINARY_NAME: &str = "ffmpeg";
const FFPROBE_BINARY_NAME: &str = "ffprobe";
const FFMPEG_SETTINGS_FILE_NAME: &str = "ffmpeg-settings.json";

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegConfiguration {
    pub ffmpeg_path: Option<String>,
    pub ffprobe_path: Option<String>,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegToolsStatus {
    pub ffmpeg: FfmpegToolStatus,
    pub ffprobe: FfmpegToolStatus,
    pub configuration: FfmpegConfiguration,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegToolStatus {
    pub binary_name: &'static str,
    pub is_available: bool,
    pub resolved_path: Option<String>,
    pub status_message: String,
}

pub fn configured_or_discovered_ffprobe_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let ffmpeg_tools_status = load_ffmpeg_tools_status(app)?;

    ffmpeg_tools_status
        .ffprobe
        .resolved_path
        .filter(|_| ffmpeg_tools_status.ffprobe.is_available)
        .map(PathBuf::from)
        .ok_or(ffmpeg_tools_status.ffprobe.status_message)
}

pub fn configured_or_discovered_ffmpeg_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let ffmpeg_tools_status = load_ffmpeg_tools_status(app)?;

    ffmpeg_tools_status
        .ffmpeg
        .resolved_path
        .filter(|_| ffmpeg_tools_status.ffmpeg.is_available)
        .map(PathBuf::from)
        .ok_or(ffmpeg_tools_status.ffmpeg.status_message)
}

pub fn load_ffmpeg_tools_status(app: &tauri::AppHandle) -> Result<FfmpegToolsStatus, String> {
    let settings_path = ffmpeg_settings_path(app)?;
    let configuration = load_ffmpeg_configuration(&settings_path)?;

    Ok(discover_ffmpeg_tools_status_from_environment(configuration))
}

pub fn save_ffmpeg_configuration(
    app: &tauri::AppHandle,
    configuration: &FfmpegConfiguration,
) -> Result<FfmpegToolsStatus, String> {
    let settings_path = ffmpeg_settings_path(app)?;
    save_ffmpeg_configuration_to_path(&settings_path, configuration)?;

    Ok(discover_ffmpeg_tools_status_from_environment(
        configuration.clone(),
    ))
}

pub fn load_saved_ffmpeg_configuration(
    app: &tauri::AppHandle,
) -> Result<FfmpegConfiguration, String> {
    let settings_path = ffmpeg_settings_path(app)?;

    load_ffmpeg_configuration(&settings_path)
}

fn discover_ffmpeg_tools_status_from_environment(
    configuration: FfmpegConfiguration,
) -> FfmpegToolsStatus {
    let path_value = env::var_os("PATH").unwrap_or_default();
    let path_value = path_value.to_string_lossy();

    discover_ffmpeg_tools_status(&path_value, configuration)
}

pub fn discover_ffmpeg_tools_status(
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
    if is_executable_file(candidate_path) {
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
        .flat_map(|path_directory| {
            executable_binary_names(binary_name)
                .into_iter()
                .map(move |candidate_name| path_directory.join(candidate_name))
        })
        .find(|candidate_path| is_executable_file(candidate_path))
}

pub fn executable_binary_names(binary_name: &str) -> Vec<String> {
    let binary_file_name = binary_name.to_string();
    let windows_binary_file_name = format!("{binary_name}.exe");

    if binary_name.ends_with(".exe") {
        vec![binary_file_name]
    } else {
        vec![binary_file_name, windows_binary_file_name]
    }
}

#[cfg(unix)]
fn is_executable_file(path: &Path) -> bool {
    path.metadata()
        .map(|metadata| metadata.is_file() && metadata.permissions().mode() & 0o111 != 0)
        .unwrap_or(false)
}

#[cfg(not(unix))]
fn is_executable_file(path: &Path) -> bool {
    path.is_file()
}

pub fn load_ffmpeg_configuration(settings_path: &Path) -> Result<FfmpegConfiguration, String> {
    match fs::read_to_string(settings_path) {
        Ok(settings_json) => {
            serde_json::from_str(&settings_json).map_err(|error| error.to_string())
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(FfmpegConfiguration::default()),
        Err(error) => Err(error.to_string()),
    }
}

pub fn save_ffmpeg_configuration_to_path(
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
