import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../AppProviders";
import { Playback } from "./Playback";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}));

describe("Playback module", () => {
  it("seeks the actual Video when the bottom scrub slider changes", () => {
    render(
      <AppProviders>
        <Playback
          initialVideo={{
            path: "/Volumes/Archive/Videos/family-trip.mp4",
            title: "Family Trip",
            videoId: 1,
          }}
        />
      </AppProviders>,
    );
    const video = screen.getByLabelText("Family Trip video") as HTMLVideoElement;
    Object.defineProperty(video, "duration", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      value: 0,
      writable: true,
    });

    fireEvent.loadedMetadata(video);
    fireEvent.change(screen.getByRole("slider", { name: "Playback scrub" }), {
      target: { value: "25" },
    });

    expect(video.currentTime).toBe(50);
  });
});
