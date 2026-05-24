import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { Accordion, Box } from "@mantine/core";

import type { CatalogVideo } from "../../../../tauriCommands";
import type { CatalogVideoMetadata } from "../../catalogTypes";
import type { VideoSelectionModifiers } from "../../useCatalogModuleController";
import { groupCatalogVideosByFirstPerformer } from "../catalogVideoPerformerGroups";
import styles from "../VideosPanel.module.css";
import {
  PrimaryPerformerAccordion,
  primaryPerformerAccordionValue,
} from "./PrimaryPerformerAccordion";

const dragSelectionStartThresholdPixels = 4;

type DragPoint = {
  x: number;
  y: number;
};

export function VideoGrid({
  allMatchingCatalogVideos,
  catalogVideoMetadataById,
  catalogVideos,
  onClearVideoSelection,
  onReplaceSelectedVideos,
  onSelectVideo,
  onSetFavorite,
  selectedDetailVideoId,
  selectedVideoIds,
}: {
  allMatchingCatalogVideos: CatalogVideo[];
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
  const previousBodyUserSelect = useRef<string | null>(null);
  const shouldSuppressNextCardClick = useRef(false);
  const suppressCardClickTimeoutId = useRef<number | null>(null);
  const [dragSelectionEnd, setDragSelectionEnd] = useState<DragPoint | null>(
    null,
  );
  const [dragSelectedVideoIds, setDragSelectedVideoIds] = useState<number[]>([]);
  const [openPerformerGroups, setOpenPerformerGroups] = useState<string[]>([]);

  useEffect(() => {
    return () => restoreDocumentTextSelection();
  }, []);

  if (catalogVideos.length === 0) {
    return null;
  }

  function startDragSelection(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    dragSelectionStart.current = {
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
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
      disableDocumentTextSelection();
      window.getSelection()?.removeAllRanges();
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
      restoreDocumentTextSelection();
      setDragSelectionEnd(null);
      setDragSelectedVideoIds([]);
      if (event.target === event.currentTarget) {
        onClearVideoSelection();
      }

      return;
    }

    isDragSelecting.current = false;
    restoreDocumentTextSelection();
    suppressNextCardClickIfDragEndedOnCard(event.target !== event.currentTarget);
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    setDragSelectionEnd(null);
    setDragSelectedVideoIds([]);
    onReplaceSelectedVideos(videoIdsInsideDragRectangle(startPoint, {
      x: event.clientX,
      y: event.clientY,
    }));
  }

  function cancelDragSelection() {
    dragSelectionStart.current = null;
    isDragSelecting.current = false;
    restoreDocumentTextSelection();
    setDragSelectionEnd(null);
    setDragSelectedVideoIds([]);
  }

  function disableDocumentTextSelection() {
    if (previousBodyUserSelect.current !== null) {
      return;
    }

    previousBodyUserSelect.current = document.body.style.userSelect;
    document.body.style.userSelect = "none";
  }

  function restoreDocumentTextSelection() {
    if (previousBodyUserSelect.current === null) {
      return;
    }

    document.body.style.userSelect = previousBodyUserSelect.current;
    previousBodyUserSelect.current = null;
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
  const fullPerformerGroups = groupCatalogVideosByFirstPerformer({
    catalogVideoMetadataById,
    catalogVideos: allMatchingCatalogVideos,
  });
  const exposedPerformerGroups = groupCatalogVideosByFirstPerformer({
    catalogVideoMetadataById,
    catalogVideos,
  });
  const exposedVideosByPerformerGroup = new Map(
    exposedPerformerGroups.map((performerGroup) => [
      primaryPerformerAccordionValue(performerGroup),
      performerGroup.videos,
    ]),
  );

  return (
    <Box
      aria-label="Video grid"
      className={styles.grid}
      onKeyDown={clearSelectionFromKeyboard}
      onPointerDown={startDragSelection}
      onPointerMove={trackDragSelection}
      onPointerCancel={cancelDragSelection}
      onPointerUp={finishDragSelection}
      ref={gridElement}
    >
      {selectionRectangleStyle ? (
        <Box className={styles.selectionRectangle} style={selectionRectangleStyle} />
      ) : null}
      <Accordion
        className={styles.primaryPerformerAccordions}
        multiple
        onChange={setOpenPerformerGroups}
        value={openPerformerGroups}
        variant="separated"
      >
        {fullPerformerGroups.map((performerGroup) => {
          const performerGroupValue = primaryPerformerAccordionValue(performerGroup);

          return (
            <PrimaryPerformerAccordion
              catalogVideoMetadataById={catalogVideoMetadataById}
              dragSelectedVideoIds={dragSelectedVideoIds}
              exposedVideos={
                exposedVideosByPerformerGroup.get(performerGroupValue) ?? []
              }
              fullPerformerGroup={performerGroup}
              key={performerGroupValue}
              onSelectVideo={onSelectVideo}
              onSetFavorite={onSetFavorite}
              onShouldIgnoreClick={consumeSuppressedCardClick}
              selectedDetailVideoId={selectedDetailVideoId}
              selectedVideoIds={selectedVideoIds}
            />
          );
        })}
      </Accordion>
    </Box>
  );
}
