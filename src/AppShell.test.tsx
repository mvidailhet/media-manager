import { readFileSync } from "node:fs";
import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  mockedListCatalogVideos,
  pendingPreviewStrip,
  renderApp,
  resetAppTestHarness,
  openScanModule,
  openSettingsModule,
} from "./test/AppTestHarness";

const appStylesSource = readFileSync(
  "src/App.module.css",
  "utf8",
);

describe("App shell", () => {
  beforeEach(resetAppTestHarness);

  it("renders the Catalog-owned Selection Panel in the main workspace", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
      {
        id: 2,
        title: "City Walk",
        durationMilliseconds: 1800000,
        fileSizeBytes: 50740352,
        fileLocationPath: "/Volumes/Archive/Videos/city-walk.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });

    const selectionPanel = await screen.findByRole("complementary", {
      name: "Selection Panel",
    });
    expect(within(selectionPanel).getByText("No video selected")).toBeVisible();

    fireEvent.click(
      await within(catalogVideos).findByRole("article", {
        name: "Family Trip",
      }),
    );

    const appMain = screen.getByRole("main");
    const detailPanel = await within(selectionPanel).findByRole("region", {
      name: "Video Detail Panel",
    });

    expect(appMain.className).toMatch(/mainContent/);
    expect(detailPanel).toBeInTheDocument();
    expect(
      within(appMain).getByRole("region", { name: "Video Detail Panel" }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(catalogVideos).getByRole("article", {
        name: "City Walk",
      }),
    );

    expect(
      await within(selectionPanel).findByRole("heading", { name: "City Walk" }),
    ).toBeInTheDocument();
  });

  it("keeps Catalog Videos flush to the available right edge", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    const appMain = screen.getByRole("main");
    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });

    expect(appStylesSource).not.toMatch(
      /padding-right:\s*var\(--app-shell-aside-offset/,
    );
    expect(await screen.findByRole("complementary", {
      name: "Selection Panel",
    })).toBeInTheDocument();

    fireEvent.click(
      within(catalogVideos).getByRole("article", {
        name: "Family Trip",
      }),
    );

    expect(await screen.findByRole("complementary", {
      name: "Selection Panel",
    })).toBeInTheDocument();
    expect(appMain.className).toMatch(/mainContent/);
  });

  it("renders Catalog as the initial module workspace", async () => {
    renderApp();

    expect(
      screen.getByRole("region", { name: "Catalog Videos" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Back to Catalog" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "FFmpeg status" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Tauri command status" }),
    ).not.toBeInTheDocument();
  });

  it("returns from secondary modules to Catalog with the back button", async () => {
    renderApp();

    await openScanModule();
    expect(
      await screen.findByRole("heading", { name: "Scan Roots" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to Catalog" }));

    expect(
      screen.getByRole("region", { name: "Catalog Videos" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Back to Catalog" }),
    ).not.toBeInTheDocument();

    await openSettingsModule();
    expect(
      await screen.findByRole("heading", { name: "FFmpeg status" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to Catalog" }));

    expect(
      screen.getByRole("region", { name: "Catalog Videos" }),
    ).toBeInTheDocument();
  });

  it("clears Batch Edit when applying the Favorites", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: true,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
      {
        id: 2,
        title: "City Walk",
        durationMilliseconds: 1800000,
        fileSizeBytes: 50740352,
        fileLocationPath: "/Volumes/Archive/Videos/city-walk.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    fireEvent.click(
      await within(catalogVideos).findByRole("article", {
        name: "Family Trip",
      }),
    );
    fireEvent.click(
      within(catalogVideos).getByRole("article", { name: "City Walk" }),
      { metaKey: true },
    );

    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Video Detail Panel" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(catalogVideos).getByRole("checkbox", {
        name: "Favorites",
      }),
    );

    expect(
      screen.queryByRole("region", { name: "Batch Edit Panel" }),
    ).not.toBeInTheDocument();
  });

  it("shows the aside when multiple Videos are selected for Batch Edit", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
      {
        id: 2,
        title: "City Walk",
        durationMilliseconds: 1800000,
        fileSizeBytes: 50740352,
        fileLocationPath: "/Volumes/Archive/Videos/city-walk.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    const catalogVideos = await screen.findByRole("region", {
      name: "Catalog Videos",
    });
    fireEvent.click(
      await within(catalogVideos).findByRole("article", {
        name: "Family Trip",
      }),
    );
    fireEvent.click(
      within(catalogVideos).getByRole("article", { name: "City Walk" }),
      { metaKey: true },
    );

    expect(
      await screen.findByRole("region", { name: "Batch Edit Panel" }),
    ).toBeInTheDocument();
  });

  it("does not render main Catalog tabs for Videos View controls", async () => {
    mockedListCatalogVideos.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: true,
        fileLocations: [],
        isFavorite: false,
        lastOpenedAt: null,
        openCount: 0,
        previewStrip: pendingPreviewStrip,
      },
    ]);

    renderApp();

    await screen.findByRole("region", { name: "Catalog Videos" });

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "All Videos" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Favorites" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Metadata Suggestions" }),
    ).not.toBeInTheDocument();
  });
});
