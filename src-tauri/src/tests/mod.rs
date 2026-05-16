use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use crate::tooling::{
    discover_ffmpeg_tools_status, executable_binary_names, load_ffmpeg_configuration,
    save_ffmpeg_configuration_to_path, FfmpegConfiguration,
};
use crate::{
    file_location_open_command_for_platform, local_desktop_app_status, CATALOG_DATABASE_FILENAME,
    PREVIEW_STRIP_CACHE_FOLDER_NAME,
};

mod tauri_commands;
mod tooling_tests;
