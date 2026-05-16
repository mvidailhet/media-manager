import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Badge, Box, Button, Checkbox, Code, Divider, Group, Loader, NativeSelect, NumberInput, Paper, Stack, Text, TextInput, Title } from "@mantine/core";

import type { CatalogPerformer, CatalogTag, CatalogVideo, PreviewStripQueueStatus } from "../../tauriCommands";
import { PreviewStripQueuePanel } from "../scan/PreviewGenerationView";
import { AvailabilityBadge } from "../../shared/components/AvailabilityBadge";
import { DefinitionTerm } from "../../shared/components/DefinitionTerm";
import { SectionHeader } from "../../shared/components/SectionHeader";
import { formatDuration, formatFileSize, formatOpenHistory } from "../../shared/formatting/videoFormatting";
import type { CatalogVideoFilters, CatalogVideoSort, CatalogVideoWorkspace } from "./catalogTypes";

const catalogVideosEmptyMessage = "No Videos in the Catalog.";
const minimumDurationMinutes = 0;
const maximumDurationMinutes = 24 * 60;
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
  onPausePreviewStripQueue,
  onResumePreviewStripQueue,
  onOpenVideo,
  onSetBatchVideoSelected,
  onSelectVideo,
  onSetFavorite,
  previewStripQueueStatus,
  previewStripStatusMessage,
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
  onPausePreviewStripQueue: () => void;
  onResumePreviewStripQueue: () => void;
  onOpenVideo: (catalogVideo: CatalogVideo) => void;
  onSetBatchVideoSelected: (videoId: number, isSelected: boolean) => void;
  onSelectVideo: (catalogVideo: CatalogVideo) => void;
  onSetFavorite: (catalogVideo: CatalogVideo, isFavorite: boolean) => void;
  previewStripQueueStatus: PreviewStripQueueStatus | null;
  previewStripStatusMessage: string;
  selectedVideoIds: number[];
}) {
  const panelTitle =
    catalogVideoWorkspace === "favorites"
      ? "Favorite Videos"
      : catalogVideoWorkspace === "recentlyOpened"
        ? "Recently Opened Videos"
        : "Videos";

  return (
    <Paper component="section" aria-label="Catalog Videos" p="md" maw={760}>
      <Stack gap="md">
        <Group justify="space-between" align="start">
          <SectionHeader label="Catalog results" title={panelTitle} />
        </Group>

        <PreviewStripQueuePanel
          onPausePreviewStripQueue={onPausePreviewStripQueue}
          onResumePreviewStripQueue={onResumePreviewStripQueue}
          previewStripQueueStatus={previewStripQueueStatus}
        />

        <CatalogVideoFiltersPanel
          availablePerformers={availablePerformers}
          availableTags={availableTags}
          favoriteFilterLocked={catalogVideoWorkspace === "favorites"}
          filters={catalogVideoFilters}
          onFiltersChange={onCatalogVideoFiltersChange}
        />

        <NativeSelect
          label="Sort Videos"
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

        {catalogVideosStatusMessage ? (
          <Text>{catalogVideosStatusMessage}</Text>
        ) : null}
        {catalogVideoActionStatusMessage ? (
          <Text>{catalogVideoActionStatusMessage}</Text>
        ) : null}
        {previewStripStatusMessage ? (
          <Text>{previewStripStatusMessage}</Text>
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
                runningPreviewStripVideoId={
                  previewStripQueueStatus?.runningVideoId ?? null
                }
                isSelectedForBatch={selectedVideoIds.includes(catalogVideo.id)}
              />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}

export function CatalogVideoFiltersPanel({
  availablePerformers,
  availableTags,
  favoriteFilterLocked,
  filters,
  onFiltersChange,
}: {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  favoriteFilterLocked: boolean;
  filters: CatalogVideoFilters;
  onFiltersChange: (filters: CatalogVideoFilters) => void;
}) {
  function updateFilters(updatedFilters: Partial<CatalogVideoFilters>) {
    onFiltersChange({ ...filters, ...updatedFilters });
  }

  return (
    <Stack gap="sm" aria-label="Video Search Filters">
      <TextInput
        label="Search Videos"
        value={filters.searchText}
        onChange={(event) =>
          updateFilters({ searchText: event.currentTarget.value })
        }
      />
      <Group gap="md" align="end">
        <NumberInput
          label="Minimum duration minutes"
          min={minimumDurationMinutes}
          max={maximumDurationMinutes}
          value={filters.minimumDurationMinutes}
          onChange={(value) =>
            updateFilters({
              minimumDurationMinutes: numberFilterValue(value),
            })
          }
        />
        <NumberInput
          label="Maximum duration minutes"
          min={minimumDurationMinutes}
          max={maximumDurationMinutes}
          value={filters.maximumDurationMinutes}
          onChange={(value) =>
            updateFilters({
              maximumDurationMinutes: numberFilterValue(value),
            })
          }
        />
        <Checkbox
          label="Favorites only"
          checked={filters.favoritesOnly}
          disabled={favoriteFilterLocked}
          onChange={(event) =>
            updateFilters({ favoritesOnly: event.currentTarget.checked })
          }
        />
      </Group>
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
  runningPreviewStripVideoId,
}: {
  catalogVideo: CatalogVideo;
  isSelectedForBatch: boolean;
  onSelectVideo: (catalogVideo: CatalogVideo) => void;
  onOpenVideo: (catalogVideo: CatalogVideo) => void;
  onSetBatchVideoSelected: (videoId: number, isSelected: boolean) => void;
  onSetFavorite: (catalogVideo: CatalogVideo, isFavorite: boolean) => void;
  runningPreviewStripVideoId: number | null;
}) {
  const isGeneratingPreviewStrip =
    catalogVideo.id === runningPreviewStripVideoId;
  const favoriteButtonLabel = catalogVideo.isFavorite
    ? `Unmark ${catalogVideo.title} as Favorite`
    : `Mark ${catalogVideo.title} as Favorite`;

  return (
    <Stack component="article" gap="sm">
      <Divider />
      <PreviewStripSurface
        catalogVideo={catalogVideo}
        isGeneratingPreviewStrip={isGeneratingPreviewStrip}
      />
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
  isGeneratingPreviewStrip,
}: {
  catalogVideo: CatalogVideo;
  isGeneratingPreviewStrip: boolean;
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

  if (isGeneratingPreviewStrip) {
    return (
      <Box className="preview-strip preview-strip-placeholder">
        <Group gap="xs">
          <Loader size="xs" />
          <Badge color="teal" variant="light">
            Generating Preview Strip
          </Badge>
        </Group>
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

export function numberFilterValue(value: string | number) {
  return typeof value === "number" ? value : "";
}
