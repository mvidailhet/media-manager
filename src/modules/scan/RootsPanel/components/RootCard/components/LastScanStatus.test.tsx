import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultInferenceRules } from "../../../../../../test/AppTestHarness";
import type { ScanRoot } from "../../../../../../tauriCommands";
import { LastScanStatus } from "./LastScanStatus";

describe("LastScanStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-19T10:10:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats SQLite Scan Root timestamps as UTC", () => {
    renderLastScanStatus("2026-05-19 10:00:00");

    expect(screen.getByText("Last scan done 10 minutes ago")).toBeInTheDocument();
  });
});

function renderLastScanStatus(lastScanCompletedAt: string) {
  render(
    <MantineProvider>
      <LastScanStatus
        scanRoot={scanRootWithLastScanCompletedAt(lastScanCompletedAt)}
      />
    </MantineProvider>,
  );
}

function scanRootWithLastScanCompletedAt(lastScanCompletedAt: string): ScanRoot {
  return {
    inferenceRules: defaultInferenceRules,
    isAvailable: true,
    lastScanCompletedAt,
    path: "/Volumes/Archive/Videos",
  };
}
