import { describe, expect, it } from "vitest";

import previewGenerationSource from "./PreviewGenerationView/PreviewGenerationView.tsx?raw";
import previewStripQueueActivityLabelSource from "./PreviewGenerationView/previewStripQueueActivityLabel.ts?raw";
import failedPreviewStripsPanelSource from "./PreviewGenerationView/components/FailedPreviewStripsPanel.tsx?raw";
import previewStripQueuePanelSource from "./PreviewGenerationView/components/PreviewStripQueuePanel.tsx?raw";
import attentionTabLabelSource from "./components/AttentionTabLabel.tsx?raw";
import tabsListSource from "./components/TabsList.tsx?raw";
import scanSource from "./Scan.tsx?raw";
import scanTabsSource from "./scanTabs.ts?raw";
import scanIssuesPanelSource from "./ScanIssuesPanel/ScanIssuesPanel.tsx?raw";
import missingVideosPanelSource from "./ScanIssuesPanel/components/MissingVideosPanel.tsx?raw";
import unavailableScanRootsPanelSource from "./ScanIssuesPanel/components/UnavailableScanRootsPanel.tsx?raw";
import rootsPanelSource from "./RootsPanel/RootsPanel.tsx?raw";
import rootsPanelIndexSource from "./RootsPanel/index.ts?raw";
import rootCardSource from "./RootsPanel/components/RootCard/RootCard.tsx?raw";
import rootCardIndexSource from "./RootsPanel/components/RootCard/index.ts?raw";
import headerSource from "./RootsPanel/components/RootCard/components/Header.tsx?raw";
import progressBarSource from "./RootsPanel/components/RootCard/components/ProgressBar.tsx?raw";
import refreshProgressSource from "./RootsPanel/components/RootCard/components/RefreshProgress.tsx?raw";
import unprocessableCandidatesSectionSource from "./RootsPanel/components/RootCard/components/UnprocessableCandidatesSection.tsx?raw";
import inferenceRulesFormSource from "./RootsPanel/components/RootCard/components/InferenceRulesForm.tsx?raw";

describe("Scan module file structure", () => {
  it("keeps the Scan entry tabs in focused child components", () => {
    expect(scanSource).toContain("function Scan");
    expect(tabsListSource).toContain("function TabsList");
    expect(attentionTabLabelSource).toContain("function AttentionTabLabel");
    expect(scanSource).toContain('./components/TabsList"');
    expect(scanSource).toContain('./scanTabs"');
    expect(tabsListSource).toContain('../scanTabs"');
    expect(tabsListSource).toContain('./AttentionTabLabel"');
    expect(tabsListSource).toContain("Scan Roots");
    expect(tabsListSource).toContain("Scan Issues");
    expect(tabsListSource).toContain("Preview Generation");
    expect(scanTabsSource).toContain('scanRootsTab = "scanRoots"');
    expect(scanTabsSource).toContain('scanIssuesTab = "scanIssues"');
    expect(scanTabsSource).toContain(
      'previewGenerationTab = "previewGeneration"',
    );
    expect(tabsListSource).not.toContain('../Scan"');
    expect(tabsListSource).not.toMatch(/function Scan/);
    expect(attentionTabLabelSource).not.toMatch(/function Scan/);
    expectComponentFileToOwnOnly(scanSource, "Scan");
    expectComponentFileToOwnOnly(tabsListSource, "TabsList");
    expectComponentFileToOwnOnly(attentionTabLabelSource, "AttentionTabLabel");
  });

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

  it("keeps Scan Root cards and child regions in folder-owned components", () => {
    expect(rootsPanelSource).toContain("function RootsPanel");
    expect(rootsPanelIndexSource).toContain('./RootsPanel"');
    expect(rootCardSource).toContain("function RootCard");
    expect(rootCardIndexSource).toContain('./RootCard"');
    expect(headerSource).toContain("function Header");
    expect(progressBarSource).toContain("function ProgressBar");
    expect(refreshProgressSource).toContain("function RefreshProgress");
    expect(unprocessableCandidatesSectionSource).toContain(
      "function UnprocessableCandidatesSection",
    );
    expect(inferenceRulesFormSource).toContain("function InferenceRulesForm");
    expect(rootsPanelSource).toContain('./components/RootCard"');
    expect(rootCardSource).toContain('./components/Header"');
    expect(refreshProgressSource).toContain('./ProgressBar"');
    expect(rootCardSource).toContain('./components/RefreshProgress"');
    expect(rootCardSource).toContain(
      './components/UnprocessableCandidatesSection"',
    );
    expect(rootCardSource).toContain('./components/InferenceRulesForm"');
    expect(rootCardSource).not.toMatch(/function ScanRoot/);
    expect(headerSource).not.toMatch(/function ScanRoot/);
    expect(refreshProgressSource).not.toMatch(/function ScanRoot/);
    expect(unprocessableCandidatesSectionSource).not.toMatch(/function ScanRoot/);
    expect(inferenceRulesFormSource).not.toMatch(/function ScanRoot/);
    expectComponentFileToOwnOnly(rootsPanelSource, "RootsPanel");
    expectComponentFileToOwnOnly(rootCardSource, "RootCard");
    expectComponentFileToOwnOnly(headerSource, "Header");
    expectComponentFileToOwnOnly(progressBarSource, "ProgressBar");
    expectComponentFileToOwnOnly(refreshProgressSource, "RefreshProgress");
    expectComponentFileToOwnOnly(
      unprocessableCandidatesSectionSource,
      "UnprocessableCandidatesSection",
    );
    expectComponentFileToOwnOnly(inferenceRulesFormSource, "InferenceRulesForm");
    expect(scanIssuesPanelSource).not.toContain("index.ts");
    expect(previewGenerationSource).not.toContain("index.ts");
  });
});

function expectComponentFileToOwnOnly(source: string, componentName: string) {
  const componentFunctionNames = Array.from(
    source.matchAll(/function ([A-Z][A-Za-z0-9]*)/g),
  ).map((match) => match[1]);

  expect(componentFunctionNames).toEqual([componentName]);
}
