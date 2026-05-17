import { useState, type MouseEvent, type PointerEvent } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Badge, Box } from "@mantine/core";
import { IconStar, IconStarFilled } from "@tabler/icons-react";

import type { CatalogVideo } from "../../../tauriCommands";
import {
  formatCompactFileSize,
  formatDuration,
} from "../../../shared/formatting/videoFormatting";
import styles from "./VideoPreview.module.css";

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
      className={isLarge ? `${styles.preview} ${styles.large}` : styles.preview}
    >
      <PreviewStripSurface catalogVideo={catalogVideo} />
      <button
        aria-label={favoriteButtonLabel}
        className={`${styles.badge} ${styles.favoriteButton}`}
        onClick={toggleFavorite}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {catalogVideo.isFavorite ? (
          <IconStarFilled className={`${styles.favoriteIcon} ${styles.favoriteIconFilled}`} size={favoriteIconSize} />
        ) : (
          <IconStar className={`${styles.favoriteIcon} ${styles.favoriteIconOutline}`} size={favoriteIconSize} />
        )}
      </button>
      {!catalogVideo.isAvailable ? (
        <Badge
          className={`${styles.badge} ${styles.unavailableBadge}`}
          color="red"
          variant="filled"
        >
          Unavailable
        </Badge>
      ) : null}
      <Badge
        className={`${styles.badge} ${styles.pill} ${styles.fileSizeBadge}`}
        color="dark"
        variant="filled"
      >
        {formatCompactFileSize(catalogVideo.fileSizeBytes)}
      </Badge>
      <Badge
        className={`${styles.badge} ${styles.pill} ${styles.durationBadge}`}
        color="dark"
        variant="filled"
      >
        {formatDuration(catalogVideo.durationMilliseconds)}
      </Badge>
    </Box>
  );
}

function PreviewStripSurface({
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
        className={`${styles.strip} ${styles.generatedStrip}`}
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
      <Box className={`${styles.strip} ${styles.placeholderStrip}`}>
        <Badge color="red" variant="light">
          Failed Preview Strip
        </Badge>
      </Box>
    );
  }

  return (
    <Box className={`${styles.strip} ${styles.placeholderStrip}`}>
      <Badge color="gray" variant="light">
        Pending Preview Strip
      </Badge>
    </Box>
  );
}

function previewStripFrameIndexFromPointer(
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

function previewStripFramePosition(
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
