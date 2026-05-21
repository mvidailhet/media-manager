import type { CatalogPerformer, CatalogVideo } from "../../../tauriCommands";
import type { CatalogVideoMetadata } from "../catalogTypes";

export type CatalogVideoPerformerGroup = {
  performer: CatalogPerformer | null;
  videos: CatalogVideo[];
};

export function groupCatalogVideosByFirstPerformer({
  catalogVideoMetadataById,
  catalogVideos,
}: {
  catalogVideoMetadataById: Record<number, CatalogVideoMetadata>;
  catalogVideos: CatalogVideo[];
}): CatalogVideoPerformerGroup[] {
  const groupsByPerformerId = new Map<number, CatalogVideoPerformerGroup>();
  const unassignedVideos: CatalogVideo[] = [];

  for (const catalogVideo of catalogVideos) {
    const firstPerformer =
      catalogVideoMetadataById[catalogVideo.id]?.performers[0] ?? null;

    if (!firstPerformer) {
      unassignedVideos.push(catalogVideo);
      continue;
    }

    const existingGroup = groupsByPerformerId.get(firstPerformer.id);

    if (existingGroup) {
      existingGroup.videos.push(catalogVideo);
      continue;
    }

    groupsByPerformerId.set(firstPerformer.id, {
      performer: firstPerformer,
      videos: [catalogVideo],
    });
  }

  const performerGroups = Array.from(groupsByPerformerId.values()).sort(
    (leftGroup, rightGroup) =>
      leftGroup.performer!.name.localeCompare(rightGroup.performer!.name),
  );

  if (unassignedVideos.length === 0) {
    return performerGroups;
  }

  return [
    ...performerGroups,
    {
      performer: null,
      videos: unassignedVideos,
    },
  ];
}
