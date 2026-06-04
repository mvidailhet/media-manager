import { Box, SimpleGrid, Stack } from "@mantine/core";

import type {
  FailedPreviewStrip,
  PreviewGenerationScopeBranch,
  PreviewStripQueueStatus,
} from "../../../tauriCommands";
import { SectionHeader } from "../../../shared/components/SectionHeader";
import { FailedPreviewStripsPanel } from "./components/FailedPreviewStripsPanel";
import { PreviewGenerationScopeTree } from "./components/PreviewGenerationScopeTree";
import { PreviewStripQueuePanel } from "./components/PreviewStripQueuePanel";

export function PreviewGenerationView({
  failedPreviewStrips,
  generatedPreviewStripCount,
  generatingPreviewStripTitle,
  onIgnoreFailedPreview,
  onPausePreviewStripQueue,
  onResumePreviewStripQueue,
  onRetryFailedPreview,
  onSelectedPreviewGenerationScopeBranchesChange,
  previewStripQueueStatus,
  selectedPreviewGenerationScopeBranches,
}: {
  failedPreviewStrips: FailedPreviewStrip[];
  generatedPreviewStripCount: number;
  generatingPreviewStripTitle?: string;
  onIgnoreFailedPreview: (failedPreviewStrip: FailedPreviewStrip) => void;
  onPausePreviewStripQueue: () => void;
  onResumePreviewStripQueue: () => void;
  onRetryFailedPreview: (failedPreviewStrip: FailedPreviewStrip) => void;
  onSelectedPreviewGenerationScopeBranchesChange: (
    selectedScopeBranches: PreviewGenerationScopeBranch[] | null,
  ) => void;
  previewStripQueueStatus: PreviewStripQueueStatus | null;
  selectedPreviewGenerationScopeBranches: PreviewGenerationScopeBranch[] | null;
}) {
  return (
    <Box component="section" aria-label="Preview Generation" p="md" maw={760}>
      <Stack gap="md">
        <SectionHeader label="Preview strips" title="Preview Generation" />
        <PreviewGenerationScopeTree
          selectedScopeBranches={selectedPreviewGenerationScopeBranches}
          onSelectedScopeBranchesChange={
            onSelectedPreviewGenerationScopeBranchesChange
          }
        />
        <PreviewStripQueuePanel
          generatedPreviewStripCount={generatedPreviewStripCount}
          generatingPreviewStripTitle={generatingPreviewStripTitle}
          onPausePreviewStripQueue={onPausePreviewStripQueue}
          onResumePreviewStripQueue={onResumePreviewStripQueue}
          previewStripQueueStatus={previewStripQueueStatus}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <FailedPreviewStripsPanel
            failedPreviewStrips={failedPreviewStrips}
            onIgnoreFailedPreview={onIgnoreFailedPreview}
            onRetryFailedPreview={onRetryFailedPreview}
          />
        </SimpleGrid>
      </Stack>
    </Box>
  );
}
