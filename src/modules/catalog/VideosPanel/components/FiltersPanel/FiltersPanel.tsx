import { useEffect, useMemo, useState } from 'react';
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

import type { CatalogPerformer, CatalogTag, ScanRoot } from '../../../../../tauriCommands';
import type { CatalogVideo } from '../../../../../tauriCommands';
import type { CatalogVideoFilters, CatalogVideoMetadata } from '../../../catalogTypes';
import { folderFilterBranchesForVideos } from '../../folderFilterBranches';
import {
  durationSliderStepMinutes,
  formatDurationFilterValue,
  formatDurationRange,
  maximumDurationMinutes,
  minimumDurationMinutes,
} from '../../catalogVideoDurationFilters';
import { FolderFilterSection } from './components/FolderFilterSection';

const noTagFilterValue = 'without-tags';
const catalogFilterTimingDebugPrefix = '[DEBUG-catalog-filter-timing]';

export function FiltersPanel({
  availablePerformers,
  availableTags,
  catalogVideoMetadataById,
  catalogVideos,
  filters,
  onFiltersChange,
  scanRoots,
}: {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  catalogVideoMetadataById: Record<number, CatalogVideoMetadata>;
  catalogVideos: CatalogVideo[];
  filters: CatalogVideoFilters;
  onFiltersChange: (filters: CatalogVideoFilters) => void;
  scanRoots: ScanRoot[];
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
  const {
    videoCountByPerformerId,
    videoCountByTagId,
    visiblePerformers,
    visibleTags,
  } = useMemo(
    () => {
      const timingLabel = 'FiltersPanel filterPanelMetadata';
      const timingStart = performance.now();
      const metadata = filterPanelMetadata({
        availablePerformers,
        availableTags,
        catalogVideoMetadataById,
        catalogVideos,
        hideSecretMetadata: filters.hideSecretMetadata,
      });

      logCatalogFilterTiming(timingLabel, timingStart, {
        performerCount: metadata.visiblePerformers.length,
        tagCount: metadata.visibleTags.length,
        videoCount: catalogVideos.length,
      });

      return metadata;
    },
    [
      availablePerformers,
      availableTags,
      catalogVideoMetadataById,
      catalogVideos,
      filters.hideSecretMetadata,
    ],
  );
  const folderBranches = useMemo(
    () => {
      const timingLabel = 'FiltersPanel folderFilterBranchesForVideos';
      const timingStart = performance.now();
      const branches = folderFilterBranchesForVideos(catalogVideos, scanRoots);

      logCatalogFilterTiming(timingLabel, timingStart, {
        branchCount: branches.length,
        videoCount: catalogVideos.length,
      });

      return branches;
    },
    [catalogVideos, scanRoots],
  );

  useEffect(() => {
    logCatalogFilterMessage('FiltersPanel committed selected tags', {
      selectedTagIds: filters.selectedTagIds,
      withoutTagsOnly: filters.withoutTagsOnly,
    });
  }, [filters.selectedTagIds, filters.withoutTagsOnly]);

  function updateFilters(updatedFilters: Partial<CatalogVideoFilters>) {
    onFiltersChange({ ...filters, ...updatedFilters });
  }

  function updateSecretMetadataVisibility(hideSecretMetadata: boolean) {
    const updatedFilters: Partial<CatalogVideoFilters> = {
      hideSecretMetadata,
    };

    if (hideSecretMetadata) {
      const hiddenSecretMetadata = filterPanelMetadata({
        availablePerformers,
        availableTags,
        catalogVideoMetadataById,
        catalogVideos,
        hideSecretMetadata,
      });

      updatedFilters.selectedTagIds = selectedVisibleMetadataIds(
        hiddenSecretMetadata.visibleTags,
        filters.selectedTagIds,
      );
      updatedFilters.selectedPerformerIds = selectedVisibleMetadataIds(
        hiddenSecretMetadata.visiblePerformers,
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
          <FolderFilterSection
            folderBranches={folderBranches}
            selectedFolderBranches={filters.selectedFolderBranches}
            onSelectedFolderBranchesChange={(selectedFolderBranches) =>
              updateFilters({ selectedFolderBranches })
            }
          />
        </Stack>
      </Collapse>
      <Checkbox.Group
        label="Tags"
        value={[
          ...(filters.withoutTagsOnly ? [noTagFilterValue] : []),
          ...filters.selectedTagIds.map(String),
        ]}
        onChange={(selectedValues) => {
          const timingStart = performance.now();
          logCatalogFilterMessage('Tag Checkbox.Group onChange start', {
            selectedValues,
          });
          const selectedTagIds = selectedValues
            .filter((selectedValue) => selectedValue !== noTagFilterValue)
            .map(Number);

          updateFilters({
            selectedTagIds,
            withoutTagsOnly: selectedValues.includes(noTagFilterValue),
          });
          logCatalogFilterTiming('Tag Checkbox.Group onChange handler', timingStart, {
            selectedTagIds,
          });
          window.requestAnimationFrame(() => {
            logCatalogFilterTiming('Tag Checkbox.Group next animation frame', timingStart, {
              selectedTagIds,
            });
          });
        }}
      >
        <Group gap="sm" mt="xs">
          <Checkbox value={noTagFilterValue} label="No Tag" />
          {visibleTags.map((tag) => (
            <Checkbox
              aria-label={tag.name}
              key={tag.id}
              value={String(tag.id)}
              label={`${tag.name} (${videoCountByTagId.get(tag.id) ?? 0})`}
            />
          ))}
        </Group>
      </Checkbox.Group>
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
                aria-label={performer.name}
                key={performer.id}
                value={String(performer.id)}
                label={`${performer.name} (${videoCountByPerformerId.get(performer.id) ?? 0})`}
              />
            ))}
          </Group>
        </Checkbox.Group>
      ) : null}
    </Stack>
  );
}

function filterPanelMetadata({
  availablePerformers,
  availableTags,
  catalogVideoMetadataById,
  catalogVideos,
  hideSecretMetadata,
}: {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  catalogVideoMetadataById: Record<number, CatalogVideoMetadata>;
  catalogVideos: CatalogVideo[];
  hideSecretMetadata: boolean;
}) {
  const visibleTagsTimingStart = performance.now();
  const visibleTags = visibleMetadataValues({
    availableValues: availableTags,
    catalogVideoMetadataById,
    catalogVideos,
    hideSecretMetadata,
    metadataKind: 'tag',
  });
  logCatalogFilterTiming('visibleMetadataValues tag', visibleTagsTimingStart, {
    availableCount: availableTags.length,
    visibleCount: visibleTags.length,
    videoCount: catalogVideos.length,
  });

  const tagCountsTimingStart = performance.now();
  const videoCountByTagId = countVideosByMetadataId({
    catalogVideoMetadataById,
    catalogVideos,
    hideSecretMetadata,
    metadataKind: 'tag',
  });
  logCatalogFilterTiming('countVideosByMetadataId tag', tagCountsTimingStart, {
    countedMetadataCount: videoCountByTagId.size,
    videoCount: catalogVideos.length,
  });

  const visiblePerformersTimingStart = performance.now();
  const visiblePerformers = visibleMetadataValues({
    availableValues: availablePerformers,
    catalogVideoMetadataById,
    catalogVideos,
    hideSecretMetadata,
    metadataKind: 'performer',
  });
  logCatalogFilterTiming(
    'visibleMetadataValues performer',
    visiblePerformersTimingStart,
    {
      availableCount: availablePerformers.length,
      visibleCount: visiblePerformers.length,
      videoCount: catalogVideos.length,
    },
  );

  const performerCountsTimingStart = performance.now();
  const videoCountByPerformerId = countVideosByMetadataId({
    catalogVideoMetadataById,
    catalogVideos,
    hideSecretMetadata,
    metadataKind: 'performer',
  });
  logCatalogFilterTiming(
    'countVideosByMetadataId performer',
    performerCountsTimingStart,
    {
      countedMetadataCount: videoCountByPerformerId.size,
      videoCount: catalogVideos.length,
    },
  );

  return {
    visibleTags,
    videoCountByTagId,
    visiblePerformers,
    videoCountByPerformerId,
  };
}

function logCatalogFilterTiming(
  label: string,
  timingStart: number,
  details: Record<string, unknown> = {},
) {
  logCatalogFilterMessage(label, {
    durationMs: Number((performance.now() - timingStart).toFixed(2)),
    ...details,
  });
}

function logCatalogFilterMessage(
  label: string,
  details: Record<string, unknown> = {},
) {
  console.info(
    `${catalogFilterTimingDebugPrefix} ${JSON.stringify({ label, ...details })}`,
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
  const metadataIdsOnLoadedVideos = hideSecretMetadata
    ? metadataIdsForLoadedVideos({
        catalogVideoMetadataById,
        catalogVideos,
        metadataKind,
      })
    : new Set<number>();

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

function countVideosByMetadataId({
  catalogVideoMetadataById,
  catalogVideos,
  hideSecretMetadata,
  metadataKind,
}: {
  catalogVideoMetadataById: Record<number, CatalogVideoMetadata>;
  catalogVideos: CatalogVideo[];
  hideSecretMetadata: boolean;
  metadataKind: 'tag' | 'performer';
}) {
  const videoCountByMetadataId = new Map<number, number>();

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

    for (const metadataValue of metadataValues) {
      videoCountByMetadataId.set(
        metadataValue.id,
        (videoCountByMetadataId.get(metadataValue.id) ?? 0) + 1,
      );
    }
  }

  return videoCountByMetadataId;
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
