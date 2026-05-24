import { useEffect, useState } from "react";

import type { CatalogVideo } from "../../tauriCommands";
import {
  forgetCatalogVideo,
  listCatalogVideos,
  moveCatalogVideoFileLocationToTrash,
  openCatalogVideo,
  openCatalogVideoContainingFolder,
  openPlaybackWindow,
  setVideoFavorite,
  updateVideoTitle,
} from "../../tauriCommands";

const catalogVideosLoadingMessage = "Loading Videos...";
const catalogVideosErrorMessage = "Videos unavailable";

export function useCatalogVideos() {
  const [catalogVideos, setCatalogVideos] = useState<CatalogVideo[]>([]);
  const [catalogVideosStatusMessage, setCatalogVideosStatusMessage] = useState(
    catalogVideosLoadingMessage,
  );
  const [catalogVideoActionStatusMessage, setCatalogVideoActionStatusMessage] =
    useState("");

  async function refreshCatalogVideos() {
    try {
      const storedCatalogVideos = await listCatalogVideos();

      setCatalogVideos(storedCatalogVideos);
      setCatalogVideosStatusMessage("");
      setCatalogVideoActionStatusMessage("");
      return storedCatalogVideos;
    } catch {
      setCatalogVideosStatusMessage(catalogVideosErrorMessage);
      return [];
    }
  }

  useEffect(() => {
    let canUpdateCatalogVideos = true;

    async function loadInitialCatalogVideos() {
      try {
        const storedCatalogVideos = await listCatalogVideos();

        if (canUpdateCatalogVideos) {
          setCatalogVideos(storedCatalogVideos);
          setCatalogVideosStatusMessage("");
        }
      } catch {
        if (canUpdateCatalogVideos) {
          setCatalogVideosStatusMessage(catalogVideosErrorMessage);
        }
      }
    }

    void loadInitialCatalogVideos();

    return () => {
      canUpdateCatalogVideos = false;
    };
  }, []);

  return {
    catalogVideoActionStatusMessage,
    catalogVideos,
    catalogVideosStatusMessage,
    forgetMissingVideo: forgetCatalogVideo,
    moveVideoFileLocationToTrash: moveCatalogVideoFileLocationToTrash,
    openVideo: openCatalogVideo,
    openVideoContainingFolder: openCatalogVideoContainingFolder,
    playVideoInApp: openPlaybackWindow,
    refreshCatalogVideos,
    renameVideo: updateVideoTitle,
    setCatalogVideoActionStatusMessage,
    setCatalogVideos,
    setVideoFavorited: setVideoFavorite,
  };
}

export type { CatalogVideo };
