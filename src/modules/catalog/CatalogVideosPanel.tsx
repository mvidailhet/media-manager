import { Box, NativeSelect, Stack, Text } from "@mantine/core";

import type { CatalogPerformer, CatalogTag, CatalogVideo } from "../../tauriCommands";
import type {
  CatalogVideoFilters,
  CatalogVideoMetadata,
  CatalogVideoSort,
} from "./catalogTypes";
import { CatalogVideoCard } from "./CatalogVideosPanel/components/CatalogVideoCard";
import { CatalogVideoFiltersPanel } from "./CatalogVideosPanel/components/CatalogVideoFiltersPanel";
import styles from "./CatalogVideosPanel.module.css";

const catalogVideosEmptyMessage = "No Videos in the Catalog.";

export function CatalogVideosPanel({
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
        <CatalogVideoFiltersPanel
          availablePerformers={availablePerformers}
          availableTags={availableTags}
          filters={catalogVideoFilters}
          onFiltersChange={onCatalogVideoFiltersChange}
        />

        <Box ml="auto" w={180}>
          <NativeSelect
            aria-label="Sort Videos"
            size="xs"
            value={catalogVideoSort}
            data={[
              { value: "titleAscending", label: "Title" },
              { value: "fileSizeAscending", label: "File Size ascending" },
              { value: "fileSizeDescending", label: "File Size descending" },
              { value: "lastOpenedDescending", label: "Last Opened" },
              { value: "openCountDescending", label: "Open Count" },
            ]}
            onChange={(event) =>
              onCatalogVideoSortChange(
                event.currentTarget.value as CatalogVideoSort,
              )
            }
          />
        </Box>

        {catalogVideosStatusMessage ? (
          <Text>{catalogVideosStatusMessage}</Text>
        ) : null}
        {catalogVideoActionStatusMessage ? (
          <Text>{catalogVideoActionStatusMessage}</Text>
        ) : null}

        {!catalogVideosStatusMessage && catalogVideos.length === 0 ? (
          <Text c="dimmed">{catalogVideosEmptyMessage}</Text>
        ) : null}

        {catalogVideos.length > 0 ? (
          <Box className={styles.grid}>
            {catalogVideos.map((catalogVideo) => (
              <CatalogVideoCard
                catalogVideo={catalogVideo}
                catalogVideoMetadata={catalogVideoMetadataById[catalogVideo.id]}
                key={catalogVideo.id}
                onSelectVideo={onSelectVideo}
                onSetFavorite={onSetFavorite}
                onSetBatchVideoSelected={onSetBatchVideoSelected}
                isSelectedForBatch={selectedVideoIds.includes(catalogVideo.id)}
              />
            ))}
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}
