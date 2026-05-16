import type { CatalogVideo } from "../../tauriCommands";
import { fileSizeNullSortOrder } from "../../shared/formatting/videoFormatting";
import type { CatalogVideoFilters, CatalogVideoMetadata, CatalogVideoSort } from "./catalogTypes";

export function catalogVideoMatchesFilters(
  catalogVideo: CatalogVideo,
  metadata: CatalogVideoMetadata | undefined,
  filters: CatalogVideoFilters,
) {
  return (
    catalogVideoMatchesSearchText(catalogVideo, filters.searchText) &&
    catalogVideoMatchesFavoriteFilter(catalogVideo, filters.favoritesOnly) &&
    catalogVideoMatchesDurationFilter(catalogVideo, filters) &&
    catalogVideoMatchesTagFilter(metadata, filters.selectedTagIds) &&
    catalogVideoMatchesPerformerFilter(metadata, filters.selectedPerformerIds)
  );
}

export function catalogVideoMatchesSearchText(
  catalogVideo: CatalogVideo,
  searchText: string,
) {
  const normalizedSearchText = searchText.trim().toLocaleLowerCase();

  if (normalizedSearchText.length === 0) {
    return true;
  }

  const searchableValues = [
    catalogVideo.title,
    currentFilename(catalogVideo.fileLocationPath),
  ].map((value) => value.toLocaleLowerCase());

  return searchableValues.some((value) => value.includes(normalizedSearchText));
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

const millisecondsPerSecond = 1000;
const secondsPerMinute = 60;

export function catalogVideoMatchesDurationFilter(
  catalogVideo: CatalogVideo,
  filters: CatalogVideoFilters,
) {
  const durationMinutes =
    catalogVideo.durationMilliseconds /
    millisecondsPerSecond /
    secondsPerMinute;
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
) {
  if (selectedTagIds.length === 0) {
    return true;
  }

  const videoTagIds = new Set(metadata?.tags.map((tag) => tag.id) ?? []);

  return selectedTagIds.every((tagId) => videoTagIds.has(tagId));
}

export function catalogVideoMatchesPerformerFilter(
  metadata: CatalogVideoMetadata | undefined,
  selectedPerformerIds: number[],
) {
  if (selectedPerformerIds.length === 0) {
    return true;
  }

  const videoPerformerIds = new Set(
    metadata?.performers.map((performer) => performer.id) ?? [],
  );

  return selectedPerformerIds.some((performerId) =>
    videoPerformerIds.has(performerId),
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
