import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CatalogVideo } from "../../../tauriCommands";
import type { CatalogVideoFilters, CatalogVideoSort } from "../catalogTypes";
import { defaultCatalogVideoFilters } from "../catalogTypes";
import { sortedCatalogVideos } from "../catalogVideoFiltering";
import { useVideosPanelController } from "./useVideosPanelController";

const firstVideoId = 1;
const secondVideoId = 2;
const thirdVideoId = 3;
const noMetadataByVideoId = {};

describe("useVideosPanelController", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps every filtered Catalog Video order equivalent to filter-then-sort", () => {
    const catalogVideos = [
      catalogVideo({
        id: firstVideoId,
        title: "Zulu",
        fileSizeBytes: 300,
        isFavorite: true,
        lastOpenedAt: "2026-01-03T00:00:00.000Z",
        openCount: 1,
      }),
      catalogVideo({
        id: secondVideoId,
        title: "Alpha",
        fileSizeBytes: 100,
        lastOpenedAt: null,
        openCount: 4,
      }),
      catalogVideo({
        id: thirdVideoId,
        title: "Echo",
        fileSizeBytes: 200,
        isFavorite: true,
        lastOpenedAt: "2026-01-02T00:00:00.000Z",
        openCount: 4,
      }),
    ];
    const filterScenarios = [
      catalogVideoFilters({ favoritesOnly: true }),
      catalogVideoFilters({ searchText: "a" }),
      catalogVideoFilters({ minimumDurationMinutes: 10 }),
    ];
    const sortModes: CatalogVideoSort[] = [
      "titleAscending",
      "fileSizeAscending",
      "fileSizeDescending",
      "lastOpenedDescending",
      "openCountDescending",
    ];
    const { result } = renderHook(() =>
      useVideosPanelController({
        availablePerformers: [],
        availableTags: [],
        catalogVideoMetadataById: noMetadataByVideoId,
        catalogVideos,
      }),
    );

    for (const sortMode of sortModes) {
      act(() => {
        result.current.setCatalogVideoSort(sortMode);
      });

      for (const filters of filterScenarios) {
        act(() => {
          result.current.setCatalogVideoFilters(filters);
        });

        const expectedVideoIds = sortedCatalogVideos(
          catalogVideos.filter((catalogVideo) =>
            matchesExpectedFilters(catalogVideo, filters),
          ),
          sortMode,
        ).map((catalogVideo) => catalogVideo.id);

        expect(result.current.matchingCatalogVideos.map((video) => video.id)).toEqual(
          expectedVideoIds,
        );
      }
    }
  });

  it("does not sort again when only Catalog Video filters change", () => {
    const sortSpy = vi.spyOn(Array.prototype, "sort");
    const catalogVideos = [
      catalogVideo({ id: firstVideoId, title: "Zulu", isFavorite: true }),
      catalogVideo({ id: secondVideoId, title: "Alpha" }),
      catalogVideo({ id: thirdVideoId, title: "Echo", isFavorite: true }),
    ];
    const { result } = renderHook(() =>
      useVideosPanelController({
        availablePerformers: [],
        availableTags: [],
        catalogVideoMetadataById: noMetadataByVideoId,
        catalogVideos,
      }),
    );
    const initialSortCount = sortSpy.mock.calls.length;

    act(() => {
      result.current.setCatalogVideoFilters(
        catalogVideoFilters({ favoritesOnly: true }),
      );
    });

    expect(result.current.matchingCatalogVideos.map((video) => video.id)).toEqual([
      thirdVideoId,
      firstVideoId,
    ]);
    expect(sortSpy).toHaveBeenCalledTimes(initialSortCount);
  });

  it("sorts again when the active sort mode changes", () => {
    const sortSpy = vi.spyOn(Array.prototype, "sort");
    const catalogVideos = [
      catalogVideo({ id: firstVideoId, title: "Zulu", fileSizeBytes: 300 }),
      catalogVideo({ id: secondVideoId, title: "Alpha", fileSizeBytes: 100 }),
    ];
    const { result } = renderHook(() =>
      useVideosPanelController({
        availablePerformers: [],
        availableTags: [],
        catalogVideoMetadataById: noMetadataByVideoId,
        catalogVideos,
      }),
    );
    const initialSortCount = sortSpy.mock.calls.length;

    act(() => {
      result.current.setCatalogVideoSort("fileSizeAscending");
    });

    expect(result.current.matchingCatalogVideos.map((video) => video.id)).toEqual([
      secondVideoId,
      firstVideoId,
    ]);
    expect(sortSpy.mock.calls.length).toBeGreaterThan(initialSortCount);
  });

  it("sorts again when Catalog Video data used by sorting changes", () => {
    const sortSpy = vi.spyOn(Array.prototype, "sort");
    const catalogVideos = [
      catalogVideo({ id: firstVideoId, title: "Zulu" }),
      catalogVideo({ id: secondVideoId, title: "Alpha" }),
    ];
    const { result, rerender } = renderHook(
      ({ videos }) =>
        useVideosPanelController({
          availablePerformers: [],
          availableTags: [],
          catalogVideoMetadataById: noMetadataByVideoId,
          catalogVideos: videos,
        }),
      { initialProps: { videos: catalogVideos } },
    );
    const initialSortCount = sortSpy.mock.calls.length;

    rerender({
      videos: [
        catalogVideo({ id: firstVideoId, title: "Aaron" }),
        catalogVideo({ id: secondVideoId, title: "Alpha" }),
      ],
    });

    expect(result.current.matchingCatalogVideos.map((video) => video.id)).toEqual([
      firstVideoId,
      secondVideoId,
    ]);
    expect(sortSpy.mock.calls.length).toBeGreaterThan(initialSortCount);
  });
});

function matchesExpectedFilters(
  catalogVideo: CatalogVideo,
  filters: CatalogVideoFilters,
) {
  const normalizedSearchText = filters.searchText.trim().toLocaleLowerCase();
  const durationMinutes = catalogVideo.durationMilliseconds / 60_000;

  return (
    (!filters.favoritesOnly || catalogVideo.isFavorite) &&
    (normalizedSearchText.length === 0 ||
      catalogVideo.title.toLocaleLowerCase().includes(normalizedSearchText)) &&
    (filters.minimumDurationMinutes === "" ||
      durationMinutes >= filters.minimumDurationMinutes)
  );
}

function catalogVideoFilters(
  filters: Partial<CatalogVideoFilters>,
): CatalogVideoFilters {
  return {
    ...defaultCatalogVideoFilters,
    showUnavailableVideos: true,
    hideSecretMetadata: false,
    ...filters,
  };
}

function catalogVideo(
  video: Partial<CatalogVideo> & Pick<CatalogVideo, "id">,
): CatalogVideo {
  const videoTitle = video.title ?? "Catalog Video";
  const fileLocationPath = `/Videos/${videoTitle}.mp4`;

  return {
    durationMilliseconds: 30 * 60_000,
    fileLocationPath,
    fileLocations: [
      {
        fileSizeBytes: video.fileSizeBytes ?? 100,
        isPreferred: true,
        isReachable: true,
        path: fileLocationPath,
      },
    ],
    fileSizeBytes: 100,
    isAvailable: true,
    isFavorite: false,
    lastOpenedAt: null,
    openCount: 0,
    previewStrip: { status: "pending" },
    title: videoTitle,
    ...video,
  };
}
