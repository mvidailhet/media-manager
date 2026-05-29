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
} from "../test/catalogTestHelpers";

describe("Videos Panel integration", () => {
  beforeEach(resetAppTestHarness);

  it("loads Catalog Videos into the Videos View", async () => {
    mockedTagsForVideo.mockResolvedValue([{ id: 4, isSecret: false, name: "Travel" }]);
    mockedPerformersForVideo.mockResolvedValue([{ id: 9, isSecret: false, name: "Blair" }]);
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 150000000,
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

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "All Videos" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Favorites" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Metadata Suggestions" }),
    ).not.toBeInTheDocument();
    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await waitFor(() => {
      expect(within(catalogVideos).getAllByText("Blair").length).toBeGreaterThan(
        0,
      );
    });
    const videoCard = within(catalogVideos).getByRole("article", {
      name: "Family Trip",
    });

    expect(videoCard).toHaveAccessibleName("Family Trip");
    expect(
      within(videoCard).queryByRole("button", { name: "Family Trip" }),
    ).not.toBeInTheDocument();
    expect(
      within(videoCard).queryByRole("button", { name: "Open Family Trip" }),
    ).not.toBeInTheDocument();
    expect(
      within(videoCard).queryByRole("button", {
        name: "Mark Family Trip as Favorite",
      }),
    ).toBeInTheDocument();
    expect(within(videoCard).queryByText("Travel")).not.toBeInTheDocument();
    expect(within(videoCard).queryByText("Blair")).not.toBeInTheDocument();
    expect(within(videoCard).getByText("1h 2m")).toBeInTheDocument();
    expect(within(videoCard).getByText("150Mo")).toBeInTheDocument();
    expect(
      within(videoCard).queryByText("Unavailable"),
    ).not.toBeInTheDocument();
    expect(
      within(catalogVideos).queryByText(
        "/Volumes/Archive/Videos/family-trip.mp4",
      ),
    ).not.toBeInTheDocument();
  });

  it("filters Catalog Videos by text and duration while hiding Unavailable Videos by default", async () => {
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

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await expandPrimaryPerformerAccordion(catalogVideos);
    expect(
      await findExpandedVideoCard(catalogVideos, "Studio Clip"),
    ).toBeInTheDocument();
    expect(
      within(catalogVideos).getByPlaceholderText("Search Videos"),
    ).toHaveAccessibleName("Search Videos");
    expect(
      within(catalogVideos).queryByText("Search Videos"),
    ).not.toBeInTheDocument();
    expect(
      within(catalogVideos).getByRole("checkbox", {
        name: "Favorites",
      }),
    ).not.toBeChecked();
    expect(
      within(catalogVideos).queryByLabelText("Minimum duration minutes"),
    ).not.toBeInTheDocument();
    expect(
      within(catalogVideos).queryByLabelText("Maximum duration minutes"),
    ).not.toBeInTheDocument();
    const advancedSearchButton = within(catalogVideos).getByRole("button", {
      name: "Advanced search",
      expanded: false,
    });
    expect(
      within(catalogVideos).queryByRole("slider", {
        name: "Minimum duration",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(catalogVideos).queryByRole("slider", {
        name: "Maximum duration",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(catalogVideos).queryByRole("checkbox", {
        name: "Hide secret tags and performers",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(advancedSearchButton);

    expect(
      within(catalogVideos).getByRole("button", {
        name: "Advanced search",
        expanded: true,
      }),
    ).toBeInTheDocument();
    expect(
      await within(catalogVideos).findByRole("slider", {
        name: "Minimum duration",
      }),
    ).toBeInTheDocument();
    expect(
      within(catalogVideos).getByRole("slider", {
        name: "Maximum duration",
      }),
    ).toBeInTheDocument();
    expect(
      within(catalogVideos).getByRole("checkbox", {
        name: "Hide secret tags and performers",
      }),
    ).toBeChecked();
    expect(within(catalogVideos).getByText("0m - 3h")).toBeInTheDocument();

    fireEvent.change(within(catalogVideos).getByLabelText("Search Videos"), {
      target: { value: "family" },
    });

    expect(
      await findExpandedVideoCard(catalogVideos, "Family Trip"),
    ).toBeInTheDocument();
    expect(
      within(catalogVideos).queryByText("Archive Family Cut"),
    ).not.toBeInTheDocument();
    expect(
      within(catalogVideos).getByRole("checkbox", {
        name: "Show unavailable videos",
      }),
    ).not.toBeChecked();
    fireEvent.click(
      within(catalogVideos).getByRole("checkbox", {
        name: "Show unavailable videos",
      }),
    );
    expect(
      within(catalogVideos).getAllByText("Archive Family Cut").length,
    ).toBeGreaterThan(0);
    expect(within(catalogVideos).getAllByText("Unavailable").length).toBeGreaterThan(
      0,
    );
    expect(
      within(catalogVideos).queryByText("Studio Clip"),
    ).not.toBeInTheDocument();
  });

  it("marks and unmarks a Video as Favorite directly from the Videos View preview", async () => {
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
    const videoCard = await within(catalogVideos).findByRole("article", {
      name: "Family Trip",
    });

    fireEvent.click(
      within(videoCard).getByRole("button", {
        name: "Mark Family Trip as Favorite",
      }),
    );

    expect(mockedSetVideoFavorite).toHaveBeenCalledWith(1, true);
    expect(
      screen.queryByRole("region", { name: "Video Detail Panel" }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(videoCard).getByRole("button", {
          name: "Unmark Family Trip as Favorite",
        }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      within(videoCard).getByRole("button", {
        name: "Unmark Family Trip as Favorite",
      }),
    );

    expect(mockedSetVideoFavorite).toHaveBeenCalledWith(1, false);
    await waitFor(() =>
      expect(
        within(videoCard).getByRole("button", {
          name: "Mark Family Trip as Favorite",
        }),
      ).toBeInTheDocument(),
    );
  });

  it("keeps keyboard favorite actions in the Videos View from selecting the Video", async () => {
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
    const videoCard = await within(catalogVideos).findByRole("article", {
      name: "Family Trip",
    });

    fireEvent.keyDown(
      within(videoCard).getByRole("button", {
        name: "Mark Family Trip as Favorite",
      }),
      { key: "Enter" },
    );

    expect(
      screen.queryByRole("region", { name: "Video Detail Panel" }),
    ).not.toBeInTheDocument();
  });

  it("uses Favorites to narrow Videos to Favorite Videos", async () => {
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
    await expandPrimaryPerformerAccordion(catalogVideos);
    expect(
      await within(catalogVideos).findByText("Studio Clip"),
    ).toBeInTheDocument();

    fireEvent.click(
      within(catalogVideos).getByRole("checkbox", {
        name: "Favorites",
      }),
    );

    expect(
      within(catalogVideos).getByRole("checkbox", {
        name: "Favorites",
      }),
    ).toBeChecked();
    expect(
      await findExpandedVideoCard(catalogVideos, "Family Trip"),
    ).toBeInTheDocument();
    expect(within(catalogVideos).getAllByText("1h 2m").length).toBeGreaterThan(0);
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
    await expandPrimaryPerformerAccordion(catalogVideos);

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
      { id: 4, isSecret: false, name: "Travel" },
      { id: 5, isSecret: false, name: "Family" },
    ]);
    mockedListPerformers.mockResolvedValue([
      { id: 9, isSecret: false, name: "Blair" },
      { id: 10, isSecret: false, name: "Alex" },
    ]);
    mockedTagsForVideo.mockImplementation(async (videoId) => {
      if (videoId === 1) {
        return [
          { id: 4, isSecret: false, name: "Travel" },
          { id: 5, isSecret: false, name: "Family" },
        ];
      }

      return [{ id: 4, isSecret: false, name: "Travel" }];
    });
    mockedPerformersForVideo.mockImplementation(async (videoId) => {
      if (videoId === 1) {
        return [{ id: 9, isSecret: false, name: "Blair" }];
      }

      return [{ id: 10, isSecret: false, name: "Alex" }];
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
    expect(within(catalogVideos).getAllByText("2 Videos").length).toBeGreaterThan(
      0,
    );
    expect(within(catalogVideos).getByText("Travel (2)")).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Family (1)")).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Blair (1)")).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Alex (1)")).toBeInTheDocument();

    fireEvent.click(within(catalogVideos).getByLabelText("Travel"));
    fireEvent.click(within(catalogVideos).getByLabelText("Family"));
    await expandPrimaryPerformerAccordion(catalogVideos, "Blair");

    expect(within(catalogVideos).getAllByText("1 Video").length).toBeGreaterThan(
      0,
    );
    expect(
      within(catalogVideos).getAllByText("Family Trip").length,
    ).toBeGreaterThan(0);
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
    await expandPrimaryPerformerAccordion(catalogVideos, "Blair");

    expect(
      within(catalogVideos).getAllByText("Family Trip").length,
    ).toBeGreaterThan(0);
    expect(
      within(catalogVideos).queryByText("Travel Clip"),
    ).not.toBeInTheDocument();
  });

  it("filters Catalog Videos by selected reachable folder branches under available Scan Roots", async () => {
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
        ...catalogVideoFixture(2, "Rome Day Two"),
        fileLocationPath: "/Volumes/Archive/Videos/Travel/Rome/day-two.mp4",
        fileLocations: [
          {
            path: "/Volumes/Archive/Videos/Travel/Rome/day-two.mp4",
            fileSizeBytes: 1000,
            isPreferred: true,
            isReachable: true,
          },
        ],
      },
      {
        ...catalogVideoFixture(3, "Studio Clip"),
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
    await expandPrimaryPerformerAccordion(catalogVideos);

    expect(within(catalogVideos).getAllByText("2 Videos").length).toBeGreaterThan(
      0,
    );
    expect(
      within(catalogVideos).getAllByText("Paris Day One").length,
    ).toBeGreaterThan(0);
    expect(
      within(catalogVideos).getAllByText("Rome Day Two").length,
    ).toBeGreaterThan(0);
    expect(
      within(catalogVideos).queryByText("Studio Clip"),
    ).not.toBeInTheDocument();

    fireEvent.change(within(catalogVideos).getByLabelText("Search Videos"), {
      target: { value: "paris" },
    });
    await expandPrimaryPerformerAccordion(catalogVideos);

    expect(within(catalogVideos).getAllByText("1 Video").length).toBeGreaterThan(
      0,
    );
    expect(
      within(catalogVideos).getAllByText("Paris Day One").length,
    ).toBeGreaterThan(0);
    expect(
      within(catalogVideos).queryByText("Rome Day Two"),
    ).not.toBeInTheDocument();
  });

  it("keeps metadata filter counts based on loaded Videos after selecting folder branches", async () => {
    mockedListScanRoots.mockResolvedValue([
      {
        path: "/Volumes/Archive/Videos",
        isAvailable: true,
        lastScanCompletedAt: null,
        inferenceRules: defaultInferenceRules,
      },
    ]);
    mockedListTags.mockResolvedValue([
      { id: 4, isSecret: false, name: "Travel" },
      { id: 5, isSecret: false, name: "Studio" },
    ]);
    mockedListPerformers.mockResolvedValue([
      { id: 9, isSecret: false, name: "Blair" },
      { id: 10, isSecret: false, name: "Alex" },
    ]);
    mockedTagsForVideo.mockImplementation(async (videoId) => {
      if (videoId === 1) {
        return [{ id: 4, isSecret: false, name: "Travel" }];
      }

      if (videoId === 2) {
        return [{ id: 5, isSecret: false, name: "Studio" }];
      }

      return [];
    });
    mockedPerformersForVideo.mockImplementation(async (videoId) => {
      if (videoId === 1) {
        return [{ id: 9, isSecret: false, name: "Blair" }];
      }

      if (videoId === 2) {
        return [{ id: 10, isSecret: false, name: "Alex" }];
      }

      return [];
    });
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

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await waitFor(() => {
      expect(mockedTagsForVideo).toHaveBeenCalledWith(2);
      expect(mockedPerformersForVideo).toHaveBeenCalledWith(2);
    });

    expect(within(catalogVideos).getByText("Travel (1)")).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Studio (1)")).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Blair (1)")).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Alex (1)")).toBeInTheDocument();

    await showAdvancedSearch(catalogVideos);
    fireEvent.click(
      await within(catalogVideos).findByRole("button", {
        name: "Unselect all visible folder branches",
      }),
    );
    expandFolderFilterBranch(catalogVideos, "/Volumes/Archive/Videos");
    clickFolderFilterCheckbox(catalogVideos, "Travel");

    expect(within(catalogVideos).getByText("Travel (1)")).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Blair (1)")).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Studio (1)")).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Alex (1)")).toBeInTheDocument();
  });

  it("filters Catalog Videos to Videos without Tags", async () => {
    mockedListTags.mockResolvedValue([{ id: 4, isSecret: false, name: "Travel" }]);
    mockedTagsForVideo.mockImplementation(async (videoId) => {
      if (videoId === 1) {
        return [{ id: 4, isSecret: false, name: "Travel" }];
      }

      return [];
    });
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Tagged Clip"),
      catalogVideoFixture(2, "Loose Clip"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await waitFor(() => {
      expect(mockedTagsForVideo).toHaveBeenCalledWith(2);
    });

    fireEvent.click(within(catalogVideos).getByLabelText("No Tag"));
    await expandPrimaryPerformerAccordion(catalogVideos);

    expect(
      within(catalogVideos).queryByText("Tagged Clip"),
    ).not.toBeInTheDocument();
    expect(within(catalogVideos).getByText("Loose Clip")).toBeInTheDocument();
  });

  it("hides secret metadata from normal Videos browsing until revealed for the session", async () => {
    mockedListTags.mockResolvedValue([
      { id: 4, isSecret: false, name: "Travel" },
      { id: 5, isSecret: true, name: "Secret Tag" },
    ]);
    mockedListPerformers.mockResolvedValue([
      { id: 9, isSecret: false, name: "Blair" },
      { id: 10, isSecret: true, name: "Secret Performer" },
    ]);
    mockedTagsForVideo.mockImplementation(async (videoId) => {
      if (videoId === 2) {
        return [{ id: 5, isSecret: true, name: "Secret Tag" }];
      }

      return [{ id: 4, isSecret: false, name: "Travel" }];
    });
    mockedPerformersForVideo.mockImplementation(async (videoId) => {
      if (videoId === 3) {
        return [{ id: 10, isSecret: true, name: "Secret Performer" }];
      }

      return [{ id: 9, isSecret: false, name: "Blair" }];
    });
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Normal Video"),
      catalogVideoFixture(2, "Secret Tag Video"),
      catalogVideoFixture(3, "Secret Performer Video"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await waitFor(() => {
      expect(mockedTagsForVideo).toHaveBeenCalledWith(3);
      expect(mockedPerformersForVideo).toHaveBeenCalledWith(3);
    });

    const hideSecretMetadata =
      await findSecretMetadataVisibilityCheckbox(catalogVideos);

    expect(hideSecretMetadata).toBeChecked();
    expect(within(catalogVideos).getByLabelText("Travel")).toBeInTheDocument();
    expect(within(catalogVideos).getByLabelText("Blair")).toBeInTheDocument();
    expect(
      within(catalogVideos).queryByLabelText("Secret Tag"),
    ).not.toBeInTheDocument();
    expect(
      within(catalogVideos).queryByLabelText("Secret Performer"),
    ).not.toBeInTheDocument();
    await expandPrimaryPerformerAccordion(catalogVideos, "Blair");
    expect(
      within(catalogVideos).getAllByText("Normal Video").length,
    ).toBeGreaterThan(0);
    expect(
      within(catalogVideos).queryByText("Secret Tag Video"),
    ).not.toBeInTheDocument();
    expect(
      within(catalogVideos).queryByText("Secret Performer Video"),
    ).not.toBeInTheDocument();

    fireEvent.click(hideSecretMetadata);

    expect(hideSecretMetadata).not.toBeChecked();
    expect(
      within(catalogVideos).getByLabelText("Secret Tag"),
    ).toBeInTheDocument();
    expect(
      within(catalogVideos).getByLabelText("Secret Performer"),
    ).toBeInTheDocument();
    await expandPrimaryPerformerAccordion(catalogVideos, "Blair");
    await expandPrimaryPerformerAccordion(catalogVideos, "Secret Performer");
    expect(
      within(catalogVideos).getAllByText("Normal Video").length,
    ).toBeGreaterThan(0);
    expect(
      within(catalogVideos).getAllByText("Secret Tag Video").length,
    ).toBeGreaterThan(0);
    expect(
      within(catalogVideos).getAllByText("Secret Performer Video").length,
    ).toBeGreaterThan(0);
  });

  it("hides public Tag filters when every tagged Video is hidden by secret metadata", async () => {
    mockedListTags.mockResolvedValue([
      { id: 4, isSecret: false, name: "Casal Fist" },
      { id: 5, isSecret: true, name: "Scatbook" },
    ]);
    mockedListPerformers.mockResolvedValue([]);
    mockedTagsForVideo.mockResolvedValue([
      { id: 4, isSecret: false, name: "Casal Fist" },
      { id: 5, isSecret: true, name: "Scatbook" },
    ]);
    mockedPerformersForVideo.mockResolvedValue([]);
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Casal Fist Video"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await waitFor(() => {
      expect(mockedTagsForVideo).toHaveBeenCalledWith(1);
    });

    const hideSecretMetadata =
      await findSecretMetadataVisibilityCheckbox(catalogVideos);

    expect(hideSecretMetadata).toBeChecked();
    expect(
      within(catalogVideos).queryByLabelText("Casal Fist"),
    ).not.toBeInTheDocument();
    expect(
      within(catalogVideos).queryByText("Casal Fist Video"),
    ).not.toBeInTheDocument();

    fireEvent.click(hideSecretMetadata);

    expect(within(catalogVideos).getByLabelText("Casal Fist")).toBeInTheDocument();
    await expandPrimaryPerformerAccordion(catalogVideos);
    expect(within(catalogVideos).getByText("Casal Fist Video")).toBeInTheDocument();
  });

  it("keeps secret metadata available in Video Detail editing while normal browsing hides it", async () => {
    mockedListTags.mockResolvedValue([
      { id: 4, isSecret: false, name: "Travel" },
      { id: 5, isSecret: true, name: "Secret Tag" },
    ]);
    mockedListPerformers.mockResolvedValue([
      { id: 9, isSecret: false, name: "Blair" },
      { id: 10, isSecret: true, name: "Secret Performer" },
    ]);
    mockedTagsForVideo.mockResolvedValue([
      { id: 4, isSecret: false, name: "Travel" },
    ]);
    mockedPerformersForVideo.mockResolvedValue([
      { id: 9, isSecret: false, name: "Blair" },
    ]);
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Normal Video"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await expandPrimaryPerformerAccordion(catalogVideos, "Blair");
    await findExpandedVideoCard(catalogVideos, "Normal Video");

    expect(
      await findSecretMetadataVisibilityCheckbox(catalogVideos),
    ).toBeChecked();
    expect(
      within(catalogVideos).queryByLabelText("Secret Tag"),
    ).not.toBeInTheDocument();
    expect(
      within(catalogVideos).queryByLabelText("Secret Performer"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      await findExpandedVideoCard(catalogVideos, "Normal Video"),
    );

    const videoDetailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    fireEvent.click(
      within(videoDetailPanel).getByRole("button", { name: "Edit Tags" }),
    );
    fireEvent.change(
      within(videoDetailPanel).getByRole("combobox", { name: "Tags" }),
      { target: { value: "Secret Tag" } },
    );
    fireEvent.keyDown(
      within(videoDetailPanel).getByRole("combobox", { name: "Tags" }),
      { key: "Enter" },
    );
    fireEvent.click(
      within(videoDetailPanel).getByRole("button", { name: "Edit Performers" }),
    );
    fireEvent.change(
      within(videoDetailPanel).getByRole("combobox", { name: "Performers" }),
      { target: { value: "Secret Performer" } },
    );
    fireEvent.keyDown(
      within(videoDetailPanel).getByRole("combobox", { name: "Performers" }),
      { key: "Enter" },
    );

    expect(mockedAttachTagToVideo).toHaveBeenCalledWith(5, 1);
    expect(mockedAttachPerformerToVideo).toHaveBeenCalledWith(10, 1);
    expect(mockedCreateTag).not.toHaveBeenCalledWith("Secret Tag");
    expect(mockedCreatePerformer).not.toHaveBeenCalledWith("Secret Performer");
  });

  it("does not show Videos before metadata is loaded while secret metadata is hidden", async () => {
    const secretTagsForVideo = deferredPromise<
      { id: number; isSecret: boolean; name: string }[]
    >();
    const secretPerformersForVideo = deferredPromise<
      { id: number; isSecret: boolean; name: string }[]
    >();
    mockedListTags.mockResolvedValue([
      { id: 4, isSecret: false, name: "Travel" },
      { id: 5, isSecret: true, name: "Secret Tag" },
    ]);
    mockedListPerformers.mockResolvedValue([]);
    mockedTagsForVideo.mockImplementation((videoId) => {
      if (videoId === 2) {
        return secretTagsForVideo.promise;
      }

      return Promise.resolve([{ id: 4, isSecret: false, name: "Travel" }]);
    });
    mockedPerformersForVideo.mockImplementation((videoId) => {
      if (videoId === 2) {
        return secretPerformersForVideo.promise;
      }

      return Promise.resolve([]);
    });
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Normal Video"),
      catalogVideoFixture(2, "Secret Video"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await waitFor(() => {
      expect(mockedTagsForVideo).toHaveBeenCalledWith(2);
    });

    expect(
      within(catalogVideos).queryByText("Normal Video"),
    ).not.toBeInTheDocument();
    expect(
      within(catalogVideos).queryByText("Secret Video"),
    ).not.toBeInTheDocument();

    secretTagsForVideo.resolve([{ id: 5, isSecret: true, name: "Secret Tag" }]);
    secretPerformersForVideo.resolve([]);

    await expandPrimaryPerformerAccordion(catalogVideos);
    expect(await within(catalogVideos).findByText("Normal Video")).toBeInTheDocument();
    expect(
      within(catalogVideos).queryByText("Secret Video"),
    ).not.toBeInTheDocument();
  });

  it("clears selected secret metadata filters when secret metadata is hidden again", async () => {
    mockedListTags.mockResolvedValue([
      { id: 4, isSecret: false, name: "Travel" },
      { id: 5, isSecret: true, name: "Secret Tag" },
    ]);
    mockedListPerformers.mockResolvedValue([
      { id: 9, isSecret: false, name: "Blair" },
      { id: 10, isSecret: true, name: "Secret Performer" },
    ]);
    mockedTagsForVideo.mockImplementation(async (videoId) => {
      if (videoId === 2) {
        return [{ id: 5, isSecret: true, name: "Secret Tag" }];
      }

      return [{ id: 4, isSecret: false, name: "Travel" }];
    });
    mockedPerformersForVideo.mockImplementation(async (videoId) => {
      if (videoId === 2) {
        return [{ id: 10, isSecret: true, name: "Secret Performer" }];
      }

      return [{ id: 9, isSecret: false, name: "Blair" }];
    });
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Normal Video"),
      catalogVideoFixture(2, "Secret Video"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    const hideSecretMetadata =
      await findSecretMetadataVisibilityCheckbox(catalogVideos);

    fireEvent.click(hideSecretMetadata);
    fireEvent.click(within(catalogVideos).getByLabelText("Secret Tag"));
    fireEvent.click(within(catalogVideos).getByLabelText("Secret Performer"));
    await expandPrimaryPerformerAccordion(catalogVideos, "Secret Performer");

    expect(
      within(catalogVideos).queryByText("Normal Video"),
    ).not.toBeInTheDocument();
    expect(within(catalogVideos).getByText("Secret Video")).toBeInTheDocument();

    fireEvent.click(hideSecretMetadata);
    fireEvent.click(hideSecretMetadata);
    await expandPrimaryPerformerAccordion(catalogVideos, "Blair");
    await expandPrimaryPerformerAccordion(catalogVideos, "Secret Performer");

    expect(
      within(catalogVideos).getAllByText("Normal Video").length,
    ).toBeGreaterThan(0);
    expect(
      within(catalogVideos).getAllByText("Secret Video").length,
    ).toBeGreaterThan(0);
    expect(within(catalogVideos).getByLabelText("Secret Tag")).not.toBeChecked();
    expect(
      within(catalogVideos).getByLabelText("Secret Performer"),
    ).not.toBeChecked();
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
      within(catalogVideos).queryByText("Sort Videos"),
    ).not.toBeInTheDocument();
    expect(
      within(catalogVideos).queryByLabelText("File Size"),
    ).not.toBeInTheDocument();

    fireEvent.change(within(catalogVideos).getByLabelText("Sort Videos"), {
      target: { value: "fileSizeAscending" },
    });

    const videoTitles = within(catalogVideos).getAllByRole("article", {
      name: /^(Large Archive|Small Clip)$/,
    });

    expect(
      videoTitles.map((videoCard) => videoCard.getAttribute("aria-label")),
    ).toEqual(["Small Clip", "Large Archive"]);
  });

  it("groups Catalog Videos by first Performer and keeps unassigned Videos visible", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Solo Clip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/solo-clip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
      {
        id: 2,
        title: "Shared Clip",
        durationMilliseconds: 120000,
        fileSizeBytes: 12000000,
        fileLocationPath: "/Volumes/Archive/Videos/shared-clip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
      {
        id: 3,
        title: "Loose Clip",
        durationMilliseconds: 240000,
        fileSizeBytes: 24000000,
        fileLocationPath: "/Volumes/Archive/Videos/loose-clip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);
    mockedPerformersForVideo.mockImplementation(async (videoId) => {
      if (videoId === 1) {
        return [{ id: 9, isSecret: false, name: "Blair" }];
      }

      if (videoId === 2) {
        return [
          { id: 7, isSecret: false, name: "Alex" },
          { id: 9, isSecret: false, name: "Blair" },
        ];
      }

      return [];
    });

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await within(catalogVideos).findByRole("article", {
      name: "Shared Clip",
    });
    const alexHeading = (await within(catalogVideos).findAllByText("Alex"))[0];
    const blairHeading = (await within(catalogVideos).findAllByText("Blair"))[0];
    const unassignedHeading =
      await within(catalogVideos).findByText("Unassigned");
    const sharedClipCard = within(catalogVideos).getByRole("article", {
      name: "Shared Clip",
    });
    const soloClipCard = within(catalogVideos).getByRole("article", {
      name: "Solo Clip",
    });
    const looseClipCard = within(catalogVideos).getByRole("article", {
      name: "Loose Clip",
    });

    expect(sharedClipCard).toBeInTheDocument();
    expect(soloClipCard).toBeInTheDocument();
    expect(looseClipCard).toBeInTheDocument();
    expect(
      Boolean(
        alexHeading.compareDocumentPosition(sharedClipCard) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      Boolean(
        blairHeading.compareDocumentPosition(soloClipCard) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      Boolean(
        unassignedHeading.compareDocumentPosition(looseClipCard) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });

  it("shows collapsed Primary Performer Accordions with thumbnail-only favorite-first Group Preview Strips", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      { ...catalogVideoFixture(1, "Blair First"), isFavorite: false },
      { ...catalogVideoFixture(2, "Blair Favorite"), isFavorite: true },
      { ...catalogVideoFixture(3, "Blair Second"), isFavorite: false },
      { ...catalogVideoFixture(4, "Blair Other Favorite"), isFavorite: true },
    ]);
    mockedPerformersForVideo.mockResolvedValue([
      { id: 9, isSecret: false, name: "Blair" },
    ]);

    renderApp();

    const catalogVideos = await visibleCatalogVideos();
    const blairAccordion = await within(catalogVideos).findByRole("region", {
      name: "Blair Primary Performer Accordion",
    });
    expect(within(blairAccordion).getByText("4 Videos")).toBeInTheDocument();
    expect(
      within(blairAccordion).getByRole("article", {
        name: "Blair Favorite",
      }),
    ).toBeInTheDocument();
    expect(
      within(blairAccordion).getByRole("article", {
        name: "Blair Other Favorite",
      }),
    ).toBeInTheDocument();
    expect(
      within(blairAccordion).getByRole("article", {
        name: "Blair First",
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(blairAccordion).getByRole("button", {
        name: "Blair Primary Performer Accordion",
      }),
    );

    await waitFor(() => {
      expect(
        within(blairAccordion).getAllByRole("article", {
          name: "Blair Favorite",
        }),
      ).toHaveLength(2);
      expect(
        within(blairAccordion).getAllByRole("article", {
          name: "Blair Other Favorite",
        }),
      ).toHaveLength(2);
      expect(
        within(blairAccordion).getAllByRole("article", {
          name: "Blair First",
        }),
      ).toHaveLength(2);
    });
    expect(
      await within(blairAccordion).findByRole("article", {
        name: "Blair Second",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(blairAccordion).getAllByRole("article", {
        name: "Blair Favorite",
      })[0],
    );

    expect(
      await screen.findByRole("region", { name: "Video Detail Panel" }),
    ).toHaveTextContent("Blair Favorite");
  });

  it("does not mount expanded group Videos while a Primary Performer Accordion is collapsed", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      { ...catalogVideoFixture(1, "Blair First"), isFavorite: false },
      { ...catalogVideoFixture(2, "Blair Favorite"), isFavorite: true },
      { ...catalogVideoFixture(3, "Blair Second"), isFavorite: false },
      { ...catalogVideoFixture(4, "Blair Other Favorite"), isFavorite: true },
    ]);
    mockedPerformersForVideo.mockResolvedValue([
      { id: 9, isSecret: false, name: "Blair" },
    ]);

    renderApp();

    const catalogVideos = await visibleCatalogVideos();
    const blairAccordion = await within(catalogVideos).findByRole("region", {
      name: "Blair Primary Performer Accordion",
    });

    expect(
      within(blairAccordion).queryByRole("article", {
        name: "Blair Second",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(blairAccordion).getByRole("button", {
        name: "Blair Primary Performer Accordion",
      }),
    );

    expect(
      await within(blairAccordion).findByRole("article", {
        name: "Blair Second",
      }),
    ).toBeInTheDocument();
  });

  it("shows every group Video in the expanded accordion when the preview strip contains the whole group", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      { ...catalogVideoFixture(1, "Blair First"), isFavorite: false },
      { ...catalogVideoFixture(2, "Blair Favorite"), isFavorite: true },
      { ...catalogVideoFixture(3, "Blair Second"), isFavorite: false },
    ]);
    mockedPerformersForVideo.mockResolvedValue([
      { id: 9, isSecret: false, name: "Blair" },
    ]);

    renderApp();

    const catalogVideos = await visibleCatalogVideos();
    const blairAccordion = await within(catalogVideos).findByRole("region", {
      name: "Blair Primary Performer Accordion",
    });

    fireEvent.click(
      within(blairAccordion).getByRole("button", {
        name: "Blair Primary Performer Accordion",
      }),
    );

    await waitFor(() => {
      expect(
        within(blairAccordion).getAllByRole("article", {
          name: "Blair Favorite",
        }),
      ).toHaveLength(2);
      expect(
        within(blairAccordion).getAllByRole("article", {
          name: "Blair First",
        }),
      ).toHaveLength(2);
      expect(
        within(blairAccordion).getAllByRole("article", {
          name: "Blair Second",
        }),
      ).toHaveLength(2);
    });
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

    const videoTitles = within(catalogVideos).getAllByRole("article", {
      name: /^(Large Archive|Missing Size)$/,
    });

    expect(
      videoTitles.map((videoCard) => videoCard.getAttribute("aria-label")),
    ).toEqual(["Large Archive", "Missing Size"]);
  });

  it("keeps pointer-down selection modifiers when the click event loses them", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Alpha Clip"),
      catalogVideoFixture(2, "Beta Clip"),
      catalogVideoFixture(3, "Gamma Clip"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await expandPrimaryPerformerAccordion(catalogVideos);
    const alphaClipCard = await findExpandedVideoCard(
      catalogVideos,
      "Alpha Clip",
    );
    const betaClipCard = await findExpandedVideoCard(
      catalogVideos,
      "Beta Clip",
    );
    const gammaClipCard = await findExpandedVideoCard(
      catalogVideos,
      "Gamma Clip",
    );

    fireEvent.click(alphaClipCard);
    fireEvent.pointerDown(betaClipCard, { metaKey: true });
    fireEvent.click(betaClipCard);

    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("2 selected");

    fireEvent.click(alphaClipCard);
    fireEvent.pointerDown(gammaClipCard, { shiftKey: true });
    fireEvent.click(gammaClipCard);

    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("3 selected");
  });

  it("uses held keyboard modifiers when pointer and click events lose them", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Alpha Clip"),
      catalogVideoFixture(2, "Beta Clip"),
      catalogVideoFixture(3, "Gamma Clip"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await expandPrimaryPerformerAccordion(catalogVideos);
    const alphaClipCard = await findExpandedVideoCard(
      catalogVideos,
      "Alpha Clip",
    );
    const betaClipCard = await findExpandedVideoCard(
      catalogVideos,
      "Beta Clip",
    );
    const gammaClipCard = await findExpandedVideoCard(
      catalogVideos,
      "Gamma Clip",
    );

    fireEvent.click(alphaClipCard);
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Meta", metaKey: true }),
    );
    fireEvent.pointerDown(betaClipCard);
    fireEvent.click(betaClipCard);
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Meta" }));

    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("2 selected");

    fireEvent.click(alphaClipCard);
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Shift", shiftKey: true }),
    );
    fireEvent.pointerDown(gammaClipCard);
    fireEvent.click(gammaClipCard);
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));

    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("3 selected");
  });

  it("does not start drag selection when a modified pointer starts on a Video card", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Alpha Clip"),
      catalogVideoFixture(2, "Beta Clip"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await expandPrimaryPerformerAccordion(catalogVideos);
    const alphaClipCard = await findExpandedVideoCard(
      catalogVideos,
      "Alpha Clip",
    );
    const betaClipCard = await findExpandedVideoCard(
      catalogVideos,
      "Beta Clip",
    );

    fireEvent.click(alphaClipCard);
    const modifiedPointerDown = new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      metaKey: true,
    });

    betaClipCard.dispatchEvent(modifiedPointerDown);
    fireEvent.click(betaClipCard, { metaKey: true });

    expect(modifiedPointerDown.defaultPrevented).toBe(false);
    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("2 selected");
  });

  it("selects visible Video ranges with shift-click and command-shift-click", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Alpha Clip"),
      catalogVideoFixture(2, "Beta Clip"),
      catalogVideoFixture(3, "Gamma Clip"),
      catalogVideoFixture(4, "Omega Clip"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await expandPrimaryPerformerAccordion(catalogVideos);
    const alphaClipCard = await findExpandedVideoCard(
      catalogVideos,
      "Alpha Clip",
    );
    const betaClipCard = await findExpandedVideoCard(
      catalogVideos,
      "Beta Clip",
    );
    const gammaClipCard = await findExpandedVideoCard(
      catalogVideos,
      "Gamma Clip",
    );
    const omegaClipCard = await findExpandedVideoCard(
      catalogVideos,
      "Omega Clip",
    );

    fireEvent.click(alphaClipCard);
    fireEvent.click(gammaClipCard, { shiftKey: true });

    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("3 selected");

    fireEvent.click(betaClipCard);
    fireEvent.click(omegaClipCard, { metaKey: true, shiftKey: true });

    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("3 selected");
  });

  it("supports keyboard selection in the Videos View", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Alpha Clip"),
      catalogVideoFixture(2, "Beta Clip"),
      catalogVideoFixture(3, "Gamma Clip"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    const alphaClipCard = await within(catalogVideos).findByRole("article", {
      name: "Alpha Clip",
    });
    const gammaClipCard = within(catalogVideos).getByRole("article", {
      name: "Gamma Clip",
    });

    fireEvent.keyDown(alphaClipCard, { key: "Enter" });
    expect(
      await screen.findByRole("region", { name: "Video Detail Panel" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(gammaClipCard, { key: " ", shiftKey: true });
    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("3 selected");
  });

  it("clears Videos View selection when empty space is clicked", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Alpha Clip"),
      catalogVideoFixture(2, "Beta Clip"),
      catalogVideoFixture(3, "Gamma Clip"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    const videoGrid = within(catalogVideos).getByLabelText("Video grid");
    const alphaClipCard = await within(catalogVideos).findByRole("article", {
      name: "Alpha Clip",
    });
    const betaClipCard = within(catalogVideos).getByRole("article", {
      name: "Beta Clip",
    });
    const gammaClipCard = within(catalogVideos).getByRole("article", {
      name: "Gamma Clip",
    });

    fireEvent.click(alphaClipCard);
    expect(
      await screen.findByRole("region", { name: "Video Detail Panel" }),
    ).toHaveTextContent("Alpha Clip");

    fireEvent.pointerDown(videoGrid, { button: 0 });
    fireEvent.pointerUp(videoGrid);

    expect(await screen.findByText("No video selected")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Video Detail Panel" }),
    ).not.toBeInTheDocument();

    fireEvent.click(betaClipCard, { metaKey: true });
    fireEvent.click(gammaClipCard, { metaKey: true });
    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("2 selected");

    fireEvent.pointerDown(videoGrid, { button: 0 });
    fireEvent.pointerUp(videoGrid);

    expect(await screen.findByText("No video selected")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Batch Edit Panel" }),
    ).not.toBeInTheDocument();
  });

  it("keeps Videos View selection when Escape is pressed", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Alpha Clip"),
      catalogVideoFixture(2, "Beta Clip"),
      catalogVideoFixture(3, "Gamma Clip"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    const alphaClipCard = await within(catalogVideos).findByRole("article", {
      name: "Alpha Clip",
    });
    const betaClipCard = within(catalogVideos).getByRole("article", {
      name: "Beta Clip",
    });
    const gammaClipCard = within(catalogVideos).getByRole("article", {
      name: "Gamma Clip",
    });

    fireEvent.click(alphaClipCard);
    expect(
      await screen.findByRole("region", { name: "Video Detail Panel" }),
    ).toHaveTextContent("Alpha Clip");

    fireEvent.keyDown(gammaClipCard, { key: "Escape" });

    expect(
      await screen.findByRole("region", { name: "Video Detail Panel" }),
    ).toHaveTextContent("Alpha Clip");

    fireEvent.click(betaClipCard, { metaKey: true });
    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("2 selected");

    fireEvent.keyDown(gammaClipCard, { key: "Escape" });

    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("2 selected");
    expect(
      screen.queryByRole("region", { name: "Video Detail Panel" }),
    ).not.toBeInTheDocument();
  });

  it("preserves Video Detail Panel selection when Search Filters or sort change", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Family Trip"),
      catalogVideoFixture(2, "City Walk"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    fireEvent.click(
      await within(catalogVideos).findByRole("article", {
        name: "Family Trip",
      }),
    );
    expect(
      await screen.findByRole("region", { name: "Video Detail Panel" }),
    ).toHaveTextContent("Family Trip");

    fireEvent.change(within(catalogVideos).getByLabelText("Search Videos"), {
      target: { value: "City" },
    });

    expect(
      await screen.findByRole("region", { name: "Video Detail Panel" }),
    ).toHaveTextContent("Family Trip");
    expect(
      within(catalogVideos).queryByRole("article", { name: "Family Trip" }),
    ).not.toBeInTheDocument();

    fireEvent.change(within(catalogVideos).getByLabelText("Sort Videos"), {
      target: { value: "fileSizeAscending" },
    });

    expect(
      await screen.findByRole("region", { name: "Video Detail Panel" }),
    ).toHaveTextContent("Family Trip");
  });

  it("preserves Batch Edit selection when Search Filters or sort change", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Family Trip"),
      catalogVideoFixture(2, "City Walk"),
      catalogVideoFixture(3, "Studio Clip"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    const familyTripCard = await within(catalogVideos).findByRole("article", {
      name: "Family Trip",
    });
    const cityWalkCard = within(catalogVideos).getByRole("article", {
      name: "City Walk",
    });

    fireEvent.click(familyTripCard);
    fireEvent.pointerDown(cityWalkCard, { metaKey: true });
    fireEvent.click(cityWalkCard);
    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("2 selected");

    fireEvent.change(within(catalogVideos).getByLabelText("Search Videos"), {
      target: { value: "Studio" },
    });

    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("2 selected");
    expect(
      within(catalogVideos).queryByRole("article", { name: "Family Trip" }),
    ).not.toBeInTheDocument();
    expect(
      within(catalogVideos).queryByRole("article", { name: "City Walk" }),
    ).not.toBeInTheDocument();

    fireEvent.change(within(catalogVideos).getByLabelText("Sort Videos"), {
      target: { value: "fileSizeAscending" },
    });

    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("2 selected");
  });

  it("selects Videos touched by a drag rectangle", async () => {
    const visibleGridTop = 0;
    const scrolledGridTop = -80;
    const selectionStartX = 10;
    const selectionStartY = 10;
    const selectionEndX = 210;
    const selectionEndY = 160;

    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Family Trip"),
      catalogVideoFixture(2, "City Walk"),
      catalogVideoFixture(3, "Studio Clip"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    const videoGrid = within(catalogVideos).getByLabelText("Video grid");
    const familyTripCard = await within(catalogVideos).findByRole("article", {
      name: "Family Trip",
    });
    const cityWalkCard = within(catalogVideos).getByRole("article", {
      name: "City Walk",
    });
    const studioClipCard = within(catalogVideos).getByRole("article", {
      name: "Studio Clip",
    });
    let gridTop = visibleGridTop;

    vi.spyOn(videoGrid, "getBoundingClientRect").mockImplementation(() => ({
      bottom: gridTop + 600,
      height: 600,
      left: 0,
      right: 600,
      top: gridTop,
      width: 600,
      x: 0,
      y: gridTop,
      toJSON: () => ({}),
    }));
    vi.spyOn(familyTripCard, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(cityWalkCard, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      height: 100,
      left: 120,
      right: 220,
      top: 0,
      width: 100,
      x: 120,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(studioClipCard, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      height: 100,
      left: 240,
      right: 340,
      top: 0,
      width: 100,
      x: 240,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(familyTripCard, {
      button: 0,
      clientX: selectionStartX,
      clientY: selectionStartY,
    });
    gridTop = scrolledGridTop;
    fireEvent.pointerMove(videoGrid, {
      clientX: selectionEndX,
      clientY: selectionEndY,
    });

    const selectionRectangle = videoGrid.querySelector(
      '[class*="selectionRectangle"]',
    );
    expect(document.body.style.userSelect).toBe("none");
    expect(selectionRectangle).not.toBeNull();
    expect(selectionRectangle).toHaveStyle({ top: `${selectionStartY}px` });
    expect(familyTripCard.className).toContain("batchSelectedPreviewCard");
    expect(cityWalkCard.className).toContain("batchSelectedPreviewCard");
    expect(studioClipCard.className).not.toContain("batchSelectedPreviewCard");

    fireEvent.pointerUp(cityWalkCard, {
      clientX: selectionEndX,
      clientY: selectionEndY,
    });
    fireEvent.click(cityWalkCard);

    expect(document.body.style.userSelect).toBe("");
    expect(window.getSelection()?.toString()).toBe("");
    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("2 selected");

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    fireEvent.click(cityWalkCard);

    expect(
      await screen.findByRole("region", { name: "Video Detail Panel" }),
    ).toHaveTextContent("City Walk");
    expect(
      screen.queryByRole("region", { name: "Batch Edit Panel" }),
    ).not.toBeInTheDocument();
  });

  it("adds Videos to an existing drag selection with command-click", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Family Trip"),
      catalogVideoFixture(2, "City Walk"),
      catalogVideoFixture(3, "Studio Clip"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    const videoGrid = within(catalogVideos).getByLabelText("Video grid");
    const familyTripCard = await within(catalogVideos).findByRole("article", {
      name: "Family Trip",
    });
    const cityWalkCard = within(catalogVideos).getByRole("article", {
      name: "City Walk",
    });
    const studioClipCard = within(catalogVideos).getByRole("article", {
      name: "Studio Clip",
    });

    vi.spyOn(videoGrid, "getBoundingClientRect").mockReturnValue({
      bottom: 600,
      height: 600,
      left: 0,
      right: 600,
      top: 0,
      width: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(familyTripCard, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(cityWalkCard, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      height: 100,
      left: 120,
      right: 220,
      top: 0,
      width: 100,
      x: 120,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(studioClipCard, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      height: 100,
      left: 240,
      right: 340,
      top: 0,
      width: 100,
      x: 240,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(familyTripCard, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(videoGrid, { clientX: 210, clientY: 80 });
    fireEvent.pointerUp(cityWalkCard, { clientX: 210, clientY: 80 });

    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("2 selected");

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    fireEvent.pointerDown(studioClipCard, { metaKey: true });
    fireEvent.click(studioClipCard);

    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("3 selected");
  });

  it("toggles Videos in an existing selection with command-drag", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Family Trip"),
      catalogVideoFixture(2, "City Walk"),
      catalogVideoFixture(3, "Studio Clip"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    const videoGrid = within(catalogVideos).getByLabelText("Video grid");
    const familyTripCard = await within(catalogVideos).findByRole("article", {
      name: "Family Trip",
    });
    const cityWalkCard = within(catalogVideos).getByRole("article", {
      name: "City Walk",
    });
    const studioClipCard = within(catalogVideos).getByRole("article", {
      name: "Studio Clip",
    });

    vi.spyOn(videoGrid, "getBoundingClientRect").mockReturnValue({
      bottom: 600,
      height: 600,
      left: 0,
      right: 600,
      top: 0,
      width: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(familyTripCard, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(cityWalkCard, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      height: 100,
      left: 120,
      right: 220,
      top: 0,
      width: 100,
      x: 120,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(studioClipCard, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      height: 100,
      left: 240,
      right: 340,
      top: 0,
      width: 100,
      x: 240,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(familyTripCard, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(videoGrid, { clientX: 210, clientY: 80 });
    fireEvent.pointerUp(cityWalkCard, { clientX: 210, clientY: 80 });

    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("2 selected");

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    fireEvent.pointerDown(cityWalkCard, {
      button: 0,
      clientX: 130,
      clientY: 10,
      metaKey: true,
    });
    fireEvent.pointerMove(videoGrid, {
      clientX: 330,
      clientY: 80,
      metaKey: true,
    });
    fireEvent.pointerUp(studioClipCard, {
      clientX: 330,
      clientY: 80,
      metaKey: true,
    });

    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("2 selected");
    expect(familyTripCard.className).toContain("batchSelectedPreviewCard");
    expect(cityWalkCard.className).not.toContain("batchSelectedPreviewCard");
    expect(studioClipCard.className).toContain("batchSelectedPreviewCard");
  });

  it("adds one Video after command-drag selection when command-click emits pointer events only", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Family Trip"),
      catalogVideoFixture(2, "City Walk"),
      catalogVideoFixture(3, "Studio Clip"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    const videoGrid = within(catalogVideos).getByLabelText("Video grid");
    const familyTripCard = await within(catalogVideos).findByRole("article", {
      name: "Family Trip",
    });
    const cityWalkCard = within(catalogVideos).getByRole("article", {
      name: "City Walk",
    });
    const studioClipCard = within(catalogVideos).getByRole("article", {
      name: "Studio Clip",
    });

    vi.spyOn(videoGrid, "getBoundingClientRect").mockReturnValue({
      bottom: 600,
      height: 600,
      left: 0,
      right: 600,
      top: 0,
      width: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(familyTripCard, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(cityWalkCard, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      height: 100,
      left: 120,
      right: 220,
      top: 0,
      width: 100,
      x: 120,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(studioClipCard, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      height: 100,
      left: 240,
      right: 340,
      top: 0,
      width: 100,
      x: 240,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(familyTripCard, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(videoGrid, { clientX: 90, clientY: 80 });
    fireEvent.pointerUp(familyTripCard, { clientX: 90, clientY: 80 });

    await screen.findByRole("region", { name: "Video Detail Panel" });

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    fireEvent.pointerDown(studioClipCard, {
      button: 0,
      clientX: 250,
      clientY: 10,
      metaKey: true,
    });
    fireEvent.pointerMove(videoGrid, {
      clientX: 330,
      clientY: 80,
      metaKey: true,
    });
    fireEvent.pointerUp(studioClipCard, {
      clientX: 330,
      clientY: 80,
      metaKey: true,
    });

    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("2 selected");

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    fireEvent.pointerDown(cityWalkCard, {
      button: 0,
      clientX: 130,
      clientY: 10,
      metaKey: true,
    });
    fireEvent.pointerUp(videoGrid, {
      clientX: 130,
      clientY: 10,
      metaKey: true,
    });

    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toHaveTextContent("3 selected");
  });

  it("shows every matching Video inside an expanded Primary Performer Accordion", async () => {
    const matchingVideos = catalogVideoBatch(43);
    mockedListCatalogVideos.mockResolvedValue(matchingVideos);

    renderApp();

    const catalogVideos = await visibleCatalogVideos();
    await expandPrimaryPerformerAccordion(catalogVideos);

    expect(
      await within(catalogVideos).findByRole("article", {
        name: "Archive Clip 001",
      }),
    ).toBeInTheDocument();
    expect(await findExpandedVideoCard(catalogVideos, "Archive Clip 040")).toBeInTheDocument();
    expect(await findExpandedVideoCard(catalogVideos, "Archive Clip 041")).toBeInTheDocument();
    expect(await findExpandedVideoCard(catalogVideos, "Archive Clip 043")).toBeInTheDocument();
  });

  it("preserves scroll position when Search Filters or sort change", async () => {
    const matchingVideos = catalogVideoBatch(43);
    mockedListCatalogVideos.mockResolvedValue(matchingVideos);

    renderApp();

    const catalogVideos = await visibleCatalogVideos();
    await expandPrimaryPerformerAccordion(catalogVideos);
    Object.defineProperties(catalogVideos, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1200 },
      scrollTop: { configurable: true, value: 760, writable: true },
    });

    fireEvent.change(within(catalogVideos).getByLabelText("Search Videos"), {
      target: { value: "Archive" },
    });

    expect(catalogVideos.scrollTop).toBe(760);

    Object.defineProperty(catalogVideos, "scrollTop", {
      configurable: true,
      value: 760,
      writable: true,
    });
    fireEvent.change(within(catalogVideos).getByLabelText("Sort Videos"), {
      target: { value: "fileSizeAscending" },
    });

    expect(catalogVideos.scrollTop).toBe(760);
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

  it("keeps actions, form controls, and status badges visually consistent", async () => {
    renderApp();

    await openScanModule();

    const chooseFolderButton = await screen.findByRole("button", {
      name: "Choose folder",
    });

    expect(chooseFolderButton).toBeVisible();
    expect(screen.queryByLabelText("Manual path")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "FFmpeg status" }),
    ).not.toBeInTheDocument();

    await openSettingsModule();

    const availableBadge = screen.getAllByText("Available")[0];

    expect(availableBadge).toBeVisible();
    expect(document.documentElement).toHaveAttribute(
      "data-mantine-color-scheme",
      "dark",
    );
  });

  it("does not show a Recently Opened tab because Last Opened is a sort option", async () => {
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
    expect(
      screen.queryByRole("tab", { name: "Recently Opened" }),
    ).not.toBeInTheDocument();
    expect(
      await within(catalogVideos).findByText("Never Opened"),
    ).toBeInTheDocument();

    fireEvent.change(within(catalogVideos).getByLabelText("Sort Videos"), {
      target: { value: "lastOpenedDescending" },
    });

    const videoTitles = within(catalogVideos).getAllByRole("article", {
      name: /^(Older Clip|Fresh Clip|Never Opened)$/,
    });

    expect(
      videoTitles.map((videoCard) => videoCard.getAttribute("aria-label")),
    ).toEqual(["Fresh Clip", "Older Clip", "Never Opened"]);
  });

  it("can show Missing Videos as unavailable in the normal Videos list", async () => {
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
    fireEvent.click(
      within(catalogVideos).getByRole("button", {
        name: "Advanced search",
      }),
    );
    fireEvent.click(
      await within(catalogVideos).findByRole("checkbox", {
        name: "Show unavailable videos",
      }),
    );

    expect(
      await within(catalogVideos).findByText("Family Trip"),
    ).toBeInTheDocument();
    expect(within(catalogVideos).getAllByText("Unavailable").length).toBeGreaterThan(
      0,
    );
    expect(within(catalogVideos).getAllByText("Unknown").length).toBeGreaterThan(
      0,
    );
  });
});
