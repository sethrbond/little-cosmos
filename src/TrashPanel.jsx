export default function TrashPanel({ recentlyDeleted, setRecentlyDeleted, dispatch, TYPES, P, fmtDate, onClose, showToast, worldId }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Recently deleted entries" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 310, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .2s ease" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: P.card, borderRadius: 16, padding: "24px 28px", maxWidth: 400, width: "90vw", maxHeight: "70vh", overflowY: "auto", border: `1px solid ${P.rose}20`, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: P.text }}>🗑 Recently Deleted</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: P.textFaint, fontSize: 18, cursor: "pointer" }}>×</button>
        </div>
        <p style={{ fontSize: 10, color: P.textFaint, margin: "0 0 12px", letterSpacing: ".04em" }}>Entries are kept for 30 days. Click to restore.</p>
        {recentlyDeleted.length === 0 && <p style={{ fontSize: 12, color: P.textMuted, textAlign: "center", padding: "20px 0", fontStyle: "italic" }}>Trash is empty</p>}
        {recentlyDeleted.map(t => {
          const daysLeft = Math.max(1, Math.ceil((30 * 24 * 60 * 60 * 1000 - (Date.now() - t.deletedAt)) / (24 * 60 * 60 * 1000)));
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: `${P.rose}08`, border: `1px solid ${P.rose}12`, marginBottom: 6, cursor: "pointer", transition: "background .15s" }}
              onClick={() => {
                dispatch({ type: "ADD", entry: { ...t, deletedAt: undefined }, _skipUndo: true });
                const updated = recentlyDeleted.filter(x => x.id !== t.id);
                setRecentlyDeleted(updated);
                localStorage.setItem(`cosmos_trash_${worldId}`, JSON.stringify(updated));
                showToast(`${t.city} restored!`, "↩️", 2500);
                if (updated.length === 0) onClose();
              }}
              onMouseEnter={e => e.currentTarget.style.background = `${P.rose}18`}
              onMouseLeave={e => e.currentTarget.style.background = `${P.rose}08`}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{(TYPES[t.type] || {}).icon || "📍"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.city}{t.country ? `, ${t.country}` : ""}</div>
                <div style={{ fontSize: 9, color: P.textFaint }}>{fmtDate(t.dateStart)} · {daysLeft}d left</div>
              </div>
              <span style={{ fontSize: 9, color: P.rose, fontWeight: 500 }}>Restore</span>
            </div>
          );
        })}
        {recentlyDeleted.length > 0 && (
          <button onClick={() => {
            setRecentlyDeleted([]);
            localStorage.removeItem(`cosmos_trash_${worldId}`);
            showToast("Trash emptied", "🗑", 2000);
            onClose();
          }} style={{ marginTop: 10, width: "100%", padding: "8px", background: "transparent", border: `1px solid ${P.textFaint}30`, borderRadius: 8, cursor: "pointer", fontSize: 10, color: P.textFaint, fontFamily: "inherit" }}>Empty Trash Permanently</button>
        )}
      </div>
    </div>
  );
}
