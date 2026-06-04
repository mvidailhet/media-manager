import { Badge, Button, Group, Stack, Text } from "@mantine/core";

import type { PreviewStripQueueStatus } from "../../../../tauriCommands";

export function PreviewStripQueuePanel({
  generatingPreviewStripTitle,
  onPausePreviewStripQueue,
  onResumePreviewStripQueue,
  previewStripQueueStatus,
}: {
  generatingPreviewStripTitle?: string;
  onPausePreviewStripQueue: () => void;
  onResumePreviewStripQueue: () => void;
  previewStripQueueStatus: PreviewStripQueueStatus | null;
}) {
  if (!previewStripQueueStatus) {
    return null;
  }
  const isPreviewStripQueueStopped = previewStripQueueStatus.isPaused;

  return (
    <Stack gap="xs">
      <Group gap="xs" align="center">
        <Button
          type="button"
          size="xs"
          color={isPreviewStripQueueStopped ? "blue" : "red"}
          onClick={() =>
            void (isPreviewStripQueueStopped
              ? onResumePreviewStripQueue()
              : onPausePreviewStripQueue())
          }
        >
          {isPreviewStripQueueStopped ? "Start" : "Stop"}
        </Button>
        <Text size="sm">{previewStripQueueStatus.pendingCount} pending</Text>
        {previewStripQueueStatus.failedCount > 0 ? (
          <Badge color="red" variant="light">
            {previewStripQueueStatus.failedCount} failed
          </Badge>
        ) : null}
      </Group>
      {generatingPreviewStripTitle ? (
        <Text size="sm" c="dimmed">
          Generating Preview Strip: {generatingPreviewStripTitle}
        </Text>
      ) : null}
    </Stack>
  );
}
