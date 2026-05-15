import { Badge, Button, Group } from "@mantine/core";

import type { PreviewStripQueueStatus } from "../../tauriCommands";
export function PreviewStripQueuePanel({
  onPausePreviewQueue,
  onResumePreviewQueue,
  previewStripQueueStatus,
}: {
  onPausePreviewQueue: () => void;
  onResumePreviewQueue: () => void;
  previewStripQueueStatus: PreviewStripQueueStatus | null;
}) {
  if (!previewStripQueueStatus) {
    return null;
  }
  const queueActivityLabel = previewStripQueueActivityLabel(
    previewStripQueueStatus,
  );

  return (
    <Group gap="xs" align="center">
      <Badge color={previewStripQueueStatus.isPaused ? "yellow" : "teal"}>
        {queueActivityLabel}
      </Badge>
      <Badge variant="light">
        {previewStripQueueStatus.pendingCount} pending
      </Badge>
      <Badge variant="light">
        {previewStripQueueStatus.runningCount} running
      </Badge>
      <Badge color="red" variant="light">
        {previewStripQueueStatus.failedCount} failed
      </Badge>
      {previewStripQueueStatus.isPaused ? (
        <Button
          type="button"
          size="xs"
          variant="default"
          onClick={() => void onResumePreviewQueue()}
        >
          Resume Preview Queue
        </Button>
      ) : (
        <Button
          type="button"
          size="xs"
          variant="default"
          onClick={() => void onPausePreviewQueue()}
        >
          Pause Preview Queue
        </Button>
      )}
    </Group>
  );
}

export function previewStripQueueActivityLabel(
  previewStripQueueStatus: PreviewStripQueueStatus,
) {
  if (previewStripQueueStatus.isPaused) {
    return "Paused";
  }

  if (
    previewStripQueueStatus.runningCount === 0 &&
    previewStripQueueStatus.pendingCount === 0
  ) {
    return "Idle";
  }

  return "Running";
}
