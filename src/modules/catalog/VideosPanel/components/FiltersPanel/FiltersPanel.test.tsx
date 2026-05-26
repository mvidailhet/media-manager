import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  CatalogPerformer,
  CatalogTag,
  CatalogVideo,
  ScanRoot,
} from "../../../../../tauriCommands";
import type { CatalogVideoFilters, CatalogVideoMetadata } from "../../../catalogTypes";
import { defaultCatalogVideoFilters } from "../../../catalogTypes";
import { FiltersPanel } from "./FiltersPanel";

const archiveScanRootPath = "/Volumes/Archive/Videos";
const catalogVideoFileSizeBytes = 1000;
const catalogVideoDurationMilliseconds = 60_000;
const scanRoots = [scanRoot(archiveScanRootPath)];

describe("FiltersPanel", () => {
  it("does not rebuild visible metadata or counts when selected Tags change", () => {
    const travelTag = tag(4, "Travel");
    const blairPerformer = performer(9, "Blair");
    const availableTags = [travelTag];
    const availablePerformers = [blairPerformer];
    const catalogVideos = [
      catalogVideo(1, "Paris Day One"),
      catalogVideo(2, "Paris Day Two"),
    ];
    const metadataLookupCountByVideoId = new Map<number, number>();
    const catalogVideoMetadataById = countingMetadataById({
      metadataById: {
        1: { tags: [travelTag], performers: [blairPerformer] },
        2: { tags: [travelTag], performers: [] },
      },
      lookupCountByVideoId: metadataLookupCountByVideoId,
    });
    const initialFilters = catalogVideoFilters({ selectedTagIds: [] });
    const { rerender } = renderFiltersPanel({
      availablePerformers,
      availableTags,
      catalogVideoMetadataById,
      catalogVideos,
      filters: initialFilters,
      metadataCountVideos: catalogVideos,
    });

    expect(screen.getByText("Travel (2)")).toBeInTheDocument();
    expect(screen.getByText("Blair (1)")).toBeInTheDocument();

    metadataLookupCountByVideoId.clear();
    rerenderFiltersPanel(rerender, {
      availablePerformers,
      availableTags,
      catalogVideoMetadataById,
      catalogVideos,
      filters: catalogVideoFilters({ selectedTagIds: [travelTag.id] }),
      metadataCountVideos: catalogVideos,
    });

    expect(screen.getByText("Travel (2)")).toBeInTheDocument();
    expect(screen.getByText("Blair (1)")).toBeInTheDocument();
    expect(totalMetadataLookups(metadataLookupCountByVideoId)).toBe(0);
  });
});

function renderFiltersPanel(props: FiltersPanelProps) {
  return render(
    <MantineProvider>
      <FiltersPanelHarness {...props} />
    </MantineProvider>,
  );
}

function rerenderFiltersPanel(
  rerender: ReturnType<typeof render>["rerender"],
  props: FiltersPanelProps,
) {
  rerender(
    <MantineProvider>
      <FiltersPanelHarness {...props} />
    </MantineProvider>,
  );
}

function FiltersPanelHarness(props: FiltersPanelProps) {
  return (
    <FiltersPanel
      {...props}
      onFiltersChange={vi.fn()}
      scanRoots={scanRoots}
    />
  );
}

interface FiltersPanelProps {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  catalogVideoMetadataById: Record<number, CatalogVideoMetadata>;
  catalogVideos: CatalogVideo[];
  filters: CatalogVideoFilters;
  metadataCountVideos: CatalogVideo[];
}

function catalogVideoFilters(
  filters: Partial<CatalogVideoFilters>,
): CatalogVideoFilters {
  return {
    ...defaultCatalogVideoFilters,
    ...filters,
  };
}

function countingMetadataById({
  metadataById,
  lookupCountByVideoId,
}: {
  metadataById: Record<number, CatalogVideoMetadata>;
  lookupCountByVideoId: Map<number, number>;
}) {
  return new Proxy(metadataById, {
    get(target, property) {
      if (typeof property !== "string") {
        return Reflect.get(target, property);
      }

      const videoId = Number(property);

      if (Number.isInteger(videoId)) {
        lookupCountByVideoId.set(
          videoId,
          (lookupCountByVideoId.get(videoId) ?? 0) + 1,
        );
      }

      return Reflect.get(target, property);
    },
  });
}

function totalMetadataLookups(lookupCountByVideoId: Map<number, number>) {
  return Array.from(lookupCountByVideoId.values()).reduce(
    (totalLookups, videoLookups) => totalLookups + videoLookups,
    0,
  );
}

function tag(id: number, name: string, isSecret = false): CatalogTag {
  return { id, name, isSecret };
}

function performer(
  id: number,
  name: string,
  isSecret = false,
): CatalogPerformer {
  return { id, name, isSecret };
}

function scanRoot(path: string): ScanRoot {
  return {
    path,
    isAvailable: true,
    inferenceRules: {
      suggestTagsFromFolderNames: false,
      suggestTagsFromFilenameBrackets: false,
      ignoredFolderNames: [],
      ignoredExactYearRange: {
        startYear: 1900,
        endYear: 2100,
      },
    },
  };
}

function catalogVideo(id: number, title: string): CatalogVideo {
  const fileLocationPath = `${archiveScanRootPath}/${title}.mp4`;

  return {
    id,
    title,
    durationMilliseconds: catalogVideoDurationMilliseconds,
    fileSizeBytes: catalogVideoFileSizeBytes,
    fileLocationPath,
    fileLocations: [
      {
        path: fileLocationPath,
        fileSizeBytes: catalogVideoFileSizeBytes,
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
