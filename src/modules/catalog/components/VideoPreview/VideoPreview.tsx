import type { MouseEvent } from "react";
import { Badge, Box } from "@mantine/core";
import { IconStar, IconStarFilled } from "@tabler/icons-react";

import type { CatalogVideo } from "../../../../tauriCommands";
import {
  formatCompactFileSize,
  formatDuration,
} from "../../../../shared/formatting/videoFormatting";
import { PreviewStripSurface } from "./components/PreviewStripSurface";
import styles from "./VideoPreview.module.css";

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
