import { Button, Stack, Text } from "@mantine/core";

import type {
  ScanRoot,
  ScanRootRefreshJobProgress,
} from "../../../../../../tauriCommands";
import { ProgressBar } from "./ProgressBar";

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

function scanIssueCountLabel(unprocessableCandidateCount: number) {
  return unprocessableCandidateCount === 1
    ? "1 Scan Issue"
    : `${unprocessableCandidateCount} Scan Issues`;
}
