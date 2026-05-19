import { useState } from "react";

import type { CatalogVideo } from "../../../tauriCommands";
import type {
  CatalogVideoFilters,
  CatalogVideoMetadata,
  CatalogVideoSort,
  CatalogVideoWorkspace,
} from "../catalogTypes";
import { defaultCatalogVideoFilters } from "../catalogTypes";
import {
  catalogVideoMatchesFilters,
  sortedCatalogVideos,
} from "../catalogVideoFiltering";

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
  const [catalogVideoWorkspace, setCatalogVideoWorkspace] =
    useState<CatalogVideoWorkspace>("videos");

  const activeCatalogVideoFilters =
    catalogVideoWorkspace === "favorites"
      ? { ...catalogVideoFilters, favoritesOnly: true }
      : catalogVideoFilters;
  const filteredCatalogVideos = sortedCatalogVideos(
    catalogVideos.filter((catalogVideo) =>
      catalogVideoMatchesFilters(
        catalogVideo,
        catalogVideoMetadataById[catalogVideo.id],
        activeCatalogVideoFilters,
      ),
    ),
    catalogVideoSort,
  );

  return {
    activeCatalogVideoFilters,
    catalogVideoSort,
    filteredCatalogVideos,
    setCatalogVideoFilters,
    setCatalogVideoSort,
    setCatalogVideoWorkspace,
  };
}
