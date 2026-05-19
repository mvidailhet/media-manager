import { describe, expect, it } from "vitest";

import architectureTestSource from "./AppArchitecture.test.ts?raw";
import appSource from "./App.tsx?raw";

describe("App module boundaries", () => {
  it("keeps root architecture tests focused on App composition", () => {
    const moduleInternalImportPattern = new RegExp(
      String.raw`\.\/modules\/(?:scan|settings)\/|\.\/modules\/catalog\/(?!CatalogModuleDetailAside)`,
    );

    expect(architectureTestSource).not.toMatch(moduleInternalImportPattern);
  });

  it("delegates low-level Tauri command ownership to modules", () => {
    expect(appSource).not.toMatch(/from "\.\/tauriCommands"/);
    expect(appSource).not.toMatch(/attachTagToVideo/);
    expect(appSource).not.toMatch(/detachTagFromVideo/);
    expect(appSource).not.toMatch(/performersForVideo/);
    expect(appSource).not.toMatch(/tagsForVideo/);
  });

  it("keeps App focused on composing workflow modules", () => {
    expect(appSource).toMatch(/<CatalogModule/);
    expect(appSource).toMatch(/<Scan/);
    expect(appSource).toMatch(/<SettingsModule/);
    expect(appSource).not.toMatch(/CatalogVideosPanel/);
    expect(appSource).not.toMatch(/ScanRootsPanel/);
    expect(appSource).not.toMatch(/ScanIssuesPanel/);
    expect(appSource).not.toMatch(/PreviewGenerationView/);
    expect(appSource).not.toMatch(/TauriStatusPanel/);
    expect(appSource).not.toMatch(/FfmpegStatusPanel/);
    expect(appSource).not.toMatch(/useCatalogVideos/);
    expect(appSource).not.toMatch(/useCatalogMetadata/);
    expect(appSource).not.toMatch(/useScanRoots/);
    expect(appSource).not.toMatch(/useScanIssues/);
    expect(appSource).not.toMatch(/usePreviewGeneration/);
    expect(appSource).not.toMatch(/useSettingsStatus/);
    expect(appSource).toMatch(/useSettingsModuleController/);
    expect(appSource).toMatch(/useScanModuleController/);
  });

  it("delegates app shell navigation and confirmations to focused components", () => {
    expect(appSource).toContain(
      'from "./components/ModuleNavigation"',
    );
    expect(appSource).toContain(
      'from "./components/RemoveScanRootConfirmation"',
    );
    expect(appSource).toContain(
      'from "./components/ForgetMissingVideoConfirmation"',
    );
    expect(appSource).toMatch(/<ModuleNavigation/);
    expect(appSource).toMatch(/<RemoveScanRootConfirmation/);
    expect(appSource).toMatch(/<ForgetMissingVideoConfirmation/);
    expect(appSource).not.toMatch(/aria-label="Module navigation"/);
    expect(appSource).not.toMatch(
      /aria-label="Remove Scan Root confirmation"/,
    );
    expect(appSource).not.toMatch(
      /aria-label="Forget Missing Video confirmation"/,
    );
  });

  it("imports workflow modules through entry points except the Catalog detail aside", () => {
    expect(appSource).toMatch(/from "\.\/modules\/settings"/);
    expect(appSource).not.toMatch(/from "\.\/modules\/settings\//);
    expect(appSource).toMatch(/from "\.\/modules\/catalog"/);
    expect(appSource).toMatch(
      /from "\.\/modules\/catalog\/CatalogModuleDetailAside"/,
    );
    expect(appSource).not.toMatch(
      /from "\.\/modules\/catalog\/(?!CatalogModuleDetailAside")/,
    );
    expect(appSource).toMatch(/from "\.\/modules\/scan"/);
    expect(appSource).not.toMatch(/from "\.\/modules\/scan\//);
  });
});
