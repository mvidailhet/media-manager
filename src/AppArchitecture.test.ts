import { describe, expect, it } from "vitest";

import appSource from "./App.tsx?raw";
import previewGenerationHookSource from "./modules/scan/usePreviewGeneration.ts?raw";

describe("App module boundaries", () => {
  it("delegates Tauri command ownership to module hooks", () => {
    expect(appSource).not.toMatch(/from "\.\/tauriCommands"/);
    expect(appSource).toMatch(/useCatalogVideos/);
    expect(appSource).toMatch(/useCatalogMetadata/);
    expect(appSource).toMatch(/useScanRoots/);
    expect(appSource).toMatch(/usePreviewGeneration/);
    expect(appSource).toMatch(/useSettingsStatus/);
    expect(appSource).not.toMatch(/attachTagToVideo/);
    expect(appSource).not.toMatch(/detachTagFromVideo/);
    expect(appSource).not.toMatch(/performersForVideo/);
    expect(appSource).not.toMatch(/tagsForVideo/);
  });

  it("keeps Preview Generation polling independent from parent renders", () => {
    expect(previewGenerationHookSource).toMatch(/latestRefreshCatalogVideos/);
    expect(previewGenerationHookSource).not.toMatch(
      /\}, \[previewStripQueueStatus, refreshCatalogVideos, refreshReviewQueue\]\)/,
    );
  });
});
