import { beforeEach, describe, expect, it } from "vitest";

import {
  fireEvent,
  screen,
  waitFor,
  within,
  vi,
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
  mockedOpenCatalogVideoContainingFolder,
  mockedOpenCatalogVideo,
  mockedOpenPlaybackWindow,
  mockedMoveCatalogVideoFileLocationToTrash,
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
  openMissingVideosTab,
  openPreviewGenerationTab,
  previewStripAutoplayFrameIntervalMilliseconds,
  expandMetadataSuggestionBranch,
  getMetadataSuggestionTreeLabel,
  getMetadataSuggestionBadge,
  showAdvancedSearch,
  findSecretMetadataVisibilityCheckbox,
  expandFolderFilterBranch,
  clickFolderFilterCheckbox,
  catalogVideoFixture,
  catalogVideoBatch,
  visibleCatalogVideos,
  expandPrimaryPerformerAccordion,
  findExpandedVideoCard
} from "./test/catalogTestHelpers";

describe("Catalog module integration", () => {
  beforeEach(resetAppTestHarness);

  it("returns from Metadata Suggestions to Videos View without main Catalog tabs", async () => {
    mockedListMetadataSuggestionGroups.mockResolvedValue([
      {
        suggestionKind: "tag",
        suggestedValue: "Travel",
        sources: [
          {
            scanRootPath: "/Volumes/Archive",
            sourcePathSegment: "Trips",
            videos: [
              {
                videoId: 1,
                title: "Family Trip",
                fileLocationPath: "/Volumes/Archive/Trips/family-trip.mp4",
              },
            ],
          },
        ],
      },
    ]);

    renderApp();

    fireEvent.click(
      await screen.findByRole("button", { name: /^Metadata Suggestions/ }),
    );
    expect(
      await screen.findByRole("region", { name: "Metadata Suggestions" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to Catalog" }));

    expect(
      screen.getByRole("region", { name: "Catalog Videos" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("uses Back to Catalog from Metadata Suggestions Review and restores Videos View browsing state", async () => {
    mockedListMetadataSuggestionGroups.mockResolvedValue([
      {
        suggestionKind: "tag",
        suggestedValue: "Travel",
        sources: [
          {
            scanRootPath: "/Volumes/Archive",
            sourcePathSegment: "Trips",
            videos: [
              {
                videoId: 1,
                title: "Family Trip",
                fileLocationPath: "/Volumes/Archive/Trips/family-trip.mp4",
              },
            ],
          },
        ],
      },
    ]);
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Trips/family-trip.mp4",
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
        fileLocationPath: "/Volumes/Archive/City/city-walk.mp4",
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
      target: { value: "City" },
    });
    expect(
      await within(catalogVideos).findByRole("article", { name: "City Walk" }),
    ).toBeInTheDocument();
    expect(
      within(catalogVideos).queryByRole("article", { name: "Family Trip" }),
    ).not.toBeInTheDocument();

    await openMetadataSuggestionsView();
    expect(
      await screen.findByRole("region", { name: "Metadata Suggestions" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to Catalog" }));

    const restoredCatalogVideos = screen.getByRole("region", {
      name: "Catalog Videos",
    });
    expect(
      within(restoredCatalogVideos).getByDisplayValue("City"),
    ).toBeInTheDocument();
    expect(
      within(restoredCatalogVideos).getByRole("article", { name: "City Walk" }),
    ).toBeInTheDocument();
    expect(
      within(restoredCatalogVideos).queryByRole("article", {
        name: "Family Trip",
      }),
    ).not.toBeInTheDocument();
  });

  it("clears Video Detail Panel selection when entering and leaving Metadata Suggestions Review", async () => {
    mockedListMetadataSuggestionGroups.mockResolvedValue([
      {
        suggestionKind: "tag",
        suggestedValue: "Travel",
        sources: [
          {
            scanRootPath: "/Volumes/Archive",
            sourcePathSegment: "Trips",
            videos: [
              {
                videoId: 1,
                title: "Family Trip",
                fileLocationPath: "/Volumes/Archive/Trips/family-trip.mp4",
              },
            ],
          },
        ],
      },
    ]);
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Trips/family-trip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    fireEvent.click(
      await screen.findByRole("article", { name: "Family Trip" }),
    );
    expect(
      await screen.findByRole("region", { name: "Video Detail Panel" }),
    ).toBeInTheDocument();

    await openMetadataSuggestionsView();
    expect(
      screen.queryByRole("region", { name: "Video Detail Panel" }),
    ).not.toBeInTheDocument();
    const metadataSuggestions = await screen.findByRole("region", {
      name: "Metadata Suggestions",
    });
    fireEvent.click(
      getMetadataSuggestionTreeLabel(metadataSuggestions, "/Volumes/Archive"),
    );
    fireEvent.click(within(metadataSuggestions).getByText("Trips/family-trip.mp4"));
    expect(
      await screen.findByRole("region", { name: "Video Detail Panel" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to Catalog" }));

    expect(
      screen.queryByRole("region", { name: "Video Detail Panel" }),
    ).not.toBeInTheDocument();
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
    await openMissingVideosTab();

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
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Forget Missing Video" }),
      ).not.toBeInTheDocument();
    });
  });
});
