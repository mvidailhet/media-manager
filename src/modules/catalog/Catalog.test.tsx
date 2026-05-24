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
} from "../../test/AppTestHarness";
import { previewStripAutoplayFrameIntervalMilliseconds } from "./components/VideoPreview/previewStripFrame";

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

  function getMetadataSuggestionBadge(
    metadataSuggestions: HTMLElement,
    suggestedValue: string,
  ) {
    const suggestionBadge = within(metadataSuggestions)
      .getAllByText(suggestedValue)
      .map((element) => element.closest(".mantine-Badge-root"))
      .find((element): element is HTMLElement => element instanceof HTMLElement);

    if (!suggestionBadge) {
      throw new Error(`Missing Metadata Suggestion badge for ${suggestedValue}`);
    }

    return suggestionBadge;
  }

  async function showAdvancedSearch(catalogVideos: HTMLElement) {
    fireEvent.click(
      within(catalogVideos).getByRole("button", {
        name: "Advanced search",
        expanded: false,
      }),
    );

    await within(catalogVideos).findByRole("button", {
      name: "Advanced search",
      expanded: true,
    });
  }

  async function findSecretMetadataVisibilityCheckbox(
    catalogVideos: HTMLElement,
  ) {
    await showAdvancedSearch(catalogVideos);

    return within(catalogVideos).findByRole("checkbox", {
      name: "Hide secret tags and performers",
    });
  }

  function catalogVideoFixture(id: number, title: string) {
    return {
      id,
      title,
      durationMilliseconds: 1800000,
      fileSizeBytes: 50740352,
      fileLocationPath: `/Volumes/Archive/Videos/${title.toLowerCase().replace(/ /g, "-")}.mp4`,
      fileLocations: [],
      isAvailable: true,
      isFavorite: false,
      lastOpenedAt: null,
      openCount: 0,
      previewStrip: pendingPreviewStrip,
    };
  }

  function catalogVideoBatch(count: number) {
    return Array.from({ length: count }, (_value, index) =>
      catalogVideoFixture(index + 1, `Archive Clip ${String(index + 1).padStart(3, "0")}`),
    );
  }

  async function visibleCatalogVideos() {
    return await screen.findByRole("region", { name: "Catalog Videos" });
  }

  async function expandPrimaryPerformerAccordion(
    catalogVideos: HTMLElement,
    performerName = "Unassigned",
  ) {
    const accordionButton = await within(catalogVideos).findByRole("button", {
      name: `${performerName} Primary Performer Accordion`,
      expanded: false,
    });

    fireEvent.click(accordionButton);
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

    fireEvent.click(
      await screen.findByRole("button", { name: /^Metadata Suggestions/ }),
    );

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

    fireEvent.click(within(metadataSuggestions).getByText("Trips/family-trip.mp4"));

    expect(
      await screen.findByRole("region", { name: "Video Detail Panel" }),
    ).toBeInTheDocument();
  });

  it("shows an always-present Selection Panel with an empty state", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(1, "Family Trip"),
    ]);

    renderApp();

    const selectionPanel = await screen.findByRole("complementary", {
      name: "Selection Panel",
    });

    expect(within(selectionPanel).getByText("No video selected")).toBeVisible();
    expect(
      within(selectionPanel).getByText(
        "Select one video for details or select multiple videos for batch editing.",
      ),
    ).toBeVisible();
  });

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

  it("shows a Metadata Suggestions toolbar entry only when suggestion groups exist with a group count badge", async () => {
    mockedListMetadataSuggestionGroups.mockResolvedValueOnce([]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });

    expect(
      screen.queryByRole("button", { name: /^Metadata Suggestions/ }),
    ).not.toBeInTheDocument();
    expect(catalogVideos).toBeInTheDocument();
  });

  it("shows the Metadata Suggestions toolbar entry badge as the suggestion group count", async () => {
    mockedListMetadataSuggestionGroups.mockResolvedValueOnce([
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
              {
                videoId: 2,
                title: "City Walk",
                fileLocationPath: "/Volumes/Archive/Trips/city-walk.mp4",
              },
            ],
          },
        ],
      },
      {
        suggestionKind: "performer",
        suggestedValue: "Alice",
        sources: [
          {
            scanRootPath: "/Volumes/Archive",
            sourcePathSegment: "Alice",
            videos: [
              {
                videoId: 3,
                title: "Portrait",
                fileLocationPath: "/Volumes/Archive/Alice/portrait.mp4",
              },
            ],
          },
        ],
      },
    ]);

    renderApp();

    const metadataSuggestionsButton = await screen.findByRole("button", {
      name: "Metadata Suggestions, 2 groups",
    });

    expect(metadataSuggestionsButton).toBeInTheDocument();
    expect(within(metadataSuggestionsButton).getByText("2")).toBeInTheDocument();
    expect(screen.queryByText("3")).not.toBeInTheDocument();
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

  it("automatically returns to Catalog when the last Metadata Suggestion is resolved", async () => {
    mockedListMetadataSuggestionGroups
      .mockResolvedValueOnce([
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
      ])
      .mockResolvedValueOnce([]);
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
    await openMetadataSuggestionsView();

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
    fireEvent.click(
      within(metadataSuggestions).getByRole("button", {
        name: "Accept",
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Catalog Videos" }),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("region", { name: "Metadata Suggestions" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Video Detail Panel" }),
    ).not.toBeInTheDocument();
  });

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
      within(catalogVideos).getByRole("article", { name: "Family Trip" }),
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
      within(catalogVideos).getByText("Archive Family Cut"),
    ).toBeInTheDocument();
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
      within(catalogVideos).getByRole("article", { name: "Family Trip" }),
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
    expect(within(catalogVideos).getByText("Normal Video")).toBeInTheDocument();
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
    expect(within(catalogVideos).getByText("Normal Video")).toBeInTheDocument();
    expect(
      within(catalogVideos).getByText("Secret Tag Video"),
    ).toBeInTheDocument();
    expect(
      within(catalogVideos).getByText("Secret Performer Video"),
    ).toBeInTheDocument();
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

    expect(
      within(catalogVideos).queryByText("Normal Video"),
    ).not.toBeInTheDocument();
    expect(within(catalogVideos).getByText("Secret Video")).toBeInTheDocument();

    fireEvent.click(hideSecretMetadata);
    fireEvent.click(hideSecretMetadata);

    expect(within(catalogVideos).getByText("Normal Video")).toBeInTheDocument();
    expect(within(catalogVideos).getByText("Secret Video")).toBeInTheDocument();
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
    await within(catalogVideos).findByText("Blair");
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
    await within(catalogVideos).findByText("Blair");

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
    await within(catalogVideos).findByText("Travel");

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
    await within(catalogVideos).findByText("Blair");

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
    const alphaClipCard = await within(catalogVideos).findByRole("article", {
      name: "Alpha Clip",
    });
    const betaClipCard = within(catalogVideos).getByRole("article", {
      name: "Beta Clip",
    });
    const gammaClipCard = within(catalogVideos).getByRole("article", {
      name: "Gamma Clip",
    });
    const omegaClipCard = await within(catalogVideos).findByRole("article", {
      name: "Omega Clip",
    });

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

  it("supports keyboard selection and Escape clearing in the Videos View", async () => {
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

    fireEvent.keyDown(gammaClipCard, { key: "Escape" });

    await screen.findByText("No video selected");
    expect(
      screen.queryByRole("region", { name: "Batch Edit Panel" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Video Detail Panel" }),
    ).not.toBeInTheDocument();
  });

  it("clears Video selection when filters or sort change", async () => {
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
    ).toBeInTheDocument();

    fireEvent.change(within(catalogVideos).getByLabelText("Search Videos"), {
      target: { value: "City" },
    });

    expect(await screen.findByText("No video selected")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Video Detail Panel" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      await within(catalogVideos).findByRole("article", {
        name: "City Walk",
      }),
    );
    expect(
      await screen.findByRole("region", { name: "Video Detail Panel" }),
    ).toBeInTheDocument();

    fireEvent.change(within(catalogVideos).getByLabelText("Sort Videos"), {
      target: { value: "fileSizeAscending" },
    });

    expect(await screen.findByText("No video selected")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Video Detail Panel" }),
    ).not.toBeInTheDocument();
  });

  it("keeps checked Metadata Suggestion Videos separate from Batch Edit targets", async () => {
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
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(7, "Family Trip"),
      catalogVideoFixture(8, "Birthday"),
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

    expect(
      screen.queryByRole("region", { name: "Batch Edit Panel" }),
    ).not.toBeInTheDocument();
    expect(await screen.findByText("No video selected")).toBeVisible();

    fireEvent.click(
      within(metadataSuggestions).getByRole("button", {
        name: "family-trip.mp4",
      }),
    );

    expect(
      await screen.findByRole("region", { name: "Video Detail Panel" }),
    ).toHaveTextContent("Family Trip");
    expect(
      screen.queryByRole("region", { name: "Batch Edit Panel" }),
    ).not.toBeInTheDocument();

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
      videoIds: [7, 8],
    });
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

    await screen.findByText("Blair");
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

    await screen.findByText("Blair");
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
    expect(
      within(catalogVideos).getByRole("article", {
        name: "Archive Clip 040",
      }),
    ).toBeInTheDocument();
    expect(
      within(catalogVideos).getByRole("article", {
        name: "Archive Clip 041",
      }),
    ).toBeInTheDocument();
    expect(
      within(catalogVideos).getByRole("article", {
        name: "Archive Clip 043",
      }),
    ).toBeInTheDocument();
  });

  it("resets scroll position when Search Filters or sort change", async () => {
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

    expect(catalogVideos.scrollTop).toBe(0);

    Object.defineProperty(catalogVideos, "scrollTop", {
      configurable: true,
      value: 760,
      writable: true,
    });
    fireEvent.change(within(catalogVideos).getByLabelText("Sort Videos"), {
      target: { value: "fileSizeAscending" },
    });

    expect(catalogVideos.scrollTop).toBe(0);
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
      within(metadataSuggestions).getByRole("heading", {
        name: "Metadata Suggestions",
      }),
    ).toBeVisible();
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
        name: "Trips/family-trip.mp4",
      }),
    ).toBeInTheDocument();
    expect(
      within(metadataSuggestions).getByText("Trips/family-trip.mp4"),
    ).toBeInTheDocument();
    expect(
      within(metadataSuggestions).getByText("birthday.mp4"),
    ).toBeInTheDocument();
    expect(within(metadataSuggestions).queryByText("Picnic")).not.toBeInTheDocument();
    fireEvent.click(
      getMetadataSuggestionTreeLabel(
        metadataSuggestions,
        "/Volumes/Camera/Videos",
      ),
    );
    expect(
      within(metadataSuggestions).getByText("family/picnic.mp4"),
    ).toBeInTheDocument();
    expect(
      within(metadataSuggestions).queryByText(
        "/Volumes/Archive/Videos/Family/family-trip.mp4",
      ),
    ).not.toBeInTheDocument();
    expect(
      within(metadataSuggestions).queryByText("Family Trip"),
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
        name: "Best/Maniac Alisa/file.mp4",
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
      within(metadataSuggestions).getByRole("checkbox", { name: "file-1.mp4" }),
    ).toBeInTheDocument();
    expect(
      within(metadataSuggestions).getByRole("checkbox", { name: "file-2.mp4" }),
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
        name: "birthday.mp4",
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
      within(metadataSuggestions).getByRole("checkbox", {
        name: "family-trip.mp4",
      }),
    ).not.toBeChecked();
    await waitFor(() => {
      expect(
        within(metadataSuggestions).getByRole("checkbox", {
          name: "birthday.mp4",
        }),
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
        name: "birthday.mp4",
      }),
    );

    await waitFor(() => {
      expect(
        within(metadataSuggestions).getByRole("checkbox", {
          name: "birthday.mp4",
        }),
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
        name: "birthday.mp4",
      }),
    );
    fireEvent.click(
      within(metadataSuggestions).getByRole("checkbox", {
        name: "Family",
      }),
    );

    expect(
      within(metadataSuggestions).getByRole("checkbox", {
        name: "family-trip.mp4",
      }),
    ).not.toBeChecked();
    expect(
      within(metadataSuggestions).getByRole("checkbox", { name: "birthday.mp4" }),
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
      within(metadataSuggestions).getByRole("checkbox", {
        name: "family-trip.mp4",
      }),
    ).not.toBeChecked();
    expect(
      within(metadataSuggestions).getByRole("checkbox", { name: "birthday.mp4" }),
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
    mockedListPerformers.mockResolvedValue([{ id: 12, isSecret: false, name: "The Family" }]);

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
      await screen.findByRole("region", { name: "Catalog Videos" }),
    ).toBeInTheDocument();
  });

  it("keeps secret metadata available in Metadata Suggestion mapping while normal browsing hides it", async () => {
    mockedListTags.mockResolvedValue([
      { id: 4, isSecret: false, name: "Travel" },
      { id: 5, isSecret: true, name: "Secret Tag" },
    ]);
    mockedListPerformers.mockResolvedValue([
      { id: 10, isSecret: true, name: "Secret Performer" },
    ]);
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
    mockedListCatalogVideos.mockResolvedValue([
      catalogVideoFixture(7, "Family Trip"),
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    await within(catalogVideos).findByText("Family Trip");

    expect(
      await findSecretMetadataVisibilityCheckbox(catalogVideos),
    ).toBeChecked();
    expect(
      within(catalogVideos).queryByLabelText("Secret Tag"),
    ).not.toBeInTheDocument();
    expect(
      within(catalogVideos).queryByLabelText("Secret Performer"),
    ).not.toBeInTheDocument();

    await openMetadataSuggestionsView();

    const metadataSuggestions = await screen.findByRole("region", {
      name: "Metadata Suggestions",
    });
    const acceptedMetadataNameInput = await within(
      metadataSuggestions,
    ).findByLabelText("Accepted metadata name");
    fireEvent.change(acceptedMetadataNameInput, {
      target: { value: "Secret" },
    });
    fireEvent.click(await screen.findByText("Secret Tag"));

    fireEvent.change(
      within(metadataSuggestions).getByLabelText(
        "Accept Family as metadata kind",
      ),
      { target: { value: "performer" } },
    );
    fireEvent.change(acceptedMetadataNameInput, {
      target: { value: "Secret Performer" },
    });
    fireEvent.click(await screen.findByText("Secret Performer"));
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
        acceptedMetadataKind: "performer",
        acceptedValue: "Secret Performer",
        videoIds: [7],
      });
    });
  });

  it("updates the Metadata Suggestion badge color when accepting it as a Performer", async () => {
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
    const suggestionBadge = getMetadataSuggestionBadge(
      metadataSuggestions,
      "Family",
    );

    expect(suggestionBadge).toHaveStyle({
      "--badge-bg": "var(--mantine-color-blue-light)",
    });

    fireEvent.change(
      within(metadataSuggestions).getByLabelText(
        "Accept Family as metadata kind",
      ),
      { target: { value: "performer" } },
    );

    expect(suggestionBadge).toHaveStyle({
      "--badge-bg": "var(--mantine-color-grape-light)",
    });
  });

  it("accepts Metadata Suggestions with additional new Tags for the selected Videos", async () => {
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
      .mockResolvedValueOnce([]);
    mockedListTags.mockResolvedValue([{ id: 4, isSecret: false, name: "Archive" }]);
    mockedCreateTag.mockResolvedValue({ id: 6, isSecret: false, name: "Home Movies" });

    renderApp();
    await openMetadataSuggestionsView();

    const metadataSuggestions = await screen.findByRole("region", {
      name: "Metadata Suggestions",
    });
    fireEvent.click(
      within(metadataSuggestions).getByRole("button", { name: "Add Tags" }),
    );
    const additionalTagsInput = await within(metadataSuggestions).findByLabelText(
      "Additional tags",
    );
    fireEvent.change(additionalTagsInput, { target: { value: "Archive" } });
    fireEvent.keyDown(additionalTagsInput, { key: "Enter" });
    fireEvent.change(additionalTagsInput, { target: { value: "Home Movies" } });
    fireEvent.keyDown(additionalTagsInput, { key: "Enter" });
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
        videoIds: [7, 8],
      });
    });
    expect(mockedCreateTag).toHaveBeenCalledWith("Home Movies");
    expect(mockedAttachTagToVideo).toHaveBeenCalledWith(4, 7);
    expect(mockedAttachTagToVideo).toHaveBeenCalledWith(4, 8);
    expect(mockedAttachTagToVideo).toHaveBeenCalledWith(6, 7);
    expect(mockedAttachTagToVideo).toHaveBeenCalledWith(6, 8);
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
      await screen.findByRole("region", { name: "Catalog Videos" }),
    ).toBeInTheDocument();
  });

  it("keeps a typed accepted Metadata name when the field loses focus", async () => {
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
    const acceptedMetadataNameInput = await within(
      metadataSuggestions,
    ).findByLabelText("Accepted metadata name");
    fireEvent.change(acceptedMetadataNameInput, {
      target: { value: "Home Movies" },
    });
    fireEvent.blur(acceptedMetadataNameInput);
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
        acceptedValue: "Home Movies",
        videoIds: [7],
      });
    });
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
      await screen.findByRole("region", { name: "Catalog Videos" }),
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
