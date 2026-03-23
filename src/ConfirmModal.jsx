export default function ConfirmModal({ confirmModal, onClose, P }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Confirm action" style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .2s ease" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: P.card, borderRadius: 16, padding: "24px 28px", maxWidth: 360, width: "90%", boxShadow: "0 12px 48px rgba(0,0,0,.25)", border: `1px solid ${P.rose}15`, textAlign: "center" }}>
        <div style={{ fontSize: 13, color: P.text, lineHeight: 1.6, marginBottom: 20, fontFamily: "inherit" }}>{confirmModal.message}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onClose} style={{ padding: "8px 20px", background: "transparent", border: `1px solid ${P.textFaint}30`, borderRadius: 10, color: P.textMuted, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={() => { const cb = confirmModal.onConfirm; onClose(); cb(); }} style={{ padding: "8px 20px", background: `${P.rose}18`, border: `1px solid ${P.rose}30`, borderRadius: 10, color: P.rose, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
