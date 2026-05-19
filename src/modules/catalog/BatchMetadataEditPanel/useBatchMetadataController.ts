import { useState } from "react";

import { uniqueMetadataValues } from "../../../shared/metadata/metadataHelpers";
import type { CatalogVideo } from "../../../tauriCommands";
import type { CatalogVideoMetadata } from "../catalogTypes";

export function useBatchMetadataController({
  catalogVideoMetadataById,
  catalogVideos,
}: {
  catalogVideoMetadataById: Record<number, CatalogVideoMetadata>;
  catalogVideos: CatalogVideo[];
}) {
  const [batchSelectedVideoIds, setBatchSelectedVideoIds] = useState<number[]>(
    [],
  );

  function setBatchVideoSelected(videoId: number, isSelected: boolean) {
    setBatchSelectedVideoIds((currentVideoIds) => {
      if (isSelected) {
        return currentVideoIds.includes(videoId)
          ? currentVideoIds
          : [...currentVideoIds, videoId];
      }

      return currentVideoIds.filter(
        (currentVideoId) => currentVideoId !== videoId,
      );
    });
  }

  function resetBatchSelection() {
    setBatchSelectedVideoIds([]);
  }

  const batchSelectedVideos = catalogVideos.filter((catalogVideo) =>
    batchSelectedVideoIds.includes(catalogVideo.id),
  );
  const batchSelectedVideoMetadata = batchSelectedVideos.map(
    (catalogVideo) => catalogVideoMetadataById[catalogVideo.id],
  );
  const batchRemovableTags = uniqueMetadataValues(
    batchSelectedVideoMetadata.flatMap((metadata) => metadata?.tags ?? []),
  );
  const batchRemovablePerformers = uniqueMetadataValues(
    batchSelectedVideoMetadata.flatMap(
      (metadata) => metadata?.performers ?? [],
    ),
  );

  return {
    batchRemovablePerformers,
    batchRemovableTags,
    batchSelectedVideoIds,
    batchSelectedVideos,
    resetBatchSelection,
    setBatchSelectedVideoIds,
    setBatchVideoSelected,
  };
}
