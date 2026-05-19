import { ActionIcon, Box, Button, Group, Indicator } from "@mantine/core";
import {
  IconArrowLeft,
  IconFolderSearch,
  IconSettings,
} from "@tabler/icons-react";

import styles from "../App.module.css";
import type { AppModule } from "../App";

const navigationIconSize = 20;

type ModuleNavigationProps = {
  activeAppModule: AppModule;
  scanAttentionCount: number;
  settingsAttentionCount: number;
  setActiveAppModule: (appModule: AppModule) => void;
};

export function ModuleNavigation({
  activeAppModule,
  scanAttentionCount,
  settingsAttentionCount,
  setActiveAppModule,
}: ModuleNavigationProps) {
  return (
    <Group
      component="nav"
      aria-label="Module navigation"
      className={styles.moduleNavigation}
      gap="xs"
    >
      <Box className={styles.moduleNavigationStart}>
        {activeAppModule !== "catalog" ? (
          <Button
            type="button"
            variant="subtle"
            leftSection={<IconArrowLeft size={navigationIconSize} />}
            onClick={() => setActiveAppModule("catalog")}
          >
            Back to Catalog
          </Button>
        ) : null}
      </Box>
      <Group gap="xs">
        <Indicator
          disabled={scanAttentionCount === 0}
          label={scanAttentionCount}
          size={16}
          color="red"
        >
          <ActionIcon
            type="button"
            size="lg"
            variant={activeAppModule === "scan" ? "filled" : "default"}
            aria-label={
              scanAttentionCount > 0 ? `Scan ${scanAttentionCount}` : "Scan"
            }
            onClick={() => setActiveAppModule("scan")}
          >
            <IconFolderSearch size={navigationIconSize} />
          </ActionIcon>
        </Indicator>
        <Indicator
          disabled={settingsAttentionCount === 0}
          label={settingsAttentionCount}
          size={16}
          color="red"
        >
          <ActionIcon
            type="button"
            size="lg"
            variant={activeAppModule === "settings" ? "filled" : "default"}
            aria-label={
              settingsAttentionCount > 0
                ? `Settings ${settingsAttentionCount}`
                : "Settings"
            }
            onClick={() => setActiveAppModule("settings")}
          >
            <IconSettings size={navigationIconSize} />
          </ActionIcon>
        </Indicator>
      </Group>
    </Group>
  );
}
