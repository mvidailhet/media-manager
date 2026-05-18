import { Box, Button, Group, Stack, Text } from "@mantine/core";

import type { ScanRoot } from "../../../tauriCommands";
import { SectionHeader } from "../../../shared/components/SectionHeader";
import { ScanRootCard } from "./components/ScanRootCard";

export function ScanRootsPanel({
  onChooseScanRootFolder,
  onRefreshEveryScanRoot,
  onRefreshSelectedScanRoot,
  onRequestScanRootRemoval,
  onSaveScanRootInferenceRules,
  scanRoots,
  scanRootsStatusMessage,
}: {
  onChooseScanRootFolder: () => void;
  onRefreshEveryScanRoot: () => void;
  onRefreshSelectedScanRoot: (scanRoot: ScanRoot) => void;
  onRequestScanRootRemoval: (scanRoot: ScanRoot) => void;
  onSaveScanRootInferenceRules: (
    scanRoot: ScanRoot,
    inferenceRules: ScanRoot["inferenceRules"],
  ) => void;
  scanRoots: ScanRoot[];
  scanRootsStatusMessage: string;
}) {
  return (
    <Box component="section" aria-label="Scan Root management" p="md" maw={760}>
      <Stack gap="md">
        <Group justify="space-between" align="start">
          <SectionHeader label="Catalog sources" title="Scan Roots" />
          <Group gap="xs">
            <Button
              type="button"
              variant="light"
              onClick={onChooseScanRootFolder}
            >
              Choose folder
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => void onRefreshEveryScanRoot()}
            >
              Refresh all Scan Roots
            </Button>
          </Group>
        </Group>

        {scanRootsStatusMessage ? <Text>{scanRootsStatusMessage}</Text> : null}

        {scanRoots.length > 0 ? (
          <Stack gap="sm">
            {scanRoots.map((scanRoot) => (
              <ScanRootCard
                key={scanRoot.path}
                onRefreshSelectedScanRoot={onRefreshSelectedScanRoot}
                onRequestScanRootRemoval={onRequestScanRootRemoval}
                onSaveScanRootInferenceRules={onSaveScanRootInferenceRules}
                scanRoot={scanRoot}
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
