import { Box, Button, Group } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";

import type {
  CatalogPerformer,
  CatalogTag,
  MetadataSuggestionGroup,
  RejectMetadataSuggestionSourceRequest,
} from "../../../tauriCommands";
import type { CatalogMetadataSuggestionAcceptanceRequest } from "../catalogTypes";
import { MetadataSuggestionsPanel } from "../MetadataSuggestionsPanel";

const backNavigationIconSize = 20;

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
  onReturnToVideosView: () => void;
};

export function MetadataSuggestionsSection({
  availablePerformers,
  availableTags,
  metadataSuggestionGroups,
  onAcceptMetadataSuggestionVideos,
  onRejectMetadataSuggestionSource,
  onReviewVideo,
  onReturnToVideosView,
}: MetadataSuggestionsSectionProps) {
  return (
    <Box
      component="section"
      aria-label="Catalog Metadata Suggestions"
      p="md"
      maw={760}
    >
      <Group justify="flex-start" mb="md">
        <Button
          type="button"
          variant="subtle"
          leftSection={<IconArrowLeft size={backNavigationIconSize} />}
          onClick={onReturnToVideosView}
        >
          Back to Catalog
        </Button>
      </Group>
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
