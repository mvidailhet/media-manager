import { List, ScrollArea } from "@mantine/core";

import { WrappingCode } from "../../../shared/components/WrappingCode";

const maximumPreferredFileLocationListHeight = 240;

export function PreferredFileLocationList({
  preferredFileLocations,
}: {
  preferredFileLocations: string[];
}) {
  return (
    <ScrollArea.Autosize mah={maximumPreferredFileLocationListHeight}>
      <List
        aria-label="Preferred File Locations to move to Trash"
        spacing="xs"
        styles={{ root: { overflowY: "auto" } }}
      >
        {preferredFileLocations.map((preferredFileLocation) => (
          <List.Item key={preferredFileLocation}>
            <WrappingCode>{preferredFileLocation}</WrappingCode>
          </List.Item>
        ))}
      </List>
    </ScrollArea.Autosize>
  );
}
