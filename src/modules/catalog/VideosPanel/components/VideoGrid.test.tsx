import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../../../AppProviders";
import type { CatalogVideo } from "../../../../tauriCommands";
import { VideoGrid } from "./VideoGrid";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}));

const mountedVideoWindowMaximum = 30;
const largeVisibleResultCount = 100;

const performer = {
  id: 1,
  name: "Ada Performer",
};

function catalogVideo(id: number): CatalogVideo {
  return {
    id,
    title: `Catalog Video ${id}`,
    durationMilliseconds: 90_000,
    fileSizeBytes: 1_000_000,
    fileLocationPath: `/Volumes/Archive/Videos/catalog-video-${id}.mp4`,
    fileLocations: [
      {
        path: `/Volumes/Archive/Videos/catalog-video-${id}.mp4`,
        fileSizeBytes: 1_000_000,
        isPreferred: true,
        isReachable: true,
      },
    ],
    isAvailable: true,
    isFavorite: false,
    lastOpenedAt: null,
    openCount: 0,
    previewStrip: { status: "pending" },
  };
}

describe("VideoGrid", () => {
  it("mounts only the visible Video Cards while keeping grouped performer headers", () => {
    const catalogVideos = Array.from(
      { length: largeVisibleResultCount },
      (_, index) => catalogVideo(index + 1),
    );
    const catalogVideoMetadataById = Object.fromEntries(
      catalogVideos.map((video) => [
        video.id,
        {
          tags: [],
          performers: [performer],
        },
      ]),
    );

    render(
      <AppProviders>
        <VideoGrid
          catalogVideoMetadataById={catalogVideoMetadataById}
          catalogVideos={catalogVideos}
          onClearVideoSelection={vi.fn()}
          onReplaceSelectedVideos={vi.fn()}
          onSelectVideo={vi.fn()}
          onSetFavorite={vi.fn()}
          selectedDetailVideoId={null}
          selectedVideoIds={[]}
        />
      </AppProviders>,
    );

    expect(screen.getAllByText("Ada Performer").length).toBeGreaterThan(0);
    const mountedVideoCards = screen.getAllByRole("article");

    expect(mountedVideoCards.length).toBeGreaterThan(0);
    expect(mountedVideoCards.length).toBeLessThanOrEqual(
      mountedVideoWindowMaximum,
    );
  });
});
