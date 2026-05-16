import { useEffect, useState } from "react";

import type { PreviewStripQueueStatus } from "../../tauriCommands";
import {
  getPreviewStripQueueStatus,
  pausePreviewStripQueue,
  processNextPreviewStripQueueItem,
  resumePreviewStripQueue,
} from "../../tauriCommands";
import { errorMessage } from "../../shared/errors/errorMessage";

const previewStripQueueErrorMessage = "Preview Strip queue unavailable";
const previewStripQueuePollingIntervalMilliseconds = 250;

export function usePreviewGeneration({
  refreshCatalogVideos,
  refreshReviewQueue,
}: {
  refreshCatalogVideos: () => Promise<void>;
  refreshReviewQueue: () => Promise<void>;
}) {
  const [previewStripStatusMessage, setPreviewStripStatusMessage] =
    useState("");
  const [previewStripQueueStatus, setPreviewStripQueueStatus] =
    useState<PreviewStripQueueStatus | null>(null);

  async function refreshPreviewStripQueueStatus() {
    try {
      const queueStatus = await getPreviewStripQueueStatus();

      setPreviewStripQueueStatus(queueStatus);
    } catch {
      setPreviewStripStatusMessage(previewStripQueueErrorMessage);
    }
  }

  useEffect(() => {
    let canUpdatePreviewStripQueue = true;

    async function loadInitialPreviewStripQueueStatus() {
      try {
        const queueStatus = await getPreviewStripQueueStatus();

        if (canUpdatePreviewStripQueue) {
          setPreviewStripQueueStatus(queueStatus);
        }
      } catch {
        if (canUpdatePreviewStripQueue) {
          setPreviewStripStatusMessage(previewStripQueueErrorMessage);
        }
      }
    }

    void loadInitialPreviewStripQueueStatus();

    return () => {
      canUpdatePreviewStripQueue = false;
    };
  }, []);

  useEffect(() => {
    let canProcessQueue = true;

    async function processPreviewStripQueue() {
      if (
        !previewStripQueueStatus ||
        previewStripQueueStatus.isPaused ||
        previewStripQueueStatus.runningCount > 0 ||
        previewStripQueueStatus.pendingCount === 0
      ) {
        return;
      }

      try {
        const queueStatus = await processNextPreviewStripQueueItem();

        if (canProcessQueue) {
          setPreviewStripQueueStatus(queueStatus);
        }
      } catch (error) {
        if (canProcessQueue) {
          setPreviewStripStatusMessage(errorMessage(error));
        }
      }
    }

    void processPreviewStripQueue();

    return () => {
      canProcessQueue = false;
    };
  }, [previewStripQueueStatus]);

  useEffect(() => {
    if (
      !previewStripQueueStatus ||
      previewStripQueueStatus.runningCount === 0
    ) {
      return;
    }

    let canUpdatePreviewStripQueue = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        const queueStatus = await getPreviewStripQueueStatus();

        if (!canUpdatePreviewStripQueue) {
          return;
        }

        setPreviewStripQueueStatus(queueStatus);
        if (queueStatus.runningCount === 0) {
          await refreshCatalogVideos();
          await refreshReviewQueue();
        }
      } catch (error) {
        if (canUpdatePreviewStripQueue) {
          setPreviewStripStatusMessage(errorMessage(error));
        }
      }
    }, previewStripQueuePollingIntervalMilliseconds);

    return () => {
      canUpdatePreviewStripQueue = false;
      window.clearTimeout(timeoutId);
    };
  }, [previewStripQueueStatus, refreshCatalogVideos, refreshReviewQueue]);

  async function pausePreviewQueue() {
    try {
      const queueStatus = await pausePreviewStripQueue();

      setPreviewStripQueueStatus(queueStatus);
      setPreviewStripStatusMessage("");
    } catch (error) {
      setPreviewStripStatusMessage(errorMessage(error));
    }
  }

  async function resumePreviewQueue() {
    try {
      const queueStatus = await resumePreviewStripQueue();

      setPreviewStripQueueStatus(queueStatus);
      setPreviewStripStatusMessage("");
    } catch (error) {
      setPreviewStripStatusMessage(errorMessage(error));
    }
  }

  return {
    pausePreviewQueue,
    previewStripQueueStatus,
    previewStripStatusMessage,
    refreshPreviewStripQueueStatus,
    resumePreviewQueue,
    setPreviewStripQueueStatus,
  };
}
