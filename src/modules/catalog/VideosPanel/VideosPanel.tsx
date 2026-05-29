import { Box, Stack } from "@mantine/core";

import type { CatalogPerformer, CatalogTag, CatalogVideo, ScanRoot } from "../../../tauriCommands";
import type {
  CatalogVideoFilters,
  CatalogVideoMetadata,
  CatalogVideoSort,
} from "../catalogTypes";
import type { VideoSelectionModifiers } from "../useCatalogModuleController";
import { FiltersPanel } from "./components/FiltersPanel/FiltersPanel";
import { SortSelect } from "./components/SortSelect";
import { StatusMessages } from "./components/StatusMessages";
import { VideoGrid } from "./components/VideoGrid";
import styles from "./VideosPanel.module.css";

export function VideosPanel({
  allCatalogVideos,
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
  scanRoots,
  selectedVideoIds,
}: {
  allCatalogVideos: CatalogVideo[];
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
  onReplaceSelectedVideos: (
    videoIds: number[],
    modifiers: VideoSelectionModifiers,
  ) => void;
  onSetFavorite: (catalogVideo: CatalogVideo, isFavorite: boolean) => void;
  scanRoots: ScanRoot[];
  onSelectVideo: (
    catalogVideo: CatalogVideo,
    modifiers: VideoSelectionModifiers,
  ) => void;
  selectedDetailVideoId: number | null;
  selectedVideoIds: number[];
}) {
  const videoCountLabel =
    catalogVideos.length === 1 ? "1 Video" : `${catalogVideos.length} Videos`;

  return (
    <Box
      component="section"
      aria-label="Catalog Videos"
      className={styles.videosView}
      p="md"
    >
      <Stack gap="md">
        <FiltersPanel
          availablePerformers={availablePerformers}
          availableTags={availableTags}
          catalogVideoMetadataById={catalogVideoMetadataById}
          catalogVideos={allCatalogVideos}
          filters={catalogVideoFilters}
          onFiltersChange={onCatalogVideoFiltersChange}
          scanRoots={scanRoots}
        />

        <Box className={styles.videoListControls}>
          <Box c="dimmed" fw={500}>
            {videoCountLabel}
          </Box>

          <SortSelect
            catalogVideoSort={catalogVideoSort}
            onCatalogVideoSortChange={onCatalogVideoSortChange}
          />
        </Box>

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
