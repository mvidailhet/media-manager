import { Button, Group } from "@mantine/core";

export function FavoriteActions({
  onSetFavorite,
}: {
  onSetFavorite: (isFavorite: boolean) => void;
}) {
  return (
    <Group gap="xs">
      <Button
        type="button"
        variant="default"
        onClick={() => void onSetFavorite(true)}
      >
        Mark selected Videos as Favorite
      </Button>
      <Button
        type="button"
        variant="default"
        onClick={() => void onSetFavorite(false)}
      >
        Unmark selected Videos as Favorite
      </Button>
    </Group>
  );
}
