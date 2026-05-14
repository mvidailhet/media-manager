import { invoke } from "@tauri-apps/api/core";

const localDesktopAppStatusCommand = "get_local_desktop_app_status";
const listCatalogVideosCommand = "list_catalog_videos";

export interface CatalogVideo {
  title: string;
  durationMilliseconds: number;
  fileSizeBytes: number;
  fileLocationPath: string;
}

export async function getLocalDesktopAppStatus(): Promise<string> {
  return invoke<string>(localDesktopAppStatusCommand);
}

export async function listCatalogVideos(): Promise<CatalogVideo[]> {
  return invoke<CatalogVideo[]>(listCatalogVideosCommand);
}
