import React from "react";

export default function LocationListPopup({ locationList, setLocationList, TYPES, DEFAULT_TYPE, P, isMobile, isLandscape, fmtDate, setSelected, setSliderDate }) {
  return (
    <div style={isMobile && !isLandscape
      ? { position: "absolute", bottom: 105, left: 0, right: 0, zIndex: 25, background: P.card, backdropFilter: "blur(24px)", borderRadius: "16px 16px 0 0", maxHeight: "45vh", boxShadow: "0 -8px 32px rgba(61,53,82,.1)", border: `1px solid ${P.rose}10`, animation: "fadeIn .3s ease", overflow: "hidden", display: "flex", flexDirection: "column" }
      : isMobile && isLandscape
      ? { position: "absolute", top: "env(safe-area-inset-top, 8px)", right: "env(safe-area-inset-right, 8px)", bottom: "env(safe-area-inset-bottom, 8px)", width: 280, zIndex: 25, background: P.card, backdropFilter: "blur(24px)", borderRadius: 16, boxShadow: "0 12px 44px rgba(61,53,82,.1)", border: `1px solid ${P.rose}10`, animation: "cardIn .3s ease", overflow: "hidden", display: "flex", flexDirection: "column" }
      : { position: "absolute", top: "42%", right: 18, transform: "translateY(-50%)", zIndex: 25, background: P.card, backdropFilter: "blur(24px)", borderRadius: 16, maxWidth: 300, minWidth: 220, boxShadow: "0 12px 44px rgba(61,53,82,.1)", border: `1px solid ${P.rose}10`, animation: "cardIn .5s ease", overflow: "hidden", display: "flex", flexDirection: "column" }
    }>
      <div style={{ padding: "14px 18px 10px" }}>
        <button aria-label="Close location list" onClick={() => setLocationList(null)} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", fontSize: 16, color: P.textFaint, cursor: "pointer", zIndex: 5 }}>&times;</button>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 400 }}>{locationList.city}</h2>
        <p style={{ fontSize: 9, color: P.textFaint, marginTop: 2, letterSpacing: ".1em" }}>{locationList.entries.length} entries here</p>
      </div>
      <div style={{ padding: "0 14px 14px", maxHeight: 280, overflowY: "auto" }}>
        {[...locationList.entries].sort((a, b) => a.dateStart.localeCompare(b.dateStart)).map(e => {
          const t = TYPES[e.type] || DEFAULT_TYPE;
          return (
            <button key={e.id} onClick={() => {
              setSelected(e); setLocationList(null);
              setSliderDate(e.dateStart);
            }} style={{
              display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
              background: "none", border: "none", borderBottom: `1px solid ${P.rose}08`,
              cursor: "pointer", fontFamily: "inherit", transition: "background .15s", borderRadius: 6,
            }}
              onMouseEnter={ev => ev.currentTarget.style.background = P.blush}
              onMouseLeave={ev => ev.currentTarget.style.background = "none"}
            >
              <div style={{ fontSize: 11, color: P.text, marginBottom: 2 }}>{t.icon} {e.city}</div>
              <div style={{ fontSize: 9, color: P.textMuted }}>{fmtDate(e.dateStart)}{e.dateEnd ? ` \u2192 ${fmtDate(e.dateEnd)}` : ""}</div>
              {e.notes && <div style={{ fontSize: 9, color: P.textFaint, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.notes.slice(0, 60)}{e.notes.length > 60 ? "\u2026" : ""}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
