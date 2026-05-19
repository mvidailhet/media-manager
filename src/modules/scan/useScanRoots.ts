import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

import type {
  ScanRoot,
  ScanRootRefreshJobProgress,
  ScanRootRemovalPolicy,
  UnprocessableVideoCandidateGroup,
} from "../../tauriCommands";
import {
  addScanRoot,
  cancelScanRootRefreshJob,
  checkScanRootAvailability,
  listUnprocessableVideoCandidatesByScanRoot,
  listScanRoots,
  removeScanRoot,
  startScanRootRefreshJob,
  updateScanRootInferenceRules,
} from "../../tauriCommands";
import { errorMessage } from "../../shared/errors/errorMessage";

const scanRootsLoadingMessage = "Loading Scan Roots...";
const scanRootsErrorMessage = "Scan Roots unavailable";
const scanRootAvailabilityCheckMessage = "Checking Scan Root availability...";
const scanRootRefreshStartedMessage = "Refreshing Scan Root...";
const scanRootRefreshEventName = "scan-root-refresh-progress";

export function useScanRoots({
  refreshCatalogVideos,
  refreshPreviewStripQueueStatus,
}: {
  refreshCatalogVideos: () => Promise<void>;
  refreshPreviewStripQueueStatus: () => Promise<void>;
}) {
  const [scanRoots, setScanRoots] = useState<ScanRoot[]>([]);
  const [
    unprocessableVideoCandidateGroups,
    setUnprocessableVideoCandidateGroups,
  ] = useState<UnprocessableVideoCandidateGroup[]>([]);
  const [scanRootsStatusMessage, setScanRootsStatusMessage] = useState(
    scanRootsLoadingMessage,
  );
  const [activeScanRootRefresh, setActiveScanRootRefresh] =
    useState<ScanRootRefreshJobProgress | null>(null);
  const latestRefreshCatalogVideos = useRef(refreshCatalogVideos);
  const latestRefreshPreviewStripQueueStatus = useRef(
    refreshPreviewStripQueueStatus,
  );

  useEffect(() => {
    latestRefreshCatalogVideos.current = refreshCatalogVideos;
    latestRefreshPreviewStripQueueStatus.current =
      refreshPreviewStripQueueStatus;
  }, [refreshCatalogVideos, refreshPreviewStripQueueStatus]);

  async function refreshUnprocessableVideoCandidates() {
    const candidateGroups = await listUnprocessableVideoCandidatesByScanRoot();

    setUnprocessableVideoCandidateGroups(candidateGroups);
  }

  async function refreshScanRoots(shouldClearStatusMessage = true) {
    try {
      const [storedScanRoots, candidateGroups] = await Promise.all([
        listScanRoots(),
        listUnprocessableVideoCandidatesByScanRoot(),
      ]);

      setScanRoots(storedScanRoots);
      setUnprocessableVideoCandidateGroups(candidateGroups);
      if (shouldClearStatusMessage) {
        setScanRootsStatusMessage("");
      }
    } catch {
      setScanRootsStatusMessage(scanRootsErrorMessage);
    }
  }

  async function checkSelectedScanRootAvailability(scanRoot: ScanRoot) {
    try {
      setScanRootsStatusMessage(scanRootAvailabilityCheckMessage);
      const checkedScanRoot = await checkScanRootAvailability(scanRoot.path);

      setScanRoots((currentScanRoots) =>
        currentScanRoots.map((currentScanRoot) =>
          currentScanRoot.path === checkedScanRoot.path
            ? {
                ...currentScanRoot,
                isAvailable: checkedScanRoot.isAvailable,
              }
            : currentScanRoot,
        ),
      );
      setScanRootsStatusMessage("");
      await refreshCatalogVideos();
    } catch (error) {
      setScanRootsStatusMessage(errorMessage(error));
    }
  }

  useEffect(() => {
    let canUpdateScanRoots = true;

    async function loadInitialScanRoots() {
      try {
        const [storedScanRoots, candidateGroups] = await Promise.all([
          listScanRoots(),
          listUnprocessableVideoCandidatesByScanRoot(),
        ]);
        const checkedScanRoots = await Promise.all(
          storedScanRoots.map((scanRoot) =>
            checkScanRootAvailability(scanRoot.path),
          ),
        );

        if (canUpdateScanRoots) {
          setScanRoots(
            storedScanRoots.map((scanRoot) => {
              const checkedScanRoot = checkedScanRoots.find(
                (currentCheckedScanRoot) =>
                  currentCheckedScanRoot.path === scanRoot.path,
              );

              return checkedScanRoot
                ? {
                    ...scanRoot,
                    isAvailable: checkedScanRoot.isAvailable,
                  }
                : scanRoot;
            }),
          );
          setUnprocessableVideoCandidateGroups(candidateGroups);
          setScanRootsStatusMessage("");
          if (storedScanRoots.length > 0) {
            void latestRefreshCatalogVideos.current();
          }
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

  useEffect(() => {
    let canUpdateScanRootRefresh = true;
    let removeScanRootRefreshListener: (() => void) | undefined;

    async function subscribeToScanRootRefresh() {
      removeScanRootRefreshListener = await listen<ScanRootRefreshJobProgress>(
        scanRootRefreshEventName,
        (event) => {
          if (!canUpdateScanRootRefresh) {
            return;
          }

          setActiveScanRootRefresh(event.payload);
          setScanRootsStatusMessage(scanRootRefreshProgressMessage(event.payload));

          if (isFinishedScanRootRefresh(event.payload.status)) {
            void refreshScanRoots(false);
            void latestRefreshCatalogVideos.current();
            void latestRefreshPreviewStripQueueStatus.current();
          }
        },
      );
    }

    void subscribeToScanRootRefresh();

    return () => {
      canUpdateScanRootRefresh = false;
      removeScanRootRefreshListener?.();
    };
  }, []);

  async function chooseScanRootFolder() {
    try {
      const selectedFolder = await open({
        directory: true,
        multiple: false,
      });

      if (typeof selectedFolder === "string") {
        void persistScanRoot(selectedFolder);
      }
    } catch (error) {
      setScanRootsStatusMessage(errorMessage(error));
    }
  }

  async function persistScanRoot(path: string) {
    const scanRootPath = path.trim();

    if (!scanRootPath) {
      return;
    }

    try {
      const scanRoot = await addScanRoot(scanRootPath);
      const startingScanRootRefresh = startingScanRootRefreshProgress(
        scanRoot.path,
      );

      setScanRoots((currentScanRoots) =>
        [...currentScanRoots, scanRoot].sort((left, right) =>
          left.path.localeCompare(right.path),
        ),
      );
      setActiveScanRootRefresh(startingScanRootRefresh);
      setScanRootsStatusMessage(scanRootRefreshStartedMessage);
      await startScanRootRefreshJob(scanRoot.path);
    } catch (error) {
      setActiveScanRootRefresh(null);
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
      await refreshUnprocessableVideoCandidates();
      return true;
    } catch (error) {
      setScanRootsStatusMessage(errorMessage(error));
      return false;
    }
  }

  async function refreshSelectedScanRoot(scanRoot: ScanRoot) {
    try {
      setActiveScanRootRefresh(startingScanRootRefreshProgress(scanRoot.path));
      setScanRootsStatusMessage(scanRootRefreshStartedMessage);
      await startScanRootRefreshJob(scanRoot.path);
    } catch (error) {
      setActiveScanRootRefresh(null);
      setScanRootsStatusMessage(errorMessage(error));
    }
  }

  async function cancelSelectedScanRootRefresh(scanRoot: ScanRoot) {
    try {
      await cancelScanRootRefreshJob(scanRoot.path);
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

  return {
    activeScanRootRefresh,
    cancelSelectedScanRootRefresh,
    checkSelectedScanRootAvailability,
    chooseScanRootFolder,
    refreshScanRoots,
    refreshUnprocessableVideoCandidates,
    refreshSelectedScanRoot,
    removeSelectedScanRoot,
    saveScanRootInferenceRules,
    scanRoots,
    scanRootsStatusMessage,
    unprocessableVideoCandidateGroups,
  };
}

function scanRootRefreshProgressMessage(progress: ScanRootRefreshJobProgress) {
  if (progress.message) {
    return progress.message;
  }

  return `${scanRootRefreshStatusLabel(progress.status)}: ${videoCandidateProgressLabel(progress)}`;
}

function scanRootRefreshStatusLabel(status: ScanRootRefreshJobProgress["status"]) {
  const labels: Record<ScanRootRefreshJobProgress["status"], string> = {
    cancelled: "Cancelled",
    complete: "Complete",
    discovery: "Discovering",
    failed: "Failed",
    metadataSuggestionUpdate: "Updating Metadata Suggestions",
    scanning: "Scanning",
  };

  return labels[status];
}

function videoCandidateProgressLabel(progress: ScanRootRefreshJobProgress) {
  if (progress.totalVideoCandidateCount === null) {
    return `${progress.processedVideoCandidateCount} video candidates processed`;
  }

  return `${progress.processedVideoCandidateCount} of ${progress.totalVideoCandidateCount} video candidates processed`;
}

function isFinishedScanRootRefresh(status: ScanRootRefreshJobProgress["status"]) {
  return status === "complete" || status === "cancelled" || status === "failed";
}

function startingScanRootRefreshProgress(
  scanRootPath: string,
): ScanRootRefreshJobProgress {
  return {
    scanRootPath,
    status: "discovery",
    processedVideoCandidateCount: 0,
    totalVideoCandidateCount: null,
    scannedVideoCount: 0,
    unprocessableCandidateCount: 0,
    message: null,
  };
}

export type { ScanRoot, ScanRootRemovalPolicy };
