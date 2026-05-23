import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import { Badge, Box } from "@mantine/core";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { CatalogPerformer, CatalogVideo } from "../../../../tauriCommands";
import type { CatalogVideoMetadata } from "../../catalogTypes";
import { metadataBadgeColorForKind } from "../../components/metadataBadgeStyles";
import type { VideoSelectionModifiers } from "../../useCatalogModuleController";
import type { CatalogVideoPerformerGroup } from "../catalogVideoPerformerGroups";
import { groupCatalogVideosByFirstPerformer } from "../catalogVideoPerformerGroups";
import styles from "../VideosPanel.module.css";
import { VideoCard } from "./VideoCard";

const dragSelectionStartThresholdPixels = 4;
const virtualGridOverscanRows = 2;
const initialVisibleVideoRowCount = 4;
const estimatedHeaderRowHeightPixels = 52;
const estimatedVideoRowHeightPixels = 300;
const initialVirtualViewportHeightPixels = 900;
const initialVirtualViewportWidthPixels = 1000;
const minimumVideoCardWidthPixels = 200;
const videoCardGapPixels = 12;
const noScrollMarginPixels = 0;

type DragPoint = {
  x: number;
  y: number;
};

const unassignedGroupLabel = "Unassigned";
const unassignedGroupBadgeColor = "gray";

type HeaderRow = {
  kind: "header";
  key: string;
  hasTopSpacing: boolean;
  performer: CatalogPerformer | null;
};

type VideoRow = {
  kind: "videos";
  key: string;
  videos: CatalogVideo[];
};

type VirtualVideoRow = HeaderRow | VideoRow;

type VisibleVirtualRow = {
  index: number;
  key: string | number | bigint;
  start: number;
};

export function VideoGrid({
  catalogVideoMetadataById,
  catalogVideos,
  onClearVideoSelection,
  onReplaceSelectedVideos,
  onSelectVideo,
  onSetFavorite,
  scrollElementRef,
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
  scrollElementRef?: RefObject<HTMLElement | null>;
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
  const [gridWidthPixels, setGridWidthPixels] = useState(
    initialVirtualViewportWidthPixels,
  );
  const [ownScrollElement, setOwnScrollElement] = useState<HTMLElement | null>(
    null,
  );
  const [scrollMarginPixels, setScrollMarginPixels] = useState(
    noScrollMarginPixels,
  );
  const setGridElement = useCallback((element: HTMLDivElement | null) => {
    gridElement.current = element;
    setOwnScrollElement(element);
  }, []);

  useEffect(() => {
    return () => restoreDocumentTextSelection();
  }, []);

  useEffect(() => {
    updateVirtualGridMeasurements();
  }, [scrollElementRef, ownScrollElement]);

  useEffect(() => {
    const grid = gridElement.current;

    if (!grid || typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      updateVirtualGridMeasurements(entries[0]?.contentRect.width);
    });

    resizeObserver.observe(grid);

    return () => resizeObserver.disconnect();
  }, [scrollElementRef, ownScrollElement]);

  const videoColumnCount = useMemo(
    () => videoColumnCountForWidth(gridWidthPixels),
    [gridWidthPixels],
  );
  const performerGroups = useMemo(
    () =>
      groupCatalogVideosByFirstPerformer({
        catalogVideoMetadataById,
        catalogVideos,
      }),
    [catalogVideoMetadataById, catalogVideos],
  );
  const virtualVideoRows = useMemo(
    () => virtualRowsForPerformerGroups(performerGroups, videoColumnCount),
    [performerGroups, videoColumnCount],
  );
  const rowVirtualizer = useVirtualizer({
    count: virtualVideoRows.length,
    estimateSize: (rowIndex) =>
      virtualVideoRows[rowIndex]?.kind === "header"
        ? estimatedHeaderRowHeightPixels
        : estimatedVideoRowHeightPixels,
    getScrollElement: () => scrollElementRef?.current ?? ownScrollElement,
    initialRect: {
      height: initialVirtualViewportHeightPixels,
      width: gridWidthPixels,
    },
    overscan: virtualGridOverscanRows,
    scrollMargin: scrollMarginPixels,
  });
  const measuredVisibleVirtualRows = rowVirtualizer.getVirtualItems();
  const visibleVirtualRows =
    measuredVisibleVirtualRows.length > 0
      ? measuredVisibleVirtualRows
      : initialVisibleVirtualRows(virtualVideoRows);

  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowVirtualizer, videoColumnCount]);

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

  function updateVirtualGridMeasurements(nextGridWidthPixels?: number) {
    const grid = gridElement.current;

    if (!grid) {
      return;
    }

    const measuredGridWidthPixels =
      nextGridWidthPixels || grid.getBoundingClientRect().width;

    if (measuredGridWidthPixels > 0) {
      setGridWidthPixels(measuredGridWidthPixels);
    }

    const scrollElement = scrollElementRef?.current ?? ownScrollElement;

    if (!scrollElement) {
      setScrollMarginPixels(noScrollMarginPixels);
      return;
    }

    setScrollMarginPixels(grid.offsetTop - scrollElement.offsetTop);
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
      className={styles.virtualGrid}
      onKeyDown={clearSelectionFromKeyboard}
      onPointerDown={startDragSelection}
      onPointerMove={trackDragSelection}
      onPointerCancel={cancelDragSelection}
      onPointerUp={finishDragSelection}
      ref={setGridElement}
    >
      {selectionRectangleStyle ? (
        <Box className={styles.selectionRectangle} style={selectionRectangleStyle} />
      ) : null}
      <Box
        className={styles.virtualGridSpace}
        style={{ height: rowVirtualizer.getTotalSize() }}
      >
        {visibleVirtualRows.map((visibleVirtualRow) => {
          const virtualVideoRow = virtualVideoRows[visibleVirtualRow.index];

          if (!virtualVideoRow) {
            return null;
          }

          if (virtualVideoRow.kind === "header") {
            return (
              <Box
                className={
                  virtualVideoRow.hasTopSpacing
                    ? `${styles.virtualPerformerRow} ${styles.spacedPerformerRow}`
                    : styles.virtualPerformerRow
                }
                data-index={visibleVirtualRow.index}
                key={virtualVideoRow.key}
                ref={rowVirtualizer.measureElement}
                style={{
                  transform: `translateY(${virtualRowStartPixels(visibleVirtualRow)}px)`,
                }}
              >
                <Box className={styles.performerGroup}>
                  <Badge
                    size="xl"
                    color={
                      virtualVideoRow.performer
                        ? metadataBadgeColorForKind("performer")
                        : unassignedGroupBadgeColor
                    }
                    variant="light"
                  >
                    {virtualVideoRow.performer?.name ?? unassignedGroupLabel}
                  </Badge>
                </Box>
              </Box>
            );
          }

          return (
            <Box
              className={styles.virtualVideoRow}
              data-index={visibleVirtualRow.index}
              key={virtualVideoRow.key}
              ref={rowVirtualizer.measureElement}
              style={{
                gridTemplateColumns: `repeat(${videoColumnCount}, minmax(0, 1fr))`,
                transform: `translateY(${virtualRowStartPixels(visibleVirtualRow)}px)`,
              }}
            >
              {virtualVideoRow.videos.map((catalogVideo) => (
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
        })}
      </Box>
    </Box>
  );

  function virtualRowStartPixels(visibleVirtualRow: VisibleVirtualRow) {
    if (measuredVisibleVirtualRows.length === 0) {
      return visibleVirtualRow.start;
    }

    return visibleVirtualRow.start - rowVirtualizer.options.scrollMargin;
  }
}

export function videoColumnCountForWidth(gridWidthPixels: number) {
  const videoColumnWidthPixels = minimumVideoCardWidthPixels + videoCardGapPixels;

  return Math.max(
    1,
    Math.floor(
      (gridWidthPixels + videoCardGapPixels) / videoColumnWidthPixels,
    ),
  );
}

export function virtualRowsForPerformerGroups(
  performerGroups: CatalogVideoPerformerGroup[],
  videoColumnCount: number,
) {
  return performerGroups.flatMap<VirtualVideoRow>((performerGroup, groupIndex) => {
    const groupKey = performerGroup.performer?.id ?? "unassigned";
    const videoRows = chunkCatalogVideos(performerGroup.videos, videoColumnCount);

    return [
      {
        kind: "header",
        key: `header-${groupKey}`,
        hasTopSpacing: groupIndex > 0,
        performer: performerGroup.performer,
      },
      ...videoRows.map((videos, rowIndex) => ({
        kind: "videos" as const,
        key: `videos-${groupKey}-${rowIndex}`,
        videos,
      })),
    ];
  });
}

function chunkCatalogVideos(catalogVideos: CatalogVideo[], videoColumnCount: number) {
  const videoRows: CatalogVideo[][] = [];

  for (
    let videoIndex = 0;
    videoIndex < catalogVideos.length;
    videoIndex += videoColumnCount
  ) {
    videoRows.push(catalogVideos.slice(videoIndex, videoIndex + videoColumnCount));
  }

  return videoRows;
}

function initialVisibleVirtualRows(virtualVideoRows: VirtualVideoRow[]) {
  const visibleRows: VisibleVirtualRow[] = [];
  let nextRowStartPixels = 0;
  const initialVisibleRowCount = initialVisibleVideoRowCount + 1;

  for (
    let rowIndex = 0;
    rowIndex < Math.min(initialVisibleRowCount, virtualVideoRows.length);
    rowIndex += 1
  ) {
    const virtualVideoRow = virtualVideoRows[rowIndex];

    visibleRows.push({
      index: rowIndex,
      key: virtualVideoRow.key,
      start: nextRowStartPixels,
    });

    nextRowStartPixels +=
      virtualVideoRow.kind === "header"
        ? estimatedHeaderRowHeightPixels
        : estimatedVideoRowHeightPixels;
  }

  return visibleRows;
}
