import { describe, expect, it } from "vitest";

import appSource from "../../App.tsx?raw";
import settingsModuleSource from "./SettingsModule.tsx?raw";
import settingsControllerSource from "./useSettingsModuleController.ts?raw";

describe("Settings module boundaries", () => {
  it("keeps Settings status hooks behind the Settings module boundary", () => {
    expect(appSource).not.toMatch(/useSettingsStatus/);
    expect(settingsControllerSource).toMatch(/useSettingsStatus/);
  });

  it("keeps Settings panels owned by the Settings module", () => {
    expect(appSource).not.toMatch(/TauriStatusPanel/);
    expect(appSource).not.toMatch(/FfmpegStatusPanel/);
    expect(settingsModuleSource).toMatch(/TauriStatusPanel/);
  });
});
