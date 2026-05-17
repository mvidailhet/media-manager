import { useState, type MouseEvent, type PointerEvent } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ActionIcon, Badge, Box } from "@mantine/core";
import { IconStar, IconStarFilled } from "@tabler/icons-react";

import type { CatalogVideo } from "../../../tauriCommands";
import {
  formatCompactFileSize,
  formatDuration,
} from "../../../shared/formatting/videoFormatting";

const firstPreviewStripFrameIndex = 0;
const previewStripPointerMinimum = 0;
const previewStripPointerMaximum = 1;
const percentageMultiplier = 100;
const favoriteIconSize = 18;

export function VideoPreview({
  catalogVideo,
  isLarge = false,
  onFavoriteChange,
}: {
  catalogVideo: CatalogVideo;
  isLarge?: boolean;
  onFavoriteChange: (isFavorite: boolean) => void;
}) {
  const favoriteButtonLabel = catalogVideo.isFavorite
    ? `Unmark ${catalogVideo.title} as Favorite`
    : `Mark ${catalogVideo.title} as Favorite`;

  function toggleFavorite(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onFavoriteChange(!catalogVideo.isFavorite);
  }

  return (
    <Box
      className={
        isLarge
          ? "catalog-video-preview catalog-video-preview-large"
          : "catalog-video-preview"
      }
    >
      <PreviewStripSurface catalogVideo={catalogVideo} />
      <Box
        className="catalog-video-preview-badge catalog-video-favorite-button"
        onClick={(event) => event.stopPropagation()}
      >
        <ActionIcon
          aria-label={favoriteButtonLabel}
          color={catalogVideo.isFavorite ? "yellow" : "gray"}
          variant={catalogVideo.isFavorite ? "filled" : "white"}
          onClick={toggleFavorite}
        >
          {catalogVideo.isFavorite ? (
            <IconStarFilled size={favoriteIconSize} />
          ) : (
            <IconStar size={favoriteIconSize} />
          )}
        </ActionIcon>
      </Box>
      {!catalogVideo.isAvailable ? (
        <Badge
          className="catalog-video-preview-badge catalog-video-unavailable-badge"
          color="red"
          variant="filled"
        >
          Unavailable
        </Badge>
      ) : null}
      <Badge
        className="catalog-video-preview-badge catalog-video-preview-pill catalog-video-file-size-badge"
        color="dark"
        variant="filled"
      >
        {formatCompactFileSize(catalogVideo.fileSizeBytes)}
      </Badge>
      <Badge
        className="catalog-video-preview-badge catalog-video-preview-pill catalog-video-duration-badge"
        color="dark"
        variant="filled"
      >
        {formatDuration(catalogVideo.durationMilliseconds)}
      </Badge>
    </Box>
  );
}

export function PreviewStripSurface({
  catalogVideo,
}: {
  catalogVideo: CatalogVideo;
}) {
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(
    firstPreviewStripFrameIndex,
  );
  const previewStrip = catalogVideo.previewStrip;

  if (previewStrip.status === "generated") {
    const previewStripUrl = convertFileSrc(previewStrip.path);
    const framePosition = previewStripFramePosition(
      selectedFrameIndex,
      previewStrip.columnCount,
      previewStrip.rowCount,
    );

    return (
      <Box
        aria-label={`Preview Strip for ${catalogVideo.title}`}
        className="preview-strip preview-strip-generated"
        role="img"
        style={{
          backgroundImage: `url(${previewStripUrl})`,
          backgroundPosition: `${framePosition.x}% ${framePosition.y}%`,
          backgroundSize: `${previewStrip.columnCount * percentageMultiplier}% ${previewStrip.rowCount * percentageMultiplier}%`,
        }}
        onPointerLeave={() =>
          setSelectedFrameIndex(firstPreviewStripFrameIndex)
        }
        onPointerMove={(event) =>
          setSelectedFrameIndex(
            previewStripFrameIndexFromPointer(event, previewStrip.frameCount),
          )
        }
      />
    );
  }

  if (previewStrip.status === "failed") {
    return (
      <Box className="preview-strip preview-strip-placeholder">
        <Badge color="red" variant="light">
          Failed Preview Strip
        </Badge>
      </Box>
    );
  }

  return (
    <Box className="preview-strip preview-strip-placeholder">
      <Badge color="gray" variant="light">
        Pending Preview Strip
      </Badge>
    </Box>
  );
}

export function previewStripFrameIndexFromPointer(
  event: PointerEvent<HTMLElement>,
  frameCount: number,
) {
  const previewStripBounds = event.currentTarget.getBoundingClientRect();
  const pointerOffset = event.clientX - previewStripBounds.left;
  const pointerRatio = pointerOffset / previewStripBounds.width;
  const boundedPointerRatio = Math.min(
    previewStripPointerMaximum,
    Math.max(previewStripPointerMinimum, pointerRatio),
  );
  const lastFrameIndex = frameCount - 1;

  return Math.round(boundedPointerRatio * lastFrameIndex);
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
