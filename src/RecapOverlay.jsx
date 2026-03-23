/* RecapOverlay.jsx — Year-in-Review inline recap extracted from OurWorld.jsx */
import { useFocusTrap } from "./formComponents.jsx";

export default function RecapOverlay({
  P, SC, TYPES, DEFAULT_TYPE, thumbnail, fmtDate, navStyle,
  recapYear, recapYearStats, recapEntries, recapPhase, recapIdx, recapStatIdx, recapAutoPlay,
  setRecapPhase, setRecapIdx, setRecapStatIdx, setRecapAutoPlay, setSliderDate,
  setSelected, setPhotoIdx, setCardTab, setTripCardEntry,
  onClose, flyTo,
}) {
  const trapRef = useFocusTrap(recapPhase !== 'journey');
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rS = recapYearStats;
  const statCards = [
    { val: rS.entries, lbl: rS.entries === 1 ? "Adventure" : "Adventures", icon: "🗺" },
    { val: rS.countries, lbl: rS.countries === 1 ? "Country" : "Countries", icon: "🌍" },
    { val: rS.cities, lbl: rS.cities === 1 ? "City" : "Cities", icon: "🏙" },
    { val: rS.totalDays, lbl: "Days Exploring", icon: "🧭" },
    { val: Math.round(rS.totalMiles).toLocaleString(), lbl: "Miles Traveled", icon: "✈️" },
    { val: rS.photos, lbl: "Photos Captured", icon: "📸" },
  ];

  const closeRecap = () => onClose();

  return (
    <div ref={trapRef} role="dialog" aria-modal="true" aria-label="Year in review" style={{ position: "fixed", inset: 0, zIndex: 55, background: recapPhase === 'journey' ? 'transparent' : (SC.bg || "#0c0a12"), display: "flex", alignItems: "center", justifyContent: "center", animation: prefersReducedMotion ? "none" : "fadeIn .6s ease", pointerEvents: recapPhase === 'journey' ? 'none' : 'auto', transition: "background .5s ease" }}>
      {/* Close button (hidden during journey — card has its own) */}
      {recapPhase !== 'journey' && <button onClick={closeRecap} style={{ position: "absolute", top: 20, right: 24, background: "none", border: "none", fontSize: 20, color: `${P.textFaint}80`, cursor: "pointer", zIndex: 60, transition: "color .2s", pointerEvents: "auto" }}
        onMouseEnter={e => e.currentTarget.style.color = P.text} onMouseLeave={e => e.currentTarget.style.color = `${P.textFaint}80`}>×</button>}

      {/* PHASE: Title */}
      {recapPhase === 'title' && (
        <div style={{ textAlign: "center", animation: prefersReducedMotion ? "none" : "fadeIn 1s ease", maxWidth: 500, padding: "0 24px" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.3em", color: P.goldWarm, textTransform: "uppercase", marginBottom: 16, opacity: 0.7 }}>Year in Review</div>
          <div style={{ fontSize: 72, fontWeight: 200, color: P.text, lineHeight: 1, marginBottom: 12, fontFamily: "Georgia, 'Palatino Linotype', serif", animation: prefersReducedMotion ? "none" : "recapNumIn 1.2s cubic-bezier(0.16,1,0.3,1) both" }}>{recapYear}</div>
          <div style={{ fontSize: 13, color: P.textMuted, lineHeight: 1.6, marginBottom: 32 }}>
            {rS.entries} {rS.entries === 1 ? "adventure" : "adventures"} across {rS.countries} {rS.countries === 1 ? "country" : "countries"}
          </div>
          {/* Photo mosaic preview */}
          {rS.allPhotos.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 32, animation: prefersReducedMotion ? "none" : "recapSlideUp .8s .4s cubic-bezier(0.16,1,0.3,1) both" }}>
              {rS.allPhotos.slice(0, 5).map((p, i) => (
                <div key={"recap-photo-" + i} style={{ width: 52, height: 52, borderRadius: 8, overflow: "hidden", opacity: 0.85, transform: `rotate(${(i - 2) * 3}deg)`, transition: "transform .3s, opacity .3s" }}
                  onMouseEnter={e => { e.currentTarget.style.transform = `rotate(0deg) scale(1.15)`; e.currentTarget.style.opacity = "1"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = `rotate(${(i - 2) * 3}deg)`; e.currentTarget.style.opacity = "0.85"; }}>
                  <img loading="lazy" src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ))}
            </div>
          )}
          <button onClick={() => { setRecapPhase('stats'); setRecapStatIdx(0); }} style={{
            padding: "14px 40px", background: `linear-gradient(135deg, ${P.goldWarm}25, ${P.goldWarm}10)`,
            border: `1px solid ${P.goldWarm}40`, borderRadius: 28, color: P.goldWarm,
            fontSize: 13, letterSpacing: ".08em", cursor: "pointer", fontFamily: "inherit",
            transition: "all .3s", animation: prefersReducedMotion ? "none" : "recapSlideUp 1s .6s cubic-bezier(0.16,1,0.3,1) both",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${P.goldWarm}35, ${P.goldWarm}18)`; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${P.goldWarm}25, ${P.goldWarm}10)`; e.currentTarget.style.transform = "none"; }}
          >Begin Your Recap</button>
        </div>
      )}

      {/* PHASE: Stats reveal */}
      {recapPhase === 'stats' && (
        <div style={{ textAlign: "center", maxWidth: 520, width: "92vw", padding: "0 20px", animation: prefersReducedMotion ? "none" : "fadeIn .5s ease" }}>
          <div style={{ fontSize: 9, letterSpacing: "0.25em", color: P.goldWarm, textTransform: "uppercase", marginBottom: 24, opacity: 0.6 }}>{recapYear} — By the Numbers</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 28 }}>
            {statCards.map((s, i) => (
              <div key={s.lbl} style={{
                padding: "20px 12px", background: `linear-gradient(145deg, ${P.rose}08, ${P.rose}03)`,
                borderRadius: 16, border: `1px solid ${P.rose}08`,
                opacity: i <= recapStatIdx ? 1 : 0,
                transform: i <= recapStatIdx ? "translateY(0) scale(1)" : "translateY(20px) scale(0.9)",
                transition: "all .6s cubic-bezier(0.16,1,0.3,1)",
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 300, color: P.goldWarm, fontFamily: "Georgia, serif", lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 10, color: P.textFaint, letterSpacing: ".12em", textTransform: "uppercase", marginTop: 6 }}>{s.lbl}</div>
              </div>
            ))}
          </div>
          {/* Highlights row */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 24, opacity: recapStatIdx >= 5 ? 1 : 0, transition: "opacity .6s .2s" }}>
            {rS.longestTrip.entry && (
              <div style={{ padding: "10px 16px", background: `${P.rose}06`, borderRadius: 12, borderLeft: `3px solid ${P.goldWarm}60` }}>
                <div style={{ fontSize: 10, color: P.textFaint, letterSpacing: ".1em", textTransform: "uppercase" }}>Longest Trip</div>
                <div style={{ fontSize: 12, color: P.text, marginTop: 2 }}>{rS.longestTrip.entry.city} — {rS.longestTrip.days} days</div>
              </div>
            )}
            {rS.topCity && (
              <div style={{ padding: "10px 16px", background: `${P.rose}06`, borderRadius: 12, borderLeft: `3px solid ${P.rose}60` }}>
                <div style={{ fontSize: 10, color: P.textFaint, letterSpacing: ".1em", textTransform: "uppercase" }}>Most Visited</div>
                <div style={{ fontSize: 12, color: P.text, marginTop: 2 }}>{rS.topCity.name} — {rS.topCity.count} {rS.topCity.count === 1 ? "time" : "times"}</div>
              </div>
            )}
            {rS.months > 0 && (
              <div style={{ padding: "10px 16px", background: `${P.rose}06`, borderRadius: 12, borderLeft: `3px solid ${P.sky}60` }}>
                <div style={{ fontSize: 10, color: P.textFaint, letterSpacing: ".1em", textTransform: "uppercase" }}>Active Months</div>
                <div style={{ fontSize: 12, color: P.text, marginTop: 2 }}>{rS.months} of 12</div>
              </div>
            )}
          </div>
          {/* Countries list */}
          {rS.countryNames.length > 0 && (
            <div style={{ marginBottom: 24, opacity: recapStatIdx >= 5 ? 1 : 0, transition: "opacity .6s .4s" }}>
              <div style={{ fontSize: 9, color: P.textMid, lineHeight: 1.8 }}>{rS.countryNames.join("  ·  ")}</div>
            </div>
          )}
          <button onClick={() => { setRecapPhase('journey'); setRecapIdx(0); const e = recapEntries[0]; if (e) { setSliderDate(e.dateStart); flyTo(e.lat, e.lng, 2.4); } }}
            style={{ padding: "12px 36px", background: `linear-gradient(135deg, ${P.goldWarm}25, ${P.goldWarm}10)`, border: `1px solid ${P.goldWarm}40`, borderRadius: 28, color: P.goldWarm, fontSize: 12, letterSpacing: ".06em", cursor: "pointer", fontFamily: "inherit", transition: "all .3s", opacity: recapStatIdx >= 5 ? 1 : 0 }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
          >Relive the Journey</button>
        </div>
      )}

      {/* PHASE: Journey (entry-by-entry with globe visible) */}
      {recapPhase === 'journey' && recapIdx >= 0 && (() => {
        const e = recapEntries[recapIdx];
        const t = TYPES[e.type] || DEFAULT_TYPE;
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 55, background: "transparent", pointerEvents: "none" }}>
            {/* Semi-transparent overlay so globe is visible */}
            <div style={{ position: "absolute", inset: 0, background: `${SC.bg || '#0c0a12'}90`, pointerEvents: "none" }} />
            {/* Entry card — bottom center */}
            <div style={{ position: "absolute", bottom: 100, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ pointerEvents: "auto", background: P.card, backdropFilter: "blur(24px)", borderRadius: 20, padding: "20px 24px", boxShadow: `0 8px 32px ${SC.bg || '#0c0a12'}60`, maxWidth: 460, width: "92vw", animation: prefersReducedMotion ? "none" : "recapSlideUp .5s cubic-bezier(0.16,1,0.3,1)", border: `1px solid ${P.rose}10` }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 10, color: P.goldWarm, letterSpacing: ".14em", textTransform: "uppercase" }}>
                    {recapYear} — {recapIdx + 1} of {recapEntries.length}
                  </span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button onClick={() => setRecapAutoPlay(v => !v)} style={{ background: "none", border: "none", fontSize: 11, color: recapAutoPlay ? P.goldWarm : P.textFaint, cursor: "pointer" }}>
                      {recapAutoPlay ? "⏸" : "▶"}
                    </button>
                    <button aria-label="Close recap" onClick={closeRecap} style={{ background: "none", border: "none", fontSize: 13, color: P.textFaint, cursor: "pointer" }}>×</button>
                  </div>
                </div>

                {/* Photo */}
                {(e.photos || []).length > 0 && (
                  <div style={{ marginBottom: 10, borderRadius: 12, overflow: "hidden", maxHeight: 160 }}>
                    <img loading="lazy" src={thumbnail(e.photos[0], 400)} alt="" style={{ width: "100%", height: 160, objectFit: "cover", animation: prefersReducedMotion ? "none" : "fadeIn .4s ease" }} />
                  </div>
                )}

                {/* Entry info */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 24, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}>{t.icon}</span>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 400, color: P.text }}>{e.city}</div>
                    <div style={{ fontSize: 10, color: P.textMuted }}>{fmtDate(e.dateStart)}{e.dateEnd ? ` → ${fmtDate(e.dateEnd)}` : ""} · {e.country}</div>
                  </div>
                </div>
                {e.notes && <p style={{ fontSize: 11, color: P.textMid, margin: "6px 0", lineHeight: 1.6, maxHeight: 48, overflow: "hidden" }}>{e.notes}</p>}

                {/* Extra photos strip */}
                {(e.photos || []).length > 1 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 8, overflowX: "auto" }}>
                    {e.photos.slice(1, 6).map(url => (
                      <img key={url} loading="lazy" src={thumbnail(url, 100)} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, opacity: 0.9 }} />
                    ))}
                  </div>
                )}

                {/* Progress bar */}
                <div style={{ display: "flex", gap: 2, marginTop: 12, marginBottom: 10 }}>
                  {Array.from({ length: recapEntries.length }, (_, i) => (
                    <div key={"prog-" + i} style={{ flex: 1, height: 2.5, borderRadius: 2, background: i <= recapIdx ? P.goldWarm : `${P.textFaint}25`, transition: "background .4s" }} />
                  ))}
                </div>

                {/* Navigation */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button onClick={() => { if (recapIdx === 0) { setRecapPhase('stats'); setRecapStatIdx(5); } else { setRecapIdx(recapIdx - 1); const prev = recapEntries[recapIdx - 1]; if (prev) { setSliderDate(prev.dateStart); flyTo(prev.lat, prev.lng, 2.4); } } }}
                    style={navStyle()}>◂ Prev</button>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { setSelected(e); setPhotoIdx(0); setCardTab("overview"); }} style={{ ...navStyle(), color: P.heart, fontSize: 10 }}>View</button>
                    <button onClick={() => setTripCardEntry(e)} style={{ ...navStyle(), fontSize: 10 }} title="Trip Card">🎴</button>
                  </div>
                  <button onClick={() => {
                    if (recapIdx >= recapEntries.length - 1) { setRecapPhase('summary'); }
                    else { const next = recapIdx + 1; setRecapIdx(next); const ne = recapEntries[next]; if (ne) { setSliderDate(ne.dateStart); flyTo(ne.lat, ne.lng, 2.4); } }
                  }} style={navStyle()}>{recapIdx >= recapEntries.length - 1 ? "Summary ✨" : "Next ▸"}</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PHASE: Summary — shareable recap card */}
      {recapPhase === 'summary' && (
        <div style={{ textAlign: "center", maxWidth: 480, width: "92vw", padding: "0 20px", animation: prefersReducedMotion ? "none" : "fadeIn .6s ease" }}>
          <div style={{ fontSize: 9, letterSpacing: "0.25em", color: P.goldWarm, textTransform: "uppercase", marginBottom: 20, opacity: 0.6 }}>Your {recapYear} Wrapped</div>

          {/* Summary card */}
          <div id="recap-summary-card" style={{
            background: `linear-gradient(145deg, ${SC.bg || '#0c0a12'}, ${P.card})`,
            borderRadius: 20, padding: "32px 28px", border: `1px solid ${P.rose}10`,
            boxShadow: `0 8px 32px ${SC.bg || '#0c0a12'}40`, marginBottom: 24,
          }}>
            <div style={{ fontSize: 9, letterSpacing: "0.3em", color: P.goldWarm, textTransform: "uppercase", marginBottom: 4, opacity: 0.5 }}>My Cosmos</div>
            <div style={{ fontSize: 48, fontWeight: 200, color: P.text, fontFamily: "Georgia, serif", marginBottom: 4 }}>{recapYear}</div>
            <div style={{ fontSize: 10, color: P.textMuted, letterSpacing: ".06em", marginBottom: 20 }}>Year in Review</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
                { val: rS.entries, lbl: "Adventures" },
                { val: rS.countries, lbl: "Countries" },
                { val: rS.cities, lbl: "Cities" },
                { val: rS.totalDays, lbl: "Days" },
                { val: Math.round(rS.totalMiles).toLocaleString(), lbl: "Miles" },
                { val: rS.photos, lbl: "Photos" },
              ].map(s => (
                <div key={s.lbl} style={{ padding: "10px 6px" }}>
                  <div style={{ fontSize: 22, fontWeight: 300, color: P.goldWarm }}>{s.val}</div>
                  <div style={{ fontSize: 10, color: P.textFaint, letterSpacing: ".1em", textTransform: "uppercase" }}>{s.lbl}</div>
                </div>
              ))}
            </div>

            {/* Photo mosaic */}
            {rS.allPhotos.length > 0 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 16 }}>
                {rS.allPhotos.slice(0, 6).map((p, i) => (
                  <div key={"highlight-" + i} style={{ width: 48, height: 48, borderRadius: 6, overflow: "hidden" }}>
                    <img loading="lazy" src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>
            )}

            {rS.countryNames.length > 0 && (
              <div style={{ fontSize: 9, color: P.textMid, lineHeight: 1.8, opacity: 0.7 }}>{rS.countryNames.join("  ·  ")}</div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => {
              const W = 600, H = 700;
              const cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H;
              const ctx = cvs.getContext('2d');
              const grad = ctx.createLinearGradient(0, 0, W, H);
              grad.addColorStop(0, SC.bg || '#0c0a12'); grad.addColorStop(1, '#1a1428');
              ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
              ctx.fillStyle = (P.goldWarm || '#c9a96e') + '80'; ctx.font = '11px Georgia, serif'; ctx.textAlign = 'center';
              ctx.fillText('MY COSMOS', W / 2, 50);
              ctx.fillStyle = P.text || '#e8e0d0'; ctx.font = '200 72px Georgia, serif';
              ctx.fillText(String(recapYear), W / 2, 130);
              ctx.fillStyle = (P.textMuted || '#a098a8') + 'cc'; ctx.font = '13px Georgia, serif';
              ctx.fillText('Year in Review', W / 2, 155);
              const grid = [
                { val: String(rS.entries), lbl: 'Adventures' }, { val: String(rS.countries), lbl: 'Countries' }, { val: String(rS.cities), lbl: 'Cities' },
                { val: String(rS.totalDays), lbl: 'Days' }, { val: Math.round(rS.totalMiles).toLocaleString(), lbl: 'Miles' }, { val: String(rS.photos), lbl: 'Photos' },
              ];
              const cols = 3, cellW = 160, cellH = 70, startX = (W - cols * cellW) / 2, startY = 190;
              grid.forEach((s, i) => {
                const col = i % cols, row = Math.floor(i / cols);
                const cx = startX + col * cellW + cellW / 2, cy = startY + row * cellH;
                ctx.fillStyle = P.goldWarm || '#c9a96e'; ctx.font = '300 32px Georgia, serif';
                ctx.fillText(s.val, cx, cy + 28);
                ctx.fillStyle = (P.textFaint || '#807888') + 'cc'; ctx.font = '9px Georgia, serif'; ctx.letterSpacing = '2px';
                ctx.fillText(s.lbl.toUpperCase(), cx, cy + 44);
              });
              if (rS.countryNames.length > 0) {
                ctx.fillStyle = (P.textMid || '#c0b8c8') + '99'; ctx.font = '11px Georgia, serif';
                const countryStr = rS.countryNames.join('  ·  ');
                const lines = []; let line = '';
                for (const word of countryStr.split('  ')) {
                  const test = line + (line ? '  ' : '') + word;
                  if (ctx.measureText(test).width > W - 80 && line) { lines.push(line); line = word; }
                  else line = test;
                }
                if (line) lines.push(line);
                lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, W / 2, 380 + i * 18));
              }
              ctx.strokeStyle = (P.goldWarm || '#c9a96e') + '20'; ctx.lineWidth = 1;
              ctx.beginPath(); ctx.moveTo(80, H - 60); ctx.lineTo(W - 80, H - 60); ctx.stroke();
              ctx.fillStyle = (P.textFaint || '#504858') + '80'; ctx.font = '9px Georgia, serif';
              ctx.fillText('my-cosmos.app', W / 2, H - 36);
              cvs.toBlob(blob => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url;
                a.download = `my-cosmos-${recapYear}-recap.png`;
                a.click(); URL.revokeObjectURL(url);
              });
            }} style={{
              padding: "12px 28px", background: `linear-gradient(135deg, ${P.goldWarm}25, ${P.goldWarm}10)`,
              border: `1px solid ${P.goldWarm}40`, borderRadius: 24, color: P.goldWarm,
              fontSize: 11, letterSpacing: ".06em", cursor: "pointer", fontFamily: "inherit", transition: "all .3s",
            }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"} onMouseLeave={e => e.currentTarget.style.transform = "none"}>
              Save as Image
            </button>
            <button onClick={() => { setRecapPhase('journey'); setRecapIdx(0); const e = recapEntries[0]; if (e) { setSliderDate(e.dateStart); flyTo(e.lat, e.lng, 2.4); } }}
              style={{ padding: "12px 28px", background: `${P.rose}08`, border: `1px solid ${P.rose}15`, borderRadius: 24, color: P.textMid, fontSize: 11, letterSpacing: ".06em", cursor: "pointer", fontFamily: "inherit", transition: "all .3s" }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"} onMouseLeave={e => e.currentTarget.style.transform = "none"}>
              Replay Journey
            </button>
            <button onClick={closeRecap}
              style={{ padding: "12px 28px", background: "transparent", border: `1px solid ${P.textFaint}30`, borderRadius: 24, color: P.textFaint, fontSize: 11, letterSpacing: ".06em", cursor: "pointer", fontFamily: "inherit", transition: "all .3s" }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"} onMouseLeave={e => e.currentTarget.style.transform = "none"}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Recap-specific keyframes */}
      <style>{`
        @keyframes recapNumIn { from { opacity: 0; transform: scale(0.7) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes recapSlideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
