import { useState } from "react";
import {
  ActionIcon,
  AppShell,
  Box,
  Button,
  Group,
  Indicator,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconFolderSearch,
  IconSettings,
} from "@tabler/icons-react";
import {
  CatalogModule,
  CatalogModuleDetailAside,
  type CatalogVideo,
  useCatalogModuleController,
} from "./modules/catalog";
import {
  ScanModule,
  type ScanRoot,
  type ScanRootRemovalPolicy,
  useScanModuleController,
} from "./modules/scan";
import {
  SettingsModule,
  useSettingsModuleController,
} from "./modules/settings";
import styles from "./App.module.css";
import { WrappingCode } from "./shared/components/WrappingCode";
import { errorMessage } from "./shared/errors/errorMessage";

const navigationIconSize = 20;
export const videoDetailAsideWidth = 560;

type AppModule = "catalog" | "scan" | "settings";

export default function App() {
  const [activeAppModule, setActiveAppModule] = useState<AppModule>("catalog");
  const [scanRootPendingRemoval, setScanRootPendingRemoval] =
    useState<ScanRoot | null>(null);
  const [missingVideoPendingForget, setMissingVideoPendingForget] =
    useState<CatalogVideo | null>(null);
  const catalog = useCatalogModuleController({
    refreshScanIssues: async (shouldClearStatusMessage) =>
      scan.refreshScanIssues(shouldClearStatusMessage),
    setScanIssuesStatusMessage: (message) =>
      scan.setScanIssuesStatusMessage(message),
  });
  const {
    catalogModuleProps,
    catalogVideos,
    forgetMissingVideo,
    missingVideos,
    refreshCatalogVideos,
  } = catalog;
  const scan = useScanModuleController({
    catalogVideos,
    missingVideos,
    onRequestMissingVideoForget: setMissingVideoPendingForget,
    onRequestScanRootRemoval: setScanRootPendingRemoval,
    refreshCatalogVideos,
  });
  const settings = useSettingsModuleController({
    refreshScanIssues: async () => scan.refreshScanIssues(false),
  });
  const { metadataSuggestionGroups, scanAttentionCount, scanModuleProps } =
    scan;
  const { settingsAttentionCount, settingsModuleProps } = settings;
  const isVideoDetailAsideVisible =
    activeAppModule === "catalog" && catalogModuleProps.selectedVideo !== null;

  async function confirmScanRootRemoval(removalPolicy: ScanRootRemovalPolicy) {
    if (!scanRootPendingRemoval) {
      return;
    }

    const removedScanRoot = scanRootPendingRemoval;

    const wasRemoved = await scan.removeSelectedScanRoot(
      removedScanRoot,
      removalPolicy,
    );

    if (wasRemoved) {
      setScanRootPendingRemoval(null);
    }
  }

  async function confirmMissingVideoForget() {
    if (!missingVideoPendingForget) {
      return;
    }

    try {
      await forgetMissingVideo(missingVideoPendingForget.id);
      setMissingVideoPendingForget(null);
      scan.setScanIssuesStatusMessage("");
      await refreshCatalogVideos();
    } catch (error) {
      scan.setScanIssuesStatusMessage(errorMessage(error));
    }
  }

  return (
    <AppShell
      aside={{
        width: videoDetailAsideWidth,
        breakpoint: "md",
        collapsed: {
          mobile: !isVideoDetailAsideVisible,
          desktop: !isVideoDetailAsideVisible,
        },
      }}
      padding="md"
    >
      <AppShell.Main className={styles.mainContent}>
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
                  scanAttentionCount > 0
                    ? `Scan ${scanAttentionCount}`
                    : "Scan"
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
        {activeAppModule === "catalog" ? (
          <CatalogModule
            {...catalogModuleProps}
            metadataSuggestionGroups={metadataSuggestionGroups}
          />
        ) : null}
        {activeAppModule === "scan" ? <ScanModule {...scanModuleProps} /> : null}

        {scanRootPendingRemoval ? (
          <Paper
            component="section"
            aria-label="Remove Scan Root confirmation"
            p="md"
            maw={760}
          >
            <Stack gap="sm">
              <Title order={2} size="h3">
                Remove Scan Root
              </Title>
              <WrappingCode>
                {scanRootPendingRemoval.path}
              </WrappingCode>
              <Group gap="xs">
                <Button
                  type="button"
                  onClick={() =>
                    void confirmScanRootRemoval("preserveMissingVideos")
                  }
                >
                  Preserve as Missing Videos
                </Button>
                <Button
                  type="button"
                  variant="light"
                  color="red"
                  onClick={() =>
                    void confirmScanRootRemoval("forgetFromCatalog")
                  }
                >
                  Forget From Catalog
                </Button>
                <Button
                  type="button"
                  variant="default"
                  onClick={() => setScanRootPendingRemoval(null)}
                >
                  Cancel
                </Button>
              </Group>
            </Stack>
          </Paper>
        ) : null}

        {missingVideoPendingForget ? (
          <Paper
            component="section"
            aria-label="Forget Missing Video confirmation"
            p="md"
            maw={760}
          >
            <Stack gap="sm">
              <Title order={2} size="h3">
                Forget Missing Video
              </Title>
              <Text>{missingVideoPendingForget.title}</Text>
              <Group gap="xs">
                <Button
                  type="button"
                  color="red"
                  onClick={() => void confirmMissingVideoForget()}
                >
                  Confirm Forget From Catalog
                </Button>
                <Button
                  type="button"
                  variant="default"
                  onClick={() => setMissingVideoPendingForget(null)}
                >
                  Cancel
                </Button>
              </Group>
            </Stack>
          </Paper>
        ) : null}

        {activeAppModule === "settings" ? (
          <SettingsModule {...settingsModuleProps} />
        ) : null}
      </AppShell.Main>
      {activeAppModule === "catalog" ? (
        <CatalogModuleDetailAside
          {...catalogModuleProps}
          metadataSuggestionGroups={metadataSuggestionGroups}
        />
      ) : null}
    </AppShell>
  );
}
