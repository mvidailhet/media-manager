import { Badge, Group, Tabs } from "@mantine/core";

import type {
  CatalogVideo,
  FailedPreviewStrip,
  PreviewStripQueueStatus,
  ScanRootRefreshJobProgress,
  UnprocessableVideoCandidateGroup,
} from "../../tauriCommands";
import { PreviewGenerationView } from "./PreviewGenerationView/PreviewGenerationView";
import { ScanIssuesPanel } from "./ScanIssuesPanel/ScanIssuesPanel";
import { ScanRootsPanel } from "./ScanRootsPanel/ScanRootsPanel";
import type { ScanRoot } from "./useScanRoots";

export type ScanModuleProps = {
  failedPreviewStrips: FailedPreviewStrip[];
  generatedPreviewStripCount: number;
  generatingPreviewStripTitle?: string;
  missingVideos: CatalogVideo[];
  activeScanRootRefresh: ScanRootRefreshJobProgress | null;
  onCancelScanRootRefresh: (scanRoot: ScanRoot) => void;
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
  scanIssuesAttentionCount: number;
  scanIssuesStatusMessage: string;
  scanRoots: ScanRoot[];
  scanRootsStatusMessage: string;
  scanTab: string | null;
  unavailableScanRoots: ScanRoot[];
  unprocessableVideoCandidateGroups: UnprocessableVideoCandidateGroup[];
};

export const scanRootsTab = "scanRoots";
export const scanIssuesTab = "scanIssues";
export const previewGenerationTab = "previewGeneration";

export function ScanModule({
  failedPreviewStrips,
  generatedPreviewStripCount,
  generatingPreviewStripTitle,
  missingVideos,
  activeScanRootRefresh,
  onCancelScanRootRefresh,
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
  scanIssuesAttentionCount,
  scanIssuesStatusMessage,
  scanRoots,
  scanRootsStatusMessage,
  scanTab,
  unavailableScanRoots,
  unprocessableVideoCandidateGroups,
}: ScanModuleProps) {
  return (
    <Tabs value={scanTab} onChange={onScanTabChange} keepMounted={false}>
      <Tabs.List aria-label="Scan module tabs">
        <Tabs.Tab value={scanRootsTab}>Scan Roots</Tabs.Tab>
        <Tabs.Tab value={scanIssuesTab}>
          <Group gap={6}>
            <span>Scan Issues</span>
            {scanIssuesAttentionCount > 0 ? (
              <Badge size="sm" color="red">
                {scanIssuesAttentionCount}
              </Badge>
            ) : null}
          </Group>
        </Tabs.Tab>
        <Tabs.Tab value={previewGenerationTab}>
          <Group gap={6}>
            <span>Preview Generation</span>
            {previewGenerationAttentionCount > 0 ? (
              <Badge size="sm" color="red">
                {previewGenerationAttentionCount}
              </Badge>
            ) : null}
          </Group>
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value={scanRootsTab}>
        <ScanRootsPanel
          scanRoots={scanRoots}
          scanRootsStatusMessage={scanRootsStatusMessage}
          unprocessableVideoCandidateGroups={unprocessableVideoCandidateGroups}
          activeScanRootRefresh={activeScanRootRefresh}
          onCancelScanRootRefresh={onCancelScanRootRefresh}
          onChooseScanRootFolder={onChooseScanRootFolder}
          onRefreshSelectedScanRoot={onRefreshSelectedScanRoot}
          onRequestScanRootRemoval={onRequestScanRootRemoval}
          onSaveScanRootInferenceRules={onSaveScanRootInferenceRules}
        />
      </Tabs.Panel>

      <Tabs.Panel value={scanIssuesTab}>
        <ScanIssuesPanel
          missingVideos={missingVideos}
          scanIssuesStatusMessage={scanIssuesStatusMessage}
          unavailableScanRoots={unavailableScanRoots}
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
