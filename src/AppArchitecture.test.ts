import { describe, expect, it } from "vitest";

import appSource from "./App.tsx?raw";
import catalogModuleSource from "./modules/catalog/CatalogModule.tsx?raw";
import catalogControllerSource from "./modules/catalog/useCatalogModuleController.ts?raw";
import previewGenerationHookSource from "./modules/scan/usePreviewGeneration.ts?raw";
import scanControllerSource from "./modules/scan/useScanModuleController.ts?raw";
import scanModuleSource from "./modules/scan/ScanModule.tsx?raw";
import settingsModuleSource from "./modules/settings/SettingsModule.tsx?raw";
import settingsControllerSource from "./modules/settings/useSettingsModuleController.ts?raw";

describe("App module boundaries", () => {
  it("delegates Tauri command ownership to module hooks", () => {
    expect(appSource).not.toMatch(/from "\.\/tauriCommands"/);
    expect(appSource).not.toMatch(/useCatalogVideos/);
    expect(appSource).not.toMatch(/useCatalogMetadata/);
    expect(catalogControllerSource).toMatch(/useCatalogVideos/);
    expect(catalogControllerSource).toMatch(/useCatalogMetadata/);
    expect(appSource).not.toMatch(/useScanRoots/);
    expect(appSource).not.toMatch(/useScanIssues/);
    expect(appSource).not.toMatch(/usePreviewGeneration/);
    expect(scanControllerSource).toMatch(/useScanRoots/);
    expect(scanControllerSource).toMatch(/useScanIssues/);
    expect(scanControllerSource).toMatch(/usePreviewGeneration/);
    expect(appSource).not.toMatch(/useSettingsStatus/);
    expect(settingsControllerSource).toMatch(/useSettingsStatus/);
    expect(appSource).not.toMatch(/attachTagToVideo/);
    expect(appSource).not.toMatch(/detachTagFromVideo/);
    expect(appSource).not.toMatch(/performersForVideo/);
    expect(appSource).not.toMatch(/tagsForVideo/);
  });

  it("keeps Preview Generation polling independent from parent renders", () => {
    expect(previewGenerationHookSource).toMatch(/latestRefreshCatalogVideos/);
    expect(previewGenerationHookSource).not.toMatch(
      /\}, \[previewStripQueueStatus, refreshCatalogVideos, refreshScanIssues\]\)/,
    );
  });

  it("keeps App focused on composing workflow modules", () => {
    expect(appSource).toMatch(/<CatalogModule/);
    expect(appSource).toMatch(/<ScanModule/);
    expect(appSource).toMatch(/<SettingsModule/);
    expect(appSource).not.toMatch(/CatalogVideosPanel/);
    expect(appSource).not.toMatch(/ScanRootsPanel/);
    expect(appSource).not.toMatch(/ScanIssuesPanel/);
    expect(appSource).not.toMatch(/PreviewGenerationView/);
    expect(appSource).not.toMatch(/TauriStatusPanel/);
    expect(appSource).not.toMatch(/FfmpegStatusPanel/);
    expect(appSource).not.toMatch(/useCatalogVideos/);
    expect(appSource).not.toMatch(/useCatalogMetadata/);
    expect(appSource).not.toMatch(/from "\.\/modules\/settings\/useSettingsStatus"/);
    expect(appSource).toMatch(/useSettingsModuleController/);
    expect(appSource).toMatch(/useScanModuleController/);

    expect(catalogModuleSource).toMatch(/CatalogVideosPanel/);
    expect(catalogControllerSource).toMatch(/useCatalogVideos/);
    expect(catalogControllerSource).toMatch(/useCatalogMetadata/);
    expect(scanModuleSource).toMatch(/ScanRootsPanel/);
    expect(settingsModuleSource).toMatch(/TauriStatusPanel/);
  });

  it("imports Settings only through the module boundary", () => {
    expect(appSource).toMatch(/from "\.\/modules\/settings"/);
    expect(appSource).not.toMatch(
      /from "\.\/modules\/settings\/SettingsModule"/,
    );
    expect(appSource).not.toMatch(
      /from "\.\/modules\/settings\/useSettingsModuleController"/,
    );
    expect(appSource).not.toMatch(
      /from "\.\/modules\/settings\/SettingsStatusPanels"/,
    );
  });

  it("keeps Scan internals behind the Scan module entry point", () => {
    expect(appSource).toMatch(/from "\.\/modules\/scan"/);
    expect(appSource).not.toMatch(/from "\.\/modules\/scan\/ScanModule"/);
    expect(appSource).not.toMatch(
      /from "\.\/modules\/scan\/useScanModuleController"/,
    );
  });
});
