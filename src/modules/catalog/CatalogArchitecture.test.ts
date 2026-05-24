import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import appSource from "../../App.tsx?raw";
import catalogModuleEntryPointSource from "./index.ts?raw";
import catalogSource from "./Catalog.tsx?raw";
import metadataSuggestionsSectionSource from "./components/MetadataSuggestionsSection.tsx?raw";
import metadataBadgesSource from "./components/MetadataBadges.tsx?raw";
import metadataSuggestionsPanelSource from "./MetadataSuggestionsPanel/MetadataSuggestionsPanel.tsx?raw";
import metadataSuggestionTreeSource from "./MetadataSuggestionsPanel/metadataSuggestionTree.ts?raw";
import catalogControllerSource from "./useCatalogModuleController.ts?raw";
import videosPanelControllerSource from "./VideosPanel/useVideosPanelController.ts?raw";
import batchMetadataControllerSource from "./BatchEditPanel/useBatchMetadataController.ts?raw";
import selectedVideoControllerSource from "./SelectionPanel/useSelectedVideoController.ts?raw";
import metadataSuggestionsControllerSource from "./MetadataSuggestionsPanel/useMetadataSuggestionsController.ts?raw";

const videoPreviewStylesSource = readFileSync(
  "src/modules/catalog/components/VideoPreview/VideoPreview.module.css",
  "utf8",
);
const catalogStylesSource = readFileSync(
  "src/modules/catalog/Catalog.module.css",
  "utf8",
);
const videosPanelStylesSource = readFileSync(
  "src/modules/catalog/VideosPanel/VideosPanel.module.css",
  "utf8",
);

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
const batchEditPanelBarrelFiles = import.meta.glob(
  "./BatchEditPanel/**/index.*",
  {
    eager: true,
    query: "?raw",
  },
);
const batchEditPanelFiles = import.meta.glob(
  "./BatchEditPanel/**/*.tsx",
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
);
const selectionPanelFiles = import.meta.glob(
  "./SelectionPanel/**/*.{ts,tsx,css}",
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
);
const legacyCatalogDetailAsideFiles = import.meta.glob(
  "./CatalogDetailAside/**/*.{ts,tsx,css}",
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
const metadataSuggestionsPanelFiles = import.meta.glob(
  "./MetadataSuggestionsPanel/**/*.tsx",
  {
    eager: true,
    query: "?raw",
    import: "default",
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
    expect(metadataSuggestionsControllerSource).toMatch(
      /listMetadataSuggestionGroups/,
    );
  });

  it("keeps Catalog controller workflows near the feature panels that use them", () => {
    expect(videosPanelControllerSource).toMatch(/useVideosPanelController/);
    expect(videosPanelControllerSource).toMatch(/catalogVideoMatchesFilters/);
    expect(videosPanelControllerSource).toMatch(/sortedCatalogVideos/);
    expect(catalogControllerSource).not.toMatch(/catalogVideoMatchesFilters/);
    expect(catalogControllerSource).not.toMatch(/sortedCatalogVideos/);

    expect(batchMetadataControllerSource).toMatch(/useBatchMetadataController/);
    expect(batchMetadataControllerSource).toMatch(
      /setBatchVideoSelected/,
    );
    expect(batchMetadataControllerSource).toMatch(
      /batchRemovablePerformers/,
    );
    expect(selectedVideoControllerSource).toMatch(/useSelectedVideoController/);
    expect(selectedVideoControllerSource).toMatch(/selectVideoForDetail/);
    expect(selectedVideoControllerSource).toMatch(
      /resetSelectedVideo/,
    );
    expect(metadataSuggestionsControllerSource).toMatch(
      /useMetadataSuggestionsController/,
    );
    expect(metadataSuggestionsControllerSource).toMatch(
      /listMetadataSuggestionGroups/,
    );
  });

  it("keeps Catalog panels owned by the Catalog module", () => {
    expect(appSource).not.toMatch(/VideosPanel/);
    expect(catalogSource).toMatch(/VideosPanel/);
  });

  it("keeps Catalog entry free of main tab navigation", () => {
    expect(catalogSource).not.toMatch(/NavigationTabs/);
    expect(catalogSource).toMatch(/MetadataSuggestionsSection/);
    expect(catalogSource).not.toMatch(/Tabs\.List/);
    expect(catalogSource).not.toMatch(/Tabs\.Tab/);
    expect(catalogSource).not.toMatch(/IconStar|IconBulb/);
    expect(catalogSource).not.toMatch(/aria-label="Catalog Metadata Suggestions"/);

    expect(metadataSuggestionsSectionSource).toMatch(
      /function MetadataSuggestionsSection/,
    );
    expect(metadataSuggestionsSectionSource).toMatch(
      /aria-label="Catalog Metadata Suggestions"/,
    );
    expect(metadataSuggestionsSectionSource).toMatch(/MetadataSuggestionsPanel/);
    expect(metadataSuggestionsSectionSource).not.toMatch(
      /CatalogMetadataSuggestionsSection/,
    );
  });

  it("keeps optional Metadata Suggestions access outside the Videos View scroll area", () => {
    expect(catalogSource).toMatch(/CatalogToolbar/);
    expect(catalogStylesSource).toMatch(/\.catalogToolbar\s*{/);
    expect(catalogSource).toMatch(/<CatalogToolbar[\s\S]*<VideosPanel/);
    expect(catalogStylesSource).toMatch(
      /\.catalogContent\s*{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\);/s,
    );
    expect(catalogStylesSource).not.toMatch(/position:\s*fixed/);
  });

  it("keeps Primary Performer Accordions visually separated in the Videos list", () => {
    expect(videosPanelStylesSource).toMatch(/\.primaryPerformerAccordions/);
    expect(videosPanelStylesSource).toMatch(/\.primaryPerformerAccordion\s*{/);
  });

  it("keeps Metadata Suggestions panel, group, source, and tree helpers in focused files", () => {
    const metadataSuggestionsPanelFolder = new URL(
      "./MetadataSuggestionsPanel/",
      import.meta.url,
    );

    expect(metadataSuggestionsPanelFolder.pathname).toContain(
      "/src/modules/catalog/MetadataSuggestionsPanel",
    );
    const suggestionGroupSource = rawSource(
      metadataSuggestionsPanelFiles,
      "./MetadataSuggestionsPanel/components/SuggestionGroup.tsx",
    );
    const suggestionSourceSource = rawSource(
      metadataSuggestionsPanelFiles,
      "./MetadataSuggestionsPanel/components/SuggestionSource.tsx",
    );

    expect(Object.keys(metadataSuggestionsPanelBarrelFiles)).toEqual([
      "./MetadataSuggestionsPanel/index.ts",
    ]);
    expect(metadataSuggestionsPanelSource).toMatch(/SuggestionGroup/);
    expect(metadataSuggestionsPanelSource).not.toMatch(/function SuggestionGroup/);
    expect(metadataSuggestionsPanelSource).not.toMatch(
      /function MetadataSuggestionSource|<MetadataSuggestionSource|components\/MetadataSuggestionSource/,
    );
    expect(metadataSuggestionsPanelSource).not.toMatch(/suggestionGroup\.sources/);
    expect(metadataSuggestionsPanelSource).not.toMatch(/useTree/);
    expect(metadataSuggestionsPanelSource).not.toMatch(/Tree\.NodeData/);
    expect(suggestionGroupSource).toMatch(/function SuggestionGroup/);
    expect(suggestionGroupSource).toMatch(/SuggestionSource/);
    expect(suggestionGroupSource).not.toMatch(/useTree/);
    expect(suggestionGroupSource).not.toMatch(
      /function MetadataSuggestionSource|<MetadataSuggestionSource|components\/MetadataSuggestionSource/,
    );
    expect(suggestionSourceSource).toMatch(/function SuggestionSource/);
    expect(suggestionSourceSource).toMatch(/useTree/);
    expect(suggestionSourceSource).toMatch(/buildSuggestionVideoTree/);
    expect(suggestionSourceSource).not.toMatch(
      /function MetadataSuggestionSource/,
    );
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
    const primaryPerformerAccordionSource = rawSource(
      videosPanelFiles,
      "./VideosPanel/components/PrimaryPerformerAccordion.tsx",
    );
    const groupPreviewStripSource = rawSource(
      videosPanelFiles,
      "./VideosPanel/components/GroupPreviewStrip.tsx",
    );
    const groupPreviewCardSource = rawSource(
      videosPanelFiles,
      "./VideosPanel/components/GroupPreviewCard.tsx",
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
    expect(primaryPerformerAccordionSource).toMatch(
      /function PrimaryPerformerAccordion/,
    );
    expect(groupPreviewStripSource).toMatch(/function GroupPreviewStrip/);
    expect(groupPreviewCardSource).toMatch(/function GroupPreviewCard/);
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
      /from ['"]\.\.\/catalogVideoDurationFilters['"]/,
    );
    expect(primaryPerformerAccordionSource).toMatch(/".\/VideoCard"/);
    expect(primaryPerformerAccordionSource).toMatch(/".\/GroupPreviewStrip"/);
    expect(groupPreviewStripSource).toMatch(/".\/GroupPreviewCard"/);
    expect(Object.keys(videosPanelBarrelFiles)).toEqual([
      "./VideosPanel/index.ts",
    ]);
    expect(Object.keys(legacyCatalogVideosPanelFiles)).toHaveLength(0);
    expect(Object.keys(legacyCatalogVideosPanelTopLevelFiles)).toHaveLength(0);
  });

  it("keeps Batch Edit actions in focused files", () => {
    const batchEditPanelSource = rawSource(
      batchEditPanelFiles,
      "./BatchEditPanel/BatchEditPanel.tsx",
    );
    const favoriteActionsSource = rawSource(
      batchEditPanelFiles,
      "./BatchEditPanel/components/FavoriteActions.tsx",
    );
    const batchTrashActionsSource = rawSource(
      batchEditPanelFiles,
      "./BatchEditPanel/components/BatchTrashActions.tsx",
    );
    const batchMetadataSectionSource = rawSource(
      batchEditPanelFiles,
      "./BatchEditPanel/components/BatchMetadataSection.tsx",
    );

    expect(batchEditPanelSource).not.toBe("");
    expect(favoriteActionsSource).not.toBe("");
    expect(batchTrashActionsSource).not.toBe("");
    expect(batchMetadataSectionSource).not.toBe("");
    expect(batchEditPanelSource).toMatch(/function BatchEditPanel/);
    expect(favoriteActionsSource).toMatch(/function FavoriteActions/);
    expect(favoriteActionsSource).toMatch(/onSetFavorite/);
    expect(batchTrashActionsSource).toMatch(/function BatchTrashActions/);
    expect(batchTrashActionsSource).toMatch(/MoveToTrashConfirmation/);
    expect(batchTrashActionsSource).toMatch(/selected Videos/);
    expect(batchMetadataSectionSource).toMatch(/function BatchMetadataSection/);
    expect(batchMetadataSectionSource).toMatch(/findMetadataByName/);
    expect(batchMetadataSectionSource).toMatch(/on some selected Videos/);
    expect(batchEditPanelSource).toMatch(
      /from "\.\/components\/FavoriteActions"/,
    );
    expect(batchEditPanelSource).toMatch(
      /from "\.\/components\/BatchTrashActions"/,
    );
    expect(batchEditPanelSource).toMatch(
      /from "\.\/components\/BatchMetadataSection"/,
    );
    expect(batchEditPanelSource).not.toMatch(/function FavoriteActions/);
    expect(batchEditPanelSource).not.toMatch(/function BatchTrashActions/);
    expect(batchEditPanelSource).not.toMatch(/function BatchMetadataSection/);
    expect(catalogSource).not.toMatch(/import \{ BatchEditPanel \}/);
    expect(catalogSource).not.toMatch(/<BatchEditPanel/);
    expect(catalogSource).not.toMatch(
      /from "\.\/BatchEditPanel\.tsx"/,
    );
    expect(Object.keys(batchEditPanelBarrelFiles)).toEqual([
      "./BatchEditPanel/index.ts",
    ]);
  });

  it("keeps the Catalog Selection Panel owned by the Catalog module", () => {
    const selectionPanelSource = rawSource(
      selectionPanelFiles,
      "./SelectionPanel/SelectionPanel.tsx",
    );
    const emptySelectionStateSource = rawSource(
      selectionPanelFiles,
      "./SelectionPanel/components/EmptySelectionState.tsx",
    );
    const selectedVideoDetailSource = rawSource(
      selectionPanelFiles,
      "./SelectionPanel/components/SelectedVideoDetail.tsx",
    );
    const selectedVideosBatchEditSource = rawSource(
      selectionPanelFiles,
      "./SelectionPanel/components/SelectedVideosBatchEdit.tsx",
    );

    expect(selectionPanelSource).not.toBe("");
    expect(selectionPanelSource).toMatch(/function SelectionPanel/);
    expect(selectionPanelSource).toMatch(/EmptySelectionState/);
    expect(selectionPanelSource).toMatch(/SelectedVideoDetail/);
    expect(selectionPanelSource).toMatch(/SelectedVideosBatchEdit/);
    expect(selectionPanelSource).not.toMatch(/AppShell\.Aside/);
    expect(emptySelectionStateSource).toMatch(/function EmptySelectionState/);
    expect(emptySelectionStateSource).toMatch(/No video selected/);
    expect(selectedVideoDetailSource).toMatch(/function SelectedVideoDetail/);
    expect(selectedVideoDetailSource).toMatch(/useSelectedVideoDetailActions/);
    expect(selectedVideoDetailSource).toMatch(/VideoDetailPanel/);
    expect(selectedVideosBatchEditSource).toMatch(
      /function SelectedVideosBatchEdit/,
    );
    expect(selectedVideosBatchEditSource).toMatch(/BatchEditPanel/);
    expect(catalogSource).toMatch(/SelectionPanel/);
    expect(catalogSource).not.toMatch(/function SelectionPanel/);
    expect(catalogModuleEntryPointSource).not.toMatch(
      /SelectionPanel/,
    );
    expect(appSource).not.toMatch(/CatalogDetailAside|BatchEditPanel|VideoDetailPanel/);
    expect(appSource).not.toMatch(/videoDetailAside|AppShell\.Aside/);
    expect(Object.keys(legacyCatalogDetailAsideFiles)).toHaveLength(0);
  });

  it("uses the module folder context for the Catalog entry name", () => {
    expect(catalogModuleEntryPointSource).toContain(
      'export { Catalog } from "./Catalog"',
    );
    expect(catalogSource).toMatch(/function Catalog\(/);
    expect(catalogModuleEntryPointSource).not.toMatch(/export \{ CatalogModule/);
    expect(catalogSource).not.toMatch(/function CatalogModule|CatalogModuleProps/);
  });

  it("keeps Video detail and preview pieces in focused files", () => {
    const videoDetailPanelSource = rawSource(
      videoDetailPanelFiles,
      "./VideoDetailPanel/VideoDetailPanel.tsx",
    );
    const titleEditorSource = rawSource(
      videoDetailPanelFiles,
      "./VideoDetailPanel/components/TitleEditor.tsx",
    );
    const actionButtonsSource = rawSource(
      videoDetailPanelFiles,
      "./VideoDetailPanel/components/ActionButtons.tsx",
    );
    const metadataSectionSource = rawSource(
      videoDetailPanelFiles,
      "./VideoDetailPanel/components/MetadataSection.tsx",
    );
    const fileLocationsSectionSource = rawSource(
      videoDetailPanelFiles,
      "./VideoDetailPanel/components/FileLocationsSection.tsx",
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
    expect(titleEditorSource).toMatch(/function TitleEditor/);
    expect(titleEditorSource).toMatch(/useState/);
    expect(titleEditorSource).toMatch(/Save title/);
    expect(actionButtonsSource).toMatch(/function ActionButtons/);
    expect(actionButtonsSource).toMatch(/Reveal in Finder/);
    expect(metadataSectionSource).toMatch(/function MetadataSection/);
    expect(metadataSectionSource).toMatch(
      /from "\.\.\/\.\.\/components\/MetadataBadges"/,
    );
    expect(fileLocationsSectionSource).toMatch(
      /function FileLocationsSection/,
    );
    expect(fileLocationsSectionSource).toMatch(/Preferred File Location/);
    expect(fileLocationsSectionSource).toMatch(/Missing/);
    expect(videoDetailPanelSource).toMatch(/".\/components\/TitleEditor"/);
    expect(videoDetailPanelSource).toMatch(
      /".\/components\/ActionButtons"/,
    );
    expect(videoDetailPanelSource).toMatch(
      /".\/components\/MetadataSection"/,
    );
    expect(videoDetailPanelSource).toMatch(
      /".\/components\/FileLocationsSection"/,
    );
    expect(videoDetailPanelSource).not.toMatch(/function TitleEditor/);
    expect(videoDetailPanelSource).not.toMatch(/function ActionButtons/);
    expect(videoDetailPanelSource).not.toMatch(/function MetadataSection/);
    expect(videoDetailPanelSource).not.toMatch(/function FileLocationsSection/);
    expect(videoDetailPanelSource).toMatch(/useState/);
    expect(videoDetailPanelSource).not.toMatch(/useEffect/);
    expect(videoDetailPanelSource).not.toMatch(/TextInput/);
    expect(videoDetailPanelSource).not.toMatch(/TagsInput/);
    expect(videoDetailPanelSource).not.toMatch(/formatFileSize/);

    expect(videoPreviewSource).toMatch(/".\/components\/PreviewStripSurface"/);
    expect(videoPreviewSource).toMatch(/".\/VideoPreview\.module\.css"/);
    expect(videoPreviewSource).not.toMatch(/function PreviewStripSurface/);
    expect(videoPreviewStylesSource).toMatch(/\.large/);
    expect(videoPreviewStylesSource).toMatch(/width: 100%/);
    expect(videoPreviewStylesSource).not.toMatch(/max-width: 520px/);
    expect(previewStripSurfaceSource).toMatch(/function PreviewStripSurface/);
    expect(previewStripSurfaceSource).toMatch(/styles\.pendingStrip/);
    expect(previewStripSurfaceSource).toMatch(/previewStripFramePosition/);
    expect(previewStripFrameSource).toMatch(
      /function previewStripFrameIndexFromPointer/,
    );
    expect(previewStripFrameSource).toMatch(
      /function previewStripFramePosition/,
    );
    expect(Object.keys(videoDetailPanelBarrelFiles)).toEqual([
      "./VideoDetailPanel/index.ts",
    ]);
    expect(Object.keys(videoPreviewBarrelFiles)).toHaveLength(0);
  });
});
