import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { open } from "@tauri-apps/plugin-dialog";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import {
  addScanRoot,
  getFfmpegToolsStatus,
  getLocalDesktopAppStatus,
  listScanRoots,
  removeScanRoot,
  saveFfmpegConfiguration
} from "./tauriCommands";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn()
}));

vi.mock("./tauriCommands", () => ({
  addScanRoot: vi.fn(),
  getFfmpegToolsStatus: vi.fn(),
  getLocalDesktopAppStatus: vi.fn(),
  listScanRoots: vi.fn(),
  removeScanRoot: vi.fn(),
  saveFfmpegConfiguration: vi.fn()
}));

const mockedOpen = vi.mocked(open);
const mockedGetLocalDesktopAppStatus = vi.mocked(getLocalDesktopAppStatus);
const mockedGetFfmpegToolsStatus = vi.mocked(getFfmpegToolsStatus);
const mockedSaveFfmpegConfiguration = vi.mocked(saveFfmpegConfiguration);
const mockedListScanRoots = vi.mocked(listScanRoots);
const mockedAddScanRoot = vi.mocked(addScanRoot);
const mockedRemoveScanRoot = vi.mocked(removeScanRoot);

const availableFfmpegToolsStatus = {
  ffmpeg: {
    binaryName: "ffmpeg",
    isAvailable: true,
    resolvedPath: "/usr/local/bin/ffmpeg",
    statusMessage: "ffmpeg is available (discovered from PATH)"
  },
  ffprobe: {
    binaryName: "ffprobe",
    isAvailable: true,
    resolvedPath: "/usr/local/bin/ffprobe",
    statusMessage: "ffprobe is available (discovered from PATH)"
  },
  configuration: {
    ffmpegPath: null,
    ffprobePath: null
  }
};

describe("Videos View shell", () => {
  beforeEach(() => {
    mockedGetLocalDesktopAppStatus.mockResolvedValue("Rust command online");
    mockedGetFfmpegToolsStatus.mockResolvedValue(availableFfmpegToolsStatus);
    mockedSaveFfmpegConfiguration.mockResolvedValue(availableFfmpegToolsStatus);
    mockedListScanRoots.mockResolvedValue([]);
    mockedAddScanRoot.mockImplementation(async (path) => ({ path }));
    mockedRemoveScanRoot.mockResolvedValue(undefined);
    mockedOpen.mockResolvedValue(null);
  });

  it("renders the Videos View as the initial workspace", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Videos View" })
    ).toBeInTheDocument();
    expect(screen.getByText("Local Desktop App")).toBeInTheDocument();
    expect(await screen.findByText("Rust command online")).toBeInTheDocument();
  });

  it("shows FFmpeg and ffprobe availability in the app status", async () => {
    render(<App />);

    expect(await screen.findByText("ffmpeg")).toBeInTheDocument();
    expect(screen.getByText("ffprobe")).toBeInTheDocument();
    expect(screen.getAllByText("Available")).toHaveLength(2);
    expect(screen.getByText("/usr/local/bin/ffmpeg")).toBeInTheDocument();
    expect(screen.getByText("/usr/local/bin/ffprobe")).toBeInTheDocument();
  });

  it("shows a clear status when FFmpeg tools are missing", async () => {
    mockedGetFfmpegToolsStatus.mockResolvedValue({
      ...availableFfmpegToolsStatus,
      ffmpeg: {
        binaryName: "ffmpeg",
        isAvailable: false,
        resolvedPath: null,
        statusMessage: "ffmpeg is not available from PATH or settings"
      }
    });

    render(<App />);

    expect(
      await screen.findByText("ffmpeg is not available from PATH or settings")
    ).toBeInTheDocument();
    expect(screen.getByText("Missing")).toBeInTheDocument();
  });

  it("loads persisted Scan Roots into the app", async () => {
    mockedListScanRoots.mockResolvedValue([
      {
        path: "/Volumes/Archive/Videos"
      }
    ]);

    render(<App />);

    expect(
      await screen.findByText("/Volumes/Archive/Videos")
    ).toBeInTheDocument();
  });

  it("adds a Scan Root through the folder picker", async () => {
    mockedOpen.mockResolvedValue("/Volumes/Archive/Videos");

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Choose folder" }));

    expect(mockedOpen).toHaveBeenCalledWith({
      directory: true,
      multiple: false
    });
    await waitFor(() => {
      expect(mockedAddScanRoot).toHaveBeenCalledWith("/Volumes/Archive/Videos");
    });
    expect(
      await screen.findByText("/Volumes/Archive/Videos")
    ).toBeInTheDocument();
  });

  it("shows a clear message when a Scan Root overlaps an existing root", async () => {
    mockedOpen.mockResolvedValue("/Volumes/Archive/Videos/Family");
    mockedAddScanRoot.mockRejectedValue(
      new Error("Scan Root overlaps with an existing Scan Root")
    );

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Choose folder" }));

    expect(
      await screen.findByText("Scan Root overlaps with an existing Scan Root")
    ).toBeInTheDocument();
  });

  it("asks how to handle affected Videos before removing a Scan Root", async () => {
    mockedListScanRoots.mockResolvedValue([
      {
        path: "/Volumes/Archive/Videos"
      }
    ]);

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Preserve as Missing Videos" })
    );

    expect(mockedRemoveScanRoot).toHaveBeenCalledWith(
      "/Volumes/Archive/Videos",
      "preserveMissingVideos"
    );
  });
});
