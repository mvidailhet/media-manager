# Split UI and backend modules

## Goal

Make the UI and backend readable by splitting the current large files into domain workflow modules without changing behavior first.

## Current pressure

- `src/App.tsx` mixes app state, data loading, Catalog browsing, Scan Roots, Preview Strip generation, scan issues, Metadata Suggestions, Video details, batch metadata editing, and Settings surfaces.
- `src-tauri/src/catalog.rs` mixes Catalog persistence, migrations, scan reconciliation, metadata, Metadata Suggestions, Preview Strip records, Preview Strip generation helpers, and broad tests.

## Target frontend shape

```text
src/
  app/
    App.tsx
    AppShell.tsx
    appNavigation.ts
  modules/
    catalog/
      CatalogModule.tsx
      CatalogVideosView.tsx
      CatalogMetadataSuggestionsView.tsx
      VideoDetailPanel.tsx
      components/
    scan/
      ScanModule.tsx
      ScanRootsView.tsx
      MissingVideosView.tsx
      PreviewGenerationView.tsx
      components/
    settings/
      SettingsModule.tsx
      AppStatusSection.tsx
      VideoToolingSection.tsx
  shared/
    components/
    formatting/
    metadata/
```

The top-level navigation exposes Catalog, Scan, and Settings. Catalog opens by default. The All Videos, Favorites, Recently Opened, and Metadata Suggestions views live inside Catalog. Scan Roots, Missing Videos, and Preview Generation live inside Scan. Settings holds Tauri bridge status and FFmpeg/FFprobe status/configuration.

## Target backend shape

```text
src-tauri/src/
  lib.rs
  catalog/
    mod.rs
    migrations.rs
    videos.rs
    scan_roots.rs
    scan_refresh.rs
    metadata.rs
    metadata_suggestions.rs
    preview_strip_records.rs
  ffmpeg_tools.rs
  preview_generation/
    mod.rs
    ffmpeg_generator.rs
```

Keep `Catalog` as the public facade during the split. Tauri commands should keep calling stable `Catalog` methods while implementation moves into focused modules.

## Phases

1. Frontend mechanical extraction
   - Move existing Catalog, Scan, and Settings JSX into module files.
   - Keep data loading and mutation state in `App` initially.
   - Preserve existing behavior and tests.

2. Frontend module navigation
   - Add local state for active module.
   - Add Catalog views: All Videos, Favorites, Recently Opened, Metadata Suggestions.
   - Add Scan tabs: Scan Roots, Missing Videos, Preview Generation.
   - Reset Video Detail Panel and batch selection when changing Catalog views.

3. Frontend state ownership
   - Extract focused hooks after the module split is stable.
   - Candidate hooks: `useCatalogVideos`, `useCatalogMetadata`, `useScanRoots`, `usePreviewGeneration`, `useSettingsStatus`.

4. Backend migrations extraction
   - Move schema creation and migration helpers out of the large catalog file first.
   - Keep `Catalog::open` behavior unchanged.

5. Backend Catalog facade split
   - Extract videos, scan roots, scan refresh, metadata, Metadata Suggestions, and Preview Strip records behind the existing `Catalog` API.
   - Keep broad tests in place while production code moves.

6. Backend tooling and preview generation split
   - Move FFmpeg/FFprobe discovery and configuration to `ffmpeg_tools`.
   - Keep persisted Preview Strip state under Catalog.
   - Move queue runtime and FFmpeg generation mechanics to `preview_generation`.

7. Test reorganization
   - After behavior is stable, split tests by responsibility.
   - Keep integration coverage for the public `Catalog` facade and Tauri command contracts.

## Behavior rules to preserve

- Catalog is the default workspace, even when setup is incomplete.
- Empty Catalog offers a direct Add Scan Root action.
- Metadata Suggestions are reviewed in Catalog with affected Video preview context.
- Inference Rules are configured with Scan Roots.
- Preview Generation uses a derived worklist from Preview Strip state, not a separate user-curated queue.
- Preview Generation shows counts for pending/generated work and details for running/failed work.
- Settings is user-facing wording; avoid exposing "Config" as UI copy.
