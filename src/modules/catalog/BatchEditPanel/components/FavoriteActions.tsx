import { ActionIcon, Tooltip } from "@mantine/core";
import { IconStar, IconStarFilled } from "@tabler/icons-react";

const favoriteIconSize = 18;

export function FavoriteActions({
  onSetFavorite,
  selectedVideosAllFavorite,
}: {
  onSetFavorite: (isFavorite: boolean) => void;
  selectedVideosAllFavorite: boolean;
}) {
  const favoriteButtonLabel = selectedVideosAllFavorite
    ? "Unmark selected Videos as Favorite"
    : "Mark selected Videos as Favorite";
  const nextFavoriteState = !selectedVideosAllFavorite;

  return (
    <Tooltip label={favoriteButtonLabel}>
      <ActionIcon
        aria-label={favoriteButtonLabel}
        color="yellow"
        onClick={() => void onSetFavorite(nextFavoriteState)}
        size="lg"
        type="button"
        variant="default"
      >
        {selectedVideosAllFavorite ? (
          <IconStarFilled size={favoriteIconSize} />
        ) : (
          <IconStar size={favoriteIconSize} />
        )}
      </ActionIcon>
    </Tooltip>
  );
}
