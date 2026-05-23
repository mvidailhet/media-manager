import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../../../AppProviders";
import type { CatalogVideo } from "../../../../tauriCommands";
import {
  VideoGrid,
  videoColumnCountForWidth,
  virtualRowElementKeyFor,
  virtualRowsForPerformerGroups,
} from "./VideoGrid";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}));

const mountedVideoWindowMaximum = 30;
const largeVisibleResultCount = 100;

const performer = {
  id: 1,
  name: "Ada Performer",
};
const otherPerformer = {
  id: 2,
  name: "Grace Performer",
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

  it("limits v1 drag selection to mounted visible Video Cards", () => {
    const catalogVideos = Array.from(
      { length: largeVisibleResultCount },
      (_value, index) => catalogVideo(index + 1),
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
    const replaceSelectedVideos = vi.fn();

    render(
      <AppProviders>
        <VideoGrid
          catalogVideoMetadataById={catalogVideoMetadataById}
          catalogVideos={catalogVideos}
          onClearVideoSelection={vi.fn()}
          onReplaceSelectedVideos={replaceSelectedVideos}
          onSelectVideo={vi.fn()}
          onSetFavorite={vi.fn()}
          selectedDetailVideoId={null}
          selectedVideoIds={[]}
        />
      </AppProviders>,
    );

    const mountedVideoCards = screen.getAllByRole("article");
    mountedVideoCards.forEach((videoCard, index) => {
      vi.spyOn(videoCard, "getBoundingClientRect").mockReturnValue({
        bottom: 100,
        height: 100,
        left: index * 120,
        right: index * 120 + 100,
        top: 0,
        width: 100,
        x: index * 120,
        y: 0,
        toJSON: () => ({}),
      });
    });

    const videoGrid = screen.getByLabelText("Video grid");

    fireEvent.pointerDown(videoGrid, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(videoGrid, { clientX: 10000, clientY: 10000 });
    fireEvent.pointerUp(videoGrid, { clientX: 10000, clientY: 10000 });

    const mountedVideoIds = mountedVideoCards.map((videoCard) =>
      Number(videoCard.dataset.videoId),
    );

    expect(replaceSelectedVideos).toHaveBeenCalledWith(mountedVideoIds);
    expect(mountedVideoIds.length).toBeLessThan(largeVisibleResultCount);
  });

  it("marks a selected Video when its Card remounts inside the Visible Video Window", () => {
    const selectedVideo = catalogVideo(100);
    const firstVisibleVideos = [catalogVideo(1), catalogVideo(2)];
    const remountedVisibleVideos = [selectedVideo, catalogVideo(101)];
    const visibleVideos = [...firstVisibleVideos, ...remountedVisibleVideos];
    const catalogVideoMetadataById = Object.fromEntries(
      visibleVideos.map((video) => [
        video.id,
        {
          tags: [],
          performers: [performer],
        },
      ]),
    );
    const { rerender } = render(
      <AppProviders>
        <VideoGrid
          catalogVideoMetadataById={catalogVideoMetadataById}
          catalogVideos={firstVisibleVideos}
          onClearVideoSelection={vi.fn()}
          onReplaceSelectedVideos={vi.fn()}
          onSelectVideo={vi.fn()}
          onSetFavorite={vi.fn()}
          selectedDetailVideoId={null}
          selectedVideoIds={[selectedVideo.id]}
        />
      </AppProviders>,
    );

    expect(
      screen.queryByRole("article", { name: selectedVideo.title }),
    ).not.toBeInTheDocument();

    rerender(
      <AppProviders>
        <VideoGrid
          catalogVideoMetadataById={catalogVideoMetadataById}
          catalogVideos={remountedVisibleVideos}
          onClearVideoSelection={vi.fn()}
          onReplaceSelectedVideos={vi.fn()}
          onSelectVideo={vi.fn()}
          onSetFavorite={vi.fn()}
          selectedDetailVideoId={null}
          selectedVideoIds={[selectedVideo.id]}
        />
      </AppProviders>,
    );

    expect(
      screen.getByRole("article", { name: selectedVideo.title }).className,
    ).toContain("batchSelectedCard");
  });

  it("counts every card column that fits inside the available grid width", () => {
    expect(videoColumnCountForWidth(811)).toBe(1);
    expect(videoColumnCountForWidth(812)).toBe(2);
    expect(videoColumnCountForWidth(1224)).toBe(3);
  });

  it("remounts visible virtual rows when the column count changes", () => {
    const rowKey = "videos-1-0";

    expect(
      virtualRowElementKeyFor({
        rowKey,
        columnCount: 2,
      }),
    ).not.toBe(
      virtualRowElementKeyFor({
        rowKey,
        columnCount: 3,
      }),
    );
  });

  it("keeps performer header spacing tied to logical group position", () => {
    const rows = virtualRowsForPerformerGroups(
      [
        {
          performer,
          videos: [catalogVideo(1)],
        },
        {
          performer: otherPerformer,
          videos: [catalogVideo(2)],
        },
      ],
      1,
    );

    expect(rows).toMatchObject([
      { kind: "header", hasTopSpacing: false },
      { kind: "videos" },
      { kind: "header", hasTopSpacing: true },
      { kind: "videos" },
    ]);
  });

  it("keeps performer group headers in large grouped results", () => {
    const rows = virtualRowsForPerformerGroups(
      [
        {
          performer,
          videos: Array.from({ length: largeVisibleResultCount }, (_value, index) =>
            catalogVideo(index + 1),
          ),
        },
        {
          performer: otherPerformer,
          videos: Array.from({ length: largeVisibleResultCount }, (_value, index) =>
            catalogVideo(index + largeVisibleResultCount + 1),
          ),
        },
      ],
      2,
    );

    expect(rows).toContainEqual(
      expect.objectContaining({
        kind: "header",
        performer,
      }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        kind: "header",
        performer: otherPerformer,
      }),
    );
  });
});
