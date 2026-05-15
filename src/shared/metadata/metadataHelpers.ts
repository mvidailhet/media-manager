export function appendUniqueMetadata<T extends { id: number }>(items: T[], item: T) {
  if (items.some((currentItem) => currentItem.id === item.id)) {
    return items;
  }

  return [...items, item];
}

export function uniqueMetadataValues<T extends { id: number }>(items: T[]) {
  return items.reduce<T[]>(
    (uniqueItems, item) => appendUniqueMetadata(uniqueItems, item),
    [],
  );
}

export function findMetadataByName<T extends { name: string }>(
  items: T[],
  name: string,
) {
  const normalizedName = normalizedMetadataName(name);

  return items.find(
    (item) => normalizedMetadataName(item.name) === normalizedName,
  );
}

export function findNearMetadataMatch<T extends { name: string }>(
  items: T[],
  name: string,
) {
  const normalizedName = normalizedMetadataName(name);

  if (normalizedName.length === 0) {
    return null;
  }

  return (
    items.find((item) => {
      const normalizedItemName = normalizedMetadataName(item.name);

      return (
        normalizedItemName !== normalizedName &&
        (normalizedItemName.includes(normalizedName) ||
          normalizedName.includes(normalizedItemName))
      );
    }) ?? null
  );
}

export function normalizedMetadataName(name: string) {
  return name.trim().toLocaleLowerCase();
}

export function singularMetadataLabel(label: string) {
  return label === "Tags" ? "Tag" : "Performer";
}
