import { describe, expect, it } from "vitest";

import { formatCompactFileSize, formatPlaybackTime } from "./videoFormatting";

describe("video formatting", () => {
  it("formats compact file sizes without decimals", () => {
    expect(formatCompactFileSize(150_000_000)).toBe("150Mo");
    expect(formatCompactFileSize(1_500_000_000)).toBe("2Go");
    expect(formatCompactFileSize(null)).toBe("Unknown");
  });

  it("formats precise playback positions", () => {
    expect(formatPlaybackTime(75)).toBe("1:15");
    expect(formatPlaybackTime(3723)).toBe("1:02:03");
    expect(formatPlaybackTime(-1)).toBe("0:00");
  });
});
