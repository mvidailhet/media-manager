import { Box, Button, Paper, Stack, Text, TextInput } from "@mantine/core";
import type { FormEvent } from "react";

import type { FfmpegToolsStatus } from "../../../tauriCommands";
import { SectionHeader } from "../../../shared/components/SectionHeader";
import { FfmpegToolStatusCard } from "./components/FfmpegToolStatusCard";

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
  onSaveConfiguredFfmpegPaths: (event: FormEvent) => void;
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
