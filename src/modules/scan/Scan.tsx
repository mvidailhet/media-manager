import { Tabs } from "@mantine/core";

import type {
  CatalogVideo,
  FailedPreviewStrip,
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

export type ScanProps = {
  failedPreviewStrips: FailedPreviewStrip[];
  generatedPreviewStripCount: number;
  generatingPreviewStripTitle?: string;
  missingVideos: CatalogVideo[];
  activeScanRootRefresh: ScanRootRefreshJobProgress | null;
  onCancelScanRootRefresh: (scanRoot: ScanRoot) => void;
  onCheckScanRootAvailability: (scanRoot: ScanRoot) => void;
  onChooseScanRootFolder: () => void;
  onIgnoreFailedPreview: (failedPreviewStrip: FailedPreviewStrip) => void;
  onPausePreviewStripQueue: () => void;
  onRefreshSelectedScanRoot: (scanRoot: ScanRoot) => void;
  onRequestMissingVideoForget: (catalogVideo: CatalogVideo) => void;
  onRequestScanRootRemoval: (scanRoot: ScanRoot) => void;
  onResumePreviewStripQueue: () => void;
  onRetryFailedPreview: (failedPreviewStrip: FailedPreviewStrip) => void;
  onSaveScanRootInferenceRules: (
    scanRoot: ScanRoot,
    inferenceRules: ScanRoot["inferenceRules"],
  ) => void;
  onScanTabChange: (scanTab: string | null) => void;
  previewGenerationAttentionCount: number;
  previewStripQueueStatus: PreviewStripQueueStatus | null;
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
  generatedPreviewStripCount,
  generatingPreviewStripTitle,
  missingVideos,
  activeScanRootRefresh,
  onCancelScanRootRefresh,
  onCheckScanRootAvailability,
  onChooseScanRootFolder,
  onIgnoreFailedPreview,
  onPausePreviewStripQueue,
  onRefreshSelectedScanRoot,
  onRequestMissingVideoForget,
  onRequestScanRootRemoval,
  onResumePreviewStripQueue,
  onRetryFailedPreview,
  onSaveScanRootInferenceRules,
  onScanTabChange,
  previewGenerationAttentionCount,
  previewStripQueueStatus,
  missingVideosAttentionCount,
  scanRootsAttentionCount,
  missingVideosStatusMessage,
  scanRoots,
  scanRootsStatusMessage,
  scanTab,
  unprocessableVideoCandidateGroups,
}: ScanProps) {
  return (
    <Tabs value={scanTab} onChange={onScanTabChange} keepMounted={false}>
      <TabsList
        previewGenerationAttentionCount={previewGenerationAttentionCount}
        scanRootsAttentionCount={scanRootsAttentionCount}
        missingVideosAttentionCount={missingVideosAttentionCount}
      />

      <Tabs.Panel value={scanRootsTab}>
        <RootsPanel
          scanRoots={scanRoots}
          scanRootsStatusMessage={scanRootsStatusMessage}
          unprocessableVideoCandidateGroups={unprocessableVideoCandidateGroups}
          activeScanRootRefresh={activeScanRootRefresh}
          onCancelScanRootRefresh={onCancelScanRootRefresh}
          onCheckScanRootAvailability={onCheckScanRootAvailability}
          onChooseScanRootFolder={onChooseScanRootFolder}
          onRefreshSelectedScanRoot={onRefreshSelectedScanRoot}
          onRequestScanRootRemoval={onRequestScanRootRemoval}
          onSaveScanRootInferenceRules={onSaveScanRootInferenceRules}
        />
      </Tabs.Panel>

      <Tabs.Panel value={missingVideosTab}>
        <MissingVideosPanel
          missingVideos={missingVideos}
          missingVideosStatusMessage={missingVideosStatusMessage}
          onRequestMissingVideoForget={onRequestMissingVideoForget}
        />
      </Tabs.Panel>

      <Tabs.Panel value={previewGenerationTab}>
        <PreviewGenerationView
          failedPreviewStrips={failedPreviewStrips}
          generatedPreviewStripCount={generatedPreviewStripCount}
          generatingPreviewStripTitle={generatingPreviewStripTitle}
          onIgnoreFailedPreview={onIgnoreFailedPreview}
          onPausePreviewStripQueue={onPausePreviewStripQueue}
          onResumePreviewStripQueue={onResumePreviewStripQueue}
          onRetryFailedPreview={onRetryFailedPreview}
          previewStripQueueStatus={previewStripQueueStatus}
        />
      </Tabs.Panel>
    </Tabs>
  );
}
