import { describe, expect, it } from "vitest";

import appSource from "../../App.tsx?raw";
import previewGenerationHookSource from "./usePreviewGeneration.ts?raw";
import scanControllerSource from "./useScanModuleController.ts?raw";
import scanModuleSource from "./ScanModule.tsx?raw";

describe("Scan module boundaries", () => {
  it("keeps Scan hooks behind the Scan module boundary", () => {
    expect(appSource).not.toMatch(/useScanRoots/);
    expect(appSource).not.toMatch(/useScanIssues/);
    expect(appSource).not.toMatch(/usePreviewGeneration/);
    expect(scanControllerSource).toMatch(/useScanRoots/);
    expect(scanControllerSource).toMatch(/useScanIssues/);
    expect(scanControllerSource).toMatch(/usePreviewGeneration/);
  });

  it("keeps Scan panels owned by the Scan module", () => {
    expect(appSource).not.toMatch(/RootsPanel/);
    expect(appSource).not.toMatch(/ScanIssuesPanel/);
    expect(appSource).not.toMatch(/PreviewGenerationView/);
    expect(scanModuleSource).toMatch(/RootsPanel/);
  });

  it("keeps Preview Generation polling independent from parent renders", () => {
    expect(previewGenerationHookSource).toMatch(/latestRefreshCatalogVideos/);
    expect(previewGenerationHookSource).not.toMatch(
      /\}, \[previewStripQueueStatus, refreshCatalogVideos, refreshScanIssues\]\)/,
    );
  });
});
