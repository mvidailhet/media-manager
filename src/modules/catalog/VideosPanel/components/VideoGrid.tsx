import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { Box } from "@mantine/core";

import type { CatalogVideo } from "../../../../tauriCommands";
import type { CatalogVideoMetadata } from "../../catalogTypes";
import type { VideoSelectionModifiers } from "../../useCatalogModuleController";
import styles from "../VideosPanel.module.css";
import { VideoCard } from "./VideoCard";

const dragSelectionStartThresholdPixels = 4;

type DragPoint = {
  x: number;
  y: number;
};

export function VideoGrid({
  catalogVideoMetadataById,
  catalogVideos,
  onClearVideoSelection,
  onReplaceSelectedVideos,
  onSelectVideo,
  onSetFavorite,
  selectedDetailVideoId,
  selectedVideoIds,
}: {
  catalogVideoMetadataById: Record<number, CatalogVideoMetadata>;
  catalogVideos: CatalogVideo[];
  onClearVideoSelection: () => void;
  onReplaceSelectedVideos: (videoIds: number[]) => void;
  onSelectVideo: (
    catalogVideo: CatalogVideo,
    modifiers: VideoSelectionModifiers,
  ) => void;
  onSetFavorite: (catalogVideo: CatalogVideo, isFavorite: boolean) => void;
  selectedDetailVideoId: number | null;
  selectedVideoIds: number[];
}) {
  const gridElement = useRef<HTMLDivElement | null>(null);
  const dragSelectionStart = useRef<DragPoint | null>(null);
  const isDragSelecting = useRef(false);
  const shouldSuppressNextCardClick = useRef(false);
  const suppressCardClickTimeoutId = useRef<number | null>(null);
  const [dragSelectionEnd, setDragSelectionEnd] = useState<DragPoint | null>(
    null,
  );
  const [dragSelectedVideoIds, setDragSelectedVideoIds] = useState<number[]>([]);

  if (catalogVideos.length === 0) {
    return null;
  }

  function startDragSelection(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    dragSelectionStart.current = {
      x: event.clientX,
      y: event.clientY,
    };
    clearSuppressedCardClick();
    isDragSelecting.current = false;
    setDragSelectionEnd(null);
    setDragSelectedVideoIds([]);
  }

  function trackDragSelection(event: PointerEvent<HTMLDivElement>) {
    if (!dragSelectionStart.current) {
      return;
    }

    const horizontalDistance = Math.abs(
      event.clientX - dragSelectionStart.current.x,
    );
    const verticalDistance = Math.abs(event.clientY - dragSelectionStart.current.y);

    if (
      horizontalDistance >= dragSelectionStartThresholdPixels ||
      verticalDistance >= dragSelectionStartThresholdPixels
    ) {
      isDragSelecting.current = true;
      event.preventDefault();
      const nextDragSelectionEnd = {
        x: event.clientX,
        y: event.clientY,
      };

      setDragSelectionEnd(nextDragSelectionEnd);
      setDragSelectedVideoIds(
        videoIdsInsideDragRectangle(
          dragSelectionStart.current,
          nextDragSelectionEnd,
        ),
      );
    }
  }

  function finishDragSelection(event: PointerEvent<HTMLDivElement>) {
    const startPoint = dragSelectionStart.current;

    dragSelectionStart.current = null;

    if (!startPoint) {
      return;
    }

    if (!isDragSelecting.current) {
      setDragSelectionEnd(null);
      setDragSelectedVideoIds([]);
      if (event.target === event.currentTarget) {
        onClearVideoSelection();
      }

      return;
    }

    isDragSelecting.current = false;
    suppressNextCardClickIfDragEndedOnCard(event.target !== event.currentTarget);
    event.preventDefault();
    setDragSelectionEnd(null);
    setDragSelectedVideoIds([]);
    onReplaceSelectedVideos(videoIdsInsideDragRectangle(startPoint, {
      x: event.clientX,
      y: event.clientY,
    }));
  }

  function suppressNextCardClickIfDragEndedOnCard(shouldSuppress: boolean) {
    clearSuppressedCardClick();

    if (!shouldSuppress) {
      return;
    }

    shouldSuppressNextCardClick.current = true;
    suppressCardClickTimeoutId.current = window.setTimeout(() => {
      clearSuppressedCardClick();
    }, 0);
  }

  function clearSuppressedCardClick() {
    shouldSuppressNextCardClick.current = false;

    if (suppressCardClickTimeoutId.current === null) {
      return;
    }

    window.clearTimeout(suppressCardClickTimeoutId.current);
    suppressCardClickTimeoutId.current = null;
  }

  function consumeSuppressedCardClick() {
    if (!shouldSuppressNextCardClick.current) {
      return false;
    }

    clearSuppressedCardClick();
    return true;
  }

  function clearSelectionFromKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    onClearVideoSelection();
  }

  function videoIdsInsideDragRectangle(
    startPoint: DragPoint,
    endPoint: DragPoint,
  ) {
    const left = Math.min(startPoint.x, endPoint.x);
    const right = Math.max(startPoint.x, endPoint.x);
    const top = Math.min(startPoint.y, endPoint.y);
    const bottom = Math.max(startPoint.y, endPoint.y);
    const videoCards = Array.from(
      gridElement.current?.querySelectorAll<HTMLElement>("[data-video-id]") ??
        [],
    );

    return videoCards
      .filter((videoCard) => {
        const cardBox = videoCard.getBoundingClientRect();

        return (
          cardBox.left <= right &&
          cardBox.right >= left &&
          cardBox.top <= bottom &&
          cardBox.bottom >= top
        );
      })
      .map((videoCard) => Number(videoCard.dataset.videoId));
  }

  function dragSelectionRectangleStyle() {
    if (!dragSelectionStart.current || !dragSelectionEnd || !gridElement.current) {
      return undefined;
    }

    const gridBox = gridElement.current.getBoundingClientRect();
    const left = Math.min(dragSelectionStart.current.x, dragSelectionEnd.x);
    const right = Math.max(dragSelectionStart.current.x, dragSelectionEnd.x);
    const top = Math.min(dragSelectionStart.current.y, dragSelectionEnd.y);
    const bottom = Math.max(dragSelectionStart.current.y, dragSelectionEnd.y);

    return {
      left: left - gridBox.left,
      top: top - gridBox.top,
      width: right - left,
      height: bottom - top,
    };
  }

  const selectionRectangleStyle = dragSelectionRectangleStyle();

  return (
    <Box
      aria-label="Video grid"
      className={styles.grid}
      onKeyDown={clearSelectionFromKeyboard}
      onPointerDown={startDragSelection}
      onPointerMove={trackDragSelection}
      onPointerUp={finishDragSelection}
      ref={gridElement}
    >
      {selectionRectangleStyle ? (
        <Box className={styles.selectionRectangle} style={selectionRectangleStyle} />
      ) : null}
      {catalogVideos.map((catalogVideo) => (
        <VideoCard
          catalogVideo={catalogVideo}
          catalogVideoMetadata={catalogVideoMetadataById[catalogVideo.id]}
          key={catalogVideo.id}
          onSelectVideo={onSelectVideo}
          onSetFavorite={onSetFavorite}
          onShouldIgnoreClick={consumeSuppressedCardClick}
          isSelectedForDetail={catalogVideo.id === selectedDetailVideoId}
          isSelectedForBatch={
            selectedVideoIds.includes(catalogVideo.id) ||
            dragSelectedVideoIds.includes(catalogVideo.id)
          }
        />
      ))}
    </Box>
  );
}
