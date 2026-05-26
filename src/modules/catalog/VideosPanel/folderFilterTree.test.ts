import { describe, expect, it } from "vitest";

import type { CatalogFolderSearchBranch } from "../catalogTypes";
import {
  buildFolderFilterTree,
  reconcileSelectedFolderBranches,
  selectedFolderBranchPaths,
} from "./folderFilterTree";

const archiveScanRootPath = "/Volumes/Archive/Videos";
const backupScanRootPath = "/Volumes/Backup/Videos";

describe("folderFilterTree", () => {
  it("groups folder branches by available Scan Root", () => {
    const folderFilterTree = buildFolderFilterTree([
      branch(archiveScanRootPath, archiveScanRootPath),
      branch(`${archiveScanRootPath}/Travel`, archiveScanRootPath),
      branch(`${archiveScanRootPath}/Travel/Paris`, archiveScanRootPath),
      branch(backupScanRootPath, backupScanRootPath),
      branch(`${backupScanRootPath}/Studio`, backupScanRootPath),
    ]);

    expect(folderFilterTree.data).toEqual([
      {
        label: archiveScanRootPath,
        value: archiveScanRootPath,
        children: [
          {
            label: "Travel",
            value: `${archiveScanRootPath}/Travel`,
            children: [
              {
                label: "Paris",
                value: `${archiveScanRootPath}/Travel/Paris`,
              },
            ],
          },
        ],
      },
      {
        label: backupScanRootPath,
        value: backupScanRootPath,
        children: [
          {
            label: "Studio",
            value: `${backupScanRootPath}/Studio`,
          },
        ],
      },
    ]);
  });

  it("selects all visible branches by default", () => {
    const visibleBranches = [
      branch(archiveScanRootPath, archiveScanRootPath),
      branch(`${archiveScanRootPath}/Travel`, archiveScanRootPath),
    ];

    expect(selectedFolderBranchPaths(null, visibleBranches)).toEqual([
      archiveScanRootPath,
      `${archiveScanRootPath}/Travel`,
    ]);
  });

  it("lets new folders discovered by Refresh inherit selection from their nearest existing ancestor", () => {
    const previousVisibleBranches = [
      branch(archiveScanRootPath, archiveScanRootPath),
      branch(`${archiveScanRootPath}/Travel`, archiveScanRootPath),
      branch(`${archiveScanRootPath}/Studio`, archiveScanRootPath),
    ];
    const currentSelectedBranches = [
      branch(`${archiveScanRootPath}/Travel`, archiveScanRootPath),
    ];
    const nextVisibleBranches = [
      ...previousVisibleBranches,
      branch(`${archiveScanRootPath}/Travel/Paris`, archiveScanRootPath),
      branch(`${archiveScanRootPath}/Studio/New`, archiveScanRootPath),
    ];

    expect(
      reconcileSelectedFolderBranches({
        currentSelectedBranches,
        nextVisibleBranches,
        previousVisibleBranches,
      }),
    ).toEqual([
      branch(`${archiveScanRootPath}/Travel`, archiveScanRootPath),
      branch(`${archiveScanRootPath}/Travel/Paris`, archiveScanRootPath),
    ]);
  });

  it("forgets folders absent from the current tree", () => {
    const previousVisibleBranches = [
      branch(archiveScanRootPath, archiveScanRootPath),
      branch(`${archiveScanRootPath}/Travel`, archiveScanRootPath),
    ];
    const currentSelectedBranches = previousVisibleBranches;
    const nextVisibleBranches = [branch(archiveScanRootPath, archiveScanRootPath)];

    expect(
      reconcileSelectedFolderBranches({
        currentSelectedBranches,
        nextVisibleBranches,
        previousVisibleBranches,
      }),
    ).toEqual([branch(archiveScanRootPath, archiveScanRootPath)]);
  });

  it("selects returning Scan Roots by default unless the current state is explicit unselect-all", () => {
    const previousVisibleBranches = [branch(archiveScanRootPath, archiveScanRootPath)];
    const nextVisibleBranches = [
      branch(archiveScanRootPath, archiveScanRootPath),
      branch(backupScanRootPath, backupScanRootPath),
      branch(`${backupScanRootPath}/Studio`, backupScanRootPath),
    ];

    expect(
      reconcileSelectedFolderBranches({
        currentSelectedBranches: [branch(archiveScanRootPath, archiveScanRootPath)],
        nextVisibleBranches,
        previousVisibleBranches,
      }),
    ).toEqual(nextVisibleBranches);

    expect(
      reconcileSelectedFolderBranches({
        currentSelectedBranches: [],
        nextVisibleBranches,
        previousVisibleBranches,
      }),
    ).toEqual([]);
  });
});

function branch(
  path: string,
  availableScanRootPath: string,
): CatalogFolderSearchBranch {
  return {
    availableScanRootPath,
    path,
  };
}
