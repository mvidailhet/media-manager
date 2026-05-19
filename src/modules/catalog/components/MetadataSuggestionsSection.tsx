import { Box } from "@mantine/core";

import type {
  CatalogPerformer,
  CatalogTag,
  MetadataSuggestionGroup,
  RejectMetadataSuggestionSourceRequest,
} from "../../../tauriCommands";
import type { CatalogMetadataSuggestionAcceptanceRequest } from "../catalogTypes";
import { MetadataSuggestionsPanel } from "../MetadataSuggestionsPanel";

type MetadataSuggestionsSectionProps = {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  metadataSuggestionGroups: MetadataSuggestionGroup[];
  onAcceptMetadataSuggestionVideos: (
    request: CatalogMetadataSuggestionAcceptanceRequest,
  ) => void;
  onRejectMetadataSuggestionSource: (
    request: RejectMetadataSuggestionSourceRequest,
  ) => void;
  onReviewVideo: (videoId: number) => void;
};

export function MetadataSuggestionsSection({
  availablePerformers,
  availableTags,
  metadataSuggestionGroups,
  onAcceptMetadataSuggestionVideos,
  onRejectMetadataSuggestionSource,
  onReviewVideo,
}: MetadataSuggestionsSectionProps) {
  return (
    <Box
      component="section"
      aria-label="Catalog Metadata Suggestions"
      p="md"
      maw={760}
    >
      <MetadataSuggestionsPanel
        availablePerformers={availablePerformers}
        availableTags={availableTags}
        metadataSuggestionGroups={metadataSuggestionGroups}
        onAcceptMetadataSuggestionVideos={onAcceptMetadataSuggestionVideos}
        onRejectMetadataSuggestionSource={onRejectMetadataSuggestionSource}
        onReviewVideo={onReviewVideo}
      />
    </Box>
  );
}
