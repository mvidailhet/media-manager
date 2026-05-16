import { describe, expect, it } from "vitest";

import { formatCompactFileSize } from "./videoFormatting";

describe("video formatting", () => {
  it("formats compact file sizes without decimals", () => {
    expect(formatCompactFileSize(150_000_000)).toBe("150Mo");
    expect(formatCompactFileSize(1_500_000_000)).toBe("2Go");
    expect(formatCompactFileSize(null)).toBe("Unknown");
  });
});
