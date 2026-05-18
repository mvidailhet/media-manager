import { Badge, Button, Group } from "@mantine/core";

import type { PreviewStripQueueStatus } from "../../../../tauriCommands";
import { previewStripQueueActivityLabel } from "../previewStripQueueActivityLabel";

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
      {generatedPreviewStripCount !== undefined ? (
        <Badge variant="light">{generatedPreviewStripCount} generated</Badge>
      ) : null}
      <Badge variant="light">
        {previewStripQueueStatus.runningCount} running
      </Badge>
      {generatingPreviewStripTitle ? (
        <Badge variant="light">
          Generating Preview Strip: {generatingPreviewStripTitle}
        </Badge>
      ) : null}
      <Badge color="red" variant="light">
        {previewStripQueueStatus.failedCount} failed
      </Badge>
      {previewStripQueueStatus.isPaused ? (
        <Button
          type="button"
          size="xs"
          variant="default"
          onClick={() => void onResumePreviewStripQueue()}
        >
          Resume Preview Queue
        </Button>
      ) : (
        <Button
          type="button"
          size="xs"
          variant="default"
          onClick={() => void onPausePreviewStripQueue()}
        >
          Pause Preview Queue
        </Button>
      )}
    </Group>
  );
}
