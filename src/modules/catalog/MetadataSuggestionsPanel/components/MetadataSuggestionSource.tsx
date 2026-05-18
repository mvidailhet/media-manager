import { useEffect, useMemo, useState } from "react";
import { IconCaretDownFilled, IconCheck, IconX } from "@tabler/icons-react";
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Group,
  NativeSelect,
  Stack,
  TagsInput,
  Text,
  Tree,
  useTree,
} from "@mantine/core";

import {
  findMetadataByName,
  findNearMetadataMatch,
} from "../../../../shared/metadata/metadataHelpers";
import type {
  CatalogPerformer,
  CatalogTag,
  MetadataSuggestionGroup,
  RejectMetadataSuggestionSourceRequest,
} from "../../../../tauriCommands";
import type { CatalogMetadataSuggestionAcceptanceRequest } from "../../catalogTypes";
import {
  buildSuggestionVideoTree,
  getSelectedVideoIds,
} from "../metadataSuggestionTree";

type AcceptMetadataSuggestionVideos = (
  request: CatalogMetadataSuggestionAcceptanceRequest,
) => void;
type RejectMetadataSuggestionSource = (
  request: RejectMetadataSuggestionSourceRequest,
) => void;

const metadataSuggestionTreeIconSize = 14;
const metadataSuggestionTreeCaretSize = 12;
const videoTitleActivationKeys = new Set(["Enter", " "]);

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
        renderNode={({
          node,
          elementProps,
          tree: nodeTree,
          expanded,
          hasChildren,
        }) => {
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
