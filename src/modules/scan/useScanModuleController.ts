import { useState } from "react";

import type { CatalogVideo } from "../catalog/useCatalogModuleController";
import type { ScanProps } from "./Scan";
import { scanRootsTab } from "./scanTabs";
import { usePreviewGeneration } from "./usePreviewGeneration";
import { useMissingVideos } from "./useMissingVideos";
import type { ScanRoot, ScanRootRemovalPolicy } from "./useScanRoots";
import { useScanRoots } from "./useScanRoots";

type ScanController = {
  refreshMissingVideos: ReturnType<typeof useMissingVideos>["refreshMissingVideos"];
  removeSelectedScanRoot: ReturnType<
    typeof useScanRoots
  >["removeSelectedScanRoot"];
  scanAttentionCount: number;
  scanProps: ScanProps;
  setMissingVideosStatusMessage: ReturnType<
    typeof useMissingVideos
  >["setMissingVideosStatusMessage"];
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
}): ScanController {
  const [scanTab, setScanTab] = useState<string | null>(scanRootsTab);
  const missingVideosWorkflow = useMissingVideos({
    refreshCatalogVideos,
  });
  const previewGeneration = usePreviewGeneration({
    refreshCatalogVideos,
  });
  const scanRootsState = useScanRoots({
    refreshCatalogVideos,
    refreshPreviewStripQueueStatus:
      previewGeneration.refreshPreviewStripQueueStatus,
  });

  const unavailableScanRoots = scanRootsState.scanRoots.filter(
    (scanRoot) => !scanRoot.isAvailable,
  );
  const unprocessableVideoCandidateCount =
    scanRootsState.unprocessableVideoCandidateGroups.reduce(
      (candidateCount, candidateGroup) =>
        candidateCount + candidateGroup.candidateCount,
      0,
    );
  const scanRootsAttentionCount = unavailableScanRoots.length;
  const missingVideosAttentionCount = missingVideos.length;
  const previewGenerationAttentionCount =
    previewGeneration.failedPreviewStrips.length;
  const generatedPreviewStripCount = catalogVideos.filter(
    (catalogVideo) => catalogVideo.previewStrip.status === "generated",
  ).length;
  const generatingPreviewStripVideo = catalogVideos.find(
    (catalogVideo) =>
      catalogVideo.id === previewGeneration.previewStripQueueStatus?.runningVideoId,
  );
  const scanAttentionCount =
    scanRootsAttentionCount +
    missingVideosAttentionCount +
    unprocessableVideoCandidateCount +
    previewGenerationAttentionCount;

  return {
    refreshMissingVideos: missingVideosWorkflow.refreshMissingVideos,
    removeSelectedScanRoot: scanRootsState.removeSelectedScanRoot,
    scanAttentionCount,
    scanProps: {
      failedPreviewStrips: previewGeneration.failedPreviewStrips,
      generatedPreviewStripCount,
      generatingPreviewStripTitle: generatingPreviewStripVideo?.title,
      missingVideos,
      activeScanRootRefresh: scanRootsState.activeScanRootRefresh,
      onCancelScanRootRefresh: scanRootsState.cancelSelectedScanRootRefresh,
      onCheckScanRootAvailability: scanRootsState.checkSelectedScanRootAvailability,
      onChooseScanRootFolder: scanRootsState.chooseScanRootFolder,
      onIgnoreFailedPreview: previewGeneration.ignoreFailedPreview,
      onPausePreviewStripQueue: previewGeneration.pausePreviewStripQueueAction,
      onRefreshSelectedScanRoot: scanRootsState.refreshSelectedScanRoot,
      onRequestMissingVideoForget,
      onRequestScanRootRemoval,
      onResumePreviewStripQueue: previewGeneration.resumePreviewStripQueueAction,
      onRetryFailedPreview: previewGeneration.retryFailedPreview,
      onSaveScanRootInferenceRules: scanRootsState.saveScanRootInferenceRules,
      onScanTabChange: setScanTab,
      previewGenerationAttentionCount,
      previewStripQueueStatus: previewGeneration.previewStripQueueStatus,
      missingVideosAttentionCount,
      scanRootsAttentionCount,
      missingVideosStatusMessage: missingVideosWorkflow.missingVideosStatusMessage,
      scanRoots: scanRootsState.scanRoots,
      scanRootsStatusMessage: scanRootsState.scanRootsStatusMessage,
      scanTab,
      unprocessableVideoCandidateGroups:
        scanRootsState.unprocessableVideoCandidateGroups,
    },
    setMissingVideosStatusMessage: missingVideosWorkflow.setMissingVideosStatusMessage,
  };
}

export type { ScanRoot, ScanRootRemovalPolicy };
