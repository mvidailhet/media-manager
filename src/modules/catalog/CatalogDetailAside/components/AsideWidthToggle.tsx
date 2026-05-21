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
  const label = isExpanded ? 'Retract Panel' : 'Expand Panel';
  const Icon = isExpanded ? IconChevronsRight : IconChevronsLeft;

  return (
    <div className={styles.container}>
      <Tooltip label={label}>
        <ActionIcon
          aria-label={label}
          radius="xl"
          size="lg"
          variant="default"
          onClick={onToggle}
        >
          <Icon size={asideWidthToggleIconSize} />
        </ActionIcon>
      </Tooltip>
    </div>
  );
}

