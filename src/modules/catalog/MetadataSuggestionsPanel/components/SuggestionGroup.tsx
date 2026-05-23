import { useCallback, useEffect, useState } from "react";
import { Badge, Divider, Stack } from "@mantine/core";

import type {
  CatalogPerformer,
  CatalogTag,
  MetadataSuggestionGroup as MetadataSuggestionGroupData,
  RejectMetadataSuggestionSourceRequest,
} from "../../../../tauriCommands";
import {
  metadataBadgeColorForKind,
  type MetadataBadgeKind,
} from "../../components/metadataBadgeStyles";
import type { CatalogMetadataSuggestionAcceptanceRequest } from "../../catalogTypes";
import { SuggestionSource } from "./SuggestionSource";

type AcceptMetadataSuggestionVideos = (
  request: CatalogMetadataSuggestionAcceptanceRequest,
) => void;
type RejectMetadataSuggestionSource = (
  request: RejectMetadataSuggestionSourceRequest,
) => void;

export function SuggestionGroup({
  availablePerformers,
  availableTags,
  onAcceptMetadataSuggestionVideos,
  onRejectMetadataSuggestionSource,
  onReviewVideo,
  suggestionGroup,
}: {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  onAcceptMetadataSuggestionVideos: AcceptMetadataSuggestionVideos;
  onRejectMetadataSuggestionSource: RejectMetadataSuggestionSource;
  onReviewVideo?: (videoId: number) => void;
  suggestionGroup: MetadataSuggestionGroupData;
}) {
  const [acceptedSuggestionKind, setAcceptedSuggestionKind] = useState(
    suggestionGroup.suggestionKind,
  );
  const badgeColor = metadataBadgeColorForKind(
    acceptedSuggestionKind as MetadataBadgeKind,
  );
  const changeAcceptedSuggestionKind = useCallback((suggestionKind: string) => {
    setAcceptedSuggestionKind(suggestionKind);
  }, []);

  useEffect(() => {
    setAcceptedSuggestionKind(suggestionGroup.suggestionKind);
  }, [suggestionGroup.suggestionKind, suggestionGroup.suggestedValue]);

  return (
    <Stack
      component="article"
      gap="xs"
    >
      <Divider />
      <Badge
        color={badgeColor}
        variant="light"
        w="fit-content"
        size="xl"
        mt="lg"
        mb="md"
      >
        {suggestionGroup.suggestedValue}
      </Badge>
      <Stack gap="xl">
        {suggestionGroup.sources.map((sourceGroup) => (
          <SuggestionSource
            acceptedSuggestionKind={acceptedSuggestionKind}
            availablePerformers={availablePerformers}
            availableTags={availableTags}
            key={`${sourceGroup.scanRootPath}:${sourceGroup.sourcePathSegment}`}
            sourceGroup={sourceGroup}
            suggestionKind={suggestionGroup.suggestionKind}
            suggestedValue={suggestionGroup.suggestedValue}
            onAcceptedSuggestionKindChange={changeAcceptedSuggestionKind}
            onAcceptMetadataSuggestionVideos={onAcceptMetadataSuggestionVideos}
            onRejectMetadataSuggestionSource={onRejectMetadataSuggestionSource}
            onReviewVideo={onReviewVideo}
          />
        ))}
      </Stack>
    </Stack>
  );
}
