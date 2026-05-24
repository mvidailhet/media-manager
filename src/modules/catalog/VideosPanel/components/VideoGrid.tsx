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

type PointerDragPoint = {
  contentPoint: DragPoint;
  viewportPoint: DragPoint;
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
  const dragSelectionStart = useRef<PointerDragPoint | null>(null);
  const isDragSelecting = useRef(false);
  const previousBodyUserSelect = useRef<string | null>(null);
  const shouldSuppressNextCardClick = useRef(false);
  const suppressCardClickTimeoutId = useRef<number | null>(null);
  const [dragSelectionEnd, setDragSelectionEnd] =
    useState<PointerDragPoint | null>(null);
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
    const nextDragSelectionStart = dragPointFromPointerEvent(event);

    if (!nextDragSelectionStart) {
      return;
    }

    dragSelectionStart.current = nextDragSelectionStart;
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
      event.clientX - dragSelectionStart.current.viewportPoint.x,
    );
    const verticalDistance = Math.abs(
      event.clientY - dragSelectionStart.current.viewportPoint.y,
    );

    if (
      horizontalDistance >= dragSelectionStartThresholdPixels ||
      verticalDistance >= dragSelectionStartThresholdPixels
    ) {
      isDragSelecting.current = true;
      event.preventDefault();
      disableDocumentTextSelection();
      window.getSelection()?.removeAllRanges();
      const nextDragSelectionEnd = dragPointFromPointerEvent(event);

      if (!nextDragSelectionEnd) {
        return;
      }

      setDragSelectionEnd(nextDragSelectionEnd);
      setDragSelectedVideoIds(
        videoIdsInsideDragRectangle(
          dragSelectionStart.current.contentPoint,
          nextDragSelectionEnd.contentPoint,
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
    const endPoint = dragPointFromPointerEvent(event);

    if (!endPoint) {
      return;
    }

    onReplaceSelectedVideos(
      videoIdsInsideDragRectangle(startPoint.contentPoint, endPoint.contentPoint),
    );
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
        const cardBox = videoCardContentBox(videoCard);

        return (
          cardBox.left <= right &&
          cardBox.right >= left &&
          cardBox.top <= bottom &&
          cardBox.bottom >= top
        );
      })
      .map((videoCard) => Number(videoCard.dataset.videoId));
  }

  function dragPointFromPointerEvent(
    event: PointerEvent<HTMLDivElement>,
  ): PointerDragPoint | null {
    if (!gridElement.current) {
      return null;
    }

    const gridBox = gridElement.current.getBoundingClientRect();

    return {
      contentPoint: {
        x: event.clientX - gridBox.left,
        y: event.clientY - gridBox.top,
      },
      viewportPoint: {
        x: event.clientX,
        y: event.clientY,
      },
    };
  }

  function videoCardContentBox(videoCard: HTMLElement) {
    const cardBox = videoCard.getBoundingClientRect();
    const gridBox = gridElement.current?.getBoundingClientRect();

    if (!gridBox) {
      return cardBox;
    }

    return {
      bottom: cardBox.bottom - gridBox.top,
      left: cardBox.left - gridBox.left,
      right: cardBox.right - gridBox.left,
      top: cardBox.top - gridBox.top,
    };
  }

  function dragSelectionRectangleStyle() {
    if (!dragSelectionStart.current || !dragSelectionEnd || !gridElement.current) {
      return undefined;
    }

    const left = Math.min(
      dragSelectionStart.current.contentPoint.x,
      dragSelectionEnd.contentPoint.x,
    );
    const right = Math.max(
      dragSelectionStart.current.contentPoint.x,
      dragSelectionEnd.contentPoint.x,
    );
    const top = Math.min(
      dragSelectionStart.current.contentPoint.y,
      dragSelectionEnd.contentPoint.y,
    );
    const bottom = Math.max(
      dragSelectionStart.current.contentPoint.y,
      dragSelectionEnd.contentPoint.y,
    );

    return {
      left,
      top,
      width: right - left,
      height: bottom - top,
    };
  }

  const selectionRectangleStyle = dragSelectionRectangleStyle();
  const fullPerformerGroups = groupCatalogVideosByFirstPerformer({
    catalogVideoMetadataById,
    catalogVideos,
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
