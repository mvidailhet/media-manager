import { Tree } from "@mantine/core";

import type { MetadataSuggestionGroup } from "../../../tauriCommands";

export type SuggestionVideoTree = {
  checkedNodeValues: string[];
  data: Tree.NodeData[];
  videoValueToVideoId: Map<string, number>;
};

type SuggestionFolderNode = {
  label: string;
  value: string;
  childFoldersByName: Map<string, SuggestionFolderNode>;
  videos: Tree.NodeData[];
};

export function buildSuggestionVideoTree(
  sourceGroup: MetadataSuggestionGroup["sources"][number],
): SuggestionVideoTree {
  const scanRootNodeValue = `scan-root:${sourceGroup.scanRootPath}`;
  const rootFolderNode: SuggestionFolderNode = {
    label: sourceGroup.scanRootPath,
    value: scanRootNodeValue,
    childFoldersByName: new Map(),
    videos: [],
  };
  const videoValueToVideoId = new Map<string, number>();
  const checkedNodeValues: string[] = [];

  for (const video of sourceGroup.videos) {
    const relativeFolderSegments = getRelativeFolderSegments(
      sourceGroup.scanRootPath,
      video.fileLocationPath,
    );
    const videoNodeValue = `video:${video.videoId}`;
    const fileName = getFileName(video.fileLocationPath);
    const folderNode = findOrCreateFolderNode(
      rootFolderNode,
      sourceGroup.scanRootPath,
      relativeFolderSegments,
    );

    folderNode.videos.push({
      label: fileName || video.title,
      value: videoNodeValue,
    });
    videoValueToVideoId.set(videoNodeValue, video.videoId);
    checkedNodeValues.push(videoNodeValue);
  }

  return {
    checkedNodeValues,
    data: [toTreeNode(rootFolderNode)],
    videoValueToVideoId,
  };
}

export function getSelectedVideoIds(
  checkedNodeValues: string[],
  videoValueToVideoId: Map<string, number>,
) {
  return checkedNodeValues
    .map((nodeValue) => videoValueToVideoId.get(nodeValue))
    .filter((videoId): videoId is number => videoId !== undefined)
    .sort((leftVideoId, rightVideoId) => leftVideoId - rightVideoId);
}

function findOrCreateFolderNode(
  rootFolderNode: SuggestionFolderNode,
  scanRootPath: string,
  folderSegments: string[],
) {
  let currentFolderNode = rootFolderNode;
  let currentFolderPath = "";

  for (const folderSegment of folderSegments) {
    currentFolderPath = `${currentFolderPath}/${folderSegment}`;
    let childFolderNode =
      currentFolderNode.childFoldersByName.get(folderSegment);

    if (!childFolderNode) {
      childFolderNode = {
        label: folderSegment,
        value: `folder:${scanRootPath}:${currentFolderPath}`,
        childFoldersByName: new Map(),
        videos: [],
      };
      currentFolderNode.childFoldersByName.set(folderSegment, childFolderNode);
    }

    currentFolderNode = childFolderNode;
  }

  return currentFolderNode;
}

function toTreeNode(folderNode: SuggestionFolderNode): Tree.NodeData {
  const childFolderNodes = Array.from(folderNode.childFoldersByName.values())
    .sort((leftNode, rightNode) => leftNode.label.localeCompare(rightNode.label))
    .map(toTreeNode);
  const videoNodes = folderNode.videos.sort((leftNode, rightNode) =>
    String(leftNode.label).localeCompare(String(rightNode.label)),
  );

  return {
    label: folderNode.label,
    value: folderNode.value,
    children: [...childFolderNodes, ...videoNodes].map(
      compressSingleChildTreeNode,
    ),
  };
}

function compressSingleChildTreeNode(treeNode: Tree.NodeData): Tree.NodeData {
  let compressedTreeNode = treeNode;

  while (compressedTreeNode.children?.length === 1) {
    const onlyChild = compressedTreeNode.children[0];

    compressedTreeNode = {
      ...onlyChild,
      label: `${compressedTreeNode.label}/${onlyChild.label}`,
    };
  }

  return compressedTreeNode;
}

function getRelativeFolderSegments(scanRootPath: string, fileLocationPath: string) {
  const relativeFilePath = fileLocationPath.startsWith(`${scanRootPath}/`)
    ? fileLocationPath.slice(scanRootPath.length)
    : fileLocationPath;
  const folderPath = relativeFilePath.slice(0, relativeFilePath.lastIndexOf("/"));

  return folderPath.split("/").filter(Boolean);
}

function getFileName(fileLocationPath: string) {
  const pathSegments = fileLocationPath.split("/").filter(Boolean);

  return pathSegments[pathSegments.length - 1] ?? "";
}
