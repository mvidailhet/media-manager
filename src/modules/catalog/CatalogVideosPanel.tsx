import { useState, type KeyboardEvent } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Badge, Box, Button, Checkbox, Group, NativeSelect, Paper, RangeSlider, Stack, Text, TextInput } from "@mantine/core";

import type { CatalogPerformer, CatalogTag, CatalogVideo } from "../../tauriCommands";
import { formatCompactFileSize, formatDuration } from "../../shared/formatting/videoFormatting";
import type {
  CatalogVideoFilters,
  CatalogVideoMetadata,
  CatalogVideoSort,
} from "./catalogTypes";

const catalogVideosEmptyMessage = "No Videos in the Catalog.";
const minimumDurationMinutes = 0;
const maximumDurationMinutes = 3 * 60;
const durationSliderStepMinutes = 5;
const firstPreviewStripFrameIndex = 0;
const previewStripPointerMinimum = 0;
const previewStripPointerMaximum = 1;
const percentageMultiplier = 100;

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
          <Box className="catalog-video-grid">
            {catalogVideos.map((catalogVideo) => (
              <CatalogVideoCard
                catalogVideo={catalogVideo}
                catalogVideoMetadata={catalogVideoMetadataById[catalogVideo.id]}
                key={catalogVideo.id}
                onSelectVideo={onSelectVideo}
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

export function CatalogVideoFiltersPanel({
  availablePerformers,
  availableTags,
  filters,
  onFiltersChange,
}: {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  filters: CatalogVideoFilters;
  onFiltersChange: (filters: CatalogVideoFilters) => void;
}) {
  const [advancedSearchOpened, setAdvancedSearchOpened] = useState(false);
  const durationRangeValue: [number, number] = [
    filters.minimumDurationMinutes === ""
      ? minimumDurationMinutes
      : filters.minimumDurationMinutes,
    filters.maximumDurationMinutes === ""
      ? maximumDurationMinutes
      : filters.maximumDurationMinutes,
  ];

  function updateFilters(updatedFilters: Partial<CatalogVideoFilters>) {
    onFiltersChange({ ...filters, ...updatedFilters });
  }

  return (
    <Stack gap="sm" aria-label="Video Search Filters">
      <TextInput
        aria-label="Search Videos"
        placeholder="Search Videos"
        value={filters.searchText}
        onChange={(event) =>
          updateFilters({ searchText: event.currentTarget.value })
        }
      />
      <Button
        type="button"
        variant="subtle"
        size="xs"
        px={0}
        w="fit-content"
        aria-expanded={advancedSearchOpened}
        onClick={() => setAdvancedSearchOpened((isOpened) => !isOpened)}
      >
        Advanced search
      </Button>
      {advancedSearchOpened ? (
        <Box>
          <Group justify="space-between" gap="sm" mb="xs">
            <Text size="sm" fw={500}>
              Duration
            </Text>
            <Text size="sm" c="dimmed">
              {formatDurationRange(durationRangeValue)}
            </Text>
          </Group>
          <RangeSlider
            min={minimumDurationMinutes}
            max={maximumDurationMinutes}
            step={durationSliderStepMinutes}
            value={durationRangeValue}
            label={formatDurationFilterValue}
            thumbFromLabel="Minimum duration"
            thumbToLabel="Maximum duration"
            onChange={([minimumDuration, maximumDuration]) =>
              updateFilters({
                minimumDurationMinutes: minimumDuration,
                maximumDurationMinutes: maximumDuration,
              })
            }
          />
        </Box>
      ) : null}
      {availableTags.length > 0 ? (
        <Checkbox.Group
          label="Tags"
          value={filters.selectedTagIds.map(String)}
          onChange={(selectedValues) =>
            updateFilters({ selectedTagIds: selectedValues.map(Number) })
          }
        >
          <Group gap="sm" mt="xs">
            {availableTags.map((tag) => (
              <Checkbox key={tag.id} value={String(tag.id)} label={tag.name} />
            ))}
          </Group>
        </Checkbox.Group>
      ) : null}
      {availablePerformers.length > 0 ? (
        <Checkbox.Group
          label="Performers"
          value={filters.selectedPerformerIds.map(String)}
          onChange={(selectedValues) =>
            updateFilters({ selectedPerformerIds: selectedValues.map(Number) })
          }
        >
          <Group gap="sm" mt="xs">
            {availablePerformers.map((performer) => (
              <Checkbox
                key={performer.id}
                value={String(performer.id)}
                label={performer.name}
              />
            ))}
          </Group>
        </Checkbox.Group>
      ) : null}
    </Stack>
  );
}

export function CatalogVideoCard({
  catalogVideo,
  catalogVideoMetadata,
  isSelectedForBatch,
  onSelectVideo,
  onSetBatchVideoSelected,
}: {
  catalogVideo: CatalogVideo;
  catalogVideoMetadata: CatalogVideoMetadata | undefined;
  isSelectedForBatch: boolean;
  onSelectVideo: (catalogVideo: CatalogVideo) => void;
  onSetBatchVideoSelected: (videoId: number, isSelected: boolean) => void;
}) {
  const tags = catalogVideoMetadata?.tags ?? [];
  const performers = catalogVideoMetadata?.performers ?? [];

  function selectCatalogVideo() {
    onSelectVideo(catalogVideo);
  }

  function selectCatalogVideoFromKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    selectCatalogVideo();
  }

  return (
    <Paper
      component="article"
      aria-label={catalogVideo.title}
      className="catalog-video-card"
      onClick={selectCatalogVideo}
      onKeyDown={selectCatalogVideoFromKeyboard}
      p="xs"
      tabIndex={0}
      withBorder
    >
      <Stack gap="xs">
        <Box className="catalog-video-preview">
          <PreviewStripSurface catalogVideo={catalogVideo} />
          <Box
            className="catalog-video-preview-badge catalog-video-batch-checkbox"
            onClick={(event) => event.stopPropagation()}
          >
            <Checkbox
              aria-label={`Select ${catalogVideo.title}`}
              checked={isSelectedForBatch}
              onChange={(event) =>
                onSetBatchVideoSelected(
                  catalogVideo.id,
                  event.currentTarget.checked,
                )
              }
            />
          </Box>
          {!catalogVideo.isAvailable ? (
            <Badge
              className="catalog-video-preview-badge catalog-video-unavailable-badge"
              color="red"
              variant="filled"
            >
              Unavailable
            </Badge>
          ) : null}
          <Badge
            className="catalog-video-preview-badge catalog-video-preview-pill catalog-video-file-size-badge"
            color="dark"
            variant="filled"
          >
            {formatCompactFileSize(catalogVideo.fileSizeBytes)}
          </Badge>
          <Badge
            className="catalog-video-preview-badge catalog-video-preview-pill catalog-video-duration-badge"
            color="dark"
            variant="filled"
          >
            {formatDuration(catalogVideo.durationMilliseconds)}
          </Badge>
        </Box>

        <Text className="catalog-video-title" fw={500}>
          {catalogVideo.title}
        </Text>

        <MetadataBadges label="Tags" items={tags} />
        <MetadataBadges label="Performers" items={performers} />

        <Group justify="space-between" gap="xs" wrap="nowrap">
          {catalogVideo.isFavorite ? (
            <Badge size="xs" color="yellow">
              Favorite
            </Badge>
          ) : null}
        </Group>
      </Stack>
    </Paper>
  );
}

function MetadataBadges<T extends { id: number; name: string }>({
  items,
  label,
}: {
  items: T[];
  label: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Group aria-label={label} gap={4}>
      {items.map((item) => (
        <Badge key={item.id} size="xs" variant="light">
          {item.name}
        </Badge>
      ))}
    </Group>
  );
}

export function PreviewStripSurface({
  catalogVideo,
}: {
  catalogVideo: CatalogVideo;
}) {
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(
    firstPreviewStripFrameIndex,
  );
  const previewStrip = catalogVideo.previewStrip;

  if (previewStrip.status === "generated") {
    const previewStripUrl = convertFileSrc(previewStrip.path);
    const framePosition = previewStripFramePosition(
      selectedFrameIndex,
      previewStrip.columnCount,
      previewStrip.rowCount,
    );

    return (
      <Box
        aria-label={`Preview Strip for ${catalogVideo.title}`}
        className="preview-strip preview-strip-generated"
        role="img"
        style={{
          backgroundImage: `url(${previewStripUrl})`,
          backgroundPosition: `${framePosition.x}% ${framePosition.y}%`,
          backgroundSize: `${previewStrip.columnCount * percentageMultiplier}% ${previewStrip.rowCount * percentageMultiplier}%`,
        }}
        onPointerLeave={() =>
          setSelectedFrameIndex(firstPreviewStripFrameIndex)
        }
        onPointerMove={(event) =>
          setSelectedFrameIndex(
            previewStripFrameIndexFromPointer(event, previewStrip.frameCount),
          )
        }
      />
    );
  }

  if (previewStrip.status === "failed") {
    return (
      <Box className="preview-strip preview-strip-placeholder">
        <Badge color="red" variant="light">
          Failed Preview Strip
        </Badge>
      </Box>
    );
  }

  return (
    <Box className="preview-strip preview-strip-placeholder">
      <Badge color="gray" variant="light">
        Pending Preview Strip
      </Badge>
    </Box>
  );
}

export function previewStripFrameIndexFromPointer(
  event: React.PointerEvent<HTMLElement>,
  frameCount: number,
) {
  const previewStripBounds = event.currentTarget.getBoundingClientRect();
  const pointerOffset = event.clientX - previewStripBounds.left;
  const pointerRatio = pointerOffset / previewStripBounds.width;
  const boundedPointerRatio = Math.min(
    previewStripPointerMaximum,
    Math.max(previewStripPointerMinimum, pointerRatio),
  );
  const lastFrameIndex = frameCount - 1;

  return Math.round(boundedPointerRatio * lastFrameIndex);
}

export function previewStripFramePosition(
  frameIndex: number,
  columnCount: number,
  rowCount: number,
) {
  const columnIndex = frameIndex % columnCount;
  const rowIndex = Math.floor(frameIndex / columnCount);
  const lastColumnIndex = Math.max(columnCount - 1, 1);
  const lastRowIndex = Math.max(rowCount - 1, 1);

  return {
    x: (columnIndex / lastColumnIndex) * percentageMultiplier,
    y: (rowIndex / lastRowIndex) * percentageMultiplier,
  };
}

export function formatDurationRange([minimumMinutes, maximumMinutes]: [
  number,
  number,
]) {
  return `${formatDurationFilterValue(minimumMinutes)} - ${formatDurationFilterValue(maximumMinutes)}`;
}

export function formatDurationFilterValue(minutes: number) {
  if (minutes === minimumDurationMinutes) {
    return "0m";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}
