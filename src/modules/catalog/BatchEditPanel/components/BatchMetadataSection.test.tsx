import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../../../AppProviders";
import { BatchMetadataSection } from "./BatchMetadataSection";

describe("BatchMetadataSection", () => {
  it("uses metadata colors for editable Tag and Performer input pills", () => {
    render(
      <AppProviders>
        <BatchMetadataSection
          availableValues={[{ id: 4, name: "Travel" }]}
          emptyLabel="No tags"
          metadataKind="tag"
          onAppend={vi.fn()}
          onCreateOrAppend={vi.fn()}
          onRemove={vi.fn()}
          selectedValues={[
            { metadata: { id: 4, name: "Travel" }, selectedVideoCount: 2 },
          ]}
          selectedVideoCount={2}
          title="Tags"
        />
        <BatchMetadataSection
          availableValues={[{ id: 9, name: "Blair" }]}
          emptyLabel="No performers"
          metadataKind="performer"
          onAppend={vi.fn()}
          onCreateOrAppend={vi.fn()}
          onRemove={vi.fn()}
          selectedValues={[
            { metadata: { id: 9, name: "Blair" }, selectedVideoCount: 1 },
          ]}
          selectedVideoCount={2}
          title="Performers"
        />
      </AppProviders>,
    );

    const tagsSection = screen.getByRole("region", { name: "Batch Tags" });
    const performersSection = screen.getByRole("region", {
      name: "Batch Performers",
    });

    expect(metadataInputPillFor(tagsSection, "Travel")).toHaveStyle({
      backgroundColor: "var(--mantine-color-blue-light)",
      color: "var(--mantine-color-blue-light-color)",
    });
    expect(metadataInputPillFor(performersSection, "Blair")).toHaveStyle({
      backgroundColor: "var(--mantine-color-grape-light)",
      color: "var(--mantine-color-grape-light-color)",
    });
    expect(metadataInputPillFor(tagsSection, "Travel")).toHaveAttribute(
      "data-size",
      "md",
    );
    expect(metadataInputPillFor(performersSection, "Blair")).toHaveAttribute(
      "data-size",
      "md",
    );
  });
});

function metadataInputPillFor(section: HTMLElement, label: string) {
  const metadataInputPill = within(section)
    .getByText(label)
    .closest(".mantine-Pill-root");

  if (!(metadataInputPill instanceof HTMLElement)) {
    throw new Error(`Missing editable metadata input pill for ${label}`);
  }

  return metadataInputPill;
}
