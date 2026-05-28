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
  beginCatalogVideoMatchBreakdown,
  buildCatalogVideoFilterIndex,
  catalogVideoMatchesIndexedFilters,
  endCatalogVideoMatchBreakdown,
  sortedCatalogVideos,
} from "../catalogVideoFiltering";

const catalogFilterTimingDebugPrefix = "[DEBUG-catalog-filter-timing]";

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
    () => {
      const timingStart = performance.now();
      const filterIndex = buildCatalogVideoFilterIndex(
        catalogVideos,
        catalogVideoMetadataById,
      );

      logCatalogFilterTiming("buildCatalogVideoFilterIndex", timingStart, {
        videoCount: catalogVideos.length,
      });

      return filterIndex;
    },
    [catalogVideoMetadataById, catalogVideos],
  );
  const sortedVideos = useMemo(
    () => {
      const timingStart = performance.now();
      const videos = sortedCatalogVideos(catalogVideos, catalogVideoSort);

      logCatalogFilterTiming("sortedCatalogVideos", timingStart, {
        sort: catalogVideoSort,
        videoCount: catalogVideos.length,
      });

      return videos;
    },
    [catalogVideoSort, catalogVideos],
  );

  const matchingCatalogVideos = useMemo(
    () => {
      const timingStart = performance.now();
      beginCatalogVideoMatchBreakdown();
      const videos = sortedVideos.filter((catalogVideo) =>
        catalogVideoMatchesIndexedFilters(
          catalogVideoFilterIndex,
          catalogVideo,
          catalogVideoFilters,
          secretMetadataExists,
        ),
      );
      endCatalogVideoMatchBreakdown({
        matchedVideoCount: videos.length,
        selectedTagIds: catalogVideoFilters.selectedTagIds,
        sortedVideoCount: sortedVideos.length,
        withoutTagsOnly: catalogVideoFilters.withoutTagsOnly,
      });

      logCatalogFilterTiming("matchingCatalogVideos", timingStart, {
        matchedVideoCount: videos.length,
        selectedTagIds: catalogVideoFilters.selectedTagIds,
        sortedVideoCount: sortedVideos.length,
        withoutTagsOnly: catalogVideoFilters.withoutTagsOnly,
      });

      return videos;
    },
    [
      catalogVideoFilterIndex,
      catalogVideoFilters,
      secretMetadataExists,
      sortedVideos,
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

function logCatalogFilterTiming(
  label: string,
  timingStart: number,
  details: Record<string, unknown> = {},
) {
  console.info(
    `${catalogFilterTimingDebugPrefix} ${JSON.stringify({
      label,
      durationMs: Number((performance.now() - timingStart).toFixed(2)),
      ...details,
    })}`,
  );
}
