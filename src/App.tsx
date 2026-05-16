import { useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Code,
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
import { CatalogModule } from "./modules/catalog/CatalogModule";
import type { CatalogVideo } from "./modules/catalog/useCatalogModuleController";
import { useCatalogModuleController } from "./modules/catalog/useCatalogModuleController";
import { ScanModule, scanRootsTab } from "./modules/scan/ScanModule";
import { SettingsModule } from "./modules/settings/SettingsModule";
import { useSettingsModuleController } from "./modules/settings/useSettingsModuleController";
import { usePreviewGeneration } from "./modules/scan/usePreviewGeneration";
import { useScanIssues } from "./modules/scan/useScanIssues";
import type { ScanRoot, ScanRootRemovalPolicy } from "./modules/scan/useScanRoots";
import { useScanRoots } from "./modules/scan/useScanRoots";
import { errorMessage } from "./shared/errors/errorMessage";

const navigationIconSize = 20;

type AppModule = "catalog" | "scan" | "settings";

export default function App() {
  const [activeAppModule, setActiveAppModule] = useState<AppModule>("catalog");
  const [scanRootPendingRemoval, setScanRootPendingRemoval] =
    useState<ScanRoot | null>(null);
  const [missingVideoPendingForget, setMissingVideoPendingForget] =
    useState<CatalogVideo | null>(null);
  const [scanTab, setScanTab] = useState<string | null>(scanRootsTab);
  const catalog = useCatalogModuleController({
    refreshScanIssues: async (shouldClearStatusMessage) =>
      scanIssues.refreshScanIssues(shouldClearStatusMessage),
    setScanIssuesStatusMessage: (message) =>
      scanIssues.setScanIssuesStatusMessage(message),
  });
  const {
    catalogModuleProps,
    catalogVideos,
    forgetMissingVideo,
    missingVideos,
    refreshCatalogVideos,
  } = catalog;
  const previewGeneration = usePreviewGeneration({
    refreshCatalogVideos,
    refreshScanIssues: async () => scanIssues.refreshScanIssues(false),
  });
  const scanIssues = useScanIssues({
    refreshCatalogVideos,
    refreshPreviewStripQueueStatus:
      previewGeneration.refreshPreviewStripQueueStatus,
    setPreviewStripQueueStatus: previewGeneration.setPreviewStripQueueStatus,
  });
  const scanRootsState = useScanRoots({
    refreshCatalogVideos,
    refreshPreviewStripQueueStatus:
      previewGeneration.refreshPreviewStripQueueStatus,
    refreshScanIssues: async () => scanIssues.refreshScanIssues(false),
  });
  const settings = useSettingsModuleController({
    refreshScanIssues: async () => scanIssues.refreshScanIssues(false),
  });
  const {
    pausePreviewStripQueueAction,
    previewStripQueueStatus,
    resumePreviewStripQueueAction,
  } = previewGeneration;
  const {
    failedPreviewStrips,
    ignoreFailedPreview,
    metadataSuggestionGroups,
    refreshScanIssues,
    retryFailedPreview,
    scanIssuesStatusMessage,
    setScanIssuesStatusMessage,
    unprocessableVideoCandidates,
  } = scanIssues;
  const {
    addManualScanRoot,
    chooseScanRootFolder,
    manualScanRootPath,
    refreshEveryScanRoot,
    refreshSelectedScanRoot,
    removeSelectedScanRoot,
    saveScanRootInferenceRules,
    scanRoots,
    scanRootsStatusMessage,
    setManualScanRootPath,
  } = scanRootsState;
  const { settingsAttentionCount, settingsModuleProps } = settings;

  async function confirmScanRootRemoval(removalPolicy: ScanRootRemovalPolicy) {
    if (!scanRootPendingRemoval) {
      return;
    }

    const removedScanRoot = scanRootPendingRemoval;

    const wasRemoved = await removeSelectedScanRoot(
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
      setScanIssuesStatusMessage("");
      await refreshCatalogVideos();
    } catch (error) {
      setScanIssuesStatusMessage(errorMessage(error));
    }
  }

  const unavailableScanRoots = scanRoots.filter(
    (scanRoot) => !scanRoot.isAvailable,
  );
  const scanIssuesAttentionCount =
    missingVideos.length +
    unavailableScanRoots.length +
    unprocessableVideoCandidates.length;
  const previewGenerationAttentionCount = failedPreviewStrips.length;
  const scanAttentionCount =
    scanIssuesAttentionCount + previewGenerationAttentionCount;
  const generatedPreviewStripCount = catalogVideos.filter(
    (catalogVideo) => catalogVideo.previewStrip.status === "generated",
  ).length;
  const generatingPreviewStripVideo = catalogVideos.find(
    (catalogVideo) =>
      catalogVideo.id === previewStripQueueStatus?.runningVideoId,
  );

  return (
    <Box component="main" className="app-shell">
      <Group
        component="nav"
        aria-label="Module navigation"
        className="module-navigation"
        gap="xs"
      >
        <Box className="module-navigation-start">
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
      {activeAppModule === "catalog" ? (
        <CatalogModule
          {...catalogModuleProps}
          metadataSuggestionGroups={metadataSuggestionGroups}
        />
      ) : null}
      {activeAppModule === "scan" ? (
        <ScanModule
          failedPreviewStrips={failedPreviewStrips}
          generatedPreviewStripCount={generatedPreviewStripCount}
          generatingPreviewStripTitle={generatingPreviewStripVideo?.title}
          manualScanRootPath={manualScanRootPath}
          missingVideos={missingVideos}
          onAddManualScanRoot={addManualScanRoot}
          onChooseScanRootFolder={chooseScanRootFolder}
          onIgnoreFailedPreview={ignoreFailedPreview}
          onManualScanRootPathChange={setManualScanRootPath}
          onPausePreviewStripQueue={pausePreviewStripQueueAction}
          onRefreshEveryScanRoot={refreshEveryScanRoot}
          onRefreshSelectedScanRoot={refreshSelectedScanRoot}
          onRequestMissingVideoForget={setMissingVideoPendingForget}
          onRequestScanRootRemoval={setScanRootPendingRemoval}
          onResumePreviewStripQueue={resumePreviewStripQueueAction}
          onRetryFailedPreview={retryFailedPreview}
          onSaveScanRootInferenceRules={saveScanRootInferenceRules}
          onScanTabChange={setScanTab}
          previewGenerationAttentionCount={previewGenerationAttentionCount}
          previewStripQueueStatus={previewStripQueueStatus}
          scanIssuesAttentionCount={scanIssuesAttentionCount}
          scanIssuesStatusMessage={scanIssuesStatusMessage}
          scanRoots={scanRoots}
          scanRootsStatusMessage={scanRootsStatusMessage}
          scanTab={scanTab}
          unavailableScanRoots={unavailableScanRoots}
          unprocessableVideoCandidates={unprocessableVideoCandidates}
        />
      ) : null}

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
            <Code className="wrapping-code">{scanRootPendingRemoval.path}</Code>
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
                onClick={() => void confirmScanRootRemoval("forgetFromCatalog")}
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
    </Box>
  );
}
