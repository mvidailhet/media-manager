import { useState } from "react";
import { Paper, Stack } from "@mantine/core";

import type {
  ScanRoot,
  ScanRootRefreshJobProgress,
  UnprocessableVideoCandidateGroup,
} from "../../../../../tauriCommands";
import { Header } from "./components/Header";
import { InferenceRulesForm } from "./components/InferenceRulesForm";
import { RefreshProgress } from "./components/RefreshProgress";
import { UnprocessableCandidatesSection } from "./components/UnprocessableCandidatesSection";

export function RootCard({
  activeScanRootRefresh,
  isScanRootRefreshRunning,
  onCancelScanRootRefresh,
  onRefreshSelectedScanRoot,
  onRequestScanRootRemoval,
  onSaveScanRootInferenceRules,
  scanRoot,
  unprocessableVideoCandidateGroup,
}: {
  activeScanRootRefresh: ScanRootRefreshJobProgress | null;
  isScanRootRefreshRunning: boolean;
  onCancelScanRootRefresh: (scanRoot: ScanRoot) => void;
  onRefreshSelectedScanRoot: (scanRoot: ScanRoot) => void;
  onRequestScanRootRemoval: (scanRoot: ScanRoot) => void;
  onSaveScanRootInferenceRules: (
    scanRoot: ScanRoot,
    inferenceRules: ScanRoot["inferenceRules"],
  ) => void;
  scanRoot: ScanRoot;
  unprocessableVideoCandidateGroup?: UnprocessableVideoCandidateGroup;
}) {
  const [areInferenceRulesOpen, setAreInferenceRulesOpen] = useState(false);
  const rootRefresh =
    activeScanRootRefresh?.scanRootPath === scanRoot.path
      ? activeScanRootRefresh
      : null;

  return (
    <Paper p="md">
      <Stack component="article" gap="xs">
        <Header
          areInferenceRulesOpen={areInferenceRulesOpen}
          isScanRootRefreshRunning={isScanRootRefreshRunning}
          onRefreshSelectedRoot={onRefreshSelectedScanRoot}
          onRemoveRoot={onRequestScanRootRemoval}
          onToggleInferenceRules={() =>
            setAreInferenceRulesOpen(
              (currentAreInferenceRulesOpen) => !currentAreInferenceRulesOpen,
            )
          }
          scanRoot={scanRoot}
        />
        {rootRefresh ? (
          <RefreshProgress
            onCancelRefresh={onCancelScanRootRefresh}
            progress={rootRefresh}
            scanRoot={scanRoot}
          />
        ) : null}
        <UnprocessableCandidatesSection
          scanRoot={scanRoot}
          unprocessableVideoCandidateGroup={unprocessableVideoCandidateGroup}
        />
        {areInferenceRulesOpen ? (
          <InferenceRulesForm
            isScanRootRefreshRunning={isScanRootRefreshRunning}
            onSaveInferenceRules={onSaveScanRootInferenceRules}
            scanRoot={scanRoot}
          />
        ) : null}
      </Stack>
    </Paper>
  );
}
