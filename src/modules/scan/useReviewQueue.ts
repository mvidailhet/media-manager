import { useEffect, useState } from "react";

import type {
  FailedPreviewStrip,
  MetadataSuggestionGroup,
  PreviewStripQueueStatus,
  UnprocessableVideoCandidate,
} from "../../tauriCommands";
import {
  ignoreFailedPreviewStrip,
  listFailedPreviewStrips,
  listMetadataSuggestionGroups,
  listUnprocessableVideoCandidates,
  retryFailedPreviewStrip,
} from "../../tauriCommands";
import { errorMessage } from "../../shared/errors/errorMessage";

const reviewQueueLoadingMessage = "Loading Review Queue...";
const reviewQueueErrorMessage = "Review Queue unavailable";

export function useReviewQueue({
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
  const [failedPreviewStrips, setFailedPreviewStrips] = useState<
    FailedPreviewStrip[]
  >([]);
  const [metadataSuggestionGroups, setMetadataSuggestionGroups] = useState<
    MetadataSuggestionGroup[]
  >([]);
  const [reviewQueueStatusMessage, setReviewQueueStatusMessage] = useState(
    reviewQueueLoadingMessage,
  );

  async function refreshReviewQueue(shouldClearStatusMessage = true) {
    try {
      const [
        storedUnprocessableVideoCandidates,
        storedFailedPreviewStrips,
        storedMetadataSuggestionGroups,
      ] = await Promise.all([
        listUnprocessableVideoCandidates(),
        listFailedPreviewStrips(),
        listMetadataSuggestionGroups(),
      ]);

      setUnprocessableVideoCandidates(storedUnprocessableVideoCandidates);
      setFailedPreviewStrips(storedFailedPreviewStrips);
      setMetadataSuggestionGroups(storedMetadataSuggestionGroups);
      if (shouldClearStatusMessage) {
        setReviewQueueStatusMessage("");
      }
    } catch {
      setReviewQueueStatusMessage(reviewQueueErrorMessage);
    }
  }

  useEffect(() => {
    let canUpdateReviewQueue = true;

    async function loadInitialReviewQueue() {
      try {
        const [
          storedUnprocessableVideoCandidates,
          storedFailedPreviewStrips,
          storedMetadataSuggestionGroups,
        ] = await Promise.all([
          listUnprocessableVideoCandidates(),
          listFailedPreviewStrips(),
          listMetadataSuggestionGroups(),
        ]);

        if (canUpdateReviewQueue) {
          setUnprocessableVideoCandidates(storedUnprocessableVideoCandidates);
          setFailedPreviewStrips(storedFailedPreviewStrips);
          setMetadataSuggestionGroups(storedMetadataSuggestionGroups);
          setReviewQueueStatusMessage("");
        }
      } catch {
        if (canUpdateReviewQueue) {
          setReviewQueueStatusMessage(reviewQueueErrorMessage);
        }
      }
    }

    void loadInitialReviewQueue();

    return () => {
      canUpdateReviewQueue = false;
    };
  }, []);

  async function retryFailedPreview(failedPreviewStrip: FailedPreviewStrip) {
    try {
      const queueStatus = await retryFailedPreviewStrip(
        failedPreviewStrip.videoId,
      );

      setPreviewStripQueueStatus(queueStatus);
      setReviewQueueStatusMessage("");
      await refreshCatalogVideos();
      await refreshReviewQueue(false);
      await refreshPreviewStripQueueStatus();
    } catch (error) {
      setReviewQueueStatusMessage(errorMessage(error));
    }
  }

  async function ignoreFailedPreview(failedPreviewStrip: FailedPreviewStrip) {
    try {
      const queueStatus = await ignoreFailedPreviewStrip(
        failedPreviewStrip.videoId,
      );

      setPreviewStripQueueStatus(queueStatus);
      setReviewQueueStatusMessage("");
      await refreshReviewQueue(false);
    } catch (error) {
      setReviewQueueStatusMessage(errorMessage(error));
    }
  }

  return {
    failedPreviewStrips,
    ignoreFailedPreview,
    metadataSuggestionGroups,
    refreshReviewQueue,
    retryFailedPreview,
    reviewQueueStatusMessage,
    setReviewQueueStatusMessage,
    unprocessableVideoCandidates,
  };
}

export type {
  FailedPreviewStrip,
  MetadataSuggestionGroup,
  UnprocessableVideoCandidate,
};
