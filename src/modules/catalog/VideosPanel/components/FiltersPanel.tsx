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

  function updateFilters(updatedFilters: Partial<CatalogVideoFilters>) {
    onFiltersChange({ ...filters, ...updatedFilters });
  }

  return (
    <Stack gap="sm" aria-label="Video Search Filters">
      <Group align="center">
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
      </Group>
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

