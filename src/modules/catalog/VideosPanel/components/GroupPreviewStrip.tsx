import { Group } from "@mantine/core";

import type { CatalogVideo } from "../../../../tauriCommands";
import type { VideoSelectionModifiers } from "../../useCatalogModuleController";
import styles from "../VideosPanel.module.css";
import { GroupPreviewCard } from "./GroupPreviewCard";

export function GroupPreviewStrip({
  catalogVideos,
  dragSelectedVideoIds,
  onSelectVideo,
  onSetFavorite,
  onShouldIgnoreClick,
  selectedDetailVideoId,
  selectedVideoIds,
}: {
  catalogVideos: CatalogVideo[];
  dragSelectedVideoIds: number[];
  onSelectVideo: (
    catalogVideo: CatalogVideo,
    modifiers: VideoSelectionModifiers,
  ) => void;
  onSetFavorite: (catalogVideo: CatalogVideo, isFavorite: boolean) => void;
  onShouldIgnoreClick: () => boolean;
  selectedDetailVideoId: number | null;
  selectedVideoIds: number[];
}) {
  return (
    <Group className={styles.groupPreviewStrip} gap="xs" wrap="nowrap">
      {catalogVideos.map((catalogVideo) => (
        <GroupPreviewCard
          catalogVideo={catalogVideo}
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
    </Group>
  );
}
