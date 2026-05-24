import { useEffect, useMemo, useState } from "react";

import type { CatalogVideo } from "../../../tauriCommands";
import type { CatalogPerformer, CatalogTag } from "../../../tauriCommands";
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
  availablePerformers,
  availableTags,
}: {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
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
  const secretMetadataExists = useMemo(
    () =>
      availableTags.some((tag) => tag.isSecret) ||
      availablePerformers.some((performer) => performer.isSecret),
    [availablePerformers, availableTags],
  );

  const matchingCatalogVideos = useMemo(
    () =>
      sortedCatalogVideos(
        catalogVideos.filter((catalogVideo) =>
          catalogVideoMatchesFilters(
            catalogVideo,
            catalogVideoMetadataById[catalogVideo.id],
            catalogVideoFilters,
            secretMetadataExists,
          ),
        ),
        catalogVideoSort,
      ),
    [
      catalogVideoFilters,
      catalogVideoMetadataById,
      catalogVideoSort,
      catalogVideos,
      secretMetadataExists,
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
    setCatalogVideoFilters,
    setCatalogVideoSort,
  };
}
