export function reducer(st, a) {
  let next = st;
  // DB functions passed via a.db from dispatch wrapper
  const _saveEntry = a.db?.saveEntry;
  const _deleteEntry = a.db?.deleteEntry;
  const _deletePhoto = a.db?.deletePhoto;
  const _savePhotos = a.db?.savePhotos;
  const pushUndo = (inverse) => {
    if (!a._skipSave && !a._skipUndo) {
      next = { ...next, undoStack: [...(next.undoStack || []).slice(-29), inverse], redoStack: [] };
    }
  };
  switch (a.type) {
    case "LOAD": return { ...st, entries: a.entries, undoStack: st.undoStack || [], redoStack: st.redoStack || [] };
    case "UNDO": {
      const stack = [...(st.undoStack || [])];
      if (stack.length === 0) return st;
      const action = stack.pop();
      // Apply the inverse action
      if (action.type === "ADD") {
        next = { ...st, entries: [...st.entries, action.entry], undoStack: stack, redoStack: [...(st.redoStack || []), { type: "DELETE", id: action.entry.id }] };
        if (_saveEntry) _saveEntry(action.entry).catch(err => console.error('[cosmos] save failed:', err));
      } else if (action.type === "DELETE") {
        const doomed = st.entries.find(e => e.id === action.id);
        next = { ...st, entries: st.entries.filter(e => e.id !== action.id), undoStack: stack, redoStack: [...(st.redoStack || []), { type: "ADD", entry: doomed }] };
        if (_deleteEntry) _deleteEntry(action.id);
      } else if (action.type === "UPDATE") {
        const prev = st.entries.find(e => e.id === action.id);
        next = { ...st, entries: st.entries.map(e => e.id === action.id ? { ...e, ...action.data } : e), undoStack: stack, redoStack: [...(st.redoStack || []), { type: "UPDATE", id: action.id, data: prev ? { ...prev } : {} }] };
        const updated = next.entries.find(e => e.id === action.id);
        if (_saveEntry && updated) _saveEntry(updated).catch(err => console.error('[cosmos] save failed:', err));
      }
      return next;
    }
    case "REDO": {
      const stack = [...(st.redoStack || [])];
      if (stack.length === 0) return st;
      const action = stack.pop();
      if (action.type === "ADD") {
        next = { ...st, entries: [...st.entries, action.entry], redoStack: stack, undoStack: [...(st.undoStack || []), { type: "DELETE", id: action.entry.id }] };
        if (_saveEntry) _saveEntry(action.entry).catch(err => console.error('[cosmos] save failed:', err));
      } else if (action.type === "DELETE") {
        const doomed = st.entries.find(e => e.id === action.id);
        next = { ...st, entries: st.entries.filter(e => e.id !== action.id), redoStack: stack, undoStack: [...(st.undoStack || []), { type: "ADD", entry: doomed }] };
        if (_deleteEntry) _deleteEntry(action.id);
      } else if (action.type === "UPDATE") {
        const prev = st.entries.find(e => e.id === action.id);
        next = { ...st, entries: st.entries.map(e => e.id === action.id ? { ...e, ...action.data } : e), redoStack: stack, undoStack: [...(st.undoStack || []), { type: "UPDATE", id: action.id, data: prev ? { ...prev } : {} }] };
        const updated = next.entries.find(e => e.id === action.id);
        if (_saveEntry && updated) _saveEntry(updated).catch(err => console.error('[cosmos] save failed:', err));
      }
      return next;
    }
    case "ADD":
      next = { ...st, entries: [...st.entries, a.entry] };
      pushUndo({ type: "DELETE", id: a.entry.id });
      if (_saveEntry && !a._skipSave) _saveEntry(a.entry).catch(() => {
        window.dispatchEvent(new CustomEvent('cosmos-save-error', { detail: { city: a.entry?.city } }))
      });
      break;
    case "UPDATE":
      { const prev = st.entries.find(e => e.id === a.id);
        if (prev) pushUndo({ type: "UPDATE", id: a.id, data: { ...prev } });
      }
      next = { ...next, entries: (next.entries || st.entries).map(e => e.id === a.id ? { ...e, ...a.data } : e) };
      if (_saveEntry && !a._skipSave) { const updated = next.entries.find(e => e.id === a.id); if (updated) _saveEntry(updated).catch(() => {
        window.dispatchEvent(new CustomEvent('cosmos-save-error', { detail: { city: updated?.city } }))
      }); }
      break;
    case "DELETE":
      { const doomed = st.entries.find(e => e.id === a.id);
        if (doomed) pushUndo({ type: "ADD", entry: { ...doomed } });
        if (_deletePhoto && !a._skipSave && doomed?.photos?.length) doomed.photos.forEach(url => _deletePhoto(url));
      }
      next = { ...next, entries: (next.entries || st.entries).filter(e => e.id !== a.id) };
      if (_deleteEntry && !a._skipSave) _deleteEntry(a.id);
      break;
    case "ADD_PHOTOS":
      next = { ...st, entries: st.entries.map(e => e.id === a.id ? { ...e, photos: [...(e.photos || []), ...a.urls] } : e) };
      break;
    case "REMOVE_PHOTO":
      { const photoUrl = (st.entries.find(e => e.id === a.id)?.photos || [])[a.photoIndex];
        if (photoUrl) _deletePhoto(photoUrl); }
      next = { ...st, entries: st.entries.map(e => e.id === a.id ? { ...e, photos: (e.photos || []).filter((_, i) => i !== a.photoIndex) } : e) };
      { const remaining = next.entries.find(e => e.id === a.id);
        if (remaining) _savePhotos(a.id, remaining.photos || []); }
      break;
    default: return st;
  }
  return next;
}

// ---- FIRST BADGES ----
export function getFirstBadges(entries) {
  const badges = {};
  const together = entries.filter(e => e.who === "both").sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));
  if (together.length > 0) badges[together[0].id] = "First time together";
  const countries = {};
  together.forEach(e => {
    if (e.country && !countries[e.country]) { countries[e.country] = e.id; }
    (e.stops || []).forEach(s => { if (s.country && !countries[s.country]) countries[s.country] = e.id; });
  });
  const international = together.find(e => e.country && e.country !== "USA");
  if (international) badges[international.id] = badges[international.id] || "First trip abroad together";
  // First Christmas
  together.forEach(e => {
    const ds = e.dateStart;
    if (ds && ds.slice(5) >= "12-20" && ds.slice(5) <= "12-31" && !Object.values(badges).includes("First Christmas together")) {
      badges[e.id] = "First Christmas together";
    }
  });
  return badges;
}
