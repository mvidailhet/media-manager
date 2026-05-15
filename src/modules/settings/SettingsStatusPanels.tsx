import { Box, Button, Code, Group, Paper, Stack, Text, TextInput, Title } from "@mantine/core";

import type { FfmpegToolsStatus } from "../../tauriCommands";
import { AvailabilityBadge } from "../../shared/components/AvailabilityBadge";
import { SectionHeader } from "../../shared/components/SectionHeader";

export function TauriStatusPanel({
  localDesktopAppStatus,
}: {
  localDesktopAppStatus: string;
}) {
  return (
    <Paper
      component="section"
      aria-label="Tauri command status"
      p="md"
      maw={420}
    >
      <Stack gap={8}>
        <Text c="dimmed" fw={700} size="sm" tt="uppercase">
          Tauri bridge
        </Text>
        <Text c="teal" fw={700}>
          {localDesktopAppStatus}
        </Text>
      </Stack>
    </Paper>
  );
}

export function FfmpegStatusPanel({
  ffmpegPath,
  ffmpegStatusMessage,
  ffmpegToolsStatus,
  ffprobePath,
  onFfmpegPathChange,
  onFfprobePathChange,
  onSaveConfiguredFfmpegPaths,
}: {
  ffmpegPath: string;
  ffmpegStatusMessage: string;
  ffmpegToolsStatus: FfmpegToolsStatus | null;
  ffprobePath: string;
  onFfmpegPathChange: (path: string) => void;
  onFfprobePathChange: (path: string) => void;
  onSaveConfiguredFfmpegPaths: (event: React.FormEvent) => void;
}) {
  return (
    <Paper
      component="section"
      aria-label="FFmpeg tools status"
      p="md"
      maw={760}
    >
      <Stack gap="md">
        <SectionHeader label="Video tooling" title="FFmpeg status" />

        {ffmpegStatusMessage ? <Text>{ffmpegStatusMessage}</Text> : null}

        {ffmpegToolsStatus ? (
          <Stack gap="sm">
            {[ffmpegToolsStatus.ffmpeg, ffmpegToolsStatus.ffprobe].map(
              (toolStatus) => (
                <FfmpegToolStatusCard
                  key={toolStatus.binaryName}
                  toolStatus={toolStatus}
                />
              ),
            )}
          </Stack>
        ) : null}

        <Box component="form" onSubmit={onSaveConfiguredFfmpegPaths}>
          <Stack gap="sm">
            <TextInput
              label="FFmpeg path"
              value={ffmpegPath}
              onChange={(event) => onFfmpegPathChange(event.target.value)}
              placeholder="Use PATH discovery"
            />
            <TextInput
              label="ffprobe path"
              value={ffprobePath}
              onChange={(event) => onFfprobePathChange(event.target.value)}
              placeholder="Use PATH discovery"
            />
            <Button type="submit" w="fit-content">
              Save paths
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

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
          <Code className="wrapping-code" mt={8}>
            {toolStatus.resolvedPath}
          </Code>
        ) : null}
      </Box>
      <AvailabilityBadge
        isAvailable={toolStatus.isAvailable}
        missingLabel="Missing"
      />
    </Group>
  );
}
