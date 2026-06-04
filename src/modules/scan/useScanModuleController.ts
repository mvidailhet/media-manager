import { useEffect, useState } from "react";

import type {
  PreviewGenerationScopeBranch,
  CatalogPerformer,
  CatalogTag,
} from "../../tauriCommands";
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

let rememberedPreviewGenerationScopeBranches:
  | PreviewGenerationScopeBranch[]
  | null
  | undefined;

export function resetRememberedPreviewGenerationScopeBranchesForTests() {
  rememberedPreviewGenerationScopeBranches = undefined;
}

export function useScanModuleController({
  catalogVideos,
  missingVideos,
  refreshCatalogVideos,
  refreshMetadataSuggestionGroups,
  onRequestMissingVideoForget,
  onRequestScanRootRemoval,
  recordPerformerSecretStatusChange,
  recordTagSecretStatusChange,
  selectedPreviewGenerationScopeBranches,
}: {
  catalogVideos: CatalogVideo[];
  missingVideos: CatalogVideo[];
  refreshCatalogVideos: () => Promise<unknown>;
  refreshMetadataSuggestionGroups: () => Promise<void>;
  onRequestMissingVideoForget: (catalogVideo: CatalogVideo) => void;
  onRequestScanRootRemoval: (scanRoot: ScanRoot) => void;
  recordPerformerSecretStatusChange: (performer: CatalogPerformer) => void;
  recordTagSecretStatusChange: (tag: CatalogTag) => void;
  selectedPreviewGenerationScopeBranches: PreviewGenerationScopeBranch[] | null;
}): ScanController {
  const [scanTab, setScanTab] = useState<string | null>(scanRootsTab);
  const [
    scanSelectedPreviewGenerationScopeBranches,
    setSelectedPreviewGenerationScopeBranches,
  ] = useState<PreviewGenerationScopeBranch[] | null>(
    rememberedPreviewGenerationScopeBranches ??
      selectedPreviewGenerationScopeBranches,
  );
  const [
    hasPreviewGenerationScopeTreeSelection,
    setHasPreviewGenerationScopeTreeSelection,
  ] = useState(false);
  const missingVideosWorkflow = useMissingVideos({
    refreshCatalogVideos,
  });
  const previewGeneration = usePreviewGeneration({
    refreshCatalogVideos,
    selectedScopeBranches: scanSelectedPreviewGenerationScopeBranches,
  });
  const scanRootsState = useScanRoots({
    refreshCatalogVideos,
    refreshMetadataSuggestionGroups,
    refreshPreviewStripQueueStatus:
      previewGeneration.refreshPreviewStripQueueStatus,
  });

  useEffect(() => {
    if (
      hasPreviewGenerationScopeTreeSelection ||
      rememberedPreviewGenerationScopeBranches !== undefined
    ) {
      return;
    }

    setSelectedPreviewGenerationScopeBranches(
      selectedPreviewGenerationScopeBranches,
    );
  }, [
    hasPreviewGenerationScopeTreeSelection,
    selectedPreviewGenerationScopeBranches,
  ]);

  function changeSelectedPreviewGenerationScopeBranches(
    selectedScopeBranches: PreviewGenerationScopeBranch[] | null,
  ) {
    rememberedPreviewGenerationScopeBranches = selectedScopeBranches;
    setHasPreviewGenerationScopeTreeSelection(true);
    setSelectedPreviewGenerationScopeBranches(selectedScopeBranches);
  }

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
      generatingPreviewStripTitle: generatingPreviewStripVideo?.title,
      missingVideos,
      activeScanRootRefresh: scanRootsState.activeScanRootRefresh,
      onCancelScanRootRefresh: scanRootsState.cancelSelectedScanRootRefresh,
      onCheckScanRootAvailability: scanRootsState.checkSelectedScanRootAvailability,
      onChooseScanRootFolder: scanRootsState.chooseScanRootFolder,
      onIgnoreFailedPreview: previewGeneration.ignoreFailedPreview,
      onPausePreviewStripQueue: previewGeneration.pausePreviewStripQueueAction,
      onRefreshSelectedScanRoot: scanRootsState.refreshSelectedScanRoot,
      onRevealUnprocessableVideoCandidate:
        scanRootsState.revealUnprocessableVideoCandidate,
      onRequestMissingVideoForget,
      onRequestScanRootRemoval,
      onSecretPerformerStatusChange: recordPerformerSecretStatusChange,
      onSecretTagStatusChange: recordTagSecretStatusChange,
      onRequestUnprocessableVideoCandidateTrash:
        scanRootsState.moveUnprocessableVideoCandidatePathToTrash,
      onResumePreviewStripQueue: previewGeneration.resumePreviewStripQueueAction,
      onRetryFailedPreview: previewGeneration.retryFailedPreview,
      onSaveScanRootInferenceRules: scanRootsState.saveScanRootInferenceRules,
      onScanTabChange: setScanTab,
      onSelectedPreviewGenerationScopeBranchesChange:
        changeSelectedPreviewGenerationScopeBranches,
      previewGenerationAttentionCount,
      previewStripQueueStatus: previewGeneration.previewStripQueueStatus,
      selectedPreviewGenerationScopeBranches:
        scanSelectedPreviewGenerationScopeBranches,
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
