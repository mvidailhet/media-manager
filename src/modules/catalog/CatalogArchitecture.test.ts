import { describe, expect, it } from "vitest";

import appSource from "../../App.tsx?raw";
import catalogModuleSource from "./CatalogModule.tsx?raw";
import metadataSuggestionsPanelSource from "./MetadataSuggestionsPanel/MetadataSuggestionsPanel.tsx?raw";
import metadataSuggestionSourceSource from "./MetadataSuggestionsPanel/components/MetadataSuggestionSource.tsx?raw";
import metadataSuggestionTreeSource from "./MetadataSuggestionsPanel/metadataSuggestionTree.ts?raw";
import catalogControllerSource from "./useCatalogModuleController.ts?raw";

const metadataSuggestionsPanelBarrelFiles = import.meta.glob(
  "./MetadataSuggestionsPanel/index.ts",
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

  it("keeps Metadata Suggestions panel, source, and tree helpers in focused files", async () => {
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
});
