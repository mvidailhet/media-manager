import type { MouseEvent, PointerEvent } from "react";

export const firstPreviewStripFrameIndex = 20;
export const previewStripAutoplayFrameIntervalMilliseconds = 500;
export const percentageMultiplier = 100;
export const millisecondsPerPreviewSecond = 1000;

const previewStripPointerMinimum = 0;
const previewStripPointerMaximum = 1;

export function previewStripPointerRatioFromPointer(
  event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>,
) {
  const previewStripBounds = event.currentTarget.getBoundingClientRect();
  const pointerOffset = event.clientX - previewStripBounds.left;
  const pointerRatio = pointerOffset / previewStripBounds.width;

  return Math.min(
    previewStripPointerMaximum,
    Math.max(previewStripPointerMinimum, pointerRatio),
  );
}

export function previewStripFrameIndexFromPointer(
  event: PointerEvent<HTMLElement>,
  frameCount: number,
) {
  const boundedPointerRatio = previewStripPointerRatioFromPointer(event);
  const lastFrameIndex = frameCount - 1;

  return Math.round(boundedPointerRatio * lastFrameIndex);
}

export function previewStripStartSecondsFromPointerRatio(
  pointerRatio: number,
  durationMilliseconds: number,
) {
  const boundedPointerRatio = Math.min(
    previewStripPointerMaximum,
    Math.max(previewStripPointerMinimum, pointerRatio),
  );
  const durationSeconds = durationMilliseconds / millisecondsPerPreviewSecond;

  return Math.round(boundedPointerRatio * durationSeconds);
}

export function previewStripFramePosition(
  frameIndex: number,
  columnCount: number,
  rowCount: number,
) {
  const columnIndex = frameIndex % columnCount;
  const rowIndex = Math.floor(frameIndex / columnCount);
  const lastColumnIndex = Math.max(columnCount - 1, 1);
  const lastRowIndex = Math.max(rowCount - 1, 1);

  return {
    x: (columnIndex / lastColumnIndex) * percentageMultiplier,
    y: (rowIndex / lastRowIndex) * percentageMultiplier,
  };
}
