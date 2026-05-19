import { useEffect, useState } from "react";

import {
  listMetadataSuggestionGroups,
  type MetadataSuggestionGroup,
} from "../../../tauriCommands";

export function useMetadataSuggestionsController() {
  const [metadataSuggestionGroups, setMetadataSuggestionGroups] = useState<
    MetadataSuggestionGroup[]
  >([]);

  async function refreshMetadataSuggestionGroups() {
    setMetadataSuggestionGroups(await listMetadataSuggestionGroups());
  }

  useEffect(() => {
    let canUpdateMetadataSuggestionGroups = true;

    async function loadMetadataSuggestionGroups() {
      try {
        const storedMetadataSuggestionGroups =
          await listMetadataSuggestionGroups();

        if (canUpdateMetadataSuggestionGroups) {
          setMetadataSuggestionGroups(storedMetadataSuggestionGroups);
        }
      } catch {
        if (canUpdateMetadataSuggestionGroups) {
          setMetadataSuggestionGroups([]);
        }
      }
    }

    void loadMetadataSuggestionGroups();

    return () => {
      canUpdateMetadataSuggestionGroups = false;
    };
  }, []);

  return {
    metadataSuggestionGroups,
    refreshMetadataSuggestionGroups,
  };
}
