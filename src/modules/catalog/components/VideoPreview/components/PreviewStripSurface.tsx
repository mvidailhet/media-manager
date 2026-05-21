import type { MouseEvent, PointerEvent } from "react";
import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Badge, Box } from "@mantine/core";

import type { CatalogVideo } from "../../../../../tauriCommands";
import { formatPlaybackTime } from "../../../../../shared/formatting/videoFormatting";
import {
  firstPreviewStripFrameIndex,
  percentageMultiplier,
  previewStripAutoplayFrameIntervalMilliseconds,
  previewStripFrameIndexFromPointer,
  previewStripFramePosition,
  previewStripPointerRatioFromPointer,
  previewStripStartSecondsFromPointerRatio,
} from "../previewStripFrame";
import styles from "../VideoPreview.module.css";

const hoverBadgeMinimumLeftPercentage = 6;
const hoverBadgeMaximumLeftPercentage = 94;

export function PreviewStripSurface({
  autoPlay = false,
  catalogVideo,
  onOpenAtPreviewTime,
}: {
  autoPlay?: boolean;
  catalogVideo: CatalogVideo;
  onOpenAtPreviewTime?: (startAtSeconds: number) => void;
}) {
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(
    firstPreviewStripFrameIndex,
  );
  const [hoveredStartSeconds, setHoveredStartSeconds] = useState<number | null>(
    null,
  );
  const [hoverBadgeLeftPercentage, setHoverBadgeLeftPercentage] =
    useState<number>(0);
  const [isPointerHovering, setIsPointerHovering] = useState(false);
  const previewStrip = catalogVideo.previewStrip;
  const canOpenAtPreviewTime =
    Boolean(onOpenAtPreviewTime) && catalogVideo.isAvailable;
  const shouldAutoPlayPreviewStrip =
    autoPlay && previewStrip.status === "generated" && !isPointerHovering;

  useEffect(() => {
    if (!shouldAutoPlayPreviewStrip || previewStrip.status !== "generated") {
      return;
    }

    const autoplayTimer = window.setInterval(() => {
      setSelectedFrameIndex((currentFrameIndex) =>
        (currentFrameIndex + 1) % previewStrip.frameCount,
      );
    }, previewStripAutoplayFrameIntervalMilliseconds);

    return () => window.clearInterval(autoplayTimer);
  }, [previewStrip, shouldAutoPlayPreviewStrip]);

  function previewStripStartSecondsFromPointer(
    event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>,
  ) {
    const pointerRatio = previewStripPointerRatioFromPointer(event);

    return previewStripStartSecondsFromPointerRatio(
      pointerRatio,
      catalogVideo.durationMilliseconds,
    );
  }

  function updateSelectedPreviewTime(event: PointerEvent<HTMLElement>) {
    setIsPointerHovering(true);
    const pointerRatio = previewStripPointerRatioFromPointer(event);

    if (previewStrip.status === "generated") {
      setSelectedFrameIndex(
        previewStripFrameIndexFromPointer(event, previewStrip.frameCount),
      );
    }

    if (!canOpenAtPreviewTime) {
      return;
    }

    setHoveredStartSeconds(
      previewStripStartSecondsFromPointerRatio(
        pointerRatio,
        catalogVideo.durationMilliseconds,
      ),
    );
    setHoverBadgeLeftPercentage(
      Math.min(
        hoverBadgeMaximumLeftPercentage,
        Math.max(
          hoverBadgeMinimumLeftPercentage,
          pointerRatio * percentageMultiplier,
        ),
      ),
    );
  }

  function clearSelectedPreviewTime() {
    setIsPointerHovering(false);
    if (!autoPlay) {
      setSelectedFrameIndex(firstPreviewStripFrameIndex);
    }
    setHoveredStartSeconds(null);
  }

  function openAtPreviewTime(event: MouseEvent<HTMLElement>) {
    if (!canOpenAtPreviewTime) {
      return;
    }

    event.stopPropagation();
    onOpenAtPreviewTime?.(previewStripStartSecondsFromPointer(event));
  }

  if (previewStrip.status === "generated") {
    const previewStripUrl = convertFileSrc(previewStrip.path);
    const framePosition = previewStripFramePosition(
      selectedFrameIndex,
      previewStrip.columnCount,
      previewStrip.rowCount,
    );

    return (
      <Box className={styles.stripFrame}>
        <Box
          aria-label={`Preview Strip for ${catalogVideo.title}`}
          className={
            canOpenAtPreviewTime
              ? `${styles.strip} ${styles.generatedStrip} ${styles.openableStrip}`
              : `${styles.strip} ${styles.generatedStrip}`
          }
          role="img"
          style={{
            backgroundImage: `url(${previewStripUrl})`,
            backgroundPosition: `${framePosition.x}% ${framePosition.y}%`,
            backgroundSize: `${previewStrip.columnCount * percentageMultiplier}% ${previewStrip.rowCount * percentageMultiplier}%`,
          }}
          onClick={openAtPreviewTime}
          onPointerEnter={() => setIsPointerHovering(true)}
          onPointerLeave={clearSelectedPreviewTime}
          onPointerMove={updateSelectedPreviewTime}
        />
        {canOpenAtPreviewTime && hoveredStartSeconds !== null ? (
          <Badge
            className={styles.hoverTimeBadge}
            color="dark"
            variant="filled"
            style={{ left: `${hoverBadgeLeftPercentage}%` }}
          >
            {formatPlaybackTime(hoveredStartSeconds)}
          </Badge>
        ) : null}
      </Box>
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
    <Box className={`${styles.strip} ${styles.pendingStrip}`}>
      <Badge color="gray" variant="light">
        Pending Preview Strip
      </Badge>
    </Box>
  );
}
