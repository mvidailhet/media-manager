import { useState } from "react";
import { AppShell } from "@mantine/core";
import {
  CatalogModule,
  type CatalogVideo,
  useCatalogModuleController,
} from "./modules/catalog";
import { CatalogModuleDetailAside } from "./modules/catalog/CatalogModuleDetailAside";
import {
  Scan,
  type ScanRoot,
  type ScanRootRemovalPolicy,
  useScanModuleController,
} from "./modules/scan";
import {
  SettingsModule,
  useSettingsModuleController,
} from "./modules/settings";
import styles from "./App.module.css";
import { ForgetMissingVideoConfirmation } from "./components/ForgetMissingVideoConfirmation";
import { ModuleNavigation } from "./components/ModuleNavigation";
import { RemoveScanRootConfirmation } from "./components/RemoveScanRootConfirmation";
import { errorMessage } from "./shared/errors/errorMessage";

export const videoDetailAsideWidth = 560;

export type AppModule = "catalog" | "scan" | "settings";

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
        <ModuleNavigation
          activeAppModule={activeAppModule}
          scanAttentionCount={scanAttentionCount}
          settingsAttentionCount={settingsAttentionCount}
          setActiveAppModule={setActiveAppModule}
        />
        {activeAppModule === "catalog" ? (
          <CatalogModule
            {...catalogModuleProps}
            metadataSuggestionGroups={metadataSuggestionGroups}
          />
        ) : null}
        {activeAppModule === "scan" ? <Scan {...scanModuleProps} /> : null}

        {scanRootPendingRemoval ? (
          <RemoveScanRootConfirmation
            scanRoot={scanRootPendingRemoval}
            confirmScanRootRemoval={confirmScanRootRemoval}
            cancelScanRootRemoval={() => setScanRootPendingRemoval(null)}
          />
        ) : null}

        {missingVideoPendingForget ? (
          <ForgetMissingVideoConfirmation
            missingVideo={missingVideoPendingForget}
            confirmMissingVideoForget={confirmMissingVideoForget}
            cancelMissingVideoForget={() => setMissingVideoPendingForget(null)}
          />
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
