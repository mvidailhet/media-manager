import { useState } from "react";
import { Badge, Box, Button, Checkbox, Code, Group, NumberInput, Paper, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";

import type { ScanRoot } from "../../tauriCommands";
import { AvailabilityBadge } from "../../shared/components/AvailabilityBadge";
import { SectionHeader } from "../../shared/components/SectionHeader";

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
    inferenceRules: ScanRoot["inferenceRules"],
  ) => void;
  scanRoots: ScanRoot[];
  scanRootsStatusMessage: string;
}) {
  return (
    <Paper component="section" aria-label="Scan Roots" p="md" maw={760}>
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

        <Box component="form" onSubmit={onAddManualScanRoot}>
          <Group align="end">
            <TextInput
              className="path-input"
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
    </Paper>
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
    inferenceRules: ScanRoot["inferenceRules"],
  ) => void;
  scanRoot: ScanRoot;
}) {
  const [suggestTagsFromChildFolders, setSuggestTagsFromChildFolders] =
    useState(scanRoot.inferenceRules.suggestTagsFromChildFolders);
  const [
    suggestPerformersFromChildFolders,
    setSuggestPerformersFromChildFolders,
  ] = useState(scanRoot.inferenceRules.suggestPerformersFromChildFolders);
  const [ignoredFolderNames, setIgnoredFolderNames] = useState(
    scanRoot.inferenceRules.ignoredFolderNames.join(", "),
  );
  const [ignoredExactYearStart, setIgnoredExactYearStart] = useState(
    scanRoot.inferenceRules.ignoredExactYearRange.startYear,
  );
  const [ignoredExactYearEnd, setIgnoredExactYearEnd] = useState(
    scanRoot.inferenceRules.ignoredExactYearRange.endYear,
  );
  const tagInferenceLabel = scanRoot.inferenceRules.suggestTagsFromChildFolders
    ? "Tags from child folders"
    : "Tags not inferred";
  const performerInferenceLabel = scanRoot.inferenceRules
    .suggestPerformersFromChildFolders
    ? "Performers from child folders"
    : "Performers not inferred";
  const ignoredNamesLabel = `Ignored names: ${scanRoot.inferenceRules.ignoredFolderNames.join(
    ", ",
  )}`;
  const ignoredYearsLabel = `Ignored years: ${scanRoot.inferenceRules.ignoredExactYearRange.startYear}-${scanRoot.inferenceRules.ignoredExactYearRange.endYear}`;

  function saveInferenceRules() {
    onSaveScanRootInferenceRules(scanRoot, {
      ignoredExactYearRange: {
        endYear: ignoredExactYearEnd,
        startYear: ignoredExactYearStart,
      },
      ignoredFolderNames: ignoredFolderNames
        .split(",")
        .map((ignoredFolderName) => ignoredFolderName.trim())
        .filter((ignoredFolderName) => ignoredFolderName.length > 0),
      suggestPerformersFromChildFolders,
      suggestTagsFromChildFolders,
    });
  }

  return (
    <Stack component="article" gap="xs">
      <Group gap="sm" justify="space-between">
        <Group gap="xs">
          <Code className="wrapping-code">{scanRoot.path}</Code>
          <AvailabilityBadge isAvailable={scanRoot.isAvailable} />
        </Group>
        <Group gap="xs">
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
      <Stack gap={4}>
        <Group gap="xs">
          <Badge color="teal" variant="light">
            {tagInferenceLabel}
          </Badge>
          <Badge color="gray" variant="light">
            {performerInferenceLabel}
          </Badge>
        </Group>
        <Text size="sm">{ignoredNamesLabel}</Text>
        <Text size="sm">{ignoredYearsLabel}</Text>
        <Group align="end" gap="sm">
          <Checkbox
            checked={suggestTagsFromChildFolders}
            label="Suggest Tags"
            onChange={(event) =>
              setSuggestTagsFromChildFolders(event.currentTarget.checked)
            }
          />
          <Checkbox
            checked={suggestPerformersFromChildFolders}
            label="Suggest Performers"
            onChange={(event) =>
              setSuggestPerformersFromChildFolders(event.currentTarget.checked)
            }
          />
        </Group>
        <TextInput
          label="Ignored folder names"
          size="sm"
          value={ignoredFolderNames}
          onChange={(event) => setIgnoredFolderNames(event.currentTarget.value)}
        />
        <Group align="end" gap="sm">
          <NumberInput
            label="Ignored year start"
            size="sm"
            value={ignoredExactYearStart}
            onChange={(value) =>
              setIgnoredExactYearStart(typeof value === "number" ? value : 1900)
            }
          />
          <NumberInput
            label="Ignored year end"
            size="sm"
            value={ignoredExactYearEnd}
            onChange={(value) =>
              setIgnoredExactYearEnd(typeof value === "number" ? value : 2099)
            }
          />
          <Button type="button" size="xs" onClick={saveInferenceRules}>
            Save Inference Rules
          </Button>
        </Group>
      </Stack>
    </Stack>
  );
}
