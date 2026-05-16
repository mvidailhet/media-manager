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
  mockedListUnprocessableVideoCandidates,
  mockedListScanRoots,
  mockedAddScanRoot,
  mockedForgetCatalogVideo,
  mockedGetPreviewStripQueueStatus,
  mockedPausePreviewStripQueue,
  mockedProcessNextPreviewStripQueueItem,
  mockedRemoveScanRoot,
  mockedResumePreviewStripQueue,
  mockedRefreshAllScanRoots,
  mockedRefreshScanRoot,
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
} from "./test/AppTestHarness";

describe("App shell", () => {
  beforeEach(resetAppTestHarness);

  it("renders the selected Video Detail Panel in the AppShell aside", async () => {
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

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    fireEvent.click(
      await within(catalogVideos).findByRole("button", {
        name: "Family Trip",
      }),
    );

    const appAside = screen.getByRole("complementary");
    const appMain = screen.getByRole("main");
    const detailPanel = await within(appAside).findByRole("region", {
      name: "Video Detail Panel",
    });

    expect(detailPanel).toBeInTheDocument();
    expect(
      within(appMain).queryByRole("region", { name: "Video Detail Panel" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(catalogVideos).getByRole("button", {
        name: "City Walk",
      }),
    );

    expect(await within(appAside).findByDisplayValue("City Walk")).toBeInTheDocument();
  });

  it("renders Catalog as the initial module workspace", async () => {
    renderApp();

    expect(
      screen.getByRole("region", { name: "Catalog Videos" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Back to Catalog" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "FFmpeg status" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Tauri command status" }),
    ).not.toBeInTheDocument();
  });

  it("returns from secondary modules to Catalog with the back button", async () => {
    renderApp();

    await openScanModule();
    expect(
      await screen.findByRole("heading", { name: "Scan Roots" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to Catalog" }));

    expect(
      screen.getByRole("region", { name: "Catalog Videos" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Back to Catalog" }),
    ).not.toBeInTheDocument();

    await openSettingsModule();
    expect(
      await screen.findByRole("heading", { name: "FFmpeg status" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to Catalog" }));

    expect(
      screen.getByRole("region", { name: "Catalog Videos" }),
    ).toBeInTheDocument();
  });

  it("resets Video Detail and Batch Metadata Edit when changing Catalog views", async () => {
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

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    fireEvent.click(await within(catalogVideos).findByRole("button", { name: "Family Trip" }));
    fireEvent.click(within(catalogVideos).getByLabelText("Select Family Trip"));

    expect(
      await screen.findByRole("region", { name: "Video Detail Panel" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("region", { name: "Batch Metadata Edit" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Favorites" }));

    expect(
      screen.queryByRole("region", { name: "Video Detail Panel" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Batch Metadata Edit" }),
    ).not.toBeInTheDocument();
  });

  it("keeps Video Detail and Batch Metadata Edit when clicking the active Catalog view", async () => {
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
    fireEvent.click(within(catalogVideos).getByLabelText("Select Family Trip"));

    expect(
      await screen.findByRole("region", { name: "Video Detail Panel" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("region", { name: "Batch Metadata Edit" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "All Videos" }));

    expect(
      screen.getByRole("region", { name: "Video Detail Panel" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Batch Metadata Edit" }),
    ).toBeInTheDocument();
  });
});
