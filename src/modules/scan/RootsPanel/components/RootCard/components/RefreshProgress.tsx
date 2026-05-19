import { Button, Group, Progress, Stack, Text } from "@mantine/core";

import type {
  ScanRoot,
  ScanRootRefreshJobProgress,
} from "../../../../../../tauriCommands";

export function RefreshProgress({
  onCancelRefresh,
  progress,
  scanRoot,
}: {
  onCancelRefresh: (scanRoot: ScanRoot) => void;
  progress: ScanRootRefreshJobProgress;
  scanRoot: ScanRoot;
}) {
  const canCancelRefresh = ["discovery", "scanning"].includes(progress.status);

  return (
    <Stack gap={2}>
      <Text fw={700}>{refreshStatusLabel(progress.status)}</Text>
      <ProgressBar progress={progress} />
      <Text>{scanIssueCountLabel(progress.unprocessableCandidateCount)}</Text>
      {canCancelRefresh ? (
        <Button
          type="button"
          size="xs"
          variant="light"
          color="red"
          onClick={() => void onCancelRefresh(scanRoot)}
        >
          Cancel scan
        </Button>
      ) : null}
    </Stack>
  );
}

function refreshStatusLabel(status: ScanRootRefreshJobProgress["status"]) {
  const labels: Record<ScanRootRefreshJobProgress["status"], string> = {
    cancelled: "Cancelled",
    complete: "Complete",
    discovery: "Discovery",
    failed: "Failed",
    metadataSuggestionUpdate: "Metadata suggestion update",
    scanning: "Scanning",
  };

  return labels[status];
}

function ProgressBar({ progress }: { progress: ScanRootRefreshJobProgress }) {
  const totalVideoCandidateCount = progress.totalVideoCandidateCount ?? 0;
  const progressPercentage =
    totalVideoCandidateCount > 0
      ? Math.round(
          (progress.processedVideoCandidateCount / totalVideoCandidateCount) * 100,
        )
      : 0;

  return (
    <Group gap="sm" wrap="nowrap">
      <Progress
        aria-label="Scan Root progress"
        value={progressPercentage}
        flex={1}
      />
      <Text miw={64} ta="right">
        {progress.processedVideoCandidateCount} / {totalVideoCandidateCount}
      </Text>
    </Group>
  );
}

function scanIssueCountLabel(unprocessableCandidateCount: number) {
  return unprocessableCandidateCount === 1
    ? "1 Scan Issue"
    : `${unprocessableCandidateCount} Scan Issues`;
}
