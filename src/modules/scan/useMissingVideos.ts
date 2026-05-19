import { useState } from "react";

const missingVideosWorkflowErrorMessage = "Missing Videos unavailable";

export function useMissingVideos({
  refreshCatalogVideos,
}: {
  refreshCatalogVideos: () => Promise<void>;
}) {
  const [missingVideosStatusMessage, setMissingVideosStatusMessage] =
    useState("");

  async function refreshMissingVideos(shouldClearStatusMessage = true) {
    try {
      await refreshCatalogVideos();

      if (shouldClearStatusMessage) {
        setMissingVideosStatusMessage("");
      }
    } catch {
      setMissingVideosStatusMessage(missingVideosWorkflowErrorMessage);
    }
  }

  return {
    refreshMissingVideos,
    missingVideosStatusMessage,
    setMissingVideosStatusMessage,
  };
}
