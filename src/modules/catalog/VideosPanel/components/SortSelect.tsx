import { Box, NativeSelect } from "@mantine/core";

import type { CatalogVideoSort } from "../../catalogTypes";

const sortSelectWidth = 180;

const catalogVideoSortOptions: { value: CatalogVideoSort; label: string }[] = [
  { value: "titleAscending", label: "Title" },
  { value: "fileSizeAscending", label: "File Size ascending" },
  { value: "fileSizeDescending", label: "File Size descending" },
  { value: "lastOpenedDescending", label: "Last Opened" },
  { value: "openCountDescending", label: "Open Count" },
];

export function SortSelect({
  catalogVideoSort,
  onCatalogVideoSortChange,
}: {
  catalogVideoSort: CatalogVideoSort;
  onCatalogVideoSortChange: (sort: CatalogVideoSort) => void;
}) {
  return (
    <Box ml="auto" w={sortSelectWidth}>
      <NativeSelect
        aria-label="Sort Videos"
        size="xs"
        value={catalogVideoSort}
        data={catalogVideoSortOptions}
        onChange={(event) =>
          onCatalogVideoSortChange(event.currentTarget.value as CatalogVideoSort)
        }
      />
    </Box>
  );
}
