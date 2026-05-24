import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../../../../AppProviders";
import { MetadataSection } from "./MetadataSection";

describe("MetadataSection", () => {
  it("uses metadata colors for editable Tag and Performer input pills", () => {
    render(
      <AppProviders>
        <MetadataSection
          availableValues={[{ id: 4, name: "Travel" }]}
          emptyLabel="No tags"
          metadataKind="tag"
          onAttach={vi.fn()}
          onCreateOrAttach={vi.fn()}
          onDetach={vi.fn()}
          selectedValues={[{ id: 4, name: "Travel" }]}
          title="Tags"
          videoId={1}
        />
        <MetadataSection
          availableValues={[{ id: 9, name: "Blair" }]}
          emptyLabel="No performers"
          metadataKind="performer"
          onAttach={vi.fn()}
          onCreateOrAttach={vi.fn()}
          onDetach={vi.fn()}
          selectedValues={[{ id: 9, name: "Blair" }]}
          title="Performers"
          videoId={1}
        />
      </AppProviders>,
    );

    const tagsSection = screen.getByRole("region", { name: "Tags" });
    const performersSection = screen.getByRole("region", {
      name: "Performers",
    });

    fireEvent.click(within(tagsSection).getByRole("button", { name: "Edit Tags" }));
    fireEvent.click(
      within(performersSection).getByRole("button", {
        name: "Edit Performers",
      }),
    );

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
