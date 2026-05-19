import { useEffect, useRef, useState } from "react";

import type {
  FailedPreviewStrip,
  PreviewStripQueueStatus,
} from "../../tauriCommands";
import {
  getPreviewStripQueueStatus,
  ignoreFailedPreviewStrip,
  listFailedPreviewStrips,
  pausePreviewStripQueue,
  processNextPreviewStripQueueItem,
  retryFailedPreviewStrip,
  resumePreviewStripQueue,
} from "../../tauriCommands";
import { errorMessage } from "../../shared/errors/errorMessage";

const previewStripQueueErrorMessage = "Preview Strip queue unavailable";
const previewStripQueuePollingIntervalMilliseconds = 250;

export function usePreviewGeneration({
  refreshCatalogVideos,
}: {
  refreshCatalogVideos: () => Promise<void>;
}) {
  const [failedPreviewStrips, setFailedPreviewStrips] = useState<
    FailedPreviewStrip[]
  >([]);
  const [previewStripStatusMessage, setPreviewStripStatusMessage] =
    useState("");
  const [previewStripQueueStatus, setPreviewStripQueueStatus] =
    useState<PreviewStripQueueStatus | null>(null);
  const latestRefreshCatalogVideos = useRef(refreshCatalogVideos);

  useEffect(() => {
    latestRefreshCatalogVideos.current = refreshCatalogVideos;
  }, [refreshCatalogVideos]);

  async function refreshFailedPreviewStrips() {
    setFailedPreviewStrips(await listFailedPreviewStrips());
  }

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
        const [queueStatus, storedFailedPreviewStrips] = await Promise.all([
          getPreviewStripQueueStatus(),
          listFailedPreviewStrips(),
        ]);

        if (canUpdatePreviewStripQueue) {
          setPreviewStripQueueStatus(queueStatus);
          setFailedPreviewStrips(storedFailedPreviewStrips);
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
          await latestRefreshCatalogVideos.current();
          await refreshFailedPreviewStrips();
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
  }, [previewStripQueueStatus]);

  async function pausePreviewStripQueueAction() {
    try {
      const queueStatus = await pausePreviewStripQueue();

      setPreviewStripQueueStatus(queueStatus);
      setPreviewStripStatusMessage("");
    } catch (error) {
      setPreviewStripStatusMessage(errorMessage(error));
    }
  }

  async function resumePreviewStripQueueAction() {
    try {
      const queueStatus = await resumePreviewStripQueue();

      setPreviewStripQueueStatus(queueStatus);
      setPreviewStripStatusMessage("");
    } catch (error) {
      setPreviewStripStatusMessage(errorMessage(error));
    }
  }

  async function retryFailedPreview(failedPreviewStrip: FailedPreviewStrip) {
    try {
      const queueStatus = await retryFailedPreviewStrip(
        failedPreviewStrip.videoId,
      );

      setPreviewStripQueueStatus(queueStatus);
      setPreviewStripStatusMessage("");
      await refreshCatalogVideos();
      await refreshFailedPreviewStrips();
      await refreshPreviewStripQueueStatus();
    } catch (error) {
      setPreviewStripStatusMessage(errorMessage(error));
    }
  }

  async function ignoreFailedPreview(failedPreviewStrip: FailedPreviewStrip) {
    try {
      const queueStatus = await ignoreFailedPreviewStrip(
        failedPreviewStrip.videoId,
      );

      setPreviewStripQueueStatus(queueStatus);
      setPreviewStripStatusMessage("");
      await refreshFailedPreviewStrips();
    } catch (error) {
      setPreviewStripStatusMessage(errorMessage(error));
    }
  }

  return {
    failedPreviewStrips,
    ignoreFailedPreview,
    pausePreviewStripQueueAction,
    previewStripQueueStatus,
    previewStripStatusMessage,
    refreshFailedPreviewStrips,
    refreshPreviewStripQueueStatus,
    resumePreviewStripQueueAction,
    retryFailedPreview,
    setPreviewStripQueueStatus,
  };
}
