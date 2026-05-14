import { invoke } from "@tauri-apps/api/core";

const localDesktopAppStatusCommand = "get_local_desktop_app_status";
const listCatalogVideosCommand = "list_catalog_videos";
const listScanRootsCommand = "list_scan_roots";
const addScanRootCommand = "add_scan_root";
const removeScanRootCommand = "remove_scan_root";
const refreshScanRootCommand = "refresh_scan_root";
const refreshAllScanRootsCommand = "refresh_all_scan_roots";
const listUnprocessableVideoCandidatesCommand =
  "list_unprocessable_video_candidates";
const ffmpegToolsStatusCommand = "get_ffmpeg_tools_status";
const saveFfmpegConfigurationCommand = "save_ffmpeg_configuration";

export interface CatalogVideo {
  id: number;
  title: string;
  durationMilliseconds: number;
  fileSizeBytes: number | null;
  fileLocationPath: string | null;
  isAvailable: boolean;
}

export interface ScanRoot {
  path: string;
  isAvailable: boolean;
}

export interface ScanRootRefreshSummary {
  scannedVideoCount: number;
  unprocessableCandidateCount: number;
}

export interface UnprocessableVideoCandidate {
  path: string;
  reason: string;
  fileSizeBytes: number;
}

export type VideoExtensionAllowlist = {
  extensions: string[];
};

export type ScanRootRemovalPolicy =
  | "preserveMissingVideos"
  | "forgetFromCatalog";

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

export async function listScanRoots(): Promise<ScanRoot[]> {
  return invoke<ScanRoot[]>(listScanRootsCommand);
}

export async function addScanRoot(path: string): Promise<ScanRoot> {
  return invoke<ScanRoot>(addScanRootCommand, { path });
}

export async function removeScanRoot(
  path: string,
  removalPolicy: ScanRootRemovalPolicy
): Promise<void> {
  return invoke<void>(removeScanRootCommand, { path, removalPolicy });
}

export async function refreshScanRoot(
  path: string,
  videoExtensionAllowlist?: VideoExtensionAllowlist
): Promise<ScanRootRefreshSummary> {
  return invoke<ScanRootRefreshSummary>(refreshScanRootCommand, {
    path,
    videoExtensionAllowlist: videoExtensionAllowlist ?? null
  });
}

export async function refreshAllScanRoots(
  videoExtensionAllowlist?: VideoExtensionAllowlist
): Promise<ScanRootRefreshSummary> {
  return invoke<ScanRootRefreshSummary>(refreshAllScanRootsCommand, {
    videoExtensionAllowlist: videoExtensionAllowlist ?? null
  });
}

export async function listUnprocessableVideoCandidates(): Promise<
  UnprocessableVideoCandidate[]
> {
  return invoke<UnprocessableVideoCandidate[]>(
    listUnprocessableVideoCandidatesCommand
  );
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
