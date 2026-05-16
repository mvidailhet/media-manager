import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

import type {
  ScanRoot,
  ScanRootRefreshSummary,
  ScanRootRemovalPolicy,
} from "../../tauriCommands";
import {
  addScanRoot,
  listScanRoots,
  refreshAllScanRoots,
  refreshScanRoot,
  removeScanRoot,
  updateScanRootInferenceRules,
} from "../../tauriCommands";
import { errorMessage } from "../../shared/errors/errorMessage";

const scanRootsLoadingMessage = "Loading Scan Roots...";
const scanRootsErrorMessage = "Scan Roots unavailable";
const scanRootRefreshStartedMessage = "Refreshing Scan Root...";

export function useScanRoots({
  refreshCatalogVideos,
  refreshPreviewStripQueueStatus,
  refreshReviewQueue,
}: {
  refreshCatalogVideos: () => Promise<void>;
  refreshPreviewStripQueueStatus: () => Promise<void>;
  refreshReviewQueue: () => Promise<void>;
}) {
  const [scanRoots, setScanRoots] = useState<ScanRoot[]>([]);
  const [scanRootsStatusMessage, setScanRootsStatusMessage] = useState(
    scanRootsLoadingMessage,
  );
  const [manualScanRootPath, setManualScanRootPath] = useState("");

  async function refreshScanRoots(shouldClearStatusMessage = true) {
    try {
      const storedScanRoots = await listScanRoots();

      setScanRoots(storedScanRoots);
      if (shouldClearStatusMessage) {
        setScanRootsStatusMessage("");
      }
    } catch {
      setScanRootsStatusMessage(scanRootsErrorMessage);
    }
  }

  useEffect(() => {
    let canUpdateScanRoots = true;

    async function loadInitialScanRoots() {
      try {
        const storedScanRoots = await listScanRoots();

        if (canUpdateScanRoots) {
          setScanRoots(storedScanRoots);
          setScanRootsStatusMessage("");
        }
      } catch {
        if (canUpdateScanRoots) {
          setScanRootsStatusMessage(scanRootsErrorMessage);
        }
      }
    }

    void loadInitialScanRoots();

    return () => {
      canUpdateScanRoots = false;
    };
  }, []);

  async function chooseScanRootFolder() {
    try {
      const selectedFolder = await open({
        directory: true,
        multiple: false,
      });

      if (typeof selectedFolder === "string") {
        await persistScanRoot(selectedFolder);
      }
    } catch (error) {
      setScanRootsStatusMessage(errorMessage(error));
    }
  }

  async function addManualScanRoot(event: React.FormEvent) {
    event.preventDefault();
    await persistScanRoot(manualScanRootPath);
  }

  async function persistScanRoot(path: string) {
    const scanRootPath = path.trim();

    if (!scanRootPath) {
      return;
    }

    try {
      const scanRoot = await addScanRoot(scanRootPath);
      const refreshSummary = await refreshScanRoot(scanRoot.path);

      setScanRoots((currentScanRoots) =>
        [...currentScanRoots, scanRoot].sort((left, right) =>
          left.path.localeCompare(right.path),
        ),
      );
      setManualScanRootPath("");
      setScanRootsStatusMessage(scanRootRefreshSummaryMessage(refreshSummary));
      await refreshCatalogVideos();
      await refreshReviewQueue();
      await refreshPreviewStripQueueStatus();
    } catch (error) {
      setScanRootsStatusMessage(errorMessage(error));
    }
  }

  async function removeSelectedScanRoot(
    scanRoot: ScanRoot,
    removalPolicy: ScanRootRemovalPolicy,
  ) {
    try {
      await removeScanRoot(scanRoot.path, removalPolicy);
      setScanRoots((currentScanRoots) =>
        currentScanRoots.filter(
          (currentScanRoot) => currentScanRoot.path !== scanRoot.path,
        ),
      );
      setScanRootsStatusMessage("");
      await refreshCatalogVideos();
      await refreshReviewQueue();
    } catch (error) {
      setScanRootsStatusMessage(errorMessage(error));
    }
  }

  async function refreshSelectedScanRoot(scanRoot: ScanRoot) {
    try {
      setScanRootsStatusMessage(scanRootRefreshStartedMessage);
      const refreshSummary = await refreshScanRoot(scanRoot.path);

      setScanRootsStatusMessage(scanRootRefreshSummaryMessage(refreshSummary));
      await refreshScanRoots(false);
      await refreshCatalogVideos();
      await refreshReviewQueue();
      await refreshPreviewStripQueueStatus();
    } catch (error) {
      setScanRootsStatusMessage(errorMessage(error));
    }
  }

  async function saveScanRootInferenceRules(
    scanRoot: ScanRoot,
    inferenceRules: ScanRoot["inferenceRules"],
  ) {
    try {
      const updatedScanRoot = await updateScanRootInferenceRules(
        scanRoot.path,
        inferenceRules,
      );
      setScanRoots((currentScanRoots) =>
        currentScanRoots.map((currentScanRoot) =>
          currentScanRoot.path === updatedScanRoot.path
            ? updatedScanRoot
            : currentScanRoot,
        ),
      );
    } catch {
      setScanRootsStatusMessage(scanRootsErrorMessage);
    }
  }

  async function refreshEveryScanRoot() {
    try {
      setScanRootsStatusMessage(scanRootRefreshStartedMessage);
      const refreshSummary = await refreshAllScanRoots();

      setScanRootsStatusMessage(scanRootRefreshSummaryMessage(refreshSummary));
      await refreshScanRoots(false);
      await refreshCatalogVideos();
      await refreshReviewQueue();
      await refreshPreviewStripQueueStatus();
    } catch (error) {
      setScanRootsStatusMessage(errorMessage(error));
    }
  }

  return {
    addManualScanRoot,
    chooseScanRootFolder,
    manualScanRootPath,
    refreshEveryScanRoot,
    refreshScanRoots,
    refreshSelectedScanRoot,
    removeSelectedScanRoot,
    saveScanRootInferenceRules,
    scanRoots,
    scanRootsStatusMessage,
    setManualScanRootPath,
  };
}

function scanRootRefreshSummaryMessage(refreshSummary: ScanRootRefreshSummary) {
  return `${refreshSummary.scannedVideoCount} Videos scanned, ${refreshSummary.unprocessableCandidateCount} Unprocessable Video Candidates`;
}

export type { ScanRoot, ScanRootRemovalPolicy };
