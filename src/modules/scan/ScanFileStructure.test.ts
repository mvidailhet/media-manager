import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import previewGenerationSource from "./PreviewGenerationView/PreviewGenerationView.tsx?raw";
import previewStripQueueActivityLabelSource from "./PreviewGenerationView/previewStripQueueActivityLabel.ts?raw";
import failedPreviewStripsPanelSource from "./PreviewGenerationView/components/FailedPreviewStripsPanel.tsx?raw";
import previewStripQueuePanelSource from "./PreviewGenerationView/components/PreviewStripQueuePanel.tsx?raw";
import attentionTabLabelSource from "./components/AttentionTabLabel.tsx?raw";
import tabsListSource from "./components/TabsList.tsx?raw";
import scanSource from "./Scan.tsx?raw";
import scanStyles from "./Scan.module.css";
import scanTabsSource from "./scanTabs.ts?raw";
import missingVideosPanelSource from "./MissingVideosPanel/MissingVideosPanel.tsx?raw";
import missingVideosPanelStyles from "./MissingVideosPanel/MissingVideosPanel.module.css";
import missingVideosListSource from "./MissingVideosPanel/components/MissingVideosList.tsx?raw";
import rootsPanelSource from "./RootsPanel/RootsPanel.tsx?raw";
import rootsPanelStyles from "./RootsPanel/RootsPanel.module.css";
import rootsPanelIndexSource from "./RootsPanel/index.ts?raw";
import secretMetadataSectionSource from "./RootsPanel/components/SecretMetadataSection/SecretMetadataSection.tsx?raw";
import secretMetadataSectionIndexSource from "./RootsPanel/components/SecretMetadataSection/index.ts?raw";
import metadataSecretToggleListSource from "./RootsPanel/components/SecretMetadataSection/components/MetadataSecretToggleList.tsx?raw";
import rootCardSource from "./RootsPanel/components/RootCard/RootCard.tsx?raw";
import rootCardIndexSource from "./RootsPanel/components/RootCard/index.ts?raw";
import headerSource from "./RootsPanel/components/RootCard/components/Header.tsx?raw";
import progressBarSource from "./RootsPanel/components/RootCard/components/ProgressBar.tsx?raw";
import refreshProgressSource from "./RootsPanel/components/RootCard/components/RefreshProgress.tsx?raw";
import unprocessableCandidatesSectionSource from "./RootsPanel/components/RootCard/components/UnprocessableCandidatesSection.tsx?raw";
import inferenceRulesFormSource from "./RootsPanel/components/RootCard/components/InferenceRulesForm.tsx?raw";

const missingVideosPanelStylesSource = readFileSync(
  "src/modules/scan/MissingVideosPanel/MissingVideosPanel.module.css",
  "utf8",
);

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
    expect(tabsListSource).toContain("Missing Videos");
    expect(tabsListSource).toContain("Preview Generation");
    expect(scanTabsSource).toContain('scanRootsTab = "scanRoots"');
    expect(scanTabsSource).toContain('missingVideosTab = "missingVideos"');
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

  it("keeps Missing Videos focused on Missing Videos", () => {
    expect(missingVideosPanelSource).toContain("function MissingVideosPanel");
    expect(missingVideosListSource).toContain("function MissingVideosList");
    expect(missingVideosPanelSource).toContain('./components/MissingVideosList"');
    expect(missingVideosPanelSource).not.toContain("UnavailableScanRootsPanel");
    expect(missingVideosPanelSource).not.toContain(
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
    expect(missingVideosPanelSource).not.toContain("FailedPreviewStripsPanel");
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
    expect(secretMetadataSectionSource).toContain(
      "function SecretMetadataSection",
    );
    expect(secretMetadataSectionIndexSource).toContain(
      './SecretMetadataSection"',
    );
    expect(metadataSecretToggleListSource).toContain(
      "function MetadataSecretToggleList",
    );
    expect(headerSource).toContain("function Header");
    expect(progressBarSource).toContain("function ProgressBar");
    expect(refreshProgressSource).toContain("function RefreshProgress");
    expect(unprocessableCandidatesSectionSource).toContain(
      "function UnprocessableCandidatesSection",
    );
    expect(inferenceRulesFormSource).toContain("function InferenceRulesForm");
    expect(rootsPanelSource).toContain('./components/RootCard"');
    expect(rootsPanelSource).toContain('./components/SecretMetadataSection"');
    expect(secretMetadataSectionSource).toContain(
      './components/MetadataSecretToggleList"',
    );
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
    expectComponentFileToOwnOnly(
      secretMetadataSectionSource,
      "SecretMetadataSection",
    );
    expectComponentFileToOwnOnly(
      metadataSecretToggleListSource,
      "MetadataSecretToggleList",
    );
    expectComponentFileToOwnOnly(rootCardSource, "RootCard");
    expectComponentFileToOwnOnly(headerSource, "Header");
    expectComponentFileToOwnOnly(progressBarSource, "ProgressBar");
    expectComponentFileToOwnOnly(refreshProgressSource, "RefreshProgress");
    expectComponentFileToOwnOnly(
      unprocessableCandidatesSectionSource,
      "UnprocessableCandidatesSection",
    );
    expectComponentFileToOwnOnly(inferenceRulesFormSource, "InferenceRulesForm");
    expect(missingVideosPanelSource).not.toContain("index.ts");
    expect(previewGenerationSource).not.toContain("index.ts");
  });

  it("keeps Scan tabs, Scan Roots, and Missing Videos scrollable inside the module slot", () => {
    expect(scanStyles.scanWorkspace).toBeTruthy();
    expect(scanStyles.scanPanel).toBeTruthy();
    expect(rootsPanelStyles.rootsPanel).toBeTruthy();
    expect(missingVideosPanelStyles.missingVideosPanel).toBeTruthy();
    expect(scanSource).toContain("className={styles.scanWorkspace}");
    expect(scanSource).toContain("className={styles.scanPanel}");
    expect(rootsPanelSource).toContain("className={styles.rootsPanel}");
    expect(missingVideosPanelSource).toContain(
      "className={styles.missingVideosPanel}",
    );
    expect(missingVideosPanelStylesSource).toMatch(
      /\.missingVideosPanel\s*{[^}]*box-sizing:\s*border-box;[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s,
    );
  });
});

function expectComponentFileToOwnOnly(source: string, componentName: string) {
  const componentFunctionNames = Array.from(
    source.matchAll(/function ([A-Z][A-Za-z0-9]*)/g),
  ).map((match) => match[1]);

  expect(componentFunctionNames).toEqual([componentName]);
}
