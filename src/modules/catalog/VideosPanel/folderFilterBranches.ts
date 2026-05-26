import type { CatalogVideo, ScanRoot } from "../../../tauriCommands";
import type { CatalogFolderSearchBranch } from "../catalogTypes";

export type FolderFilterBranchOption = CatalogFolderSearchBranch & {
  label: string;
};

export function folderFilterBranchesForVideos(
  catalogVideos: CatalogVideo[],
  scanRoots: ScanRoot[],
): FolderFilterBranchOption[] {
  const folderBranchesByPath = new Map<string, FolderFilterBranchOption>();
  const availableScanRootPaths = scanRoots
    .filter((scanRoot) => scanRoot.isAvailable)
    .map((scanRoot) => scanRoot.path);

  for (const catalogVideo of catalogVideos) {
    for (const fileLocation of catalogVideo.fileLocations) {
      if (!fileLocation.isReachable) {
        continue;
      }

      for (const availableScanRootPath of availableScanRootPaths) {
        for (const branchPath of branchPathsForFileLocation(
          fileLocation.path,
          availableScanRootPath,
        )) {
          folderBranchesByPath.set(branchPath, {
            path: branchPath,
            availableScanRootPath,
            label: folderBranchLabel(branchPath, availableScanRootPath),
          });
        }
      }
    }
  }

  return [...folderBranchesByPath.values()].sort((firstBranch, secondBranch) =>
    firstBranch.path.localeCompare(secondBranch.path),
  );
}

function branchPathsForFileLocation(fileLocationPath: string, scanRootPath: string) {
  const fileFolderPath = parentFolderPath(fileLocationPath);
  const normalizedScanRootPath = normalizedFolderPath(scanRootPath);
  const normalizedFileFolderPath = normalizedFolderPath(fileFolderPath);

  if (!pathIsInsideBranch(normalizedFileFolderPath, normalizedScanRootPath)) {
    return [];
  }

  const relativeFolderPath = normalizedFileFolderPath
    .slice(normalizedScanRootPath.length)
    .replace(/^\/+/, "");

  const branchPaths = [normalizedScanRootPath];
  const relativePathSegments = relativeFolderPath
    .split("/")
    .filter((pathSegment) => pathSegment.length > 0);

  for (const relativePathSegment of relativePathSegments) {
    const parentBranchPath = branchPaths[branchPaths.length - 1];
    branchPaths.push(`${parentBranchPath}/${relativePathSegment}`);
  }

  return branchPaths;
}

function folderBranchLabel(branchPath: string, scanRootPath: string) {
  if (branchPath === scanRootPath) {
    return scanRootPath;
  }

  return branchPath.slice(scanRootPath.length).replace(/^\/+/, "");
}

function parentFolderPath(path: string) {
  const normalizedPath = normalizedFolderPath(path);
  const lastSeparatorIndex = normalizedPath.lastIndexOf("/");

  if (lastSeparatorIndex <= 0) {
    return normalizedPath;
  }

  return normalizedPath.slice(0, lastSeparatorIndex);
}

function normalizedFolderPath(path: string) {
  return path.replace(/\\/g, "/").replace(/\/+$/g, "");
}

function pathIsInsideBranch(path: string, branchPath: string) {
  return path === branchPath || path.startsWith(`${branchPath}/`);
}
