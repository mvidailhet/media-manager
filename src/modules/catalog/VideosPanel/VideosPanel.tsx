import { useRef } from "react";
import type { UIEvent } from "react";
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
import { incrementalVideoResultLoadThresholdPixels } from "./useVideosPanelController";
import styles from "./VideosPanel.module.css";

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
  onExposeNextCatalogVideoBatch,
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
  onExposeNextCatalogVideoBatch: () => void;
  onReplaceSelectedVideos: (videoIds: number[]) => void;
  onSetFavorite: (catalogVideo: CatalogVideo, isFavorite: boolean) => void;
  onSelectVideo: (
    catalogVideo: CatalogVideo,
    modifiers: VideoSelectionModifiers,
  ) => void;
  selectedDetailVideoId: number | null;
  selectedVideoIds: number[];
}) {
  const videosViewElement = useRef<HTMLElement | null>(null);

  function changeCatalogVideoFilters(filters: CatalogVideoFilters) {
    scrollVideosViewToTop();
    onCatalogVideoFiltersChange(filters);
  }

  function changeCatalogVideoSort(sort: CatalogVideoSort) {
    scrollVideosViewToTop();
    onCatalogVideoSortChange(sort);
  }

  function exposeNextCatalogVideoBatchNearEnd(
    event: UIEvent<HTMLElement>,
  ) {
    const videosView = event.currentTarget;
    const remainingScrollPixels =
      videosView.scrollHeight - videosView.scrollTop - videosView.clientHeight;

    if (remainingScrollPixels > incrementalVideoResultLoadThresholdPixels) {
      return;
    }

    onExposeNextCatalogVideoBatch();
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
      onScroll={exposeNextCatalogVideoBatchNearEnd}
      p="md"
      ref={videosViewElement}
    >
      <Stack gap="md">
        <FiltersPanel
          availablePerformers={availablePerformers}
          availableTags={availableTags}
          filters={catalogVideoFilters}
          onFiltersChange={changeCatalogVideoFilters}
        />

        <SortSelect
          catalogVideoSort={catalogVideoSort}
          onCatalogVideoSortChange={changeCatalogVideoSort}
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
