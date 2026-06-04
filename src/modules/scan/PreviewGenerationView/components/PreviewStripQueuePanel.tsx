import { Badge, Button, Group, Progress, Stack, Text } from "@mantine/core";

import type { PreviewStripQueueStatus } from "../../../../tauriCommands";

const completedPreviewStripProgress = 100;
const emptyPreviewStripProgress = 0;

export function PreviewStripQueuePanel({
  generatedPreviewStripCount,
  generatingPreviewStripTitle,
  onPausePreviewStripQueue,
  onResumePreviewStripQueue,
  previewStripQueueStatus,
}: {
  generatedPreviewStripCount?: number;
  generatingPreviewStripTitle?: string;
  onPausePreviewStripQueue: () => void;
  onResumePreviewStripQueue: () => void;
  previewStripQueueStatus: PreviewStripQueueStatus | null;
}) {
  if (!previewStripQueueStatus) {
    return null;
  }
  const previewStripProgressValue = previewStripQueueProgressValue(
    previewStripQueueStatus,
    generatedPreviewStripCount,
  );
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
      <Progress
        aria-label="Preview Strip generation progress"
        value={previewStripProgressValue}
      />
    </Stack>
  );
}

function previewStripQueueProgressValue(
  previewStripQueueStatus: PreviewStripQueueStatus,
  generatedPreviewStripCount = 0,
) {
  const previewStripQueueTotal =
    generatedPreviewStripCount +
    previewStripQueueStatus.pendingCount +
    previewStripQueueStatus.runningCount +
    previewStripQueueStatus.failedCount;

  if (previewStripQueueTotal === 0) {
    return emptyPreviewStripProgress;
  }

  if (generatedPreviewStripCount === previewStripQueueTotal) {
    return completedPreviewStripProgress;
  }

  return (generatedPreviewStripCount / previewStripQueueTotal) * 100;
}
