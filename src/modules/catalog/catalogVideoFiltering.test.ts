import { describe, expect, it } from "vitest";

import type { CatalogVideoMetadata } from "./catalogTypes";
import { catalogVideoMatchesTagFilter } from "./catalogVideoFiltering";

const taggedMetadata: CatalogVideoMetadata = {
  performers: [],
  tags: [{ id: 4, isSecret: false, name: "Travel" }],
};

const untaggedMetadata: CatalogVideoMetadata = {
  performers: [],
  tags: [],
};

describe("catalogVideoMatchesTagFilter", () => {
  it("matches only untagged Videos when the No Tag filter is selected", () => {
    expect(catalogVideoMatchesTagFilter(untaggedMetadata, [], true)).toBe(true);
    expect(catalogVideoMatchesTagFilter(taggedMetadata, [], true)).toBe(false);
  });

  it("does not match any Video when No Tag and real Tags are selected together", () => {
    expect(catalogVideoMatchesTagFilter(untaggedMetadata, [4], true)).toBe(false);
    expect(catalogVideoMatchesTagFilter(taggedMetadata, [4], true)).toBe(false);
  });
});
