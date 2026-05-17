import { Box, Text } from "@mantine/core";

import styles from "./DefinitionTerm.module.css";

export function DefinitionTerm({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Box>
      <Text component="dt" c="dimmed" fw={700} size="xs" tt="uppercase">
        {label}
      </Text>
      <Text component="dd" className={styles.value}>
        {children}
      </Text>
    </Box>
  );
}
