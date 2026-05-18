import { Box, Group, Text, Title } from "@mantine/core";

import { AvailabilityBadge } from "../../../../shared/components/AvailabilityBadge";
import { WrappingCode } from "../../../../shared/components/WrappingCode";
import type { FfmpegToolsStatus } from "../../../../tauriCommands";

export function FfmpegToolStatusCard({
  toolStatus,
}: {
  toolStatus: FfmpegToolsStatus["ffmpeg"];
}) {
  return (
    <Group component="article" gap="md" justify="space-between" align="start">
      <Box>
        <Title order={3} size="h4">
          {toolStatus.binaryName}
        </Title>
        <Text c="dimmed" lh={1.5}>
          {toolStatus.statusMessage}
        </Text>
        {toolStatus.resolvedPath ? (
          <WrappingCode mt={8}>{toolStatus.resolvedPath}</WrappingCode>
        ) : null}
      </Box>
      <AvailabilityBadge
        isAvailable={toolStatus.isAvailable}
        missingLabel="Missing"
      />
    </Group>
  );
}
