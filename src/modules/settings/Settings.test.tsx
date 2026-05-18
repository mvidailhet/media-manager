import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockedOpen,
  mockedConvertFileSrc,
  mockedGetLocalDesktopAppStatus,
  mockedGetFfmpegToolsStatus,
  mockedSaveFfmpegConfiguration,
  mockedListFailedPreviewStrips,
  mockedListMetadataSuggestionGroups,
  mockedAcceptMetadataSuggestionForVideos,
  mockedRejectMetadataSuggestionSource,
  mockedListTags,
  mockedListPerformers,
  mockedTagsForVideo,
  mockedPerformersForVideo,
  mockedAttachTagToVideo,
  mockedDetachTagFromVideo,
  mockedAttachPerformerToVideo,
  mockedDetachPerformerFromVideo,
  mockedCreateTag,
  mockedCreatePerformer,
  mockedUpdateVideoTitle,
  mockedSetVideoFavorite,
  mockedOpenCatalogVideo,
  mockedRetryFailedPreviewStrip,
  mockedIgnoreFailedPreviewStrip,
  mockedListCatalogVideos,
  mockedListScanRoots,
  mockedAddScanRoot,
  mockedForgetCatalogVideo,
  mockedGetPreviewStripQueueStatus,
  mockedPausePreviewStripQueue,
  mockedProcessNextPreviewStripQueueItem,
  mockedRemoveScanRoot,
  mockedResumePreviewStripQueue,
  mockedUpdateScanRootInferenceRules,
  availableFfmpegToolsStatus,
  pendingPreviewStrip,
  defaultInferenceRules,
  deferredPromise,
  renderApp,
  resetAppTestHarness,
  openScanModule,
  openSettingsModule,
  openMetadataSuggestionsView,
  openScanIssuesTab,
  openPreviewGenerationTab,
} from "../../test/AppTestHarness";

describe("Settings module", () => {
  beforeEach(resetAppTestHarness);
  it("shows FFmpeg and ffprobe availability in the app status", async () => {
    renderApp();

    await openSettingsModule();

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
        statusMessage: "ffmpeg is not available from PATH or settings",
      },
    });

    renderApp();

    await openSettingsModule();

    expect(
      await screen.findByText("ffmpeg is not available from PATH or settings"),
    ).toBeInTheDocument();
    expect(screen.getByText("Missing")).toBeInTheDocument();
  });

  it("shows Settings attention when the bridge or FFmpeg tools need attention", async () => {
    mockedGetLocalDesktopAppStatus.mockRejectedValue(
      new Error("bridge unavailable"),
    );
    mockedGetFfmpegToolsStatus.mockResolvedValue({
      ...availableFfmpegToolsStatus,
      ffprobe: {
        binaryName: "ffprobe",
        isAvailable: false,
        resolvedPath: null,
        statusMessage: "ffprobe is not available from PATH or settings",
      },
    });

    renderApp();

    expect(
      await screen.findByRole("button", { name: "Settings 2" }),
    ).toBeInTheDocument();
  });
});
