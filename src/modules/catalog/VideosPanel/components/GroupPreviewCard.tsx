import type { KeyboardEvent, MouseEvent } from "react";
import { Paper, Text } from "@mantine/core";

import type { CatalogVideo } from "../../../../tauriCommands";
import type { VideoSelectionModifiers } from "../../useCatalogModuleController";
import { VideoPreview } from "../../components/VideoPreview/VideoPreview";
import styles from "../VideosPanel.module.css";

export function GroupPreviewCard({
  catalogVideo,
  isSelectedForBatch,
  isSelectedForDetail,
  onSelectVideo,
  onSetFavorite,
  onShouldIgnoreClick,
}: {
  catalogVideo: CatalogVideo;
  isSelectedForBatch: boolean;
  isSelectedForDetail: boolean;
  onSelectVideo: (
    catalogVideo: CatalogVideo,
    modifiers: VideoSelectionModifiers,
  ) => void;
  onSetFavorite: (catalogVideo: CatalogVideo, isFavorite: boolean) => void;
  onShouldIgnoreClick: () => boolean;
}) {
  function selectCatalogVideo(modifiers: VideoSelectionModifiers) {
    onSelectVideo(catalogVideo, modifiers);
  }

  function selectCatalogVideoFromPointer(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();

    if (onShouldIgnoreClick()) {
      return;
    }

    selectCatalogVideo({
      isCommandPressed: event.metaKey || event.ctrlKey,
      isShiftPressed: event.shiftKey,
    });
  }

  function selectCatalogVideoFromKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    selectCatalogVideo({
      isCommandPressed: event.metaKey || event.ctrlKey,
      isShiftPressed: event.shiftKey,
    });
  }

  return (
    <Paper
      aria-label={catalogVideo.title}
      aria-selected={isSelectedForDetail ? true : undefined}
      className={`${styles.groupPreviewCard} ${isSelectedForDetail ? styles.selectedPreviewCard : ""} ${isSelectedForBatch ? styles.batchSelectedPreviewCard : ""}`}
      data-video-id={catalogVideo.id}
      draggable={false}
      onClick={selectCatalogVideoFromPointer}
      onKeyDown={selectCatalogVideoFromKeyboard}
      role="article"
      tabIndex={0}
      withBorder
    >
      <VideoPreview
        catalogVideo={catalogVideo}
        onFavoriteChange={(isFavorite) => onSetFavorite(catalogVideo, isFavorite)}
      />
      <Text className={styles.groupPreviewTitle} fw={500} size="xs">
        {catalogVideo.title}
      </Text>
    </Paper>
  );
}
