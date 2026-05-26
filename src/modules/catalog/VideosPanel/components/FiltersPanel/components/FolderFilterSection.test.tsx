import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { CatalogFolderSearchBranch } from "../../../../catalogTypes";
import type { FolderFilterBranchOption } from "../../../folderFilterBranches";
import { FolderFilterSection } from "./FolderFilterSection";

const archiveScanRootPath = "/Volumes/Archive/Videos";
const backupScanRootPath = "/Volumes/Backup/Videos";

describe("FolderFilterSection", () => {
  it("adds a small vertical space between folder tree rows", () => {
    renderFolderFilterSection({
      folderBranches: [
        branch(archiveScanRootPath, archiveScanRootPath),
        branch(`${archiveScanRootPath}/Travel`, archiveScanRootPath),
      ],
    });

    expect(screen.getByText(archiveScanRootPath).parentElement).toHaveStyle({
      marginTop: "4px",
    });
  });

  it("collapses folder branches by default", () => {
    renderFolderFilterSection({
      folderBranches: [
        branch(archiveScanRootPath, archiveScanRootPath),
        branch(`${archiveScanRootPath}/Travel`, archiveScanRootPath),
      ],
    });

    expect(screen.queryByLabelText("Travel")).not.toBeInTheDocument();

    expandFolderBranch(archiveScanRootPath);

    expect(screen.getByLabelText("Travel")).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("uses one global bulk action to unselect and select all visible folder branches", async () => {
    renderFolderFilterSection({
      folderBranches: [
        branch(archiveScanRootPath, archiveScanRootPath),
        branch(`${archiveScanRootPath}/Travel`, archiveScanRootPath),
      ],
    });

    expect(screen.getByLabelText(archiveScanRootPath)).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expandFolderBranch(archiveScanRootPath);
    expect(screen.getByLabelText("Travel")).toHaveAttribute(
      "aria-checked",
      "true",
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Unselect all visible folder branches",
      }),
    );

    expect(screen.getByLabelText(archiveScanRootPath)).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByLabelText("Travel")).toHaveAttribute(
      "aria-checked",
      "false",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Select all visible folder branches",
      }),
    );

    expect(screen.getByLabelText(archiveScanRootPath)).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("Travel")).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("lets keyboard users toggle folder branches", async () => {
    renderFolderFilterSection({
      folderBranches: [
        branch(archiveScanRootPath, archiveScanRootPath),
        branch(`${archiveScanRootPath}/Travel`, archiveScanRootPath),
      ],
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Unselect all visible folder branches",
      }),
    );
    expandFolderBranch(archiveScanRootPath);

    fireEvent.keyDown(screen.getByLabelText("Travel"), { key: " " });

    expect(screen.getByLabelText("Travel")).toHaveAttribute(
      "aria-checked",
      "true",
    );

    fireEvent.keyDown(screen.getByLabelText("Travel"), { key: "Enter" });

    expect(screen.getByLabelText("Travel")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("keeps refresh updates selected under the nearest selected existing ancestor", async () => {
    const initialFolderBranches = [
      branch(archiveScanRootPath, archiveScanRootPath),
      branch(`${archiveScanRootPath}/Travel`, archiveScanRootPath),
      branch(`${archiveScanRootPath}/Studio`, archiveScanRootPath),
    ];
    const { rerender } = renderFolderFilterSection({
      folderBranches: initialFolderBranches,
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Unselect all visible folder branches",
      }),
    );
    expandFolderBranch(archiveScanRootPath);
    fireEvent.click(screen.getByLabelText("Travel"));

    rerenderFolderFilterSection(rerender, {
      folderBranches: [
        ...initialFolderBranches,
        branch(`${archiveScanRootPath}/Travel/Paris`, archiveScanRootPath),
        branch(`${archiveScanRootPath}/Studio/New`, archiveScanRootPath),
      ],
    });
    expandFolderBranch(archiveScanRootPath);

    expect(screen.getByLabelText("Travel")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expandFolderBranch("Travel");
    expect(screen.getByLabelText("Paris")).toHaveAttribute("aria-checked", "true");
  });

  it("selects returning Scan Roots unless the current state is explicit unselect-all", async () => {
    const { rerender } = renderFolderFilterSection({
      folderBranches: [branch(archiveScanRootPath, archiveScanRootPath)],
    });

    rerenderFolderFilterSection(rerender, {
      folderBranches: [
        branch(archiveScanRootPath, archiveScanRootPath),
        branch(backupScanRootPath, backupScanRootPath),
      ],
    });

    expect(screen.getByLabelText(backupScanRootPath)).toHaveAttribute(
      "aria-checked",
      "true",
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Unselect all visible folder branches",
      }),
    );

    rerenderFolderFilterSection(rerender, {
      folderBranches: [
        branch(archiveScanRootPath, archiveScanRootPath),
        branch(backupScanRootPath, backupScanRootPath),
        branch(`${backupScanRootPath}/Studio`, backupScanRootPath),
      ],
    });

    expect(screen.getByLabelText(backupScanRootPath)).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expandFolderBranch(backupScanRootPath);
    expect(screen.getByLabelText("Studio")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});

function renderFolderFilterSection({
  folderBranches,
}: {
  folderBranches: FolderFilterBranchOption[];
}) {
  return render(
    <FolderFilterHarness folderBranches={folderBranches} />,
    { wrapper: MantineProvider },
  );
}

function expandFolderBranch(label: string) {
  fireEvent.click(screen.getByText(label));
}

function rerenderFolderFilterSection(
  rerender: ReturnType<typeof render>["rerender"],
  {
    folderBranches,
  }: {
    folderBranches: FolderFilterBranchOption[];
  },
) {
  rerender(
    <MantineProvider>
      <FolderFilterHarness folderBranches={folderBranches} />
    </MantineProvider>,
  );
}

function FolderFilterHarness({
  folderBranches,
}: {
  folderBranches: FolderFilterBranchOption[];
}) {
  const [selectedFolderBranches, setSelectedFolderBranches] = useState<
    CatalogFolderSearchBranch[] | null
  >(null);

  return (
    <FolderFilterSection
      folderBranches={folderBranches}
      selectedFolderBranches={selectedFolderBranches}
      onSelectedFolderBranchesChange={setSelectedFolderBranches}
    />
  );
}

function branch(
  path: string,
  availableScanRootPath: string,
): FolderFilterBranchOption {
  return {
    availableScanRootPath,
    label: path,
    path,
  };
}
