import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { getLocalDesktopAppStatus } from "./tauriCommands";

vi.mock("./tauriCommands", () => ({
  getLocalDesktopAppStatus: vi.fn()
}));

const mockedGetLocalDesktopAppStatus = vi.mocked(getLocalDesktopAppStatus);

describe("Videos View shell", () => {
  beforeEach(() => {
    mockedGetLocalDesktopAppStatus.mockResolvedValue("Rust command online");
  });

  it("renders the Videos View as the initial workspace", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Videos View" })
    ).toBeInTheDocument();
    expect(screen.getByText("Local Desktop App")).toBeInTheDocument();
    expect(await screen.findByText("Rust command online")).toBeInTheDocument();
  });
});
