import type { KeyboardEvent } from "react";
import { Box, Checkbox, Paper, Stack, Text } from "@mantine/core";

import type { CatalogVideo } from "../../../../tauriCommands";
import type { CatalogVideoMetadata } from "../../catalogTypes";
import { VideoPreview } from "../../components/VideoPreview/VideoPreview";
import styles from "../VideosPanel.module.css";
import { MetadataBadges } from "../../components/MetadataBadges";

export function VideoCard({
  catalogVideo,
  catalogVideoMetadata,
  isSelectedForBatch,
  onSelectVideo,
  onSetFavorite,
  onSetBatchVideoSelected,
}: {
  catalogVideo: CatalogVideo;
  catalogVideoMetadata: CatalogVideoMetadata | undefined;
  isSelectedForBatch: boolean;
  onSelectVideo: (catalogVideo: CatalogVideo) => void;
  onSetFavorite: (catalogVideo: CatalogVideo, isFavorite: boolean) => void;
  onSetBatchVideoSelected: (videoId: number, isSelected: boolean) => void;
}) {
  const tags = catalogVideoMetadata?.tags ?? [];
  const performers = catalogVideoMetadata?.performers ?? [];

  function selectCatalogVideo() {
    onSelectVideo(catalogVideo);
  }

  function selectCatalogVideoFromKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    selectCatalogVideo();
  }

  return (
    <Paper
      component="article"
      aria-label={catalogVideo.title}
      className={styles.card}
      onClick={selectCatalogVideo}
      onKeyDown={selectCatalogVideoFromKeyboard}
      p="xs"
      tabIndex={0}
      withBorder
    >
      <Stack gap="xs">
        <Box className={styles.cardPreview}>
          <VideoPreview
            catalogVideo={catalogVideo}
            onFavoriteChange={(isFavorite) =>
              onSetFavorite(catalogVideo, isFavorite)
            }
          />
          <Box
            className={styles.batchCheckbox}
            onClick={(event) => event.stopPropagation()}
          >
            <Checkbox
              aria-label={`Select ${catalogVideo.title}`}
              checked={isSelectedForBatch}
              onChange={(event) =>
                onSetBatchVideoSelected(
                  catalogVideo.id,
                  event.currentTarget.checked,
                )
              }
            />
          </Box>
        </Box>

        <Text className={styles.title} fw={500} size="sm">
          {catalogVideo.title}
        </Text>

        <MetadataBadges
          gap={4}
          label="Tags"
          items={tags}
          metadataKind="tag"
        />
        <MetadataBadges
          gap={4}
          label="Performers"
          items={performers}
          metadataKind="performer"
        />
      </Stack>
    </Paper>
  );
}
