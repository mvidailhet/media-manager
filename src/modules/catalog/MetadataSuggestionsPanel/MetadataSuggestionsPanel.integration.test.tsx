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

describe("Metadata Suggestions Panel integration", () => {
  beforeEach(resetAppTestHarness);

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

  it("updates the Metadata Suggestion badge text when editing the accepted metadata name", async () => {
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

    expect(
      getMetadataSuggestionBadge(metadataSuggestions, "Family"),
    ).toBeInTheDocument();

    fireEvent.change(
      await within(metadataSuggestions).findByLabelText("Accepted metadata name"),
      { target: { value: "Family Archive" } },
    );

    expect(
      getMetadataSuggestionBadge(metadataSuggestions, "Family Archive"),
    ).toBeInTheDocument();
    expect(
      within(metadataSuggestions).queryByText("Family"),
    ).not.toBeInTheDocument();
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
});
