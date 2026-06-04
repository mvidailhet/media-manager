import { Tabs } from "@mantine/core";

import type {
  CatalogPerformer,
  CatalogTag,
  CatalogVideo,
  FailedPreviewStrip,
  PreviewGenerationScopeBranch,
  PreviewStripQueueStatus,
  ScanRootRefreshJobProgress,
  UnprocessableVideoCandidateGroup,
} from "../../tauriCommands";
import { PreviewGenerationView } from "./PreviewGenerationView/PreviewGenerationView";
import { RootsPanel } from "./RootsPanel";
import { MissingVideosPanel } from "./MissingVideosPanel/MissingVideosPanel";
import { TabsList } from "./components/TabsList";
import {
  previewGenerationTab,
  missingVideosTab,
  scanRootsTab,
} from "./scanTabs";
import type { ScanRoot } from "./useScanRoots";
import styles from "./Scan.module.css";

export type ScanProps = {
  failedPreviewStrips: FailedPreviewStrip[];
  generatingPreviewStripTitle?: string;
  missingVideos: CatalogVideo[];
  activeScanRootRefresh: ScanRootRefreshJobProgress | null;
  onCancelScanRootRefresh: (scanRoot: ScanRoot) => void;
  onCheckScanRootAvailability: (scanRoot: ScanRoot) => void;
  onChooseScanRootFolder: () => void;
  onIgnoreFailedPreview: (failedPreviewStrip: FailedPreviewStrip) => void;
  onPausePreviewStripQueue: () => void;
  onRefreshSelectedScanRoot: (scanRoot: ScanRoot) => void;
  onRevealUnprocessableVideoCandidate: (path: string) => void;
  onRequestMissingVideoForget: (catalogVideo: CatalogVideo) => void;
  onRequestScanRootRemoval: (scanRoot: ScanRoot) => void;
  onRequestUnprocessableVideoCandidateTrash: (path: string) => void;
  onResumePreviewStripQueue: () => void;
  onRetryFailedPreview: (failedPreviewStrip: FailedPreviewStrip) => void;
  onSaveScanRootInferenceRules: (
    scanRoot: ScanRoot,
    inferenceRules: ScanRoot["inferenceRules"],
  ) => void;
  onScanTabChange: (scanTab: string | null) => void;
  onSelectedPreviewGenerationScopeBranchesChange: (
    selectedScopeBranches: PreviewGenerationScopeBranch[] | null,
  ) => void;
  onSecretPerformerStatusChange: (performer: CatalogPerformer) => void;
  onSecretTagStatusChange: (tag: CatalogTag) => void;
  previewGenerationAttentionCount: number;
  previewStripQueueStatus: PreviewStripQueueStatus | null;
  selectedPreviewGenerationScopeBranches: PreviewGenerationScopeBranch[] | null;
  missingVideosAttentionCount: number;
  scanRootsAttentionCount: number;
  missingVideosStatusMessage: string;
  scanRoots: ScanRoot[];
  scanRootsStatusMessage: string;
  scanTab: string | null;
  unprocessableVideoCandidateGroups: UnprocessableVideoCandidateGroup[];
};

export function Scan({
  failedPreviewStrips,
  generatingPreviewStripTitle,
  missingVideos,
  activeScanRootRefresh,
  onCancelScanRootRefresh,
  onCheckScanRootAvailability,
  onChooseScanRootFolder,
  onIgnoreFailedPreview,
  onPausePreviewStripQueue,
  onRefreshSelectedScanRoot,
  onRevealUnprocessableVideoCandidate,
  onRequestMissingVideoForget,
  onRequestScanRootRemoval,
  onRequestUnprocessableVideoCandidateTrash,
  onResumePreviewStripQueue,
  onRetryFailedPreview,
  onSaveScanRootInferenceRules,
  onScanTabChange,
  onSelectedPreviewGenerationScopeBranchesChange,
  onSecretPerformerStatusChange,
  onSecretTagStatusChange,
  previewGenerationAttentionCount,
  previewStripQueueStatus,
  selectedPreviewGenerationScopeBranches,
  missingVideosAttentionCount,
  scanRootsAttentionCount,
  missingVideosStatusMessage,
  scanRoots,
  scanRootsStatusMessage,
  scanTab,
  unprocessableVideoCandidateGroups,
}: ScanProps) {
  return (
    <Tabs
      value={scanTab}
      onChange={onScanTabChange}
      keepMounted={false}
      className={styles.scanWorkspace}
    >
      <TabsList
        previewGenerationAttentionCount={previewGenerationAttentionCount}
        scanRootsAttentionCount={scanRootsAttentionCount}
        missingVideosAttentionCount={missingVideosAttentionCount}
      />

      <Tabs.Panel value={scanRootsTab} className={styles.scanPanel}>
        <RootsPanel
          scanRoots={scanRoots}
          scanRootsStatusMessage={scanRootsStatusMessage}
          unprocessableVideoCandidateGroups={unprocessableVideoCandidateGroups}
          activeScanRootRefresh={activeScanRootRefresh}
          onCancelScanRootRefresh={onCancelScanRootRefresh}
          onCheckScanRootAvailability={onCheckScanRootAvailability}
          onChooseScanRootFolder={onChooseScanRootFolder}
          onRefreshSelectedScanRoot={onRefreshSelectedScanRoot}
          onRevealUnprocessableVideoCandidate={onRevealUnprocessableVideoCandidate}
          onRequestScanRootRemoval={onRequestScanRootRemoval}
          onRequestUnprocessableVideoCandidateTrash={
            onRequestUnprocessableVideoCandidateTrash
          }
          onSaveScanRootInferenceRules={onSaveScanRootInferenceRules}
          onSecretPerformerStatusChange={onSecretPerformerStatusChange}
          onSecretTagStatusChange={onSecretTagStatusChange}
        />
      </Tabs.Panel>

      <Tabs.Panel value={missingVideosTab} className={styles.scanPanel}>
        <MissingVideosPanel
          missingVideos={missingVideos}
          missingVideosStatusMessage={missingVideosStatusMessage}
          onRequestMissingVideoForget={onRequestMissingVideoForget}
        />
      </Tabs.Panel>

      <Tabs.Panel value={previewGenerationTab} className={styles.scanPanel}>
        <PreviewGenerationView
          failedPreviewStrips={failedPreviewStrips}
          generatingPreviewStripTitle={generatingPreviewStripTitle}
          onIgnoreFailedPreview={onIgnoreFailedPreview}
          onPausePreviewStripQueue={onPausePreviewStripQueue}
          onResumePreviewStripQueue={onResumePreviewStripQueue}
          onRetryFailedPreview={onRetryFailedPreview}
          onSelectedPreviewGenerationScopeBranchesChange={
            onSelectedPreviewGenerationScopeBranchesChange
          }
          previewStripQueueStatus={previewStripQueueStatus}
          selectedPreviewGenerationScopeBranches={
            selectedPreviewGenerationScopeBranches
          }
        />
      </Tabs.Panel>
    </Tabs>
  );
}
