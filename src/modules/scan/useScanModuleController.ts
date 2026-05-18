import { useState } from "react";

import type { CatalogVideo } from "../catalog/useCatalogModuleController";
import type { ScanModuleProps } from "./ScanModule";
import { scanRootsTab } from "./ScanModule";
import { usePreviewGeneration } from "./usePreviewGeneration";
import { useScanIssues } from "./useScanIssues";
import type { ScanRoot, ScanRootRemovalPolicy } from "./useScanRoots";
import { useScanRoots } from "./useScanRoots";

type ScanModuleController = {
  metadataSuggestionGroups: ReturnType<
    typeof useScanIssues
  >["metadataSuggestionGroups"];
  refreshScanIssues: ReturnType<typeof useScanIssues>["refreshScanIssues"];
  removeSelectedScanRoot: ReturnType<
    typeof useScanRoots
  >["removeSelectedScanRoot"];
  scanAttentionCount: number;
  scanModuleProps: ScanModuleProps;
  setScanIssuesStatusMessage: ReturnType<
    typeof useScanIssues
  >["setScanIssuesStatusMessage"];
};

export function useScanModuleController({
  catalogVideos,
  missingVideos,
  refreshCatalogVideos,
  onRequestMissingVideoForget,
  onRequestScanRootRemoval,
}: {
  catalogVideos: CatalogVideo[];
  missingVideos: CatalogVideo[];
  refreshCatalogVideos: () => Promise<void>;
  onRequestMissingVideoForget: (catalogVideo: CatalogVideo) => void;
  onRequestScanRootRemoval: (scanRoot: ScanRoot) => void;
}): ScanModuleController {
  const [scanTab, setScanTab] = useState<string | null>(scanRootsTab);
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

  const unavailableScanRoots = scanRootsState.scanRoots.filter(
    (scanRoot) => !scanRoot.isAvailable,
  );
  const scanIssuesAttentionCount =
    missingVideos.length +
    unavailableScanRoots.length +
    scanIssues.unprocessableVideoCandidates.length;
  const previewGenerationAttentionCount = scanIssues.failedPreviewStrips.length;
  const generatedPreviewStripCount = catalogVideos.filter(
    (catalogVideo) => catalogVideo.previewStrip.status === "generated",
  ).length;
  const generatingPreviewStripVideo = catalogVideos.find(
    (catalogVideo) =>
      catalogVideo.id === previewGeneration.previewStripQueueStatus?.runningVideoId,
  );
  const scanAttentionCount =
    scanIssuesAttentionCount + previewGenerationAttentionCount;

  return {
    metadataSuggestionGroups: scanIssues.metadataSuggestionGroups,
    refreshScanIssues: scanIssues.refreshScanIssues,
    removeSelectedScanRoot: scanRootsState.removeSelectedScanRoot,
    scanAttentionCount,
    scanModuleProps: {
      failedPreviewStrips: scanIssues.failedPreviewStrips,
      generatedPreviewStripCount,
      generatingPreviewStripTitle: generatingPreviewStripVideo?.title,
      missingVideos,
      activeScanRootRefresh: scanRootsState.activeScanRootRefresh,
      onCancelScanRootRefresh: scanRootsState.cancelSelectedScanRootRefresh,
      onChooseScanRootFolder: scanRootsState.chooseScanRootFolder,
      onIgnoreFailedPreview: scanIssues.ignoreFailedPreview,
      onPausePreviewStripQueue: previewGeneration.pausePreviewStripQueueAction,
      onRefreshSelectedScanRoot: scanRootsState.refreshSelectedScanRoot,
      onRequestMissingVideoForget,
      onRequestScanRootRemoval,
      onResumePreviewStripQueue: previewGeneration.resumePreviewStripQueueAction,
      onRetryFailedPreview: scanIssues.retryFailedPreview,
      onSaveScanRootInferenceRules: scanRootsState.saveScanRootInferenceRules,
      onScanTabChange: setScanTab,
      previewGenerationAttentionCount,
      previewStripQueueStatus: previewGeneration.previewStripQueueStatus,
      scanIssuesAttentionCount,
      scanIssuesStatusMessage: scanIssues.scanIssuesStatusMessage,
      scanRoots: scanRootsState.scanRoots,
      scanRootsStatusMessage: scanRootsState.scanRootsStatusMessage,
      scanTab,
      unavailableScanRoots,
      unprocessableVideoCandidates: scanIssues.unprocessableVideoCandidates,
    },
    setScanIssuesStatusMessage: scanIssues.setScanIssuesStatusMessage,
  };
}

export type { ScanRoot, ScanRootRemovalPolicy };
