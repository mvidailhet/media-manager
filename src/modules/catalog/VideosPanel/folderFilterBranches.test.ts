import { describe, expect, it } from "vitest";

import type { CatalogVideo } from "../../../tauriCommands";
import { folderFilterBranchesForVideos } from "./folderFilterBranches";

const archiveScanRootPath = "/Volumes/Archive/Videos";
const backupScanRootPath = "/Volumes/Backup/Videos";

describe("folderFilterBranchesForVideos", () => {
  it("builds branches from reachable File Locations under available Scan Roots", () => {
    const folderBranches = folderFilterBranchesForVideos(
      [
        catalogVideoWithFileLocations([
          fileLocation("/Volumes/Archive/Videos/Travel/Paris/day-one.mp4", true),
          fileLocation("/Volumes/Backup/Videos/Travel/Paris/day-one.mp4", true),
          fileLocation("/Users/michel/Downloads/day-one.mp4", true),
        ]),
      ],
      [availableScanRoot(archiveScanRootPath), unavailableScanRoot(backupScanRootPath)],
    );

    expect(folderBranches).toEqual([
      {
        path: archiveScanRootPath,
        availableScanRootPath: archiveScanRootPath,
        label: "/Volumes/Archive/Videos",
      },
      {
        path: `${archiveScanRootPath}/Travel`,
        availableScanRootPath: archiveScanRootPath,
        label: "Travel",
      },
      {
        path: `${archiveScanRootPath}/Travel/Paris`,
        availableScanRootPath: archiveScanRootPath,
        label: "Travel/Paris",
      },
    ]);
  });

  it("deduplicates folder branches from multiple Videos", () => {
    const folderBranches = folderFilterBranchesForVideos(
      [
        catalogVideoWithFileLocations([
          fileLocation("/Volumes/Archive/Videos/Travel/Paris/day-one.mp4", true),
        ]),
        catalogVideoWithFileLocations([
          fileLocation("/Volumes/Archive/Videos/Travel/Rome/day-two.mp4", true),
        ]),
      ],
      [availableScanRoot(archiveScanRootPath)],
    );

    expect(folderBranches.map((folderBranch) => folderBranch.label)).toEqual([
      "/Volumes/Archive/Videos",
      "Travel",
      "Travel/Paris",
      "Travel/Rome",
    ]);
  });
});

function catalogVideoWithFileLocations(
  fileLocations: CatalogVideo["fileLocations"],
): CatalogVideo {
  return {
    id: 1,
    title: "Paris Day One",
    durationMilliseconds: 60_000,
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

function availableScanRoot(path: string) {
  return scanRoot(path, true);
}

function unavailableScanRoot(path: string) {
  return scanRoot(path, false);
}

function scanRoot(path: string, isAvailable: boolean) {
  return {
    path,
    isAvailable,
    lastScanCompletedAt: null,
    inferenceRules: {
      suggestTagsFromFolderNames: true,
      suggestTagsFromFilenameBrackets: true,
      ignoredFolderNames: [],
      ignoredExactYearRange: {
        startYear: 1900,
        endYear: 2099,
      },
    },
  };
}

function fileLocation(path: string, isReachable: boolean) {
  return {
    path,
    fileSizeBytes: 1000,
    isPreferred: true,
    isReachable,
  };
}
