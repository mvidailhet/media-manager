import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addScanRoot,
  getFfmpegToolsStatus,
  getLocalDesktopAppStatus,
  listCatalogVideos,
  listScanRoots,
  removeScanRoot,
  saveFfmpegConfiguration
} from "./tauriCommands";

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

  it("calls the typed Rust command for persisted Scan Roots", async () => {
    mockedInvoke.mockResolvedValue([
      {
        path: "/Volumes/Archive/Videos"
      }
    ]);

    const scanRoots = await listScanRoots();

    expect(scanRoots).toEqual([
      {
        path: "/Volumes/Archive/Videos"
      }
    ]);
    expect(mockedInvoke).toHaveBeenCalledWith("list_scan_roots");
  });

  it("adds a Scan Root through the Rust command", async () => {
    await addScanRoot("/Volumes/Archive/Videos");

    expect(mockedInvoke).toHaveBeenCalledWith("add_scan_root", {
      path: "/Volumes/Archive/Videos"
    });
  });

  it("removes a Scan Root through the Rust command with the selected catalog policy", async () => {
    await removeScanRoot("/Volumes/Archive/Videos", "preserveMissingVideos");

    expect(mockedInvoke).toHaveBeenCalledWith("remove_scan_root", {
      path: "/Volumes/Archive/Videos",
      removalPolicy: "preserveMissingVideos"
    });
  });

  it("calls the typed Rust command for FFmpeg tools status", async () => {
    await getFfmpegToolsStatus();

    expect(mockedInvoke).toHaveBeenCalledWith("get_ffmpeg_tools_status");
  });

  it("persists FFmpeg binary path configuration through the Rust command", async () => {
    const configuration = {
      ffmpegPath: "/opt/homebrew/bin/ffmpeg",
      ffprobePath: "/opt/homebrew/bin/ffprobe"
    };

    await saveFfmpegConfiguration(configuration);

    expect(mockedInvoke).toHaveBeenCalledWith("save_ffmpeg_configuration", {
      configuration
    });
  });
});
