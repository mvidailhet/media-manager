import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getLocalDesktopAppStatus, listCatalogVideos } from "./tauriCommands";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn()
}));

const mockedInvoke = vi.mocked(invoke);

describe("Tauri commands", () => {
  beforeEach(() => {
    mockedInvoke.mockResolvedValue("Local command response");
  });

  it("calls the typed Rust command for the Local Desktop App status", async () => {
    const status = await getLocalDesktopAppStatus();

    expect(status).toBe("Local command response");
    expect(mockedInvoke).toHaveBeenCalledWith("get_local_desktop_app_status");
  });

  it("calls the typed Rust command for listed Catalog Videos", async () => {
    mockedInvoke.mockResolvedValue([
      {
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4"
      }
    ]);

    const videos = await listCatalogVideos();

    expect(videos).toEqual([
      {
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4"
      }
    ]);
    expect(mockedInvoke).toHaveBeenCalledWith("list_catalog_videos");
  });
});
