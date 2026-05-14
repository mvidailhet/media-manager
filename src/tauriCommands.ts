import { invoke } from "@tauri-apps/api/core";

const localDesktopAppStatusCommand = "get_local_desktop_app_status";

export async function getLocalDesktopAppStatus(): Promise<string> {
  return invoke<string>(localDesktopAppStatusCommand);
}
