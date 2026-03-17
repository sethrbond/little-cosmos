export default function PhotoJourneyOverlay({ photos, entries, index, onClose, onNavigate, autoPlay, onToggleAutoPlay, palette: P }) {
  const ph = photos[index];
  const prevPh = index > 0 ? photos[index - 1] : null;
  const entry = entries.find(e => e.id === ph.id);
  const note = entry?.notes || '';
  const caption = entry?.photoCaptions?.[ph.url] || '';
  return (
    <div role="dialog" aria-modal="true" aria-label="Photo journey" style={{ position: "fixed", inset: 0, zIndex: 200, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={() => { if (autoPlay) { onToggleAutoPlay(false); } else if (index < photos.length - 1) onNavigate(index + 1); else onClose(); }}>
      {/* Crossfade: previous image fades out behind current */}
      {prevPh && <img src={prevPh.url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: 0, transition: "opacity 0.8s ease", pointerEvents: "none" }} />}
      <img key={ph.url} src={ph.url} alt="Travel photo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", animation: "fadeIn .8s ease", transition: "opacity .8s ease" }} />
      {/* Bottom info overlay */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0.85))", padding: "60px 24px 28px", pointerEvents: "none" }}>
        <div style={{ fontSize: 18, color: "#e8e0d0", fontFamily: "'Palatino Linotype',serif", letterSpacing: ".08em", textShadow: "0 2px 12px rgba(0,0,0,0.8)", textAlign: "center" }}>{ph.city}</div>
        <div style={{ fontSize: 11, color: "#a098a8", marginTop: 4, textShadow: "0 1px 8px rgba(0,0,0,0.8)", textAlign: "center" }}>{ph.date}{ph.country ? ` · ${ph.country}` : ''}</div>
        {caption && <div style={{ fontSize: 14, color: "#e8dcc8", marginTop: 10, textAlign: "center", maxWidth: 420, margin: "10px auto 0", lineHeight: 1.5, fontStyle: "italic", fontFamily: "'Palatino Linotype',serif", letterSpacing: ".04em", opacity: 0.95 }}>{caption}</div>}
        {note && <div style={{ fontSize: 11, color: "#c8c0b0", marginTop: caption ? 6 : 10, textAlign: "center", maxWidth: 400, margin: `${caption ? 6 : 10}px auto 0`, lineHeight: 1.6, fontStyle: "italic", opacity: 0.85 }}>"{note}"</div>}
      </div>
      {/* Progress bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.1)" }}>
        <div style={{ height: "100%", width: `${((index + 1) / photos.length) * 100}%`, background: `linear-gradient(90deg, ${P.goldWarm}, ${P.rose || P.accent})`, transition: "width .5s ease" }} />
      </div>
      {/* Counter + auto-play toggle */}
      <div style={{ position: "absolute", top: 14, right: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={(e) => { e.stopPropagation(); onToggleAutoPlay(!autoPlay); }}
          style={{ background: autoPlay ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)", border: "none", borderRadius: 6, padding: "5px 10px", color: autoPlay ? "#e8e0d0" : "#686070", fontSize: 11, cursor: "pointer", fontFamily: "inherit", transition: "all .3s" }}>
          {autoPlay ? "⏸ Pause" : "▶ Auto"}
        </button>
        <span style={{ fontSize: 11, color: "#686070" }}>{index + 1} / {photos.length}</span>
      </div>
      {/* Close */}
      <button onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{ position: "absolute", top: 12, left: 16, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: "6px 14px", color: "#a098a8", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>
        ✕ Close
      </button>
      {/* Navigation arrows */}
      {index > 0 && (
        <button onClick={(e) => { e.stopPropagation(); onNavigate(index - 1); }}
          style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 44, height: 44, color: "#e8e0d0", fontSize: 18, cursor: "pointer", transition: "background .2s" }}>
          &#9664;
        </button>
      )}
      {index < photos.length - 1 && (
        <button onClick={(e) => { e.stopPropagation(); onNavigate(index + 1); }}
          style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 44, height: 44, color: "#e8e0d0", fontSize: 18, cursor: "pointer", transition: "background .2s" }}>
          &#9654;
        </button>
      )}
    </div>
  );
}
