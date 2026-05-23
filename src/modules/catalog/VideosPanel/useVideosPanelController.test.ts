import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CatalogVideo } from "../../../tauriCommands";
import type { CatalogVideoMetadata } from "../catalogTypes";
import {
  incrementalVideoResultBatchSize,
  useVideosPanelController,
} from "./useVideosPanelController";

function catalogVideoFixture(id: number, title: string): CatalogVideo {
  return {
    id,
    title,
    durationMilliseconds: 1800000,
    fileSizeBytes: id,
    fileLocationPath: `/Volumes/Archive/Videos/${title.toLowerCase().replace(/ /g, "-")}.mp4`,
    fileLocations: [],
    isAvailable: true,
    isFavorite: false,
    lastOpenedAt: null,
    openCount: 0,
    previewStrip: { status: "pending" },
  };
}

function catalogVideoBatch(count: number) {
  return Array.from({ length: count }, (_value, index) =>
    catalogVideoFixture(
      index + 1,
      `Archive Clip ${String(index + 1).padStart(3, "0")}`,
    ),
  );
}

function metadataByVideoId(catalogVideos: CatalogVideo[]) {
  return Object.fromEntries(
    catalogVideos.map((catalogVideo) => [
      catalogVideo.id,
      { tags: [], performers: [] } satisfies CatalogVideoMetadata,
    ]),
  );
}

describe("useVideosPanelController", () => {
  it("does not expose every matching Video at first for large result sets", () => {
    const catalogVideos = catalogVideoBatch(incrementalVideoResultBatchSize * 3);
    const { result } = renderHook(() =>
      useVideosPanelController({
        catalogVideoMetadataById: metadataByVideoId(catalogVideos),
        catalogVideos,
      }),
    );

    expect(result.current.filteredCatalogVideos).toHaveLength(
      incrementalVideoResultBatchSize,
    );
    expect(result.current.matchingCatalogVideos).toHaveLength(
      incrementalVideoResultBatchSize * 3,
    );
    expect(result.current.hasMoreFilteredCatalogVideos).toBe(true);
  });

  it("exposes more Incremental Video Results when the next batch is requested", () => {
    const catalogVideos = catalogVideoBatch(incrementalVideoResultBatchSize + 3);
    const { result } = renderHook(() =>
      useVideosPanelController({
        catalogVideoMetadataById: metadataByVideoId(catalogVideos),
        catalogVideos,
      }),
    );

    act(() => result.current.exposeNextCatalogVideoBatch());

    expect(result.current.filteredCatalogVideos).toHaveLength(
      incrementalVideoResultBatchSize + 3,
    );
    expect(result.current.hasMoreFilteredCatalogVideos).toBe(false);
  });

  it("resets exposed Videos when filters change", () => {
    const catalogVideos = catalogVideoBatch(incrementalVideoResultBatchSize + 3);
    const { result } = renderHook(() =>
      useVideosPanelController({
        catalogVideoMetadataById: metadataByVideoId(catalogVideos),
        catalogVideos,
      }),
    );

    act(() => result.current.exposeNextCatalogVideoBatch());
    expect(result.current.filteredCatalogVideos).toHaveLength(
      incrementalVideoResultBatchSize + 3,
    );

    act(() =>
      result.current.setCatalogVideoFilters({
        ...result.current.catalogVideoFilters,
        searchText: "Archive Clip",
      }),
    );

    expect(result.current.filteredCatalogVideos).toHaveLength(
      incrementalVideoResultBatchSize,
    );
  });

  it("resets exposed Videos when sort changes", () => {
    const catalogVideos = catalogVideoBatch(incrementalVideoResultBatchSize + 3);
    const { result } = renderHook(() =>
      useVideosPanelController({
        catalogVideoMetadataById: metadataByVideoId(catalogVideos),
        catalogVideos,
      }),
    );

    act(() => result.current.exposeNextCatalogVideoBatch());
    expect(result.current.filteredCatalogVideos).toHaveLength(
      incrementalVideoResultBatchSize + 3,
    );

    act(() => result.current.setCatalogVideoSort("fileSizeDescending"));

    expect(result.current.filteredCatalogVideos).toHaveLength(
      incrementalVideoResultBatchSize,
    );
  });
});
