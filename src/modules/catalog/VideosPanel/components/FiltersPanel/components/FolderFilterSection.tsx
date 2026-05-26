import { Checkbox, Group } from "@mantine/core";

import type { CatalogFolderSearchBranch } from "../../../../catalogTypes";
import type { FolderFilterBranchOption } from "../../../folderFilterBranches";

export function FolderFilterSection({
  folderBranches,
  selectedFolderBranches,
  onSelectedFolderBranchesChange,
}: {
  folderBranches: FolderFilterBranchOption[];
  selectedFolderBranches: CatalogFolderSearchBranch[] | null;
  onSelectedFolderBranchesChange: (
    selectedFolderBranches: CatalogFolderSearchBranch[] | null,
  ) => void;
}) {
  if (folderBranches.length === 0) {
    return null;
  }

  return (
    <Checkbox.Group
      label="Folders"
      value={selectedFolderBranches?.map((folderBranch) => folderBranch.path) ?? []}
      onChange={(selectedBranchPaths) => {
        onSelectedFolderBranchesChange(
          selectedBranchPaths.map((selectedBranchPath) => {
            const selectedBranch = folderBranches.find(
              (folderBranch) => folderBranch.path === selectedBranchPath,
            );

            return {
              path: selectedBranchPath,
              availableScanRootPath:
                selectedBranch?.availableScanRootPath ?? selectedBranchPath,
            };
          }),
        );
      }}
    >
      <Group gap="sm" mt="xs">
        {folderBranches.map((folderBranch) => (
          <Checkbox
            aria-label={folderBranch.label}
            key={folderBranch.path}
            value={folderBranch.path}
            label={folderBranch.label}
          />
        ))}
      </Group>
    </Checkbox.Group>
  );
}
