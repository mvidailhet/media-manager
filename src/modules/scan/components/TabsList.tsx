import { Tabs } from "@mantine/core";

import {
  previewGenerationTab,
  missingVideosTab,
  scanRootsTab,
} from "../scanTabs";
import { AttentionTabLabel } from "./AttentionTabLabel";

type TabsListProps = {
  previewGenerationAttentionCount: number;
  scanRootsAttentionCount: number;
  missingVideosAttentionCount: number;
};

export function TabsList({
  previewGenerationAttentionCount,
  scanRootsAttentionCount,
  missingVideosAttentionCount,
}: TabsListProps) {
  return (
    <Tabs.List aria-label="Scan module tabs">
      <Tabs.Tab value={scanRootsTab}>
        <AttentionTabLabel
          attentionCount={scanRootsAttentionCount}
          label="Scan Roots"
        />
      </Tabs.Tab>
      <Tabs.Tab value={missingVideosTab}>
        <AttentionTabLabel
          attentionCount={missingVideosAttentionCount}
          label="Missing Videos"
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
