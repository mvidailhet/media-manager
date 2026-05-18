import { useState } from "react";
import {
  ActionIcon,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";

import type { ScanRoot, ScanRootRefreshJobProgress } from "../../../../tauriCommands";
import { AvailabilityBadge } from "../../../../shared/components/AvailabilityBadge";
import { WrappingCode } from "../../../../shared/components/WrappingCode";

export function ScanRootCard({
  activeScanRootRefresh,
  isScanRootRefreshRunning,
  onCancelScanRootRefresh,
  onRefreshSelectedScanRoot,
  onRequestScanRootRemoval,
  onSaveScanRootInferenceRules,
  scanRoot,
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
}) {
  const [areInferenceRulesOpen, setAreInferenceRulesOpen] = useState(false);
  const [suggestTagsFromChildFolders, setSuggestTagsFromChildFolders] =
    useState(scanRoot.inferenceRules.suggestTagsFromChildFolders);
  const [ignoredFolderNames, setIgnoredFolderNames] = useState(
    scanRoot.inferenceRules.ignoredFolderNames.join(", "),
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
  const cardScanRootRefresh =
    activeScanRootRefresh?.scanRootPath === scanRoot.path
      ? activeScanRootRefresh
      : null;
  const canCancelScanRootRefresh =
    cardScanRootRefresh !== null &&
    !["cancelled", "complete", "failed"].includes(cardScanRootRefresh.status);

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
              aria-label={`Refresh Scan Root ${scanRoot.path}`}
              onClick={() => void onRefreshSelectedScanRoot(scanRoot)}
              disabled={isScanRootRefreshRunning}
            >
              Refresh
            </Button>
            <Button
              type="button"
              size="xs"
              variant="light"
              color="red"
              onClick={() => onRequestScanRootRemoval(scanRoot)}
              disabled={isScanRootRefreshRunning}
            >
              Remove
            </Button>
          </Group>
        </Group>
        {cardScanRootRefresh ? (
          <Stack gap={2}>
            <Text fw={700}>{scanRootRefreshStatusLabel(cardScanRootRefresh.status)}</Text>
            <Text>{videoCandidateProgressLabel(cardScanRootRefresh)}</Text>
            <Text>{videoCountLabel(cardScanRootRefresh.scannedVideoCount)}</Text>
            <Text>{scanIssueCountLabel(cardScanRootRefresh.unprocessableCandidateCount)}</Text>
            {canCancelScanRootRefresh ? (
              <Button
                type="button"
                size="xs"
                variant="light"
                color="red"
                onClick={() => void onCancelScanRootRefresh(scanRoot)}
              >
                Cancel scan
              </Button>
            ) : null}
          </Stack>
        ) : null}
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
                    typeof value === "number" ? value : 1900,
                  )
                }
              />
              <NumberInput
                label="Ignored year end"
                size="sm"
                value={ignoredExactYearEnd}
                onChange={(value) =>
                  setIgnoredExactYearEnd(
                    typeof value === "number" ? value : 2099,
                  )
                }
              />
              <Button
                type="button"
                size="xs"
                onClick={saveInferenceRules}
                disabled={isScanRootRefreshRunning}
              >
                Save Inference Rules
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}

function scanRootRefreshStatusLabel(status: ScanRootRefreshJobProgress["status"]) {
  const labels: Record<ScanRootRefreshJobProgress["status"], string> = {
    cancelled: "Cancelled",
    complete: "Complete",
    discovery: "Discovery",
    failed: "Failed",
    metadataSuggestionUpdate: "Metadata suggestion update",
    scanning: "Scanning",
  };

  return labels[status];
}

function videoCandidateProgressLabel(progress: ScanRootRefreshJobProgress) {
  if (progress.totalVideoCandidateCount === null) {
    return `${progress.processedVideoCandidateCount} video candidates processed`;
  }

  return `${progress.processedVideoCandidateCount} of ${progress.totalVideoCandidateCount} video candidates processed`;
}

function videoCountLabel(scannedVideoCount: number) {
  return scannedVideoCount === 1
    ? "1 Video scanned"
    : `${scannedVideoCount} Videos scanned`;
}

function scanIssueCountLabel(unprocessableCandidateCount: number) {
  return unprocessableCandidateCount === 1
    ? "1 Scan Issue"
    : `${unprocessableCandidateCount} Scan Issues`;
}
