import { useRef } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { Box, Paper, Stack, Text } from '@mantine/core';

import type { CatalogVideo } from '../../../../tauriCommands';
import type { CatalogVideoMetadata } from '../../catalogTypes';
import type { VideoSelectionModifiers } from '../../useCatalogModuleController';
import { VideoPreview } from '../../components/VideoPreview/VideoPreview';
import { MetadataBadges } from '../../components/MetadataBadges';
import styles from './VideoCard.module.css';

export function VideoCard({
  catalogVideo,
  catalogVideoMetadata,
  isSelectedForBatch,
  isSelectedForDetail,
  onSelectVideo,
  onSetFavorite,
  onShouldIgnoreClick,
  getKeyboardSelectionModifiers,
}: {
  catalogVideo: CatalogVideo;
  catalogVideoMetadata: CatalogVideoMetadata | undefined;
  isSelectedForBatch: boolean;
  isSelectedForDetail: boolean;
  onSelectVideo: (
    catalogVideo: CatalogVideo,
    modifiers: VideoSelectionModifiers,
  ) => void;
  onSetFavorite: (catalogVideo: CatalogVideo, isFavorite: boolean) => void;
  onShouldIgnoreClick: () => boolean;
  getKeyboardSelectionModifiers: () => VideoSelectionModifiers;
}) {
  const pointerSelectionModifiers = useRef<VideoSelectionModifiers | null>(null);
  const tags = catalogVideoMetadata?.tags ?? [];
  const performers = catalogVideoMetadata?.performers ?? [];

  function selectCatalogVideo(modifiers: VideoSelectionModifiers) {
    onSelectVideo(catalogVideo, modifiers);
  }

  function rememberPointerSelectionModifiers(event: PointerEvent<HTMLElement>) {
    pointerSelectionModifiers.current = {
      isCommandPressed: event.metaKey || event.ctrlKey,
      isShiftPressed: event.shiftKey,
    };
  }

  function selectCatalogVideoFromPointer(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();

    if (onShouldIgnoreClick()) {
      pointerSelectionModifiers.current = null;
      return;
    }

    const clickSelectionModifiers = {
      isCommandPressed: event.metaKey || event.ctrlKey,
      isShiftPressed: event.shiftKey,
    };
    const nextSelectionModifiers = activeSelectionModifiers([
      clickSelectionModifiers,
      pointerSelectionModifiers.current,
      getKeyboardSelectionModifiers(),
    ]);

    pointerSelectionModifiers.current = null;
    selectCatalogVideo(nextSelectionModifiers);
  }

  function activeSelectionModifiers(
    selectionModifiers: Array<VideoSelectionModifiers | null>,
  ) {
    return (
      selectionModifiers.find(
        (modifiers) =>
          modifiers?.isCommandPressed === true ||
          modifiers?.isShiftPressed === true,
      ) ?? {
        isCommandPressed: false,
        isShiftPressed: false,
      }
    );
  }

  function selectCatalogVideoFromKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    selectCatalogVideo({
      isCommandPressed: event.metaKey || event.ctrlKey,
      isShiftPressed: event.shiftKey,
    });
  }

  return (
    <Paper
      component="article"
      aria-selected={isSelectedForDetail ? true : undefined}
      aria-label={catalogVideo.title}
      className={`${styles.card} ${isSelectedForDetail ? styles.selectedCard : ''} ${isSelectedForBatch ? styles.batchSelectedCard : ''}`}
      data-video-id={catalogVideo.id}
      draggable={false}
      onClick={selectCatalogVideoFromPointer}
      onKeyDown={selectCatalogVideoFromKeyboard}
      onPointerDown={rememberPointerSelectionModifiers}
      radius="md"
      tabIndex={0}
      withBorder
      pb="xs"
    >
      <Stack gap="xs">
        <Box className={styles.cardPreview}>
          <VideoPreview
            catalogVideo={catalogVideo}
            onFavoriteChange={(isFavorite) =>
              onSetFavorite(catalogVideo, isFavorite)
            }
          />
        </Box>

        <Stack px="xs" gap="xs">
          <Text className={styles.title} fw={500} size="sm">
            {catalogVideo.title}
          </Text>

          <MetadataBadges
            gap={4}
            label="Tags"
            items={tags}
            metadataKind="tag"
          />
          <MetadataBadges
            gap={4}
            label="Performers"
            items={performers}
            metadataKind="performer"
          />
        </Stack>
      </Stack>
    </Paper>
  );
}
