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
} from "../../test/catalogTestHelpers";

describe("Video Detail Panel integration", () => {
  beforeEach(resetAppTestHarness);

  it("marks and unmarks a Video as Favorite from the Video Detail Panel preview", async () => {
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
      await within(catalogVideos).findByRole("article", {
        name: "Family Trip",
      }),
    );
    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    expect(
      within(detailPanel).queryByRole("checkbox", { name: "Favorite" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(detailPanel).getByRole("button", {
        name: "Mark Family Trip as Favorite",
      }),
    );

    expect(mockedSetVideoFavorite).toHaveBeenCalledWith(1, true);
    await waitFor(() =>
      expect(
        within(detailPanel).getByRole("button", {
          name: "Unmark Family Trip as Favorite",
        }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      within(detailPanel).getByRole("button", {
        name: "Unmark Family Trip as Favorite",
      }),
    );

    expect(mockedSetVideoFavorite).toHaveBeenCalledWith(1, false);
    await waitFor(() =>
      expect(
        within(detailPanel).getByRole("button", {
          name: "Mark Family Trip as Favorite",
        }),
      ).toBeInTheDocument(),
    );
  });

  it("shows a larger Favorite star in the Video Detail Panel than in the Videos View", async () => {
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
    const videosViewFavoriteStar = within(videoCard)
      .getByRole("button", { name: "Mark Family Trip as Favorite" })
      .querySelector("svg");

    fireEvent.click(videoCard);

    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    const detailFavoriteStar = within(detailPanel)
      .getByRole("button", { name: "Mark Family Trip as Favorite" })
      .querySelector("svg");

    expect(detailFavoriteStar).not.toBeNull();
    expect(videosViewFavoriteStar).not.toBeNull();
    expect(Number(detailFavoriteStar?.getAttribute("width"))).toBeGreaterThan(
      Number(videosViewFavoriteStar?.getAttribute("width")),
    );
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
      await within(catalogVideos).findByRole("article", {
        name: "Family Trip",
      }),
    );
    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    fireEvent.click(
      within(detailPanel).getByRole("button", {
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
      await within(catalogVideos).findByRole("article", {
        name: "Family Trip",
      }),
    );
    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    fireEvent.click(
      within(detailPanel).getByRole("button", {
        name: "Mark Family Trip as Favorite",
      }),
    );

    fireEvent.click(within(detailPanel).getByRole("button", { name: "Edit title" }));
    fireEvent.change(within(detailPanel).getByLabelText("Title"), {
      target: { value: "Family Archive" },
    });
    fireEvent.click(
      within(detailPanel).getByRole("button", { name: "Save title" }),
    );
    await within(detailPanel).findByRole("heading", {
      name: "Family Archive",
    });

    favoriteUpdate.resolve(undefined);

    await waitFor(() =>
      expect(
        within(detailPanel).getByRole("button", {
          name: "Unmark Family Archive as Favorite",
        }),
      ).toBeInTheDocument(),
    );
    expect(
      within(catalogVideos).queryByText("Family Trip"),
    ).not.toBeInTheDocument();
  });

  it("opens a Video from the start and refreshes Catalog Videos", async () => {
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
      await within(catalogVideos).findByRole("article", {
        name: "Family Trip",
      }),
    );
    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    fireEvent.click(
      within(detailPanel).getByRole("button", { name: "Open" }),
    );

    await waitFor(() => {
      expect(mockedOpenCatalogVideo).toHaveBeenCalledWith(1, 0);
    });
    await waitFor(() => {
      expect(mockedListCatalogVideos).toHaveBeenCalledTimes(2);
    });
    expect(within(catalogVideos).getByText("Family Trip")).toBeInTheDocument();
  });

  it("plays an allowlisted preferred File Location in the Playback Window and refreshes Catalog Videos", async () => {
    mockedListCatalogVideos
      .mockResolvedValueOnce([
        {
          id: 1,
          title: "Family Trip",
          durationMilliseconds: 3723000,
          fileSizeBytes: 80740352,
          fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
          isAvailable: true,
          fileLocations: [
            {
              path: "/Volumes/Archive/Videos/family-trip.mp4",
              fileSizeBytes: 80740352,
              isPreferred: true,
              isReachable: true,
            },
          ],
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
          fileLocations: [
            {
              path: "/Volumes/Archive/Videos/family-trip.mp4",
              fileSizeBytes: 80740352,
              isPreferred: true,
              isReachable: true,
            },
          ],
          isFavorite: false,
          lastOpenedAt: "2026-05-15 18:00:00",
          openCount: 1,
          previewStrip: pendingPreviewStrip,
        },
      ]);

    renderApp();

    fireEvent.click(
      await screen.findByRole("article", {
        name: "Family Trip",
      }),
    );
    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    fireEvent.click(
      within(detailPanel).getByRole("button", { name: "Play in App" }),
    );

    await waitFor(() => {
      expect(mockedOpenPlaybackWindow).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(mockedListCatalogVideos).toHaveBeenCalledTimes(2);
    });
  });

  it("does not offer Playback Window for a preferred File Location outside the allowlist", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Studio Archive",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/studio-archive.mkv",
        isAvailable: true,
        fileLocations: [
          {
            path: "/Volumes/Archive/Videos/studio-archive.mkv",
            fileSizeBytes: 80740352,
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

    renderApp();

    fireEvent.click(
      await screen.findByRole("article", {
        name: "Studio Archive",
      }),
    );
    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });

    expect(
      within(detailPanel).queryByRole("button", { name: "Play in App" }),
    ).not.toBeInTheDocument();
  });

  it("opens selected Video at the hovered Preview Strip time", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 600000,
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

    fireEvent.click(
      await screen.findByRole("article", {
        name: "Family Trip",
      }),
    );

    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    const previewStrip = within(detailPanel).getByRole("img", {
      name: "Preview Strip for Family Trip",
    });
    previewStrip.getBoundingClientRect = vi.fn(
      () =>
        ({
          left: 0,
          width: 400,
          right: 400,
          top: 0,
          bottom: 225,
          height: 225,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    fireEvent(
      previewStrip,
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: 100,
      }),
    );

    expect(within(detailPanel).getByText("2:30")).toBeInTheDocument();

    fireEvent(
      previewStrip,
      new MouseEvent("click", {
        bubbles: true,
        clientX: 100,
      }),
    );

    await waitFor(() => {
      expect(mockedOpenCatalogVideo).toHaveBeenCalledWith(1, 150);
    });
  });

  it("keeps grid Preview Strip clicks as card selection by default", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 600000,
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

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    const previewStrip = within(catalogVideos).getByRole("img", {
      name: "Preview Strip for Family Trip",
    });

    fireEvent.click(previewStrip);

    expect(mockedOpenCatalogVideo).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("region", {
        name: "Video Detail Panel",
      }),
    ).toBeInTheDocument();
  });

  it("autoplays generated Preview Strips only in the Video Detail Panel when not hovering", async () => {
    const waitForAutoplayFrame = () =>
      new Promise((resolve) =>
        setTimeout(resolve, previewStripAutoplayFrameIntervalMilliseconds + 50),
      );
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 600000,
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

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    const gridPreviewStrip = within(catalogVideos).getByRole("img", {
      name: "Preview Strip for Family Trip",
    });

    fireEvent.click(
      await screen.findByRole("article", {
        name: "Family Trip",
      }),
    );

    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    const detailPreviewStrip = within(detailPanel).getByRole("img", {
      name: "Preview Strip for Family Trip",
    });
    detailPreviewStrip.getBoundingClientRect = vi.fn(
      () =>
        ({
          left: 0,
          width: 400,
          right: 400,
          top: 0,
          bottom: 225,
          height: 225,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    expect(gridPreviewStrip).toHaveStyle({
      backgroundPosition: "0% 57.14285714285714%",
    });
    expect(detailPreviewStrip).toHaveStyle({
      backgroundPosition: "0% 57.14285714285714%",
    });

    await waitForAutoplayFrame();

    expect(gridPreviewStrip).toHaveStyle({
      backgroundPosition: "0% 57.14285714285714%",
    });
    expect(detailPreviewStrip).toHaveStyle({
      backgroundPosition: "25% 57.14285714285714%",
    });

    fireEvent(
      detailPreviewStrip,
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: 100,
      }),
    );

    expect(detailPreviewStrip).toHaveStyle({
      backgroundPosition: "0% 28.57142857142857%",
    });

    await waitForAutoplayFrame();

    expect(detailPreviewStrip).toHaveStyle({
      backgroundPosition: "0% 28.57142857142857%",
    });

    fireEvent.pointerLeave(detailPreviewStrip);

    await waitForAutoplayFrame();

    expect(detailPreviewStrip).toHaveStyle({
      backgroundPosition: "25% 28.57142857142857%",
    });
  });

  it("opens a Video Detail Panel for metadata editing without renaming File Locations", async () => {
    mockedListTags.mockResolvedValue([
      { id: 4, isSecret: false, name: "Travel" },
      { id: 5, isSecret: false, name: "Archive" },
    ]);
    mockedListPerformers.mockResolvedValue([
      { id: 9, isSecret: false, name: "Blair" },
      { id: 10, isSecret: false, name: "Alex" },
    ]);
    mockedTagsForVideo.mockResolvedValue([{ id: 4, isSecret: false, name: "Travel" }]);
    mockedPerformersForVideo.mockResolvedValue([{ id: 9, isSecret: false, name: "Blair" }]);
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
            isReachable: true,
          },
          {
            path: "/Volumes/Backup/Videos/family-trip.mp4",
            fileSizeBytes: 80740352,
            isPreferred: false,
            isReachable: true,
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

    await screen.findByLabelText("Blair");
    fireEvent.click(screen.getByRole("article", { name: "Family Trip" }));

    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    expect(
      within(detailPanel).getByRole("heading", { name: "Family Trip" }),
    ).toBeInTheDocument();
    expect(within(detailPanel).getAllByText("1h 2m").length).toBeGreaterThan(0);
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

    fireEvent.click(within(detailPanel).getByRole("button", { name: "Edit title" }));
    fireEvent.change(within(detailPanel).getByLabelText("Title"), {
      target: { value: "Family Archive" },
    });
    fireEvent.click(
      within(detailPanel).getByRole("button", { name: "Save title" }),
    );
    fireEvent.click(
      within(detailPanel).getByRole("button", {
        name: "Mark Family Trip as Favorite",
      }),
    );
    await waitFor(() => {
      expect(mockedUpdateVideoTitle).toHaveBeenCalledWith(1, "Family Archive");
    });
    expect(mockedSetVideoFavorite).toHaveBeenCalledWith(1, true);
    expect(mockedAttachTagToVideo).not.toHaveBeenCalled();
    expect(mockedDetachTagFromVideo).not.toHaveBeenCalled();
    expect(mockedAttachPerformerToVideo).not.toHaveBeenCalled();
    expect(mockedDetachPerformerFromVideo).not.toHaveBeenCalled();
    expect(mockedListCatalogVideos).not.toHaveBeenCalledWith(
      expect.stringContaining("Family Archive"),
    );
  });

  it("reveals a selected Video in Finder and offers Move to Trash only for reachable File Locations", async () => {
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
            isReachable: true,
          },
        ],
        isAvailable: true,
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
      {
        id: 2,
        title: "Missing Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: null,
        fileLocationPath: null,
        fileLocations: [
          {
            path: "/Volumes/Missing/Videos/missing-trip.mp4",
            fileSizeBytes: 80740352,
            isPreferred: true,
            isReachable: false,
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

    fireEvent.click(await screen.findByRole("article", { name: "Family Trip" }));

    const familyTripPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    fireEvent.click(
      within(familyTripPanel).getByRole("button", { name: "Reveal in Finder" }),
    );
    expect(mockedOpenCatalogVideoContainingFolder).toHaveBeenCalledWith(1);
    expect(
      within(familyTripPanel).getByRole("button", {
        name: "Move Video to Trash",
      }),
    ).toBeInTheDocument();
    expect(
      within(familyTripPanel).getByRole("button", {
        name: "Move /Volumes/Archive/Videos/family-trip.mp4 to Trash",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("article", { name: "Missing Trip" }));

    const missingTripPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    expect(
      within(missingTripPanel).queryByRole("button", {
        name: "Move Video to Trash",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(missingTripPanel).queryByRole("button", {
        name: /Move .* to Trash/,
      }),
    ).not.toBeInTheDocument();
  });

  it("moves one File Location to Trash and refreshes the detail panel when another reachable location remains", async () => {
    mockedListCatalogVideos
      .mockResolvedValueOnce([
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
              isReachable: true,
            },
            {
              path: "/Volumes/Backup/Videos/family-trip.mp4",
              fileSizeBytes: 80740352,
              isPreferred: false,
              isReachable: true,
            },
          ],
          isAvailable: true,
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
          fileLocationPath: "/Volumes/Backup/Videos/family-trip.mp4",
          fileLocations: [
            {
              path: "/Volumes/Backup/Videos/family-trip.mp4",
              fileSizeBytes: 80740352,
              isPreferred: true,
              isReachable: true,
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
    fireEvent.click(await screen.findByRole("article", { name: "Family Trip" }));

    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    fireEvent.click(
      within(detailPanel).getByRole("button", {
        name: "Move /Volumes/Archive/Videos/family-trip.mp4 to Trash",
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Move to Trash" }),
    );

    await waitFor(() => {
      expect(mockedMoveCatalogVideoFileLocationToTrash).toHaveBeenCalledWith(
        1,
        "/Volumes/Archive/Videos/family-trip.mp4",
      );
    });
    expect(
      within(detailPanel).queryByText("/Volumes/Archive/Videos/family-trip.mp4"),
    ).not.toBeInTheDocument();
    expect(
      within(detailPanel).getByText("/Volumes/Backup/Videos/family-trip.mp4"),
    ).toBeInTheDocument();
  });

  it("shows a friendly path-specific Move to Trash failure in the detail panel", async () => {
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
            isReachable: true,
          },
        ],
        isAvailable: true,
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);
    mockedMoveCatalogVideoFileLocationToTrash.mockRejectedValue(
      "Finder denied delete permission",
    );

    renderApp();
    fireEvent.click(await screen.findByRole("article", { name: "Family Trip" }));

    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    fireEvent.click(
      within(detailPanel).getByRole("button", {
        name: "Move /Volumes/Archive/Videos/family-trip.mp4 to Trash",
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Move to Trash" }),
    );

    expect(
      await within(detailPanel).findByText(
        "Could not move this File Location to Trash: /Volumes/Archive/Videos/family-trip.mp4 (Finder denied delete permission).",
      ),
    ).toBeInTheDocument();
    expect(
      within(detailPanel).getByText("/Volumes/Archive/Videos/family-trip.mp4"),
    ).toBeInTheDocument();
  });

  it("moves the last reachable File Location to Trash and clears the Video Detail Panel", async () => {
    mockedListCatalogVideos
      .mockResolvedValueOnce([
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
              isReachable: true,
            },
            {
              path: "/Volumes/Missing/Videos/family-trip.mp4",
              fileSizeBytes: 80740352,
              isPreferred: false,
              isReachable: false,
            },
          ],
          isAvailable: true,
          isFavorite: false,
          lastOpenedAt: null,
          openCount: 0,
          previewStrip: pendingPreviewStrip,
        },
      ])
      .mockResolvedValueOnce([]);

    renderApp();
    fireEvent.click(await screen.findByRole("article", { name: "Family Trip" }));

    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    fireEvent.click(
      within(detailPanel).getByRole("button", {
        name: "Move /Volumes/Archive/Videos/family-trip.mp4 to Trash",
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Move to Trash" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: "Video Detail Panel" }),
      ).not.toBeInTheDocument();
    });
  });

  it("shows selected Video Tags and Performers as metadata Badges", async () => {
    mockedListTags.mockResolvedValue([
      { id: 4, isSecret: false, name: "Travel" },
      { id: 5, isSecret: false, name: "Archive" },
    ]);
    mockedListPerformers.mockResolvedValue([
      { id: 9, isSecret: false, name: "Blair" },
      { id: 10, isSecret: false, name: "Alex" },
    ]);
    mockedTagsForVideo.mockResolvedValue([{ id: 4, isSecret: false, name: "Travel" }]);
    mockedPerformersForVideo.mockResolvedValue([{ id: 9, isSecret: false, name: "Blair" }]);
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

    await screen.findByLabelText("Blair");
    fireEvent.click(screen.getByRole("article", { name: "Family Trip" }));

    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    const tagsSection = within(detailPanel).getByRole("region", {
      name: "Tags",
    });
    const performersSection = within(detailPanel).getByRole("region", {
      name: "Performers",
    });

    expect(await within(tagsSection).findByText("Travel")).toBeInTheDocument();
    expect(
      await within(performersSection).findByText("Blair"),
    ).toBeInTheDocument();
    expect(
      within(tagsSection).getByRole("button", { name: "Edit Tags" }),
    ).toBeInTheDocument();
    expect(
      within(performersSection).getByRole("button", { name: "Edit Performers" }),
    ).toBeInTheDocument();
  });

  it("edits Tags independently with immediate attach, detach, create, Done, and Revert", async () => {
    mockedListTags.mockResolvedValue([
      { id: 4, isSecret: false, name: "Travel" },
      { id: 5, isSecret: false, name: "Archive" },
    ]);
    mockedTagsForVideo.mockResolvedValue([{ id: 4, isSecret: false, name: "Travel" }]);
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
    mockedCreateTag.mockResolvedValue({ id: 6, isSecret: false, name: "Road Trip" });

    renderApp();

    fireEvent.click(await screen.findByRole("article", { name: "Family Trip" }));
    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    const tagsSection = within(detailPanel).getByRole("region", {
      name: "Tags",
    });

    fireEvent.click(within(tagsSection).getByRole("button", { name: "Edit Tags" }));

    expect(
      within(detailPanel).queryByRole("textbox", { name: "Performers" }),
    ).not.toBeInTheDocument();
    expect(
      within(tagsSection).queryByRole("button", { name: "Revert Tags" }),
    ).not.toBeInTheDocument();

    const tagsInput = within(tagsSection).getByRole("combobox", { name: "Tags" });
    fireEvent.keyDown(tagsInput, { key: "Backspace" });
    await waitFor(() => {
      expect(mockedDetachTagFromVideo).toHaveBeenCalledWith(4, 1);
    });
    expect(
      await within(tagsSection).findByRole("button", { name: "Revert Tags" }),
    ).toBeInTheDocument();

    fireEvent.change(tagsInput, { target: { value: "archive" } });
    fireEvent.keyDown(tagsInput, { key: "Enter" });
    await waitFor(() => {
      expect(mockedAttachTagToVideo).toHaveBeenCalledWith(5, 1);
    });
    expect(mockedCreateTag).not.toHaveBeenCalledWith("archive");

    fireEvent.change(tagsInput, { target: { value: "Road Trip" } });
    fireEvent.keyDown(tagsInput, { key: "Enter" });
    await waitFor(() => {
      expect(mockedCreateTag).toHaveBeenCalledWith("Road Trip");
      expect(mockedAttachTagToVideo).toHaveBeenCalledWith(6, 1);
    });

    fireEvent.click(within(tagsSection).getByRole("button", { name: "Revert Tags" }));
    await waitFor(() => {
      expect(mockedAttachTagToVideo).toHaveBeenCalledWith(4, 1);
      expect(mockedDetachTagFromVideo).toHaveBeenCalledWith(5, 1);
      expect(mockedDetachTagFromVideo).toHaveBeenCalledWith(6, 1);
    });
    expect(
      within(tagsSection).getByRole("combobox", { name: "Tags" }),
    ).toBeInTheDocument();

    fireEvent.click(within(tagsSection).getByRole("button", { name: "Done Tags" }));
    expect(
      within(tagsSection).queryByRole("combobox", { name: "Tags" }),
    ).not.toBeInTheDocument();
    expect(mockedUpdateVideoTitle).not.toHaveBeenCalled();
  });

  it("shows quiet metadata empty states and edits Performers independently", async () => {
    mockedListPerformers.mockResolvedValue([
      { id: 9, isSecret: false, name: "Blair" },
      { id: 10, isSecret: false, name: "Alex" },
    ]);
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
    mockedCreatePerformer.mockResolvedValue({ id: 11, isSecret: false, name: "Casey" });

    renderApp();

    fireEvent.click(await screen.findByRole("article", { name: "Family Trip" }));
    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    const tagsSection = within(detailPanel).getByRole("region", {
      name: "Tags",
    });
    const performersSection = within(detailPanel).getByRole("region", {
      name: "Performers",
    });

    expect(within(tagsSection).getByText("No tags")).toBeInTheDocument();
    expect(
      within(performersSection).getByText("No performers"),
    ).toBeInTheDocument();

    fireEvent.click(
      within(performersSection).getByRole("button", {
        name: "Edit Performers",
      }),
    );
    const performersInput = within(performersSection).getByRole("combobox", {
      name: "Performers",
    });
    fireEvent.change(performersInput, { target: { value: "alex" } });
    fireEvent.keyDown(performersInput, { key: "Enter" });
    await waitFor(() => {
      expect(mockedAttachPerformerToVideo).toHaveBeenCalledWith(10, 1);
    });
    expect(mockedCreatePerformer).not.toHaveBeenCalledWith("alex");

    fireEvent.change(performersInput, { target: { value: "Casey" } });
    fireEvent.keyDown(performersInput, { key: "Enter" });
    await waitFor(() => {
      expect(mockedCreatePerformer).toHaveBeenCalledWith("Casey");
      expect(mockedAttachPerformerToVideo).toHaveBeenCalledWith(11, 1);
    });
    expect(
      within(tagsSection).queryByRole("combobox", { name: "Tags" }),
    ).not.toBeInTheDocument();
  });

  it("exits metadata edit mode and resets baselines when switching selected Video", async () => {
    mockedListTags.mockResolvedValue([
      { id: 4, isSecret: false, name: "Travel" },
      { id: 5, isSecret: false, name: "Archive" },
    ]);
    mockedTagsForVideo.mockImplementation(async (videoId) =>
      videoId === 1 ? [{ id: 4, isSecret: false, name: "Travel" }] : [{ id: 5, isSecret: false, name: "Archive" }],
    );
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
        fileSizeBytes: 40740352,
        fileLocationPath: "/Volumes/Archive/Videos/city-walk.mp4",
        fileLocations: [],
        isAvailable: true,
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    fireEvent.click(await screen.findByRole("article", { name: "Family Trip" }));
    const firstDetailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    const firstTagsSection = within(firstDetailPanel).getByRole("region", {
      name: "Tags",
    });
    await within(firstTagsSection).findByText("Travel");
    fireEvent.click(
      within(firstTagsSection).getByRole("button", { name: "Edit Tags" }),
    );
    const tagsInput = within(firstTagsSection).getByRole("combobox", {
      name: "Tags",
    });
    fireEvent.keyDown(tagsInput, { key: "Backspace" });
    await within(firstTagsSection).findByRole("button", { name: "Revert Tags" });

    fireEvent.click(await screen.findByRole("article", { name: "City Walk" }));

    const secondDetailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    const secondTagsSection = within(secondDetailPanel).getByRole("region", {
      name: "Tags",
    });
    expect(
      within(secondTagsSection).queryByRole("combobox", { name: "Tags" }),
    ).not.toBeInTheDocument();
    expect(
      within(secondTagsSection).queryByRole("button", { name: "Revert Tags" }),
    ).not.toBeInTheDocument();
    expect(within(secondTagsSection).getByText("Archive")).toBeInTheDocument();
  });

  it("recreates a detached baseline Tag by name when Revert restores it", async () => {
    mockedListTags
      .mockResolvedValueOnce([{ id: 4, isSecret: false, name: "Travel" }])
      .mockResolvedValueOnce([]);
    mockedTagsForVideo.mockResolvedValue([{ id: 4, isSecret: false, name: "Travel" }]);
    mockedCreateTag.mockResolvedValue({ id: 7, isSecret: false, name: "Travel" });
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

    fireEvent.click(await screen.findByRole("article", { name: "Family Trip" }));
    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    const tagsSection = within(detailPanel).getByRole("region", {
      name: "Tags",
    });
    await within(tagsSection).findByText("Travel");

    fireEvent.click(within(tagsSection).getByRole("button", { name: "Edit Tags" }));
    const tagsInput = within(tagsSection).getByRole("combobox", { name: "Tags" });
    fireEvent.keyDown(tagsInput, { key: "Backspace" });
    await waitFor(() => {
      expect(mockedDetachTagFromVideo).toHaveBeenCalledWith(4, 1);
    });
    await within(tagsSection).findByRole("button", { name: "Revert Tags" });

    fireEvent.click(within(tagsSection).getByRole("button", { name: "Revert Tags" }));

    await waitFor(() => {
      expect(mockedCreateTag).toHaveBeenCalledWith("Travel");
      expect(mockedAttachTagToVideo).toHaveBeenCalledWith(7, 1);
    });
    expect(mockedAttachTagToVideo).not.toHaveBeenCalledWith(4, 1);
  });

  it("does not let a pending Tag detach mutate the next selected Video", async () => {
    const tagDetach = deferredPromise<void>();
    mockedDetachTagFromVideo.mockReturnValue(tagDetach.promise);
    mockedListTags.mockResolvedValue([
      { id: 4, isSecret: false, name: "Travel" },
      { id: 5, isSecret: false, name: "Archive" },
    ]);
    mockedTagsForVideo.mockImplementation(async (videoId) =>
      videoId === 1 ? [{ id: 4, isSecret: false, name: "Travel" }] : [{ id: 5, isSecret: false, name: "Archive" }],
    );
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
        fileSizeBytes: 40740352,
        fileLocationPath: "/Volumes/Archive/Videos/city-walk.mp4",
        fileLocations: [],
        isAvailable: true,
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    fireEvent.click(await screen.findByRole("article", { name: "Family Trip" }));
    const firstDetailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    const firstTagsSection = within(firstDetailPanel).getByRole("region", {
      name: "Tags",
    });
    await within(firstTagsSection).findByText("Travel");
    fireEvent.click(
      within(firstTagsSection).getByRole("button", { name: "Edit Tags" }),
    );
    fireEvent.keyDown(
      within(firstTagsSection).getByRole("combobox", { name: "Tags" }),
      { key: "Backspace" },
    );
    await waitFor(() => {
      expect(mockedDetachTagFromVideo).toHaveBeenCalledWith(4, 1);
    });

    fireEvent.click(await screen.findByRole("article", { name: "City Walk" }));
    const secondDetailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    const secondTagsSection = within(secondDetailPanel).getByRole("region", {
      name: "Tags",
    });
    await within(secondTagsSection).findByText("Archive");

    tagDetach.resolve(undefined);

    await waitFor(() => {
      expect(mockedListTags).toHaveBeenCalled();
    });
    expect(within(secondTagsSection).getByText("Archive")).toBeInTheDocument();
    expect(within(secondTagsSection).queryByText("No tags")).not.toBeInTheDocument();
  });

  it("shows the selected Video title and uses explicit edit controls", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip With A Long Title That Needs Multiple Lines",
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

    fireEvent.click(
      await screen.findByRole("article", {
        name: "Family Trip With A Long Title That Needs Multiple Lines",
      }),
    );

    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    const previewStrip = within(detailPanel).getByText("Pending Preview Strip");
    const openButton = within(detailPanel).getByRole("button", {
      name: "Open",
    });

    expect(within(detailPanel).queryByText("Selected Video")).not.toBeInTheDocument();
    expect(within(detailPanel).queryByText("Video Detial Panel")).not.toBeInTheDocument();
    expect(within(detailPanel).queryByText("Video Detail Panel")).not.toBeInTheDocument();
    expect(
      within(detailPanel).getByRole("heading", {
        name: "Family Trip With A Long Title That Needs Multiple Lines",
      }),
    ).toBeInTheDocument();
    expect(
      previewStrip.compareDocumentPosition(openButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(detailPanel).getByRole("button", { name: "Reveal in Finder" }),
    ).toBeInTheDocument();
    expect(within(detailPanel).queryByText("Duration")).not.toBeInTheDocument();
    expect(within(detailPanel).queryByText("File Size")).not.toBeInTheDocument();
    expect(within(detailPanel).getByRole("region", { name: "Tags" })).toBeInTheDocument();
    expect(
      within(detailPanel).getByRole("region", { name: "Performers" }),
    ).toBeInTheDocument();

    fireEvent.click(within(detailPanel).getByRole("button", { name: "Edit title" }));
    const titleInput = within(detailPanel).getByLabelText("Title");
    fireEvent.change(titleInput, { target: { value: "Ignored Title" } });
    fireEvent.click(within(detailPanel).getByRole("button", { name: "Cancel title edit" }));
    expect(mockedUpdateVideoTitle).not.toHaveBeenCalled();
    expect(
      within(detailPanel).queryByRole("textbox", { name: "Title" }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(detailPanel).getByRole("button", { name: "Edit title" }));
    const titleInputAfterCancel = within(detailPanel).getByLabelText("Title");
    fireEvent.change(titleInputAfterCancel, { target: { value: "Family Archive" } });
    fireEvent.click(within(detailPanel).getByRole("button", { name: "Save title" }));

    await waitFor(() => {
      expect(mockedUpdateVideoTitle).toHaveBeenCalledWith(1, "Family Archive");
    });
    expect(
      within(detailPanel).queryByRole("textbox", { name: "Title" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(detailPanel).getByRole("button", { name: "Reveal in Finder" }),
    );
    expect(mockedOpenCatalogVideoContainingFolder).toHaveBeenCalledWith(1);
  });

  it("uses a wide borderless Video Detail Panel layout", async () => {
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

    fireEvent.click(await screen.findByRole("article", { name: "Family Trip" }));

    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });
    const titleHeading = within(detailPanel).getByRole("heading", {
      name: "Family Trip",
    });

    expect(detailPanel).not.toHaveClass("mantine-Paper-root");
    expect(detailPanel).not.toHaveStyle({ maxWidth: "760px" });
    expect(titleHeading.closest("section")).toBe(detailPanel);
  });

  it("marks the Video with the opened Detail Panel as selected in the Videos list", async () => {
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
        durationMilliseconds: 1840000,
        fileSizeBytes: 40740352,
        fileLocationPath: "/Volumes/Archive/Trips/city-walk.mp4",
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
    const familyTripCard = await within(catalogVideos).findByRole("article", {
      name: "Family Trip",
    });
    const cityWalkCard = within(catalogVideos).getByRole("article", {
      name: "City Walk",
    });

    expect(familyTripCard).not.toHaveAttribute("aria-selected");

    fireEvent.click(familyTripCard);

    expect(
      await screen.findByRole("region", { name: "Video Detail Panel" }),
    ).toBeInTheDocument();
    expect(familyTripCard).toHaveAttribute("aria-selected", "true");
    expect(cityWalkCard).not.toHaveAttribute("aria-selected");
  });
});
