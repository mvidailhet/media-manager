import { useState } from "react";
import { AppShell } from "@mantine/core";
import {
  Catalog,
  type CatalogVideo,
  useCatalogModuleController,
} from "./modules/catalog";
import { CatalogDetailAside } from "./modules/catalog/CatalogDetailAside";
import {
  Scan,
  type ScanRoot,
  type ScanRootRemovalPolicy,
  useScanModuleController,
} from "./modules/scan";
import { Settings, useSettingsModuleController } from "./modules/settings";
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
    catalogProps,
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
  const { metadataSuggestionGroups, scanAttentionCount, scanProps } = scan;
  const { settingsAttentionCount, settingsProps } = settings;
  const isVideoDetailAsideVisible =
    activeAppModule === "catalog" && catalogProps.selectedVideo !== null;

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
          <Catalog
            {...catalogProps}
            metadataSuggestionGroups={metadataSuggestionGroups}
          />
        ) : null}
        {activeAppModule === "scan" ? <Scan {...scanProps} /> : null}

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
          <Settings {...settingsProps} />
        ) : null}
      </AppShell.Main>
      {activeAppModule === "catalog" ? (
        <CatalogDetailAside
          {...catalogProps}
          metadataSuggestionGroups={metadataSuggestionGroups}
        />
      ) : null}
    </AppShell>
  );
}
