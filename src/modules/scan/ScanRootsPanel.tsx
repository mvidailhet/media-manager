import { useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconSettings } from '@tabler/icons-react';

import type { ScanRoot } from '../../tauriCommands';
import { AvailabilityBadge } from '../../shared/components/AvailabilityBadge';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { WrappingCode } from '../../shared/components/WrappingCode';
import styles from './ScanRootsPanel.module.css';

export function ScanRootsPanel({
  manualScanRootPath,
  onAddManualScanRoot,
  onChooseScanRootFolder,
  onManualScanRootPathChange,
  onRefreshEveryScanRoot,
  onRefreshSelectedScanRoot,
  onRequestScanRootRemoval,
  onSaveScanRootInferenceRules,
  scanRoots,
  scanRootsStatusMessage,
}: {
  manualScanRootPath: string;
  onAddManualScanRoot: (event: React.FormEvent) => void;
  onChooseScanRootFolder: () => void;
  onManualScanRootPathChange: (path: string) => void;
  onRefreshEveryScanRoot: () => void;
  onRefreshSelectedScanRoot: (scanRoot: ScanRoot) => void;
  onRequestScanRootRemoval: (scanRoot: ScanRoot) => void;
  onSaveScanRootInferenceRules: (
    scanRoot: ScanRoot,
    inferenceRules: ScanRoot['inferenceRules'],
  ) => void;
  scanRoots: ScanRoot[];
  scanRootsStatusMessage: string;
}) {
  return (
    <Box component="section" aria-label="Scan Root management" p="md" maw={760}>
      <Stack gap="md">
        <Group justify="space-between" align="start">
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

        <Box component="form" onSubmit={onAddManualScanRoot}>
          <Group align="end">
            <TextInput
              className={styles.pathInput}
              label="Manual path"
              value={manualScanRootPath}
              onChange={(event) =>
                onManualScanRootPathChange(event.target.value)
              }
              placeholder="/Volumes/Archive/Videos"
            />
            <Button type="submit">Add path</Button>
          </Group>
        </Box>

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

export function ScanRootCard({
  onRefreshSelectedScanRoot,
  onRequestScanRootRemoval,
  onSaveScanRootInferenceRules,
  scanRoot,
}: {
  onRefreshSelectedScanRoot: (scanRoot: ScanRoot) => void;
  onRequestScanRootRemoval: (scanRoot: ScanRoot) => void;
  onSaveScanRootInferenceRules: (
    scanRoot: ScanRoot,
    inferenceRules: ScanRoot['inferenceRules'],
  ) => void;
  scanRoot: ScanRoot;
}) {
  const [areInferenceRulesOpen, setAreInferenceRulesOpen] = useState(false);
  const [suggestTagsFromChildFolders, setSuggestTagsFromChildFolders] =
    useState(scanRoot.inferenceRules.suggestTagsFromChildFolders);
  const [ignoredFolderNames, setIgnoredFolderNames] = useState(
    scanRoot.inferenceRules.ignoredFolderNames.join(', '),
  );
  const [ignoredExactYearStart, setIgnoredExactYearStart] = useState(
    scanRoot.inferenceRules.ignoredExactYearRange.startYear,
  );
  const [ignoredExactYearEnd, setIgnoredExactYearEnd] = useState(
    scanRoot.inferenceRules.ignoredExactYearRange.endYear,
  );
  const inferenceRulesButtonLabel = areInferenceRulesOpen
    ? `Hide Scan Root settings for ${scanRoot.path}`
    : `Show Scan Root settings for ${scanRoot.path}`;

  function saveInferenceRules() {
    onSaveScanRootInferenceRules(scanRoot, {
      ignoredExactYearRange: {
        endYear: ignoredExactYearEnd,
        startYear: ignoredExactYearStart,
      },
      ignoredFolderNames: ignoredFolderNames
        .split(',')
        .map((ignoredFolderName) => ignoredFolderName.trim())
        .filter((ignoredFolderName) => ignoredFolderName.length > 0),
      suggestTagsFromChildFolders,
    });
  }

  return (
    <Paper p="md">
      <Stack component="article" gap="xs">
        <Group gap="sm" justify="space-between">
          <Group gap="xs">
            <WrappingCode>{scanRoot.path}</WrappingCode>
            <AvailabilityBadge isAvailable={scanRoot.isAvailable} />
          </Group>
          <Group gap="xs">
            <ActionIcon
              aria-label={inferenceRulesButtonLabel}
              type="button"
              size="sm"
              variant="subtle"
              onClick={() =>
                setAreInferenceRulesOpen(
                  (currentAreInferenceRulesOpen) =>
                    !currentAreInferenceRulesOpen,
                )
              }
            >
              <IconSettings size={16} />
            </ActionIcon>
            <Button
              type="button"
              size="xs"
              variant="default"
              onClick={() => void onRefreshSelectedScanRoot(scanRoot)}
            >
              Refresh
            </Button>
            <Button
              type="button"
              size="xs"
              variant="light"
              color="red"
              onClick={() => onRequestScanRootRemoval(scanRoot)}
            >
              Remove
            </Button>
          </Group>
        </Group>
        {areInferenceRulesOpen ? (
          <Stack gap={4}>
            <Group align="end" gap="sm">
              <Checkbox
                checked={suggestTagsFromChildFolders}
                label="Suggest Tags"
                onChange={(event) =>
                  setSuggestTagsFromChildFolders(event.currentTarget.checked)
                }
              />
            </Group>
            <TextInput
              label="Ignored folder names"
              size="sm"
              value={ignoredFolderNames}
              onChange={(event) =>
                setIgnoredFolderNames(event.currentTarget.value)
              }
            />
            <Group align="end" gap="sm">
              <NumberInput
                label="Ignored year start"
                size="sm"
                value={ignoredExactYearStart}
                onChange={(value) =>
                  setIgnoredExactYearStart(
                    typeof value === 'number' ? value : 1900,
                  )
                }
              />
              <NumberInput
                label="Ignored year end"
                size="sm"
                value={ignoredExactYearEnd}
                onChange={(value) =>
                  setIgnoredExactYearEnd(
                    typeof value === 'number' ? value : 2099,
                  )
                }
              />
              <Button type="button" size="xs" onClick={saveInferenceRules}>
                Save Inference Rules
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}

