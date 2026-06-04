import { describe, expect, it } from "vitest";

import type { PreviewGenerationScopeBranch } from "../../../../tauriCommands";
import { reconcilePreviewGenerationScopeSelection } from "./previewGenerationScopeSelection";

const scanRootPath = "/Volumes/Archive/Videos";
const travelPath = "/Volumes/Archive/Videos/Travel";
const parisPath = "/Volumes/Archive/Videos/Travel/Paris";
const romePath = "/Volumes/Archive/Videos/Travel/Rome";
const studioPath = "/Volumes/Archive/Videos/Studio";

function scopeBranch(path: string): PreviewGenerationScopeBranch {
  return {
    availableScanRootPath: scanRootPath,
    path,
  };
}

describe("reconcilePreviewGenerationScopeSelection", () => {
  it("keeps all selected when visible pending folders change", () => {
    const visibleScopeBranches = [
      scopeBranch(scanRootPath),
      scopeBranch(travelPath),
      scopeBranch(parisPath),
    ];

    const reconciledSelection = reconcilePreviewGenerationScopeSelection({
      selectedScopeBranches: null,
      visibleScopeBranches,
    });

    expect(reconciledSelection.checkedBranchPaths).toEqual([
      scanRootPath,
      travelPath,
      parisPath,
    ]);
    expect(reconciledSelection.selectedScopeBranches).toBeNull();
  });

  it("preserves explicit empty selection as empty", () => {
    const visibleScopeBranches = [
      scopeBranch(scanRootPath),
      scopeBranch(travelPath),
    ];

    const reconciledSelection = reconcilePreviewGenerationScopeSelection({
      selectedScopeBranches: [],
      visibleScopeBranches,
    });

    expect(reconciledSelection.checkedBranchPaths).toEqual([]);
    expect(reconciledSelection.selectedScopeBranches).toEqual([]);
  });

  it("keeps selected ancestors selected for newly visible pending child folders", () => {
    const visibleScopeBranches = [
      scopeBranch(scanRootPath),
      scopeBranch(travelPath),
      scopeBranch(parisPath),
      scopeBranch(romePath),
      scopeBranch(studioPath),
    ];

    const reconciledSelection = reconcilePreviewGenerationScopeSelection({
      selectedScopeBranches: [scopeBranch(travelPath)],
      visibleScopeBranches,
    });

    expect(reconciledSelection.checkedBranchPaths).toEqual([
      travelPath,
      parisPath,
      romePath,
    ]);
    expect(reconciledSelection.selectedScopeBranches).toEqual([
      scopeBranch(travelPath),
      scopeBranch(parisPath),
      scopeBranch(romePath),
    ]);
  });

  it("drops completed folders from partial selection without selecting unchecked branches", () => {
    const visibleScopeBranches = [
      scopeBranch(scanRootPath),
      scopeBranch(travelPath),
      scopeBranch(romePath),
      scopeBranch(studioPath),
    ];

    const reconciledSelection = reconcilePreviewGenerationScopeSelection({
      selectedScopeBranches: [scopeBranch(parisPath), scopeBranch(studioPath)],
      visibleScopeBranches,
    });

    expect(reconciledSelection.checkedBranchPaths).toEqual([studioPath]);
    expect(reconciledSelection.selectedScopeBranches).toEqual([
      scopeBranch(studioPath),
    ]);
  });
});
