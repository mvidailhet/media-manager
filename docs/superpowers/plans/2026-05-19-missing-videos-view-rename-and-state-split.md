# Missing Videos View Rename And State Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename Scan Issues to Missing Videos everywhere and split the old scan-issues aggregate so each workflow owns its own data.

**Architecture:** Keep **Missing Videos View** under the Scan module, but make it narrow: only missing videos and forget actions. Move unprocessable video candidates into Scan Roots state because root cards render them. Move failed preview strip loading/actions into Preview Generation state. Keep metadata suggestion loading with Catalog state instead of any Missing Videos state.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Tauri command mocks.

---

## File Structure

- Modify `src/modules/scan/scanTabs.ts`: rename `scanIssuesTab` to `missingVideosTab`, keep tab value stable only if migration risk is useful; prefer value `"missingVideos"`.
- Rename `src/modules/scan/ScanIssuesPanel/` to `src/modules/scan/MissingVideosPanel/`.
- Rename parent component `ScanIssuesPanel.tsx` to `MissingVideosPanel.tsx`; keep owned child component `components/MissingVideosList.tsx` or rename existing child away from duplicated parent naming if needed.
- Modify `src/modules/scan/components/TabsList.tsx`: display `Missing Videos` and use `missingVideosAttentionCount`.
- Modify `src/modules/scan/Scan.tsx`: consume `MissingVideosPanel`, `missingVideosTab`, `missingVideosAttentionCount`, and `missingVideosStatusMessage`.
- Replace `src/modules/scan/useScanIssues.ts` with narrow hooks:
  - `src/modules/scan/useMissingVideos.ts`: owns loading status for missing videos if needed, or only exposes status refresh naming if the source remains `catalogVideos`.
  - `src/modules/scan/useScanRoots.ts`: owns `unprocessableVideoCandidateGroups`.
  - `src/modules/scan/usePreviewGeneration.ts`: owns failed preview strips and retry/ignore actions.
- Modify `src/modules/scan/useScanModuleController.ts`: compose the three narrow workflow states.
- Modify `src/modules/catalog/useCatalogModuleController.ts`: rename dependencies from `refreshScanIssues` and `setScanIssuesStatusMessage` to `refreshMissingVideos` and `setMissingVideosStatusMessage`.
- Modify `src/modules/settings/useSettingsModuleController.ts`, `src/modules/settings/useSettingsStatus.ts`, and `src/App.tsx`: use missing-video naming for missing-video refresh/status only.
- Modify `src/test/AppTestHarness.tsx`: rename `openScanIssuesTab` to `openMissingVideosTab`.
- Modify tests under `src/modules/scan`, `src/modules/catalog`, `src/modules/settings`, `src/AppArchitecture.test.tsx`: replace user-facing and internal expectations.
- Update stale docs only where they describe current structure: `docs/adr/0010-split-ui-and-backend-by-domain-workflow-boundaries.md` may need a superseding note only if tests or docs enforce it; otherwise leave historical ADR unchanged.

---

### Task 1: Rename The User-Facing Missing Videos Tab And Panel

**Files:**
- Modify: `src/modules/scan/scanTabs.ts`
- Modify: `src/modules/scan/components/TabsList.tsx`
- Rename/modify: `src/modules/scan/ScanIssuesPanel/ScanIssuesPanel.tsx` to `src/modules/scan/MissingVideosPanel/MissingVideosPanel.tsx`
- Rename/modify: `src/modules/scan/ScanIssuesPanel/components/MissingVideosPanel.tsx` to `src/modules/scan/MissingVideosPanel/components/MissingVideosList.tsx`
- Modify: `src/modules/scan/Scan.tsx`
- Test: `src/modules/scan/Scan.test.tsx`
- Test: `src/modules/scan/ScanFileStructure.test.ts`

- [ ] **Step 1: Write failing tests for user-facing labels**

In `src/modules/scan/Scan.test.tsx`, update the tab routing test so it expects Missing Videos:

```tsx
expect(screen.getByRole("tab", { name: "Missing Videos 1" })).toBeInTheDocument();
fireEvent.click(screen.getByRole("tab", { name: "Missing Videos 1" }));
const missingVideos = await screen.findByRole("tabpanel", {
  name: "Missing Videos 1",
});
expect(within(missingVideos).getByText("Missing Trip")).toBeInTheDocument();
```

In the missing-video listing test, expect the panel region and heading to be Missing Videos:

```tsx
const missingVideos = await screen.findByRole("region", {
  name: "Missing Videos",
});
expect(
  within(missingVideos).getByRole("heading", { name: "Missing Videos" }),
).toBeInTheDocument();
expect(await within(missingVideos).findByText("Family Trip")).toBeInTheDocument();
```

In `src/modules/scan/ScanFileStructure.test.ts`, update raw-source assertions:

```tsx
expect(tabsListSource).toContain("Missing Videos");
expect(scanTabsSource).toContain('missingVideosTab = "missingVideos"');
expect(missingVideosPanelSource).toContain("function MissingVideosPanel");
expect(missingVideosListSource).toContain("function MissingVideosList");
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/modules/scan/Scan.test.tsx src/modules/scan/ScanFileStructure.test.ts
```

Expected: FAIL because `Scan Issues` labels/components still exist.

- [ ] **Step 3: Rename tab constant and labels**

Change `src/modules/scan/scanTabs.ts` to:

```ts
export const scanRootsTab = "scanRoots";
export const missingVideosTab = "missingVideos";
export const previewGenerationTab = "previewGeneration";
```

In `src/modules/scan/components/TabsList.tsx`, replace props and label:

```tsx
export function TabsList({
  scanRootsAttentionCount,
  missingVideosAttentionCount,
  previewGenerationAttentionCount,
}: {
  scanRootsAttentionCount: number;
  missingVideosAttentionCount: number;
  previewGenerationAttentionCount: number;
}) {
  return (
    <Tabs.List>
      <Tabs.Tab value={scanRootsTab}>
        <TabLabel attentionCount={scanRootsAttentionCount} label="Scan Roots" />
      </Tabs.Tab>
      <Tabs.Tab value={missingVideosTab}>
        <TabLabel attentionCount={missingVideosAttentionCount} label="Missing Videos" />
      </Tabs.Tab>
      <Tabs.Tab value={previewGenerationTab}>
        <TabLabel
          attentionCount={previewGenerationAttentionCount}
          label="Preview Generation"
        />
      </Tabs.Tab>
    </Tabs.List>
  );
}
```

- [ ] **Step 4: Rename panel files and imports**

Rename files:

```bash
mkdir -p src/modules/scan/MissingVideosPanel/components
git mv src/modules/scan/ScanIssuesPanel/ScanIssuesPanel.tsx src/modules/scan/MissingVideosPanel/MissingVideosPanel.tsx
git mv src/modules/scan/ScanIssuesPanel/components/MissingVideosPanel.tsx src/modules/scan/MissingVideosPanel/components/MissingVideosList.tsx
rmdir src/modules/scan/ScanIssuesPanel/components
rmdir src/modules/scan/ScanIssuesPanel
```

Update `src/modules/scan/MissingVideosPanel/MissingVideosPanel.tsx`:

```tsx
import { Box, Text } from "@mantine/core";

import type { CatalogVideo } from "../../../tauriCommands";
import { SectionHeader } from "../../../components/SectionHeader";
import { MissingVideosList } from "./components/MissingVideosList";

export function MissingVideosPanel({
  missingVideos,
  missingVideosStatusMessage,
  onRequestMissingVideoForget,
}: {
  missingVideos: CatalogVideo[];
  missingVideosStatusMessage: string;
  onRequestMissingVideoForget: (catalogVideo: CatalogVideo) => void;
}) {
  return (
    <Box component="section" aria-label="Missing Videos" p="md" maw={760}>
      <SectionHeader label="Missing videos" title="Missing Videos" />
      {missingVideosStatusMessage ? <Text>{missingVideosStatusMessage}</Text> : null}
      <MissingVideosList
        missingVideos={missingVideos}
        onRequestMissingVideoForget={onRequestMissingVideoForget}
      />
    </Box>
  );
}
```

Update `src/modules/scan/MissingVideosPanel/components/MissingVideosList.tsx` export name:

```tsx
export function MissingVideosList({
  missingVideos,
  onRequestMissingVideoForget,
}: {
  missingVideos: CatalogVideo[];
  onRequestMissingVideoForget: (catalogVideo: CatalogVideo) => void;
}) {
  // Keep existing rendered list body.
}
```

- [ ] **Step 5: Update Scan composition**

In `src/modules/scan/Scan.tsx`, import and use the renamed tab/panel/props:

```tsx
import { MissingVideosPanel } from "./MissingVideosPanel/MissingVideosPanel";
import { missingVideosTab, previewGenerationTab, scanRootsTab } from "./scanTabs";
```

Rename props:

```ts
missingVideosAttentionCount: number;
missingVideosStatusMessage: string;
```

Use:

```tsx
<Tabs defaultValue={scanRootsTab}>
  <TabsList
    scanRootsAttentionCount={scanRootsAttentionCount}
    missingVideosAttentionCount={missingVideosAttentionCount}
    previewGenerationAttentionCount={previewGenerationAttentionCount}
  />
  <Tabs.Panel value={missingVideosTab}>
    <MissingVideosPanel
      missingVideos={missingVideos}
      missingVideosStatusMessage={missingVideosStatusMessage}
      onRequestMissingVideoForget={onRequestMissingVideoForget}
    />
  </Tabs.Panel>
</Tabs>
```

- [ ] **Step 6: Run tests to verify pass**

Run:

```bash
npm test -- src/modules/scan/Scan.test.tsx src/modules/scan/ScanFileStructure.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/scan src/modules/scan/Scan.test.tsx src/modules/scan/ScanFileStructure.test.ts
git commit -m "refactor: rename scan issues view to missing videos"
```

---

### Task 2: Split Unprocessable Candidate State Into Scan Roots

**Files:**
- Modify: `src/modules/scan/useScanRoots.ts`
- Modify: `src/modules/scan/useScanModuleController.ts`
- Modify: `src/modules/scan/RootsPanel/RootsPanel.tsx` if prop names need adjustment
- Test: `src/modules/scan/Scan.test.tsx`
- Test: `src/modules/scan/ScanArchitecture.test.ts`

- [ ] **Step 1: Write failing architecture and behavior tests**

In `src/modules/scan/ScanArchitecture.test.ts`, add:

```ts
expect(scanRootsHookSource).toMatch(/listUnprocessableVideoCandidatesByScanRoot/);
expect(scanControllerSource).not.toMatch(/scanIssues\.unprocessableVideoCandidateGroups/);
```

In `src/modules/scan/Scan.test.tsx`, keep the existing root-card unprocessable candidate test but make sure it still loads after Scan Roots render:

```tsx
expect(mockedListUnprocessableVideoCandidatesByScanRoot).toHaveBeenCalled();
const scanRoots = await screen.findByLabelText("Scan Roots");
expect(within(scanRoots).getAllByText("missing moov atom")[0]).toBeInTheDocument();
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/modules/scan/Scan.test.tsx src/modules/scan/ScanArchitecture.test.ts
```

Expected: FAIL because unprocessable candidates are still loaded through the old aggregate hook.

- [ ] **Step 3: Move loading into `useScanRoots.ts`**

Import command and type:

```ts
import {
  listUnprocessableVideoCandidatesByScanRoot,
  type UnprocessableVideoCandidateGroup,
} from "../../tauriCommands";
```

Add state:

```ts
const [unprocessableVideoCandidateGroups, setUnprocessableVideoCandidateGroups] =
  useState<UnprocessableVideoCandidateGroup[]>([]);
```

Add loader:

```ts
async function refreshUnprocessableVideoCandidates() {
  const candidateGroups = await listUnprocessableVideoCandidatesByScanRoot();
  setUnprocessableVideoCandidateGroups(candidateGroups);
}
```

Call it on initial Scan Roots load and after scan root refresh completes:

```ts
await refreshUnprocessableVideoCandidates();
```

Return it:

```ts
return {
  // existing fields
  refreshUnprocessableVideoCandidates,
  unprocessableVideoCandidateGroups,
};
```

- [ ] **Step 4: Update controller ownership**

In `src/modules/scan/useScanModuleController.ts`, replace:

```ts
scanRootsAttentionCount: scanIssues.unprocessableVideoCandidateGroups.reduce(...)
scanRootProps: {
  unprocessableVideoCandidateGroups: scanIssues.unprocessableVideoCandidateGroups,
}
```

with:

```ts
const scanRootsAttentionCount =
  scanRootsState.unprocessableVideoCandidateGroups.reduce(
    (candidateCount, candidateGroup) => candidateCount + candidateGroup.candidateCount,
    0,
  );

scanRootProps: {
  unprocessableVideoCandidateGroups: scanRootsState.unprocessableVideoCandidateGroups,
}
```

- [ ] **Step 5: Run tests to verify pass**

Run:

```bash
npm test -- src/modules/scan/Scan.test.tsx src/modules/scan/ScanArchitecture.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/scan/useScanRoots.ts src/modules/scan/useScanModuleController.ts src/modules/scan/Scan.test.tsx src/modules/scan/ScanArchitecture.test.ts
git commit -m "refactor: load unprocessable candidates with scan roots"
```

---

### Task 3: Split Failed Preview Strip State Into Preview Generation

**Files:**
- Modify: `src/modules/scan/usePreviewGeneration.ts`
- Modify: `src/modules/scan/useScanModuleController.ts`
- Test: `src/modules/scan/Scan.test.tsx`
- Test: `src/modules/scan/ScanArchitecture.test.ts`

- [ ] **Step 1: Write failing architecture test**

In `src/modules/scan/ScanArchitecture.test.ts`, assert failed preview ownership:

```ts
expect(previewGenerationHookSource).toMatch(/listFailedPreviewStrips/);
expect(previewGenerationHookSource).toMatch(/retryFailedPreviewStrip/);
expect(previewGenerationHookSource).toMatch(/ignoreFailedPreviewStrip/);
expect(scanControllerSource).not.toMatch(/scanIssues\.failedPreviewStrips/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/modules/scan/Scan.test.tsx src/modules/scan/ScanArchitecture.test.ts
```

Expected: FAIL because failed preview strip state is still loaded through the old aggregate.

- [ ] **Step 3: Move failed preview loading/actions into `usePreviewGeneration.ts`**

Import commands and type:

```ts
import {
  ignoreFailedPreviewStrip,
  listFailedPreviewStrips,
  retryFailedPreviewStrip,
  type FailedPreviewStrip,
} from "../../tauriCommands";
```

Add state:

```ts
const [failedPreviewStrips, setFailedPreviewStrips] = useState<FailedPreviewStrip[]>([]);
```

Add actions:

```ts
async function refreshFailedPreviewStrips() {
  setFailedPreviewStrips(await listFailedPreviewStrips());
}

async function retryFailedPreview(videoId: number) {
  await retryFailedPreviewStrip(videoId);
  await refreshFailedPreviewStrips();
  await latestRefreshCatalogVideos.current();
}

async function ignoreFailedPreview(videoId: number) {
  await ignoreFailedPreviewStrip(videoId);
  await refreshFailedPreviewStrips();
}
```

Call `refreshFailedPreviewStrips()` during initial preview generation load and after generation completes.

Return:

```ts
return {
  // existing fields
  failedPreviewStrips,
  ignoreFailedPreview,
  refreshFailedPreviewStrips,
  retryFailedPreview,
};
```

- [ ] **Step 4: Update controller ownership**

In `src/modules/scan/useScanModuleController.ts`, replace failed preview references:

```ts
const previewGenerationAttentionCount =
  previewGeneration.failedPreviewStrips.length;

previewGenerationProps: {
  failedPreviewStrips: previewGeneration.failedPreviewStrips,
  onIgnoreFailedPreview: previewGeneration.ignoreFailedPreview,
  onRetryFailedPreview: previewGeneration.retryFailedPreview,
}
```

- [ ] **Step 5: Run tests to verify pass**

Run:

```bash
npm test -- src/modules/scan/Scan.test.tsx src/modules/scan/ScanArchitecture.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/scan/usePreviewGeneration.ts src/modules/scan/useScanModuleController.ts src/modules/scan/Scan.test.tsx src/modules/scan/ScanArchitecture.test.ts
git commit -m "refactor: load failed previews with preview generation"
```

---

### Task 4: Move Metadata Suggestion Loading Out Of Scan Aggregate

**Files:**
- Modify: `src/modules/catalog/useCatalogModuleController.ts`
- Modify: `src/modules/scan/useScanModuleController.ts`
- Remove or shrink: `src/modules/scan/useScanIssues.ts`
- Test: `src/modules/catalog/Catalog.test.tsx`
- Test: `src/modules/scan/ScanArchitecture.test.ts`

- [ ] **Step 1: Write failing architecture test**

In `src/modules/scan/ScanArchitecture.test.ts`, assert Scan no longer owns metadata suggestions:

```ts
expect(scanControllerSource).not.toMatch(/metadataSuggestionGroups: scanIssues/);
expect(scanControllerSource).not.toMatch(/listMetadataSuggestionGroups/);
```

In a Catalog architecture test, assert Catalog owns the load:

```ts
expect(catalogControllerSource).toMatch(/listMetadataSuggestionGroups/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/modules/catalog/Catalog.test.tsx src/modules/scan/ScanArchitecture.test.ts
```

Expected: FAIL because the old aggregate still owns or routes metadata suggestion refresh.

- [ ] **Step 3: Keep metadata suggestion refresh in Catalog**

In `src/modules/catalog/useCatalogModuleController.ts`, keep or add:

```ts
async function refreshMetadataSuggestionGroups() {
  setMetadataSuggestionGroups(await listMetadataSuggestionGroups());
}
```

Make Catalog actions call `refreshMetadataSuggestionGroups()` directly after metadata-affecting operations instead of calling any scan/missing-video status setter for suggestion state.

- [ ] **Step 4: Remove metadata suggestion state from Scan controller**

In `src/modules/scan/useScanModuleController.ts`, remove:

```ts
metadataSuggestionGroups: scanIssues.metadataSuggestionGroups,
```

and any dependency that exists only to keep Catalog metadata suggestions fresh.

- [ ] **Step 5: Run tests to verify pass**

Run:

```bash
npm test -- src/modules/catalog/Catalog.test.tsx src/modules/scan/ScanArchitecture.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/catalog/useCatalogModuleController.ts src/modules/scan/useScanModuleController.ts src/modules/catalog/Catalog.test.tsx src/modules/scan/ScanArchitecture.test.ts
git commit -m "refactor: keep metadata suggestions with catalog review"
```

---

### Task 5: Replace The Old Scan Issues Hook With Missing Videos Naming

**Files:**
- Rename/modify: `src/modules/scan/useScanIssues.ts` to `src/modules/scan/useMissingVideos.ts`, or delete it if missing videos are derived entirely from `catalogVideos`
- Modify: `src/modules/scan/useScanModuleController.ts`
- Modify: `src/modules/catalog/useCatalogModuleController.ts`
- Modify: `src/modules/settings/useSettingsModuleController.ts`
- Modify: `src/modules/settings/useSettingsStatus.ts`
- Modify: `src/App.tsx`
- Modify: `src/test/AppTestHarness.tsx`
- Test: `src/modules/scan/ScanArchitecture.test.ts`
- Test: `src/AppArchitecture.test.ts`

- [ ] **Step 1: Write failing no-old-name tests**

In `src/modules/scan/ScanArchitecture.test.ts` and `src/AppArchitecture.test.ts`, replace old assertions with:

```ts
expect(appSource).not.toMatch(/ScanIssues|scanIssues|useScanIssues/);
expect(scanControllerSource).not.toMatch(/ScanIssues|scanIssues|useScanIssues/);
expect(scanControllerSource).toMatch(/missingVideos/);
```

In `src/test/AppTestHarness.tsx`, plan to expose:

```ts
export async function openMissingVideosTab() {
  await openScanModule();
  fireEvent.click(await screen.findByRole("tab", { name: /Missing Videos/ }));
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/modules/scan/ScanArchitecture.test.ts src/AppArchitecture.test.ts
```

Expected: FAIL because old scan-issues identifiers remain.

- [ ] **Step 3: Rename status and refresh props**

Across `App.tsx`, Catalog, Settings, and Scan controller boundaries, replace:

```ts
refreshScanIssues
setScanIssuesStatusMessage
scanIssuesStatusMessage
scanIssuesAttentionCount
```

with:

```ts
refreshMissingVideos
setMissingVideosStatusMessage
missingVideosStatusMessage
missingVideosAttentionCount
```

The refresh function should refresh missing-video dependent state only. If missing videos remain derived from `catalogVideos`, `refreshMissingVideos` should call the same catalog-video reload path and set only missing-video status text.

- [ ] **Step 4: Rename helper and imports in tests**

In `src/test/AppTestHarness.tsx`:

```ts
export async function openMissingVideosTab() {
  await openScanModule();
  fireEvent.click(await screen.findByRole("tab", { name: /Missing Videos/ }));
}
```

Replace test imports:

```ts
import { openMissingVideosTab } from "../test/AppTestHarness";
```

- [ ] **Step 5: Delete or narrow old hook**

If `useScanIssues.ts` only contains missing-video status after Tasks 2-4, rename it:

```bash
git mv src/modules/scan/useScanIssues.ts src/modules/scan/useMissingVideos.ts
```

The hook should expose only:

```ts
export function useMissingVideos({
  refreshCatalogVideos,
}: {
  refreshCatalogVideos: () => Promise<void>;
}) {
  const [missingVideosStatusMessage, setMissingVideosStatusMessage] = useState("");

  async function refreshMissingVideos(shouldClearStatusMessage = true) {
    try {
      await refreshCatalogVideos();
      if (shouldClearStatusMessage) {
        setMissingVideosStatusMessage("");
      }
    } catch (error) {
      setMissingVideosStatusMessage(errorMessage(error));
    }
  }

  return {
    missingVideosStatusMessage,
    refreshMissingVideos,
    setMissingVideosStatusMessage,
  };
}
```

- [ ] **Step 6: Run tests to verify pass**

Run:

```bash
npm test -- src/modules/scan/ScanArchitecture.test.ts src/AppArchitecture.test.ts src/modules/scan/Scan.test.tsx src/modules/catalog/Catalog.test.tsx src/modules/settings/Settings.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src App.tsx
git commit -m "refactor: replace scan issues identifiers with missing videos"
```

---

### Task 6: Update Remaining Tests, Docs, And Final Verification

**Files:**
- Modify: any files found by `rg "Scan Issues|ScanIssues|scanIssues|useScanIssues" src docs`
- Modify: `docs/plans/split-ui-and-backend-modules.md` if it describes current target structure
- Modify: `docs/adr/0010-split-ui-and-backend-by-domain-workflow-boundaries.md` only by appending a short superseded-note if current docs require it; do not rewrite historical decision text as if it was always true.
- Test: full frontend test suite
- Test: build

- [ ] **Step 1: Search for stale names**

Run:

```bash
rg -n "Scan Issues|ScanIssues|scanIssues|useScanIssues" src docs CONTEXT.md
```

Expected: no matches in `src` or `CONTEXT.md`; acceptable historical matches in ADRs only if clearly marked as superseded.

- [ ] **Step 2: Update stale current docs**

In `docs/plans/split-ui-and-backend-modules.md`, replace current-target references:

```md
Scan Roots, Missing Videos, and Preview Generation live inside Scan.
```

If updating ADR 0010, append:

```md
## Status note

The former **Scan Issues** workspace was later narrowed and renamed to **Missing Videos View**. **Unavailable Scan Roots** are handled in **Scan Roots**, and **Unprocessable Video Candidates** are reviewed from their **Scan Root**.
```

- [ ] **Step 3: Run focused verification**

Run:

```bash
npm test -- src/modules/scan/Scan.test.tsx src/modules/catalog/Catalog.test.tsx src/modules/settings/Settings.test.tsx src/AppArchitecture.test.ts src/modules/scan/ScanArchitecture.test.ts src/modules/scan/ScanFileStructure.test.ts
```

Expected: all listed test files pass.

- [ ] **Step 4: Run full frontend tests**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: `tsc && vite build` exits 0. Existing bundle-size warning is acceptable.

- [ ] **Step 6: Review diff**

Run:

```bash
git diff --stat
git diff -- src/modules/scan src/modules/catalog src/modules/settings src/test App.tsx CONTEXT.md docs
```

Expected: only Missing Videos rename/split/docs changes.

- [ ] **Step 7: Commit**

```bash
git add src docs CONTEXT.md App.tsx
git commit -m "refactor: align missing videos workflow naming"
```

---

## Self-Review

- Spec coverage: The plan covers user-facing rename, internal identifier rename, split ownership for unprocessable candidates, failed preview strips, metadata suggestions, missing-video-only naming, tests, docs, and final verification.
- Placeholder scan: No TBD/TODO placeholders are present. Each task has exact files, commands, and expected outcomes.
- Type consistency: The plan consistently uses `MissingVideosPanel`, `MissingVideosList`, `missingVideosTab`, `missingVideosAttentionCount`, `missingVideosStatusMessage`, `refreshMissingVideos`, and `setMissingVideosStatusMessage`.
