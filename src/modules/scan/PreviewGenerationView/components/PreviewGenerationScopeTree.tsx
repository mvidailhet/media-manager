import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Checkbox, Group, Text, Tree, useTree } from "@mantine/core";
import { IconCaretDownFilled } from "@tabler/icons-react";

import type {
  PendingPreviewStripScopeTreeNode,
  PreviewGenerationScopeBranch,
  PreviewStripQueueStatus,
} from "../../../../tauriCommands";
import { listPendingPreviewStripScopeTree } from "../../../../tauriCommands";
import { errorMessage } from "../../../../shared/errors/errorMessage";
import {
  reconcilePreviewGenerationScopeSelection,
  samePreviewGenerationScopeBranches,
  selectedBranchesForCheckedPaths,
} from "./previewGenerationScopeSelection";

const previewGenerationScopeTreeCaretSize = 12;
const previewGenerationScopeTreeItemSpacing = 4;
const previewGenerationScopeActivationKeys = new Set([" ", "Enter"]);
const previewGenerationScopeUnavailableMessage =
  "Preview Generation Scope unavailable";

interface LoadScopeTreeOptions {
  canUpdateScopeTree: () => boolean;
}

export function PreviewGenerationScopeTree({
  previewStripQueueStatus,
  selectedScopeBranches,
  onSelectedScopeBranchesChange,
}: {
  previewStripQueueStatus: PreviewStripQueueStatus | null;
  selectedScopeBranches: PreviewGenerationScopeBranch[] | null;
  onSelectedScopeBranchesChange: (
    selectedScopeBranches: PreviewGenerationScopeBranch[] | null,
  ) => void;
}) {
  const [scopeTreeNodes, setScopeTreeNodes] = useState<
    PendingPreviewStripScopeTreeNode[]
  >([]);
  const [scopeTreeStatusMessage, setScopeTreeStatusMessage] = useState("");
  const [hasLoadedScopeTree, setHasLoadedScopeTree] = useState(false);
  const onSelectedScopeBranchesChangeRef = useRef(onSelectedScopeBranchesChange);
  const isUserChangingCheckedState = useRef(false);
  const hasInitializedExpandedBranchState = useRef(false);
  const previousRunningPreviewStripCount = useRef(0);
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
    reconcilePreviewGenerationScopeSelection({
      selectedScopeBranches,
      visibleScopeBranches,
    }).checkedBranchPaths,
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

  const loadScopeTree = useCallback(async ({ canUpdateScopeTree }: LoadScopeTreeOptions) => {
    try {
      const pendingScopeTree = await listPendingPreviewStripScopeTree();

      if (canUpdateScopeTree()) {
        setScopeTreeNodes(pendingScopeTree);
        setHasLoadedScopeTree(true);
        setScopeTreeStatusMessage("");
      }
    } catch (error) {
      if (canUpdateScopeTree()) {
        setScopeTreeStatusMessage(
          errorMessage(error) || previewGenerationScopeUnavailableMessage,
        );
      }
    }
  }, []);

  useEffect(() => {
    let canUpdateScopeTree = true;

    void loadScopeTree({ canUpdateScopeTree: () => canUpdateScopeTree });

    return () => {
      canUpdateScopeTree = false;
    };
  }, [loadScopeTree]);

  useEffect(() => {
    const currentRunningPreviewStripCount =
      previewStripQueueStatus?.runningCount ?? 0;
    const previewGenerationFinished =
      previousRunningPreviewStripCount.current > 0 &&
      currentRunningPreviewStripCount === 0;

    previousRunningPreviewStripCount.current = currentRunningPreviewStripCount;

    if (!previewGenerationFinished) {
      return;
    }

    let canUpdateScopeTree = true;

    void loadScopeTree({ canUpdateScopeTree: () => canUpdateScopeTree });

    return () => {
      canUpdateScopeTree = false;
    };
  }, [loadScopeTree, previewStripQueueStatus?.runningCount]);

  useEffect(() => {
    if (
      hasInitializedExpandedBranchState.current ||
      visibleScopeBranches.length === 0
    ) {
      return;
    }

    hasInitializedExpandedBranchState.current = true;
    tree.setExpandedState(expandedBranchState);
  }, [expandedBranchState, visibleScopeBranches.length]);

  useEffect(() => {
    if (!hasLoadedScopeTree) {
      return;
    }

    const reconciledSelection = reconcilePreviewGenerationScopeSelection({
      selectedScopeBranches,
      visibleScopeBranches,
    });
    const nextCheckedBranchPaths = reconciledSelection.checkedBranchPaths;

    if (!sameBranchPaths(checkedBranchPaths, nextCheckedBranchPaths)) {
      setCheckedBranchPaths(nextCheckedBranchPaths);
      tree.setCheckedState(nextCheckedBranchPaths);
    }

    if (
      !samePreviewGenerationScopeBranches(
        selectedScopeBranches,
        reconciledSelection.selectedScopeBranches,
      )
    ) {
      onSelectedScopeBranchesChangeRef.current(
        reconciledSelection.selectedScopeBranches,
      );
    }
  }, [
    checkedBranchPaths,
    hasLoadedScopeTree,
    selectedScopeBranches,
    visibleScopeBranches,
  ]);

  function changeCheckedBranchPaths(nextCheckedBranchPaths: string[]) {
    setCheckedBranchPaths(nextCheckedBranchPaths);

    if (!isUserChangingCheckedState.current) {
      return;
    }

    isUserChangingCheckedState.current = false;
    onSelectedScopeBranchesChangeRef.current(
      selectedBranchesForCheckedPaths(nextCheckedBranchPaths, visibleScopeBranches),
    );
  }

  function selectAllVisibleBranches() {
    const nextCheckedBranchPaths = visibleScopeBranches.map(
      (scopeBranch) => scopeBranch.path,
    );

    setCheckedBranchPaths(nextCheckedBranchPaths);
    tree.setCheckedState(nextCheckedBranchPaths);
    onSelectedScopeBranchesChangeRef.current(null);
  }

  function unselectAllVisibleBranches() {
    setCheckedBranchPaths([]);
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
            isUserChangingCheckedState.current = true;

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

function sameBranchPaths(firstBranchPaths: string[], secondBranchPaths: string[]) {
  if (firstBranchPaths.length !== secondBranchPaths.length) {
    return false;
  }

  return firstBranchPaths.every(
    (firstBranchPath, branchIndex) =>
      firstBranchPath === secondBranchPaths[branchIndex],
  );
}
