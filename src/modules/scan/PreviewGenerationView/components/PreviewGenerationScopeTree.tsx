import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Checkbox, Group, Text, Tree, useTree } from "@mantine/core";
import { IconCaretDownFilled } from "@tabler/icons-react";

import type {
  PendingPreviewStripScopeTreeNode,
  PreviewGenerationScopeBranch,
} from "../../../../tauriCommands";
import { listPendingPreviewStripScopeTree } from "../../../../tauriCommands";
import { errorMessage } from "../../../../shared/errors/errorMessage";

const previewGenerationScopeTreeCaretSize = 12;
const previewGenerationScopeTreeItemSpacing = 4;
const previewGenerationScopeActivationKeys = new Set([" ", "Enter"]);
const previewGenerationScopeUnavailableMessage =
  "Preview Generation Scope unavailable";

export function PreviewGenerationScopeTree({
  selectedScopeBranches,
  onSelectedScopeBranchesChange,
}: {
  selectedScopeBranches: PreviewGenerationScopeBranch[] | null;
  onSelectedScopeBranchesChange: (
    selectedScopeBranches: PreviewGenerationScopeBranch[] | null,
  ) => void;
}) {
  const [scopeTreeNodes, setScopeTreeNodes] = useState<
    PendingPreviewStripScopeTreeNode[]
  >([]);
  const [scopeTreeStatusMessage, setScopeTreeStatusMessage] = useState("");
  const onSelectedScopeBranchesChangeRef = useRef(onSelectedScopeBranchesChange);
  const visibleScopeBranches = useMemo(
    () => flattenScopeTreeNodes(scopeTreeNodes),
    [scopeTreeNodes],
  );
  const treeData = useMemo(() => scopeTreeNodes.map(toTreeNode), [scopeTreeNodes]);
  const expandedBranchState = useMemo(
    () =>
      Object.fromEntries(
        visibleScopeBranches.map((scopeBranch) => [scopeBranch.path, true]),
      ),
    [visibleScopeBranches],
  );
  const [checkedBranchPaths, setCheckedBranchPaths] = useState(() =>
    selectedScopeBranchPaths(selectedScopeBranches, visibleScopeBranches),
  );
  const tree = useTree({
    checkedState: checkedBranchPaths,
    initialExpandedState: expandedBranchState,
    onCheckedStateChange: changeCheckedBranchPaths,
  });
  const allVisibleBranchesSelected = visibleScopeBranches.every((scopeBranch) =>
    tree.isNodeChecked(scopeBranch.path),
  );

  useEffect(() => {
    onSelectedScopeBranchesChangeRef.current = onSelectedScopeBranchesChange;
  }, [onSelectedScopeBranchesChange]);

  useEffect(() => {
    let canUpdateScopeTree = true;

    async function loadScopeTree() {
      try {
        const pendingScopeTree = await listPendingPreviewStripScopeTree();

        if (canUpdateScopeTree) {
          setScopeTreeNodes(pendingScopeTree);
          setScopeTreeStatusMessage("");
        }
      } catch (error) {
        if (canUpdateScopeTree) {
          setScopeTreeStatusMessage(
            errorMessage(error) || previewGenerationScopeUnavailableMessage,
          );
        }
      }
    }

    void loadScopeTree();

    return () => {
      canUpdateScopeTree = false;
    };
  }, []);

  useEffect(() => {
    tree.setExpandedState(expandedBranchState);
  }, [expandedBranchState]);

  useEffect(() => {
    const nextCheckedBranchPaths = selectedScopeBranchPaths(
      selectedScopeBranches,
      visibleScopeBranches,
    );

    if (!sameBranchPaths(checkedBranchPaths, nextCheckedBranchPaths)) {
      tree.setCheckedState(nextCheckedBranchPaths);
    }
  }, [checkedBranchPaths, selectedScopeBranches, visibleScopeBranches]);

  function changeCheckedBranchPaths(nextCheckedBranchPaths: string[]) {
    setCheckedBranchPaths(nextCheckedBranchPaths);
    onSelectedScopeBranchesChangeRef.current(
      selectedBranchesForCheckedPaths(nextCheckedBranchPaths, visibleScopeBranches),
    );
  }

  function selectAllVisibleBranches() {
    const nextCheckedBranchPaths = visibleScopeBranches.map(
      (scopeBranch) => scopeBranch.path,
    );

    tree.setCheckedState(nextCheckedBranchPaths);
    onSelectedScopeBranchesChangeRef.current(null);
  }

  function unselectAllVisibleBranches() {
    tree.setCheckedState([]);
    onSelectedScopeBranchesChangeRef.current([]);
  }

  if (scopeTreeStatusMessage) {
    return (
      <Text c="red" size="sm">
        {scopeTreeStatusMessage}
      </Text>
    );
  }

  if (visibleScopeBranches.length === 0) {
    return null;
  }

  return (
    <Box>
      <Group justify="space-between" gap="sm" mb="xs">
        <Text size="sm" fw={500}>
          Preview Generation Scope
        </Text>
        <Button
          size="xs"
          variant="light"
          leftSection={<Checkbox.Indicator checked={allVisibleBranchesSelected} />}
          aria-label={
            allVisibleBranchesSelected
              ? "Unselect all visible Preview Generation Scope branches"
              : "Select all visible Preview Generation Scope branches"
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
        data={treeData}
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
            <Group
              gap="xs"
              align="center"
              wrap="nowrap"
              {...elementProps}
              style={{
                ...elementProps.style,
                marginTop: previewGenerationScopeTreeItemSpacing,
              }}
            >
              {hasChildren ? (
                <IconCaretDownFilled
                  aria-hidden
                  size={previewGenerationScopeTreeCaretSize}
                  style={{
                    transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform 120ms ease",
                  }}
                />
              ) : (
                <Box w={previewGenerationScopeTreeCaretSize} />
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
                  if (!previewGenerationScopeActivationKeys.has(event.key)) {
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

function flattenScopeTreeNodes(
  scopeTreeNodes: PendingPreviewStripScopeTreeNode[],
): PreviewGenerationScopeBranch[] {
  return scopeTreeNodes.flatMap((scopeTreeNode) => [
    {
      availableScanRootPath: scopeTreeNode.availableScanRootPath,
      path: scopeTreeNode.path,
    },
    ...flattenScopeTreeNodes(scopeTreeNode.children),
  ]);
}

function toTreeNode(scopeTreeNode: PendingPreviewStripScopeTreeNode): Tree.NodeData {
  const children = scopeTreeNode.children.map(toTreeNode);
  const scopeTreeNodeLabel = `${scopeTreeNodeName(scopeTreeNode)} (${scopeTreeNode.pendingCount} pending)`;

  return {
    label: scopeTreeNodeLabel,
    value: scopeTreeNode.path,
    ...(children.length > 0 ? { children } : {}),
  };
}

function scopeTreeNodeName(scopeTreeNode: PendingPreviewStripScopeTreeNode) {
  if (scopeTreeNode.path === scopeTreeNode.availableScanRootPath) {
    return scopeTreeNode.path;
  }

  const pathSegments = scopeTreeNode.path.split("/").filter(Boolean);
  return pathSegments[pathSegments.length - 1] ?? scopeTreeNode.path;
}

function selectedScopeBranchPaths(
  selectedScopeBranches: PreviewGenerationScopeBranch[] | null,
  visibleScopeBranches: PreviewGenerationScopeBranch[],
) {
  if (selectedScopeBranches === null) {
    return visibleScopeBranches.map((scopeBranch) => scopeBranch.path);
  }

  return selectedScopeBranches.map((scopeBranch) => scopeBranch.path);
}

function selectedBranchesForCheckedPaths(
  checkedBranchPaths: string[],
  visibleScopeBranches: PreviewGenerationScopeBranch[],
) {
  const checkedBranchPathSet = new Set(checkedBranchPaths);

  if (checkedBranchPathSet.size === visibleScopeBranches.length) {
    return null;
  }

  return visibleScopeBranches
    .filter((scopeBranch) => checkedBranchPathSet.has(scopeBranch.path))
    .map(({ availableScanRootPath, path }) => ({
      availableScanRootPath,
      path,
    }));
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
