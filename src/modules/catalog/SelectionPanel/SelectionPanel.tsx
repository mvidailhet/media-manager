import { Box } from "@mantine/core";

import type { CatalogProps } from "../Catalog";
import { EmptySelectionState } from "./components/EmptySelectionState";
import { SelectedVideoDetail } from "./components/SelectedVideoDetail";
import { SelectedVideosBatchEdit } from "./components/SelectedVideosBatchEdit";
import styles from "./SelectionPanel.module.css";

export function SelectionPanel(props: CatalogProps) {
  const shouldShowBatchEdit = props.batchSelectedVideoCount >= 2;

  return (
    <Box
      aria-label="Selection Panel"
      className={styles.selectionPanel}
      component="aside"
    >
      {shouldShowBatchEdit ? (
        <SelectedVideosBatchEdit {...props} />
      ) : props.selectedVideo ? (
        <SelectedVideoDetail {...props} />
      ) : (
        <EmptySelectionState />
      )}
    </Box>
  );
}
