import { Badge, Group, Tabs } from "@mantine/core";

import type {
  CatalogVideo,
  FailedPreviewStrip,
  PreviewStripQueueStatus,
  UnprocessableVideoCandidate,
} from "../../tauriCommands";
import { PreviewGenerationView } from "./PreviewGenerationView";
import { ScanIssuesPanel } from "./ScanIssuesPanel";
import { ScanRootsPanel } from "./ScanRootsPanel";
import type { ScanRoot } from "./useScanRoots";

export type ScanModuleProps = {
  failedPreviewStrips: FailedPreviewStrip[];
  generatedPreviewStripCount: number;
  generatingPreviewStripTitle?: string;
  manualScanRootPath: string;
  missingVideos: CatalogVideo[];
  onAddManualScanRoot: (event: React.FormEvent) => void;
  onChooseScanRootFolder: () => void;
  onIgnoreFailedPreview: (failedPreviewStrip: FailedPreviewStrip) => void;
  onManualScanRootPathChange: (path: string) => void;
  onPausePreviewStripQueue: () => void;
  onRefreshEveryScanRoot: () => void;
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
  unprocessableVideoCandidates: UnprocessableVideoCandidate[];
};

export const scanRootsTab = "scanRoots";
export const scanIssuesTab = "scanIssues";
export const previewGenerationTab = "previewGeneration";

export function ScanModule({
  failedPreviewStrips,
  generatedPreviewStripCount,
  generatingPreviewStripTitle,
  manualScanRootPath,
  missingVideos,
  onAddManualScanRoot,
  onChooseScanRootFolder,
  onIgnoreFailedPreview,
  onManualScanRootPathChange,
  onPausePreviewStripQueue,
  onRefreshEveryScanRoot,
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
  unprocessableVideoCandidates,
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
          manualScanRootPath={manualScanRootPath}
          scanRoots={scanRoots}
          scanRootsStatusMessage={scanRootsStatusMessage}
          onAddManualScanRoot={onAddManualScanRoot}
          onChooseScanRootFolder={onChooseScanRootFolder}
          onManualScanRootPathChange={onManualScanRootPathChange}
          onRefreshEveryScanRoot={onRefreshEveryScanRoot}
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
          unprocessableVideoCandidates={unprocessableVideoCandidates}
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
