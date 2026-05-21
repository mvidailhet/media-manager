import { describe, expect, it } from "vitest";

import { previewStripStartSecondsFromPointerRatio } from "./previewStripFrame";

describe("preview strip frame", () => {
  it("maps a continuous pointer ratio to rounded start seconds", () => {
    expect(previewStripStartSecondsFromPointerRatio(0.5, 600_000)).toBe(300);
    expect(previewStripStartSecondsFromPointerRatio(0.123, 600_000)).toBe(74);
  });

  it("clamps start seconds inside the video duration", () => {
    expect(previewStripStartSecondsFromPointerRatio(-1, 600_000)).toBe(0);
    expect(previewStripStartSecondsFromPointerRatio(2, 600_000)).toBe(600);
  });
});
