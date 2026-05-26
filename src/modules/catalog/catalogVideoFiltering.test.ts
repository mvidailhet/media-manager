import { describe, expect, it } from "vitest";

import type { CatalogVideo } from "../../tauriCommands";
import type { CatalogVideoFilters, CatalogVideoMetadata } from "./catalogTypes";
import {
  catalogVideoMatchesFilters,
  catalogVideoMatchesFolderFilter,
  catalogVideoMatchesTagFilter,
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
  return {
    id: 1,
    title: "Paris Day One",
    durationMilliseconds: catalogVideoDurationMilliseconds,
    fileSizeBytes: fileLocations[0]?.fileSizeBytes ?? null,
    fileLocationPath: fileLocations[0]?.path ?? null,
    fileLocations,
    isAvailable: fileLocations.some((fileLocation) => fileLocation.isReachable),
    isFavorite: false,
    lastOpenedAt: null,
    openCount: 0,
    previewStrip: { status: "pending" },
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
