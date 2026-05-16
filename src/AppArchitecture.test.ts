import { describe, expect, it } from "vitest";

import appSource from "./App.tsx?raw";

describe("App module boundaries", () => {
  it("delegates Tauri command ownership to module hooks", () => {
    expect(appSource).not.toMatch(/from "\.\/tauriCommands"/);
    expect(appSource).toMatch(/useCatalogVideos/);
    expect(appSource).toMatch(/useCatalogMetadata/);
    expect(appSource).toMatch(/useScanRoots/);
    expect(appSource).toMatch(/usePreviewGeneration/);
    expect(appSource).toMatch(/useSettingsStatus/);
  });
});
