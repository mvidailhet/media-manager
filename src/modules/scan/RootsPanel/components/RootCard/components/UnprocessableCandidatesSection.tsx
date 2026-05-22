import { useState } from "react";
import { Button, Divider, Group, Stack, Text } from "@mantine/core";

import { MoveToTrashConfirmation } from "../../../../../../components/MoveToTrashConfirmation";
import type {
  ScanRoot,
  UnprocessableVideoCandidate,
  UnprocessableVideoCandidateGroup,
} from "../../../../../../tauriCommands";
import { DefinitionList } from "../../../../../../shared/components/DefinitionList";
import { DefinitionTerm } from "../../../../../../shared/components/DefinitionTerm";
import { WrappingCode } from "../../../../../../shared/components/WrappingCode";
import { formatFileSize } from "../../../../../../shared/formatting/videoFormatting";

const maximumDisplayedCandidates = 20;

export function UnprocessableCandidatesSection({
  onRevealCandidate,
  onRequestCandidateTrash,
  scanRoot,
  unprocessableVideoCandidateGroup,
}: {
  onRevealCandidate: (path: string) => void;
  onRequestCandidateTrash: (path: string) => void;
  scanRoot: ScanRoot;
  unprocessableVideoCandidateGroup?: UnprocessableVideoCandidateGroup;
}) {
  const [areCandidatesOpen, setAreCandidatesOpen] = useState(false);
  const [areAllCandidatesShown, setAreAllCandidatesShown] = useState(false);
  const [candidatePendingTrash, setCandidatePendingTrash] =
    useState<UnprocessableVideoCandidate | null>(null);
  const candidates = unprocessableVideoCandidateGroup?.candidates ?? [];
  const displayedCandidates = areAllCandidatesShown
    ? candidates
    : candidates.slice(0, maximumDisplayedCandidates);
  const candidateCount = unprocessableVideoCandidateGroup?.candidateCount ?? 0;
  const hasCandidates = candidateCount > 0;
  const areCandidatesTruncated = displayedCandidates.length < candidates.length;
  const candidatesButtonLabel = areCandidatesOpen
    ? `Hide Unprocessable videos for ${scanRoot.path}`
    : `Show Unprocessable videos for ${scanRoot.path}`;

  if (!hasCandidates) {
    return null;
  }

  function confirmMoveToTrash() {
    if (!candidatePendingTrash) {
      return;
    }

    onRequestCandidateTrash(candidatePendingTrash.path);
    setCandidatePendingTrash(null);
  }

  return (
    <>
      <Group gap="xs">
        <Text>{candidateCountLabel(candidateCount)}</Text>
        <Button
          type="button"
          size="xs"
          variant="subtle"
          aria-label={candidatesButtonLabel}
          onClick={() =>
            setAreCandidatesOpen(
              (currentAreCandidatesOpen) => !currentAreCandidatesOpen,
            )
          }
        >
          {areCandidatesOpen ? "Hide" : "Show"}
        </Button>
      </Group>
      {areCandidatesOpen ? (
        <Stack gap="sm">
          {displayedCandidates.map((candidate) => (
            <Stack component="article" gap="xs" key={candidate.path}>
              <Divider />
              <WrappingCode>
                {relativeCandidatePath(scanRoot.path, candidate.path)}
              </WrappingCode>
              <Group gap="xs">
                <Button
                  type="button"
                  size="xs"
                  variant="light"
                  aria-label={`Reveal ${candidate.path} in Finder`}
                  onClick={() => onRevealCandidate(candidate.path)}
                >
                  Reveal in Finder
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="light"
                  color="red"
                  aria-label={`Move ${candidate.path} to Trash`}
                  onClick={() => setCandidatePendingTrash(candidate)}
                >
                  Move to Trash
                </Button>
              </Group>
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
            {displayedCandidatesLabel(displayedCandidates.length, candidateCount)}
          </Text>
          {areCandidatesTruncated ? (
            <Button
              type="button"
              size="xs"
              variant="subtle"
              onClick={() => setAreAllCandidatesShown(true)}
            >
              Show all
            </Button>
          ) : null}
        </Stack>
      ) : null}
      <MoveToTrashConfirmation
        affectedFileLocations={candidatePendingTrash ? [candidatePendingTrash.path] : []}
        isOpen={candidatePendingTrash !== null}
        onCancel={() => setCandidatePendingTrash(null)}
        onConfirm={confirmMoveToTrash}
      />
    </>
  );
}

function candidateCountLabel(candidateCount: number) {
  return candidateCount === 1
    ? "1 Unprocessable video"
    : `${candidateCount} Unprocessable videos`;
}

function displayedCandidatesLabel(
  displayedCandidateCount: number,
  totalCandidateCount: number,
) {
  return `Showing ${displayedCandidateCount} of ${totalCandidateCount}`;
}

function relativeCandidatePath(scanRootPath: string, candidatePath: string) {
  const scanRootWithTrailingSlash = pathWithTrailingSeparator(scanRootPath);

  if (!candidatePath.startsWith(scanRootWithTrailingSlash)) {
    return candidatePath;
  }

  return candidatePath.slice(scanRootWithTrailingSlash.length);
}

function pathWithTrailingSeparator(path: string) {
  return path.endsWith("/") || path.endsWith("\\") ? path : `${path}/`;
}
