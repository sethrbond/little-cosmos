import { useMemo } from "react";

const fmtDate = d => { if (!d) return ""; const dt = new Date(d + "T12:00:00"); return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };

export default function CinemaOverlay({ entry, photoIdx, progress, total, currentIdx, phase, palette, sceneBg, typeInfo, isMyWorld, isPartnerWorld, onStop }) {
  const P = palette;
  const ce = entry;
  const ct = typeInfo;
  const photos = ce.photos || [];
  const hasPhotos = photos.length > 0;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 12, pointerEvents: "none" }}>
      {/* Top bar: title + progress */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "12px clamp(12px, 4vw, 24px) 10px", background: `linear-gradient(180deg, ${sceneBg || '#0c0a12'}cc, transparent)`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 10, letterSpacing: ".2em", color: P.goldWarm, textTransform: "uppercase", opacity: 0.7 }}>
            {isMyWorld ? "My Story" : isPartnerWorld ? "Our Story" : "Our Journey"}
          </div>
          <div style={{ fontSize: 10, color: P.textFaint }}>{currentIdx + 1} / {total}</div>
        </div>
        <button onClick={onStop} style={{ pointerEvents: "auto", background: P.glass, backdropFilter: "blur(12px)", border: `1px solid ${P.textFaint}20`, borderRadius: 16, padding: "4px 14px", fontSize: 10, color: P.textMid, cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = P.rose} onMouseLeave={e => e.currentTarget.style.borderColor = `${P.textFaint}20`}>
          ⏹ Stop
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `${P.textFaint}15`, zIndex: 2 }}>
        <div style={{ height: "100%", background: `linear-gradient(90deg, ${P.goldWarm}, ${P.rose})`, width: `${progress * 100}%`, transition: "width .8s ease", borderRadius: "0 1px 1px 0" }} />
      </div>

      {/* Bottom cinema card */}
      <div style={{ position: "absolute", bottom: "max(24px, 5vh)", left: 0, right: 0, display: "flex", justifyContent: "center", padding: "0 4vw" }}>
        <div style={{
          maxWidth: "min(440px, 92vw)", width: "100%", borderRadius: 18, overflow: "hidden",
          background: P.card, backdropFilter: "blur(20px)",
          boxShadow: `0 8px 32px ${sceneBg || '#0c0a12'}50`,
          border: `1px solid ${P.rose}08`,
          opacity: phase === 'show' ? 1 : phase === 'fly' ? 0 : 0,
          transform: phase === 'show' ? 'translateY(0)' : 'translateY(20px)',
          transition: "all .6s cubic-bezier(0.16,1,0.3,1)",
        }}>
          {/* Photo with crossfade */}
          {hasPhotos && (
            <div style={{ position: "relative", height: "min(180px, 28vh)", overflow: "hidden" }}>
              {photos.map((url, i) => (
                <img key={url} src={url} alt="" style={{
                  position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
                  opacity: i === photoIdx ? 1 : 0,
                  transition: "opacity 1s ease",
                }} />
              ))}
              {/* Photo gradient overlay */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: `linear-gradient(transparent, ${P.card})` }} />
              {photos.length > 1 && (
                <div style={{ position: "absolute", bottom: 8, right: 12, display: "flex", gap: 3, alignItems: "center" }}>
                  {photos.slice(0, 8).map((_, i) => (
                    <div key={"cdot-" + i} style={{ width: 4, height: 4, borderRadius: 2, background: i === photoIdx ? P.goldWarm : `${P.textFaint}40`, transition: "background .4s" }} />
                  ))}
                  {photos.length > 8 && <div style={{ fontSize: 10, color: `${P.textFaint}60`, marginLeft: 1 }}>+{photos.length - 8}</div>}
                </div>
              )}
            </div>
          )}

          {/* Entry info */}
          <div style={{ padding: hasPhotos ? "8px clamp(12px, 4vw, 20px) 14px" : "16px clamp(12px, 4vw, 20px) 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, minWidth: 0 }}>
              <span style={{ fontSize: "clamp(20px, 5vw, 26px)", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.15))", flexShrink: 0 }}>{ct.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "clamp(14px, 4vw, 18px)", fontWeight: 400, color: P.text, letterSpacing: ".02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ce.city}</div>
                <div style={{ fontSize: "clamp(9px, 2.5vw, 10px)", color: P.textMuted, letterSpacing: ".03em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {fmtDate(ce.dateStart)}{ce.dateEnd && ce.dateEnd !== ce.dateStart ? ` → ${fmtDate(ce.dateEnd)}` : ""}{ce.country ? `  ·  ${ce.country}` : ""}
                </div>
              </div>
            </div>
            {ce.notes && <p style={{ fontSize: "clamp(10px, 2.8vw, 11px)", color: P.textMid, margin: "6px 0 0", lineHeight: 1.6, maxHeight: 36, overflow: "hidden", opacity: 0.85 }}>{ce.notes}</p>}
            {ce.loveNote && isPartnerWorld && <p style={{ fontSize: "clamp(9px, 2.5vw, 10px)", color: P.heart, margin: "4px 0 0", fontStyle: "italic", opacity: 0.8 }}>"{ce.loveNote}"</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
