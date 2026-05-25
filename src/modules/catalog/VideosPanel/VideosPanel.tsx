import { useRef } from "react";
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
  onSelectVideo: (
    catalogVideo: CatalogVideo,
    modifiers: VideoSelectionModifiers,
  ) => void;
  selectedDetailVideoId: number | null;
  selectedVideoIds: number[];
}) {
  const videosViewElement = useRef<HTMLElement | null>(null);
  const videoCountLabel =
    catalogVideos.length === 1 ? "1 Video" : `${catalogVideos.length} Videos`;

  function changeCatalogVideoFilters(filters: CatalogVideoFilters) {
    scrollVideosViewToTop();
    onCatalogVideoFiltersChange(filters);
  }

  function changeCatalogVideoSort(sort: CatalogVideoSort) {
    scrollVideosViewToTop();
    onCatalogVideoSortChange(sort);
  }

  function scrollVideosViewToTop() {
    if (!videosViewElement.current) {
      return;
    }

    videosViewElement.current.scrollTop = 0;
  }

  return (
    <Box
      component="section"
      aria-label="Catalog Videos"
      className={styles.videosView}
      p="md"
      ref={videosViewElement}
    >
      <Stack gap="md">
        <FiltersPanel
          availablePerformers={availablePerformers}
          availableTags={availableTags}
          catalogVideoMetadataById={catalogVideoMetadataById}
          catalogVideos={allCatalogVideos}
          filters={catalogVideoFilters}
          onFiltersChange={changeCatalogVideoFilters}
        />

        <Box className={styles.videoListControls}>
          <Box c="dimmed" fw={500}>
            {videoCountLabel}
          </Box>

          <SortSelect
            catalogVideoSort={catalogVideoSort}
            onCatalogVideoSortChange={changeCatalogVideoSort}
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
