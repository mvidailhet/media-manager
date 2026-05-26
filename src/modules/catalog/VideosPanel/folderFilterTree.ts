import type { Tree } from "@mantine/core";

import type { CatalogFolderSearchBranch } from "../catalogTypes";

export type FolderFilterTree = {
  data: Tree.NodeData[];
};

type FolderFilterTreeNode = {
  label: string;
  path: string;
  childrenByPath: Map<string, FolderFilterTreeNode>;
};

export function buildFolderFilterTree(
  folderBranches: CatalogFolderSearchBranch[],
): FolderFilterTree {
  const scanRootNodesByPath = new Map<string, FolderFilterTreeNode>();
  const folderBranchesByPath = new Map(
    folderBranches.map((folderBranch) => [folderBranch.path, folderBranch]),
  );

  for (const folderBranch of folderBranches) {
    const scanRootNode = findOrCreateScanRootNode(
      scanRootNodesByPath,
      folderBranch.availableScanRootPath,
    );

    if (folderBranch.path === folderBranch.availableScanRootPath) {
      continue;
    }

    const relativeBranchPath = relativeFolderBranchPath(folderBranch);
    const relativePathSegments = relativeBranchPath.split("/").filter(Boolean);
    let currentNode = scanRootNode;
    let currentPath = folderBranch.availableScanRootPath;

    for (const relativePathSegment of relativePathSegments) {
      currentPath = `${currentPath}/${relativePathSegment}`;

      if (!folderBranchesByPath.has(currentPath)) {
        continue;
      }

      currentNode = findOrCreateChildNode(
        currentNode,
        currentPath,
        relativePathSegment,
      );
    }
  }

  return {
    data: Array.from(scanRootNodesByPath.values()).map(toTreeNode),
  };
}

export function selectedFolderBranchPaths(
  selectedFolderBranches: CatalogFolderSearchBranch[] | null,
  visibleFolderBranches: CatalogFolderSearchBranch[],
) {
  if (selectedFolderBranches === null) {
    return visibleFolderBranches.map((folderBranch) => folderBranch.path);
  }

  return selectedFolderBranches.map((folderBranch) => folderBranch.path);
}

export function reconcileSelectedFolderBranches({
  currentSelectedBranches,
  nextVisibleBranches,
  previousVisibleBranches,
}: {
  currentSelectedBranches: CatalogFolderSearchBranch[];
  nextVisibleBranches: CatalogFolderSearchBranch[];
  previousVisibleBranches: CatalogFolderSearchBranch[];
}) {
  if (currentSelectedBranches.length === 0) {
    return [];
  }

  const selectedBranchPaths = new Set(
    currentSelectedBranches.map((folderBranch) => folderBranch.path),
  );
  const previousVisibleBranchPaths = new Set(
    previousVisibleBranches.map((folderBranch) => folderBranch.path),
  );

  return nextVisibleBranches.filter((nextVisibleBranch) => {
    if (selectedBranchPaths.has(nextVisibleBranch.path)) {
      return true;
    }

    if (!previousVisibleBranchPaths.has(nextVisibleBranch.availableScanRootPath)) {
      return true;
    }

    const nearestPreviousAncestor = findNearestPreviousAncestor(
      nextVisibleBranch,
      previousVisibleBranchPaths,
    );

    return (
      nearestPreviousAncestor !== null &&
      selectedBranchPaths.has(nearestPreviousAncestor)
    );
  });
}

function findOrCreateScanRootNode(
  scanRootNodesByPath: Map<string, FolderFilterTreeNode>,
  scanRootPath: string,
) {
  let scanRootNode = scanRootNodesByPath.get(scanRootPath);

  if (!scanRootNode) {
    scanRootNode = {
      childrenByPath: new Map(),
      label: scanRootPath,
      path: scanRootPath,
    };
    scanRootNodesByPath.set(scanRootPath, scanRootNode);
  }

  return scanRootNode;
}

function findOrCreateChildNode(
  parentNode: FolderFilterTreeNode,
  path: string,
  label: string,
) {
  let childNode = parentNode.childrenByPath.get(path);

  if (!childNode) {
    childNode = {
      childrenByPath: new Map(),
      label,
      path,
    };
    parentNode.childrenByPath.set(path, childNode);
  }

  return childNode;
}

function toTreeNode(folderNode: FolderFilterTreeNode): Tree.NodeData {
  const children = Array.from(folderNode.childrenByPath.values()).map(toTreeNode);

  return {
    label: folderNode.label,
    value: folderNode.path,
    ...(children.length > 0 ? { children } : {}),
  };
}

function relativeFolderBranchPath(folderBranch: CatalogFolderSearchBranch) {
  return folderBranch.path
    .slice(folderBranch.availableScanRootPath.length)
    .replace(/^\/+/, "");
}

function findNearestPreviousAncestor(
  folderBranch: CatalogFolderSearchBranch,
  previousVisibleBranchPaths: Set<string>,
) {
  const ancestorPaths = folderBranch.path.split("/");

  while (ancestorPaths.length > 1) {
    ancestorPaths.pop();
    const ancestorPath = ancestorPaths.join("/");

    if (previousVisibleBranchPaths.has(ancestorPath)) {
      return ancestorPath;
    }
  }

  return null;
}
