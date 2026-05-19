import { describe, expect, it } from "vitest";

import previewGenerationSource from "./PreviewGenerationView/PreviewGenerationView.tsx?raw";
import previewStripQueueActivityLabelSource from "./PreviewGenerationView/previewStripQueueActivityLabel.ts?raw";
import failedPreviewStripsPanelSource from "./PreviewGenerationView/components/FailedPreviewStripsPanel.tsx?raw";
import previewStripQueuePanelSource from "./PreviewGenerationView/components/PreviewStripQueuePanel.tsx?raw";
import scanIssuesPanelSource from "./ScanIssuesPanel/ScanIssuesPanel.tsx?raw";
import missingVideosPanelSource from "./ScanIssuesPanel/components/MissingVideosPanel.tsx?raw";
import unavailableScanRootsPanelSource from "./ScanIssuesPanel/components/UnavailableScanRootsPanel.tsx?raw";
import scanRootsPanelSource from "./ScanRootsPanel/ScanRootsPanel.tsx?raw";
import scanRootCardSource from "./ScanRootsPanel/components/ScanRootCard.tsx?raw";

describe("Scan module file structure", () => {
  it("keeps each Scan Issues panel in its focused component file", () => {
    expect(missingVideosPanelSource).toContain("function MissingVideosPanel");
    expect(unavailableScanRootsPanelSource).toContain(
      "function UnavailableScanRootsPanel",
    );
    expect(scanIssuesPanelSource).toContain('./components/MissingVideosPanel"');
    expect(scanIssuesPanelSource).toContain(
      './components/UnavailableScanRootsPanel"',
    );
    expect(scanIssuesPanelSource).not.toContain(
      './components/UnprocessableCandidatesPanel"',
    );
  });

  it("keeps Preview Strip generation panels under Preview Generation ownership", () => {
    expect(previewStripQueuePanelSource).toContain(
      "function PreviewStripQueuePanel",
    );
    expect(failedPreviewStripsPanelSource).toContain(
      "function FailedPreviewStripsPanel",
    );
    expect(previewStripQueueActivityLabelSource).toContain(
      "function previewStripQueueActivityLabel",
    );
    expect(scanIssuesPanelSource).not.toContain("FailedPreviewStripsPanel");
    expect(previewGenerationSource).toContain(
      './components/PreviewStripQueuePanel"',
    );
    expect(previewGenerationSource).toContain(
      './components/FailedPreviewStripsPanel"',
    );
  });

  it("keeps Scan Root cards under Scan Roots ownership without adding barrels", () => {
    expect(scanRootCardSource).toContain("function ScanRootCard");
    expect(scanRootsPanelSource).toContain('./components/ScanRootCard"');
    expect(scanIssuesPanelSource).not.toContain("index.ts");
    expect(previewGenerationSource).not.toContain("index.ts");
    expect(scanRootsPanelSource).not.toContain("index.ts");
  });
});
