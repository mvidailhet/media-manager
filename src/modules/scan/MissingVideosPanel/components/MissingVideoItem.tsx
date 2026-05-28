import { Box, Button, Divider, Stack, Text, Title } from "@mantine/core";

import type { CatalogVideo } from "../../../../tauriCommands";
import { formatDuration } from "../../../../shared/formatting/videoFormatting";
import { PreviewStripSurface } from "../../../catalog/components/VideoPreview/components/PreviewStripSurface";
import styles from "./MissingVideosList.module.css";

const missingVideoPathUnavailableLabel = "Original path unavailable";

function missingVideoPath(missingVideo: CatalogVideo) {
  return missingVideo.fileLocationPath ?? missingVideoPathUnavailableLabel;
}

export function MissingVideoItem({
  missingVideo,
  onRequestMissingVideoForget,
}: {
  missingVideo: CatalogVideo;
  onRequestMissingVideoForget: (catalogVideo: CatalogVideo) => void;
}) {
  return (
    <Stack
      component="article"
      gap="xs"
      key={missingVideo.id}
      className={styles.missingVideoItem}
    >
      <Divider />
      <PreviewStripSurface catalogVideo={missingVideo} />
      <Box className={styles.missingVideoHeader}>
        <Title order={4} size="h5">
          {missingVideo.title}
        </Title>
        <Text c="dimmed">
          {formatDuration(missingVideo.durationMilliseconds)}
        </Text>
        <Text className={styles.missingVideoPath} c="dimmed" size="sm">
          {missingVideoPath(missingVideo)}
        </Text>
      </Box>
      <Button
        type="button"
        size="xs"
        variant="light"
        className={styles.missingVideoActions}
        onClick={() => onRequestMissingVideoForget(missingVideo)}
      >
        Forget From Catalog
      </Button>
    </Stack>
  );
}
