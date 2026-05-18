import { describe, expect, it } from "vitest";

import {
  metadataBadgeColors,
  metadataBadgeColorForKind,
} from "./metadataBadgeStyles";

describe("metadataBadgeStyles", () => {
  it("uses distinct colors for Tag and Performer Badges from one source", () => {
    expect(metadataBadgeColorForKind("tag")).toBe(metadataBadgeColors.tag);
    expect(metadataBadgeColorForKind("performer")).toBe(
      metadataBadgeColors.performer,
    );
    expect(metadataBadgeColors.performer).not.toBe(metadataBadgeColors.tag);
  });
});
