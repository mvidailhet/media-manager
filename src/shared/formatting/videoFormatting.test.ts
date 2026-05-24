import { describe, expect, it } from "vitest";

import {
  formatCompactFileSize,
  formatDuration,
  formatPlaybackTime,
} from "./videoFormatting";

describe("video formatting", () => {
  it("formats compact file sizes without decimals", () => {
    expect(formatCompactFileSize(150_000_000)).toBe("150Mo");
    expect(formatCompactFileSize(1_500_000_000)).toBe("2Go");
    expect(formatCompactFileSize(null)).toBe("Unknown");
  });

  it("formats short video durations without making playable clips look empty", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(1)).toBe("<1m");
    expect(formatDuration(59_000)).toBe("<1m");
    expect(formatDuration(59_999)).toBe("<1m");
    expect(formatDuration(60_000)).toBe("1m");
    expect(formatDuration(3_723_000)).toBe("1h 2m");
  });

  it("formats precise playback positions", () => {
    expect(formatPlaybackTime(75)).toBe("1:15");
    expect(formatPlaybackTime(3723)).toBe("1:02:03");
    expect(formatPlaybackTime(-1)).toBe("0:00");
  });
});
