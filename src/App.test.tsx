import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { open } from "@tauri-apps/plugin-dialog";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { AppProviders } from "./AppProviders";
import {
  addScanRoot,
  forgetCatalogVideo,
  getFfmpegToolsStatus,
  getLocalDesktopAppStatus,
  listUnprocessableVideoCandidates,
  listCatalogVideos,
  listScanRoots,
  removeScanRoot,
  refreshAllScanRoots,
  refreshScanRoot,
  saveFfmpegConfiguration
} from "./tauriCommands";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn()
}));

vi.mock("./tauriCommands", () => ({
  addScanRoot: vi.fn(),
  forgetCatalogVideo: vi.fn(),
  getFfmpegToolsStatus: vi.fn(),
  getLocalDesktopAppStatus: vi.fn(),
  listUnprocessableVideoCandidates: vi.fn(),
  listCatalogVideos: vi.fn(),
  listScanRoots: vi.fn(),
  removeScanRoot: vi.fn(),
  refreshAllScanRoots: vi.fn(),
  refreshScanRoot: vi.fn(),
  saveFfmpegConfiguration: vi.fn()
}));

const mockedOpen = vi.mocked(open);
const mockedGetLocalDesktopAppStatus = vi.mocked(getLocalDesktopAppStatus);
const mockedGetFfmpegToolsStatus = vi.mocked(getFfmpegToolsStatus);
const mockedSaveFfmpegConfiguration = vi.mocked(saveFfmpegConfiguration);
const mockedListCatalogVideos = vi.mocked(listCatalogVideos);
const mockedListUnprocessableVideoCandidates = vi.mocked(
  listUnprocessableVideoCandidates
);
const mockedListScanRoots = vi.mocked(listScanRoots);
const mockedAddScanRoot = vi.mocked(addScanRoot);
const mockedForgetCatalogVideo = vi.mocked(forgetCatalogVideo);
const mockedRemoveScanRoot = vi.mocked(removeScanRoot);
const mockedRefreshAllScanRoots = vi.mocked(refreshAllScanRoots);
const mockedRefreshScanRoot = vi.mocked(refreshScanRoot);

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

function renderApp() {
  return render(
    <AppProviders>
      <App />
    </AppProviders>
  );
}

describe("Videos View shell", () => {
  beforeEach(() => {
    mockedGetLocalDesktopAppStatus.mockResolvedValue("Rust command online");
    mockedGetFfmpegToolsStatus.mockResolvedValue(availableFfmpegToolsStatus);
    mockedSaveFfmpegConfiguration.mockResolvedValue(availableFfmpegToolsStatus);
    mockedListCatalogVideos.mockResolvedValue([]);
    mockedListUnprocessableVideoCandidates.mockResolvedValue([]);
    mockedListScanRoots.mockResolvedValue([]);
    mockedAddScanRoot.mockImplementation(async (path) => ({
      path,
      isAvailable: true
    }));
    mockedForgetCatalogVideo.mockResolvedValue(undefined);
    mockedRemoveScanRoot.mockResolvedValue(undefined);
    mockedRefreshScanRoot.mockResolvedValue({
      scannedVideoCount: 0,
      unprocessableCandidateCount: 0
    });
    mockedRefreshAllScanRoots.mockResolvedValue({
      scannedVideoCount: 0,
      unprocessableCandidateCount: 0
    });
    mockedOpen.mockResolvedValue(null);
  });

  it("renders the Videos View as the initial workspace", async () => {
    renderApp();

    expect(
      screen.getByRole("heading", { name: "Videos View" })
    ).toBeInTheDocument();
    expect(screen.getByText("Local Desktop App")).toBeInTheDocument();
    expect(await screen.findByText("Rust command online")).toBeInTheDocument();
  });

  it("loads Catalog Videos into the Videos View", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: true
      }
    ]);

    renderApp();

    expect(await screen.findByText("Family Trip")).toBeInTheDocument();
    expect(screen.getByText("1h 2m")).toBeInTheDocument();
    expect(screen.getByText("80.7 MB")).toBeInTheDocument();
    expect(
      screen.getByText("/Volumes/Archive/Videos/family-trip.mp4")
    ).toBeInTheDocument();
  });

  it("marks Missing Videos unavailable in the normal Videos list", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: null,
        fileLocationPath: null,
        isAvailable: false
      }
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos"
    });

    expect(within(catalogVideos).getByText("Family Trip")).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Unavailable")).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Missing")).toBeInTheDocument();
  });

  it("shows an empty state when the Catalog has no Videos", async () => {
    renderApp();

    expect(
      await screen.findByText("No Videos in the Catalog.")
    ).toBeInTheDocument();
  });

  it("shows loading and error states for Catalog Videos", async () => {
    mockedListCatalogVideos.mockRejectedValue(new Error("Catalog unavailable"));

    renderApp();

    expect(screen.getByText("Loading Videos...")).toBeInTheDocument();
    expect(await screen.findByText("Videos unavailable")).toBeInTheDocument();
  });

  it("shows FFmpeg and ffprobe availability in the app status", async () => {
    renderApp();

    expect(await screen.findByText("ffmpeg")).toBeInTheDocument();
    expect(screen.getByText("ffprobe")).toBeInTheDocument();
    expect(screen.getAllByText("Available")).toHaveLength(2);
    expect(screen.getByText("/usr/local/bin/ffmpeg")).toBeInTheDocument();
    expect(screen.getByText("/usr/local/bin/ffprobe")).toBeInTheDocument();
  });

  it("uses Mantine controls and badges for the migrated UI surfaces", async () => {
    renderApp();

    const chooseFolderButton = await screen.findByRole("button", {
      name: "Choose folder"
    });
    const manualPathInput = screen.getByLabelText("Manual path");
    const availableBadge = screen.getAllByText("Available")[0];

    expect(chooseFolderButton.className).toContain("mantine-Button-root");
    expect(manualPathInput.className).toContain("mantine-Input-input");
    expect(availableBadge.closest(".mantine-Badge-root")).toBeInTheDocument();
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

    renderApp();

    expect(
      await screen.findByText("ffmpeg is not available from PATH or settings")
    ).toBeInTheDocument();
    expect(screen.getByText("Missing")).toBeInTheDocument();
  });

  it("loads persisted Scan Roots into the app", async () => {
    mockedListScanRoots.mockResolvedValue([
      {
        path: "/Volumes/Archive/Videos",
        isAvailable: true
      }
    ]);

    renderApp();

    expect(
      await screen.findByText("/Volumes/Archive/Videos")
    ).toBeInTheDocument();
  });

  it("adds a Scan Root through the folder picker", async () => {
    mockedOpen.mockResolvedValue("/Volumes/Archive/Videos");

    renderApp();

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

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Choose folder" }));

    expect(
      await screen.findByText("Scan Root overlaps with an existing Scan Root")
    ).toBeInTheDocument();
  });

  it("asks how to handle affected Videos before removing a Scan Root", async () => {
    mockedListScanRoots.mockResolvedValue([
      {
        path: "/Volumes/Archive/Videos",
        isAvailable: true
      }
    ]);

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Preserve as Missing Videos" })
    );

    expect(mockedRemoveScanRoot).toHaveBeenCalledWith(
      "/Volumes/Archive/Videos",
      "preserveMissingVideos"
    );
  });

  it("refreshes a selected Scan Root and shows the Catalog summary", async () => {
    mockedListScanRoots.mockResolvedValue([
      {
        path: "/Volumes/Archive/Videos",
        isAvailable: true
      }
    ]);
    mockedRefreshScanRoot.mockResolvedValue({
      scannedVideoCount: 2,
      unprocessableCandidateCount: 1
    });
    mockedListCatalogVideos
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 1,
          title: "Family Trip",
          durationMilliseconds: 3723000,
          fileSizeBytes: 80740352,
          fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
          isAvailable: true
        }
      ]);

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Refresh" }));

    expect(mockedRefreshScanRoot).toHaveBeenCalledWith(
      "/Volumes/Archive/Videos"
    );
    expect(
      await screen.findByText("2 Videos scanned, 1 Unprocessable Video Candidates")
    ).toBeInTheDocument();
    expect(await screen.findByText("Family Trip")).toBeInTheDocument();
  });

  it("refreshes all Scan Roots and reloads availability", async () => {
    mockedListScanRoots
      .mockResolvedValueOnce([
        {
          path: "/Volumes/Archive/Videos",
          isAvailable: true
        }
      ])
      .mockResolvedValueOnce([
        {
          path: "/Volumes/Archive/Videos",
          isAvailable: false
        }
      ]);

    renderApp();

    fireEvent.click(
      await screen.findByRole("button", { name: "Refresh all Scan Roots" })
    );

    expect(mockedRefreshAllScanRoots).toHaveBeenCalled();
    expect(await screen.findByText("Unavailable")).toBeInTheDocument();
  });

  it("lists scan-related issues in the Review Queue", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: null,
        fileLocationPath: null,
        isAvailable: false
      },
      {
        id: 2,
        title: "Available Trip",
        durationMilliseconds: 120000,
        fileSizeBytes: 1024,
        fileLocationPath: "/Volumes/Archive/Videos/available-trip.mp4",
        isAvailable: true
      }
    ]);
    mockedListScanRoots.mockResolvedValue([
      {
        path: "/Volumes/Missing/Videos",
        isAvailable: false
      },
      {
        path: "/Volumes/Archive/Videos",
        isAvailable: true
      }
    ]);
    mockedListUnprocessableVideoCandidates.mockResolvedValue([
      {
        path: "/Volumes/Archive/Videos/broken.mkv",
        reason: "missing moov atom",
        fileSizeBytes: 2048
      }
    ]);

    renderApp();

    const reviewQueue = await screen.findByRole("region", {
      name: "Review Queue"
    });
    expect(
      within(reviewQueue).getByRole("heading", { name: "Review Queue" })
    ).toBeInTheDocument();
    expect(
      within(reviewQueue).getByRole("heading", { name: "Missing Videos" })
    ).toBeInTheDocument();
    expect(within(reviewQueue).getByText("Family Trip")).toBeInTheDocument();
    expect(within(reviewQueue).queryByText("Available Trip")).not.toBeInTheDocument();
    expect(
      within(reviewQueue).getByText("/Volumes/Missing/Videos")
    ).toBeInTheDocument();
    expect(
      within(reviewQueue).getByText("/Volumes/Archive/Videos/broken.mkv")
    ).toBeInTheDocument();
    expect(within(reviewQueue).getByText("missing moov atom")).toBeInTheDocument();
  });

  it("requires confirmation before forgetting a Missing Video from the Catalog", async () => {
    mockedListCatalogVideos
      .mockResolvedValueOnce([
        {
          id: 1,
          title: "Family Trip",
          durationMilliseconds: 3723000,
          fileSizeBytes: null,
          fileLocationPath: null,
          isAvailable: false
        }
      ])
      .mockResolvedValueOnce([]);

    renderApp();

    fireEvent.click(
      await screen.findByRole("button", { name: "Forget From Catalog" })
    );

    expect(mockedForgetCatalogVideo).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Forget Missing Video" })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Confirm Forget From Catalog" })
    );

    await waitFor(() => {
      expect(mockedForgetCatalogVideo).toHaveBeenCalledWith(1);
    });
    expect(screen.queryByText("Family Trip")).not.toBeInTheDocument();
  });
});
