import { ActionIcon, Tooltip } from '@mantine/core';
import { IconChevronsLeft, IconChevronsRight } from '@tabler/icons-react';

import styles from './AsideWidthToggle.module.css';

const asideWidthToggleIconSize = 20;

export function AsideWidthToggle({
  isExpanded,
  onToggle,
}: {
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const label = isExpanded ? 'Retract' : 'Expand';
  const Icon = isExpanded ? IconChevronsRight : IconChevronsLeft;

  return (
    <Tooltip label={label}>
      <ActionIcon
        aria-label={label}
        className={styles.toggle}
        radius="xl"
        size="lg"
        variant="filled"
        onClick={onToggle}
      >
        <Icon size={asideWidthToggleIconSize} />
      </ActionIcon>
    </Tooltip>
  );
}

