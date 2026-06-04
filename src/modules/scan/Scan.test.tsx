import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockedOpen,
  mockedConvertFileSrc,
  mockedGetLocalDesktopAppStatus,
  mockedGetFfmpegToolsStatus,
  mockedSaveFfmpegConfiguration,
  mockedListFailedPreviewStrips,
  mockedListPendingPreviewStripScopeTree,
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
  mockedUpdateTag,
  mockedUpdatePerformer,
  mockedUpdateVideoTitle,
  mockedSetVideoFavorite,
  mockedOpenCatalogVideo,
  mockedRetryFailedPreviewStrip,
  mockedIgnoreFailedPreviewStrip,
  mockedListCatalogVideos,
  mockedListUnprocessableVideoCandidatesByScanRoot,
  mockedMoveUnprocessableVideoCandidateToTrash,
  mockedOpenUnprocessableVideoCandidateInFinder,
  mockedListScanRoots,
  mockedAddScanRoot,
  mockedCheckScanRootAvailability,
  mockedForgetCatalogVideo,
  mockedGetPreviewStripQueueStatus,
  mockedPausePreviewStripQueue,
  mockedProcessNextPreviewStripQueueItem,
  mockedRemoveScanRoot,
  mockedResumePreviewStripQueue,
  mockedCancelScanRootRefreshJob,
  mockedListen,
  mockedStartScanRootRefreshJob,
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
  openMissingVideosTab,
  openPreviewGenerationTab,
} from "../../test/AppTestHarness";
import {
  firstPreviewStripFrameIndex,
  previewStripFramePosition,
} from "../catalog/components/VideoPreview/previewStripFrame";
import {
  catalogVideoFixture,
  clickFolderFilterCheckbox,
  expandFolderFilterBranch,
  showAdvancedSearch,
} from "../catalog/test/catalogTestHelpers";

describe("Scan module", () => {
  beforeEach(resetAppTestHarness);
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
    await openPreviewGenerationTab();

    expect(await screen.findByText("1 pending")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resume Preview Queue" }),
    ).toBeInTheDocument();
    expect(mockedProcessNextPreviewStripQueueItem).not.toHaveBeenCalled();
  });

  it("processes Preview Strips inside the selected Catalog child folder branch", async () => {
    const selectedScopeBranches = [
      {
        path: "/Volumes/Archive/Videos/Travel/Paris",
        availableScanRootPath: "/Volumes/Archive/Videos",
      },
    ];
    mockedListScanRoots.mockResolvedValue([
      {
        path: "/Volumes/Archive/Videos",
        isAvailable: true,
        lastScanCompletedAt: null,
        inferenceRules: defaultInferenceRules,
      },
    ]);
    mockedListCatalogVideos.mockResolvedValue([
      {
        ...catalogVideoFixture(1, "Paris Day One"),
        fileLocationPath: "/Volumes/Archive/Videos/Travel/Paris/day-one.mp4",
        fileLocations: [
          {
            path: "/Volumes/Archive/Videos/Travel/Paris/day-one.mp4",
            fileSizeBytes: 1000,
            isPreferred: true,
            isReachable: true,
          },
        ],
      },
      {
        ...catalogVideoFixture(2, "Studio Clip"),
        fileLocationPath: "/Volumes/Archive/Videos/Studio/studio-clip.mp4",
        fileLocations: [
          {
            path: "/Volumes/Archive/Videos/Studio/studio-clip.mp4",
            fileSizeBytes: 1000,
            isPreferred: true,
            isReachable: true,
          },
        ],
      },
    ]);
    mockedGetPreviewStripQueueStatus.mockResolvedValue({
      pendingCount: 1,
      runningCount: 0,
      runningVideoId: null,
      failedCount: 0,
      isPaused: false,
    });
    mockedProcessNextPreviewStripQueueItem.mockResolvedValue({
      pendingCount: 0,
      runningCount: 1,
      runningVideoId: 1,
      failedCount: 0,
      isPaused: false,
    });

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await showAdvancedSearch(catalogVideos);
    fireEvent.click(
      await within(catalogVideos).findByRole("button", {
        name: "Unselect all visible folder branches",
      }),
    );
    expandFolderFilterBranch(catalogVideos, "/Volumes/Archive/Videos");
    clickFolderFilterCheckbox(catalogVideos, "Travel");
    await openPreviewGenerationTab();

    await waitFor(() =>
      expect(mockedGetPreviewStripQueueStatus).toHaveBeenCalledWith(
        selectedScopeBranches,
      ),
    );
    await waitFor(() =>
      expect(mockedProcessNextPreviewStripQueueItem).toHaveBeenCalledWith(
        selectedScopeBranches,
      ),
    );
  });

  it("chooses Preview Strip generation scope from the Preview Generation folder tree", async () => {
    const selectedScopeBranches = [
      {
        path: "/Volumes/Archive/Videos/Travel/Paris",
        availableScanRootPath: "/Volumes/Archive/Videos",
      },
    ];
    mockedListPendingPreviewStripScopeTree.mockResolvedValue([
      {
        path: "/Volumes/Archive/Videos",
        availableScanRootPath: "/Volumes/Archive/Videos",
        pendingCount: 3,
        children: [
          {
            path: "/Volumes/Archive/Videos/Travel",
            availableScanRootPath: "/Volumes/Archive/Videos",
            pendingCount: 2,
            children: [
              {
                path: "/Volumes/Archive/Videos/Travel/Paris",
                availableScanRootPath: "/Volumes/Archive/Videos",
                pendingCount: 1,
                children: [],
              },
              {
                path: "/Volumes/Archive/Videos/Travel/Rome",
                availableScanRootPath: "/Volumes/Archive/Videos",
                pendingCount: 1,
                children: [],
              },
            ],
          },
          {
            path: "/Volumes/Archive/Videos/Studio",
            availableScanRootPath: "/Volumes/Archive/Videos",
            pendingCount: 1,
            children: [],
          },
        ],
      },
    ]);
    mockedGetPreviewStripQueueStatus.mockImplementation(async (scopeBranches) => ({
      pendingCount: scopeBranches?.length === 0 ? 0 : 1,
      runningCount: 0,
      runningVideoId: null,
      failedCount: 0,
      isPaused: false,
    }));
    mockedProcessNextPreviewStripQueueItem.mockResolvedValue({
      pendingCount: 0,
      runningCount: 1,
      runningVideoId: 1,
      failedCount: 0,
      isPaused: false,
    });

    renderApp();
    await openPreviewGenerationTab();

    const scanRootScopeCheckbox = await screen.findByRole("checkbox", {
      name: "/Volumes/Archive/Videos (3 pending)",
    });
    await waitFor(() => expect(scanRootScopeCheckbox).toBeChecked());
    expect(
      screen.getByRole("checkbox", { name: "Travel (2 pending)" }),
    ).toBeChecked();

    const processQueueCallCountBeforeEmptySelection =
      mockedProcessNextPreviewStripQueueItem.mock.calls.length;

    fireEvent.click(
      screen.getByRole("button", {
        name: "Unselect all visible Preview Generation Scope branches",
      }),
    );

    expect(await screen.findByText("0 pending")).toBeInTheDocument();
    expect(mockedProcessNextPreviewStripQueueItem).toHaveBeenCalledTimes(
      processQueueCallCountBeforeEmptySelection,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Paris (1 pending)" }));

    await waitFor(() =>
      expect(mockedGetPreviewStripQueueStatus).toHaveBeenCalledWith(
        selectedScopeBranches,
      ),
    );
    await waitFor(() =>
      expect(mockedProcessNextPreviewStripQueueItem).toHaveBeenCalledWith(
        selectedScopeBranches,
      ),
    );
    expect(
      screen.getByRole("checkbox", { name: "Travel (2 pending)" }),
    ).toHaveAttribute("aria-checked", "mixed");
  });

  it("refreshes the Preview Generation Scope tree as Preview Strips complete", async () => {
    mockedListPendingPreviewStripScopeTree
      .mockResolvedValueOnce([
        {
          path: "/Volumes/Archive/Videos",
          availableScanRootPath: "/Volumes/Archive/Videos",
          pendingCount: 1,
          children: [
            {
              path: "/Volumes/Archive/Videos/Travel",
              availableScanRootPath: "/Volumes/Archive/Videos",
              pendingCount: 1,
              children: [
                {
                  path: "/Volumes/Archive/Videos/Travel/Paris",
                  availableScanRootPath: "/Volumes/Archive/Videos",
                  pendingCount: 1,
                  children: [],
                },
              ],
            },
          ],
        },
      ])
      .mockResolvedValueOnce([]);
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
        failedCount: 0,
        isPaused: false,
      });
    mockedProcessNextPreviewStripQueueItem.mockResolvedValue({
      pendingCount: 0,
      runningCount: 1,
      runningVideoId: 1,
      failedCount: 0,
      isPaused: false,
    });

    try {
      renderApp();
      await openPreviewGenerationTab();

      expect(
        await screen.findByRole("checkbox", { name: "Paris (1 pending)" }),
      ).toBeChecked();

      await waitFor(() =>
        expect(mockedProcessNextPreviewStripQueueItem).toHaveBeenCalled(),
      );
      vi.useFakeTimers();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });
      vi.useRealTimers();

      await waitFor(() =>
        expect(mockedListPendingPreviewStripScopeTree).toHaveBeenCalledTimes(2),
      );
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(await screen.findByText("0 pending")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not show a separate batch generation command", async () => {
    renderApp();

    expect(
      screen.queryByRole("button", { name: "Generate Preview Strips" }),
    ).not.toBeInTheDocument();
  });

  it("manages global Secret Metadata from existing Tags and Performers", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Travel Clip",
        durationMilliseconds: 120000,
        fileSizeBytes: 1000,
        fileLocationPath: "/Volumes/Archive/Videos/travel.mp4",
        isAvailable: true,
        fileLocations: [
          {
            path: "/Volumes/Archive/Videos/travel.mp4",
            fileSizeBytes: 1000,
            isPreferred: true,
            isReachable: true,
          },
        ],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);
    mockedListTags.mockResolvedValue([
      { id: 4, isSecret: false, name: "Travel" },
      { id: 5, isSecret: true, name: "Archive" },
    ]);
    mockedListPerformers.mockResolvedValue([
      { id: 9, isSecret: false, name: "Blair" },
      { id: 10, isSecret: true, name: "Alex" },
    ]);
    mockedTagsForVideo.mockResolvedValue([
      { id: 4, isSecret: false, name: "Travel" },
    ]);
    mockedPerformersForVideo.mockResolvedValue([]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    fireEvent.click(
      within(catalogVideos).getByRole("button", {
        name: "Advanced search",
      }),
    );
    expect(
      await within(catalogVideos).findByRole("checkbox", {
        name: "Hide secret tags and performers",
      }),
    ).toBeChecked();
    expect(await within(catalogVideos).findByText("Travel Clip")).toBeInTheDocument();
    await openScanModule();

    const secretMetadataSection = await screen.findByRole("region", {
      name: "Secret Tags and Performers",
    });

    expect(
      within(secretMetadataSection).getByRole("heading", {
        name: "Secret Tags and Performers",
      }),
    ).toBeInTheDocument();
    expect(
      within(secretMetadataSection).queryByRole("checkbox", {
        name: "Travel secret Tag",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(secretMetadataSection).getByRole("button", {
        name: "Secret Tags and Performers",
      }),
    );

    expect(
      await within(secretMetadataSection).findByRole("checkbox", {
        name: "Travel secret Tag",
      }),
    ).not.toBeChecked();
    expect(
      within(secretMetadataSection).getByRole("checkbox", {
        name: "Archive secret Tag",
      }),
    ).toBeChecked();
    expect(
      within(secretMetadataSection).getByRole("checkbox", {
        name: "Blair secret Performer",
      }),
    ).not.toBeChecked();
    expect(
      within(secretMetadataSection).getByRole("checkbox", {
        name: "Alex secret Performer",
      }),
    ).toBeChecked();
    expect(
      within(secretMetadataSection).queryByRole("button", { name: /create/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(secretMetadataSection).getByRole("checkbox", {
        name: "Travel secret Tag",
      }),
    );
    fireEvent.click(
      within(secretMetadataSection).getByRole("checkbox", {
        name: "Alex secret Performer",
      }),
    );

    await waitFor(() =>
      expect(mockedUpdateTag).toHaveBeenCalledWith(4, "Travel", true),
    );
    expect(mockedUpdatePerformer).toHaveBeenCalledWith(10, "Alex", false);
    expect(mockedCreateTag).not.toHaveBeenCalled();
    expect(mockedCreatePerformer).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("button", { name: "Back to Catalog" }));

    const updatedCatalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await waitFor(() =>
      expect(
        within(updatedCatalogVideos).queryByText("Travel Clip"),
      ).not.toBeInTheDocument(),
    );
    expect(
      within(updatedCatalogVideos).queryByLabelText("Travel"),
    ).not.toBeInTheDocument();
  });

  it("shows a recoverable status when changing a secret Tag fails", async () => {
    mockedListTags.mockResolvedValue([
      { id: 4, isSecret: false, name: "Travel" },
    ]);
    mockedUpdateTag.mockRejectedValue(new Error("Tag update failed"));

    renderApp();
    await openScanModule();

    const secretMetadataSection = await screen.findByRole("region", {
      name: "Secret Tags and Performers",
    });
    fireEvent.click(
      within(secretMetadataSection).getByRole("button", {
        name: "Secret Tags and Performers",
      }),
    );

    fireEvent.click(
      await within(secretMetadataSection).findByRole("checkbox", {
        name: "Travel secret Tag",
      }),
    );

    expect(
      await within(secretMetadataSection).findByText("Tag update failed"),
    ).toBeInTheDocument();
    expect(
      within(secretMetadataSection).getByRole("checkbox", {
        name: "Travel secret Tag",
      }),
    ).not.toBeChecked();
  });

  it("shows a recoverable status when changing a secret Performer fails", async () => {
    mockedListPerformers.mockResolvedValue([
      { id: 9, isSecret: true, name: "Blair" },
    ]);
    mockedUpdatePerformer.mockRejectedValue(new Error("Performer update failed"));

    renderApp();
    await openScanModule();

    const secretMetadataSection = await screen.findByRole("region", {
      name: "Secret Tags and Performers",
    });
    fireEvent.click(
      within(secretMetadataSection).getByRole("button", {
        name: "Secret Tags and Performers",
      }),
    );

    fireEvent.click(
      await within(secretMetadataSection).findByRole("checkbox", {
        name: "Blair secret Performer",
      }),
    );

    expect(
      await within(secretMetadataSection).findByText("Performer update failed"),
    ).toBeInTheDocument();
    expect(
      within(secretMetadataSection).getByRole("checkbox", {
        name: "Blair secret Performer",
      }),
    ).toBeChecked();
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
    await openPreviewGenerationTab();

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
    await openPreviewGenerationTab();

    expect(
      await screen.findByText("Generating Preview Strip: Family Trip"),
    ).toBeInTheDocument();
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
    const columnCount = 5;
    const rowCount = 8;
    const initialPosition = previewStripFramePosition(
      firstPreviewStripFrameIndex,
      columnCount,
      rowCount,
    );
    expect(previewStrip).toHaveStyle({
      backgroundImage:
        "url(asset:///Users/michel/Library/Caches/preview-strips/video-1-preview-strip.jpg)",
      backgroundPosition: `${initialPosition.x}% ${initialPosition.y}%`,
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
    fireEvent.click(
      await within(catalogVideos).findByRole("button", {
        name: "Unassigned Primary Performer Accordion",
      }),
    );

    const pendingVideoCard = await waitFor(() => {
      const videoCard = within(catalogVideos)
        .getAllByRole("article", { name: "Pending Trip" })
        .find((element) => element.tagName === "ARTICLE");

      if (!videoCard) {
        throw new Error("Pending Trip Video card was not rendered");
      }

      return videoCard;
    });
    const failedVideoCard = await waitFor(() => {
      const videoCard = within(catalogVideos)
        .getAllByRole("article", { name: "Failed Trip" })
        .find((element) => element.tagName === "ARTICLE");

      if (!videoCard) {
        throw new Error("Failed Trip Video card was not rendered");
      }

      return videoCard;
    });

    expect(
      within(pendingVideoCard).getByText("Pending Preview Strip"),
    ).toBeInTheDocument();
    expect(
      within(failedVideoCard).getByText("Failed Preview Strip"),
    ).toBeInTheDocument();
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

    await openScanModule();

    expect(
      await screen.findByText("/Volumes/Archive/Videos"),
    ).toBeInTheDocument();
  });

  it("shows how long ago each Scan Root was last scanned", async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1_000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
    mockedListScanRoots.mockResolvedValue([
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        lastScanCompletedAt: tenMinutesAgo,
        path: "/Volumes/Archive/Videos",
      },
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        lastScanCompletedAt: oneDayAgo,
        path: "/Volumes/Documentaries",
      },
    ]);

    renderApp();
    await openScanModule();

    expect(
      await screen.findByText("Last scan done 10 minutes ago"),
    ).toBeInTheDocument();
    expect(screen.getByText("Last scan done 1 day ago")).toBeInTheDocument();
  });

  it("routes Scan attention badges to Scan Roots, Missing Videos, and Preview Generation", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Missing Trip",
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
        title: "Generated Trip",
        durationMilliseconds: 1800000,
        fileSizeBytes: 4096,
        fileLocationPath: "/Volumes/Archive/Videos/generated-trip.mp4",
        isAvailable: true,
        fileLocations: [
          {
            path: "/Volumes/Archive/Videos/generated-trip.mp4",
            fileSizeBytes: 4096,
            isPreferred: true,
            isReachable: true,
          },
        ],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: {
          status: "generated",
          path: "/Users/michel/Library/Caches/preview-strips/video-2.jpg",
          frameCount: 40,
          columnCount: 5,
          rowCount: 8,
        },
      },
      {
        id: 3,
        title: "Generating Trip",
        durationMilliseconds: 1200000,
        fileSizeBytes: 2048,
        fileLocationPath: "/Volumes/Archive/Videos/generating-trip.mp4",
        isAvailable: true,
        fileLocations: [
          {
            path: "/Volumes/Archive/Videos/generating-trip.mp4",
            fileSizeBytes: 2048,
            isPreferred: true,
            isReachable: true,
          },
        ],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);
    mockedGetPreviewStripQueueStatus.mockResolvedValue({
      pendingCount: 1,
      runningCount: 1,
      runningVideoId: 3,
      failedCount: 1,
      isPaused: false,
    });
    mockedListScanRoots.mockResolvedValue([
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: false,
        path: "/Volumes/Archive/Videos",
      },
    ]);
    mockedCheckScanRootAvailability.mockResolvedValue({
      inferenceRules: defaultInferenceRules,
      isAvailable: false,
      path: "/Volumes/Archive/Videos",
    });
    mockedListUnprocessableVideoCandidatesByScanRoot.mockResolvedValue([
      {
        scanRootPath: "/Volumes/Archive/Videos",
        candidateCount: 1,
        candidates: [
          {
            path: "/Volumes/Archive/Videos/broken.mov",
            reason: "ffprobe failed",
            fileSizeBytes: 1234,
          },
        ],
      },
    ]);
    mockedListFailedPreviewStrips.mockResolvedValue([
      {
        videoId: 7,
        title: "Broken Preview",
        failureReason: "ffmpeg failed",
      },
    ]);

    renderApp();
    await openScanModule();

    expect(
      await screen.findByRole("tab", { name: "Scan Roots 1" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scan 4" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Missing Videos 1" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Preview Generation 1" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Missing Videos 1" }));

    const missingVideosWorkflow = await screen.findByRole("tabpanel", {
      name: "Missing Videos 1",
    });
    expect(within(missingVideosWorkflow).getByText("Missing Trip")).toBeInTheDocument();
    expect(
      within(missingVideosWorkflow).queryByText("/Volumes/Archive/Videos"),
    ).not.toBeInTheDocument();
    expect(
      within(missingVideosWorkflow).queryByText("/Volumes/Archive/Videos/broken.mov"),
    ).not.toBeInTheDocument();
    expect(
      within(missingVideosWorkflow).queryByText("Broken Preview"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Preview Generation 1" }));

    const previewGeneration = await screen.findByRole("tabpanel", {
      name: "Preview Generation 1",
    });
    expect(
      within(previewGeneration).getByText("Broken Preview"),
    ).toBeInTheDocument();
    expect(within(previewGeneration).getByText("1 generated")).toBeInTheDocument();
    expect(
      within(previewGeneration).getByText(
        "Generating Preview Strip: Generating Trip",
      ),
    ).toBeInTheDocument();
    expect(
      within(previewGeneration).getByText("1 generated"),
    ).toBeInTheDocument();
    expect(
      within(previewGeneration).getByText(
        "Generating Preview Strip: Generating Trip",
      ),
    ).toBeInTheDocument();
    expect(
      within(previewGeneration).getByRole("button", {
        name: "Retry Failed Preview Strip for Broken Preview",
      }),
    ).toBeInTheDocument();
  });

  it("opens editable Scan Root Inference Rules with their safe defaults", async () => {
    mockedListScanRoots.mockResolvedValue([
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        path: "/Volumes/Archive/Videos",
      },
    ]);

    renderApp();

    await openScanModule();

    const scanRoots = await screen.findByLabelText("Scan Roots");

    expect(
      within(scanRoots).queryByLabelText("Suggest tags from folder names"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(scanRoots).getByRole("button", {
        name: "Show Scan Root settings for /Volumes/Archive/Videos",
      }),
    );

    expect(
      within(scanRoots).getByLabelText("Suggest tags from folder names"),
    ).toBeChecked();
    expect(
      within(scanRoots).getByLabelText("Suggest tags from filename brackets"),
    ).toBeChecked();
    expect(within(scanRoots).getByLabelText("Ignored folder names")).toHaveValue(
      "Misc, Unsorted, To Sort, To Review, New, Temp, Archive, Archives, Downloads, Videos",
    );
    expect(within(scanRoots).getByLabelText("Ignored year start")).toHaveValue(
      "1900",
    );
    expect(within(scanRoots).getByLabelText("Ignored year end")).toHaveValue(
      "2099",
    );

    fireEvent.click(
      within(scanRoots).getByRole("button", {
        name: "Hide Scan Root settings for /Volumes/Archive/Videos",
      }),
    );

    expect(
      within(scanRoots).queryByLabelText("Suggest tags from folder names"),
    ).not.toBeInTheDocument();
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

    await openScanModule();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Show Scan Root settings for /Volumes/Archive/Videos",
      }),
    );

    fireEvent.change(await screen.findByLabelText("Ignored folder names"), {
      target: { value: "Misc, Extras" },
    });
    fireEvent.change(screen.getByLabelText("Ignored year start"), {
      target: { value: "1980" },
    });
    fireEvent.click(screen.getByLabelText("Suggest tags from folder names"));
    fireEvent.click(screen.getByLabelText("Suggest tags from filename brackets"));
    fireEvent.click(
      screen.getByRole("button", { name: "Save Inference Rules" }),
    );

    await waitFor(() => {
      expect(mockedUpdateScanRootInferenceRules).toHaveBeenCalledWith(
        "/Volumes/Archive/Videos",
        {
          ignoredExactYearRange: {
            endYear: 2099,
            startYear: 1980,
          },
          ignoredFolderNames: ["Misc", "Extras"],
          suggestTagsFromFilenameBrackets: false,
          suggestTagsFromFolderNames: false,
        },
      );
    });
  });

  it("adds a Scan Root through the folder picker and starts a background scan immediately", async () => {
    mockedOpen.mockResolvedValue("/Volumes/Archive/Videos");
    const scanStart = deferredPromise<void>();
    mockedStartScanRootRefreshJob.mockReturnValue(scanStart.promise);

    renderApp();

    await openScanModule();

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
    expect(
      await screen.findByText("/Volumes/Archive/Videos"),
    ).toBeInTheDocument();
    expect(mockedStartScanRootRefreshJob).toHaveBeenCalledWith(
      "/Volumes/Archive/Videos",
    );
  });

  it("updates the Metadata Suggestions toolbar badge after the Initial Scan creates suggestions", async () => {
    let scanRootRefreshEvent:
      | ((event: {
          payload: {
            scanRootPath: string;
            status: string;
            processedVideoCandidateCount: number;
            totalVideoCandidateCount: number | null;
            scannedVideoCount: number;
            unprocessableCandidateCount: number;
            message: string | null;
          };
        }) => void)
      | undefined;
    mockedListen.mockImplementation(async (_eventName, eventHandler) => {
      scanRootRefreshEvent = eventHandler as typeof scanRootRefreshEvent;
      return () => undefined;
    });
    mockedOpen.mockResolvedValue("/Volumes/Archive/Videos");
    mockedListMetadataSuggestionGroups
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          suggestionKind: "tag",
          suggestedValue: "Trips",
          sources: [
            {
              scanRootPath: "/Volumes/Archive/Videos",
              sourcePathSegment: "Trips",
              videos: [
                {
                  videoId: 1,
                  title: "Family Trip",
                  fileLocationPath:
                    "/Volumes/Archive/Videos/Trips/family-trip.mp4",
                },
              ],
            },
          ],
        },
      ]);

    renderApp();

    expect(
      screen.queryByRole("button", { name: /^Metadata Suggestions/ }),
    ).not.toBeInTheDocument();

    await openScanModule();
    fireEvent.click(
      await screen.findByRole("button", { name: "Choose folder" }),
    );
    await waitFor(() => {
      expect(mockedStartScanRootRefreshJob).toHaveBeenCalledWith(
        "/Volumes/Archive/Videos",
      );
    });

    scanRootRefreshEvent?.({
      payload: {
        scanRootPath: "/Volumes/Archive/Videos",
        status: "complete",
        processedVideoCandidateCount: 1,
        totalVideoCandidateCount: 1,
        scannedVideoCount: 1,
        unprocessableCandidateCount: 0,
        message: null,
      },
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Back to Catalog" }),
    );

    const metadataSuggestionsButton = await screen.findByRole("button", {
      name: "Metadata Suggestions, 1 groups",
    });

    expect(metadataSuggestionsButton).toBeInTheDocument();
    expect(within(metadataSuggestionsButton).getByText("1")).toBeInTheDocument();
  });

  it("shows live Scan Root refresh progress and disables conflicting actions", async () => {
    let scanRootRefreshEvent:
      | ((event: {
          payload: {
            scanRootPath: string;
            status: string;
            processedVideoCandidateCount: number;
            totalVideoCandidateCount: number | null;
            scannedVideoCount: number;
            unprocessableCandidateCount: number;
          };
        }) => void)
      | undefined;
    mockedListen.mockImplementation(async (_eventName, eventHandler) => {
      scanRootRefreshEvent = eventHandler as typeof scanRootRefreshEvent;
      return () => undefined;
    });
    mockedListScanRoots.mockResolvedValue([
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        path: "/Volumes/Archive/Videos",
      },
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        path: "/Volumes/Archive/More Videos",
      },
    ]);

    renderApp();
    await openScanModule();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Show Scan Root settings for /Volumes/Archive/Videos",
      }),
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Refresh Scan Root /Volumes/Archive/Videos",
      }),
    );

    await waitFor(() => {
      expect(mockedStartScanRootRefreshJob).toHaveBeenCalledWith(
        "/Volumes/Archive/Videos",
      );
    });
    expect(screen.getByRole("button", { name: "Choose folder" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /Refresh Scan Root/ })[1]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Remove" })[0]).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save Inference Rules" })).toBeDisabled();

    scanRootRefreshEvent?.({
      payload: {
        scanRootPath: "/Volumes/Archive/Videos",
        status: "scanning",
        processedVideoCandidateCount: 1,
        totalVideoCandidateCount: 3,
        scannedVideoCount: 1,
        unprocessableCandidateCount: 0,
      },
    });

    expect(await screen.findByText("Scanning")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Scan Root progress" })).toHaveAttribute(
      "aria-valuenow",
      "33",
    );
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(
      screen.queryByText("1 of 3 video candidates processed"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("1 Video scanned")).not.toBeInTheDocument();
    expect(
      screen.getByText("0 Unprocessable Video Candidates"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel scan" }));

    expect(mockedCancelScanRootRefreshJob).toHaveBeenCalledWith(
      "/Volumes/Archive/Videos",
    );
  });

  it("shows a clear message when the folder picker cannot open", async () => {
    mockedOpen.mockRejectedValue(new Error("dialog open permission denied"));

    renderApp();

    await openScanModule();

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

    await openScanModule();

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

    await openScanModule();

    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Preserve as Missing Videos" }),
    );

    expect(mockedRemoveScanRoot).toHaveBeenCalledWith(
      "/Volumes/Archive/Videos",
      "preserveMissingVideos",
    );
  });

  it("removes Metadata Suggestions for a removed Scan Root from the Catalog entry point", async () => {
    mockedListScanRoots.mockResolvedValue([
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        path: "/Volumes/Archive/Videos",
      },
    ]);
    mockedListMetadataSuggestionGroups
      .mockResolvedValueOnce([
        {
          suggestionKind: "tag",
          suggestedValue: "Trips",
          sources: [
            {
              scanRootPath: "/Volumes/Archive/Videos",
              sourcePathSegment: "Trips",
              videos: [
                {
                  videoId: 1,
                  title: "Family Trip",
                  fileLocationPath:
                    "/Volumes/Archive/Videos/Trips/family-trip.mp4",
                },
              ],
            },
          ],
        },
      ])
      .mockResolvedValueOnce([]);

    renderApp();

    expect(
      await screen.findByRole("button", {
        name: "Metadata Suggestions, 1 groups",
      }),
    ).toBeInTheDocument();

    await openScanModule();
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Preserve as Missing Videos" }),
    );
    await waitFor(() => {
      expect(mockedRemoveScanRoot).toHaveBeenCalledWith(
        "/Volumes/Archive/Videos",
        "preserveMissingVideos",
      );
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Back to Catalog" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /^Metadata Suggestions/ }),
      ).not.toBeInTheDocument();
    });
  });

  it("keeps the Scan Root removal confirmation open when removal fails", async () => {
    mockedListScanRoots.mockResolvedValue([
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        path: "/Volumes/Archive/Videos",
      },
    ]);
    mockedRemoveScanRoot.mockRejectedValue(new Error("Cannot remove root"));

    renderApp();

    await openScanModule();

    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Preserve as Missing Videos" }),
    );

    expect(await screen.findByText("Cannot remove root")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Remove Scan Root" }),
    ).toBeInTheDocument();
  });

  it("refreshes a selected Scan Root and shows the Catalog summary", async () => {
    mockedListScanRoots.mockResolvedValue([
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        path: "/Volumes/Archive/Videos",
      },
    ]);
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

    await openScanModule();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Refresh Scan Root /Volumes/Archive/Videos",
      }),
    );

    expect(mockedStartScanRootRefreshJob).toHaveBeenCalledWith(
      "/Volumes/Archive/Videos",
    );
  });

  it("does not show Refresh all Scan Roots", async () => {
    mockedListScanRoots
      .mockResolvedValue([
        {
          inferenceRules: defaultInferenceRules,
          isAvailable: true,
          path: "/Volumes/Archive/Videos",
        },
      ]);

    renderApp();

    await openScanModule();

    expect(
      screen.queryByRole("button", { name: "Refresh all Scan Roots" }),
    ).not.toBeInTheDocument();
  });

  it("checks Scan Root availability at startup", async () => {
    mockedListScanRoots.mockResolvedValue([
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        path: "/Volumes/Archive/Videos",
      },
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: false,
        path: "/Volumes/Offline/Videos",
      },
    ]);
    mockedCheckScanRootAvailability.mockImplementation(async (path) => ({
      inferenceRules: defaultInferenceRules,
      isAvailable: path === "/Volumes/Archive/Videos",
      path,
    }));

    renderApp();
    await openScanModule();

    await waitFor(() => {
      expect(mockedCheckScanRootAvailability).toHaveBeenCalledWith(
        "/Volumes/Archive/Videos",
      );
      expect(mockedCheckScanRootAvailability).toHaveBeenCalledWith(
        "/Volumes/Offline/Videos",
      );
    });
  });

  it("lets unavailable Scan Roots check availability instead of refreshing", async () => {
    mockedListScanRoots.mockResolvedValue([
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: false,
        path: "/Volumes/Offline/Videos",
      },
    ]);
    mockedCheckScanRootAvailability
      .mockResolvedValueOnce({
        inferenceRules: defaultInferenceRules,
        isAvailable: false,
        path: "/Volumes/Offline/Videos",
      })
      .mockResolvedValueOnce({
      inferenceRules: defaultInferenceRules,
      isAvailable: true,
      path: "/Volumes/Offline/Videos",
    });

    renderApp();
    await openScanModule();

    const scanRoots = await screen.findByRole("region", {
      name: "Scan Root management",
    });
    expect(
      within(scanRoots).queryByRole("button", {
        name: "Refresh Scan Root /Volumes/Offline/Videos",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(scanRoots).getByRole("button", {
        name: "Check availability for Scan Root /Volumes/Offline/Videos",
      }),
    );

    await waitFor(() => {
      expect(mockedCheckScanRootAvailability).toHaveBeenCalledWith(
        "/Volumes/Offline/Videos",
      );
    });
    expect(mockedStartScanRootRefreshJob).not.toHaveBeenCalled();
    expect(
      await within(scanRoots).findByRole("button", {
        name: "Refresh Scan Root /Volumes/Offline/Videos",
      }),
    ).toBeInTheDocument();
  });

  it("lists only Missing Videos in Missing Videos", async () => {
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
        id: 3,
        title: "Offline Trip",
        durationMilliseconds: 240000,
        fileSizeBytes: 2048,
        fileLocationPath: "/Volumes/Missing/Videos/offline-trip.mp4",
        isAvailable: false,
        fileLocations: [
          {
            path: "/Volumes/Missing/Videos/offline-trip.mp4",
            fileSizeBytes: 2048,
            isPreferred: true,
            isReachable: true,
          },
        ],
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
        fileLocations: [
          {
            path: "/Volumes/Archive/Videos/available-trip.mp4",
            fileSizeBytes: 1024,
            isPreferred: true,
            isReachable: true,
          },
        ],
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
    mockedListUnprocessableVideoCandidatesByScanRoot.mockResolvedValue([
      {
        scanRootPath: "/Volumes/Archive/Videos",
        candidateCount: 1,
        candidates: [
          {
            path: "/Volumes/Archive/Videos/broken.mkv",
            reason: "missing moov atom",
            fileSizeBytes: 2048,
          },
        ],
      },
    ]);

    renderApp();
    await openMissingVideosTab();

    await waitFor(() => {
      expect(mockedListMetadataSuggestionGroups).toHaveBeenCalled();
    });

    const missingVideosWorkflow = await screen.findByRole("region", {
      name: "Missing Videos",
    });
    expect(
      within(missingVideosWorkflow).getByRole("heading", { name: "Missing Videos" }),
    ).toBeInTheDocument();
    expect(
      await within(missingVideosWorkflow).findByText("Family Trip"),
    ).toBeInTheDocument();
    expect(
      within(missingVideosWorkflow).queryByText("Available Trip"),
    ).not.toBeInTheDocument();
    expect(
      within(missingVideosWorkflow).queryByText("Offline Trip"),
    ).not.toBeInTheDocument();
    expect(
      within(missingVideosWorkflow).queryByText("/Volumes/Missing/Videos"),
    ).not.toBeInTheDocument();
    expect(
      within(missingVideosWorkflow).queryByText("Unavailable Scan Roots"),
    ).not.toBeInTheDocument();
    expect(
      within(missingVideosWorkflow).queryByText("Unprocessable Video Candidates"),
    ).not.toBeInTheDocument();
    expect(
      within(missingVideosWorkflow).queryByText("/Volumes/Archive/Videos/broken.mkv"),
    ).not.toBeInTheDocument();
    expect(
      within(missingVideosWorkflow).queryByText("missing moov atom"),
    ).not.toBeInTheDocument();
  });

  it("shows the remembered path and Preview Strip for each Missing Video", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: false,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: {
          status: "generated",
          path: "/Users/michelvidailhet/Library/Caches/com.media-manager/preview-strips/family-trip.jpg",
          frameCount: 12,
          columnCount: 4,
          rowCount: 3,
        },
      },
    ]);

    renderApp();
    await openMissingVideosTab();

    const missingVideosWorkflow = await screen.findByRole("region", {
      name: "Missing Videos",
    });
    expect(
      await within(missingVideosWorkflow).findByText(
        "/Volumes/Archive/Videos/family-trip.mp4",
      ),
    ).toBeInTheDocument();
    const previewStrip = within(missingVideosWorkflow).getByRole("img", {
      name: "Preview Strip for Family Trip",
    });

    expect(previewStrip).toHaveStyle({
      backgroundImage:
        "url(asset:///Users/michelvidailhet/Library/Caches/com.media-manager/preview-strips/family-trip.jpg)",
    });
  });

  it("shows each Scan Root card's Unprocessable video count and capped relative details", async () => {
    const allArchiveCandidates = Array.from({ length: 21 }, (_, candidateIndex) => ({
      path: `/Volumes/Archive/Videos/broken-${candidateIndex + 1}.mkv`,
      reason: "missing moov atom",
      fileSizeBytes: 1_000_000 * (candidateIndex + 1),
    }));

    mockedListScanRoots.mockResolvedValue([
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        path: "/Volumes/Archive/Videos",
      },
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        path: "/Volumes/Documentaries",
      },
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        path: "/Volumes/No Issues",
      },
    ]);
    mockedListUnprocessableVideoCandidatesByScanRoot.mockResolvedValue([
      {
        scanRootPath: "/Volumes/Archive/Videos",
        candidateCount: allArchiveCandidates.length,
        candidates: allArchiveCandidates,
      },
      {
        scanRootPath: "/Volumes/Documentaries",
        candidateCount: 1,
        candidates: [
          {
            path: "/Volumes/Documentaries/broken.mov",
            reason: "unsupported codec",
            fileSizeBytes: 4096,
          },
        ],
      },
    ]);

    renderApp();
    await openScanModule();

    const scanRoots = await screen.findByLabelText("Scan Roots");
    expect(
      within(scanRoots).getByText("21 Unprocessable videos"),
    ).toBeInTheDocument();
    expect(
      within(scanRoots).getByText("1 Unprocessable video"),
    ).toBeInTheDocument();
    expect(
      within(scanRoots).queryByText("0 Unprocessable videos"),
    ).not.toBeInTheDocument();
    expect(
      within(scanRoots).queryByText("/Volumes/Archive/Videos/broken-1.mkv"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(scanRoots).getByRole("button", {
        name: "Show Unprocessable videos for /Volumes/Archive/Videos",
      }),
    );

    expect(within(scanRoots).getByText("broken-1.mkv")).toBeInTheDocument();
    expect(
      within(scanRoots).queryByText("/Volumes/Archive/Videos/broken-1.mkv"),
    ).not.toBeInTheDocument();
    expect(within(scanRoots).getAllByText("missing moov atom")[0]).toBeInTheDocument();
    expect(within(scanRoots).getByText("1.0 MB")).toBeInTheDocument();
    expect(
      within(scanRoots).queryByText("broken-21.mkv"),
    ).not.toBeInTheDocument();
    expect(within(scanRoots).getByText("Showing 20 of 21")).toBeInTheDocument();

    fireEvent.click(within(scanRoots).getByRole("button", { name: "Show all" }));

    expect(within(scanRoots).getByText("broken-21.mkv")).toBeInTheDocument();
    expect(within(scanRoots).getByText("Showing 21 of 21")).toBeInTheDocument();
    expect(
      within(scanRoots).queryByRole("button", { name: "Show all" }),
    ).not.toBeInTheDocument();
  });

  it("reveals and moves Unprocessable Video Candidates to Trash from Scan Roots", async () => {
    mockedListScanRoots.mockResolvedValue([
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        path: "/Volumes/Archive/Videos",
      },
    ]);
    mockedListUnprocessableVideoCandidatesByScanRoot.mockResolvedValue([
      {
        scanRootPath: "/Volumes/Archive/Videos",
        candidateCount: 2,
        candidates: [
          {
            path: "/Volumes/Archive/Videos/broken.mov",
            reason: "missing moov atom",
            fileSizeBytes: 4096,
          },
          {
            path: "/Volumes/Archive/Videos/corrupt.mkv",
            reason: "ffprobe failed",
            fileSizeBytes: 2048,
          },
        ],
      },
    ]);

    renderApp();
    await openScanModule();

    const scanRoots = await screen.findByLabelText("Scan Roots");
    fireEvent.click(
      within(scanRoots).getByRole("button", {
        name: "Show Unprocessable videos for /Volumes/Archive/Videos",
      }),
    );
    const brokenCandidate = within(scanRoots)
      .getByText("broken.mov")
      .closest("article");

    expect(brokenCandidate).not.toBeNull();
    fireEvent.click(
      within(brokenCandidate as HTMLElement).getByRole("button", {
        name: "Reveal /Volumes/Archive/Videos/broken.mov in Finder",
      }),
    );
    expect(mockedOpenUnprocessableVideoCandidateInFinder).toHaveBeenCalledWith(
      "/Volumes/Archive/Videos/broken.mov",
    );

    fireEvent.click(
      within(brokenCandidate as HTMLElement).getByRole("button", {
        name: "Move /Volumes/Archive/Videos/broken.mov to Trash",
      }),
    );

    const confirmation = await screen.findByRole("dialog", {
      name: "Move this file to Trash?",
    });
    expect(
      within(confirmation).getByText("/Volumes/Archive/Videos/broken.mov"),
    ).toBeInTheDocument();

    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Move to Trash" }),
    );

    await waitFor(() =>
      expect(mockedMoveUnprocessableVideoCandidateToTrash).toHaveBeenCalledWith(
        "/Volumes/Archive/Videos/broken.mov",
      ),
    );
    expect(within(scanRoots).queryByText("broken.mov")).not.toBeInTheDocument();
    expect(within(scanRoots).getByText("corrupt.mkv")).toBeInTheDocument();
    expect(within(scanRoots).getByText("1 Unprocessable video")).toBeInTheDocument();
  });

  it("keeps an Unprocessable Video Candidate visible with a path-specific Move to Trash failure", async () => {
    mockedListScanRoots.mockResolvedValue([
      {
        inferenceRules: defaultInferenceRules,
        isAvailable: true,
        path: "/Volumes/Archive/Videos",
      },
    ]);
    mockedListUnprocessableVideoCandidatesByScanRoot.mockResolvedValue([
      {
        scanRootPath: "/Volumes/Archive/Videos",
        candidateCount: 1,
        candidates: [
          {
            path: "/Volumes/Archive/Videos/broken.mov",
            reason: "missing moov atom",
            fileSizeBytes: 4096,
          },
        ],
      },
    ]);
    mockedMoveUnprocessableVideoCandidateToTrash.mockRejectedValue(
      "Finder denied delete permission",
    );

    renderApp();
    await openScanModule();

    const scanRoots = await screen.findByLabelText("Scan Roots");
    fireEvent.click(
      within(scanRoots).getByRole("button", {
        name: "Show Unprocessable videos for /Volumes/Archive/Videos",
      }),
    );

    const brokenCandidate = within(scanRoots)
      .getByText("broken.mov")
      .closest("article");

    expect(brokenCandidate).not.toBeNull();
    fireEvent.click(
      within(brokenCandidate as HTMLElement).getByRole("button", {
        name: "Move /Volumes/Archive/Videos/broken.mov to Trash",
      }),
    );
    fireEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Move this file to Trash?" }),
      ).getByRole("button", { name: "Move to Trash" }),
    );

    expect(
      await within(scanRoots).findByText(
        "Could not move this Unprocessable Video Candidate to Trash: /Volumes/Archive/Videos/broken.mov (Finder denied delete permission).",
      ),
    ).toBeInTheDocument();
    expect(within(scanRoots).getByText("broken.mov")).toBeInTheDocument();
    expect(within(scanRoots).getByText("1 Unprocessable video")).toBeInTheDocument();
  });

  it("lists Failed Preview Strips in Preview Generation with retry and ignore actions", async () => {
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
    await openPreviewGenerationTab();

    const previewGeneration = await screen.findByRole("region", {
      name: "Preview Generation",
    });
    expect(
      within(previewGeneration).getByRole("heading", {
        name: "Failed Preview Strips",
      }),
    ).toBeInTheDocument();
    expect(
      within(previewGeneration).getByText("Broken Trip"),
    ).toBeInTheDocument();
    expect(
      within(previewGeneration).getByText("ffmpeg failed"),
    ).toBeInTheDocument();

    fireEvent.click(
      within(previewGeneration).getByRole("button", {
        name: "Retry Failed Preview Strip for Broken Trip",
      }),
    );
    await waitFor(() => {
      expect(mockedRetryFailedPreviewStrip).toHaveBeenCalledWith(7);
    });
    expect(mockedGetPreviewStripQueueStatus).toHaveBeenCalled();

    fireEvent.click(
      within(previewGeneration).getByRole("button", {
        name: "Ignore Failed Preview Strip for Broken Trip",
      }),
    );
    await waitFor(() => {
      expect(mockedIgnoreFailedPreviewStrip).toHaveBeenCalledWith(7);
    });
    expect(
      within(previewGeneration).queryByText("Broken Trip"),
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
    await openPreviewGenerationTab();

    const previewGeneration = await screen.findByRole("region", {
      name: "Preview Generation",
    });
    expect(
      await within(previewGeneration).findByText("Broken Trip"),
    ).toBeInTheDocument();
  });
});
