import { describe, expect, it } from "vitest";

import {
  buildSuggestionVideoTree,
  getSelectedVideoIds,
} from "./metadataSuggestionTree";

describe("metadataSuggestionTree", () => {
  it("keeps tree node values unique when one Video has multiple suggested file locations", () => {
    const suggestionVideoTree = buildSuggestionVideoTree({
      scanRootPath: "/Volumes/Archive",
      sourcePathSegment: "Family",
      videos: [
        {
          videoId: 129,
          title: "Family Trip",
          fileLocationPath: "/Volumes/Archive/Family/family-trip.mp4",
        },
        {
          videoId: 129,
          title: "Family Trip",
          fileLocationPath: "/Volumes/Archive/Family/family-trip-copy.mp4",
        },
      ],
    });

    const familyNode = suggestionVideoTree.data[0].children?.[0];
    const videoNodeValues =
      familyNode?.children?.map((videoNode) => videoNode.value) ?? [];

    expect(new Set(videoNodeValues).size).toBe(videoNodeValues.length);
    expect(getSelectedVideoIds(videoNodeValues, suggestionVideoTree.videoValueToVideoId)).toEqual([
      129,
    ]);
  });
});
