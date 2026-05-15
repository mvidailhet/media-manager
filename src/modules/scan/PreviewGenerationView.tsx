import { Badge, Button, Group, Paper, SimpleGrid, Stack } from "@mantine/core";

import type {
  FailedPreviewStrip,
  PreviewStripQueueStatus,
} from "../../tauriCommands";
import { SectionHeader } from "../../shared/components/SectionHeader";
import { FailedPreviewStripsPanel } from "./ScanIssuesPanel";

export function PreviewGenerationView({
  failedPreviewStrips,
  generatedPreviewStripCount,
  generatingPreviewStripTitle,
  onIgnoreFailedPreview,
  onPausePreviewQueue,
  onResumePreviewQueue,
  onRetryFailedPreview,
  previewStripQueueStatus,
}: {
  failedPreviewStrips: FailedPreviewStrip[];
  generatedPreviewStripCount: number;
  generatingPreviewStripTitle?: string;
  onIgnoreFailedPreview: (failedPreviewStrip: FailedPreviewStrip) => void;
  onPausePreviewQueue: () => void;
  onResumePreviewQueue: () => void;
  onRetryFailedPreview: (failedPreviewStrip: FailedPreviewStrip) => void;
  previewStripQueueStatus: PreviewStripQueueStatus | null;
}) {
  return (
    <Paper component="section" aria-label="Preview Generation" p="md" maw={760}>
      <Stack gap="md">
        <SectionHeader label="Preview strips" title="Preview Generation" />
        <PreviewStripQueuePanel
          generatedPreviewStripCount={generatedPreviewStripCount}
          generatingPreviewStripTitle={generatingPreviewStripTitle}
          onPausePreviewQueue={onPausePreviewQueue}
          onResumePreviewQueue={onResumePreviewQueue}
          previewStripQueueStatus={previewStripQueueStatus}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <FailedPreviewStripsPanel
            failedPreviewStrips={failedPreviewStrips}
            onIgnoreFailedPreview={onIgnoreFailedPreview}
            onRetryFailedPreview={onRetryFailedPreview}
          />
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}

export function PreviewStripQueuePanel({
  generatedPreviewStripCount,
  generatingPreviewStripTitle,
  onPausePreviewQueue,
  onResumePreviewQueue,
  previewStripQueueStatus,
}: {
  generatedPreviewStripCount?: number;
  generatingPreviewStripTitle?: string;
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
