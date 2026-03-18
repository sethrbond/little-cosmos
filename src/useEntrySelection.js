import { useState, useCallback } from "react";

/**
 * useEntrySelection — consolidates entry selection state:
 * selected entry, editing state, photo navigation, card tab, and delete confirmation.
 */
export function useEntrySelection() {
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [cardTab, setCardTab] = useState("overview");
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [tripCardEntry, setTripCardEntry] = useState(null);

  // Helper: select an entry and reset photo/card state
  const selectEntry = useCallback((entry) => {
    setSelected(entry);
    setPhotoIdx(0);
    setCardTab("overview");
  }, []);

  return {
    selected, setSelected,
    editing, setEditing,
    photoIdx, setPhotoIdx,
    cardTab, setCardTab,
    lightboxIdx, setLightboxIdx,
    confirmDelete, setConfirmDelete,
    tripCardEntry, setTripCardEntry,
    selectEntry,
  };
}
