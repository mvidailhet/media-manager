import { invoke } from "@tauri-apps/api/core";

const localDesktopAppStatusCommand = "get_local_desktop_app_status";
const listCatalogVideosCommand = "list_catalog_videos";
const ffmpegToolsStatusCommand = "get_ffmpeg_tools_status";
const saveFfmpegConfigurationCommand = "save_ffmpeg_configuration";

export interface CatalogVideo {
  title: string;
  durationMilliseconds: number;
  fileSizeBytes: number;
  fileLocationPath: string;
}

export type FfmpegConfiguration = {
  ffmpegPath: string | null;
  ffprobePath: string | null;
};

export type FfmpegToolStatus = {
  binaryName: string;
  isAvailable: boolean;
  resolvedPath: string | null;
  statusMessage: string;
};

export type FfmpegToolsStatus = {
  ffmpeg: FfmpegToolStatus;
  ffprobe: FfmpegToolStatus;
  configuration: FfmpegConfiguration;
};

export async function getLocalDesktopAppStatus(): Promise<string> {
  return invoke<string>(localDesktopAppStatusCommand);
}

export async function listCatalogVideos(): Promise<CatalogVideo[]> {
  return invoke<CatalogVideo[]>(listCatalogVideosCommand);
}

export async function getFfmpegToolsStatus(): Promise<FfmpegToolsStatus> {
  return invoke<FfmpegToolsStatus>(ffmpegToolsStatusCommand);
}

export async function saveFfmpegConfiguration(
  configuration: FfmpegConfiguration
): Promise<FfmpegToolsStatus> {
  return invoke<FfmpegToolsStatus>(saveFfmpegConfigurationCommand, {
    configuration
  });
}
