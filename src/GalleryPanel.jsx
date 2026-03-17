import { thumbnail } from "./imageUtils.js";

export default function GalleryPanel({ photos, entries, palette: P, onSelectPhoto, onClose, polaroidMode, onTogglePolaroid, allPhotoCaptions }) {
  return (
    <div style={{ position: "absolute", top: 72, left: 22, zIndex: 22, background: P.card, backdropFilter: "blur(28px)", borderRadius: 18, width: 290, maxHeight: "calc(100vh - 200px)", boxShadow: "0 1px 3px rgba(61,53,82,.04), 0 8px 24px rgba(61,53,82,.06), 0 20px 48px rgba(61,53,82,.08)", border: `1px solid ${P.rose}08`, animation: "fadeIn .4s ease", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 14px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, borderBottom: `1px solid ${P.rose}08` }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 400 }}>📸 Scrapbook</div>
          <div style={{ fontSize: 8, color: P.textFaint, letterSpacing: ".1em", marginTop: 1 }}>{photos.length} memories</div>
        </div>
        <button aria-label="Close gallery" onClick={onClose} style={{ background: "none", border: "none", fontSize: 15, color: P.textFaint, cursor: "pointer" }}>×</button>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 10px 4px" }}>
        <button onClick={onTogglePolaroid} style={{ background: polaroidMode ? `${P.goldWarm}18` : "none", border: `1px solid ${polaroidMode ? P.goldWarm + "30" : P.textFaint + "20"}`, borderRadius: 6, padding: "6px 10px", fontSize: 10, cursor: "pointer", fontFamily: "inherit", color: polaroidMode ? P.goldWarm : P.textFaint }}>{polaroidMode ? "📸 Polaroid" : "▦ Grid"}</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: polaroidMode ? "1fr 1fr" : "1fr 1fr 1fr", gap: polaroidMode ? 14 : 4, padding: polaroidMode ? "4px 6px" : 0 }}>
          {photos.map((ph, i) => (
            <button key={ph.url + "-" + ph.id} onClick={() => {
              const entry = entries.find(e => e.id === ph.id);
              if (entry) onSelectPhoto(entry);
            }} style={polaroidMode ? { padding: "5px 5px 20px", background: "#fff", border: "none", cursor: "pointer", borderRadius: 2, boxShadow: "0 2px 8px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.06)", transform: `rotate(${(i % 5 - 2) * 2}deg)`, transition: "transform .2s", overflow: "hidden", position: "relative" } : { padding: 0, border: "none", background: "none", cursor: "pointer", borderRadius: 4, overflow: "hidden", aspectRatio: "1", position: "relative" }}>
              <img loading="lazy" src={thumbnail(ph.url, 160)} alt="Travel photo" style={polaroidMode ? { width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" } : { width: "100%", height: "100%", objectFit: "cover", borderRadius: 4, transition: "transform .2s" }}
                onMouseEnter={e => { if (!polaroidMode) e.currentTarget.style.transform = "scale(1.05)"; else e.currentTarget.parentElement.style.transform = `rotate(0deg) scale(1.05)`; }}
                onMouseLeave={e => { if (!polaroidMode) e.currentTarget.style.transform = "scale(1)"; else e.currentTarget.parentElement.style.transform = `rotate(${(i % 5 - 2) * 2}deg)`; }} />
              <div style={polaroidMode ? { fontSize: 8, color: "#666", textAlign: "center", padding: "4px 3px 0", letterSpacing: ".03em", fontFamily: allPhotoCaptions[ph.url] ? "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif" : "inherit", fontStyle: allPhotoCaptions[ph.url] ? "italic" : "normal", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : { position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 3px 2px", background: "linear-gradient(transparent, rgba(0,0,0,.5))", fontSize: 6, color: "#fff", textAlign: "center", letterSpacing: ".05em" }}>{polaroidMode && allPhotoCaptions[ph.url] ? allPhotoCaptions[ph.url] : ph.city}</div>
            </button>
          ))}
        </div>
        {photos.length === 0 && <div style={{ textAlign: "center", padding: "32px 16px" }}>
          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>📸</div>
          <div style={{ fontSize: 11, color: P.textFaint, lineHeight: 1.7, fontStyle: "italic", fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif" }}>Your scrapbook is empty.<br/>Add photos to your entries and they'll appear here.</div>
        </div>}
      </div>
    </div>
  );
}
