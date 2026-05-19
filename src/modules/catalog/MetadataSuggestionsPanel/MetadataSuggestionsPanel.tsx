import { Stack, Text } from "@mantine/core";

import type {
  CatalogPerformer,
  CatalogTag,
  MetadataSuggestionGroup,
  RejectMetadataSuggestionSourceRequest,
} from "../../../tauriCommands";
import type { CatalogMetadataSuggestionAcceptanceRequest } from "../catalogTypes";
import { SuggestionGroup } from "./components/SuggestionGroup";

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
            <SuggestionGroup
              availablePerformers={availablePerformers}
              availableTags={availableTags}
              key={`${suggestionGroup.suggestionKind}:${suggestionGroup.suggestedValue}`}
              suggestionGroup={suggestionGroup}
              onAcceptMetadataSuggestionVideos={onAcceptMetadataSuggestionVideos}
              onRejectMetadataSuggestionSource={onRejectMetadataSuggestionSource}
              onReviewVideo={onReviewVideo}
            />
          ))}
        </Stack>
      ) : (
        <Text c="dimmed">No Metadata Suggestions.</Text>
      )}
    </Stack>
  );
}
