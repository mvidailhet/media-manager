import { Badge, Divider, Stack, Text } from "@mantine/core";

import type {
  CatalogPerformer,
  CatalogTag,
  MetadataSuggestionGroup,
  RejectMetadataSuggestionSourceRequest,
} from "../../../tauriCommands";
import type { CatalogMetadataSuggestionAcceptanceRequest } from "../catalogTypes";
import { MetadataSuggestionSource } from "./components/MetadataSuggestionSource";

type AcceptMetadataSuggestionVideos = (
  request: CatalogMetadataSuggestionAcceptanceRequest,
) => void;
type RejectMetadataSuggestionSource = (
  request: RejectMetadataSuggestionSourceRequest,
) => void;

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
              <Badge variant="light" w="fit-content" size="xl" mt="lg" mb="md">
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
