import { useRef } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";
import { Paper } from "@mantine/core";

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
  getKeyboardSelectionModifiers,
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
  getKeyboardSelectionModifiers: () => VideoSelectionModifiers;
}) {
  const pointerSelectionModifiers = useRef<VideoSelectionModifiers | null>(null);

  function selectCatalogVideo(modifiers: VideoSelectionModifiers) {
    onSelectVideo(catalogVideo, modifiers);
  }

  function rememberPointerSelectionModifiers(event: PointerEvent<HTMLElement>) {
    pointerSelectionModifiers.current = {
      isCommandPressed: event.metaKey || event.ctrlKey,
      isShiftPressed: event.shiftKey,
    };
  }

  function selectCatalogVideoFromPointer(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();

    if (onShouldIgnoreClick()) {
      pointerSelectionModifiers.current = null;
      return;
    }

    const clickSelectionModifiers = {
      isCommandPressed: event.metaKey || event.ctrlKey,
      isShiftPressed: event.shiftKey,
    };
    const nextSelectionModifiers = activeSelectionModifiers([
      clickSelectionModifiers,
      pointerSelectionModifiers.current,
      getKeyboardSelectionModifiers(),
    ]);

    pointerSelectionModifiers.current = null;
    selectCatalogVideo(nextSelectionModifiers);
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

  function activeSelectionModifiers(
    selectionModifiers: Array<VideoSelectionModifiers | null>,
  ) {
    return (
      selectionModifiers.find(
        (modifiers) =>
          modifiers?.isCommandPressed === true ||
          modifiers?.isShiftPressed === true,
      ) ?? {
        isCommandPressed: false,
        isShiftPressed: false,
      }
    );
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
      onPointerDown={rememberPointerSelectionModifiers}
      role="article"
      tabIndex={0}
      withBorder
    >
      <span className={styles.groupPreviewCardTitle}>{catalogVideo.title}</span>
      <VideoPreview
        catalogVideo={catalogVideo}
        onFavoriteChange={(isFavorite) => onSetFavorite(catalogVideo, isFavorite)}
      />
    </Paper>
  );
}
