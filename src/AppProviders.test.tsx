import { fireEvent, render, screen } from "@testing-library/react";
import { Button } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { describe, expect, it } from "vitest";

import { AppProviders, appTheme } from "./AppProviders";

describe("AppProviders", () => {
  it("provides the Mantine foundation for the desktop app", async () => {
    render(
      <AppProviders>
        <button type="button">Catalog action</button>
        <Button
          onClick={() =>
            modals.open({
              title: "Remove Scan Root",
              children: "Choose how catalog metadata should be handled."
            })
          }
        >
          Open Mantine modal
        </Button>
        <Button
          onClick={() =>
            notifications.show({
              title: "Refresh complete",
              message: "Catalog metadata is up to date."
            })
          }
        >
          Show Mantine notification
        </Button>
      </AppProviders>
    );

    expect(
      screen.getByRole("button", { name: "Catalog action" })
    ).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute(
      "data-mantine-color-scheme",
      "light"
    );
    expect(
      screen.getByRole("button", { name: "Open Mantine modal" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Mantine modal" }));
    expect(await screen.findByText("Remove Scan Root")).toBeInTheDocument();
    expect(
      screen.getByText("Choose how catalog metadata should be handled.")
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Show Mantine notification" })
    );
    expect(await screen.findByText("Refresh complete")).toBeInTheDocument();
    expect(
      screen.getByText("Catalog metadata is up to date.")
    ).toBeInTheDocument();
    expect(appTheme.fontFamily).toContain("Inter");
  });
});
