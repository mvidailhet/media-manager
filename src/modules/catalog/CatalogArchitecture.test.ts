import { describe, expect, it } from "vitest";

import appSource from "../../App.tsx?raw";
import catalogModuleSource from "./CatalogModule.tsx?raw";
import catalogVideoCardSource from "./CatalogVideosPanel/components/CatalogVideoCard.tsx?raw";
import catalogVideoDurationFiltersSource from "./CatalogVideosPanel/catalogVideoDurationFilters.ts?raw";
import catalogVideoFiltersPanelSource from "./CatalogVideosPanel/components/CatalogVideoFiltersPanel.tsx?raw";
import metadataBadgesSource from "./CatalogVideosPanel/components/MetadataBadges.tsx?raw";
import catalogVideosPanelSource from "./CatalogVideosPanel.tsx?raw";
import metadataSuggestionsPanelSource from "./MetadataSuggestionsPanel/MetadataSuggestionsPanel.tsx?raw";
import metadataSuggestionSourceSource from "./MetadataSuggestionsPanel/components/MetadataSuggestionSource.tsx?raw";
import metadataSuggestionTreeSource from "./MetadataSuggestionsPanel/metadataSuggestionTree.ts?raw";
import catalogControllerSource from "./useCatalogModuleController.ts?raw";

const catalogVideosPanelBarrelFiles = import.meta.glob(
  "./CatalogVideosPanel/index.*",
  {
    eager: true,
    query: "?raw",
  },
);
const metadataSuggestionsPanelBarrelFiles = import.meta.glob(
  "./MetadataSuggestionsPanel/**/index.*",
  {
    eager: true,
    query: "?raw",
  },
);

describe("Catalog module boundaries", () => {
  it("keeps Catalog data hooks behind the Catalog module boundary", () => {
    expect(appSource).not.toMatch(/useCatalogVideos/);
    expect(appSource).not.toMatch(/useCatalogMetadata/);
    expect(catalogControllerSource).toMatch(/useCatalogVideos/);
    expect(catalogControllerSource).toMatch(/useCatalogMetadata/);
  });

  it("keeps Catalog panels owned by the Catalog module", () => {
    expect(appSource).not.toMatch(/CatalogVideosPanel/);
    expect(catalogModuleSource).toMatch(/CatalogVideosPanel/);
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

  it("keeps Catalog Videos panel pieces in focused files", () => {
    expect(catalogVideoFiltersPanelSource).toMatch(
      /function CatalogVideoFiltersPanel/,
    );
    expect(catalogVideoCardSource).toMatch(/function CatalogVideoCard/);
    expect(metadataBadgesSource).toMatch(/function MetadataBadges/);
    expect(catalogVideoDurationFiltersSource).toMatch(
      /function formatDurationRange/,
    );
    expect(catalogVideosPanelSource).not.toMatch(
      /function CatalogVideoFiltersPanel/,
    );
    expect(catalogVideosPanelSource).not.toMatch(/function CatalogVideoCard/);
    expect(catalogVideosPanelSource).not.toMatch(/function MetadataBadges/);
    expect(catalogVideosPanelSource).not.toMatch(
      /function formatDurationRange/,
    );
    expect(catalogVideosPanelSource).not.toMatch(
      /function formatDurationFilterValue/,
    );
    expect(Object.keys(catalogVideosPanelBarrelFiles)).toHaveLength(0);
  });
});
