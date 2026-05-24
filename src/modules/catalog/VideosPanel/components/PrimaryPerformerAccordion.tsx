import { Accordion, Badge, Box, Group, Text } from "@mantine/core";

import type { CatalogVideo } from "../../../../tauriCommands";
import type { CatalogVideoMetadata } from "../../catalogTypes";
import { metadataBadgeColorForKind } from "../../components/metadataBadgeStyles";
import type { VideoSelectionModifiers } from "../../useCatalogModuleController";
import type { CatalogVideoPerformerGroup } from "../catalogVideoPerformerGroups";
import { groupPreviewStripVideos } from "../groupPreviewStrip";
import styles from "../VideosPanel.module.css";
import { GroupPreviewStrip } from "./GroupPreviewStrip";
import { VideoCard } from "./VideoCard";

const unassignedGroupLabel = "Unassigned";
const unassignedGroupBadgeColor = "gray";

export function primaryPerformerAccordionValue(
  performerGroup: CatalogVideoPerformerGroup,
) {
  return performerGroup.performer
    ? `performer-${performerGroup.performer.id}`
    : "unassigned";
}

export function PrimaryPerformerAccordion({
  catalogVideoMetadataById,
  dragSelectedVideoIds,
  exposedVideos,
  fullPerformerGroup,
  onSelectVideo,
  onSetFavorite,
  onShouldIgnoreClick,
  selectedDetailVideoId,
  selectedVideoIds,
}: {
  catalogVideoMetadataById: Record<number, CatalogVideoMetadata>;
  dragSelectedVideoIds: number[];
  exposedVideos: CatalogVideo[];
  fullPerformerGroup: CatalogVideoPerformerGroup;
  onSelectVideo: (
    catalogVideo: CatalogVideo,
    modifiers: VideoSelectionModifiers,
  ) => void;
  onSetFavorite: (catalogVideo: CatalogVideo, isFavorite: boolean) => void;
  onShouldIgnoreClick: () => boolean;
  selectedDetailVideoId: number | null;
  selectedVideoIds: number[];
}) {
  const performerName =
    fullPerformerGroup.performer?.name ?? unassignedGroupLabel;
  const previewVideos = groupPreviewStripVideos(fullPerformerGroup.videos);

  return (
    <Box
      aria-label={`${performerName} Primary Performer Accordion`}
      className={styles.primaryPerformerAccordion}
      role="region"
    >
      <Accordion.Item value={primaryPerformerAccordionValue(fullPerformerGroup)}>
        <Box className={styles.primaryPerformerAccordionHeader}>
          <Accordion.Control
            aria-label={`${performerName} Primary Performer Accordion`}
            className={styles.primaryPerformerAccordionControl}
          >
            <Group gap="xs" wrap="nowrap">
              <Badge
                color={
                  fullPerformerGroup.performer
                    ? metadataBadgeColorForKind("performer")
                    : unassignedGroupBadgeColor
                }
                size="lg"
                variant="light"
              >
                {performerName}
              </Badge>
              <Text c="dimmed" fw={600} size="sm">
                {fullPerformerGroup.videos.length} Videos
              </Text>
            </Group>
          </Accordion.Control>
          <GroupPreviewStrip
            catalogVideos={previewVideos}
            dragSelectedVideoIds={dragSelectedVideoIds}
            onSelectVideo={onSelectVideo}
            onSetFavorite={onSetFavorite}
            onShouldIgnoreClick={onShouldIgnoreClick}
            selectedDetailVideoId={selectedDetailVideoId}
            selectedVideoIds={selectedVideoIds}
          />
        </Box>
        <Accordion.Panel>
          <Box className={styles.primaryPerformerAccordionBody}>
            {exposedVideos.map((catalogVideo) => (
              <VideoCard
                catalogVideo={catalogVideo}
                catalogVideoMetadata={catalogVideoMetadataById[catalogVideo.id]}
                isSelectedForBatch={
                  selectedVideoIds.includes(catalogVideo.id) ||
                  dragSelectedVideoIds.includes(catalogVideo.id)
                }
                isSelectedForDetail={catalogVideo.id === selectedDetailVideoId}
                key={catalogVideo.id}
                onSelectVideo={onSelectVideo}
                onSetFavorite={onSetFavorite}
                onShouldIgnoreClick={onShouldIgnoreClick}
              />
            ))}
          </Box>
        </Accordion.Panel>
      </Accordion.Item>
    </Box>
  );
}
