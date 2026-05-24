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
import type { CatalogVideoFilters } from '../../catalogTypes';
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
    filters.minimumDurationMinutes === ''
      ? minimumDurationMinutes
      : filters.minimumDurationMinutes,
    filters.maximumDurationMinutes === ''
      ? maximumDurationMinutes
      : filters.maximumDurationMinutes,
  ];
  const visibleTags = filters.hideSecretMetadata
    ? availableTags.filter((tag) => !tag.isSecret)
    : availableTags;
  const visiblePerformers = filters.hideSecretMetadata
    ? availablePerformers.filter((performer) => !performer.isSecret)
    : availablePerformers;

  function updateFilters(updatedFilters: Partial<CatalogVideoFilters>) {
    onFiltersChange({ ...filters, ...updatedFilters });
  }

  function updateSecretMetadataVisibility(hideSecretMetadata: boolean) {
    const updatedFilters: Partial<CatalogVideoFilters> = {
      hideSecretMetadata,
    };

    if (hideSecretMetadata) {
      updatedFilters.selectedTagIds = selectedVisibleMetadataIds(
        availableTags,
        filters.selectedTagIds,
      );
      updatedFilters.selectedPerformerIds = selectedVisibleMetadataIds(
        availablePerformers,
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
        <Checkbox
          label="Hide secret tags and performers"
          checked={filters.hideSecretMetadata}
          onChange={(event) =>
            updateSecretMetadataVisibility(event.currentTarget.checked)
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
