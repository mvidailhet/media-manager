import { useEffect, useState } from "react";
import { Badge, Box, Button, Checkbox, Code, Divider, Group, NativeSelect, Stack, Text, TextInput, Title } from "@mantine/core";

import type { CatalogPerformer, CatalogTag, MetadataSuggestionGroup } from "../../tauriCommands";
import type { AcceptMetadataSuggestionForVideosRequest, RejectMetadataSuggestionSourceRequest } from "../../tauriCommands";
import { DefinitionTerm } from "../../shared/components/DefinitionTerm";
import { formatSuggestionKind } from "../../shared/formatting/suggestionFormatting";
import { findMetadataByName, findNearMetadataMatch } from "../../shared/metadata/metadataHelpers";

type AcceptMetadataSuggestionVideos = (request: AcceptMetadataSuggestionForVideosRequest) => void;
type RejectMetadataSuggestionSource = (request: RejectMetadataSuggestionSourceRequest) => void;
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
      aria-labelledby="metadata-suggestions-title"
    >
      <Title order={3} id="metadata-suggestions-title" size="h4">
        Metadata Suggestions
      </Title>
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
  const allVideoIds = sourceGroup.videos.map((video) => video.videoId);
  const [selectedVideoIds, setSelectedVideoIds] = useState(allVideoIds);
  const [acceptedSuggestionKind, setAcceptedSuggestionKind] =
    useState(suggestionKind);
  const [acceptedValue, setAcceptedValue] = useState(suggestedValue);
  const selectedVideoIdSet = new Set(selectedVideoIds);
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
  const acceptedSuggestionKindLabel = formatSuggestionKind(acceptedSuggestionKind);
  const acceptedMetadataName =
    exactAcceptedValue?.name ?? trimmedAcceptedValue;
  const isDefaultAcceptance =
    acceptedSuggestionKind === suggestionKind &&
    acceptedMetadataName === suggestedValue;
  const acceptButtonLabel = isDefaultAcceptance
    ? `Accept ${suggestedValue} for selected Videos`
    : `Accept ${acceptedMetadataName} as ${acceptedSuggestionKindLabel} for selected Videos`;

  useEffect(() => {
    setSelectedVideoIds(allVideoIds);
  }, [sourceGroup]);

  useEffect(() => {
    setAcceptedSuggestionKind(suggestionKind);
    setAcceptedValue(suggestedValue);
  }, [suggestedValue, suggestionKind]);

  function toggleVideo(videoId: number, isSelected: boolean) {
    setSelectedVideoIds((currentVideoIds) => {
      if (isSelected) {
        return [...currentVideoIds, videoId].sort();
      }

      return currentVideoIds.filter((currentVideoId) => currentVideoId !== videoId);
    });
  }

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
      <Stack gap={4}>
        {sourceGroup.videos.map((video) => (
          <Group key={video.videoId} align="start" gap="xs">
            <Checkbox
              checked={selectedVideoIdSet.has(video.videoId)}
              label={
                <Box>
                  <Text>{video.title}</Text>
                  <Code className="wrapping-code">{video.fileLocationPath}</Code>
                </Box>
              }
              onChange={(event) =>
                toggleVideo(video.videoId, event.currentTarget.checked)
              }
              aria-label={`Include ${video.title}`}
            />
            {onReviewVideo ? (
              <Button
                type="button"
                size="xs"
                variant="subtle"
                onClick={() => onReviewVideo(video.videoId)}
              >
                Review {video.title}
              </Button>
            ) : null}
          </Group>
        ))}
      </Stack>
      <Group gap="xs" mt="xs">
        <Button
          size="xs"
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
          {acceptButtonLabel}
        </Button>
        <Button
          size="xs"
          variant="light"
          color="red"
          onClick={() =>
            onRejectMetadataSuggestionSource({
              scanRootPath: sourceGroup.scanRootPath,
              sourcePathSegment: sourceGroup.sourcePathSegment,
              suggestedValue,
              suggestionKind,
            })
          }
        >
          Reject {suggestedValue} from {sourceGroup.sourcePathSegment}
        </Button>
      </Group>
    </Box>
  );
}
