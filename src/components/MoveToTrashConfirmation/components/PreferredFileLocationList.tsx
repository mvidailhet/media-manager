import { List } from "@mantine/core";

import { WrappingCode } from "../../../shared/components/WrappingCode";

const maximumFileLocationListHeight = 240;

export function PreferredFileLocationList({
  fileLocations,
}: {
  fileLocations: string[];
}) {
  return (
    <List
      aria-label="File Locations to move to Trash"
      spacing="xs"
      styles={{
        root: {
          maxHeight: maximumFileLocationListHeight,
          overflowY: "auto",
        },
      }}
    >
      {fileLocations.map((fileLocation) => (
        <List.Item key={fileLocation}>
          <WrappingCode>{fileLocation}</WrappingCode>
        </List.Item>
      ))}
    </List>
  );
}
