import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { AppProviders } from "./AppProviders";
import {
  addScanRoot,
  attachPerformerToVideo,
  attachTagToVideo,
  createPerformer,
  createTag,
  detachPerformerFromVideo,
  detachTagFromVideo,
  forgetCatalogVideo,
  getPreviewStripQueueStatus,
  getFfmpegToolsStatus,
  getLocalDesktopAppStatus,
  ignoreFailedPreviewStrip,
  listFailedPreviewStrips,
  listPerformers,
  listTags,
  listUnprocessableVideoCandidates,
  listCatalogVideos,
  listScanRoots,
  performersForVideo,
  pausePreviewStripQueue,
  processNextPreviewStripQueueItem,
  removeScanRoot,
  resumePreviewStripQueue,
  refreshAllScanRoots,
  refreshScanRoot,
  retryFailedPreviewStrip,
  saveFfmpegConfiguration,
  setVideoFavorite,
  openCatalogVideo,
  tagsForVideo,
  updateScanRootInferenceRules,
  updateVideoTitle,
} from "./tauriCommands";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}));

vi.mock("./tauriCommands", () => ({
  addScanRoot: vi.fn(),
  attachPerformerToVideo: vi.fn(),
  attachTagToVideo: vi.fn(),
  createPerformer: vi.fn(),
  createTag: vi.fn(),
  detachPerformerFromVideo: vi.fn(),
  detachTagFromVideo: vi.fn(),
  forgetCatalogVideo: vi.fn(),
  getPreviewStripQueueStatus: vi.fn(),
  getFfmpegToolsStatus: vi.fn(),
  getLocalDesktopAppStatus: vi.fn(),
  ignoreFailedPreviewStrip: vi.fn(),
  listFailedPreviewStrips: vi.fn(),
  listPerformers: vi.fn(),
  listTags: vi.fn(),
  listUnprocessableVideoCandidates: vi.fn(),
  listCatalogVideos: vi.fn(),
  listScanRoots: vi.fn(),
  performersForVideo: vi.fn(),
  pausePreviewStripQueue: vi.fn(),
  processNextPreviewStripQueueItem: vi.fn(),
  removeScanRoot: vi.fn(),
  resumePreviewStripQueue: vi.fn(),
  refreshAllScanRoots: vi.fn(),
  refreshScanRoot: vi.fn(),
  retryFailedPreviewStrip: vi.fn(),
  saveFfmpegConfiguration: vi.fn(),
  setVideoFavorite: vi.fn(),
  openCatalogVideo: vi.fn(),
  tagsForVideo: vi.fn(),
  updateScanRootInferenceRules: vi.fn(),
  updateVideoTitle: vi.fn(),
}));

const mockedOpen = vi.mocked(open);
const mockedConvertFileSrc = vi.mocked(convertFileSrc);
const mockedGetLocalDesktopAppStatus = vi.mocked(getLocalDesktopAppStatus);
const mockedGetFfmpegToolsStatus = vi.mocked(getFfmpegToolsStatus);
const mockedSaveFfmpegConfiguration = vi.mocked(saveFfmpegConfiguration);
const mockedListFailedPreviewStrips = vi.mocked(listFailedPreviewStrips);
const mockedListTags = vi.mocked(listTags);
const mockedListPerformers = vi.mocked(listPerformers);
const mockedTagsForVideo = vi.mocked(tagsForVideo);
const mockedPerformersForVideo = vi.mocked(performersForVideo);
const mockedAttachTagToVideo = vi.mocked(attachTagToVideo);
const mockedDetachTagFromVideo = vi.mocked(detachTagFromVideo);
const mockedAttachPerformerToVideo = vi.mocked(attachPerformerToVideo);
const mockedDetachPerformerFromVideo = vi.mocked(detachPerformerFromVideo);
const mockedCreateTag = vi.mocked(createTag);
const mockedCreatePerformer = vi.mocked(createPerformer);
const mockedUpdateVideoTitle = vi.mocked(updateVideoTitle);
const mockedSetVideoFavorite = vi.mocked(setVideoFavorite);
const mockedOpenCatalogVideo = vi.mocked(openCatalogVideo);
const mockedRetryFailedPreviewStrip = vi.mocked(retryFailedPreviewStrip);
const mockedIgnoreFailedPreviewStrip = vi.mocked(ignoreFailedPreviewStrip);
const mockedListCatalogVideos = vi.mocked(listCatalogVideos);
const mockedListUnprocessableVideoCandidates = vi.mocked(
  listUnprocessableVideoCandidates,
);
const mockedListScanRoots = vi.mocked(listScanRoots);
const mockedAddScanRoot = vi.mocked(addScanRoot);
const mockedForgetCatalogVideo = vi.mocked(forgetCatalogVideo);
const mockedGetPreviewStripQueueStatus = vi.mocked(getPreviewStripQueueStatus);
const mockedPausePreviewStripQueue = vi.mocked(pausePreviewStripQueue);
const mockedProcessNextPreviewStripQueueItem = vi.mocked(
  processNextPreviewStripQueueItem,
);
const mockedRemoveScanRoot = vi.mocked(removeScanRoot);
const mockedResumePreviewStripQueue = vi.mocked(resumePreviewStripQueue);
const mockedRefreshAllScanRoots = vi.mocked(refreshAllScanRoots);
const mockedRefreshScanRoot = vi.mocked(refreshScanRoot);
const mockedUpdateScanRootInferenceRules = vi.mocked(
  updateScanRootInferenceRules,
);

const availableFfmpegToolsStatus = {
  ffmpeg: {
    binaryName: "ffmpeg",
    isAvailable: true,
    fileLocations: [],
    isFavorite: false,
    resolvedPath: "/usr/local/bin/ffmpeg",
    statusMessage: "ffmpeg is available (discovered from PATH)",
  },
  ffprobe: {
    binaryName: "ffprobe",
    isAvailable: true,
    fileLocations: [],
    isFavorite: false,
    resolvedPath: "/usr/local/bin/ffprobe",
    statusMessage: "ffprobe is available (discovered from PATH)",
  },
  configuration: {
    ffmpegPath: null,
    ffprobePath: null,
  },
};

const pendingPreviewStrip = {
  status: "pending" as const,
};

const defaultInferenceRules = {
  ignoredExactYearRange: {
    endYear: 2099,
    startYear: 1900,
  },
  ignoredFolderNames: [
    "Misc",
    "Unsorted",
    "To Sort",
    "To Review",
    "New",
    "Temp",
    "Archive",
    "Archives",
    "Downloads",
    "Videos",
  ],
  suggestPerformersFromChildFolders: false,
  suggestTagsFromChildFolders: true,
};

function deferredPromise<T>() {
  let resolvePromise: (value: T | PromiseLike<T>) => void = () => {};
  let rejectPromise: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
}

function renderApp() {
  return render(
    <AppProviders>
      <App />
    </AppProviders>,
  );
}

describe("Videos View shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetLocalDesktopAppStatus.mockResolvedValue("Rust command online");
    mockedGetFfmpegToolsStatus.mockResolvedValue(availableFfmpegToolsStatus);
    mockedSaveFfmpegConfiguration.mockResolvedValue(availableFfmpegToolsStatus);
    mockedListFailedPreviewStrips.mockResolvedValue([]);
    mockedListTags.mockResolvedValue([]);
    mockedListPerformers.mockResolvedValue([]);
    mockedTagsForVideo.mockResolvedValue([]);
    mockedPerformersForVideo.mockResolvedValue([]);
    mockedAttachTagToVideo.mockResolvedValue(undefined);
    mockedDetachTagFromVideo.mockResolvedValue(undefined);
    mockedAttachPerformerToVideo.mockResolvedValue(undefined);
    mockedDetachPerformerFromVideo.mockResolvedValue(undefined);
    mockedCreateTag.mockResolvedValue({ id: 100, name: "New Tag" });
    mockedCreatePerformer.mockResolvedValue({ id: 200, name: "New Performer" });
    mockedUpdateVideoTitle.mockResolvedValue(undefined);
    mockedSetVideoFavorite.mockResolvedValue(undefined);
    mockedOpenCatalogVideo.mockResolvedValue(undefined);
    mockedRetryFailedPreviewStrip.mockResolvedValue({
      pendingCount: 1,
      runningCount: 0,
      runningVideoId: null,
      failedCount: 0,
      isPaused: false,
    });
    mockedIgnoreFailedPreviewStrip.mockResolvedValue({
      pendingCount: 0,
      runningCount: 0,
      runningVideoId: null,
      failedCount: 0,
      isPaused: false,
    });
    mockedListCatalogVideos.mockResolvedValue([]);
    mockedListUnprocessableVideoCandidates.mockResolvedValue([]);
    mockedListScanRoots.mockResolvedValue([]);
    mockedAddScanRoot.mockImplementation(async (path) => ({
      inferenceRules: defaultInferenceRules,
      isAvailable: true,
      path,
    }));
    mockedForgetCatalogVideo.mockResolvedValue(undefined);
    mockedGetPreviewStripQueueStatus.mockResolvedValue({
      pendingCount: 0,
      runningCount: 0,
      runningVideoId: null,
      failedCount: 0,
      isPaused: false,
    });
    mockedPausePreviewStripQueue.mockResolvedValue({
      pendingCount: 3,
      runningCount: 0,
      runningVideoId: null,
      failedCount: 1,
      isPaused: true,
    });
    mockedResumePreviewStripQueue.mockResolvedValue({
      pendingCount: 3,
      runningCount: 1,
      runningVideoId: 1,
      failedCount: 1,
      isPaused: false,
    });
    mockedProcessNextPreviewStripQueueItem.mockResolvedValue({
      pendingCount: 0,
      runningCount: 0,
      runningVideoId: null,
      failedCount: 0,
      isPaused: false,
    });
    mockedRemoveScanRoot.mockResolvedValue(undefined);
    mockedRefreshScanRoot.mockResolvedValue({
      scannedVideoCount: 0,
      unprocessableCandidateCount: 0,
    });
    mockedUpdateScanRootInferenceRules.mockImplementation(
      async (path, inferenceRules) => ({
        inferenceRules,
        isAvailable: true,
        path,
      }),
    );
    mockedRefreshAllScanRoots.mockResolvedValue({
      scannedVideoCount: 0,
      unprocessableCandidateCount: 0,
    });
    mockedOpen.mockResolvedValue(null);
  });

  it("renders the Videos View as the initial workspace", async () => {
    renderApp();

    expect(
      screen.getByRole("heading", { name: "Videos View" }),
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
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    expect(await screen.findByText("Family Trip")).toBeInTheDocument();
    expect(screen.getByText("1h 2m")).toBeInTheDocument();
    expect(screen.getByText("80.7 MB")).toBeInTheDocument();
    expect(
      screen.getByText("/Volumes/Archive/Videos/family-trip.mp4"),
    ).toBeInTheDocument();
  });

  it("filters Catalog Videos by text favorite and duration while keeping Missing Videos visible", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: true,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
      {
        id: 2,
        title: "Studio Clip",
        durationMilliseconds: 120000,
        fileSizeBytes: 12000000,
        fileLocationPath: "/Volumes/Archive/Videos/studio-clip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
      {
        id: 3,
        title: "Archive Family Cut",
        durationMilliseconds: 1800000,
        fileSizeBytes: null,
        fileLocationPath: null,
        isAvailable: false,
        fileLocations: [],
        isFavorite: true,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    await screen.findByText("Studio Clip");
    const catalogVideos = screen.getByRole("region", {
      name: "Catalog Videos",
    });
    expect(within(catalogVideos).getByText("Studio Clip")).toBeInTheDocument();

    fireEvent.change(within(catalogVideos).getByLabelText("Search Videos"), {
      target: { value: "family" },
    });
    fireEvent.click(within(catalogVideos).getByLabelText("Favorites only"));
    fireEvent.change(
      within(catalogVideos).getByLabelText("Minimum duration minutes"),
      { target: { value: "20" } },
    );
    fireEvent.change(
      within(catalogVideos).getByLabelText("Maximum duration minutes"),
      { target: { value: "70" } },
    );

    expect(within(catalogVideos).getByText("Family Trip")).toBeInTheDocument();
    expect(
      within(catalogVideos).getByText("Archive Family Cut"),
    ).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Unavailable")).toBeInTheDocument();
    expect(
      within(catalogVideos).queryByText("Studio Clip"),
    ).not.toBeInTheDocument();
  });

  it("marks and unmarks a Video as Favorite from the Videos View", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    fireEvent.click(
      await within(catalogVideos).findByRole("button", {
        name: "Mark Family Trip as Favorite",
      }),
    );

    expect(mockedSetVideoFavorite).toHaveBeenCalledWith(1, true);
    await within(catalogVideos).findByRole("button", {
      name: "Unmark Family Trip as Favorite",
    });

    fireEvent.click(
      within(catalogVideos).getByRole("button", {
        name: "Unmark Family Trip as Favorite",
      }),
    );

    expect(mockedSetVideoFavorite).toHaveBeenCalledWith(1, false);
    await within(catalogVideos).findByRole("button", {
      name: "Mark Family Trip as Favorite",
    });
  });

  it("shows a Catalog Videos error when a Videos View Favorite update fails", async () => {
    mockedSetVideoFavorite.mockRejectedValue(new Error("Favorite unavailable"));
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    fireEvent.click(
      await within(catalogVideos).findByRole("button", {
        name: "Mark Family Trip as Favorite",
      }),
    );

    expect(
      await within(catalogVideos).findByText("Favorite unavailable"),
    ).toBeInTheDocument();
  });

  it("preserves current Video fields when a Favorite update resolves after another edit", async () => {
    const favoriteUpdate = deferredPromise<void>();
    mockedSetVideoFavorite.mockReturnValue(favoriteUpdate.promise);
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    fireEvent.click(
      await within(catalogVideos).findByRole("button", {
        name: "Family Trip",
      }),
    );
    fireEvent.click(
      within(catalogVideos).getByRole("button", {
        name: "Mark Family Trip as Favorite",
      }),
    );
    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });

    fireEvent.change(within(detailPanel).getByLabelText("Title"), {
      target: { value: "Family Archive" },
    });
    fireEvent.click(
      within(detailPanel).getByRole("button", { name: "Save Title" }),
    );
    await screen.findByRole("button", { name: "Family Archive" });

    favoriteUpdate.resolve(undefined);

    await within(catalogVideos).findByRole("button", {
      name: "Unmark Family Archive as Favorite",
    });
    expect(
      within(catalogVideos).queryByRole("button", { name: "Family Trip" }),
    ).not.toBeInTheDocument();
  });

  it("shows Favorites View as the same Video result model filtered to Favorite Videos", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: true,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
      {
        id: 2,
        title: "Studio Clip",
        durationMilliseconds: 120000,
        fileSizeBytes: 12000000,
        fileLocationPath: "/Volumes/Archive/Videos/studio-clip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    expect(
      await within(catalogVideos).findByText("Studio Clip"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Favorites View" }));

    expect(
      screen.getByRole("heading", { name: "Favorites View" }),
    ).toBeInTheDocument();
    expect(
      within(catalogVideos).getByLabelText("Favorites only"),
    ).toBeChecked();
    expect(within(catalogVideos).getByText("Family Trip")).toBeInTheDocument();
    expect(within(catalogVideos).getByText("1h 2m")).toBeInTheDocument();
    expect(
      within(catalogVideos).queryByText("Studio Clip"),
    ).not.toBeInTheDocument();
  });

  it("matches text search against the current filename without matching parent folders", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Mountain Ride",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/mountain-ride.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
      {
        id: 2,
        title: "Studio Clip",
        durationMilliseconds: 120000,
        fileSizeBytes: 12000000,
        fileLocationPath: "/Volumes/Current/Videos/archive-session.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });

    fireEvent.change(within(catalogVideos).getByLabelText("Search Videos"), {
      target: { value: "archive" },
    });

    expect(
      within(catalogVideos).queryByText("Mountain Ride"),
    ).not.toBeInTheDocument();
    expect(within(catalogVideos).getByText("Studio Clip")).toBeInTheDocument();
  });

  it("filters Catalog Videos by requiring every selected Tag and any selected Performer", async () => {
    mockedListTags.mockResolvedValue([
      { id: 4, name: "Travel" },
      { id: 5, name: "Family" },
    ]);
    mockedListPerformers.mockResolvedValue([
      { id: 9, name: "Blair" },
      { id: 10, name: "Alex" },
    ]);
    mockedTagsForVideo.mockImplementation(async (videoId) => {
      if (videoId === 1) {
        return [
          { id: 4, name: "Travel" },
          { id: 5, name: "Family" },
        ];
      }

      return [{ id: 4, name: "Travel" }];
    });
    mockedPerformersForVideo.mockImplementation(async (videoId) => {
      if (videoId === 1) {
        return [{ id: 9, name: "Blair" }];
      }

      return [{ id: 10, name: "Alex" }];
    });
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
      {
        id: 2,
        title: "Travel Clip",
        durationMilliseconds: 120000,
        fileSizeBytes: 12000000,
        fileLocationPath: "/Volumes/Archive/Videos/travel-clip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await waitFor(() => {
      expect(mockedTagsForVideo).toHaveBeenCalledWith(1);
      expect(mockedPerformersForVideo).toHaveBeenCalledWith(2);
    });

    fireEvent.click(within(catalogVideos).getByLabelText("Travel"));
    fireEvent.click(within(catalogVideos).getByLabelText("Family"));

    expect(within(catalogVideos).getByText("Family Trip")).toBeInTheDocument();
    expect(
      within(catalogVideos).queryByText("Travel Clip"),
    ).not.toBeInTheDocument();

    fireEvent.click(within(catalogVideos).getByLabelText("Alex"));

    expect(
      within(catalogVideos).queryByText("Family Trip"),
    ).not.toBeInTheDocument();
    expect(
      within(catalogVideos).queryByText("Travel Clip"),
    ).not.toBeInTheDocument();

    fireEvent.click(within(catalogVideos).getByLabelText("Blair"));

    expect(within(catalogVideos).getByText("Family Trip")).toBeInTheDocument();
    expect(
      within(catalogVideos).queryByText("Travel Clip"),
    ).not.toBeInTheDocument();
  });

  it("sorts Catalog Videos by File Size without adding File Size as a Search Filter", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Large Archive",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/large-archive.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
      {
        id: 2,
        title: "Small Clip",
        durationMilliseconds: 120000,
        fileSizeBytes: 12000000,
        fileLocationPath: "/Volumes/Archive/Videos/small-clip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    expect(
      within(catalogVideos).queryByLabelText("File Size"),
    ).not.toBeInTheDocument();

    fireEvent.change(within(catalogVideos).getByLabelText("Sort Videos"), {
      target: { value: "fileSizeAscending" },
    });

    const videoTitles = within(catalogVideos).getAllByRole("button", {
      name: /^(Large Archive|Small Clip)$/,
    });

    expect(videoTitles.map((titleButton) => titleButton.textContent)).toEqual([
      "Small Clip",
      "Large Archive",
    ]);
  });

  it("opens a Video from the app and refreshes Open History fields", async () => {
    mockedListCatalogVideos
      .mockResolvedValueOnce([
        {
          id: 1,
          title: "Family Trip",
          durationMilliseconds: 3723000,
          fileSizeBytes: 80740352,
          fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
          isAvailable: true,
          fileLocations: [],
          isFavorite: false,
          lastOpenedAt: null,
          openCount: 0,
          previewStrip: pendingPreviewStrip,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          title: "Family Trip",
          durationMilliseconds: 3723000,
          fileSizeBytes: 80740352,
          fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
          isAvailable: true,
          fileLocations: [],
          isFavorite: false,
          lastOpenedAt: "2026-05-15 18:00:00",
          openCount: 1,
          previewStrip: pendingPreviewStrip,
        },
      ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    fireEvent.click(
      within(catalogVideos).getByRole("button", {
        name: "Open Family Trip",
      }),
    );

    await waitFor(() => {
      expect(mockedOpenCatalogVideo).toHaveBeenCalledWith(1);
    });
    expect(
      await within(catalogVideos).findByText(/Opened 1 time/),
    ).toBeInTheDocument();
  });

  it("shows Recently Opened View ordered by recent Open History activity", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Older Clip",
        durationMilliseconds: 120000,
        fileSizeBytes: 12000000,
        fileLocationPath: "/Volumes/Archive/Videos/older-clip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: "2026-05-14 18:00:00",
        openCount: 5,
        previewStrip: pendingPreviewStrip,
      },
      {
        id: 2,
        title: "Fresh Clip",
        durationMilliseconds: 120000,
        fileSizeBytes: null,
        fileLocationPath: "/Volumes/Archive/Videos/fresh-clip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: "2026-05-15 18:00:00",
        openCount: 1,
        previewStrip: pendingPreviewStrip,
      },
      {
        id: 3,
        title: "Never Opened",
        durationMilliseconds: 120000,
        fileSizeBytes: 12000000,
        fileLocationPath: "/Volumes/Archive/Videos/never-opened.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    fireEvent.click(
      within(catalogVideos).getByRole("button", {
        name: "Recently Opened View",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Recently Opened View" }),
    ).toBeInTheDocument();
    expect(
      within(catalogVideos).queryByText("Never Opened"),
    ).not.toBeInTheDocument();
    const videoTitles = within(catalogVideos).getAllByRole("button", {
      name: /^(Older Clip|Fresh Clip)$/,
    });

    expect(videoTitles.map((titleButton) => titleButton.textContent)).toEqual([
      "Fresh Clip",
      "Older Clip",
    ]);
  });

  it("shows the actual Recently Opened sort order when another sort was selected", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Older Popular Clip",
        durationMilliseconds: 120000,
        fileSizeBytes: 12000000,
        fileLocationPath: "/Volumes/Archive/Videos/older-popular-clip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: "2026-05-14 18:00:00",
        openCount: 5,
        previewStrip: pendingPreviewStrip,
      },
      {
        id: 2,
        title: "Fresh Clip",
        durationMilliseconds: 120000,
        fileSizeBytes: 12000000,
        fileLocationPath: "/Volumes/Archive/Videos/fresh-clip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: "2026-05-15 18:00:00",
        openCount: 1,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    fireEvent.change(within(catalogVideos).getByLabelText("Sort Videos"), {
      target: { value: "openCountDescending" },
    });
    fireEvent.click(
      within(catalogVideos).getByRole("button", {
        name: "Recently Opened View",
      }),
    );

    const sortVideos = within(catalogVideos).getByLabelText("Sort Videos");
    expect(sortVideos).toHaveValue("lastOpenedDescending");
    expect(sortVideos).toBeDisabled();
  });

  it("keeps unknown File Sizes last when sorting by File Size descending", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Missing Size",
        durationMilliseconds: 3723000,
        fileSizeBytes: null,
        fileLocationPath: "/Volumes/Archive/Videos/missing-size.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
      {
        id: 2,
        title: "Large Archive",
        durationMilliseconds: 120000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/large-archive.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });

    fireEvent.change(within(catalogVideos).getByLabelText("Sort Videos"), {
      target: { value: "fileSizeDescending" },
    });

    const videoTitles = within(catalogVideos).getAllByRole("button", {
      name: /^(Large Archive|Missing Size)$/,
    });

    expect(videoTitles.map((titleButton) => titleButton.textContent)).toEqual([
      "Large Archive",
      "Missing Size",
    ]);
  });

  it("updates metadata filters after Tag edits in the Video Detail Panel", async () => {
    mockedListTags.mockResolvedValue([
      { id: 4, name: "Travel" },
      { id: 5, name: "Archive" },
    ]);
    mockedTagsForVideo.mockResolvedValue([{ id: 4, name: "Travel" }]);
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await waitFor(() => {
      expect(mockedTagsForVideo).toHaveBeenCalledWith(1);
    });
    fireEvent.click(await screen.findByRole("button", { name: "Family Trip" }));
    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });

    fireEvent.click(
      within(detailPanel).getByRole("button", { name: "Attach Archive" }),
    );
    await waitFor(() => {
      expect(mockedAttachTagToVideo).toHaveBeenCalledWith(5, 1);
    });
    fireEvent.click(within(catalogVideos).getByLabelText("Archive"));

    expect(within(catalogVideos).getByText("Family Trip")).toBeInTheDocument();
  });

  it("applies Batch Metadata Edit append and remove actions to selected Videos", async () => {
    mockedListTags.mockResolvedValue([
      { id: 4, name: "Travel" },
      { id: 5, name: "Archive" },
      { id: 7, name: "Unused" },
    ]);
    mockedListPerformers.mockResolvedValue([
      { id: 9, name: "Blair" },
      { id: 10, name: "Alex" },
    ]);
    mockedCreateTag.mockResolvedValue({ id: 6, name: "Road Trip" });
    mockedCreatePerformer.mockResolvedValue({ id: 11, name: "Casey" });
    mockedTagsForVideo.mockImplementation(async (videoId) => {
      if (videoId === 1) {
        return [{ id: 4, name: "Travel" }];
      }

      return [{ id: 5, name: "Archive" }];
    });
    mockedPerformersForVideo.mockResolvedValue([{ id: 9, name: "Blair" }]);
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        fileLocations: [],
        isAvailable: true,
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
      {
        id: 2,
        title: "City Walk",
        durationMilliseconds: 1800000,
        fileSizeBytes: 50740352,
        fileLocationPath: "/Volumes/Archive/Videos/city-walk.mp4",
        fileLocations: [],
        isAvailable: true,
        isFavorite: true,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    fireEvent.click(
      await within(catalogVideos).findByLabelText("Select Family Trip"),
    );
    fireEvent.click(within(catalogVideos).getByLabelText("Select City Walk"));

    const batchMetadataEdit = await screen.findByRole("region", {
      name: "Batch Metadata Edit",
    });

    expect(within(batchMetadataEdit).queryByLabelText("Title")).toBeNull();
    expect(
      within(batchMetadataEdit).queryByRole("button", {
        name: /Replace/,
      }),
    ).toBeNull();

    fireEvent.click(
      within(batchMetadataEdit).getByRole("button", {
        name: "Append Travel to selected Videos",
      }),
    );
    fireEvent.change(within(batchMetadataEdit).getByLabelText("New Tag"), {
      target: { value: "Road Trip" },
    });
    fireEvent.click(
      within(batchMetadataEdit).getByRole("button", {
        name: "Create and append Tag to selected Videos",
      }),
    );
    fireEvent.change(within(batchMetadataEdit).getByLabelText("New Performer"), {
      target: { value: "Casey" },
    });
    fireEvent.click(
      within(batchMetadataEdit).getByRole("button", {
        name: "Create and append Performer to selected Videos",
      }),
    );
    expect(
      within(batchMetadataEdit).queryByRole("button", {
        name: "Remove Unused from selected Videos",
      }),
    ).toBeNull();
    expect(
      within(batchMetadataEdit).queryByRole("button", {
        name: "Remove Alex from selected Videos",
      }),
    ).toBeNull();
    fireEvent.click(
      within(batchMetadataEdit).getByRole("button", {
        name: "Remove Blair from selected Videos",
      }),
    );
    fireEvent.click(
      within(batchMetadataEdit).getByRole("button", {
        name: "Mark selected Videos as Favorite",
      }),
    );
    fireEvent.click(
      within(batchMetadataEdit).getByRole("button", {
        name: "Unmark selected Videos as Favorite",
      }),
    );

    await waitFor(() => {
      expect(mockedAttachTagToVideo).toHaveBeenCalledWith(4, 1);
      expect(mockedAttachTagToVideo).toHaveBeenCalledWith(4, 2);
    });
    expect(mockedCreateTag).toHaveBeenCalledWith("Road Trip");
    expect(mockedAttachTagToVideo).toHaveBeenCalledWith(6, 1);
    expect(mockedAttachTagToVideo).toHaveBeenCalledWith(6, 2);
    expect(mockedCreatePerformer).toHaveBeenCalledWith("Casey");
    expect(mockedAttachPerformerToVideo).toHaveBeenCalledWith(11, 1);
    expect(mockedAttachPerformerToVideo).toHaveBeenCalledWith(11, 2);
    expect(mockedDetachPerformerFromVideo).toHaveBeenCalledWith(9, 1);
    expect(mockedDetachPerformerFromVideo).toHaveBeenCalledWith(9, 2);
    expect(mockedSetVideoFavorite).toHaveBeenCalledWith(1, true);
    expect(mockedSetVideoFavorite).toHaveBeenCalledWith(2, true);
    expect(mockedSetVideoFavorite).toHaveBeenCalledWith(1, false);
    expect(mockedSetVideoFavorite).toHaveBeenCalledWith(2, false);
    expect(mockedUpdateVideoTitle).not.toHaveBeenCalled();
  });

  it("keeps the Video Detail Panel current after Batch Metadata Edit touches the selected Video", async () => {
    mockedListTags.mockResolvedValue([
      { id: 4, name: "Travel" },
      { id: 5, name: "Archive" },
    ]);
    mockedListPerformers.mockResolvedValue([
      { id: 9, name: "Blair" },
      { id: 10, name: "Alex" },
    ]);
    mockedTagsForVideo.mockResolvedValue([{ id: 4, name: "Travel" }]);
    mockedPerformersForVideo.mockResolvedValue([{ id: 9, name: "Blair" }]);
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        fileLocations: [],
        isAvailable: true,
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    fireEvent.click(await screen.findByRole("button", { name: "Family Trip" }));
    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    fireEvent.click(within(catalogVideos).getByLabelText("Select Family Trip"));
    const batchMetadataEdit = await screen.findByRole("region", {
      name: "Batch Metadata Edit",
    });

    fireEvent.click(
      within(batchMetadataEdit).getByRole("button", {
        name: "Append Archive to selected Videos",
      }),
    );
    await within(detailPanel).findByRole("button", {
      name: "Remove Archive",
    });

    fireEvent.click(
      within(batchMetadataEdit).getByRole("button", {
        name: "Remove Travel from selected Videos",
      }),
    );
    await within(detailPanel).findByRole("button", {
      name: "Attach Travel",
    });
  });

  it("opens a Video Detail Panel for metadata editing without renaming File Locations", async () => {
    mockedListTags.mockResolvedValue([
      { id: 4, name: "Travel" },
      { id: 5, name: "Archive" },
    ]);
    mockedListPerformers.mockResolvedValue([
      { id: 9, name: "Blair" },
      { id: 10, name: "Alex" },
    ]);
    mockedTagsForVideo.mockResolvedValue([{ id: 4, name: "Travel" }]);
    mockedPerformersForVideo.mockResolvedValue([{ id: 9, name: "Blair" }]);
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        fileLocations: [
          {
            path: "/Volumes/Archive/Videos/family-trip.mp4",
            fileSizeBytes: 80740352,
            isPreferred: true,
          },
          {
            path: "/Volumes/Backup/Videos/family-trip.mp4",
            fileSizeBytes: 80740352,
            isPreferred: false,
          },
        ],
        isAvailable: true,
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Family Trip" }));

    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    expect(
      within(detailPanel).getByDisplayValue("Family Trip"),
    ).toBeInTheDocument();
    expect(within(detailPanel).getByText("1h 2m")).toBeInTheDocument();
    expect(
      within(detailPanel).getAllByText("80.7 MB").length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      within(detailPanel).getByText("/Volumes/Archive/Videos/family-trip.mp4"),
    ).toBeInTheDocument();
    expect(
      within(detailPanel).getByText("/Volumes/Backup/Videos/family-trip.mp4"),
    ).toBeInTheDocument();
    expect(
      within(detailPanel).getByText("Preferred File Location"),
    ).toBeInTheDocument();

    fireEvent.change(within(detailPanel).getByLabelText("Title"), {
      target: { value: "Family Archive" },
    });
    fireEvent.click(
      within(detailPanel).getByRole("button", { name: "Save Title" }),
    );
    fireEvent.click(within(detailPanel).getByLabelText("Favorite"));
    fireEvent.click(
      within(detailPanel).getByRole("button", { name: "Attach Archive" }),
    );
    fireEvent.click(
      within(detailPanel).getByRole("button", { name: "Remove Travel" }),
    );
    fireEvent.click(
      within(detailPanel).getByRole("button", { name: "Attach Alex" }),
    );
    fireEvent.click(
      within(detailPanel).getByRole("button", { name: "Remove Blair" }),
    );

    await waitFor(() => {
      expect(mockedUpdateVideoTitle).toHaveBeenCalledWith(1, "Family Archive");
    });
    expect(mockedSetVideoFavorite).toHaveBeenCalledWith(1, true);
    expect(mockedAttachTagToVideo).toHaveBeenCalledWith(5, 1);
    expect(mockedDetachTagFromVideo).toHaveBeenCalledWith(4, 1);
    expect(mockedAttachPerformerToVideo).toHaveBeenCalledWith(10, 1);
    expect(mockedDetachPerformerFromVideo).toHaveBeenCalledWith(9, 1);
    expect(mockedListCatalogVideos).not.toHaveBeenCalledWith(
      expect.stringContaining("Family Archive"),
    );
  });

  it("creates new Tags and Performers inline while editing a Video", async () => {
    mockedListTags.mockResolvedValue([
      { id: 4, name: "Travel" },
      { id: 6, name: "Road Trip" },
    ]);
    mockedListPerformers.mockResolvedValue([
      { id: 9, name: "Blair" },
      { id: 11, name: "Casey Jones" },
    ]);
    mockedCreateTag.mockResolvedValue({ id: 5, name: "Trip" });
    mockedCreatePerformer.mockResolvedValue({ id: 10, name: "Casey" });
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        fileLocations: [],
        isAvailable: true,
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Family Trip" }));
    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });

    fireEvent.change(within(detailPanel).getByLabelText("New Tag"), {
      target: { value: "Trip" },
    });
    expect(
      within(detailPanel).getByText("Near match: Road Trip"),
    ).toBeInTheDocument();
    fireEvent.click(
      within(detailPanel).getByRole("button", {
        name: "Create and attach Tag",
      }),
    );

    fireEvent.change(within(detailPanel).getByLabelText("New Performer"), {
      target: { value: "Casey" },
    });
    expect(
      within(detailPanel).getByText("Near match: Casey Jones"),
    ).toBeInTheDocument();
    fireEvent.click(
      within(detailPanel).getByRole("button", {
        name: "Create and attach Performer",
      }),
    );

    await waitFor(() => {
      expect(mockedCreateTag).toHaveBeenCalledWith("Trip");
    });
    expect(mockedAttachTagToVideo).toHaveBeenCalledWith(5, 1);
    expect(mockedCreatePerformer).toHaveBeenCalledWith("Casey");
    expect(mockedAttachPerformerToVideo).toHaveBeenCalledWith(10, 1);
  });

  it("does not surface unrelated metadata as a near match", async () => {
    mockedListTags.mockResolvedValue([{ id: 4, name: "Travel" }]);
    mockedListPerformers.mockResolvedValue([]);
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        fileLocations: [],
        isAvailable: true,
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Family Trip" }));
    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });

    fireEvent.change(within(detailPanel).getByLabelText("New Tag"), {
      target: { value: "Road Trip" },
    });

    expect(
      within(detailPanel).queryByText(/Near match:/),
    ).not.toBeInTheDocument();
  });

  it("reuses case-insensitive Tag and Performer matches instead of creating duplicates", async () => {
    mockedListTags.mockResolvedValue([{ id: 4, name: "Travel" }]);
    mockedListPerformers.mockResolvedValue([{ id: 9, name: "Blair" }]);
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        fileLocations: [],
        isAvailable: true,
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Family Trip" }));
    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });

    fireEvent.change(within(detailPanel).getByLabelText("New Tag"), {
      target: { value: " travel " },
    });
    fireEvent.click(
      within(detailPanel).getByRole("button", { name: "Attach existing Tag" }),
    );
    fireEvent.change(within(detailPanel).getByLabelText("New Performer"), {
      target: { value: "BLAIR" },
    });
    fireEvent.click(
      within(detailPanel).getByRole("button", {
        name: "Attach existing Performer",
      }),
    );

    await waitFor(() => {
      expect(mockedAttachTagToVideo).toHaveBeenCalledWith(4, 1);
    });
    expect(mockedAttachPerformerToVideo).toHaveBeenCalledWith(9, 1);
    expect(mockedCreateTag).not.toHaveBeenCalled();
    expect(mockedCreatePerformer).not.toHaveBeenCalled();
  });

  it("shows already-attached metadata as unavailable for inline attachment", async () => {
    mockedListTags.mockResolvedValue([{ id: 5, name: "Road Trip" }]);
    mockedListPerformers.mockResolvedValue([{ id: 10, name: "Casey" }]);
    mockedTagsForVideo.mockResolvedValue([{ id: 5, name: "Road Trip" }]);
    mockedPerformersForVideo.mockResolvedValue([{ id: 10, name: "Casey" }]);
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        fileLocations: [],
        isAvailable: true,
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Family Trip" }));
    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });

    fireEvent.change(within(detailPanel).getByLabelText("New Tag"), {
      target: { value: "Road Trip" },
    });
    expect(
      within(detailPanel).getByRole("button", { name: "Tag already attached" }),
    ).toBeDisabled();

    fireEvent.change(within(detailPanel).getByLabelText("New Performer"), {
      target: { value: "Casey" },
    });
    expect(
      within(detailPanel).getByRole("button", {
        name: "Performer already attached",
      }),
    ).toBeDisabled();
    expect(mockedCreateTag).not.toHaveBeenCalled();
    expect(mockedCreatePerformer).not.toHaveBeenCalled();
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
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });

    expect(
      await within(catalogVideos).findByText("Family Trip"),
    ).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Unavailable")).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Missing")).toBeInTheDocument();
  });

  it("shows an empty state when the Catalog has no Videos", async () => {
    renderApp();

    expect(
      await screen.findByText("No Videos in the Catalog."),
    ).toBeInTheDocument();
  });

  it("shows loading and error states for Catalog Videos", async () => {
    mockedListCatalogVideos.mockRejectedValue(new Error("Catalog unavailable"));

    renderApp();

    expect(screen.getByText("Loading Videos...")).toBeInTheDocument();
    expect(await screen.findByText("Videos unavailable")).toBeInTheDocument();
  });

  it("leaves queued Preview Strips paused until the user resumes the queue", async () => {
    mockedGetPreviewStripQueueStatus.mockResolvedValue({
      pendingCount: 1,
      runningCount: 0,
      runningVideoId: null,
      failedCount: 0,
      isPaused: true,
    });
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    expect(await screen.findByText("1 pending")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resume Preview Queue" }),
    ).toBeInTheDocument();
    expect(mockedProcessNextPreviewStripQueueItem).not.toHaveBeenCalled();
  });

  it("does not show a separate batch generation command", async () => {
    renderApp();

    expect(
      screen.queryByRole("button", { name: "Generate Preview Strips" }),
    ).not.toBeInTheDocument();
  });

  it("shows Preview Strip queue status and supports global pause and resume", async () => {
    mockedGetPreviewStripQueueStatus.mockResolvedValue({
      pendingCount: 3,
      runningCount: 1,
      runningVideoId: 1,
      failedCount: 1,
      isPaused: false,
    });
    mockedProcessNextPreviewStripQueueItem.mockResolvedValue({
      pendingCount: 3,
      runningCount: 1,
      runningVideoId: 1,
      failedCount: 1,
      isPaused: false,
    });

    renderApp();

    expect(await screen.findByText("3 pending")).toBeInTheDocument();
    expect(screen.getByText("1 running")).toBeInTheDocument();
    expect(screen.getByText("1 failed")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Pause Preview Queue" }),
    );

    expect(mockedPausePreviewStripQueue).toHaveBeenCalled();
    expect(await screen.findByText("Paused")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Resume Preview Queue" }),
    );

    expect(mockedResumePreviewStripQueue).toHaveBeenCalled();
    expect(await screen.findByText("Running")).toBeInTheDocument();
  });

  it("shows the Video whose Preview Strip is generating", async () => {
    mockedGetPreviewStripQueueStatus.mockResolvedValue({
      pendingCount: 2,
      runningCount: 1,
      runningVideoId: 1,
      failedCount: 0,
      isPaused: false,
    });
    mockedProcessNextPreviewStripQueueItem.mockResolvedValue({
      pendingCount: 1,
      runningCount: 0,
      runningVideoId: null,
      failedCount: 0,
      isPaused: false,
    });
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
      {
        id: 2,
        title: "City Walk",
        durationMilliseconds: 1800000,
        fileSizeBytes: 50740352,
        fileLocationPath: "/Volumes/Archive/Videos/city-walk.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    expect(
      await screen.findByText("Generating Preview Strip"),
    ).toBeInTheDocument();
    expect(screen.getByText("Pending Preview Strip")).toBeInTheDocument();
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
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: {
          status: "generated",
          path: "/Users/michel/Library/Caches/preview-strips/video-1-preview-strip.jpg",
          frameCount: 40,
          columnCount: 5,
          rowCount: 8,
        },
      },
    ]);

    renderApp();

    const previewStrip = await screen.findByRole("img", {
      name: "Preview Strip for Family Trip",
    });

    expect(mockedConvertFileSrc).toHaveBeenCalledWith(
      "/Users/michel/Library/Caches/preview-strips/video-1-preview-strip.jpg",
    );
    expect(previewStrip).toHaveStyle({
      backgroundImage:
        "url(asset:///Users/michel/Library/Caches/preview-strips/video-1-preview-strip.jpg)",
      backgroundPosition: "0% 0%",
    });

    Object.defineProperty(previewStrip, "clientWidth", {
      configurable: true,
      value: 500,
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
          toJSON: () => ({}),
        }) as DOMRect,
    );

    fireEvent(
      previewStrip,
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: 250,
      }),
    );

    expect(previewStrip).toHaveStyle({
      backgroundPosition: "0% 57.14285714285714%",
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
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: {
          status: "pending",
        },
      },
      {
        id: 2,
        title: "Failed Trip",
        durationMilliseconds: 60000,
        fileSizeBytes: 2000000,
        fileLocationPath: "/Volumes/Archive/Videos/failed-trip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: {
          status: "failed",
          failureReason: "ffmpeg failed",
        },
      },
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });

    expect(within(catalogVideos).getByText("Pending Trip")).toBeInTheDocument();
    expect(
      within(catalogVideos).getByText("Pending Preview Strip"),
    ).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Failed Trip")).toBeInTheDocument();
    expect(
      within(catalogVideos).getByText("Failed Preview Strip"),
    ).toBeInTheDocument();
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
      name: "Choose folder",
    });
    const manualPathInput = screen.getByLabelText("Manual path");
    const availableBadge = screen.getAllByText("Available")[0];

    expect(chooseFolderButton).toBeVisible();
    expect(manualPathInput).toBeVisible();
    expect(availableBadge).toBeVisible();
    expect(document.documentElement).toHaveAttribute(
      "data-mantine-color-scheme",
      "dark",
    );
  });

  it("shows a clear status when FFmpeg tools are missing", async () => {
    mockedGetFfmpegToolsStatus.mockResolvedValue({
      ...availableFfmpegToolsStatus,
      ffmpeg: {
        binaryName: "ffmpeg",
        isAvailable: false,
        resolvedPath: null,
        statusMessage: "ffmpeg is not available from PATH or settings",
      },
    });

    renderApp();

    expect(
      await screen.findByText("ffmpeg is not available from PATH or settings"),
    ).toBeInTheDocument();
    expect(screen.getByText("Missing")).toBeInTheDocument();
  });

  it("loads persisted Scan Roots into the app", async () => {
    mockedListScanRoots.mockResolvedValue([
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        path: "/Volumes/Archive/Videos",
      },
    ]);

    renderApp();

    expect(
      await screen.findByText("/Volumes/Archive/Videos"),
    ).toBeInTheDocument();
  });

  it("shows Scan Root Inference Rules with their safe defaults", async () => {
    mockedListScanRoots.mockResolvedValue([
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        path: "/Volumes/Archive/Videos",
      },
    ]);

    renderApp();

    const scanRoots = await screen.findByLabelText("Scan Roots");

    expect(within(scanRoots).getByText("Tags from child folders")).toBeInTheDocument();
    expect(within(scanRoots).getByText("Performers not inferred")).toBeInTheDocument();
    expect(
      within(scanRoots).getByText("Ignored names: Misc, Unsorted, To Sort, To Review, New, Temp, Archive, Archives, Downloads, Videos"),
    ).toBeInTheDocument();
    expect(within(scanRoots).getByText("Ignored years: 1900-2099")).toBeInTheDocument();
  });

  it("saves changed Scan Root Inference Rules", async () => {
    mockedListScanRoots.mockResolvedValue([
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        path: "/Volumes/Archive/Videos",
      },
    ]);

    renderApp();

    fireEvent.change(await screen.findByLabelText("Ignored folder names"), {
      target: { value: "Misc, Extras" },
    });
    fireEvent.change(screen.getByLabelText("Ignored year start"), {
      target: { value: "1980" },
    });
    fireEvent.click(screen.getByLabelText("Suggest Tags"));
    fireEvent.click(screen.getByRole("button", { name: "Save Inference Rules" }));

    await waitFor(() => {
      expect(mockedUpdateScanRootInferenceRules).toHaveBeenCalledWith(
        "/Volumes/Archive/Videos",
        {
          ignoredExactYearRange: {
            endYear: 2099,
            startYear: 1980,
          },
          ignoredFolderNames: ["Misc", "Extras"],
          suggestPerformersFromChildFolders: false,
          suggestTagsFromChildFolders: false,
        },
      );
    });
  });

  it("adds a Scan Root through the folder picker and scans it", async () => {
    mockedOpen.mockResolvedValue("/Volumes/Archive/Videos");
    mockedRefreshScanRoot.mockResolvedValue({
      scannedVideoCount: 2,
      unprocessableCandidateCount: 1,
    });

    renderApp();

    fireEvent.click(
      await screen.findByRole("button", { name: "Choose folder" }),
    );

    expect(mockedOpen).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
    });
    await waitFor(() => {
      expect(mockedAddScanRoot).toHaveBeenCalledWith("/Volumes/Archive/Videos");
    });
    expect(mockedRefreshScanRoot).toHaveBeenCalledWith(
      "/Volumes/Archive/Videos",
    );
    expect(
      await screen.findByText("/Volumes/Archive/Videos"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        "2 Videos scanned, 1 Unprocessable Video Candidates",
      ),
    ).toBeInTheDocument();
  });

  it("shows a clear message when the folder picker cannot open", async () => {
    mockedOpen.mockRejectedValue(new Error("dialog open permission denied"));

    renderApp();

    fireEvent.click(
      await screen.findByRole("button", { name: "Choose folder" }),
    );

    expect(
      await screen.findByText("dialog open permission denied"),
    ).toBeInTheDocument();
    expect(mockedAddScanRoot).not.toHaveBeenCalled();
  });

  it("shows a clear message when a Scan Root overlaps an existing root", async () => {
    mockedOpen.mockResolvedValue("/Volumes/Archive/Videos/Family");
    mockedAddScanRoot.mockRejectedValue(
      new Error("Scan Root overlaps with an existing Scan Root"),
    );

    renderApp();

    fireEvent.click(
      await screen.findByRole("button", { name: "Choose folder" }),
    );

    expect(
      await screen.findByText("Scan Root overlaps with an existing Scan Root"),
    ).toBeInTheDocument();
  });

  it("asks how to handle affected Videos before removing a Scan Root", async () => {
    mockedListScanRoots.mockResolvedValue([
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        path: "/Volumes/Archive/Videos",
      },
    ]);

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Preserve as Missing Videos" }),
    );

    expect(mockedRemoveScanRoot).toHaveBeenCalledWith(
      "/Volumes/Archive/Videos",
      "preserveMissingVideos",
    );
  });

  it("refreshes a selected Scan Root and shows the Catalog summary", async () => {
    mockedListScanRoots.mockResolvedValue([
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        path: "/Volumes/Archive/Videos",
      },
    ]);
    mockedRefreshScanRoot.mockResolvedValue({
      scannedVideoCount: 2,
      unprocessableCandidateCount: 1,
    });
    mockedListCatalogVideos.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Refresh" }));

    expect(mockedRefreshScanRoot).toHaveBeenCalledWith(
      "/Volumes/Archive/Videos",
    );
    expect(
      await screen.findByText(
        "2 Videos scanned, 1 Unprocessable Video Candidates",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText("Family Trip")).toBeInTheDocument();
  });

  it("refreshes all Scan Roots and reloads availability", async () => {
    mockedListScanRoots
      .mockResolvedValueOnce([
        {
          inferenceRules: defaultInferenceRules,
          isAvailable: true,
          path: "/Volumes/Archive/Videos",
        },
      ])
      .mockResolvedValueOnce([
        {
          inferenceRules: defaultInferenceRules,
          isAvailable: false,
          path: "/Volumes/Archive/Videos",
        },
      ]);

    renderApp();

    fireEvent.click(
      await screen.findByRole("button", { name: "Refresh all Scan Roots" }),
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
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
      {
        id: 2,
        title: "Available Trip",
        durationMilliseconds: 120000,
        fileSizeBytes: 1024,
        fileLocationPath: "/Volumes/Archive/Videos/available-trip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);
    mockedListScanRoots.mockResolvedValue([
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: false,
        path: "/Volumes/Missing/Videos",
      },
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        path: "/Volumes/Archive/Videos",
      },
    ]);
    mockedListUnprocessableVideoCandidates.mockResolvedValue([
      {
        path: "/Volumes/Archive/Videos/broken.mkv",
        reason: "missing moov atom",
        fileSizeBytes: 2048,
      },
    ]);

    renderApp();

    const reviewQueue = await screen.findByRole("region", {
      name: "Review Queue",
    });
    expect(
      within(reviewQueue).getByRole("heading", { name: "Review Queue" }),
    ).toBeInTheDocument();
    expect(
      within(reviewQueue).getByRole("heading", { name: "Missing Videos" }),
    ).toBeInTheDocument();
    expect(await within(reviewQueue).findByText("Family Trip")).toBeInTheDocument();
    expect(
      within(reviewQueue).queryByText("Available Trip"),
    ).not.toBeInTheDocument();
    expect(
      within(reviewQueue).getByText("/Volumes/Missing/Videos"),
    ).toBeInTheDocument();
    expect(
      within(reviewQueue).getByText("/Volumes/Archive/Videos/broken.mkv"),
    ).toBeInTheDocument();
    expect(
      within(reviewQueue).getByText("missing moov atom"),
    ).toBeInTheDocument();
  });

  it("lists Failed Preview Strips in the Review Queue with retry and ignore actions", async () => {
    mockedListFailedPreviewStrips
      .mockResolvedValueOnce([
        {
          videoId: 7,
          title: "Broken Trip",
          failureReason: "ffmpeg failed",
        },
      ])
      .mockResolvedValueOnce([
        {
          videoId: 7,
          title: "Broken Trip",
          failureReason: "ffmpeg failed",
        },
      ])
      .mockResolvedValueOnce([]);

    renderApp();

    const reviewQueue = await screen.findByRole("region", {
      name: "Review Queue",
    });
    expect(
      within(reviewQueue).getByRole("heading", {
        name: "Failed Preview Strips",
      }),
    ).toBeInTheDocument();
    expect(within(reviewQueue).getByText("Broken Trip")).toBeInTheDocument();
    expect(within(reviewQueue).getByText("ffmpeg failed")).toBeInTheDocument();

    fireEvent.click(
      within(reviewQueue).getByRole("button", {
        name: "Retry Failed Preview Strip for Broken Trip",
      }),
    );
    await waitFor(() => {
      expect(mockedRetryFailedPreviewStrip).toHaveBeenCalledWith(7);
    });
    expect(mockedGetPreviewStripQueueStatus).toHaveBeenCalled();

    fireEvent.click(
      within(reviewQueue).getByRole("button", {
        name: "Ignore Failed Preview Strip for Broken Trip",
      }),
    );
    await waitFor(() => {
      expect(mockedIgnoreFailedPreviewStrip).toHaveBeenCalledWith(7);
    });
    expect(
      within(reviewQueue).queryByText("Broken Trip"),
    ).not.toBeInTheDocument();
  });

  it("refreshes Failed Preview Strips after Preview Strip generation fails", async () => {
    mockedGetPreviewStripQueueStatus
      .mockResolvedValueOnce({
        pendingCount: 1,
        runningCount: 0,
        runningVideoId: null,
        failedCount: 0,
        isPaused: false,
      })
      .mockResolvedValue({
        pendingCount: 0,
        runningCount: 0,
        runningVideoId: null,
        failedCount: 1,
        isPaused: false,
      });
    mockedProcessNextPreviewStripQueueItem.mockResolvedValue({
      pendingCount: 1,
      runningCount: 1,
      runningVideoId: 7,
      failedCount: 0,
      isPaused: false,
    });
    mockedListFailedPreviewStrips.mockResolvedValueOnce([]).mockResolvedValue([
      {
        videoId: 7,
        title: "Broken Trip",
        failureReason: "ffmpeg failed",
      },
    ]);

    renderApp();

    const reviewQueue = await screen.findByRole("region", {
      name: "Review Queue",
    });
    expect(
      await within(reviewQueue).findByText("Broken Trip"),
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
          fileLocations: [],
          isFavorite: false,
          lastOpenedAt: null,
          openCount: 0,
          previewStrip: pendingPreviewStrip,
        },
      ])
      .mockResolvedValueOnce([]);

    renderApp();

    fireEvent.click(
      await screen.findByRole("button", { name: "Forget From Catalog" }),
    );

    expect(mockedForgetCatalogVideo).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Forget Missing Video" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Confirm Forget From Catalog" }),
    );

    await waitFor(() => {
      expect(mockedForgetCatalogVideo).toHaveBeenCalledWith(1);
    });
    expect(screen.queryByText("Family Trip")).not.toBeInTheDocument();
  });
});
