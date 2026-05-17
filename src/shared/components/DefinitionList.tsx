import { Box } from "@mantine/core";

import styles from "./DefinitionList.module.css";

export function DefinitionList({ children }: { children: React.ReactNode }) {
  return (
    <Box component="dl" className={styles.list}>
      {children}
    </Box>
  );
}
