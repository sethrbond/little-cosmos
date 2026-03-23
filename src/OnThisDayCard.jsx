import { thumbnail } from "./imageUtils.js";

export default function OnThisDayCard({ onThisDay, dismissOnThisDay, setDismissOnThisDay, selected, editing, modals, TYPES, DEFAULT_TYPE, P, config, isPartnerWorld, worldType, flyTo, setSliderDate, setSelected, playStory, introComplete, fmtDate, entries }) {
  if (onThisDay.length === 0 || !introComplete || modals.showStats || modals.showRecap || modals.showAdd || selected || editing || dismissOnThisDay) return null;

  const mem = onThisDay[0];
  const typeInfo = TYPES[mem.type] || DEFAULT_TYPE;
  const yearsLabel = mem.yearsAgo === 1 ? "1 year ago today" : `${mem.yearsAgo} years ago today`;
  const hasPhoto = mem.photos && mem.photos.length > 0;
  const destination = mem.city + (mem.country ? `, ${mem.country}` : "");
  const annivMessage = isPartnerWorld
    ? `${mem.yearsAgo === 1 ? "1 year" : mem.yearsAgo + " years"} ago, you and ${config.partnerName || "your partner"} were in ${destination}`
    : worldType === "friends"
    ? `${mem.yearsAgo === 1 ? "1 year" : mem.yearsAgo + " years"} ago, the crew was in ${destination}`
    : worldType === "family"
    ? `${mem.yearsAgo === 1 ? "1 year" : mem.yearsAgo + " years"} ago, the family was in ${destination}`
    : `${mem.yearsAgo === 1 ? "1 year" : mem.yearsAgo + " years"} ago, you were in ${destination}`;

  return (
    <div style={{ position: "absolute", bottom: 140, left: 20, zIndex: 12, maxWidth: 300, background: P.card + "ee", backdropFilter: "blur(16px)", border: `1px solid ${P.gold}25`, borderRadius: 16, padding: "14px 16px", boxShadow: "0 4px 24px rgba(0,0,0,.10)", animation: "onThisDaySlideUp .5s ease both", fontFamily: "inherit" }}>
      {/* Dismiss button */}
      <button onClick={() => setDismissOnThisDay(true)} style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", color: P.textFaint, cursor: "pointer", fontSize: 14, padding: "2px 4px", lineHeight: 1, fontFamily: "inherit" }} aria-label="Dismiss">×</button>
      {/* Header */}
      <div style={{ fontSize: 10, fontVariant: "all-small-caps", letterSpacing: ".12em", color: P.gold, marginBottom: 8 }}>🎉 On This Day</div>
      {/* Photo */}
      {hasPhoto && (
        <img src={thumbnail(mem.photos[0], 280)} alt="" style={{ width: "100%", height: 100, borderRadius: 10, objectFit: "cover", marginBottom: 10, border: `1px solid ${P.gold}15` }} />
      )}
      {/* Anniversary message */}
      <div style={{ fontSize: 12, color: P.text, fontWeight: 500, lineHeight: 1.4, marginBottom: 2 }}>
        {annivMessage}
      </div>
      {/* Years badge */}
      <div style={{ fontSize: 9, color: P.textMuted, letterSpacing: ".05em", marginBottom: 6 }}>{typeInfo.icon} {yearsLabel}</div>
      {/* More memories count */}
      {onThisDay.length > 1 && (
        <div style={{ fontSize: 9, color: P.textMuted, marginBottom: 6, letterSpacing: ".04em" }}>+{onThisDay.length - 1} more {onThisDay.length - 1 === 1 ? "memory" : "memories"}</div>
      )}
      {/* Action buttons */}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => {
          const entry = entries.find(e => e.id === mem.id);
          if (entry) {
            flyTo(entry.lat, entry.lng, 2.5);
            setSliderDate(entry.dateStart);
            setSelected(entry);
          }
          setDismissOnThisDay(true);
        }} style={{ flex: 1, padding: "7px 0", background: P.rose, color: "#fff", border: "none", borderRadius: 10, fontSize: 10, fontWeight: 600, letterSpacing: ".06em", cursor: "pointer", fontFamily: "inherit", transition: "opacity .2s" }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >Replay</button>
        <button onClick={() => {
          setDismissOnThisDay(true);
          playStory();
        }} style={{ flex: 1, padding: "7px 0", background: "transparent", color: P.text, border: `1px solid ${P.gold}30`, borderRadius: 10, fontSize: 10, fontWeight: 500, letterSpacing: ".04em", cursor: "pointer", fontFamily: "inherit", transition: "opacity .2s" }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >Cinema</button>
      </div>
    </div>
  );
}
