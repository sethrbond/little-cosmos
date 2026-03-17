import { useRef } from "react";

export default function Lightbox({ photos, index, onClose, onNavigate, palette: P, captions, isViewer, onCaptionChange, onCaptionBlur, cityLabel }) {
  const idx = ((index % photos.length) + photos.length) % photos.length;
  const caption = (captions || {})[photos[idx]];
  const prev = () => onNavigate(((idx - 1) + photos.length) % photos.length);
  const next = () => onNavigate((idx + 1) % photos.length);
  const lbSwipeRef = useRef({ startX: 0, startY: 0, swiping: false });
  return (
    <div role="dialog" aria-modal="true" aria-label="Photo lightbox" style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(24px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .25s ease" }}
      onClick={onClose}
      onKeyDown={e => { if (e.key === "Escape") onClose(); else if (e.key === "ArrowLeft") prev(); else if (e.key === "ArrowRight") next(); }}
      onTouchStart={e => { if (e.touches.length === 1) { lbSwipeRef.current.startX = e.touches[0].clientX; lbSwipeRef.current.startY = e.touches[0].clientY; lbSwipeRef.current.swiping = true; } }}
      onTouchEnd={e => { if (!lbSwipeRef.current.swiping || !e.changedTouches[0]) return; lbSwipeRef.current.swiping = false; const dx = e.changedTouches[0].clientX - lbSwipeRef.current.startX; const dy = Math.abs(e.changedTouches[0].clientY - lbSwipeRef.current.startY); if (Math.abs(dx) > 50 && dy < 100) { if (dx > 0) prev(); else next(); e.preventDefault(); } }}
      tabIndex={0} ref={el => el?.focus()}>
      {/* Close button */}
      <button aria-label="Close lightbox" onClick={onClose} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "#fff", fontSize: 28, cursor: "pointer", zIndex: 210, opacity: 0.7, lineHeight: 1 }}>×</button>
      {/* Counter */}
      <div style={{ position: "absolute", top: 20, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 12, letterSpacing: "1px", zIndex: 210 }}>{idx + 1} / {photos.length}</div>
      {/* Photo */}
      <img key={photos[idx]} src={photos[idx]} alt={`Photo ${idx + 1}`} onClick={e => e.stopPropagation()}
        style={{ maxWidth: "90vw", maxHeight: !isViewer ? "75vh" : caption ? "78vh" : "85vh", objectFit: "contain", borderRadius: 4, boxShadow: "0 8px 40px rgba(0,0,0,0.5)", cursor: "default", animation: "lbFadeOpacity .35s ease" }} />
      {/* Caption — editable for owners */}
      <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: photos.length > 1 ? 72 : 46, left: 0, right: 0, textAlign: "center", zIndex: 210, animation: "lbFadeOpacity .5s ease" }}>
        {!isViewer ? (
          <input
            type="text"
            placeholder="write a caption..."
            value={caption || ""}
            onClick={e => e.stopPropagation()}
            onChange={e => onCaptionChange && onCaptionChange(photos[idx], e.target.value)}
            onBlur={e => onCaptionBlur && onCaptionBlur(photos[idx], e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") e.target.blur(); e.stopPropagation(); }}
            style={{ display: "inline-block", maxWidth: "70vw", width: "50vw", padding: "6px 16px", background: caption ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.25)", borderRadius: 8, color: "rgba(255,255,255,0.8)", fontSize: 13, fontStyle: "italic", fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", letterSpacing: ".03em", lineHeight: 1.5, border: "none", outline: "none", textAlign: "center", transition: "background .2s" }}
          />
        ) : caption ? (
          <span style={{ display: "inline-block", maxWidth: "70vw", padding: "6px 16px", background: "rgba(0,0,0,0.5)", borderRadius: 8, color: "rgba(255,255,255,0.8)", fontSize: 13, fontStyle: "italic", fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", letterSpacing: ".03em", lineHeight: 1.5 }}>{caption}</span>
        ) : null}
      </div>
      {/* Navigation arrows */}
      {photos.length > 1 && (<>
        <button aria-label="Previous photo" onClick={e => { e.stopPropagation(); prev(); }} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "50%", width: 44, height: 44, cursor: "pointer", fontSize: 20, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 210, transition: "all .2s" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}>‹</button>
        <button aria-label="Next photo" onClick={e => { e.stopPropagation(); next(); }} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "50%", width: 44, height: 44, cursor: "pointer", fontSize: 20, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 210, transition: "all .2s" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}>›</button>
      </>)}
      {/* Dot indicators */}
      {photos.length > 1 && photos.length <= 20 && (
        <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6, zIndex: 210 }}>
          {photos.map((_, i) => <button key={"lb-" + i} onClick={e => { e.stopPropagation(); onNavigate(i); }}
            style={{ width: i === idx ? 10 : 6, height: 6, borderRadius: 3, background: i === idx ? "#fff" : "rgba(255,255,255,0.3)", border: "none", padding: 0, cursor: "pointer", transition: "all .2s" }} />)}
        </div>
      )}
      {/* City label */}
      <div style={{ position: "absolute", bottom: photos.length > 1 ? 50 : 24, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: "1px", zIndex: 210 }}>{cityLabel}</div>
    </div>
  );
}
