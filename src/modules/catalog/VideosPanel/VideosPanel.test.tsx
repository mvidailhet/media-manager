import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../../AppProviders";
import type { CatalogVideo } from "../../../tauriCommands";
import {
  defaultCatalogVideoFilters,
  type CatalogVideoMetadata,
} from "../catalogTypes";
import { VideosPanel } from "./VideosPanel";
import { incrementalVideoResultBatchSize } from "./useVideosPanelController";

vi.mock("./components/VideoGrid", () => ({
  VideoGrid: ({ catalogVideos }: { catalogVideos: CatalogVideo[] }) => (
    <div aria-label="Video grid">
      {catalogVideos.map((catalogVideo) => (
        <article aria-label={catalogVideo.title} key={catalogVideo.id} />
      ))}
    </div>
  ),
}));

function catalogVideoFixture(id: number): CatalogVideo {
  return {
    id,
    title: `Archive Clip ${String(id).padStart(3, "0")}`,
    durationMilliseconds: 1800000,
    fileSizeBytes: id,
    fileLocationPath: `/Volumes/Archive/Videos/archive-clip-${id}.mp4`,
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
    catalogVideoFixture(index + 1),
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

function renderVideosPanel({
  catalogVideos,
  hasMoreCatalogVideos,
  onExposeNextCatalogVideoBatch,
}: {
  catalogVideos: CatalogVideo[];
  hasMoreCatalogVideos: boolean;
  onExposeNextCatalogVideoBatch: () => void;
}) {
  return render(
    <AppProviders>
      <VideosPanel
        availablePerformers={[]}
        availableTags={[]}
        catalogVideoActionStatusMessage=""
        catalogVideoFilters={defaultCatalogVideoFilters}
        catalogVideoMetadataById={metadataByVideoId(catalogVideos)}
        catalogVideoSort="titleAscending"
        catalogVideos={catalogVideos}
        catalogVideosStatusMessage=""
        hasMoreCatalogVideos={hasMoreCatalogVideos}
        onCatalogVideoFiltersChange={vi.fn()}
        onCatalogVideoSortChange={vi.fn()}
        onClearVideoSelection={vi.fn()}
        onExposeNextCatalogVideoBatch={onExposeNextCatalogVideoBatch}
        onReplaceSelectedVideos={vi.fn()}
        onSelectVideo={vi.fn()}
        onSetFavorite={vi.fn()}
        selectedDetailVideoId={null}
        selectedVideoIds={[]}
      />
    </AppProviders>,
  );
}

describe("VideosPanel", () => {
  it("exposes more Incremental Video Results when scrolling near the end", () => {
    const exposedCatalogVideos = catalogVideoBatch(incrementalVideoResultBatchSize);
    const nextBatchCatalogVideos = catalogVideoBatch(
      incrementalVideoResultBatchSize + 3,
    );
    const exposeNextCatalogVideoBatch = vi.fn();
    const { rerender } = renderVideosPanel({
      catalogVideos: exposedCatalogVideos,
      hasMoreCatalogVideos: true,
      onExposeNextCatalogVideoBatch: exposeNextCatalogVideoBatch,
    });
    const catalogVideos = screen.getByRole("region", { name: "Catalog Videos" });
    Object.defineProperties(catalogVideos, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1200 },
      scrollTop: { configurable: true, value: 760, writable: true },
    });

    fireEvent.scroll(catalogVideos);

    expect(exposeNextCatalogVideoBatch).toHaveBeenCalledTimes(1);

    rerender(
      <AppProviders>
        <VideosPanel
          availablePerformers={[]}
          availableTags={[]}
          catalogVideoActionStatusMessage=""
          catalogVideoFilters={defaultCatalogVideoFilters}
          catalogVideoMetadataById={metadataByVideoId(nextBatchCatalogVideos)}
          catalogVideoSort="titleAscending"
          catalogVideos={nextBatchCatalogVideos}
          catalogVideosStatusMessage=""
          hasMoreCatalogVideos={false}
          onCatalogVideoFiltersChange={vi.fn()}
          onCatalogVideoSortChange={vi.fn()}
          onClearVideoSelection={vi.fn()}
          onExposeNextCatalogVideoBatch={exposeNextCatalogVideoBatch}
          onReplaceSelectedVideos={vi.fn()}
          onSelectVideo={vi.fn()}
          onSetFavorite={vi.fn()}
          selectedDetailVideoId={null}
          selectedVideoIds={[]}
        />
      </AppProviders>,
    );

    expect(
      screen.getByRole("article", {
        name: `Archive Clip ${String(incrementalVideoResultBatchSize + 1).padStart(3, "0")}`,
      }),
    ).toBeInTheDocument();
  });
});
