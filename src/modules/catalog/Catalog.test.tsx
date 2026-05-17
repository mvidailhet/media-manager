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
  mockedOpenCatalogVideoContainingFolder,
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
} from "../../test/AppTestHarness";

describe("Catalog module", () => {
  beforeEach(resetAppTestHarness);

  function expandMetadataSuggestionBranch(
    metadataSuggestions: HTMLElement,
    scanRootPath: string,
    folderPath: string,
  ) {
    fireEvent.click(
      getMetadataSuggestionTreeLabel(metadataSuggestions, scanRootPath),
    );
    for (const folderName of folderPath.split("/").filter(Boolean)) {
      fireEvent.click(
        getMetadataSuggestionTreeLabel(metadataSuggestions, folderName),
      );
    }
  }

  function getMetadataSuggestionTreeLabel(
    metadataSuggestions: HTMLElement,
    label: string,
  ) {
    return within(metadataSuggestions).getByText((_content, element) => {
      return element?.tagName === "P" && element.textContent === label;
    });
  }

  it("reviews Metadata Suggestions inside Catalog with selectable affected Video context", async () => {
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

    fireEvent.click(await screen.findByRole("tab", { name: "Metadata Suggestions" }));

    const metadataSuggestions = await screen.findByRole("region", {
      name: "Metadata Suggestions",
    });
    expect(within(metadataSuggestions).getByText("Travel")).toBeInTheDocument();
    fireEvent.click(
      getMetadataSuggestionTreeLabel(metadataSuggestions, "/Volumes/Archive"),
    );

    expect(
      within(metadataSuggestions).queryByRole("button", {
        name: "Review Family Trip",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(metadataSuggestions).getByText("Trips/Family Trip"));

    expect(
      await screen.findByRole("region", { name: "Video Detail Panel" }),
    ).toBeInTheDocument();
  });

  it("loads Catalog Videos into the Videos View", async () => {
    mockedTagsForVideo.mockResolvedValue([{ id: 4, name: "Travel" }]);
    mockedPerformersForVideo.mockResolvedValue([{ id: 9, name: "Blair" }]);
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

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    const videoCard = within(catalogVideos).getByRole("article", {
      name: "Family Trip",
    });

    expect(within(videoCard).getByText("Family Trip")).toBeInTheDocument();
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
    expect(await within(videoCard).findByText("Travel")).toBeInTheDocument();
    expect(await within(videoCard).findByText("Blair")).toBeInTheDocument();
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

  it("filters Catalog Videos by text and duration while keeping Missing Videos visible", async () => {
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
    expect(
      within(catalogVideos).getByPlaceholderText("Search Videos"),
    ).toHaveAccessibleName("Search Videos");
    expect(
      within(catalogVideos).queryByText("Search Videos"),
    ).not.toBeInTheDocument();
    expect(
      within(catalogVideos).queryByLabelText("Favorites only"),
    ).not.toBeInTheDocument();
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

    fireEvent.click(advancedSearchButton);

    expect(
      within(catalogVideos).getByRole("button", {
        name: "Advanced search",
        expanded: true,
      }),
    ).toBeInTheDocument();
    expect(
      within(catalogVideos).getByRole("slider", {
        name: "Minimum duration",
      }),
    ).toBeInTheDocument();
    expect(
      within(catalogVideos).getByRole("slider", {
        name: "Maximum duration",
      }),
    ).toBeInTheDocument();
    expect(within(catalogVideos).getByText("0m - 3h")).toBeInTheDocument();

    fireEvent.change(within(catalogVideos).getByLabelText("Search Videos"), {
      target: { value: "family" },
    });

    expect(within(catalogVideos).getByText("Family Trip")).toBeInTheDocument();
    expect(
      within(catalogVideos).getByText("Archive Family Cut"),
    ).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Unavailable")).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("tab", { name: "Favorites" }));

    expect(
      screen.getByRole("tab", { name: "Favorites", selected: true }),
    ).toBeInTheDocument();
    expect(
      within(catalogVideos).queryByLabelText("Favorites only"),
    ).not.toBeInTheDocument();
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

  it("opens a Video from the grid and refreshes Catalog Videos", async () => {
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
      expect(mockedOpenCatalogVideo).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(mockedListCatalogVideos).toHaveBeenCalledTimes(2);
    });
    expect(within(catalogVideos).getByText("Family Trip")).toBeInTheDocument();
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
    fireEvent.change(
      within(batchMetadataEdit).getByLabelText("New Performer"),
      {
        target: { value: "Casey" },
      },
    );
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
    fireEvent.click(await screen.findByRole("article", { name: "Family Trip" }));
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
    await within(detailPanel).findByRole("heading", { name: "Family Trip" });

    fireEvent.click(
      within(batchMetadataEdit).getByRole("button", {
        name: "Remove Travel from selected Videos",
      }),
    );
    await within(detailPanel).findByRole("heading", { name: "Family Trip" });
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

    fireEvent.click(await screen.findByRole("article", { name: "Family Trip" }));

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

  it("shows selected Video Tags and Performers as metadata pills", async () => {
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

    expect(within(tagsSection).getByText("Travel")).toBeInTheDocument();
    expect(within(performersSection).getByText("Blair")).toBeInTheDocument();
    expect(
      within(tagsSection).getByRole("button", { name: "Edit Tags" }),
    ).toBeInTheDocument();
    expect(
      within(performersSection).getByRole("button", { name: "Edit Performers" }),
    ).toBeInTheDocument();
  });

  it("edits Tags independently with immediate attach, detach, create, Done, and Revert", async () => {
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
        fileLocations: [],
        isAvailable: true,
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);
    mockedCreateTag.mockResolvedValue({ id: 6, name: "Road Trip" });

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
      { id: 9, name: "Blair" },
      { id: 10, name: "Alex" },
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
    mockedCreatePerformer.mockResolvedValue({ id: 11, name: "Casey" });

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
      { id: 4, name: "Travel" },
      { id: 5, name: "Archive" },
    ]);
    mockedTagsForVideo.mockImplementation(async (videoId) =>
      videoId === 1 ? [{ id: 4, name: "Travel" }] : [{ id: 5, name: "Archive" }],
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
      within(detailPanel).getByRole("button", { name: "Open in finder" }),
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

    fireEvent.click(within(detailPanel).getByRole("button", { name: "Open in finder" }));
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
    expect(within(catalogVideos).getByText("Unknown")).toBeInTheDocument();
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
    const manualPathInput = screen.getByLabelText("Manual path");

    expect(chooseFolderButton).toBeVisible();
    expect(manualPathInput).toBeVisible();
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

  it("lists Metadata Suggestions in checked collapsible trees grouped by Scan Root and relative folder", async () => {
    const metadataSuggestionGroups = [
      {
        suggestedValue: "Family",
        suggestionKind: "tag",
        sources: [
          {
            scanRootPath: "/Volumes/Archive/Videos",
            sourcePathSegment: "  Family  ",
            videos: [
              {
                videoId: 7,
                title: "Family Trip",
                fileLocationPath:
                  "/Volumes/Archive/Videos/Family/Trips/family-trip.mp4",
              },
              {
                videoId: 8,
                title: "Birthday",
                fileLocationPath: "/Volumes/Archive/Videos/Family/birthday.mp4",
              },
            ],
          },
          {
            scanRootPath: "/Volumes/Camera/Videos",
            sourcePathSegment: "family",
            videos: [
              {
                videoId: 9,
                title: "Picnic",
                fileLocationPath: "/Volumes/Camera/Videos/family/picnic.mp4",
              },
            ],
          },
        ],
      },
    ];
    mockedListMetadataSuggestionGroups.mockImplementation(
      async () => metadataSuggestionGroups,
    );

    renderApp();
    await openMetadataSuggestionsView();

    let metadataSuggestions = await screen.findByRole("region", {
      name: "Metadata Suggestions",
    });

    expect(
      within(metadataSuggestions).queryByRole("heading", {
        name: "Metadata Suggestions",
      }),
    ).not.toBeInTheDocument();
    expect(await within(metadataSuggestions).findByText("Family")).toBeInTheDocument();
    metadataSuggestions = screen.getByRole("region", {
      name: "Metadata Suggestions",
    });
    expect(within(metadataSuggestions).getAllByText("Tag")[0]).toBeInTheDocument();
    expect(
      within(metadataSuggestions).queryByText(
        (_content, element) => element?.textContent === "  Family  ",
      ),
    ).not.toBeInTheDocument();
    expect(
      within(metadataSuggestions).queryByText("Source Segment"),
    ).not.toBeInTheDocument();
    expect(
      within(metadataSuggestions).queryByText("Scan Root"),
    ).not.toBeInTheDocument();
    expect(
      within(metadataSuggestions).queryByText("Accepted metadata name"),
    ).not.toBeInTheDocument();
    expect(
      within(metadataSuggestions).queryByText("Accept Family as metadata kind"),
    ).not.toBeInTheDocument();
    expect(
      within(metadataSuggestions).getByRole("checkbox", {
        name: "/Volumes/Archive/Videos",
      }),
    ).toBeInTheDocument();
    expect(
      within(metadataSuggestions).queryByRole("checkbox", { name: "Family" }),
    ).not.toBeInTheDocument();
    expect(
      within(metadataSuggestions).queryByText("Family Trip"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(metadataSuggestions).getAllByText((_content, element) => {
        return (
          element?.tagName === "P" &&
          element.textContent === "/Volumes/Archive/Videos"
        );
      })[0],
    );
    expect(
      within(metadataSuggestions).getByRole("checkbox", { name: "Family" }),
    ).toBeInTheDocument();
    expect(
      within(metadataSuggestions).queryByRole("checkbox", { name: "Trips" }),
    ).not.toBeInTheDocument();
    fireEvent.click(getMetadataSuggestionTreeLabel(metadataSuggestions, "Family"));
    expect(
      within(metadataSuggestions).getByRole("checkbox", {
        name: "Trips/Family Trip",
      }),
    ).toBeInTheDocument();
    expect(
      within(metadataSuggestions).getByText("Trips/Family Trip"),
    ).toBeInTheDocument();
    expect(
      within(metadataSuggestions).getByText("Birthday"),
    ).toBeInTheDocument();
    expect(within(metadataSuggestions).queryByText("Picnic")).not.toBeInTheDocument();
    fireEvent.click(
      getMetadataSuggestionTreeLabel(
        metadataSuggestions,
        "/Volumes/Camera/Videos",
      ),
    );
    expect(
      within(metadataSuggestions).getByText("family/Picnic"),
    ).toBeInTheDocument();
    expect(
      within(metadataSuggestions).queryByText(
        "/Volumes/Archive/Videos/Family/family-trip.mp4",
      ),
    ).not.toBeInTheDocument();
    expect(
      within(metadataSuggestions).queryByText("family-trip.mp4"),
    ).not.toBeInTheDocument();
  });

  it("merges Metadata Suggestion tree branches with only one child", async () => {
    mockedListMetadataSuggestionGroups.mockResolvedValue([
      {
        suggestedValue: "Best",
        suggestionKind: "tag",
        sources: [
          {
            scanRootPath: "/Volumes/Archive/Videos",
            sourcePathSegment: "Best",
            videos: [
              {
                videoId: 7,
                title: "File",
                fileLocationPath:
                  "/Volumes/Archive/Videos/Best/Maniac Alisa/file.mp4",
              },
              {
                videoId: 8,
                title: "file 1",
                fileLocationPath:
                  "/Volumes/Archive/Videos/Cum in throat/Slad/Best/file-1.mp4",
              },
              {
                videoId: 9,
                title: "file 2",
                fileLocationPath:
                  "/Volumes/Archive/Videos/Cum in throat/Slad/Best/file-2.mp4",
              },
            ],
          },
        ],
      },
    ]);

    renderApp();
    await openMetadataSuggestionsView();

    const metadataSuggestions = await screen.findByRole("region", {
      name: "Metadata Suggestions",
    });
    fireEvent.click(
      getMetadataSuggestionTreeLabel(
        metadataSuggestions,
        "/Volumes/Archive/Videos",
      ),
    );

    expect(
      within(metadataSuggestions).getByRole("checkbox", {
        name: "Best/Maniac Alisa/File",
      }),
    ).toBeInTheDocument();
    expect(
      within(metadataSuggestions).getByRole("checkbox", {
        name: "Cum in throat/Slad/Best",
      }),
    ).toBeInTheDocument();
    expect(
      within(metadataSuggestions).queryByRole("checkbox", { name: "Best" }),
    ).not.toBeInTheDocument();
    expect(
      within(metadataSuggestions).queryByRole("checkbox", {
        name: "Maniac Alisa",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      getMetadataSuggestionTreeLabel(
        metadataSuggestions,
        "Cum in throat/Slad/Best",
      ),
    );
    expect(
      within(metadataSuggestions).getByRole("checkbox", { name: "file 1" }),
    ).toBeInTheDocument();
    expect(
      within(metadataSuggestions).getByRole("checkbox", { name: "file 2" }),
    ).toBeInTheDocument();
  });

  it("accepts Metadata Suggestions while allowing individual Videos to be excluded", async () => {
    mockedListMetadataSuggestionGroups
      .mockResolvedValueOnce([
        {
          suggestedValue: "Family",
          suggestionKind: "tag",
          sources: [
            {
              scanRootPath: "/Volumes/Archive/Videos",
              sourcePathSegment: "Family",
              videos: [
                {
                  videoId: 7,
                  title: "Family Trip",
                  fileLocationPath:
                    "/Volumes/Archive/Videos/Family/family-trip.mp4",
                },
                {
                  videoId: 8,
                  title: "Birthday",
                  fileLocationPath:
                    "/Volumes/Archive/Videos/Family/birthday.mp4",
                },
              ],
            },
          ],
        },
      ])
      .mockResolvedValueOnce([
        {
          suggestedValue: "Family",
          suggestionKind: "tag",
          sources: [
            {
              scanRootPath: "/Volumes/Archive/Videos",
              sourcePathSegment: "Family",
              videos: [
                {
                  videoId: 8,
                  title: "Birthday",
                  fileLocationPath:
                    "/Volumes/Archive/Videos/Family/birthday.mp4",
                },
              ],
            },
          ],
        },
      ]);

    renderApp();
    await openMetadataSuggestionsView();

    const metadataSuggestions = await screen.findByRole("region", {
      name: "Metadata Suggestions",
    });
    expandMetadataSuggestionBranch(
      metadataSuggestions,
      "/Volumes/Archive/Videos",
      "/Family",
    );
    fireEvent.click(
      await within(metadataSuggestions).findByRole("checkbox", {
        name: "Birthday",
      }),
    );
    fireEvent.click(
      within(metadataSuggestions).getByRole("button", {
        name: "Accept",
      }),
    );

    expect(mockedAcceptMetadataSuggestionForVideos).toHaveBeenCalledWith({
      scanRootPath: "/Volumes/Archive/Videos",
      suggestedValue: "Family",
      sourcePathSegment: "Family",
      suggestionKind: "tag",
      videoIds: [7],
    });
    await waitFor(() => {
      expect(mockedListMetadataSuggestionGroups).toHaveBeenCalledTimes(2);
    });
  });

  it("cascades folder branch selection to child Videos", async () => {
    mockedListMetadataSuggestionGroups.mockResolvedValue([
      {
        suggestedValue: "Family",
        suggestionKind: "tag",
        sources: [
          {
            scanRootPath: "/Volumes/Archive/Videos",
            sourcePathSegment: "Family",
            videos: [
              {
                videoId: 7,
                title: "Family Trip",
                fileLocationPath:
                  "/Volumes/Archive/Videos/Family/family-trip.mp4",
              },
              {
                videoId: 8,
                title: "Birthday",
                fileLocationPath:
                  "/Volumes/Archive/Videos/Family/birthday.mp4",
              },
            ],
          },
        ],
      },
    ]);

    renderApp();
    await openMetadataSuggestionsView();

    const metadataSuggestions = await screen.findByRole("region", {
      name: "Metadata Suggestions",
    });
    expandMetadataSuggestionBranch(
      metadataSuggestions,
      "/Volumes/Archive/Videos",
      "/Family",
    );
    fireEvent.click(
      await within(metadataSuggestions).findByRole("checkbox", {
        name: "Family",
      }),
    );

    expect(
      within(metadataSuggestions).getByRole("checkbox", { name: "Family Trip" }),
    ).not.toBeChecked();
    await waitFor(() => {
      expect(
        within(metadataSuggestions).getByRole("checkbox", { name: "Birthday" }),
      ).not.toBeChecked();
    });
  });

  it("shows partially selected Metadata Suggestion branches as mixed", async () => {
    mockedListMetadataSuggestionGroups.mockResolvedValue([
      {
        suggestedValue: "Family",
        suggestionKind: "tag",
        sources: [
          {
            scanRootPath: "/Volumes/Archive/Videos",
            sourcePathSegment: "Family",
            videos: [
              {
                videoId: 7,
                title: "Family Trip",
                fileLocationPath:
                  "/Volumes/Archive/Videos/Family/family-trip.mp4",
              },
              {
                videoId: 8,
                title: "Birthday",
                fileLocationPath:
                  "/Volumes/Archive/Videos/Family/birthday.mp4",
              },
            ],
          },
        ],
      },
    ]);

    renderApp();
    await openMetadataSuggestionsView();

    const metadataSuggestions = await screen.findByRole("region", {
      name: "Metadata Suggestions",
    });
    expandMetadataSuggestionBranch(
      metadataSuggestions,
      "/Volumes/Archive/Videos",
      "/Family",
    );
    fireEvent.click(
      await within(metadataSuggestions).findByRole("checkbox", {
        name: "Birthday",
      }),
    );

    await waitFor(() => {
      expect(
        within(metadataSuggestions).getByRole("checkbox", { name: "Birthday" }),
      ).not.toBeChecked();
    });
    expect(
      within(metadataSuggestions).getByRole("checkbox", { name: "Family" }),
    ).toBePartiallyChecked();
    expect(
      within(metadataSuggestions).getByRole("checkbox", {
        name: "/Volumes/Archive/Videos",
      }),
    ).toBePartiallyChecked();
  });

  it("clears partially selected Metadata Suggestion branches when their checkbox is clicked", async () => {
    mockedListMetadataSuggestionGroups.mockResolvedValue([
      {
        suggestedValue: "Family",
        suggestionKind: "tag",
        sources: [
          {
            scanRootPath: "/Volumes/Archive/Videos",
            sourcePathSegment: "Family",
            videos: [
              {
                videoId: 7,
                title: "Family Trip",
                fileLocationPath:
                  "/Volumes/Archive/Videos/Family/family-trip.mp4",
              },
              {
                videoId: 8,
                title: "Birthday",
                fileLocationPath:
                  "/Volumes/Archive/Videos/Family/birthday.mp4",
              },
            ],
          },
        ],
      },
    ]);

    renderApp();
    await openMetadataSuggestionsView();

    const metadataSuggestions = await screen.findByRole("region", {
      name: "Metadata Suggestions",
    });
    expandMetadataSuggestionBranch(
      metadataSuggestions,
      "/Volumes/Archive/Videos",
      "/Family",
    );
    fireEvent.click(
      await within(metadataSuggestions).findByRole("checkbox", {
        name: "Birthday",
      }),
    );
    fireEvent.click(
      within(metadataSuggestions).getByRole("checkbox", {
        name: "Family",
      }),
    );

    expect(
      within(metadataSuggestions).getByRole("checkbox", { name: "Family Trip" }),
    ).not.toBeChecked();
    expect(
      within(metadataSuggestions).getByRole("checkbox", { name: "Birthday" }),
    ).not.toBeChecked();
    expect(
      within(metadataSuggestions).getByRole("button", { name: "Accept" }),
    ).toBeDisabled();
  });

  it("clears collapsed Metadata Suggestion branches when their checkbox is clicked", async () => {
    mockedListMetadataSuggestionGroups.mockResolvedValue([
      {
        suggestedValue: "Family",
        suggestionKind: "tag",
        sources: [
          {
            scanRootPath: "/Volumes/Archive/Videos",
            sourcePathSegment: "Family",
            videos: [
              {
                videoId: 7,
                title: "Family Trip",
                fileLocationPath:
                  "/Volumes/Archive/Videos/Family/family-trip.mp4",
              },
              {
                videoId: 8,
                title: "Birthday",
                fileLocationPath:
                  "/Volumes/Archive/Videos/Family/birthday.mp4",
              },
            ],
          },
        ],
      },
    ]);

    renderApp();
    await openMetadataSuggestionsView();

    const metadataSuggestions = await screen.findByRole("region", {
      name: "Metadata Suggestions",
    });
    fireEvent.click(
      within(metadataSuggestions).getByRole("checkbox", {
        name: "/Volumes/Archive/Videos",
      }),
    );
    expandMetadataSuggestionBranch(
      metadataSuggestions,
      "/Volumes/Archive/Videos",
      "/Family",
    );

    expect(
      within(metadataSuggestions).getByRole("checkbox", { name: "Family Trip" }),
    ).not.toBeChecked();
    expect(
      within(metadataSuggestions).getByRole("checkbox", { name: "Birthday" }),
    ).not.toBeChecked();
    expect(
      within(metadataSuggestions).getByRole("button", { name: "Accept" }),
    ).toBeDisabled();
  });

  it("accepts Metadata Suggestions as Performers mapped to a different existing name", async () => {
    mockedListMetadataSuggestionGroups
      .mockResolvedValueOnce([
        {
          suggestedValue: "Family",
          suggestionKind: "tag",
          sources: [
            {
              scanRootPath: "/Volumes/Archive/Videos",
              sourcePathSegment: "Family",
              videos: [
                {
                  videoId: 7,
                  title: "Family Trip",
                  fileLocationPath:
                    "/Volumes/Archive/Videos/Family/family-trip.mp4",
                },
              ],
            },
          ],
        },
      ])
      .mockResolvedValueOnce([]);
    mockedListPerformers.mockResolvedValue([{ id: 12, name: "The Family" }]);

    renderApp();
    await openMetadataSuggestionsView();

    const metadataSuggestions = await screen.findByRole("region", {
      name: "Metadata Suggestions",
    });
    fireEvent.change(
      await within(metadataSuggestions).findByLabelText(
        "Accept Family as metadata kind",
      ),
      { target: { value: "performer" } },
    );
    fireEvent.change(
      within(metadataSuggestions).getByLabelText("Accepted metadata name"),
      { target: { value: "The Family" } },
    );
    fireEvent.click(
      within(metadataSuggestions).getByRole("button", {
        name: "Accept",
      }),
    );

    expect(mockedAcceptMetadataSuggestionForVideos).toHaveBeenCalledWith({
      scanRootPath: "/Volumes/Archive/Videos",
      suggestedValue: "Family",
      sourcePathSegment: "Family",
      suggestionKind: "tag",
      acceptedMetadataKind: "performer",
      acceptedValue: "The Family",
      videoIds: [7],
    });
    await waitFor(() => {
      expect(mockedTagsForVideo).toHaveBeenCalledWith(7);
      expect(mockedPerformersForVideo).toHaveBeenCalledWith(7);
    });
    expect(
      await within(metadataSuggestions).findByText("No Metadata Suggestions."),
    ).toBeInTheDocument();
  });

  it("preserves user-entered display text when accepting a same-kind Metadata Suggestion", async () => {
    mockedListMetadataSuggestionGroups
      .mockResolvedValueOnce([
        {
          suggestedValue: "Family",
          suggestionKind: "tag",
          sources: [
            {
              scanRootPath: "/Volumes/Archive/Videos",
              sourcePathSegment: "Family",
              videos: [
                {
                  videoId: 7,
                  title: "Family Trip",
                  fileLocationPath:
                    "/Volumes/Archive/Videos/Family/family-trip.mp4",
                },
              ],
            },
          ],
        },
      ])
      .mockResolvedValueOnce([]);

    renderApp();
    await openMetadataSuggestionsView();

    const metadataSuggestions = await screen.findByRole("region", {
      name: "Metadata Suggestions",
    });
    fireEvent.change(
      await within(metadataSuggestions).findByLabelText("Accepted metadata name"),
      { target: { value: "family" } },
    );
    fireEvent.click(
      within(metadataSuggestions).getByRole("button", {
        name: "Accept",
      }),
    );

    await waitFor(() => {
      expect(mockedAcceptMetadataSuggestionForVideos).toHaveBeenCalledWith({
        scanRootPath: "/Volumes/Archive/Videos",
        suggestedValue: "Family",
        sourcePathSegment: "Family",
        suggestionKind: "tag",
        acceptedValue: "family",
        videoIds: [7],
      });
    });
    expect(
      await within(metadataSuggestions).findByText("No Metadata Suggestions."),
    ).toBeInTheDocument();
  });

  it("rejects a Metadata Suggestion for one Scan Root source", async () => {
    mockedListMetadataSuggestionGroups
      .mockResolvedValueOnce([
        {
          suggestedValue: "Family",
          suggestionKind: "tag",
          sources: [
            {
              scanRootPath: "/Volumes/Archive/Videos",
              sourcePathSegment: "Family",
              videos: [
                {
                  videoId: 7,
                  title: "Family Trip",
                  fileLocationPath:
                    "/Volumes/Archive/Videos/Family/family-trip.mp4",
                },
              ],
            },
          ],
        },
      ])
      .mockResolvedValueOnce([]);

    renderApp();
    await openMetadataSuggestionsView();

    const metadataSuggestions = await screen.findByRole("region", {
      name: "Metadata Suggestions",
    });
    fireEvent.click(
      await within(metadataSuggestions).findByRole("button", {
        name: "Reject",
      }),
    );

    expect(mockedRejectMetadataSuggestionSource).toHaveBeenCalledWith({
      scanRootPath: "/Volumes/Archive/Videos",
      sourcePathSegment: "Family",
      suggestedValue: "Family",
      suggestionKind: "tag",
    });
    expect(
      await within(metadataSuggestions).findByText("No Metadata Suggestions."),
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
    await openScanIssuesTab();

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
