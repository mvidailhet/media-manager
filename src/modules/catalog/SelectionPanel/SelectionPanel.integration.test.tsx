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

describe("Selection Panel integration", () => {
  beforeEach(resetAppTestHarness);

  it("applies Batch Edit metadata and Favorite actions from the aside to selected Videos", async () => {
    mockedListTags.mockResolvedValue([
      { id: 4, isSecret: false, name: "Travel" },
      { id: 5, isSecret: false, name: "Archive" },
      { id: 7, isSecret: false, name: "Unused" },
    ]);
    mockedListPerformers.mockResolvedValue([
      { id: 9, isSecret: false, name: "Blair" },
      { id: 10, isSecret: false, name: "Alex" },
    ]);
    mockedCreateTag.mockResolvedValue({ id: 6, isSecret: false, name: "Road Trip" });
    mockedCreatePerformer.mockResolvedValue({ id: 11, isSecret: false, name: "Casey" });
    mockedTagsForVideo.mockImplementation(async (videoId) => {
      if (videoId === 1) {
        return [{ id: 4, isSecret: false, name: "Travel" }];
      }

      return [{ id: 5, isSecret: false, name: "Archive" }];
    });
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
    await within(catalogVideos).findByLabelText("Blair");
    fireEvent.click(
      within(catalogVideos).getByRole("article", { name: "Family Trip" }),
      { metaKey: true },
    );
    fireEvent.click(
      within(catalogVideos).getByRole("article", { name: "City Walk" }),
      { metaKey: true },
    );

    const batchEditPanel = await screen.findByRole("region", {
      name: "Batch Edit Panel",
    });

    expect(
      screen.queryByRole("region", { name: "Video Detail Panel" }),
    ).not.toBeInTheDocument();
    expect(within(batchEditPanel).queryByLabelText("Title")).toBeNull();
    expect(
      within(batchEditPanel).queryByRole("button", {
        name: /Replace/,
      }),
    ).toBeNull();
    expect(within(batchEditPanel).getByText("Travel on some selected Videos"))
      .toBeInTheDocument();
    expect(within(batchEditPanel).getByText("Archive on some selected Videos"))
      .toBeInTheDocument();
    expect(within(batchEditPanel).getByText("Blair on all selected Videos"))
      .toBeInTheDocument();

    const tagsInput = within(batchEditPanel).getByRole("combobox", {
      name: "Tags",
    });
    fireEvent.change(tagsInput, { target: { value: "Unused" } });
    fireEvent.keyDown(tagsInput, { key: "Enter" });
    fireEvent.change(tagsInput, { target: { value: "Road Trip" } });
    fireEvent.keyDown(tagsInput, { key: "Enter" });

    const performersInput = within(batchEditPanel).getByRole("combobox", {
      name: "Performers",
    });
    fireEvent.keyDown(performersInput, { key: "Backspace" });
    fireEvent.change(performersInput, { target: { value: "Casey" } });
    fireEvent.keyDown(performersInput, { key: "Enter" });

    expect(
      within(batchEditPanel).queryByRole("button", {
        name: "Unmark selected Videos as Favorite",
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(batchEditPanel).getByRole("button", {
        name: "Mark selected Videos as Favorite",
      }),
    );
    await waitFor(() => {
      expect(
        within(batchEditPanel).getByRole("button", {
          name: "Unmark selected Videos as Favorite",
        }),
      ).toBeInTheDocument();
    });
    fireEvent.click(
      within(batchEditPanel).getByRole("button", {
        name: "Unmark selected Videos as Favorite",
      }),
    );

    await waitFor(() => {
      expect(mockedAttachTagToVideo).toHaveBeenCalledWith(7, 1);
      expect(mockedAttachTagToVideo).toHaveBeenCalledWith(7, 2);
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

  it("keeps secret metadata available in Batch Metadata Edit while normal browsing hides it", async () => {
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
      catalogVideoFixture(2, "Second Normal Video"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await within(catalogVideos).findByText("Normal Video");

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
      within(catalogVideos).getByRole("article", { name: "Normal Video" }),
      { metaKey: true },
    );
    fireEvent.click(
      within(catalogVideos).getByRole("article", {
        name: "Second Normal Video",
      }),
      { metaKey: true },
    );

    const batchEditPanel = await screen.findByRole("region", {
      name: "Batch Edit Panel",
    });
    const tagsInput = within(batchEditPanel).getByRole("combobox", {
      name: "Tags",
    });
    fireEvent.change(tagsInput, { target: { value: "Secret Tag" } });
    fireEvent.keyDown(tagsInput, { key: "Enter" });

    const performersInput = within(batchEditPanel).getByRole("combobox", {
      name: "Performers",
    });
    fireEvent.change(performersInput, {
      target: { value: "Secret Performer" },
    });
    fireEvent.keyDown(performersInput, { key: "Enter" });

    await waitFor(() => {
      expect(mockedAttachTagToVideo).toHaveBeenCalledWith(5, 1);
      expect(mockedAttachTagToVideo).toHaveBeenCalledWith(5, 2);
      expect(mockedAttachPerformerToVideo).toHaveBeenCalledWith(10, 1);
      expect(mockedAttachPerformerToVideo).toHaveBeenCalledWith(10, 2);
    });
    expect(mockedCreateTag).not.toHaveBeenCalledWith("Secret Tag");
    expect(mockedCreatePerformer).not.toHaveBeenCalledWith("Secret Performer");
  });

  it("clears a Performer filter when Batch Edit removes that Performer from every matching Video", async () => {
    mockedListPerformers.mockResolvedValue([{ id: 9, isSecret: false, name: "Blair" }]);
    mockedPerformersForVideo.mockResolvedValue([{ id: 9, isSecret: false, name: "Blair" }]);
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Family Trip"),
      catalogVideoFixture(2, "City Walk"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await within(catalogVideos).findByLabelText("Blair");

    fireEvent.click(within(catalogVideos).getByLabelText("Blair"));
    fireEvent.click(
      within(catalogVideos).getByRole("article", { name: "Family Trip" }),
      { metaKey: true },
    );
    fireEvent.click(
      within(catalogVideos).getByRole("article", { name: "City Walk" }),
      { metaKey: true },
    );

    const batchEditPanel = await screen.findByRole("region", {
      name: "Batch Edit Panel",
    });
    const performersInput = within(batchEditPanel).getByRole("combobox", {
      name: "Performers",
    });

    fireEvent.keyDown(performersInput, { key: "Backspace" });

    await waitFor(() => {
      expect(mockedDetachPerformerFromVideo).toHaveBeenCalledWith(9, 1);
      expect(mockedDetachPerformerFromVideo).toHaveBeenCalledWith(9, 2);
    });
    expect(within(catalogVideos).queryByLabelText("Blair")).not.toBeInTheDocument();
    expect(within(catalogVideos).getByText("Family Trip")).toBeInTheDocument();
    expect(within(catalogVideos).getByText("City Walk")).toBeInTheDocument();
  });

  it("clears a Tag filter when Batch Edit removes that Tag from every matching Video", async () => {
    mockedListTags.mockResolvedValue([{ id: 4, isSecret: false, name: "Travel" }]);
    mockedTagsForVideo.mockResolvedValue([{ id: 4, isSecret: false, name: "Travel" }]);
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Family Trip"),
      catalogVideoFixture(2, "City Walk"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await within(catalogVideos).findByLabelText("Travel");

    fireEvent.click(within(catalogVideos).getByLabelText("Travel"));
    fireEvent.click(
      within(catalogVideos).getByRole("article", { name: "Family Trip" }),
      { metaKey: true },
    );
    fireEvent.click(
      within(catalogVideos).getByRole("article", { name: "City Walk" }),
      { metaKey: true },
    );

    const batchEditPanel = await screen.findByRole("region", {
      name: "Batch Edit Panel",
    });
    const tagsInput = within(batchEditPanel).getByRole("combobox", {
      name: "Tags",
    });

    fireEvent.keyDown(tagsInput, { key: "Backspace" });

    await waitFor(() => {
      expect(mockedDetachTagFromVideo).toHaveBeenCalledWith(4, 1);
      expect(mockedDetachTagFromVideo).toHaveBeenCalledWith(4, 2);
    });
    expect(within(catalogVideos).queryByLabelText("Travel")).not.toBeInTheDocument();
    expect(within(catalogVideos).getByText("Family Trip")).toBeInTheDocument();
    expect(within(catalogVideos).getByText("City Walk")).toBeInTheDocument();
  });

  it("uses file-explorer gestures to switch between Video Detail and Batch Edit selection", async () => {
    mockedListTags.mockResolvedValue([
      { id: 4, isSecret: false, name: "Travel" },
      { id: 5, isSecret: false, name: "Archive" },
    ]);
    mockedListPerformers.mockResolvedValue([
      { id: 9, isSecret: false, name: "Blair" },
      { id: 10, isSecret: false, name: "Alex" },
    ]);
    mockedTagsForVideo.mockImplementation(async (videoId) => {
      if (videoId === 1) {
        return [{ id: 4, isSecret: false, name: "Travel" }];
      }

      return [{ id: 5, isSecret: false, name: "Archive" }];
    });
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
      {
        id: 2,
        title: "City Walk",
        durationMilliseconds: 1800000,
        fileSizeBytes: 50740352,
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

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await within(catalogVideos).findByLabelText("Blair");

    expect(
      within(catalogVideos).queryByLabelText("Select Family Trip"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(catalogVideos).getByRole("article", { name: "Family Trip" }),
    );
    const detailPanel = await screen.findByRole("region", {
      name: "Video Detail Panel",
    });

    fireEvent.click(
      within(catalogVideos).getByRole("article", { name: "City Walk" }),
      { metaKey: true },
    );
    const batchEditPanel = await screen.findByRole("region", {
      name: "Batch Edit Panel",
    });
    expect(batchEditPanel).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Video Detail Panel" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(catalogVideos).getByRole("article", { name: "City Walk" }),
      { metaKey: true },
    );
    expect(
      await screen.findByRole("region", { name: "Video Detail Panel" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Batch Edit Panel" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Family Trip" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "City Walk" }),
    ).not.toBeInTheDocument();
  });

  it("moves selected Videos' reachable Preferred File Locations to Trash and clears Batch Edit", async () => {
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
        {
          id: 2,
          title: "City Walk",
          durationMilliseconds: 1800000,
          fileSizeBytes: 50740352,
          fileLocationPath: "/Volumes/Archive/Videos/city-walk.mp4",
          fileLocations: [
            {
              path: "/Volumes/Archive/Videos/city-walk.mp4",
              fileSizeBytes: 50740352,
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
          id: 3,
          title: "Missing Trip",
          durationMilliseconds: 1200000,
          fileSizeBytes: null,
          fileLocationPath: null,
          fileLocations: [
            {
              path: "/Volumes/Missing/Videos/missing-trip.mp4",
              fileSizeBytes: 30740352,
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

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    fireEvent.click(
      await within(catalogVideos).findByRole("article", {
        name: "Family Trip",
      }),
      { metaKey: true },
    );
    fireEvent.click(
      within(catalogVideos).getByRole("article", { name: "City Walk" }),
      { metaKey: true },
    );
    fireEvent.click(
      within(catalogVideos).getByRole("article", { name: "Missing Trip" }),
      { metaKey: true },
    );

    const batchEditPanel = await screen.findByRole("region", {
      name: "Batch Edit Panel",
    });
    fireEvent.click(
      within(batchEditPanel).getByRole("button", {
        name: "Move selected Videos to Trash",
      }),
    );

    const confirmation = await screen.findByRole("dialog", {
      name: "Move 2 files to Trash?",
    });
    expect(confirmation).toHaveTextContent("3 selected Videos");
    expect(
      within(confirmation).getByText("/Volumes/Archive/Videos/family-trip.mp4"),
    ).toBeInTheDocument();
    expect(
      within(confirmation).getByText("/Volumes/Archive/Videos/city-walk.mp4"),
    ).toBeInTheDocument();
    expect(
      within(confirmation).queryByText("/Volumes/Backup/Videos/family-trip.mp4"),
    ).not.toBeInTheDocument();
    expect(
      within(confirmation).queryByText("/Volumes/Missing/Videos/missing-trip.mp4"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Move to Trash" }),
    );

    await waitFor(() => {
      expect(mockedMoveCatalogVideoFileLocationToTrash).toHaveBeenCalledWith(
        1,
        "/Volumes/Archive/Videos/family-trip.mp4",
      );
      expect(mockedMoveCatalogVideoFileLocationToTrash).toHaveBeenCalledWith(
        2,
        "/Volumes/Archive/Videos/city-walk.mp4",
      );
    });
    expect(mockedMoveCatalogVideoFileLocationToTrash).toHaveBeenCalledTimes(2);

    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: "Batch Edit Panel" }),
      ).not.toBeInTheDocument();
    });
    expect(
      within(catalogVideos).getByRole("article", { name: "Family Trip" }),
    ).toBeInTheDocument();
    expect(
      within(catalogVideos).queryByRole("article", { name: "City Walk" }),
    ).not.toBeInTheDocument();
  });

  it("summarizes partial Move to Trash batch results without rolling back successful moves", async () => {
    mockedListCatalogVideos
      .mockResolvedValueOnce([
        {
          ...catalogVideoFixture(1, "Family Trip"),
          fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
          fileLocations: [
            {
              path: "/Volumes/Archive/Videos/family-trip.mp4",
              fileSizeBytes: 80740352,
              isPreferred: true,
              isReachable: true,
            },
          ],
        },
        {
          ...catalogVideoFixture(2, "City Walk"),
          fileLocationPath: "/Volumes/Archive/Videos/city-walk.mp4",
          fileLocations: [
            {
              path: "/Volumes/Archive/Videos/city-walk.mp4",
              fileSizeBytes: 50740352,
              isPreferred: true,
              isReachable: true,
            },
          ],
        },
        {
          ...catalogVideoFixture(3, "Missing Trip"),
          fileLocationPath: null,
          fileSizeBytes: null,
          fileLocations: [
            {
              path: "/Volumes/Missing/Videos/missing-trip.mp4",
              fileSizeBytes: 30740352,
              isPreferred: true,
              isReachable: false,
            },
          ],
        },
      ])
      .mockResolvedValueOnce([
        {
          ...catalogVideoFixture(2, "City Walk"),
          fileLocationPath: "/Volumes/Archive/Videos/city-walk.mp4",
          fileLocations: [
            {
              path: "/Volumes/Archive/Videos/city-walk.mp4",
              fileSizeBytes: 50740352,
              isPreferred: true,
              isReachable: true,
            },
          ],
        },
        {
          ...catalogVideoFixture(3, "Missing Trip"),
          fileLocationPath: null,
          fileSizeBytes: null,
          fileLocations: [
            {
              path: "/Volumes/Missing/Videos/missing-trip.mp4",
              fileSizeBytes: 30740352,
              isPreferred: true,
              isReachable: false,
            },
          ],
        },
      ]);
    mockedMoveCatalogVideoFileLocationToTrash
      .mockResolvedValueOnce()
      .mockRejectedValueOnce("Finder denied delete permission");

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    fireEvent.click(
      await within(catalogVideos).findByRole("article", {
        name: "Family Trip",
      }),
      { metaKey: true },
    );
    fireEvent.click(
      within(catalogVideos).getByRole("article", { name: "City Walk" }),
      { metaKey: true },
    );
    fireEvent.click(
      within(catalogVideos).getByRole("article", { name: "Missing Trip" }),
      { metaKey: true },
    );

    const batchEditPanel = await screen.findByRole("region", {
      name: "Batch Edit Panel",
    });
    fireEvent.click(
      within(batchEditPanel).getByRole("button", {
        name: "Move selected Videos to Trash",
      }),
    );
    fireEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Move 2 files to Trash?" }),
      ).getByRole("button", { name: "Move to Trash" }),
    );

    expect(await screen.findByText(/Move to Trash finished/)).toHaveTextContent(
      "Move to Trash finished: 1 moved, 1 skipped, 1 failed.",
    );
    expect(screen.getByText(/Move to Trash finished/)).toHaveTextContent(
      "Moved: /Volumes/Archive/Videos/family-trip.mp4. Skipped: /Volumes/Missing/Videos/missing-trip.mp4. Failed: /Volumes/Archive/Videos/city-walk.mp4 (Finder denied delete permission).",
    );
    expect(mockedMoveCatalogVideoFileLocationToTrash).toHaveBeenCalledTimes(2);
    expect(
      within(catalogVideos).queryByRole("article", { name: "Family Trip" }),
    ).not.toBeInTheDocument();
    expect(
      within(catalogVideos).getByRole("article", { name: "City Walk" }),
    ).toBeInTheDocument();
  });

  it("skips selected Videos without reachable Preferred File Locations and clears Batch Edit", async () => {
    const unavailableVideos = [
      {
        id: 1,
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
      {
        id: 2,
        title: "Offline Walk",
        durationMilliseconds: 1800000,
        fileSizeBytes: null,
        fileLocationPath: null,
        fileLocations: [
          {
            path: "/Volumes/Offline/Videos/offline-walk.mp4",
            fileSizeBytes: 50740352,
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
    ];
    mockedListCatalogVideos
      .mockResolvedValueOnce(unavailableVideos)
      .mockResolvedValueOnce(unavailableVideos);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    fireEvent.click(
      await within(catalogVideos).findByRole("article", {
        name: "Missing Trip",
      }),
      { metaKey: true },
    );
    fireEvent.click(
      within(catalogVideos).getByRole("article", { name: "Offline Walk" }),
      { metaKey: true },
    );

    const batchEditPanel = await screen.findByRole("region", {
      name: "Batch Edit Panel",
    });
    fireEvent.click(
      within(batchEditPanel).getByRole("button", {
        name: "Move selected Videos to Trash",
      }),
    );

    const confirmation = await screen.findByRole("dialog", {
      name: "Move selected Videos to Trash?",
    });
    expect(confirmation).toHaveTextContent("2 selected Videos");
    expect(confirmation).toHaveTextContent(
      "No reachable Preferred File Locations will be moved to Trash.",
    );

    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Move to Trash" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: "Batch Edit Panel" }),
      ).not.toBeInTheDocument();
    });
    expect(mockedMoveCatalogVideoFileLocationToTrash).not.toHaveBeenCalled();
  });
});
