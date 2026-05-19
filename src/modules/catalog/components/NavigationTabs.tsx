import { Tabs } from "@mantine/core";
import { IconBulb, IconStar } from "@tabler/icons-react";

import type { CatalogView } from "../catalogTypes";

type NavigationTabsProps = {
  catalogView: CatalogView;
  onCatalogViewChange: (catalogView: CatalogView) => void;
};

const navigationIconSize = 20;

export function NavigationTabs({
  catalogView,
  onCatalogViewChange,
}: NavigationTabsProps) {
  return (
    <Tabs
      value={catalogView}
      onChange={(value) => onCatalogViewChange(value as CatalogView)}
      keepMounted={false}
    >
      <Tabs.List aria-label="Catalog navigation">
        <Tabs.Tab value="allVideos">All Videos</Tabs.Tab>
        <Tabs.Tab
          value="favorites"
          leftSection={<IconStar size={navigationIconSize} />}
        >
          Favorites
        </Tabs.Tab>
        <Tabs.Tab
          value="metadataSuggestions"
          leftSection={<IconBulb size={navigationIconSize} />}
        >
          Metadata Suggestions
        </Tabs.Tab>
      </Tabs.List>
    </Tabs>
  );
}
