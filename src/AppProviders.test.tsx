import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppProviders, appTheme } from "./AppProviders";

describe("AppProviders", () => {
  it("provides the Mantine foundation for the desktop app", () => {
    render(
      <AppProviders>
        <button type="button">Catalog action</button>
      </AppProviders>
    );

    expect(
      screen.getByRole("button", { name: "Catalog action" })
    ).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute(
      "data-mantine-color-scheme",
      "light"
    );
    expect(document.querySelector(".mantine-Modal-root")).toBeInTheDocument();
    expect(
      document.querySelector(".mantine-Notifications-root")
    ).toBeInTheDocument();
    expect(appTheme.fontFamily).toContain("Inter");
  });
});
