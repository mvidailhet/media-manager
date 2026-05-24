import { Box, Button, Group, Stack, Text } from "@mantine/core";

import type {
  CatalogPerformer,
  CatalogTag,
  ScanRoot,
  ScanRootRefreshJobProgress,
  UnprocessableVideoCandidateGroup,
} from "../../../tauriCommands";
import { SectionHeader } from "../../../shared/components/SectionHeader";
import { RootCard } from "./components/RootCard";
import { SecretMetadataSection } from "./components/SecretMetadataSection";
import styles from "./RootsPanel.module.css";

export function RootsPanel({
  onChooseScanRootFolder,
  onCancelScanRootRefresh,
  onRefreshSelectedScanRoot,
  onRevealUnprocessableVideoCandidate,
  onRequestScanRootRemoval,
  onRequestUnprocessableVideoCandidateTrash,
  onSaveScanRootInferenceRules,
  onSecretPerformerStatusChange,
  onSecretTagStatusChange,
  scanRoots,
  scanRootsStatusMessage,
  unprocessableVideoCandidateGroups,
  activeScanRootRefresh,
  onCheckScanRootAvailability,
}: {
  activeScanRootRefresh: ScanRootRefreshJobProgress | null;
  onCancelScanRootRefresh: (scanRoot: ScanRoot) => void;
  onCheckScanRootAvailability: (scanRoot: ScanRoot) => void;
  onChooseScanRootFolder: () => void;
  onRefreshSelectedScanRoot: (scanRoot: ScanRoot) => void;
  onRevealUnprocessableVideoCandidate: (path: string) => void;
  onRequestScanRootRemoval: (scanRoot: ScanRoot) => void;
  onRequestUnprocessableVideoCandidateTrash: (path: string) => void;
  onSaveScanRootInferenceRules: (
    scanRoot: ScanRoot,
    inferenceRules: ScanRoot["inferenceRules"],
  ) => void;
  onSecretPerformerStatusChange: (performer: CatalogPerformer) => void;
  onSecretTagStatusChange: (tag: CatalogTag) => void;
  scanRoots: ScanRoot[];
  scanRootsStatusMessage: string;
  unprocessableVideoCandidateGroups: UnprocessableVideoCandidateGroup[];
}) {
  const isScanRootRefreshRunning =
    activeScanRootRefresh !== null &&
    !["cancelled", "complete", "failed"].includes(activeScanRootRefresh.status);

  return (
    <Box
      component="section"
      aria-label="Scan Root management"
      className={styles.rootsPanel}
      p="md"
      maw={760}
    >
      <Stack gap="md">
        <Group justify="space-between" align="start">
          <SectionHeader label="Catalog sources" title="Scan Roots" />
          <Group gap="xs">
            <Button
              type="button"
              variant="light"
              onClick={onChooseScanRootFolder}
              disabled={isScanRootRefreshRunning}
            >
              Choose folder
            </Button>
          </Group>
        </Group>

        {scanRootsStatusMessage ? <Text>{scanRootsStatusMessage}</Text> : null}

        <SecretMetadataSection
          onPerformerSecretStatusChange={onSecretPerformerStatusChange}
          onTagSecretStatusChange={onSecretTagStatusChange}
        />

        {scanRoots.length > 0 ? (
          <Stack gap="sm">
            {scanRoots.map((scanRoot) => (
              <RootCard
                key={scanRoot.path}
                activeScanRootRefresh={activeScanRootRefresh}
                isScanRootRefreshRunning={isScanRootRefreshRunning}
                onCancelScanRootRefresh={onCancelScanRootRefresh}
                onCheckScanRootAvailability={onCheckScanRootAvailability}
                onRefreshSelectedScanRoot={onRefreshSelectedScanRoot}
                onRevealUnprocessableVideoCandidate={
                  onRevealUnprocessableVideoCandidate
                }
                onRequestScanRootRemoval={onRequestScanRootRemoval}
                onRequestUnprocessableVideoCandidateTrash={
                  onRequestUnprocessableVideoCandidateTrash
                }
                onSaveScanRootInferenceRules={onSaveScanRootInferenceRules}
                scanRoot={scanRoot}
                unprocessableVideoCandidateGroup={unprocessableVideoCandidateGroups.find(
                  (candidateGroup) => candidateGroup.scanRootPath === scanRoot.path,
                )}
              />
            ))}
          </Stack>
        ) : (
          <Text c="dimmed">No Scan Roots added.</Text>
        )}
      </Stack>
    </Box>
  );
}
