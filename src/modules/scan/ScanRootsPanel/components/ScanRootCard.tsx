import { useState } from "react";
import {
  ActionIcon,
  Button,
  Checkbox,
  Divider,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";

import type {
  ScanRoot,
  ScanRootRefreshJobProgress,
  UnprocessableVideoCandidateGroup,
} from "../../../../tauriCommands";
import { AvailabilityBadge } from "../../../../shared/components/AvailabilityBadge";
import { DefinitionList } from "../../../../shared/components/DefinitionList";
import { DefinitionTerm } from "../../../../shared/components/DefinitionTerm";
import { WrappingCode } from "../../../../shared/components/WrappingCode";
import { formatFileSize } from "../../../../shared/formatting/videoFormatting";

const maximumDisplayedUnprocessableVideoCandidates = 20;

export function ScanRootCard({
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
  const [
    areUnprocessableVideoCandidatesOpen,
    setAreUnprocessableVideoCandidatesOpen,
  ] = useState(false);
  const [areAllUnprocessableVideosShown, setAreAllUnprocessableVideosShown] =
    useState(false);
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
    ["discovery", "scanning"].includes(cardScanRootRefresh.status);
  const unprocessableVideoCandidates =
    unprocessableVideoCandidateGroup?.candidates ?? [];
  const displayedUnprocessableVideoCandidates = areAllUnprocessableVideosShown
    ? unprocessableVideoCandidates
    : unprocessableVideoCandidates.slice(
        0,
        maximumDisplayedUnprocessableVideoCandidates,
      );
  const unprocessableVideoCandidateCount =
    unprocessableVideoCandidateGroup?.candidateCount ?? 0;
  const hasUnprocessableVideos = unprocessableVideoCandidateCount > 0;
  const areUnprocessableVideosTruncated =
    displayedUnprocessableVideoCandidates.length <
    unprocessableVideoCandidates.length;
  const unprocessableVideoCandidatesButtonLabel =
    areUnprocessableVideoCandidatesOpen
      ? `Hide Unprocessable videos for ${scanRoot.path}`
      : `Show Unprocessable videos for ${scanRoot.path}`;

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
        {hasUnprocessableVideos ? (
          <Group gap="xs">
            <Text>
              {unprocessableVideoCandidateCountLabel(unprocessableVideoCandidateCount)}
            </Text>
            <Button
              type="button"
              size="xs"
              variant="subtle"
              aria-label={unprocessableVideoCandidatesButtonLabel}
              onClick={() =>
                setAreUnprocessableVideoCandidatesOpen(
                  (currentAreUnprocessableVideoCandidatesOpen) =>
                    !currentAreUnprocessableVideoCandidatesOpen,
                )
              }
            >
              {areUnprocessableVideoCandidatesOpen ? "Hide" : "Show"}
            </Button>
          </Group>
        ) : null}
        {areUnprocessableVideoCandidatesOpen ? (
          <Stack gap="sm">
            {displayedUnprocessableVideoCandidates.map((candidate) => (
              <Stack component="article" gap="xs" key={candidate.path}>
                <Divider />
                <WrappingCode>
                  {relativeUnprocessableVideoPath(scanRoot.path, candidate.path)}
                </WrappingCode>
                <DefinitionList>
                  <DefinitionTerm label="Failure Reason">
                    {candidate.reason}
                  </DefinitionTerm>
                  <DefinitionTerm label="File Size">
                    {formatFileSize(candidate.fileSizeBytes)}
                  </DefinitionTerm>
                </DefinitionList>
              </Stack>
            ))}
            <Text c="dimmed">
              {displayedUnprocessableVideoCandidatesLabel(
                displayedUnprocessableVideoCandidates.length,
                unprocessableVideoCandidateCount,
              )}
            </Text>
            {areUnprocessableVideosTruncated ? (
              <Button
                type="button"
                size="xs"
                variant="subtle"
                onClick={() => setAreAllUnprocessableVideosShown(true)}
              >
                Show all
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

function unprocessableVideoCandidateCountLabel(candidateCount: number) {
  return candidateCount === 1
    ? "1 Unprocessable video"
    : `${candidateCount} Unprocessable videos`;
}

function displayedUnprocessableVideoCandidatesLabel(
  displayedCandidateCount: number,
  totalCandidateCount: number,
) {
  return `Showing ${displayedCandidateCount} of ${totalCandidateCount}`;
}

function relativeUnprocessableVideoPath(scanRootPath: string, candidatePath: string) {
  const scanRootWithTrailingSlash = pathWithTrailingSeparator(scanRootPath);

  if (!candidatePath.startsWith(scanRootWithTrailingSlash)) {
    return candidatePath;
  }

  return candidatePath.slice(scanRootWithTrailingSlash.length);
}

function pathWithTrailingSeparator(path: string) {
  return path.endsWith("/") || path.endsWith("\\") ? path : `${path}/`;
}
