import { afterEach, describe, expect, it, vi } from "vitest";

import type { CatalogVideo } from "../../tauriCommands";
import type { CatalogVideoFilters, CatalogVideoMetadata } from "./catalogTypes";
import {
  buildCatalogVideoFilterIndex,
  beginCatalogVideoMatchBreakdown,
  catalogVideoMatchesFilters,
  catalogVideoMatchesFolderFilter,
  catalogVideoMatchesIndexedFilters,
  catalogVideoMatchesPreparedIndexedFilters,
  catalogVideoMatchesTagFilter,
  endCatalogVideoMatchBreakdown,
  indexedCatalogVideoFilters,
} from "./catalogVideoFiltering";

const taggedMetadata: CatalogVideoMetadata = {
  performers: [],
  tags: [{ id: 4, isSecret: false, name: "Travel" }],
};

const untaggedMetadata: CatalogVideoMetadata = {
  performers: [],
  tags: [],
};

const availableScanRootPath = "/Volumes/Archive/Videos";
const travelBranchPath = `${availableScanRootPath}/Travel`;
const parisBranchPath = `${travelBranchPath}/Paris`;
const documentariesBranchPath = `${availableScanRootPath}/Documentaries`;
const reachableParisVideoPath = `${parisBranchPath}/day-one.mp4`;
const offlineTravelBranchPath = "/Volumes/Offline/Videos/Travel";
const unreachableParisVideoPath = `${offlineTravelBranchPath}/Paris/day-one.mp4`;
const downloadsFolderPath = "/Users/michel/Downloads";
const downloadsVideoPath = `${downloadsFolderPath}/day-one.mp4`;
const catalogVideoFileSizeBytes = 1000;
const catalogVideoDurationMilliseconds = 60_000;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("catalogVideoMatchesTagFilter", () => {
  it("matches only untagged Videos when the No Tag filter is selected", () => {
    expect(catalogVideoMatchesTagFilter(untaggedMetadata, [], true)).toBe(true);
    expect(catalogVideoMatchesTagFilter(taggedMetadata, [], true)).toBe(false);
  });

  it("does not match any Video when No Tag and real Tags are selected together", () => {
    expect(catalogVideoMatchesTagFilter(untaggedMetadata, [4], true)).toBe(false);
    expect(catalogVideoMatchesTagFilter(taggedMetadata, [4], true)).toBe(false);
  });
});

describe("catalogVideoMatchesFolderFilter", () => {
  it("matches reachable File Locations in a selected folder branch under an available Scan Root", () => {
    const catalogVideo = catalogVideoWithFileLocations([
      reachableFileLocation(reachableParisVideoPath),
    ]);

    expect(
      catalogVideoMatchesFolderFilter(catalogVideo, [
        selectedFolderBranch(travelBranchPath),
      ]),
    ).toBe(true);
    expect(
      catalogVideoMatchesFolderFilter(catalogVideo, [
        selectedFolderBranch(parisBranchPath),
      ]),
    ).toBe(true);
  });

  it("matches any selected folder branch", () => {
    const catalogVideo = catalogVideoWithFileLocations([
      reachableFileLocation(reachableParisVideoPath),
    ]);

    expect(
      catalogVideoMatchesFolderFilter(catalogVideo, [
        selectedFolderBranch(documentariesBranchPath),
        selectedFolderBranch(travelBranchPath),
      ]),
    ).toBe(true);
  });

  it("matches all Videos under a selected Scan Root branch", () => {
    const catalogVideo = catalogVideoWithFileLocations([
      reachableFileLocation(reachableParisVideoPath),
    ]);

    expect(
      catalogVideoMatchesFolderFilter(catalogVideo, [
        selectedFolderBranch(availableScanRootPath),
      ]),
    ).toBe(true);
  });

  it("matches when any reachable File Location is under a selected branch", () => {
    const catalogVideo = catalogVideoWithFileLocations([
      unreachableFileLocation(unreachableParisVideoPath),
      reachableFileLocation(reachableParisVideoPath),
    ]);

    expect(
      catalogVideoMatchesFolderFilter(catalogVideo, [
        selectedFolderBranch(travelBranchPath),
      ]),
    ).toBe(true);
  });

  it("ignores unreachable File Locations and branches outside available Scan Roots", () => {
    const catalogVideo = catalogVideoWithFileLocations([
      unreachableFileLocation(unreachableParisVideoPath),
      reachableFileLocation(downloadsVideoPath),
    ]);

    expect(
      catalogVideoMatchesFolderFilter(catalogVideo, [
        selectedFolderBranch(offlineTravelBranchPath),
        selectedFolderBranch(downloadsFolderPath),
      ]),
    ).toBe(false);
  });

  it("matches no Videos when no folder branch is selected", () => {
    const catalogVideo = catalogVideoWithFileLocations([
      reachableFileLocation(reachableParisVideoPath),
    ]);

    expect(catalogVideoMatchesFolderFilter(catalogVideo, [])).toBe(false);
  });
});

describe("catalogVideoMatchesPreparedIndexedFilters folder filtering", () => {
  it("matches reachable File Locations under selected branches", () => {
    const catalogVideo = catalogVideoWithFileLocations([
      reachableFileLocation(reachableParisVideoPath),
    ]);

    expect(
      catalogVideoMatchesPreparedFolderFilter(catalogVideo, [
        selectedFolderBranch(travelBranchPath),
      ]),
    ).toBe(true);
  });

  it("ignores unreachable File Locations", () => {
    const catalogVideo = catalogVideoWithFileLocations([
      unreachableFileLocation(reachableParisVideoPath),
    ]);

    expect(
      catalogVideoMatchesPreparedFolderFilter(catalogVideo, [
        selectedFolderBranch(travelBranchPath),
      ]),
    ).toBe(false);
  });

  it("rejects selected branches outside available Scan Roots", () => {
    const catalogVideo = catalogVideoWithFileLocations([
      reachableFileLocation(`${offlineTravelBranchPath}/Paris/day-one.mp4`),
    ]);

    expect(
      catalogVideoMatchesPreparedFolderFilter(catalogVideo, [
        selectedFolderBranch(offlineTravelBranchPath),
      ]),
    ).toBe(false);
  });

  it("matches no Videos when the selected branch list is empty", () => {
    const catalogVideo = catalogVideoWithFileLocations([
      reachableFileLocation(reachableParisVideoPath),
    ]);

    expect(catalogVideoMatchesPreparedFolderFilter(catalogVideo, [])).toBe(
      false,
    );
  });

  it("matches any valid branch when multiple selected branches are present", () => {
    const catalogVideo = catalogVideoWithFileLocations([
      reachableFileLocation(reachableParisVideoPath),
    ]);

    expect(
      catalogVideoMatchesPreparedFolderFilter(catalogVideo, [
        selectedFolderBranch(documentariesBranchPath),
        selectedFolderBranch(offlineTravelBranchPath),
        selectedFolderBranch(travelBranchPath),
      ]),
    ).toBe(true);
  });
});

describe("catalogVideoMatchesFilters", () => {
  it("combines Folder Search Filter with existing Search Filters", () => {
    const catalogVideo = catalogVideoWithFileLocations([
      reachableFileLocation(reachableParisVideoPath),
    ]);
    const filters = catalogVideoFilters({
      favoritesOnly: true,
      selectedFolderBranches: [
        selectedFolderBranch(travelBranchPath),
      ],
    });

    expect(catalogVideoMatchesFilters(catalogVideo, undefined, filters)).toBe(
      false,
    );
  });
});

describe("catalogVideoMatchesIndexedFilters", () => {
  it("preserves the current Catalog Video filtering semantics", () => {
    const catalogVideos = [
      catalogVideo({
        id: 1,
        title: "Paris Day One",
        fileLocationPath: reachableParisVideoPath,
        fileLocations: [reachableFileLocation(reachableParisVideoPath)],
        isAvailable: true,
        isFavorite: true,
        durationMilliseconds: 30 * 60_000,
      }),
      catalogVideo({
        id: 2,
        title: "Berlin Night",
        fileLocationPath: `${availableScanRootPath}/Travel/Berlin/night.mp4`,
        fileLocations: [
          reachableFileLocation(
            `${availableScanRootPath}/Travel/Berlin/night.mp4`,
          ),
        ],
        isAvailable: true,
        durationMilliseconds: 90 * 60_000,
      }),
      catalogVideo({
        id: 3,
        title: "Secret",
        fileLocationPath: `${documentariesBranchPath}/secret.mp4`,
        fileLocations: [reachableFileLocation(`${documentariesBranchPath}/secret.mp4`)],
        isAvailable: true,
        durationMilliseconds: 45 * 60_000,
      }),
      catalogVideo({
        id: 4,
        title: "Missing Metadata",
        fileLocationPath: `${documentariesBranchPath}/missing.mp4`,
        fileLocations: [reachableFileLocation(`${documentariesBranchPath}/missing.mp4`)],
        isAvailable: true,
        durationMilliseconds: 15 * 60_000,
      }),
    ];
    const metadataByVideoId: Record<number, CatalogVideoMetadata> = {
      1: {
        tags: [
          { id: 4, isSecret: false, name: "Travel" },
          { id: 5, isSecret: false, name: "City" },
        ],
        performers: [{ id: 9, isSecret: false, name: "Ada" }],
      },
      2: {
        tags: [{ id: 4, isSecret: false, name: "Travel" }],
        performers: [{ id: 10, isSecret: false, name: "Bert" }],
      },
      3: {
        tags: [{ id: 6, isSecret: true, name: "Secret" }],
        performers: [],
      },
    };
    const filterScenarios = [
      {
        filters: catalogVideoFilters({
          searchText: "day-one",
          selectedFolderBranches: [selectedFolderBranch(travelBranchPath)],
        }),
        matchingVideoIds: [1],
      },
      {
        filters: catalogVideoFilters({
          selectedTagIds: [4, 5],
        }),
        matchingVideoIds: [1],
      },
      {
        filters: catalogVideoFilters({
          selectedPerformerIds: [10],
        }),
        matchingVideoIds: [2],
      },
      {
        filters: catalogVideoFilters({
          withoutTagsOnly: true,
          selectedTagIds: [4],
        }),
        matchingVideoIds: [],
      },
      {
        filters: catalogVideoFilters({
          hideSecretMetadata: true,
        }),
        matchingVideoIds: [1, 2],
      },
      {
        filters: catalogVideoFilters({
          favoritesOnly: true,
          showUnavailableVideos: false,
          minimumDurationMinutes: 20,
          maximumDurationMinutes: 60,
        }),
        matchingVideoIds: [1],
      },
    ];
    const filterIndex = buildCatalogVideoFilterIndex(
      catalogVideos,
      metadataByVideoId,
    );

    for (const { filters, matchingVideoIds } of filterScenarios) {
      const indexedVideoIds = catalogVideos
        .filter((catalogVideo) =>
          catalogVideoMatchesIndexedFilters(
            filterIndex,
            catalogVideo,
            filters,
            true,
          ),
        )
        .map((catalogVideo) => catalogVideo.id);

      expect(indexedVideoIds, JSON.stringify(filters)).toEqual(matchingVideoIds);
    }
  });

  it("reuses indexed per-Video data when only selected filters change", () => {
    const catalogVideo = catalogVideoWithFileLocations([
      reachableFileLocation(reachableParisVideoPath),
    ]);
    const filterIndex = buildCatalogVideoFilterIndex(
      [catalogVideo],
      { [catalogVideo.id]: taggedMetadata },
    );
    const indexedCatalogVideo = filterIndex.videoFilterDataById.get(catalogVideo.id);

    catalogVideoMatchesIndexedFilters(
      filterIndex,
      catalogVideo,
      catalogVideoFilters({ selectedTagIds: [4] }),
    );
    catalogVideoMatchesIndexedFilters(
      filterIndex,
      catalogVideo,
      catalogVideoFilters({ selectedPerformerIds: [9] }),
    );

    expect(filterIndex.videoFilterDataById.get(catalogVideo.id)).toBe(
      indexedCatalogVideo,
    );
  });

  it("skips Folder filtering when an indexed Tag filter already rejects the Video", () => {
    const matchingVideo = catalogVideoWithFileLocations([
      reachableFileLocation(reachableParisVideoPath),
    ]);
    const filterIndex = buildCatalogVideoFilterIndex(
      [matchingVideo],
      { [matchingVideo.id]: taggedMetadata },
    );
    const consoleInfo = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    beginCatalogVideoMatchBreakdown();
    const matches = catalogVideoMatchesIndexedFilters(
      filterIndex,
      matchingVideo,
      catalogVideoFilters({
        selectedFolderBranches: [selectedFolderBranch(travelBranchPath)],
        selectedTagIds: [34],
      }),
    );
    endCatalogVideoMatchBreakdown();

    expect(matches).toBe(false);
    expectCatalogFilterTiming(consoleInfo, {
      tagHasRun: true,
      folderHasNotRun: true,
    });
  });

  it("skips Folder filtering when an indexed Performer filter already rejects the Video", () => {
    const matchingVideo = catalogVideoWithFileLocations([
      reachableFileLocation(reachableParisVideoPath),
    ]);
    const filterIndex = buildCatalogVideoFilterIndex(
      [matchingVideo],
      { [matchingVideo.id]: taggedMetadata },
    );
    const consoleInfo = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    beginCatalogVideoMatchBreakdown();
    const matches = catalogVideoMatchesIndexedFilters(
      filterIndex,
      matchingVideo,
      catalogVideoFilters({
        selectedFolderBranches: [selectedFolderBranch(travelBranchPath)],
        selectedPerformerIds: [9],
      }),
    );
    endCatalogVideoMatchBreakdown();

    expect(matches).toBe(false);
    expectCatalogFilterTiming(consoleInfo, {
      performerHasRun: true,
      folderHasNotRun: true,
    });
  });
});

function expectCatalogFilterTiming(
  consoleInfo: ReturnType<typeof vi.spyOn>,
  expectedTiming: Partial<{
    tagHasRun: boolean;
    performerHasRun: boolean;
    folderHasNotRun: boolean;
  }>,
) {
  expect(consoleInfo).toHaveBeenCalledTimes(1);

  const [timingLog] = consoleInfo.mock.calls[0] ?? [];
  const timingJson = String(timingLog).replace(
    "[DEBUG-catalog-filter-timing] ",
    "",
  );
  const timing = JSON.parse(timingJson) as Record<string, number>;

  if (expectedTiming.tagHasRun) {
    expect(timing.tag).toBeGreaterThanOrEqual(0);
  }

  if (expectedTiming.performerHasRun) {
    expect(timing.performer).toBeGreaterThanOrEqual(0);
  }

  if (expectedTiming.folderHasNotRun) {
    expect(timing.folder).toBe(0);
  }
}

function catalogVideoMatchesPreparedFolderFilter(
  catalogVideo: CatalogVideo,
  selectedFolderBranches: ReturnType<typeof selectedFolderBranch>[],
) {
  const filterIndex = buildCatalogVideoFilterIndex(
    [catalogVideo],
    { [catalogVideo.id]: undefined },
  );
  const indexedFilters = indexedCatalogVideoFilters(
    catalogVideoFilters({ selectedFolderBranches }),
  );

  return catalogVideoMatchesPreparedIndexedFilters(
    filterIndex,
    catalogVideo,
    indexedFilters,
  );
}

function selectedFolderBranch(path: string) {
  return {
    path,
    availableScanRootPath,
  };
}

function catalogVideoFilters(
  filters: Partial<CatalogVideoFilters>,
): CatalogVideoFilters {
  return {
    searchText: "",
    selectedTagIds: [],
    withoutTagsOnly: false,
    selectedPerformerIds: [],
    hideSecretMetadata: false,
    favoritesOnly: false,
    showUnavailableVideos: true,
    minimumDurationMinutes: "",
    maximumDurationMinutes: "",
    selectedFolderBranches: null,
    ...filters,
  };
}

function catalogVideoWithFileLocations(
  fileLocations: CatalogVideo["fileLocations"],
): CatalogVideo {
  return catalogVideo({
    id: 1,
    title: "Paris Day One",
    durationMilliseconds: catalogVideoDurationMilliseconds,
    fileSizeBytes: fileLocations[0]?.fileSizeBytes ?? null,
    fileLocationPath: fileLocations[0]?.path ?? null,
    fileLocations,
    isAvailable: fileLocations.some((fileLocation) => fileLocation.isReachable),
    isFavorite: false,
  });
}

function catalogVideo(
  video: Omit<Partial<CatalogVideo>, "id"> & Pick<CatalogVideo, "id">,
): CatalogVideo {
  const { id, ...videoOverrides } = video;

  return {
    title: "Paris Day One",
    durationMilliseconds: catalogVideoDurationMilliseconds,
    fileSizeBytes: null,
    fileLocationPath: null,
    fileLocations: [],
    isAvailable: false,
    isFavorite: false,
    lastOpenedAt: null,
    openCount: 0,
    ...videoOverrides,
    id,
    previewStrip: videoOverrides.previewStrip ?? { status: "pending" },
  };
}

function reachableFileLocation(path: string) {
  return fileLocation(path, true);
}

function unreachableFileLocation(path: string) {
  return fileLocation(path, false);
}

function fileLocation(path: string, isReachable: boolean) {
  return {
    path,
    fileSizeBytes: catalogVideoFileSizeBytes,
    isPreferred: false,
    isReachable,
  };
}
