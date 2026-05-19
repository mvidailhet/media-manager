import { describe, expect, it } from "vitest";

import appSource from "../../App.tsx?raw";
import settingsModuleEntryPointSource from "./index.ts?raw";
import settingsSource from "./Settings.tsx?raw";
import settingsControllerSource from "./useSettingsModuleController.ts?raw";
import ffmpegStatusPanelSource from "./SettingsStatusPanels/FfmpegStatusPanel.tsx?raw";
import tauriStatusPanelSource from "./SettingsStatusPanels/TauriStatusPanel.tsx?raw";

describe("Settings module boundaries", () => {
  it("keeps Settings status hooks behind the Settings module boundary", () => {
    expect(appSource).not.toMatch(/useSettingsStatus/);
    expect(settingsControllerSource).toMatch(/useSettingsStatus/);
  });

  it("keeps Settings panels owned by the Settings module", () => {
    expect(appSource).not.toMatch(/TauriStatusPanel/);
    expect(appSource).not.toMatch(/FfmpegStatusPanel/);
    expect(settingsSource).toMatch(/TauriStatusPanel/);
  });

  it("keeps Settings status panels in focused files with direct imports", () => {
    expect(settingsSource).toMatch(
      /SettingsStatusPanels\/TauriStatusPanel/,
    );
    expect(settingsSource).toMatch(
      /SettingsStatusPanels\/FfmpegStatusPanel/,
    );
    expect(settingsSource).not.toMatch(/from "\.\/SettingsStatusPanels"/);
    expect(tauriStatusPanelSource).toMatch(/function TauriStatusPanel/);
    expect(ffmpegStatusPanelSource).toMatch(/function FfmpegStatusPanel/);
    expect(ffmpegStatusPanelSource).toMatch(
      /components\/FfmpegToolStatusCard/,
    );
  });

  it("uses the module folder context for the Settings entry name", () => {
    expect(settingsModuleEntryPointSource).toContain(
      'export { Settings } from "./Settings"',
    );
    expect(settingsSource).toMatch(/function Settings\(/);
    expect(settingsModuleEntryPointSource).not.toMatch(/export \{ SettingsModule/);
    expect(settingsSource).not.toMatch(/function SettingsModule|SettingsModuleProps/);
  });
});
