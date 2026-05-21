import { Box, Stack } from "@mantine/core";

import type { CatalogPerformer, CatalogTag, CatalogVideo } from "../../../tauriCommands";
import type {
  CatalogVideoFilters,
  CatalogVideoMetadata,
  CatalogVideoSort,
} from "../catalogTypes";
import type { VideoSelectionModifiers } from "../useCatalogModuleController";
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
  onClearVideoSelection,
  onReplaceSelectedVideos,
  onSetFavorite,
  onSelectVideo,
  selectedDetailVideoId,
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
  onClearVideoSelection: () => void;
  onReplaceSelectedVideos: (videoIds: number[]) => void;
  onSetFavorite: (catalogVideo: CatalogVideo, isFavorite: boolean) => void;
  onSelectVideo: (
    catalogVideo: CatalogVideo,
    modifiers: VideoSelectionModifiers,
  ) => void;
  selectedDetailVideoId: number | null;
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
          onClearVideoSelection={onClearVideoSelection}
          onSelectVideo={onSelectVideo}
          onSetFavorite={onSetFavorite}
          onReplaceSelectedVideos={onReplaceSelectedVideos}
          selectedDetailVideoId={selectedDetailVideoId}
          selectedVideoIds={selectedVideoIds}
        />
      </Stack>
    </Box>
  );
}
