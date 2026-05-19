import { Badge, Button, Group } from "@mantine/core";

type CatalogToolbarProps = {
  metadataSuggestionGroupCount: number;
  onOpenMetadataSuggestionsReview: () => void;
};

export function CatalogToolbar({
  metadataSuggestionGroupCount,
  onOpenMetadataSuggestionsReview,
}: CatalogToolbarProps) {
  if (metadataSuggestionGroupCount === 0) {
    return null;
  }

  return (
    <Group justify="flex-end" px="md" pt="md">
      <Button
        type="button"
        variant="light"
        aria-label={`Metadata Suggestions, ${metadataSuggestionGroupCount} groups`}
        onClick={onOpenMetadataSuggestionsReview}
        rightSection={
          <Badge size="sm" variant="filled">
            {metadataSuggestionGroupCount}
          </Badge>
        }
      >
        Metadata Suggestions
      </Button>
    </Group>
  );
}
