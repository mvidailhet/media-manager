import { describe, expect, it } from "vitest";

import appSource from "../../App.tsx?raw";
import catalogModuleSource from "./CatalogModule.tsx?raw";
import catalogVideoCardSource from "./CatalogVideosPanel/components/CatalogVideoCard.tsx?raw";
import catalogVideoDurationFiltersSource from "./CatalogVideosPanel/catalogVideoDurationFilters.ts?raw";
import catalogVideoFiltersPanelSource from "./CatalogVideosPanel/components/CatalogVideoFiltersPanel.tsx?raw";
import metadataBadgesSource from "./CatalogVideosPanel/components/MetadataBadges.tsx?raw";
import catalogVideosPanelSource from "./CatalogVideosPanel.tsx?raw";
import catalogControllerSource from "./useCatalogModuleController.ts?raw";

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
  });
});
