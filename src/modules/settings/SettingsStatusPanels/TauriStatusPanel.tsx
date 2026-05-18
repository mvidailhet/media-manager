import { Paper, Stack, Text } from "@mantine/core";

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
