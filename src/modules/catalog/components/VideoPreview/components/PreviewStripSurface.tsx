import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Badge, Box } from "@mantine/core";

import type { CatalogVideo } from "../../../../../tauriCommands";
import {
  firstPreviewStripFrameIndex,
  percentageMultiplier,
  previewStripFrameIndexFromPointer,
  previewStripFramePosition,
} from "../previewStripFrame";
import styles from "../VideoPreview.module.css";

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
