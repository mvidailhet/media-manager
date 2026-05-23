import { useEffect, useMemo, useState } from "react";

import type { CatalogVideo } from "../../../tauriCommands";
import type {
  CatalogVideoFilters,
  CatalogVideoMetadata,
  CatalogVideoSort,
} from "../catalogTypes";
import { defaultCatalogVideoFilters } from "../catalogTypes";
import {
  catalogVideoMatchesFilters,
  sortedCatalogVideos,
} from "../catalogVideoFiltering";

export const incrementalVideoResultBatchSize = 40;
export const incrementalVideoResultLoadThresholdPixels = 600;

export function useVideosPanelController({
  catalogVideoMetadataById,
  catalogVideos,
}: {
  catalogVideoMetadataById: Record<number, CatalogVideoMetadata>;
  catalogVideos: CatalogVideo[];
}) {
  const [catalogVideoFilters, setCatalogVideoFilters] =
    useState<CatalogVideoFilters>(defaultCatalogVideoFilters);
  const [catalogVideoSort, setCatalogVideoSort] =
    useState<CatalogVideoSort>("titleAscending");
  const [exposedCatalogVideoCount, setExposedCatalogVideoCount] = useState(
    incrementalVideoResultBatchSize,
  );

  const matchingCatalogVideos = useMemo(
    () =>
      sortedCatalogVideos(
        catalogVideos.filter((catalogVideo) =>
          catalogVideoMatchesFilters(
            catalogVideo,
            catalogVideoMetadataById[catalogVideo.id],
            catalogVideoFilters,
          ),
        ),
        catalogVideoSort,
      ),
    [
      catalogVideoFilters,
      catalogVideoMetadataById,
      catalogVideoSort,
      catalogVideos,
    ],
  );

  useEffect(() => {
    setExposedCatalogVideoCount(incrementalVideoResultBatchSize);
  }, [catalogVideoFilters, catalogVideoSort]);

  function exposeNextCatalogVideoBatch() {
    setExposedCatalogVideoCount((currentExposedCatalogVideoCount) =>
      Math.min(
        currentExposedCatalogVideoCount + incrementalVideoResultBatchSize,
        matchingCatalogVideos.length,
      ),
    );
  }

  const filteredCatalogVideos = matchingCatalogVideos.slice(
    0,
    exposedCatalogVideoCount,
  );
  const hasMoreFilteredCatalogVideos =
    exposedCatalogVideoCount < matchingCatalogVideos.length;

  return {
    catalogVideoFilters,
    catalogVideoSort,
    exposeNextCatalogVideoBatch,
    filteredCatalogVideos,
    hasMoreFilteredCatalogVideos,
    matchingCatalogVideos,
    setCatalogVideoFilters,
    setCatalogVideoSort,
  };
}
