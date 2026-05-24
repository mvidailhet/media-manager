import { useState } from "react";

import { uniqueMetadataValues } from "../../../../shared/metadata/metadataHelpers";
import type {
  CatalogPerformer,
  CatalogTag,
  CatalogVideo,
} from "../../../../tauriCommands";
import type { CatalogVideoMetadata } from "../../catalogTypes";
import type { BatchMetadataValue } from "./BatchEditPanel";

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
  const batchRemovableTags = countBatchMetadataValues(
    batchSelectedVideoMetadata.flatMap((metadata) => metadata?.tags ?? []),
  );
  const batchRemovablePerformers = countBatchMetadataValues(
    batchSelectedVideoMetadata.flatMap((metadata) => metadata?.performers ?? []),
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

function countBatchMetadataValues<
  TMetadata extends CatalogTag | CatalogPerformer,
>(metadataValues: TMetadata[]): BatchMetadataValue<TMetadata>[] {
  return uniqueMetadataValues(metadataValues).map((metadata) => ({
    metadata,
    selectedVideoCount: metadataValues.filter(
      (value) => value.id === metadata.id,
    ).length,
  }));
}
