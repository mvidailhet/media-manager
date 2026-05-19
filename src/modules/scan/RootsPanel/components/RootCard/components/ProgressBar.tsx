import { Group, Progress, Text } from "@mantine/core";

import type { ScanRootRefreshJobProgress } from "../../../../../../tauriCommands";

export function ProgressBar({ progress }: { progress: ScanRootRefreshJobProgress }) {
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
