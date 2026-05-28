import type { CatalogVideo } from "../../tauriCommands";
import { fileSizeNullSortOrder } from "../../shared/formatting/videoFormatting";
import type {
  CatalogFolderSearchBranch,
  CatalogVideoFilters,
  CatalogVideoMetadata,
  CatalogVideoSort,
} from "./catalogTypes";

export function catalogVideoMatchesFilters(
  catalogVideo: CatalogVideo,
  metadata: CatalogVideoMetadata | undefined,
  filters: CatalogVideoFilters,
  secretMetadataExists = false,
): boolean {
  const filterIndex = buildCatalogVideoFilterIndex([catalogVideo], {
    [catalogVideo.id]: metadata,
  });

  return catalogVideoMatchesIndexedFilters(
    filterIndex,
    catalogVideo,
    filters,
    secretMetadataExists,
  );
}

export interface CatalogVideoFilterIndex {
  videoFilterDataById: Map<number, CatalogVideoFilterData>;
}

export interface CatalogVideoFilterData {
  normalizedTitle: string;
  normalizedCurrentFilename: string;
  normalizedReachableFileLocationPaths: string[];
  durationMinutes: number;
  tagIds: Set<number>;
  performerIds: Set<number>;
  hasTags: boolean;
  hasSecretMetadata: boolean;
  hasLoadedMetadata: boolean;
}

export interface IndexedCatalogVideoFilters {
  filters: CatalogVideoFilters;
  normalizedSelectedFolderBranches: NormalizedSelectedFolderBranch[] | null;
}

interface NormalizedSelectedFolderBranch {
  normalizedPath: string;
  normalizedAvailableScanRootPath: string;
  isInsideAvailableScanRoot: boolean;
}

const catalogFilterTimingDebugPrefix = "[DEBUG-catalog-filter-timing]";
let catalogVideoMatchBreakdown: CatalogVideoMatchBreakdown | null = null;

type CatalogVideoMatchBreakdownKey =
  | "indexLookup"
  | "search"
  | "folder"
  | "favorite"
  | "availability"
  | "duration"
  | "secretMetadata"
  | "tag"
  | "performer";

type CatalogVideoMatchBreakdown = Record<CatalogVideoMatchBreakdownKey, number>;

interface CatalogVideoMetadataFilterData {
  tagIds: Set<number>;
  performerIds: Set<number>;
  hasTags: boolean;
  hasSecretMetadata: boolean;
  hasLoadedMetadata: boolean;
}

export function buildCatalogVideoFilterIndex(
  catalogVideos: CatalogVideo[],
  metadataByVideoId: Record<number, CatalogVideoMetadata | undefined>,
): CatalogVideoFilterIndex {
  return {
    videoFilterDataById: new Map(
      catalogVideos.map((catalogVideo) => [
        catalogVideo.id,
        indexedCatalogVideoFilterData(
          catalogVideo,
          metadataByVideoId[catalogVideo.id],
        ),
      ]),
    ),
  };
}

export function catalogVideoMatchesIndexedFilters(
  filterIndex: CatalogVideoFilterIndex,
  catalogVideo: CatalogVideo,
  filters: CatalogVideoFilters,
  secretMetadataExists = false,
): boolean {
  return catalogVideoMatchesPreparedIndexedFilters(
    filterIndex,
    catalogVideo,
    indexedCatalogVideoFilters(filters),
    secretMetadataExists,
  );
}

export function indexedCatalogVideoFilters(
  filters: CatalogVideoFilters,
): IndexedCatalogVideoFilters {
  return {
    filters,
    normalizedSelectedFolderBranches: normalizedSelectedFolderBranches(
      filters.selectedFolderBranches,
    ),
  };
}

export function catalogVideoMatchesPreparedIndexedFilters(
  filterIndex: CatalogVideoFilterIndex,
  catalogVideo: CatalogVideo,
  indexedFilters: IndexedCatalogVideoFilters,
  secretMetadataExists = false,
): boolean {
  const { filters } = indexedFilters;
  const indexLookupTimingStart = performance.now();
  const filterData =
    filterIndex.videoFilterDataById.get(catalogVideo.id) ??
    indexedCatalogVideoFilterData(catalogVideo, undefined);
  addCatalogVideoMatchBreakdownDuration(
    "indexLookup",
    indexLookupTimingStart,
  );

  if (
    !timedCatalogVideoPredicate("search", () =>
      indexedCatalogVideoMatchesSearchText(filterData, filters.searchText),
    )
  ) {
    return false;
  }

  if (
    !timedCatalogVideoPredicate("tag", () =>
      indexedCatalogVideoMatchesTagFilter(
        filterData,
        filters.selectedTagIds,
        filters.withoutTagsOnly,
      ),
    )
  ) {
    return false;
  }

  if (
    !timedCatalogVideoPredicate("performer", () =>
      indexedCatalogVideoMatchesPerformerFilter(
        filterData,
        filters.selectedPerformerIds,
      ),
    )
  ) {
    return false;
  }

  if (
    !timedCatalogVideoPredicate("folder", () =>
      indexedCatalogVideoMatchesOptionalFolderFilter(
        filterData,
        indexedFilters.normalizedSelectedFolderBranches,
      ),
    )
  ) {
    return false;
  }

  if (
    !timedCatalogVideoPredicate("favorite", () =>
      catalogVideoMatchesFavoriteFilter(catalogVideo, filters.favoritesOnly),
    )
  ) {
    return false;
  }

  if (
    !timedCatalogVideoPredicate("availability", () =>
      catalogVideoMatchesAvailabilityFilter(
        catalogVideo,
        filters.showUnavailableVideos,
      ),
    )
  ) {
    return false;
  }

  if (
    !timedCatalogVideoPredicate("duration", () =>
      indexedCatalogVideoMatchesDurationFilter(filterData, filters),
    )
  ) {
    return false;
  }

  if (
    !timedCatalogVideoPredicate("secretMetadata", () =>
      indexedCatalogVideoMatchesSecretMetadataFilter(
        filterData,
        filters.hideSecretMetadata,
        secretMetadataExists,
      ),
    )
  ) {
    return false;
  }

  return true;
}

export function beginCatalogVideoMatchBreakdown() {
  catalogVideoMatchBreakdown = {
    indexLookup: 0,
    search: 0,
    folder: 0,
    favorite: 0,
    availability: 0,
    duration: 0,
    secretMetadata: 0,
    tag: 0,
    performer: 0,
  };
}

export function endCatalogVideoMatchBreakdown(
  details: Record<string, unknown> = {},
) {
  if (!catalogVideoMatchBreakdown) {
    return;
  }

  console.info(
    `${catalogFilterTimingDebugPrefix} ${JSON.stringify({
      label: "matchingCatalogVideos breakdown",
      ...Object.fromEntries(
        Object.entries(catalogVideoMatchBreakdown).map(([key, duration]) => [
          key,
          Number(duration.toFixed(2)),
        ]),
      ),
      ...details,
    })}`,
  );
  catalogVideoMatchBreakdown = null;
}

function timedCatalogVideoPredicate(
  key: CatalogVideoMatchBreakdownKey,
  predicate: () => boolean,
) {
  const timingStart = performance.now();
  const result = predicate();

  addCatalogVideoMatchBreakdownDuration(key, timingStart);

  return result;
}

function addCatalogVideoMatchBreakdownDuration(
  key: CatalogVideoMatchBreakdownKey,
  timingStart: number,
) {
  if (!catalogVideoMatchBreakdown) {
    return;
  }

  catalogVideoMatchBreakdown[key] += performance.now() - timingStart;
}

function indexedCatalogVideoFilterData(
  catalogVideo: CatalogVideo,
  metadata: CatalogVideoMetadata | undefined,
): CatalogVideoFilterData {
  const metadataFilterData = indexedCatalogVideoMetadataFilterData(metadata);

  return {
    normalizedTitle: catalogVideo.title.toLocaleLowerCase(),
    normalizedCurrentFilename: currentFilename(
      catalogVideo.fileLocationPath,
    ).toLocaleLowerCase(),
    normalizedReachableFileLocationPaths: catalogVideo.fileLocations
      .filter((fileLocation) => fileLocation.isReachable)
      .map((fileLocation) => normalizedFolderSearchPath(fileLocation.path)),
    durationMinutes:
      catalogVideo.durationMilliseconds /
      millisecondsPerSecond /
      secondsPerMinute,
    ...metadataFilterData,
  };
}

function indexedCatalogVideoMetadataFilterData(
  metadata: CatalogVideoMetadata | undefined,
): CatalogVideoMetadataFilterData {
  return {
    tagIds: new Set(metadata?.tags.map((tag) => tag.id) ?? []),
    performerIds: new Set(
      metadata?.performers.map((performer) => performer.id) ?? [],
    ),
    hasTags: (metadata?.tags.length ?? 0) > 0,
    hasSecretMetadata:
      metadata?.tags.some((tag) => tag.isSecret) ||
      metadata?.performers.some((performer) => performer.isSecret) ||
      false,
    hasLoadedMetadata: metadata !== undefined,
  };
}

function indexedCatalogVideoMatchesOptionalFolderFilter(
  filterData: CatalogVideoFilterData,
  selectedFolderBranches: NormalizedSelectedFolderBranch[] | null,
) {
  if (selectedFolderBranches === null) {
    return true;
  }

  return indexedCatalogVideoMatchesFolderFilter(
    filterData,
    selectedFolderBranches,
  );
}

export function catalogVideoMatchesFolderFilter(
  catalogVideo: CatalogVideo,
  selectedFolderBranches: CatalogFolderSearchBranch[],
) {
  return indexedCatalogVideoMatchesFolderFilter(
    indexedCatalogVideoFilterData(catalogVideo, undefined),
    normalizedSelectedFolderBranches(selectedFolderBranches) ?? [],
  );
}

function indexedCatalogVideoMatchesFolderFilter(
  filterData: CatalogVideoFilterData,
  selectedFolderBranches: NormalizedSelectedFolderBranch[],
) {
  if (selectedFolderBranches.length === 0) {
    return false;
  }

  return filterData.normalizedReachableFileLocationPaths.some(
    (fileLocationPath) =>
      selectedFolderBranches.some((selectedFolderBranch) => {
        return (
          selectedFolderBranch.isInsideAvailableScanRoot &&
          pathIsInsideBranch(
            fileLocationPath,
            selectedFolderBranch.normalizedAvailableScanRootPath,
          ) &&
          pathIsInsideBranch(
            fileLocationPath,
            selectedFolderBranch.normalizedPath,
          )
        );
      }),
  );
}

function normalizedSelectedFolderBranches(
  selectedFolderBranches: CatalogFolderSearchBranch[] | null,
) {
  if (selectedFolderBranches === null) {
    return null;
  }

  return selectedFolderBranches.map((selectedFolderBranch) => {
    const normalizedPath = normalizedFolderSearchPath(
      selectedFolderBranch.path,
    );
    const normalizedAvailableScanRootPath = normalizedFolderSearchPath(
      selectedFolderBranch.availableScanRootPath,
    );

    return {
      normalizedPath,
      normalizedAvailableScanRootPath,
      isInsideAvailableScanRoot: pathIsInsideBranch(
        normalizedPath,
        normalizedAvailableScanRootPath,
      ),
    };
  });
}

function normalizedFolderSearchPath(path: string) {
  const pathWithForwardSlashes = path.replace(/\\/g, "/");
  const pathWithoutTrailingSlashes = pathWithForwardSlashes.replace(/\/+$/g, "");

  return pathWithoutTrailingSlashes.toLocaleLowerCase();
}

function pathIsInsideBranch(path: string, branchPath: string) {
  if (branchPath.length === 0) {
    return false;
  }

  return path === branchPath || path.startsWith(`${branchPath}/`);
}

export function catalogVideoMatchesSearchText(
  catalogVideo: CatalogVideo,
  searchText: string,
) {
  return indexedCatalogVideoMatchesSearchText(
    indexedCatalogVideoFilterData(catalogVideo, undefined),
    searchText,
  );
}

function indexedCatalogVideoMatchesSearchText(
  filterData: CatalogVideoFilterData,
  searchText: string,
) {
  const normalizedSearchText = searchText.trim().toLocaleLowerCase();

  if (normalizedSearchText.length === 0) {
    return true;
  }

  return [
    filterData.normalizedTitle,
    filterData.normalizedCurrentFilename,
  ].some((value) => value.includes(normalizedSearchText));
}

export function currentFilename(fileLocationPath: string | null) {
  if (!fileLocationPath) {
    return "";
  }

  const pathParts = fileLocationPath.split(/[/\\]/);

  return pathParts[pathParts.length - 1] ?? "";
}

export function catalogVideoMatchesFavoriteFilter(
  catalogVideo: CatalogVideo,
  favoritesOnly: boolean,
) {
  return !favoritesOnly || catalogVideo.isFavorite;
}

export function catalogVideoMatchesAvailabilityFilter(
  catalogVideo: CatalogVideo,
  showUnavailableVideos: boolean,
) {
  return showUnavailableVideos || catalogVideo.isAvailable;
}

const millisecondsPerSecond = 1000;
const secondsPerMinute = 60;

export function catalogVideoMatchesDurationFilter(
  catalogVideo: CatalogVideo,
  filters: CatalogVideoFilters,
) {
  return indexedCatalogVideoMatchesDurationFilter(
    indexedCatalogVideoFilterData(catalogVideo, undefined),
    filters,
  );
}

function indexedCatalogVideoMatchesDurationFilter(
  filterData: CatalogVideoFilterData,
  filters: CatalogVideoFilters,
) {
  const durationMinutes = filterData.durationMinutes;
  const minimumMinutes = filters.minimumDurationMinutes;
  const maximumMinutes = filters.maximumDurationMinutes;

  if (minimumMinutes !== "" && durationMinutes < minimumMinutes) {
    return false;
  }

  if (maximumMinutes !== "" && durationMinutes > maximumMinutes) {
    return false;
  }

  return true;
}

export function catalogVideoMatchesTagFilter(
  metadata: CatalogVideoMetadata | undefined,
  selectedTagIds: number[],
  withoutTagsOnly = false,
) {
  return indexedCatalogVideoMatchesTagFilter(
    indexedCatalogVideoMetadataFilterData(metadata),
    selectedTagIds,
    withoutTagsOnly,
  );
}

function indexedCatalogVideoMatchesTagFilter(
  filterData: CatalogVideoMetadataFilterData,
  selectedTagIds: number[],
  withoutTagsOnly = false,
) {
  if (withoutTagsOnly && selectedTagIds.length > 0) {
    return false;
  }

  if (withoutTagsOnly) {
    return !filterData.hasTags;
  }

  if (selectedTagIds.length === 0) {
    return true;
  }

  return selectedTagIds.every((tagId) => filterData.tagIds.has(tagId));
}

export function catalogVideoMatchesSecretMetadataFilter(
  metadata: CatalogVideoMetadata | undefined,
  hideSecretMetadata: boolean,
  secretMetadataExists: boolean,
) {
  return indexedCatalogVideoMatchesSecretMetadataFilter(
    indexedCatalogVideoMetadataFilterData(metadata),
    hideSecretMetadata,
    secretMetadataExists,
  );
}

function indexedCatalogVideoMatchesSecretMetadataFilter(
  filterData: CatalogVideoMetadataFilterData,
  hideSecretMetadata: boolean,
  secretMetadataExists: boolean,
) {
  if (!hideSecretMetadata) {
    return true;
  }

  if (!filterData.hasLoadedMetadata && secretMetadataExists) {
    return false;
  }

  return !filterData.hasSecretMetadata;
}

export function catalogVideoMatchesPerformerFilter(
  metadata: CatalogVideoMetadata | undefined,
  selectedPerformerIds: number[],
) {
  return indexedCatalogVideoMatchesPerformerFilter(
    indexedCatalogVideoMetadataFilterData(metadata),
    selectedPerformerIds,
  );
}

function indexedCatalogVideoMatchesPerformerFilter(
  filterData: CatalogVideoMetadataFilterData,
  selectedPerformerIds: number[],
) {
  if (selectedPerformerIds.length === 0) {
    return true;
  }

  return selectedPerformerIds.some((performerId) =>
    filterData.performerIds.has(performerId),
  );
}

export function sortedCatalogVideos(
  catalogVideos: CatalogVideo[],
  catalogVideoSort: CatalogVideoSort,
) {
  return [...catalogVideos].sort((firstVideo, secondVideo) => {
    const fileSizeNullSortResult = fileSizeNullSortOrder(
      firstVideo,
      secondVideo,
    );

    if (
      fileSizeNullSortResult !== 0 &&
      (catalogVideoSort === "fileSizeAscending" ||
        catalogVideoSort === "fileSizeDescending")
    ) {
      return fileSizeNullSortResult;
    }

    if (catalogVideoSort === "fileSizeAscending") {
      return firstVideo.fileSizeBytes! - secondVideo.fileSizeBytes!;
    }

    if (catalogVideoSort === "fileSizeDescending") {
      return secondVideo.fileSizeBytes! - firstVideo.fileSizeBytes!;
    }

    if (catalogVideoSort === "lastOpenedDescending") {
      return compareNullableTextDescending(
        firstVideo.lastOpenedAt,
        secondVideo.lastOpenedAt,
      );
    }

    if (catalogVideoSort === "openCountDescending") {
      return (
        secondVideo.openCount - firstVideo.openCount ||
        compareNullableTextDescending(
          firstVideo.lastOpenedAt,
          secondVideo.lastOpenedAt,
        )
      );
    }

    return firstVideo.title.localeCompare(secondVideo.title);
  });
}


export function compareNullableTextDescending(
  firstValue: string | null,
  secondValue: string | null,
) {
  if (firstValue === null && secondValue === null) {
    return 0;
  }

  if (firstValue === null) {
    return 1;
  }

  if (secondValue === null) {
    return -1;
  }

  return secondValue.localeCompare(firstValue);
}
