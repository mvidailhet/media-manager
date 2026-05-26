import { useMemo, useState } from "react";

import type { CatalogVideo } from "../../../tauriCommands";
import type { CatalogPerformer, CatalogTag } from "../../../tauriCommands";
import type {
  CatalogVideoFilters,
  CatalogVideoMetadata,
  CatalogVideoSort,
} from "../catalogTypes";
import { defaultCatalogVideoFilters } from "../catalogTypes";
import {
  buildCatalogVideoFilterIndex,
  catalogVideoMatchesIndexedFilters,
  sortedCatalogVideos,
} from "../catalogVideoFiltering";

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
  const secretMetadataExists = useMemo(
    () =>
      availableTags.some((tag) => tag.isSecret) ||
      availablePerformers.some((performer) => performer.isSecret),
    [availablePerformers, availableTags],
  );
  const catalogVideoFilterIndex = useMemo(
    () => buildCatalogVideoFilterIndex(catalogVideos, catalogVideoMetadataById),
    [catalogVideoMetadataById, catalogVideos],
  );

  const matchingCatalogVideos = useMemo(
    () =>
      sortedCatalogVideos(
        catalogVideos.filter((catalogVideo) =>
          catalogVideoMatchesIndexedFilters(
            catalogVideoFilterIndex,
            catalogVideo,
            catalogVideoFilters,
            secretMetadataExists,
          ),
        ),
        catalogVideoSort,
      ),
    [
      catalogVideoFilterIndex,
      catalogVideoFilters,
      catalogVideoSort,
      catalogVideos,
      secretMetadataExists,
    ],
  );

  return {
    catalogVideoFilters,
    catalogVideoSort,
    matchingCatalogVideos,
    setCatalogVideoFilters,
    setCatalogVideoSort,
  };
}
