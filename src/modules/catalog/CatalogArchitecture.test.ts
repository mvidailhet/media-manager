import { describe, expect, it } from "vitest";

import appSource from "../../App.tsx?raw";
import batchMetadataEditPanelSource from "./BatchMetadataEditPanel.tsx?raw";
import catalogModuleEntryPointSource from "./index.ts?raw";
import catalogModuleSource from "./CatalogModule.tsx?raw";
import metadataBadgesSource from "./components/MetadataBadges.tsx?raw";
import metadataSuggestionsPanelSource from "./MetadataSuggestionsPanel/MetadataSuggestionsPanel.tsx?raw";
import metadataSuggestionSourceSource from "./MetadataSuggestionsPanel/components/MetadataSuggestionSource.tsx?raw";
import metadataSuggestionTreeSource from "./MetadataSuggestionsPanel/metadataSuggestionTree.ts?raw";
import catalogControllerSource from "./useCatalogModuleController.ts?raw";

const videosPanelFiles = import.meta.glob("./VideosPanel/**/*.{ts,tsx,css}", {
  eager: true,
  query: "?raw",
  import: "default",
});
const videosPanelBarrelFiles = import.meta.glob("./VideosPanel/**/index.*", {
  eager: true,
  query: "?raw",
});
const legacyCatalogVideosPanelFiles = import.meta.glob(
  "./CatalogVideosPanel*/**/*.{ts,tsx,css}",
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
);
const legacyCatalogVideosPanelTopLevelFiles = import.meta.glob(
  "./CatalogVideosPanel*.{ts,tsx,css}",
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
);
const batchMetadataEditPanelBarrelFiles = import.meta.glob(
  "./BatchMetadataEditPanel/**/index.*",
  {
    eager: true,
    query: "?raw",
  },
);
const batchMetadataEditPanelFiles = import.meta.glob(
  "./BatchMetadataEditPanel/**/*.tsx",
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
);
const catalogModuleDetailAsideFiles = import.meta.glob(
  "./CatalogModuleDetailAside.tsx",
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
);
const metadataSuggestionsPanelBarrelFiles = import.meta.glob(
  "./MetadataSuggestionsPanel/**/index.*",
  {
    eager: true,
    query: "?raw",
  },
);
const videoDetailPanelBarrelFiles = import.meta.glob(
  "./VideoDetailPanel/**/index.*",
  {
    eager: true,
    query: "?raw",
  },
);
const videoPreviewBarrelFiles = import.meta.glob(
  "./components/VideoPreview/**/index.*",
  {
    eager: true,
    query: "?raw",
  },
);
const videoDetailPanelFiles = import.meta.glob("./VideoDetailPanel/**/*.tsx", {
  eager: true,
  query: "?raw",
  import: "default",
});
const videoPreviewFiles = import.meta.glob(
  "./components/VideoPreview/**/*.{ts,tsx,css}",
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
);

function rawSource(
  files: Record<string, unknown>,
  path: string,
) {
  return String(files[path] ?? "");
}

describe("Catalog module boundaries", () => {
  it("keeps Catalog data hooks behind the Catalog module boundary", () => {
    expect(appSource).not.toMatch(/useCatalogVideos/);
    expect(appSource).not.toMatch(/useCatalogMetadata/);
    expect(catalogControllerSource).toMatch(/useCatalogVideos/);
    expect(catalogControllerSource).toMatch(/useCatalogMetadata/);
  });

  it("keeps Catalog panels owned by the Catalog module", () => {
    expect(appSource).not.toMatch(/VideosPanel/);
    expect(catalogModuleSource).toMatch(/VideosPanel/);
  });

  it("keeps Metadata Suggestions panel, source, and tree helpers in focused files", () => {
    const metadataSuggestionsPanelFolder = new URL(
      "./MetadataSuggestionsPanel/",
      import.meta.url,
    );

    expect(metadataSuggestionsPanelFolder.pathname).toContain(
      "/src/modules/catalog/MetadataSuggestionsPanel",
    );
    expect(Object.keys(metadataSuggestionsPanelBarrelFiles)).toHaveLength(0);
    expect(metadataSuggestionsPanelSource).toMatch(/MetadataSuggestionSource/);
    expect(metadataSuggestionsPanelSource).not.toMatch(/useTree/);
    expect(metadataSuggestionsPanelSource).not.toMatch(/Tree\.NodeData/);
    expect(metadataSuggestionSourceSource).toMatch(/useTree/);
    expect(metadataSuggestionSourceSource).toMatch(/buildSuggestionVideoTree/);
    expect(metadataSuggestionTreeSource).toMatch(/Tree\.NodeData/);
    expect(metadataSuggestionTreeSource).toMatch(/getSelectedVideoIds/);
  });

  it("keeps the Videos panel folder-owned with focused children", () => {
    const videosPanelSource = rawSource(
      videosPanelFiles,
      "./VideosPanel/VideosPanel.tsx",
    );
    const filtersPanelSource = rawSource(
      videosPanelFiles,
      "./VideosPanel/components/FiltersPanel.tsx",
    );
    const sortSelectSource = rawSource(
      videosPanelFiles,
      "./VideosPanel/components/SortSelect.tsx",
    );
    const statusMessagesSource = rawSource(
      videosPanelFiles,
      "./VideosPanel/components/StatusMessages.tsx",
    );
    const videoGridSource = rawSource(
      videosPanelFiles,
      "./VideosPanel/components/VideoGrid.tsx",
    );
    const videoCardSource = rawSource(
      videosPanelFiles,
      "./VideosPanel/components/VideoCard.tsx",
    );
    const durationFiltersSource = rawSource(
      videosPanelFiles,
      "./VideosPanel/catalogVideoDurationFilters.ts",
    );

    expect(videosPanelSource).toMatch(/function VideosPanel/);
    expect(filtersPanelSource).toMatch(/function FiltersPanel/);
    expect(sortSelectSource).toMatch(/function SortSelect/);
    expect(statusMessagesSource).toMatch(/function StatusMessages/);
    expect(videoGridSource).toMatch(/function VideoGrid/);
    expect(videoCardSource).toMatch(/function VideoCard/);
    expect(metadataBadgesSource).toMatch(/function MetadataBadges/);
    expect(durationFiltersSource).toMatch(/function formatDurationRange/);
    expect(videosPanelSource).not.toMatch(/function FiltersPanel/);
    expect(videosPanelSource).not.toMatch(/function SortSelect/);
    expect(videosPanelSource).not.toMatch(/function StatusMessages/);
    expect(videosPanelSource).not.toMatch(/function VideoGrid/);
    expect(videosPanelSource).not.toMatch(/function VideoCard/);
    expect(videosPanelSource).not.toMatch(/function MetadataBadges/);
    expect(videosPanelSource).not.toMatch(/function formatDurationRange/);
    expect(videosPanelSource).not.toMatch(/function formatDurationFilterValue/);
    expect(filtersPanelSource).toMatch(
      /from "\.\.\/catalogVideoDurationFilters"/,
    );
    expect(videoGridSource).toMatch(/".\/VideoCard"/);
    expect(Object.keys(videosPanelBarrelFiles)).toEqual([
      "./VideosPanel/index.ts",
    ]);
    expect(Object.keys(legacyCatalogVideosPanelFiles)).toHaveLength(0);
    expect(Object.keys(legacyCatalogVideosPanelTopLevelFiles)).toHaveLength(0);
  });

  it("keeps Batch Metadata Edit actions in a focused file", () => {
    const batchMetadataActionsSource = rawSource(
      batchMetadataEditPanelFiles,
      "./BatchMetadataEditPanel/components/BatchMetadataActions.tsx",
    );

    expect(batchMetadataActionsSource).not.toBe("");
    expect(batchMetadataActionsSource).toMatch(/function BatchMetadataActions/);
    expect(batchMetadataActionsSource).toMatch(/findMetadataByName/);
    expect(batchMetadataActionsSource).toMatch(/findNearMetadataMatch/);
    expect(batchMetadataEditPanelSource).toMatch(
      /".\/BatchMetadataEditPanel\/components\/BatchMetadataActions"/,
    );
    expect(batchMetadataEditPanelSource).not.toMatch(
      /function BatchMetadataActions/,
    );
    expect(Object.keys(batchMetadataEditPanelBarrelFiles)).toHaveLength(0);
  });

  it("keeps the Catalog detail aside in a focused file imported directly by App", () => {
    const catalogModuleDetailAsideSource = rawSource(
      catalogModuleDetailAsideFiles,
      "./CatalogModuleDetailAside.tsx",
    );

    expect(catalogModuleDetailAsideSource).not.toBe("");
    expect(catalogModuleDetailAsideSource).toMatch(
      /function CatalogModuleDetailAside/,
    );
    expect(catalogModuleDetailAsideSource).toMatch(
      /useSelectedVideoDetailActions/,
    );
    expect(catalogModuleDetailAsideSource).toMatch(/VideoDetailPanel/);
    expect(catalogModuleSource).not.toMatch(/function CatalogModuleDetailAside/);
    expect(catalogModuleEntryPointSource).not.toMatch(
      /CatalogModuleDetailAside/,
    );
    expect(appSource).toMatch(
      /from "\.\/modules\/catalog\/CatalogModuleDetailAside"/,
    );
  });

  it("keeps Video detail and preview pieces in focused files", () => {
    const videoDetailPanelSource = rawSource(
      videoDetailPanelFiles,
      "./VideoDetailPanel/VideoDetailPanel.tsx",
    );
    const videoMetadataSectionSource = rawSource(
      videoDetailPanelFiles,
      "./VideoDetailPanel/components/VideoMetadataSection.tsx",
    );
    const videoPreviewSource = rawSource(
      videoPreviewFiles,
      "./components/VideoPreview/VideoPreview.tsx",
    );
    const previewStripSurfaceSource = rawSource(
      videoPreviewFiles,
      "./components/VideoPreview/components/PreviewStripSurface.tsx",
    );
    const previewStripFrameSource = rawSource(
      videoPreviewFiles,
      "./components/VideoPreview/previewStripFrame.ts",
    );

    expect(videoDetailPanelSource).not.toBe("");
    expect(videoMetadataSectionSource).toMatch(/function VideoMetadataSection/);
    expect(videoMetadataSectionSource).toMatch(
      /from "\.\.\/\.\.\/components\/MetadataBadges"/,
    );
    expect(videoDetailPanelSource).toMatch(
      /".\/components\/VideoMetadataSection"/,
    );
    expect(videoDetailPanelSource).not.toMatch(/function VideoMetadataSection/);
    expect(videoDetailPanelSource).not.toMatch(/TagsInput/);

    expect(videoPreviewSource).toMatch(/".\/components\/PreviewStripSurface"/);
    expect(videoPreviewSource).toMatch(/".\/VideoPreview\.module\.css"/);
    expect(videoPreviewSource).not.toMatch(/function PreviewStripSurface/);
    expect(previewStripSurfaceSource).toMatch(/function PreviewStripSurface/);
    expect(previewStripSurfaceSource).toMatch(/previewStripFramePosition/);
    expect(previewStripFrameSource).toMatch(
      /function previewStripFrameIndexFromPointer/,
    );
    expect(previewStripFrameSource).toMatch(
      /function previewStripFramePosition/,
    );
    expect(Object.keys(videoDetailPanelBarrelFiles)).toHaveLength(0);
    expect(Object.keys(videoPreviewBarrelFiles)).toHaveLength(0);
  });
});
