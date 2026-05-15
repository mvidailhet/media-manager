import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { AppProviders } from "./AppProviders";
import {
  addScanRoot,
  forgetCatalogVideo,
  generateMissingPreviewStrips,
  getPreviewStripQueueStatus,
  getFfmpegToolsStatus,
  getLocalDesktopAppStatus,
  ignoreFailedPreviewStrip,
  listFailedPreviewStrips,
  listUnprocessableVideoCandidates,
  listCatalogVideos,
  listScanRoots,
  pausePreviewStripQueue,
  processNextPreviewStripQueueItem,
  removeScanRoot,
  resumePreviewStripQueue,
  refreshAllScanRoots,
  refreshScanRoot,
  retryFailedPreviewStrip,
  saveFfmpegConfiguration
} from "./tauriCommands";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn()
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`)
}));

vi.mock("./tauriCommands", () => ({
  addScanRoot: vi.fn(),
  forgetCatalogVideo: vi.fn(),
  generateMissingPreviewStrips: vi.fn(),
  getPreviewStripQueueStatus: vi.fn(),
  getFfmpegToolsStatus: vi.fn(),
  getLocalDesktopAppStatus: vi.fn(),
  ignoreFailedPreviewStrip: vi.fn(),
  listFailedPreviewStrips: vi.fn(),
  listUnprocessableVideoCandidates: vi.fn(),
  listCatalogVideos: vi.fn(),
  listScanRoots: vi.fn(),
  pausePreviewStripQueue: vi.fn(),
  processNextPreviewStripQueueItem: vi.fn(),
  removeScanRoot: vi.fn(),
  resumePreviewStripQueue: vi.fn(),
  refreshAllScanRoots: vi.fn(),
  refreshScanRoot: vi.fn(),
  retryFailedPreviewStrip: vi.fn(),
  saveFfmpegConfiguration: vi.fn()
}));

const mockedOpen = vi.mocked(open);
const mockedConvertFileSrc = vi.mocked(convertFileSrc);
const mockedGetLocalDesktopAppStatus = vi.mocked(getLocalDesktopAppStatus);
const mockedGetFfmpegToolsStatus = vi.mocked(getFfmpegToolsStatus);
const mockedSaveFfmpegConfiguration = vi.mocked(saveFfmpegConfiguration);
const mockedListFailedPreviewStrips = vi.mocked(listFailedPreviewStrips);
const mockedRetryFailedPreviewStrip = vi.mocked(retryFailedPreviewStrip);
const mockedIgnoreFailedPreviewStrip = vi.mocked(ignoreFailedPreviewStrip);
const mockedListCatalogVideos = vi.mocked(listCatalogVideos);
const mockedListUnprocessableVideoCandidates = vi.mocked(
  listUnprocessableVideoCandidates
);
const mockedListScanRoots = vi.mocked(listScanRoots);
const mockedAddScanRoot = vi.mocked(addScanRoot);
const mockedForgetCatalogVideo = vi.mocked(forgetCatalogVideo);
const mockedGenerateMissingPreviewStrips = vi.mocked(generateMissingPreviewStrips);
const mockedGetPreviewStripQueueStatus = vi.mocked(getPreviewStripQueueStatus);
const mockedPausePreviewStripQueue = vi.mocked(pausePreviewStripQueue);
const mockedProcessNextPreviewStripQueueItem = vi.mocked(
  processNextPreviewStripQueueItem
);
const mockedRemoveScanRoot = vi.mocked(removeScanRoot);
const mockedResumePreviewStripQueue = vi.mocked(resumePreviewStripQueue);
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

const pendingPreviewStrip = {
  status: "pending" as const
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
    vi.clearAllMocks();
    mockedGetLocalDesktopAppStatus.mockResolvedValue("Rust command online");
    mockedGetFfmpegToolsStatus.mockResolvedValue(availableFfmpegToolsStatus);
    mockedSaveFfmpegConfiguration.mockResolvedValue(availableFfmpegToolsStatus);
    mockedListFailedPreviewStrips.mockResolvedValue([]);
    mockedRetryFailedPreviewStrip.mockResolvedValue({
      pendingCount: 1,
      runningCount: 0,
      failedCount: 0,
      isPaused: false
    });
    mockedIgnoreFailedPreviewStrip.mockResolvedValue({
      pendingCount: 0,
      runningCount: 0,
      failedCount: 0,
      isPaused: false
    });
    mockedListCatalogVideos.mockResolvedValue([]);
    mockedListUnprocessableVideoCandidates.mockResolvedValue([]);
    mockedListScanRoots.mockResolvedValue([]);
    mockedAddScanRoot.mockImplementation(async (path) => ({
      path,
      isAvailable: true
    }));
    mockedForgetCatalogVideo.mockResolvedValue(undefined);
    mockedGenerateMissingPreviewStrips.mockResolvedValue({
      generatedPreviewStripCount: 0,
      failedPreviewStripCount: 0
    });
    mockedGetPreviewStripQueueStatus.mockResolvedValue({
      pendingCount: 0,
      runningCount: 0,
      failedCount: 0,
      isPaused: false
    });
    mockedPausePreviewStripQueue.mockResolvedValue({
      pendingCount: 3,
      runningCount: 0,
      failedCount: 1,
      isPaused: true
    });
    mockedResumePreviewStripQueue.mockResolvedValue({
      pendingCount: 3,
      runningCount: 1,
      failedCount: 1,
      isPaused: false
    });
    mockedProcessNextPreviewStripQueueItem.mockResolvedValue({
      pendingCount: 0,
      runningCount: 0,
      failedCount: 0,
      isPaused: false
    });
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
        isAvailable: true,
        previewStrip: pendingPreviewStrip
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
        isAvailable: false,
        previewStrip: pendingPreviewStrip
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

  it("queues cataloged Videos missing Preview Strips for generation", async () => {
    mockedGenerateMissingPreviewStrips.mockResolvedValue({
      generatedPreviewStripCount: 3,
      failedPreviewStripCount: 1
    });
    mockedListCatalogVideos
      .mockResolvedValueOnce([
        {
          id: 1,
          title: "Family Trip",
          durationMilliseconds: 3723000,
          fileSizeBytes: 80740352,
          fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
          isAvailable: true,
          previewStrip: pendingPreviewStrip
        }
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          title: "Family Trip",
          durationMilliseconds: 3723000,
          fileSizeBytes: 80740352,
          fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
          isAvailable: true,
          previewStrip: {
            status: "generated",
            path: "/Users/michel/Library/Caches/preview-strips/video-1-preview-strip.jpg",
            frameCount: 20,
            columnCount: 5,
            rowCount: 4
          }
        }
      ]);

    renderApp();

    fireEvent.click(
      await screen.findByRole("button", { name: "Generate Preview Strips" })
    );

    expect(mockedGenerateMissingPreviewStrips).toHaveBeenCalled();
    expect(
      await screen.findByText(
        "3 Preview Strips generated, 1 Preview Strips failed"
      )
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("img", { name: "Preview Strip for Family Trip" })
    ).toBeInTheDocument();
  });

  it("shows Preview Strip queue status and supports global pause and resume", async () => {
    mockedGetPreviewStripQueueStatus.mockResolvedValue({
      pendingCount: 3,
      runningCount: 1,
      failedCount: 1,
      isPaused: false
    });
    mockedProcessNextPreviewStripQueueItem.mockResolvedValue({
      pendingCount: 3,
      runningCount: 1,
      failedCount: 1,
      isPaused: false
    });

    renderApp();

    expect(await screen.findByText("3 pending")).toBeInTheDocument();
    expect(screen.getByText("1 running")).toBeInTheDocument();
    expect(screen.getByText("1 failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pause Preview Queue" }));

    expect(mockedPausePreviewStripQueue).toHaveBeenCalled();
    expect(await screen.findByText("Paused")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Resume Preview Queue" }));

    expect(mockedResumePreviewStripQueue).toHaveBeenCalled();
    expect(await screen.findByText("Running")).toBeInTheDocument();
  });

  it("shows generated Preview Strips and scrubs frames by horizontal pointer position", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: true,
        previewStrip: {
          status: "generated",
          path: "/Users/michel/Library/Caches/preview-strips/video-1-preview-strip.jpg",
          frameCount: 20,
          columnCount: 5,
          rowCount: 4
        }
      }
    ]);

    renderApp();

    const previewStrip = await screen.findByRole("img", {
      name: "Preview Strip for Family Trip"
    });

    expect(mockedConvertFileSrc).toHaveBeenCalledWith(
      "/Users/michel/Library/Caches/preview-strips/video-1-preview-strip.jpg"
    );
    expect(previewStrip).toHaveStyle({
      backgroundImage:
        "url(asset:///Users/michel/Library/Caches/preview-strips/video-1-preview-strip.jpg)",
      backgroundPosition: "0% 0%"
    });

    Object.defineProperty(previewStrip, "clientWidth", {
      configurable: true,
      value: 500
    });
    previewStrip.getBoundingClientRect = vi.fn(
      () =>
        ({
          left: 0,
          width: 500,
          right: 500,
          top: 0,
          bottom: 90,
          height: 90,
          x: 0,
          y: 0,
          toJSON: () => ({})
        }) as DOMRect
    );

    fireEvent(
      previewStrip,
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: 250
      })
    );

    expect(previewStrip).toHaveStyle({
      backgroundPosition: "0% 66.66666666666666%"
    });
  });

  it("keeps Pending and Failed Preview Strip Videos visible in the Videos View", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Pending Trip",
        durationMilliseconds: 60000,
        fileSizeBytes: 2000000,
        fileLocationPath: "/Volumes/Archive/Videos/pending-trip.mp4",
        isAvailable: true,
        previewStrip: {
          status: "pending"
        }
      },
      {
        id: 2,
        title: "Failed Trip",
        durationMilliseconds: 60000,
        fileSizeBytes: 2000000,
        fileLocationPath: "/Volumes/Archive/Videos/failed-trip.mp4",
        isAvailable: true,
        previewStrip: {
          status: "failed",
          failureReason: "ffmpeg failed"
        }
      }
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos"
    });

    expect(within(catalogVideos).getByText("Pending Trip")).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Pending Preview Strip")).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Failed Trip")).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Failed Preview Strip")).toBeInTheDocument();
  });

  it("shows FFmpeg and ffprobe availability in the app status", async () => {
    renderApp();

    expect(await screen.findByText("ffmpeg")).toBeInTheDocument();
    expect(screen.getByText("ffprobe")).toBeInTheDocument();
    expect(screen.getAllByText("Available")).toHaveLength(2);
    expect(screen.getByText("/usr/local/bin/ffmpeg")).toBeInTheDocument();
    expect(screen.getByText("/usr/local/bin/ffprobe")).toBeInTheDocument();
  });

  it("keeps actions, form controls, and status badges visually consistent", async () => {
    renderApp();

    const chooseFolderButton = await screen.findByRole("button", {
      name: "Choose folder"
    });
    const manualPathInput = screen.getByLabelText("Manual path");
    const availableBadge = screen.getAllByText("Available")[0];

    expect(chooseFolderButton).toBeVisible();
    expect(manualPathInput).toBeVisible();
    expect(availableBadge).toBeVisible();
    expect(document.documentElement).toHaveAttribute(
      "data-mantine-color-scheme",
      "dark"
    );
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

  it("shows a clear message when the folder picker cannot open", async () => {
    mockedOpen.mockRejectedValue(new Error("dialog open permission denied"));

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Choose folder" }));

    expect(
      await screen.findByText("dialog open permission denied")
    ).toBeInTheDocument();
    expect(mockedAddScanRoot).not.toHaveBeenCalled();
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
          isAvailable: true,
          previewStrip: pendingPreviewStrip
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
        isAvailable: false,
        previewStrip: pendingPreviewStrip
      },
      {
        id: 2,
        title: "Available Trip",
        durationMilliseconds: 120000,
        fileSizeBytes: 1024,
        fileLocationPath: "/Volumes/Archive/Videos/available-trip.mp4",
        isAvailable: true,
        previewStrip: pendingPreviewStrip
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

  it("lists Failed Preview Strips in the Review Queue with retry and ignore actions", async () => {
    mockedListFailedPreviewStrips
      .mockResolvedValueOnce([
        {
          videoId: 7,
          title: "Broken Trip",
          failureReason: "ffmpeg failed"
        }
      ])
      .mockResolvedValueOnce([
        {
          videoId: 7,
          title: "Broken Trip",
          failureReason: "ffmpeg failed"
        }
      ])
      .mockResolvedValueOnce([]);

    renderApp();

    const reviewQueue = await screen.findByRole("region", {
      name: "Review Queue"
    });
    expect(
      within(reviewQueue).getByRole("heading", { name: "Failed Preview Strips" })
    ).toBeInTheDocument();
    expect(within(reviewQueue).getByText("Broken Trip")).toBeInTheDocument();
    expect(within(reviewQueue).getByText("ffmpeg failed")).toBeInTheDocument();

    fireEvent.click(
      within(reviewQueue).getByRole("button", {
        name: "Retry Failed Preview Strip for Broken Trip"
      })
    );
    await waitFor(() => {
      expect(mockedRetryFailedPreviewStrip).toHaveBeenCalledWith(7);
    });
    expect(mockedGetPreviewStripQueueStatus).toHaveBeenCalled();

    fireEvent.click(
      within(reviewQueue).getByRole("button", {
        name: "Ignore Failed Preview Strip for Broken Trip"
      })
    );
    await waitFor(() => {
      expect(mockedIgnoreFailedPreviewStrip).toHaveBeenCalledWith(7);
    });
    expect(
      within(reviewQueue).queryByText("Broken Trip")
    ).not.toBeInTheDocument();
  });

  it("refreshes Failed Preview Strips after Preview Strip generation fails", async () => {
    mockedGenerateMissingPreviewStrips.mockResolvedValue({
      generatedPreviewStripCount: 0,
      failedPreviewStripCount: 1
    });
    mockedListFailedPreviewStrips
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        {
          videoId: 7,
          title: "Broken Trip",
          failureReason: "ffmpeg failed"
        }
      ]);

    renderApp();

    fireEvent.click(
      await screen.findByRole("button", { name: "Generate Preview Strips" })
    );

    const reviewQueue = await screen.findByRole("region", {
      name: "Review Queue"
    });
    expect(
      await within(reviewQueue).findByText("Broken Trip")
    ).toBeInTheDocument();
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
          isAvailable: false,
          previewStrip: pendingPreviewStrip
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
