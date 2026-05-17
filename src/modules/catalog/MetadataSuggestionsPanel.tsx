import { useEffect, useMemo, useState } from "react";
import { IconCaretDownFilled, IconCheck, IconX } from "@tabler/icons-react";
import { Badge, Box, Button, Checkbox, Divider, Group, NativeSelect, Stack, Text, TextInput, Title, Tree, useTree } from "@mantine/core";

import type { CatalogPerformer, CatalogTag, MetadataSuggestionGroup } from "../../tauriCommands";
import type { AcceptMetadataSuggestionForVideosRequest, RejectMetadataSuggestionSourceRequest } from "../../tauriCommands";
import { DefinitionTerm } from "../../shared/components/DefinitionTerm";
import { formatSuggestionKind } from "../../shared/formatting/suggestionFormatting";
import { findMetadataByName, findNearMetadataMatch } from "../../shared/metadata/metadataHelpers";

type AcceptMetadataSuggestionVideos = (request: AcceptMetadataSuggestionForVideosRequest) => void;
type RejectMetadataSuggestionSource = (request: RejectMetadataSuggestionSourceRequest) => void;
const metadataSuggestionTreeIconSize = 14;
const metadataSuggestionTreeCaretSize = 12;

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
        <Stack gap="sm">
          {metadataSuggestionGroups.map((suggestionGroup) => (
            <Stack
              component="article"
              gap="xs"
              key={`${suggestionGroup.suggestionKind}:${suggestionGroup.suggestedValue}`}
            >
              <Divider />
              <Group gap="xs" align="center">
                <Title order={4} size="h5">
                  {suggestionGroup.suggestedValue}
                </Title>
                <Badge variant="light">
                  {formatSuggestionKind(suggestionGroup.suggestionKind)}
                </Badge>
              </Group>
              <Stack gap="xs">
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
  const selectedVideoIds = getSelectedVideoIds(
    tree.checkedState,
    suggestionVideoTree.videoValueToVideoId,
  );
  const trimmedAcceptedValue = acceptedValue.trim();
  const availableMetadataValues =
    acceptedSuggestionKind === "performer" ? availablePerformers : availableTags;
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
  }, [suggestedValue, suggestionKind]);

  return (
    <Box>
      <Box component="dl" className="definition-list">
        <DefinitionTerm label="Source Segment">
          {sourceGroup.sourcePathSegment}
        </DefinitionTerm>
        <DefinitionTerm label="Scan Root">{sourceGroup.scanRootPath}</DefinitionTerm>
      </Box>
      <Group gap="xs" align="end" mb="xs">
        <NativeSelect
          label={`Accept ${suggestedValue} as metadata kind`}
          value={acceptedSuggestionKind}
          data={[
            { value: "tag", label: "Tag" },
            { value: "performer", label: "Performer" },
          ]}
          onChange={(event) => setAcceptedSuggestionKind(event.currentTarget.value)}
        />
        <TextInput
          label="Accepted metadata name"
          value={acceptedValue}
          onChange={(event) => setAcceptedValue(event.currentTarget.value)}
        />
      </Group>
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
              <Text>{node.label}</Text>
              {videoId && onReviewVideo ? (
                <Button
                  type="button"
                  size="xs"
                  variant="subtle"
                  onClick={(event) => {
                    event.stopPropagation();
                    onReviewVideo(videoId);
                  }}
                >
                  Review {node.label}
                </Button>
              ) : null}
            </Group>
          );
        }}
      />
      <Group gap="xs" mt="xs">
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
    </Box>
  );
}

type SuggestionVideoTree = {
  checkedNodeValues: string[];
  data: Tree.NodeData[];
  videoValueToVideoId: Map<string, number>;
};

function buildSuggestionVideoTree(
  sourceGroup: MetadataSuggestionGroup["sources"][number],
): SuggestionVideoTree {
  const scanRootNodeValue = `scan-root:${sourceGroup.scanRootPath}`;
  const folderNodesByPath = new Map<string, Tree.NodeData>();
  const videoValueToVideoId = new Map<string, number>();
  const checkedNodeValues: string[] = [];

  for (const video of sourceGroup.videos) {
    const relativeFolderPath = getRelativeFolderPath(
      sourceGroup.scanRootPath,
      video.fileLocationPath,
    );
    const folderNodeValue = `folder:${sourceGroup.scanRootPath}:${relativeFolderPath}`;
    const videoNodeValue = `video:${video.videoId}`;
    let folderNode = folderNodesByPath.get(relativeFolderPath);

    if (!folderNode) {
      folderNode = {
        label: relativeFolderPath,
        value: folderNodeValue,
        children: [],
      };
      folderNodesByPath.set(relativeFolderPath, folderNode);
    }

    folderNode.children?.push({
      label: video.title,
      value: videoNodeValue,
    });
    videoValueToVideoId.set(videoNodeValue, video.videoId);
    checkedNodeValues.push(videoNodeValue);
  }

  const folderNodes = Array.from(folderNodesByPath.entries())
    .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
    .map(([_folderPath, folderNode]) => ({
      ...folderNode,
      children: folderNode.children?.sort((leftNode, rightNode) =>
        String(leftNode.label).localeCompare(String(rightNode.label)),
      ),
    }));

  return {
    checkedNodeValues,
    data: [
      {
        label: `Root: ${sourceGroup.scanRootPath}`,
        value: scanRootNodeValue,
        children: folderNodes,
      },
    ],
    videoValueToVideoId,
  };
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

function getRelativeFolderPath(scanRootPath: string, fileLocationPath: string) {
  const relativeFilePath = fileLocationPath.startsWith(`${scanRootPath}/`)
    ? fileLocationPath.slice(scanRootPath.length)
    : fileLocationPath;
  const folderPath = relativeFilePath.slice(0, relativeFilePath.lastIndexOf("/"));

  return folderPath.length > 0 ? folderPath : "/";
}
