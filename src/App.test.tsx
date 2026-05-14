import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import {
  getFfmpegToolsStatus,
  getLocalDesktopAppStatus,
  saveFfmpegConfiguration
} from "./tauriCommands";

vi.mock("./tauriCommands", () => ({
  getFfmpegToolsStatus: vi.fn(),
  getLocalDesktopAppStatus: vi.fn(),
  saveFfmpegConfiguration: vi.fn()
}));

const mockedGetLocalDesktopAppStatus = vi.mocked(getLocalDesktopAppStatus);
const mockedGetFfmpegToolsStatus = vi.mocked(getFfmpegToolsStatus);
const mockedSaveFfmpegConfiguration = vi.mocked(saveFfmpegConfiguration);

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
});
