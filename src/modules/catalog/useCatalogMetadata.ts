import { useEffect, useState } from "react";

import type {
  AcceptMetadataSuggestionForVideosRequest,
  CatalogPerformer,
  CatalogTag,
  CatalogVideo,
  RejectMetadataSuggestionSourceRequest,
} from "../../tauriCommands";
import {
  acceptMetadataSuggestionForVideos,
  attachPerformerToVideo,
  attachTagToVideo,
  createPerformer,
  createTag,
  detachPerformerFromVideo,
  detachTagFromVideo,
  listPerformers,
  listTags,
  performersForVideo,
  rejectMetadataSuggestionSource,
  tagsForVideo,
} from "../../tauriCommands";
import type { CatalogVideoMetadata } from "./catalogTypes";

export function useCatalogMetadata({
  catalogVideos,
}: {
  catalogVideos: CatalogVideo[];
}) {
  const [availableTags, setAvailableTags] = useState<CatalogTag[]>([]);
  const [availablePerformers, setAvailablePerformers] = useState<
    CatalogPerformer[]
  >([]);
  const [catalogVideoMetadataById, setCatalogVideoMetadataById] = useState<
    Record<number, CatalogVideoMetadata>
  >({});

  useEffect(() => {
    let canUpdateMetadata = true;

    async function loadMetadata() {
      try {
        const [storedTags, storedPerformers] = await Promise.all([
          listTags(),
          listPerformers(),
        ]);

        if (canUpdateMetadata) {
          setAvailableTags(storedTags);
          setAvailablePerformers(storedPerformers);
        }
      } catch {
        if (canUpdateMetadata) {
          setAvailableTags([]);
          setAvailablePerformers([]);
        }
      }
    }

    void loadMetadata();

    return () => {
      canUpdateMetadata = false;
    };
  }, []);

  useEffect(() => {
    let canUpdateCatalogVideoMetadata = true;

    async function loadCatalogVideoMetadata() {
      const metadataEntries = await Promise.all(
        catalogVideos.map(async (catalogVideo) => {
          const [videoTags, videoPerformers] = await Promise.all([
            tagsForVideo(catalogVideo.id),
            performersForVideo(catalogVideo.id),
          ]);

          return [
            catalogVideo.id,
            { tags: videoTags, performers: videoPerformers },
          ] as const;
        }),
      );

      if (canUpdateCatalogVideoMetadata) {
        setCatalogVideoMetadataById(Object.fromEntries(metadataEntries));
      }
    }

    if (catalogVideos.length === 0) {
      setCatalogVideoMetadataById({});
      return () => {
        canUpdateCatalogVideoMetadata = false;
      };
    }

    void loadCatalogVideoMetadata();

    return () => {
      canUpdateCatalogVideoMetadata = false;
    };
  }, [catalogVideos]);

  async function refreshAvailableMetadata() {
    const [storedTags, storedPerformers] = await Promise.all([
      listTags(),
      listPerformers(),
    ]);

    setAvailableTags(storedTags);
    setAvailablePerformers(storedPerformers);
  }

  return {
    acceptMetadataSuggestionForVideos,
    attachPerformerToVideo,
    attachTagToVideo,
    availablePerformers,
    availableTags,
    catalogVideoMetadataById,
    createPerformer,
    createTag,
    detachPerformerFromVideo,
    detachTagFromVideo,
    listPerformers,
    listTags,
    performersForVideo,
    refreshAvailableMetadata,
    rejectMetadataSuggestionSource,
    setAvailablePerformers,
    setAvailableTags,
    setCatalogVideoMetadataById,
    tagsForVideo,
  };
}

export type {
  AcceptMetadataSuggestionForVideosRequest,
  CatalogPerformer,
  CatalogTag,
  CatalogVideo,
  RejectMetadataSuggestionSourceRequest,
};
