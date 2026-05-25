import { describe, expect, it } from "vitest";

import type { CatalogPerformer, CatalogVideo } from "../../../tauriCommands";
import type { CatalogVideoMetadata } from "../catalogTypes";
import { groupCatalogVideosByFirstPerformer } from "./catalogVideoPerformerGroups";

const pendingPreviewStrip = {
  status: "pending" as const,
};

function catalogVideoFixture(id: number, title: string): CatalogVideo {
  return {
    id,
    title,
    durationMilliseconds: 1800000,
    fileSizeBytes: 50740352,
    fileLocationPath: `/Volumes/Archive/Videos/${title.toLowerCase().replace(/ /g, "-")}.mp4`,
    fileLocations: [],
    isAvailable: true,
    isFavorite: false,
    lastOpenedAt: null,
    openCount: 0,
    previewStrip: pendingPreviewStrip,
  };
}

function performerFixture(id: number, name: string): CatalogPerformer {
  return {
    id,
    isSecret: false,
    name,
  };
}

function metadataFixture(performers: CatalogPerformer[]): CatalogVideoMetadata {
  return {
    performers,
    tags: [],
  };
}

describe("groupCatalogVideosByFirstPerformer", () => {
  it("shows unassigned Videos before Performer groups", () => {
    const alex = performerFixture(1, "Alex");
    const blair = performerFixture(2, "Blair");
    const looseClip = catalogVideoFixture(1, "Loose Clip");
    const blairClip = catalogVideoFixture(2, "Blair Clip");
    const alexClip = catalogVideoFixture(3, "Alex Clip");

    const performerGroups = groupCatalogVideosByFirstPerformer({
      catalogVideoMetadataById: {
        [alexClip.id]: metadataFixture([alex]),
        [blairClip.id]: metadataFixture([blair]),
        [looseClip.id]: metadataFixture([]),
      },
      catalogVideos: [blairClip, looseClip, alexClip],
    });

    expect(
      performerGroups.map(
        (performerGroup) => performerGroup.performer?.name ?? "Unassigned",
      ),
    ).toEqual(["Unassigned", "Alex", "Blair"]);
  });
});
