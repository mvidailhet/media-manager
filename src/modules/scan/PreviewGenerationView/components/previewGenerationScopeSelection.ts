import type { PreviewGenerationScopeBranch } from "../../../../tauriCommands";

export function reconcilePreviewGenerationScopeSelection({
  selectedScopeBranches,
  visibleScopeBranches,
}: {
  selectedScopeBranches: PreviewGenerationScopeBranch[] | null;
  visibleScopeBranches: PreviewGenerationScopeBranch[];
}) {
  const checkedBranchPaths = selectedScopeBranchPaths(
    selectedScopeBranches,
    visibleScopeBranches,
  );

  if (selectedScopeBranches === null) {
    return {
      checkedBranchPaths,
      selectedScopeBranches,
    };
  }

  return {
    checkedBranchPaths,
    selectedScopeBranches: selectedBranchesForCheckedPaths(
      checkedBranchPaths,
      visibleScopeBranches,
    ),
  };
}

export function selectedBranchesForCheckedPaths(
  checkedBranchPaths: string[],
  visibleScopeBranches: PreviewGenerationScopeBranch[],
) {
  const checkedBranchPathSet = new Set(checkedBranchPaths);

  if (checkedBranchPathSet.size === 0) {
    return [];
  }

  if (checkedBranchPathSet.size === visibleScopeBranches.length) {
    return null;
  }

  return visibleScopeBranches
    .filter((scopeBranch) => checkedBranchPathSet.has(scopeBranch.path))
    .map(({ availableScanRootPath, path }) => ({
      availableScanRootPath,
      path,
    }));
}

export function samePreviewGenerationScopeBranches(
  firstScopeBranches: PreviewGenerationScopeBranch[] | null,
  secondScopeBranches: PreviewGenerationScopeBranch[] | null,
) {
  if (firstScopeBranches === null || secondScopeBranches === null) {
    return firstScopeBranches === secondScopeBranches;
  }

  if (firstScopeBranches.length !== secondScopeBranches.length) {
    return false;
  }

  return firstScopeBranches.every((firstScopeBranch, scopeBranchIndex) => {
    const secondScopeBranch = secondScopeBranches[scopeBranchIndex];

    return (
      firstScopeBranch.path === secondScopeBranch.path &&
      firstScopeBranch.availableScanRootPath ===
        secondScopeBranch.availableScanRootPath
    );
  });
}

function selectedScopeBranchPaths(
  selectedScopeBranches: PreviewGenerationScopeBranch[] | null,
  visibleScopeBranches: PreviewGenerationScopeBranch[],
) {
  if (selectedScopeBranches === null) {
    return visibleScopeBranches.map((scopeBranch) => scopeBranch.path);
  }

  return visibleScopeBranches
    .filter((visibleScopeBranch) =>
      selectedScopeBranches.some((selectedScopeBranch) =>
        scopeBranchIsInsideSelectedBranch(visibleScopeBranch, selectedScopeBranch),
      ),
    )
    .map((scopeBranch) => scopeBranch.path);
}

function scopeBranchIsInsideSelectedBranch(
  visibleScopeBranch: PreviewGenerationScopeBranch,
  selectedScopeBranch: PreviewGenerationScopeBranch,
) {
  return (
    visibleScopeBranch.availableScanRootPath ===
      selectedScopeBranch.availableScanRootPath &&
    pathIsInsideBranch(visibleScopeBranch.path, selectedScopeBranch.path)
  );
}

function pathIsInsideBranch(path: string, branchPath: string) {
  return path === branchPath || path.startsWith(`${branchPath}/`);
}
