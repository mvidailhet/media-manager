import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Checkbox, Group, Text, Tree, useTree } from "@mantine/core";
import { IconCaretDownFilled } from "@tabler/icons-react";

import type { CatalogFolderSearchBranch } from "../../../../catalogTypes";
import type { FolderFilterBranchOption } from "../../../folderFilterBranches";
import {
  buildFolderFilterTree,
  reconcileSelectedFolderBranches,
  selectedFolderBranchPaths,
} from "../../../folderFilterTree";

const folderFilterTreeCaretSize = 12;
const folderFilterActivationKeys = new Set([" ", "Enter"]);

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
  const previousFolderBranches = useRef<FolderFilterBranchOption[]>(folderBranches);
  const onSelectedFolderBranchesChangeRef = useRef(
    onSelectedFolderBranchesChange,
  );
  const folderFilterTree = useMemo(
    () => buildFolderFilterTree(folderBranches),
    [folderBranches],
  );
  const expandedBranchState = useMemo(
    () =>
      Object.fromEntries(
        folderBranches.map((folderBranch) => [folderBranch.path, true]),
      ),
    [folderBranches],
  );
  const [checkedBranchPaths, setCheckedBranchPaths] = useState(() =>
    selectedFolderBranchPaths(selectedFolderBranches, folderBranches),
  );
  const tree = useTree({
    checkedState: checkedBranchPaths,
    initialExpandedState: expandedBranchState,
    onCheckedStateChange: changeCheckedBranchPaths,
  });
  const allVisibleBranchesSelected = folderBranches.every((folderBranch) =>
    tree.isNodeChecked(folderBranch.path),
  );

  useEffect(() => {
    onSelectedFolderBranchesChangeRef.current = onSelectedFolderBranchesChange;
  }, [onSelectedFolderBranchesChange]);

  useEffect(() => {
    tree.setExpandedState(expandedBranchState);
  }, [expandedBranchState]);

  useEffect(() => {
    if (selectedFolderBranches === null) {
      const nextCheckedBranchPaths = selectedFolderBranchPaths(
        null,
        folderBranches,
      );

      if (!sameBranchPaths(checkedBranchPaths, nextCheckedBranchPaths)) {
        setCheckedBranchPaths(nextCheckedBranchPaths);
      }

      previousFolderBranches.current = folderBranches;
      return;
    }

    const nextSelectedBranches = reconcileSelectedFolderBranches({
      currentSelectedBranches: selectedFolderBranches,
      nextVisibleBranches: folderBranches,
      previousVisibleBranches: previousFolderBranches.current,
    });

    const nextCheckedBranchPaths = selectedFolderBranchPaths(
      nextSelectedBranches,
      folderBranches,
    );

    if (!sameBranchPaths(checkedBranchPaths, nextCheckedBranchPaths)) {
      setCheckedBranchPaths(nextCheckedBranchPaths);
    }

    previousFolderBranches.current = folderBranches;

    if (!sameFolderBranches(selectedFolderBranches, nextSelectedBranches)) {
      onSelectedFolderBranchesChangeRef.current(nextSelectedBranches);
    }
  }, [
    checkedBranchPaths,
    folderBranches,
    selectedFolderBranches,
  ]);

  function changeCheckedBranchPaths(nextCheckedBranchPaths: string[]) {
    setCheckedBranchPaths(nextCheckedBranchPaths);
    onSelectedFolderBranchesChangeRef.current(
      selectedBranchesForCheckedPaths(nextCheckedBranchPaths, folderBranches),
    );
  }

  function selectAllVisibleBranches() {
    setCheckedBranchPaths(folderBranches.map((folderBranch) => folderBranch.path));
    onSelectedFolderBranchesChangeRef.current(null);
  }

  function unselectAllVisibleBranches() {
    setCheckedBranchPaths([]);
    onSelectedFolderBranchesChangeRef.current([]);
  }

  if (folderBranches.length === 0) {
    return null;
  }

  return (
    <Box>
      <Group justify="space-between" gap="sm" mb="xs">
        <Text size="sm" fw={500}>
          Folders
        </Text>
        <Button
          size="xs"
          variant="light"
          leftSection={<Checkbox.Indicator checked={allVisibleBranchesSelected} />}
          aria-label={
            allVisibleBranchesSelected
              ? "Unselect all visible folder branches"
              : "Select all visible folder branches"
          }
          onClick={
            allVisibleBranchesSelected
              ? unselectAllVisibleBranches
              : selectAllVisibleBranches
          }
        >
          {allVisibleBranchesSelected ? "Unselect all" : "Select all"}
        </Button>
      </Group>
      <Tree
        data={folderFilterTree.data}
        tree={tree}
        expandOnClick
        checkOnSpace
        renderNode={({ node, elementProps, tree: nodeTree, expanded, hasChildren }) => {
          const isNodeChecked = nodeTree.isNodeChecked(node.value);
          const isNodeIndeterminate = nodeTree.isNodeIndeterminate(node.value);
          const toggleNode = () => {
            if (isNodeChecked || isNodeIndeterminate) {
              nodeTree.uncheckNode(node.value);
            } else {
              nodeTree.checkNode(node.value);
            }
          };

          return (
            <Group gap="xs" align="center" wrap="nowrap" {...elementProps}>
              {hasChildren ? (
                <IconCaretDownFilled
                  aria-hidden
                  size={folderFilterTreeCaretSize}
                  style={{
                    transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform 120ms ease",
                  }}
                />
              ) : (
                <Box w={folderFilterTreeCaretSize} />
              )}
              <Checkbox.Indicator
                role="checkbox"
                aria-checked={isNodeIndeterminate ? "mixed" : isNodeChecked}
                checked={isNodeChecked}
                indeterminate={isNodeIndeterminate}
                aria-label={String(node.label)}
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleNode();
                }}
                onKeyDown={(event) => {
                  if (!folderFilterActivationKeys.has(event.key)) {
                    return;
                  }

                  event.preventDefault();
                  event.stopPropagation();
                  toggleNode();
                }}
              />
              <Text size="sm">{node.label}</Text>
            </Group>
          );
        }}
      />
    </Box>
  );
}

function selectedBranchesForCheckedPaths(
  checkedBranchPaths: string[],
  folderBranches: FolderFilterBranchOption[],
) {
  const checkedBranchPathSet = new Set(checkedBranchPaths);

  if (checkedBranchPathSet.size === folderBranches.length) {
    return null;
  }

  return folderBranches
    .filter((folderBranch) => checkedBranchPathSet.has(folderBranch.path))
    .map(({ availableScanRootPath, path }) => ({
      availableScanRootPath,
      path,
    }));
}

function sameFolderBranches(
  firstBranches: CatalogFolderSearchBranch[],
  secondBranches: CatalogFolderSearchBranch[],
) {
  if (firstBranches.length !== secondBranches.length) {
    return false;
  }

  return firstBranches.every((firstBranch, branchIndex) => {
    const secondBranch = secondBranches[branchIndex];

    return (
      firstBranch.path === secondBranch.path &&
      firstBranch.availableScanRootPath === secondBranch.availableScanRootPath
    );
  });
}

function sameBranchPaths(firstBranchPaths: string[], secondBranchPaths: string[]) {
  if (firstBranchPaths.length !== secondBranchPaths.length) {
    return false;
  }

  return firstBranchPaths.every(
    (firstBranchPath, branchIndex) =>
      firstBranchPath === secondBranchPaths[branchIndex],
  );
}
