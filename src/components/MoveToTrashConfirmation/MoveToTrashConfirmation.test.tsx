import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../AppProviders";
import { MoveToTrashConfirmation } from "./MoveToTrashConfirmation";

describe("MoveToTrashConfirmation", () => {
  it("confirms a single File Location before moving it to Trash", () => {
    const confirmMoveToTrash = vi.fn();
    const cancelMoveToTrash = vi.fn();

    render(
      <AppProviders>
        <MoveToTrashConfirmation
          affectedFileLocations={[
            "/Volumes/Archive/Videos/Family Trip.mp4",
          ]}
          isOpen
          onCancel={cancelMoveToTrash}
          onConfirm={confirmMoveToTrash}
        />
      </AppProviders>,
    );

    const confirmation = screen.getByRole("dialog", {
      name: "Move this file to Trash?",
    });

    expect(confirmation).toHaveTextContent(
      "/Volumes/Archive/Videos/Family Trip.mp4",
    );
    expect(confirmation).toHaveTextContent(
      "This action cannot be undone from the app.",
    );
    expect(confirmation).not.toHaveTextContent(/delete/i);

    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Cancel" }),
    );
    expect(cancelMoveToTrash).toHaveBeenCalledOnce();

    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Move to Trash" }),
    );
    expect(confirmMoveToTrash).toHaveBeenCalledOnce();
  });

  it("confirms batch File Locations with a count and scrollable list", () => {
    render(
      <AppProviders>
        <MoveToTrashConfirmation
          affectedFileLocations={[
            "/Volumes/Archive/Videos/Family Trip.mp4",
            "/Volumes/Archive/Videos/City Walk.mov",
            "/Volumes/Archive/Videos/Concert.mkv",
          ]}
          isOpen
          onCancel={() => undefined}
          onConfirm={() => undefined}
        />
      </AppProviders>,
    );

    const confirmation = screen.getByRole("dialog", {
      name: "Move 3 files to Trash?",
    });
    const locations = within(confirmation).getByRole("list", {
      name: "File Locations to move to Trash",
    });

    expect(confirmation).toHaveTextContent(
      "3 File Locations will be moved to Trash.",
    );
    expect(locations).toHaveStyle({ overflowY: "auto" });
    expect(locations).toHaveStyle({ maxHeight: "240px" });
    expect(within(locations).getAllByRole("listitem")).toHaveLength(3);
    expect(locations).toHaveTextContent("/Volumes/Archive/Videos/City Walk.mov");
    expect(confirmation).not.toHaveTextContent(/delete/i);
  });
});
