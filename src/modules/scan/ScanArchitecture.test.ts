import { describe, expect, it } from "vitest";

import appSource from "../../App.tsx?raw";
import previewGenerationHookSource from "./usePreviewGeneration.ts?raw";
import scanRootsHookSource from "./useScanRoots.ts?raw";
import scanControllerSource from "./useScanModuleController.ts?raw";
import scanModuleEntryPointSource from "./index.ts?raw";
import scanSource from "./Scan.tsx?raw";

describe("Scan module boundaries", () => {
  it("keeps Scan hooks behind the Scan module boundary", () => {
    expect(appSource).not.toMatch(/useScanRoots/);
    expect(appSource).not.toMatch(/useMissingVideos/);
    expect(appSource).not.toMatch(/usePreviewGeneration/);
    expect(scanControllerSource).toMatch(/useScanRoots/);
    expect(scanControllerSource).toMatch(/useMissingVideos/);
    expect(scanControllerSource).toMatch(/usePreviewGeneration/);
  });

  it("keeps Scan panels owned by the Scan module", () => {
    expect(appSource).not.toMatch(/RootsPanel/);
    expect(appSource).not.toMatch(/MissingVideosPanel/);
    expect(appSource).not.toMatch(/PreviewGenerationView/);
    expect(scanSource).toMatch(/RootsPanel/);
  });

  it("keeps workflow data with the workflow that renders it", () => {
    expect(scanRootsHookSource).toMatch(/listUnprocessableVideoCandidatesByScanRoot/);
    expect(previewGenerationHookSource).toMatch(/listFailedPreviewStrips/);
    expect(previewGenerationHookSource).toMatch(/retryFailedPreviewStrip/);
    expect(previewGenerationHookSource).toMatch(/ignoreFailedPreviewStrip/);
    expect(scanControllerSource).not.toMatch(
      /missingVideosWorkflow\.unprocessableVideoCandidateGroups/,
    );
    expect(scanControllerSource).not.toMatch(/missingVideosWorkflow\.failedPreviewStrips/);
    expect(scanControllerSource).not.toMatch(/metadataSuggestionGroups: missingVideosWorkflow/);
    expect(scanControllerSource).not.toMatch(/listMetadataSuggestionGroups/);
  });

  it("keeps Preview Generation polling independent from parent renders", () => {
    expect(previewGenerationHookSource).toMatch(/latestRefreshCatalogVideos/);
    expect(previewGenerationHookSource).not.toMatch(
      /\}, \[previewStripQueueStatus, refreshCatalogVideos, refreshMissingVideos\]\)/,
    );
  });

  it("uses the module folder context for the Scan entry name", () => {
    expect(scanModuleEntryPointSource).toContain('export { Scan } from "./Scan"');
    expect(scanSource).toMatch(/function Scan\(/);
    expect(scanModuleEntryPointSource).not.toMatch(/export \{ ScanModule/);
    expect(scanSource).not.toMatch(/function ScanModule|ScanModuleProps/);
  });
});
