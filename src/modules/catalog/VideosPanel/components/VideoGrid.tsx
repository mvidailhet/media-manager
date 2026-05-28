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
const catalogFilterTimingDebugPrefix = "[DEBUG-catalog-filter-timing]";

type DragPoint = {
  x: number;
  y: number;
};

type PointerDragPoint = {
  contentPoint: DragPoint;
  catalogVideo: CatalogVideo | null;
  selectionModifiers: VideoSelectionModifiers;
  viewportPoint: DragPoint;
};

const emptySelectionModifiers: VideoSelectionModifiers = {
  isCommandPressed: false,
  isShiftPressed: false,
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
  onReplaceSelectedVideos: (
    videoIds: number[],
    modifiers: VideoSelectionModifiers,
  ) => void;
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
  const keyboardSelectionModifiers = useRef<VideoSelectionModifiers>(
    emptySelectionModifiers,
  );
  const [dragSelectionEnd, setDragSelectionEnd] =
    useState<PointerDragPoint | null>(null);
  const [dragSelectedVideoIds, setDragSelectedVideoIds] = useState<number[]>([]);
  const [openPerformerGroups, setOpenPerformerGroups] = useState<string[]>([]);

  useEffect(() => {
    logCatalogFilterTiming("VideoGrid committed", {
      renderedVideoCount: catalogVideos.length,
    });
  });

  useEffect(() => {
    function trackPressedModifierKey(event: globalThis.KeyboardEvent) {
      if (!isSelectionModifierKey(event.key)) {
        return;
      }

      keyboardSelectionModifiers.current = selectionModifiersFromKeyboardEvent(event);
    }

    function trackReleasedModifierKey(event: globalThis.KeyboardEvent) {
      if (!isSelectionModifierKey(event.key)) {
        return;
      }

      keyboardSelectionModifiers.current = selectionModifiersFromKeyboardEvent(event);
    }

    function resetKeyboardSelectionModifiers() {
      keyboardSelectionModifiers.current = emptySelectionModifiers;
    }

    window.addEventListener("keydown", trackPressedModifierKey);
    window.addEventListener("keyup", trackReleasedModifierKey);
    window.addEventListener("blur", resetKeyboardSelectionModifiers);

    return () => {
      window.removeEventListener("keydown", trackPressedModifierKey);
      window.removeEventListener("keyup", trackReleasedModifierKey);
      window.removeEventListener("blur", resetKeyboardSelectionModifiers);
      restoreDocumentTextSelection();
    };
  }, []);

  if (catalogVideos.length === 0) {
    return null;
  }

  function startDragSelection(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    const selectionModifiers = activeSelectionModifiers([
      selectionModifiersFromPointerEvent(event),
      currentKeyboardSelectionModifiers(),
    ]);

    if (!selectionModifiers.isSelectingWithModifier) {
      event.preventDefault();
    }
    const nextDragSelectionStart = dragPointFromPointerEvent(event);

    if (!nextDragSelectionStart) {
      return;
    }

    dragSelectionStart.current = {
      ...nextDragSelectionStart,
      catalogVideo: catalogVideoFromPointerTarget(event.target),
      selectionModifiers,
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
        selectedVideoIdsFromDragRectangle(
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
      const selectedModifiedVideoCard =
        selectModifiedVideoCardFromPointer(startPoint);

      if (selectedModifiedVideoCard) {
        return;
      }

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
      startPoint.selectionModifiers,
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

  function currentKeyboardSelectionModifiers() {
    return keyboardSelectionModifiers.current;
  }

  function selectModifiedVideoCardFromPointer(startPoint: PointerDragPoint) {
    const isModifiedSelection =
      startPoint.selectionModifiers.isCommandPressed ||
      startPoint.selectionModifiers.isShiftPressed;

    if (!isModifiedSelection) {
      return false;
    }

    if (!startPoint.catalogVideo) {
      return false;
    }

    suppressNextCardClickIfDragEndedOnCard(true);
    onSelectVideo(startPoint.catalogVideo, startPoint.selectionModifiers);

    return true;
  }

  function catalogVideoFromPointerTarget(eventTarget: EventTarget) {
    if (!(eventTarget instanceof Element)) {
      return null;
    }

    const videoCard = eventTarget.closest<HTMLElement>("[data-video-id]");

    if (!videoCard) {
      return null;
    }

    const catalogVideoId = Number(videoCard.dataset.videoId);

    return (
      catalogVideos.find((catalogVideo) => catalogVideo.id === catalogVideoId) ??
      null
    );
  }

  function activeSelectionModifiers(
    selectionModifiers: VideoSelectionModifiers[],
  ) {
    const activeModifiers = selectionModifiers.find(
      (modifiers) =>
        modifiers.isCommandPressed === true || modifiers.isShiftPressed === true,
    ) ?? {
      isCommandPressed: false,
      isShiftPressed: false,
    };

    return {
      ...activeModifiers,
      isSelectingWithModifier:
        activeModifiers.isCommandPressed || activeModifiers.isShiftPressed,
    };
  }

  function isSelectionModifierKey(key: string) {
    return key === "Meta" || key === "Control" || key === "Shift";
  }

  function selectionModifiersFromKeyboardEvent(
    event: globalThis.KeyboardEvent,
  ): VideoSelectionModifiers {
    return {
      isCommandPressed: event.metaKey || event.ctrlKey,
      isShiftPressed: event.shiftKey,
    };
  }

  function selectionModifiersFromPointerEvent(
    event: PointerEvent<HTMLDivElement>,
  ): VideoSelectionModifiers {
    return {
      isCommandPressed: event.metaKey || event.ctrlKey,
      isShiftPressed: event.shiftKey,
    };
  }

  function clearSelectionFromKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    onClearVideoSelection();
  }

  function selectedVideoIdsFromDragRectangle(
    startPoint: PointerDragPoint,
    endPoint: PointerDragPoint,
  ) {
    const touchedVideoIds = videoIdsInsideDragRectangle(
      startPoint.contentPoint,
      endPoint.contentPoint,
    );

    if (!startPoint.selectionModifiers.isCommandPressed) {
      return touchedVideoIds;
    }

    return toggledVideoIds(currentSelectedVideoIds(), touchedVideoIds);
  }

  function currentSelectedVideoIds() {
    const selectedIds = [...selectedVideoIds];

    if (
      selectedDetailVideoId !== null &&
      !selectedIds.includes(selectedDetailVideoId)
    ) {
      selectedIds.push(selectedDetailVideoId);
    }

    return selectedIds;
  }

  function toggledVideoIds(currentVideoIds: number[], touchedVideoIds: number[]) {
    const touchedVideoIdSet = new Set(touchedVideoIds);
    const remainingVideoIds = currentVideoIds.filter(
      (videoId) => !touchedVideoIdSet.has(videoId),
    );
    const addedVideoIds = touchedVideoIds.filter(
      (videoId) => !currentVideoIds.includes(videoId),
    );

    return [...remainingVideoIds, ...addedVideoIds];
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
      catalogVideo: null,
      selectionModifiers: emptySelectionModifiers,
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
  const fullPerformerGroupsTimingStart = performance.now();
  const fullPerformerGroups = groupCatalogVideosByFirstPerformer({
    catalogVideoMetadataById,
    catalogVideos,
  });
  logCatalogFilterTiming("fullPerformerGroups", {
    durationMs: Number(
      (performance.now() - fullPerformerGroupsTimingStart).toFixed(2),
    ),
    groupCount: fullPerformerGroups.length,
    videoCount: catalogVideos.length,
  });
  const exposedPerformerGroupsTimingStart = performance.now();
  const exposedPerformerGroups = groupCatalogVideosByFirstPerformer({
    catalogVideoMetadataById,
    catalogVideos,
  });
  logCatalogFilterTiming("exposedPerformerGroups", {
    durationMs: Number(
      (performance.now() - exposedPerformerGroupsTimingStart).toFixed(2),
    ),
    groupCount: exposedPerformerGroups.length,
    videoCount: catalogVideos.length,
  });
  const exposedVideosByPerformerGroupTimingStart = performance.now();
  const exposedVideosByPerformerGroup = new Map(
    exposedPerformerGroups.map((performerGroup) => [
      primaryPerformerAccordionValue(performerGroup),
      performerGroup.videos,
    ]),
  );
  logCatalogFilterTiming("exposedVideosByPerformerGroup", {
    durationMs: Number(
      (performance.now() - exposedVideosByPerformerGroupTimingStart).toFixed(2),
    ),
    groupCount: exposedVideosByPerformerGroup.size,
  });

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
              getKeyboardSelectionModifiers={currentKeyboardSelectionModifiers}
              selectedDetailVideoId={selectedDetailVideoId}
              selectedVideoIds={selectedVideoIds}
            />
          );
        })}
      </Accordion>
    </Box>
  );
}

function logCatalogFilterTiming(
  label: string,
  details: Record<string, unknown> = {},
) {
  console.info(
    `${catalogFilterTimingDebugPrefix} ${JSON.stringify({ label, ...details })}`,
  );
}
