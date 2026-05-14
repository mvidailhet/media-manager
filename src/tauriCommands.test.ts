import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getLocalDesktopAppStatus } from "./tauriCommands";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn()
}));

const mockedInvoke = vi.mocked(invoke);

describe("Tauri commands", () => {
  beforeEach(() => {
    mockedInvoke.mockResolvedValue("Local command response");
  });

  it("calls the typed Rust command for the Local Desktop App status", async () => {
    const status = await getLocalDesktopAppStatus();

    expect(status).toBe("Local command response");
    expect(mockedInvoke).toHaveBeenCalledWith("get_local_desktop_app_status");
  });
});
