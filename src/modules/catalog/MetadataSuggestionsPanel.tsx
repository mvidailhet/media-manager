import { useEffect, useMemo, useState } from "react";
import { IconCaretDownFilled, IconCheck, IconX } from "@tabler/icons-react";
import { Autocomplete, Badge, Box, Button, Checkbox, Divider, Group, NativeSelect, Stack, TagsInput, Text, Tree, useTree } from "@mantine/core";

import type { CatalogPerformer, CatalogTag, MetadataSuggestionGroup } from "../../tauriCommands";
import type { RejectMetadataSuggestionSourceRequest } from "../../tauriCommands";
import { findMetadataByName, findNearMetadataMatch } from "../../shared/metadata/metadataHelpers";
import type { CatalogMetadataSuggestionAcceptanceRequest } from "./catalogTypes";

type AcceptMetadataSuggestionVideos = (request: CatalogMetadataSuggestionAcceptanceRequest) => void;
type RejectMetadataSuggestionSource = (request: RejectMetadataSuggestionSourceRequest) => void;
const metadataSuggestionTreeIconSize = 14;
const metadataSuggestionTreeCaretSize = 12;
const videoTitleActivationKeys = new Set(["Enter", " "]);

export function MetadataSuggestionsPanel({
  availablePerformers,
  availableTags,
  metadataSuggestionGroups,
  onAcceptMetadataSuggestionVideos,
  onRejectMetadataSuggestionSource,
  onReviewVideo,
}: {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  metadataSuggestionGroups: MetadataSuggestionGroup[];
  onAcceptMetadataSuggestionVideos: AcceptMetadataSuggestionVideos;
  onRejectMetadataSuggestionSource: RejectMetadataSuggestionSource;
  onReviewVideo?: (videoId: number) => void;
}) {
  return (
    <Stack
      component="section"
      gap="xs"
      aria-label="Metadata Suggestions"
    >
      {metadataSuggestionGroups.length > 0 ? (
        <Stack gap="xl">
          {metadataSuggestionGroups.map((suggestionGroup) => (
            <Stack
              component="article"
              gap="xs"
              key={`${suggestionGroup.suggestionKind}:${suggestionGroup.suggestedValue}`}
            >
              <Divider />
              <Badge variant="light" w="fit-content" size='xl' mt='lg' mb='md'>
                {suggestionGroup.suggestedValue}
              </Badge>
              <Stack gap="xl">
                {suggestionGroup.sources.map((sourceGroup) => (
                  <MetadataSuggestionSource
                    availablePerformers={availablePerformers}
                    availableTags={availableTags}
                    key={`${sourceGroup.scanRootPath}:${sourceGroup.sourcePathSegment}`}
                    sourceGroup={sourceGroup}
                    suggestionKind={suggestionGroup.suggestionKind}
                    suggestedValue={suggestionGroup.suggestedValue}
                    onAcceptMetadataSuggestionVideos={
                      onAcceptMetadataSuggestionVideos
                    }
                    onRejectMetadataSuggestionSource={
                      onRejectMetadataSuggestionSource
                    }
                    onReviewVideo={onReviewVideo}
                  />
                ))}
              </Stack>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Text c="dimmed">No Metadata Suggestions.</Text>
      )}
    </Stack>
  );
}

export function MetadataSuggestionSource({
  availablePerformers,
  availableTags,
  onAcceptMetadataSuggestionVideos,
  onRejectMetadataSuggestionSource,
  onReviewVideo,
  sourceGroup,
  suggestionKind,
  suggestedValue,
}: {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  onAcceptMetadataSuggestionVideos: AcceptMetadataSuggestionVideos;
  onRejectMetadataSuggestionSource: RejectMetadataSuggestionSource;
  onReviewVideo?: (videoId: number) => void;
  sourceGroup: MetadataSuggestionGroup["sources"][number];
  suggestionKind: string;
  suggestedValue: string;
}) {
  const suggestionVideoTree = useMemo(
    () => buildSuggestionVideoTree(sourceGroup),
    [sourceGroup],
  );
  const tree = useTree({
    initialCheckedState: suggestionVideoTree.checkedNodeValues,
    initialExpandedState: {},
  });
  const [acceptedSuggestionKind, setAcceptedSuggestionKind] =
    useState(suggestionKind);
  const [acceptedValue, setAcceptedValue] = useState(suggestedValue);
  const [additionalTagNames, setAdditionalTagNames] = useState<string[]>([]);
  const [isAddingTags, setIsAddingTags] = useState(false);
  const selectedVideoIds = getSelectedVideoIds(
    tree.checkedState,
    suggestionVideoTree.videoValueToVideoId,
  );
  const trimmedAcceptedValue = acceptedValue.trim();
  const availableMetadataValues =
    acceptedSuggestionKind === "performer" ? availablePerformers : availableTags;
  const availableMetadataNames = availableMetadataValues.map(
    (metadataValue) => metadataValue.name,
  );
  const availableTagNames = availableTags.map((tag) => tag.name);
  const exactAcceptedValue = findMetadataByName(
    availableMetadataValues,
    trimmedAcceptedValue,
  );
  const nearAcceptedValue = findNearMetadataMatch(
    availableMetadataValues,
    trimmedAcceptedValue,
  );
  const acceptedMetadataName =
    exactAcceptedValue?.name ?? trimmedAcceptedValue;
  const isDefaultAcceptance =
    acceptedSuggestionKind === suggestionKind &&
    acceptedMetadataName === suggestedValue;

  useEffect(() => {
    tree.setCheckedState(suggestionVideoTree.checkedNodeValues);
    tree.setExpandedState({});
  }, [suggestionVideoTree]);

  useEffect(() => {
    setAcceptedSuggestionKind(suggestionKind);
    setAcceptedValue(suggestedValue);
    setAdditionalTagNames([]);
    setIsAddingTags(false);
  }, [suggestedValue, suggestionKind]);

  return (
    <Stack gap="md">
      <Group gap="sm" align="center" wrap="nowrap">
        <NativeSelect
          aria-label={`Accept ${suggestedValue} as metadata kind`}
          w={128}
          value={acceptedSuggestionKind}
          data={[
            { value: "tag", label: "Tag" },
            { value: "performer", label: "Performer" },
          ]}
          onChange={(event) => setAcceptedSuggestionKind(event.currentTarget.value)}
        />
        <Autocomplete
          aria-label="Accepted metadata name"
          flex={1}
          miw={240}
          data={availableMetadataNames}
          value={acceptedValue}
          onChange={setAcceptedValue}
        />
      </Group>
      {isAddingTags ? (
        <TagsInput
          aria-label="Additional tags"
          data={availableTagNames}
          value={additionalTagNames}
          onChange={setAdditionalTagNames}
        />
      ) : (
        <Button
          size="xs"
          variant="light"
          w="fit-content"
          onClick={() => setIsAddingTags(true)}
        >
          Add Tags
        </Button>
      )}
      {nearAcceptedValue ? (
        <Text size="sm">Near match: {nearAcceptedValue.name}</Text>
      ) : null}
      <Tree
        data={suggestionVideoTree.data}
        tree={tree}
        expandOnClick
        checkOnSpace
        renderNode={({ node, elementProps, tree: nodeTree, expanded, hasChildren }) => {
          const videoId = suggestionVideoTree.videoValueToVideoId.get(node.value);
          const isNodeChecked = nodeTree.isNodeChecked(node.value);
          const isNodeIndeterminate = nodeTree.isNodeIndeterminate(node.value);

          return (
            <Group gap="xs" align="center" wrap="nowrap" {...elementProps}>
              {hasChildren ? (
                <IconCaretDownFilled
                  aria-hidden
                  size={metadataSuggestionTreeCaretSize}
                  style={{
                    transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform 120ms ease",
                  }}
                />
              ) : (
                <Box w={metadataSuggestionTreeCaretSize} />
              )}
              <Checkbox.Indicator
                role="checkbox"
                aria-checked={isNodeIndeterminate ? "mixed" : isNodeChecked}
                checked={isNodeChecked}
                indeterminate={isNodeIndeterminate}
                aria-label={String(node.label)}
                onClick={(event) => {
                  event.stopPropagation();
                  if (isNodeChecked || isNodeIndeterminate) {
                    nodeTree.uncheckNode(node.value);
                  } else {
                    nodeTree.checkNode(node.value);
                  }
                }}
              />
              {videoId && onReviewVideo ? (
                <Text
                  component="span"
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    onReviewVideo(videoId);
                  }}
                  onKeyDown={(event) => {
                    if (!videoTitleActivationKeys.has(event.key)) {
                      return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    onReviewVideo(videoId);
                  }}
                >
                  {node.label}
                </Text>
              ) : (
                <Text>{node.label}</Text>
              )}
            </Group>
          );
        }}
      />
      <Group gap="xs">
        <Button
          size="xs"
          color="green"
          leftSection={<IconCheck size={metadataSuggestionTreeIconSize} />}
          aria-label="Accept"
          disabled={
            selectedVideoIds.length === 0 || trimmedAcceptedValue.length === 0
          }
          onClick={() =>
            onAcceptMetadataSuggestionVideos({
              ...(isDefaultAcceptance
                ? {}
                : { acceptedValue: acceptedMetadataName }),
              ...(acceptedSuggestionKind === suggestionKind
                ? {}
                : { acceptedMetadataKind: acceptedSuggestionKind }),
              additionalTagNames,
              scanRootPath: sourceGroup.scanRootPath,
              suggestedValue,
              sourcePathSegment: sourceGroup.sourcePathSegment,
              suggestionKind,
              videoIds: selectedVideoIds,
            })
          }
        >
          Accept
        </Button>
        <Button
          size="xs"
          variant="light"
          color="red"
          leftSection={<IconX size={metadataSuggestionTreeIconSize} />}
          aria-label="Reject"
          onClick={() =>
            onRejectMetadataSuggestionSource({
              scanRootPath: sourceGroup.scanRootPath,
              sourcePathSegment: sourceGroup.sourcePathSegment,
              suggestedValue,
              suggestionKind,
            })
          }
        >
          Reject
        </Button>
      </Group>
    </Stack>
  );
}

type SuggestionVideoTree = {
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

function buildSuggestionVideoTree(
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
    const folderNode = findOrCreateFolderNode(
      rootFolderNode,
      sourceGroup.scanRootPath,
      relativeFolderSegments,
    );

    folderNode.videos.push({
      label: video.title,
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

function getSelectedVideoIds(
  checkedNodeValues: string[],
  videoValueToVideoId: Map<string, number>,
) {
  return checkedNodeValues
    .map((nodeValue) => videoValueToVideoId.get(nodeValue))
    .filter((videoId): videoId is number => videoId !== undefined)
    .sort((leftVideoId, rightVideoId) => leftVideoId - rightVideoId);
}

function getRelativeFolderSegments(scanRootPath: string, fileLocationPath: string) {
  const relativeFilePath = fileLocationPath.startsWith(`${scanRootPath}/`)
    ? fileLocationPath.slice(scanRootPath.length)
    : fileLocationPath;
  const folderPath = relativeFilePath.slice(0, relativeFilePath.lastIndexOf("/"));

  return folderPath.split("/").filter(Boolean);
}
