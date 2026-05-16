import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Badge, Box, Button, Checkbox, Code, Divider, Group, NativeSelect, RangeSlider, Stack, Text, TextInput, Title } from "@mantine/core";

import type { CatalogPerformer, CatalogTag, CatalogVideo } from "../../tauriCommands";
import { AvailabilityBadge } from "../../shared/components/AvailabilityBadge";
import { DefinitionTerm } from "../../shared/components/DefinitionTerm";
import { formatDuration, formatFileSize, formatOpenHistory } from "../../shared/formatting/videoFormatting";
import type { CatalogVideoFilters, CatalogVideoSort, CatalogVideoWorkspace } from "./catalogTypes";

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
  catalogVideoWorkspace,
  catalogVideoSort,
  catalogVideos,
  catalogVideosStatusMessage,
  onCatalogVideoFiltersChange,
  onCatalogVideoSortChange,
  onOpenVideo,
  onSetBatchVideoSelected,
  onSelectVideo,
  onSetFavorite,
  selectedVideoIds,
}: {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  catalogVideoActionStatusMessage: string;
  catalogVideoFilters: CatalogVideoFilters;
  catalogVideoWorkspace: CatalogVideoWorkspace;
  catalogVideoSort: CatalogVideoSort;
  catalogVideos: CatalogVideo[];
  catalogVideosStatusMessage: string;
  onCatalogVideoFiltersChange: (filters: CatalogVideoFilters) => void;
  onCatalogVideoSortChange: (sort: CatalogVideoSort) => void;
  onOpenVideo: (catalogVideo: CatalogVideo) => void;
  onSetBatchVideoSelected: (videoId: number, isSelected: boolean) => void;
  onSelectVideo: (catalogVideo: CatalogVideo) => void;
  onSetFavorite: (catalogVideo: CatalogVideo, isFavorite: boolean) => void;
  selectedVideoIds: number[];
}) {
  return (
    <Box component="section" aria-label="Catalog Videos" p="md" maw={760}>
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
            disabled={catalogVideoWorkspace === "recentlyOpened"}
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
          <Stack gap="sm">
            {catalogVideos.map((catalogVideo) => (
              <CatalogVideoCard
                catalogVideo={catalogVideo}
                key={catalogVideo.id}
                onSelectVideo={onSelectVideo}
                onOpenVideo={onOpenVideo}
                onSetBatchVideoSelected={onSetBatchVideoSelected}
                onSetFavorite={onSetFavorite}
                isSelectedForBatch={selectedVideoIds.includes(catalogVideo.id)}
              />
            ))}
          </Stack>
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
  isSelectedForBatch,
  onSelectVideo,
  onOpenVideo,
  onSetBatchVideoSelected,
  onSetFavorite,
}: {
  catalogVideo: CatalogVideo;
  isSelectedForBatch: boolean;
  onSelectVideo: (catalogVideo: CatalogVideo) => void;
  onOpenVideo: (catalogVideo: CatalogVideo) => void;
  onSetBatchVideoSelected: (videoId: number, isSelected: boolean) => void;
  onSetFavorite: (catalogVideo: CatalogVideo, isFavorite: boolean) => void;
}) {
  const favoriteButtonLabel = catalogVideo.isFavorite
    ? `Unmark ${catalogVideo.title} as Favorite`
    : `Mark ${catalogVideo.title} as Favorite`;

  return (
    <Stack component="article" gap="sm">
      <Divider />
      <PreviewStripSurface catalogVideo={catalogVideo} />
      <Box>
        <Group gap="xs" align="center">
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
          <Button
            type="button"
            variant="subtle"
            px={0}
            onClick={() => void onSelectVideo(catalogVideo)}
          >
            {catalogVideo.title}
          </Button>
          <Button
            type="button"
            size="xs"
            variant="default"
            disabled={!catalogVideo.isAvailable}
            onClick={() => void onOpenVideo(catalogVideo)}
          >
            {`Open ${catalogVideo.title}`}
          </Button>
          {catalogVideo.isFavorite ? (
            <Badge color="yellow">Favorite</Badge>
          ) : null}
          <AvailabilityBadge isAvailable={catalogVideo.isAvailable} />
          <Button
            type="button"
            size="xs"
            variant={catalogVideo.isFavorite ? "light" : "default"}
            onClick={() =>
              void onSetFavorite(catalogVideo, !catalogVideo.isFavorite)
            }
          >
            {favoriteButtonLabel}
          </Button>
        </Group>
        <Text c="dimmed">
          {formatDuration(catalogVideo.durationMilliseconds)}
        </Text>
      </Box>
      <Box component="dl" className="definition-list">
        <DefinitionTerm label="File Location">
          {catalogVideo.fileLocationPath ? (
            <Code className="wrapping-code">
              {catalogVideo.fileLocationPath}
            </Code>
          ) : (
            "Missing"
          )}
        </DefinitionTerm>
        <DefinitionTerm label="File Size">
          {formatFileSize(catalogVideo.fileSizeBytes)}
        </DefinitionTerm>
        <DefinitionTerm label="Open History">
          {formatOpenHistory(catalogVideo)}
        </DefinitionTerm>
      </Box>
    </Stack>
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
