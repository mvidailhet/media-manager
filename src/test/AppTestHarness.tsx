import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { vi } from "vitest";

import App from "../App";
import { AppProviders } from "../AppProviders";
import {
  acceptMetadataSuggestionForVideos,
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
  listMetadataSuggestionGroups,
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
  rejectMetadataSuggestionSource,
  retryFailedPreviewStrip,
  saveFfmpegConfiguration,
  setVideoFavorite,
  openCatalogVideoContainingFolder,
  openCatalogVideo,
  tagsForVideo,
  updateScanRootInferenceRules,
  updateVideoTitle,
} from "../tauriCommands";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}));

vi.mock("../tauriCommands", () => ({
  acceptMetadataSuggestionForVideos: vi.fn(),
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
  listMetadataSuggestionGroups: vi.fn(),
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
  rejectMetadataSuggestionSource: vi.fn(),
  retryFailedPreviewStrip: vi.fn(),
  saveFfmpegConfiguration: vi.fn(),
  setVideoFavorite: vi.fn(),
  openCatalogVideoContainingFolder: vi.fn(),
  openCatalogVideo: vi.fn(),
  tagsForVideo: vi.fn(),
  updateScanRootInferenceRules: vi.fn(),
  updateVideoTitle: vi.fn(),
}));

export const mockedOpen = vi.mocked(open);
export const mockedConvertFileSrc = vi.mocked(convertFileSrc);
export const mockedGetLocalDesktopAppStatus = vi.mocked(getLocalDesktopAppStatus);
export const mockedGetFfmpegToolsStatus = vi.mocked(getFfmpegToolsStatus);
export const mockedSaveFfmpegConfiguration = vi.mocked(saveFfmpegConfiguration);
export const mockedListFailedPreviewStrips = vi.mocked(listFailedPreviewStrips);
export const mockedListMetadataSuggestionGroups = vi.mocked(
  listMetadataSuggestionGroups,
);
export const mockedAcceptMetadataSuggestionForVideos = vi.mocked(
  acceptMetadataSuggestionForVideos,
);
export const mockedRejectMetadataSuggestionSource = vi.mocked(
  rejectMetadataSuggestionSource,
);
export const mockedListTags = vi.mocked(listTags);
export const mockedListPerformers = vi.mocked(listPerformers);
export const mockedTagsForVideo = vi.mocked(tagsForVideo);
export const mockedPerformersForVideo = vi.mocked(performersForVideo);
export const mockedAttachTagToVideo = vi.mocked(attachTagToVideo);
export const mockedDetachTagFromVideo = vi.mocked(detachTagFromVideo);
export const mockedAttachPerformerToVideo = vi.mocked(attachPerformerToVideo);
export const mockedDetachPerformerFromVideo = vi.mocked(detachPerformerFromVideo);
export const mockedCreateTag = vi.mocked(createTag);
export const mockedCreatePerformer = vi.mocked(createPerformer);
export const mockedUpdateVideoTitle = vi.mocked(updateVideoTitle);
export const mockedSetVideoFavorite = vi.mocked(setVideoFavorite);
export const mockedOpenCatalogVideoContainingFolder = vi.mocked(
  openCatalogVideoContainingFolder,
);
export const mockedOpenCatalogVideo = vi.mocked(openCatalogVideo);
export const mockedRetryFailedPreviewStrip = vi.mocked(retryFailedPreviewStrip);
export const mockedIgnoreFailedPreviewStrip = vi.mocked(ignoreFailedPreviewStrip);
export const mockedListCatalogVideos = vi.mocked(listCatalogVideos);
export const mockedListUnprocessableVideoCandidates = vi.mocked(
  listUnprocessableVideoCandidates,
);
export const mockedListScanRoots = vi.mocked(listScanRoots);
export const mockedAddScanRoot = vi.mocked(addScanRoot);
export const mockedForgetCatalogVideo = vi.mocked(forgetCatalogVideo);
export const mockedGetPreviewStripQueueStatus = vi.mocked(getPreviewStripQueueStatus);
export const mockedPausePreviewStripQueue = vi.mocked(pausePreviewStripQueue);
export const mockedProcessNextPreviewStripQueueItem = vi.mocked(
  processNextPreviewStripQueueItem,
);
export const mockedRemoveScanRoot = vi.mocked(removeScanRoot);
export const mockedResumePreviewStripQueue = vi.mocked(resumePreviewStripQueue);
export const mockedRefreshAllScanRoots = vi.mocked(refreshAllScanRoots);
export const mockedRefreshScanRoot = vi.mocked(refreshScanRoot);
export const mockedUpdateScanRootInferenceRules = vi.mocked(
  updateScanRootInferenceRules,
);

export const availableFfmpegToolsStatus = {
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

export const pendingPreviewStrip = {
  status: "pending" as const,
};

export const defaultInferenceRules = {
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
  suggestTagsFromChildFolders: true,
};

export function deferredPromise<T>() {
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

export function renderApp() {
  return render(
    <AppProviders>
      <App />
    </AppProviders>,
  );
}

export async function openScanModule() {
  fireEvent.click(await screen.findByRole("button", { name: "Scan" }));
}

export async function openSettingsModule() {
  fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
}

export async function openMetadataSuggestionsView() {
  fireEvent.click(
    await screen.findByRole("tab", { name: "Metadata Suggestions" }),
  );
}

export async function openScanIssuesTab() {
  await openScanModule();
  fireEvent.click(await screen.findByRole("tab", { name: /Scan Issues/ }));
}

export async function openPreviewGenerationTab() {
  await openScanModule();
  fireEvent.click(
    await screen.findByRole("tab", { name: /Preview Generation/ }),
  );
}

export function resetAppTestHarness() {
    vi.clearAllMocks();
    mockedGetLocalDesktopAppStatus.mockResolvedValue("Rust command online");
    mockedGetFfmpegToolsStatus.mockResolvedValue(availableFfmpegToolsStatus);
    mockedSaveFfmpegConfiguration.mockResolvedValue(availableFfmpegToolsStatus);
    mockedListFailedPreviewStrips.mockResolvedValue([]);
    mockedListMetadataSuggestionGroups.mockResolvedValue([]);
    mockedAcceptMetadataSuggestionForVideos.mockResolvedValue(undefined);
    mockedRejectMetadataSuggestionSource.mockResolvedValue(undefined);
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
    mockedOpenCatalogVideoContainingFolder.mockResolvedValue(undefined);
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
}
