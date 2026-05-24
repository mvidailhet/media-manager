import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Collapse,
  Group,
  RangeSlider,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';

import type { CatalogPerformer, CatalogTag } from '../../../../tauriCommands';
import type { CatalogVideo } from '../../../../tauriCommands';
import type { CatalogVideoFilters, CatalogVideoMetadata } from '../../catalogTypes';
import {
  durationSliderStepMinutes,
  formatDurationFilterValue,
  formatDurationRange,
  maximumDurationMinutes,
  minimumDurationMinutes,
} from '../catalogVideoDurationFilters';

export function FiltersPanel({
  availablePerformers,
  availableTags,
  catalogVideoMetadataById,
  catalogVideos,
  filters,
  onFiltersChange,
}: {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  catalogVideoMetadataById: Record<number, CatalogVideoMetadata>;
  catalogVideos: CatalogVideo[];
  filters: CatalogVideoFilters;
  onFiltersChange: (filters: CatalogVideoFilters) => void;
}) {
  const [advancedSearchOpened, setAdvancedSearchOpened] = useState(false);
  const durationRangeValue: [number, number] = [
    filters.minimumDurationMinutes === ''
      ? minimumDurationMinutes
      : filters.minimumDurationMinutes,
    filters.maximumDurationMinutes === ''
      ? maximumDurationMinutes
      : filters.maximumDurationMinutes,
  ];
  const visibleTags = visibleMetadataValues({
    availableValues: availableTags,
    catalogVideoMetadataById,
    catalogVideos,
    hideSecretMetadata: filters.hideSecretMetadata,
    metadataKind: 'tag',
  });
  const visiblePerformers = visibleMetadataValues({
    availableValues: availablePerformers,
    catalogVideoMetadataById,
    catalogVideos,
    hideSecretMetadata: filters.hideSecretMetadata,
    metadataKind: 'performer',
  });

  function updateFilters(updatedFilters: Partial<CatalogVideoFilters>) {
    onFiltersChange({ ...filters, ...updatedFilters });
  }

  function updateSecretMetadataVisibility(hideSecretMetadata: boolean) {
    const updatedFilters: Partial<CatalogVideoFilters> = {
      hideSecretMetadata,
    };

    if (hideSecretMetadata) {
      updatedFilters.selectedTagIds = selectedVisibleMetadataIds(
        visibleMetadataValues({
          availableValues: availableTags,
          catalogVideoMetadataById,
          catalogVideos,
          hideSecretMetadata,
          metadataKind: 'tag',
        }),
        filters.selectedTagIds,
      );
      updatedFilters.selectedPerformerIds = selectedVisibleMetadataIds(
        visibleMetadataValues({
          availableValues: availablePerformers,
          catalogVideoMetadataById,
          catalogVideos,
          hideSecretMetadata,
          metadataKind: 'performer',
        }),
        filters.selectedPerformerIds,
      );
    }

    updateFilters(updatedFilters);
  }

  return (
    <Stack gap="sm" aria-label="Video Search Filters">
      <Group align="center" maw={800}>
        <TextInput
          aria-label="Search Videos"
          placeholder="Search Videos"
          value={filters.searchText}
          style={{ flex: 1 }}
          onChange={(event) =>
            updateFilters({ searchText: event.currentTarget.value })
          }
        />
        <Checkbox
          label="Favorites"
          checked={filters.favoritesOnly}
          onChange={(event) =>
            updateFilters({ favoritesOnly: event.currentTarget.checked })
          }
        />
        <Button
          type="button"
          variant="subtle"
          size="xs"
          px="xs"
          w="fit-content"
          aria-expanded={advancedSearchOpened}
          onClick={() => setAdvancedSearchOpened((isOpened) => !isOpened)}
        >
          Advanced search
        </Button>
      </Group>
      <Collapse expanded={advancedSearchOpened}>
        <Stack gap="sm">
          <Checkbox
            label="Hide secret tags and performers"
            checked={filters.hideSecretMetadata}
            onChange={(event) =>
              updateSecretMetadataVisibility(event.currentTarget.checked)
            }
          />
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
          <Checkbox
            label="Show unavailable videos"
            checked={filters.showUnavailableVideos}
            onChange={(event) =>
              updateFilters({
                showUnavailableVideos: event.currentTarget.checked,
              })
            }
          />
        </Stack>
      </Collapse>
      {visibleTags.length > 0 ? (
        <Checkbox.Group
          label="Tags"
          value={filters.selectedTagIds.map(String)}
          onChange={(selectedValues) =>
            updateFilters({ selectedTagIds: selectedValues.map(Number) })
          }
        >
          <Group gap="sm" mt="xs">
            {visibleTags.map((tag) => (
              <Checkbox key={tag.id} value={String(tag.id)} label={tag.name} />
            ))}
          </Group>
        </Checkbox.Group>
      ) : null}
      {visiblePerformers.length > 0 ? (
        <Checkbox.Group
          label="Performers"
          value={filters.selectedPerformerIds.map(String)}
          onChange={(selectedValues) =>
            updateFilters({ selectedPerformerIds: selectedValues.map(Number) })
          }
        >
          <Group gap="sm" mt="xs">
            {visiblePerformers.map((performer) => (
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

function visibleMetadataValues<TMetadata extends { id: number; isSecret: boolean }>({
  availableValues,
  catalogVideoMetadataById,
  catalogVideos,
  hideSecretMetadata,
  metadataKind,
}: {
  availableValues: TMetadata[];
  catalogVideoMetadataById: Record<number, CatalogVideoMetadata>;
  catalogVideos: CatalogVideo[];
  hideSecretMetadata: boolean;
  metadataKind: 'tag' | 'performer';
}) {
  const metadataIdsOnVisibleVideos = new Set<number>();

  for (const catalogVideo of catalogVideos) {
    const metadata = catalogVideoMetadataById[catalogVideo.id];

    if (!metadata) {
      continue;
    }

    if (hideSecretMetadata && videoHasSecretMetadata(metadata)) {
      continue;
    }

    const metadataValues =
      metadataKind === 'tag' ? metadata.tags : metadata.performers;
    metadataValues.forEach((metadataValue) =>
      metadataIdsOnVisibleVideos.add(metadataValue.id),
    );
  }

  return availableValues.filter((metadataValue) => {
    if (hideSecretMetadata && metadataValue.isSecret) {
      return false;
    }

    if (!hideSecretMetadata) {
      return true;
    }

    const metadataIdsOnLoadedVideos = metadataIdsForLoadedVideos({
      catalogVideoMetadataById,
      catalogVideos,
      metadataKind,
    });

    if (!metadataIdsOnLoadedVideos.has(metadataValue.id)) {
      return true;
    }

    return metadataIdsOnVisibleVideos.has(metadataValue.id);
  });
}

function metadataIdsForLoadedVideos({
  catalogVideoMetadataById,
  catalogVideos,
  metadataKind,
}: {
  catalogVideoMetadataById: Record<number, CatalogVideoMetadata>;
  catalogVideos: CatalogVideo[];
  metadataKind: 'tag' | 'performer';
}) {
  const metadataIds = new Set<number>();

  for (const catalogVideo of catalogVideos) {
    const metadata = catalogVideoMetadataById[catalogVideo.id];

    if (!metadata) {
      continue;
    }

    const metadataValues =
      metadataKind === 'tag' ? metadata.tags : metadata.performers;
    metadataValues.forEach((metadataValue) => metadataIds.add(metadataValue.id));
  }

  return metadataIds;
}

function videoHasSecretMetadata(metadata: CatalogVideoMetadata) {
  return (
    metadata.tags.some((tag) => tag.isSecret) ||
    metadata.performers.some((performer) => performer.isSecret)
  );
}

function selectedVisibleMetadataIds<TMetadata extends { id: number; isSecret: boolean }>(
  metadataValues: TMetadata[],
  selectedMetadataIds: number[],
) {
  const visibleMetadataIds = new Set(
    metadataValues
      .filter((metadataValue) => !metadataValue.isSecret)
      .map((metadataValue) => metadataValue.id),
  );

  return selectedMetadataIds.filter((metadataId) =>
    visibleMetadataIds.has(metadataId),
  );
}
