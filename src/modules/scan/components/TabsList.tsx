import { Tabs } from "@mantine/core";

import {
  previewGenerationTab,
  scanIssuesTab,
  scanRootsTab,
} from "../scanTabs";
import { AttentionTabLabel } from "./AttentionTabLabel";

type TabsListProps = {
  previewGenerationAttentionCount: number;
  scanIssuesAttentionCount: number;
};

export function TabsList({
  previewGenerationAttentionCount,
  scanIssuesAttentionCount,
}: TabsListProps) {
  return (
    <Tabs.List aria-label="Scan module tabs">
      <Tabs.Tab value={scanRootsTab}>Scan Roots</Tabs.Tab>
      <Tabs.Tab value={scanIssuesTab}>
        <AttentionTabLabel
          attentionCount={scanIssuesAttentionCount}
          label="Scan Issues"
        />
      </Tabs.Tab>
      <Tabs.Tab value={previewGenerationTab}>
        <AttentionTabLabel
          attentionCount={previewGenerationAttentionCount}
          label="Preview Generation"
        />
      </Tabs.Tab>
    </Tabs.List>
  );
}
