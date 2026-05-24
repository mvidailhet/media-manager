import { Stack, Text, Title } from "@mantine/core";

import styles from "../SelectionPanel.module.css";

export function EmptySelectionState() {
  return (
    <Stack className={styles.emptySelectionState} gap="xs">
      <Title order={2}>No video selected</Title>
      <Text c="dimmed">
        Select one video for details or select multiple videos for batch editing.
      </Text>
    </Stack>
  );
}
