import { Box, Stack } from "@mantine/core";

import type { CatalogPerformer, CatalogTag, CatalogVideo } from "../../../tauriCommands";
import type {
  CatalogVideoFilters,
  CatalogVideoMetadata,
  CatalogVideoSort,
} from "../catalogTypes";
import { FiltersPanel } from "./components/FiltersPanel";
import { SortSelect } from "./components/SortSelect";
import { StatusMessages } from "./components/StatusMessages";
import { VideoGrid } from "./components/VideoGrid";

export function VideosPanel({
  availablePerformers,
  availableTags,
  catalogVideoActionStatusMessage,
  catalogVideoFilters,
  catalogVideoMetadataById,
  catalogVideoSort,
  catalogVideos,
  catalogVideosStatusMessage,
  onCatalogVideoFiltersChange,
  onCatalogVideoSortChange,
  onSetFavorite,
  onSetBatchVideoSelected,
  onSelectVideo,
  selectedVideoIds,
}: {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  catalogVideoActionStatusMessage: string;
  catalogVideoFilters: CatalogVideoFilters;
  catalogVideoMetadataById: Record<number, CatalogVideoMetadata>;
  catalogVideoSort: CatalogVideoSort;
  catalogVideos: CatalogVideo[];
  catalogVideosStatusMessage: string;
  onCatalogVideoFiltersChange: (filters: CatalogVideoFilters) => void;
  onCatalogVideoSortChange: (sort: CatalogVideoSort) => void;
  onSetFavorite: (catalogVideo: CatalogVideo, isFavorite: boolean) => void;
  onSetBatchVideoSelected: (videoId: number, isSelected: boolean) => void;
  onSelectVideo: (catalogVideo: CatalogVideo) => void;
  selectedVideoIds: number[];
}) {
  return (
    <Box component="section" aria-label="Catalog Videos" p="md">
      <Stack gap="md">
        <FiltersPanel
          availablePerformers={availablePerformers}
          availableTags={availableTags}
          filters={catalogVideoFilters}
          onFiltersChange={onCatalogVideoFiltersChange}
        />

        <SortSelect
          catalogVideoSort={catalogVideoSort}
          onCatalogVideoSortChange={onCatalogVideoSortChange}
        />

        <StatusMessages
          catalogVideoActionStatusMessage={catalogVideoActionStatusMessage}
          catalogVideos={catalogVideos}
          catalogVideosStatusMessage={catalogVideosStatusMessage}
        />

        <VideoGrid
          catalogVideoMetadataById={catalogVideoMetadataById}
          catalogVideos={catalogVideos}
          onSelectVideo={onSelectVideo}
          onSetFavorite={onSetFavorite}
          onSetBatchVideoSelected={onSetBatchVideoSelected}
          selectedVideoIds={selectedVideoIds}
        />
      </Stack>
    </Box>
  );
}
