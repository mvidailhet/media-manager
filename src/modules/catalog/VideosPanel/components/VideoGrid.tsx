import { Box } from "@mantine/core";

import type { CatalogVideo } from "../../../../tauriCommands";
import type { CatalogVideoMetadata } from "../../catalogTypes";
import styles from "../VideosPanel.module.css";
import { VideoCard } from "./VideoCard";

export function VideoGrid({
  catalogVideoMetadataById,
  catalogVideos,
  onSelectVideo,
  onSetFavorite,
  onSetBatchVideoSelected,
  selectedVideoIds,
}: {
  catalogVideoMetadataById: Record<number, CatalogVideoMetadata>;
  catalogVideos: CatalogVideo[];
  onSelectVideo: (catalogVideo: CatalogVideo) => void;
  onSetFavorite: (catalogVideo: CatalogVideo, isFavorite: boolean) => void;
  onSetBatchVideoSelected: (videoId: number, isSelected: boolean) => void;
  selectedVideoIds: number[];
}) {
  if (catalogVideos.length === 0) {
    return null;
  }

  return (
    <Box className={styles.grid}>
      {catalogVideos.map((catalogVideo) => (
        <VideoCard
          catalogVideo={catalogVideo}
          catalogVideoMetadata={catalogVideoMetadataById[catalogVideo.id]}
          key={catalogVideo.id}
          onSelectVideo={onSelectVideo}
          onSetFavorite={onSetFavorite}
          onSetBatchVideoSelected={onSetBatchVideoSelected}
          isSelectedForBatch={selectedVideoIds.includes(catalogVideo.id)}
        />
      ))}
    </Box>
  );
}
