import { useEffect, useState } from "react";

import type {
  FailedPreviewStrip,
  MetadataSuggestionGroup,
  PreviewStripQueueStatus,
  UnprocessableVideoCandidate,
  UnprocessableVideoCandidateGroup,
} from "../../tauriCommands";
import {
  ignoreFailedPreviewStrip,
  listFailedPreviewStrips,
  listMetadataSuggestionGroups,
  listUnprocessableVideoCandidatesByScanRoot,
  retryFailedPreviewStrip,
} from "../../tauriCommands";
import { errorMessage } from "../../shared/errors/errorMessage";

const scanIssuesLoadingMessage = "Loading Scan Issues...";
const scanIssuesErrorMessage = "Scan Issues unavailable";

export function useScanIssues({
  refreshCatalogVideos,
  refreshPreviewStripQueueStatus,
  setPreviewStripQueueStatus,
}: {
  refreshCatalogVideos: () => Promise<void>;
  refreshPreviewStripQueueStatus: () => Promise<void>;
  setPreviewStripQueueStatus: React.Dispatch<
    React.SetStateAction<PreviewStripQueueStatus | null>
  >;
}) {
  const [unprocessableVideoCandidates, setUnprocessableVideoCandidates] =
    useState<UnprocessableVideoCandidate[]>([]);
  const [
    unprocessableVideoCandidateGroups,
    setUnprocessableVideoCandidateGroups,
  ] = useState<UnprocessableVideoCandidateGroup[]>([]);
  const [failedPreviewStrips, setFailedPreviewStrips] = useState<
    FailedPreviewStrip[]
  >([]);
  const [metadataSuggestionGroups, setMetadataSuggestionGroups] = useState<
    MetadataSuggestionGroup[]
  >([]);
  const [scanIssuesStatusMessage, setScanIssuesStatusMessage] = useState(
    scanIssuesLoadingMessage,
  );

  async function refreshScanIssues(shouldClearStatusMessage = true) {
    try {
      const [
        storedUnprocessableVideoCandidateGroups,
        storedFailedPreviewStrips,
        storedMetadataSuggestionGroups,
      ] = await Promise.all([
        listUnprocessableVideoCandidatesByScanRoot(),
        listFailedPreviewStrips(),
        listMetadataSuggestionGroups(),
      ]);

      setUnprocessableVideoCandidateGroups(storedUnprocessableVideoCandidateGroups);
      setUnprocessableVideoCandidates(
        unprocessableVideoCandidatesFromGroups(
          storedUnprocessableVideoCandidateGroups,
        ),
      );
      setFailedPreviewStrips(storedFailedPreviewStrips);
      setMetadataSuggestionGroups(storedMetadataSuggestionGroups);
      if (shouldClearStatusMessage) {
        setScanIssuesStatusMessage("");
      }
    } catch {
      setScanIssuesStatusMessage(scanIssuesErrorMessage);
    }
  }

  useEffect(() => {
    let canUpdateScanIssues = true;

    async function loadInitialScanIssues() {
      try {
        const [
          storedUnprocessableVideoCandidateGroups,
          storedFailedPreviewStrips,
          storedMetadataSuggestionGroups,
        ] = await Promise.all([
          listUnprocessableVideoCandidatesByScanRoot(),
          listFailedPreviewStrips(),
          listMetadataSuggestionGroups(),
        ]);

        if (canUpdateScanIssues) {
          setUnprocessableVideoCandidateGroups(
            storedUnprocessableVideoCandidateGroups,
          );
          setUnprocessableVideoCandidates(
            unprocessableVideoCandidatesFromGroups(
              storedUnprocessableVideoCandidateGroups,
            ),
          );
          setFailedPreviewStrips(storedFailedPreviewStrips);
          setMetadataSuggestionGroups(storedMetadataSuggestionGroups);
          setScanIssuesStatusMessage("");
        }
      } catch {
        if (canUpdateScanIssues) {
          setScanIssuesStatusMessage(scanIssuesErrorMessage);
        }
      }
    }

    void loadInitialScanIssues();

    return () => {
      canUpdateScanIssues = false;
    };
  }, []);

  async function retryFailedPreview(failedPreviewStrip: FailedPreviewStrip) {
    try {
      const queueStatus = await retryFailedPreviewStrip(
        failedPreviewStrip.videoId,
      );

      setPreviewStripQueueStatus(queueStatus);
      setScanIssuesStatusMessage("");
      await refreshCatalogVideos();
      await refreshScanIssues(false);
      await refreshPreviewStripQueueStatus();
    } catch (error) {
      setScanIssuesStatusMessage(errorMessage(error));
    }
  }

  async function ignoreFailedPreview(failedPreviewStrip: FailedPreviewStrip) {
    try {
      const queueStatus = await ignoreFailedPreviewStrip(
        failedPreviewStrip.videoId,
      );

      setPreviewStripQueueStatus(queueStatus);
      setScanIssuesStatusMessage("");
      await refreshScanIssues(false);
    } catch (error) {
      setScanIssuesStatusMessage(errorMessage(error));
    }
  }

  return {
    failedPreviewStrips,
    ignoreFailedPreview,
    metadataSuggestionGroups,
    refreshScanIssues,
    retryFailedPreview,
    scanIssuesStatusMessage,
    setScanIssuesStatusMessage,
    unprocessableVideoCandidateGroups,
    unprocessableVideoCandidates,
  };
}

export type {
  FailedPreviewStrip,
  MetadataSuggestionGroup,
  UnprocessableVideoCandidateGroup,
  UnprocessableVideoCandidate,
};

function unprocessableVideoCandidatesFromGroups(
  candidateGroups: UnprocessableVideoCandidateGroup[],
) {
  return candidateGroups.flatMap((candidateGroup) => candidateGroup.candidates);
}
