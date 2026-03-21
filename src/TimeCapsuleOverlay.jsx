import { useState } from "react";
import { getP } from "./cosmosGetP.js";
import { inputStyle } from "./formUtils.jsx";
import { geocodeSearch } from "./geocode.js";

const CAPSULE_PROMPTS = {
  partner: "Write a love letter to your future selves...",
  friends: "Leave a message for the next reunion...",
  family: "Write a note for a future milestone...",
  personal: "Dear future me...",
};

function getCapsulePrompt(worldType, isMyWorld) {
  if (isMyWorld) return CAPSULE_PROMPTS.personal;
  return CAPSULE_PROMPTS[worldType] || CAPSULE_PROMPTS.personal;
}

const fmtDate = d => {
  if (!d) return "";
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

const daysUntil = d => {
  if (!d) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(d + "T00:00:00");
  return Math.max(0, Math.ceil((target - now) / 86400000));
};

function CapsuleViewModal({ capsule, onClose, onRemove, isViewer }) {
  const P = getP();
  const today = new Date().toISOString().slice(0, 10);
  const isSealed = capsule.unlockDate > today;
  const days = daysUntil(capsule.unlockDate);

  return (
    <div role="dialog" aria-modal="true" aria-label="Time capsule" onClick={onClose} style={{
      position: "absolute", inset: 0, zIndex: 50,
      background: isSealed
        ? "linear-gradient(135deg, rgba(20,18,32,.90), rgba(28,24,42,.94))"
        : "linear-gradient(135deg, rgba(40,32,16,.88), rgba(24,20,12,.92))",
      backdropFilter: "blur(30px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", animation: "fadeIn .8s ease",
    }}>
      <div style={{ maxWidth: 460, padding: 36, textAlign: "center" }} onClick={e => e.stopPropagation()}>
        {isSealed ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 16, filter: "drop-shadow(0 0 20px rgba(200,168,96,.4))" }}>🔒</div>
            <div style={{ fontSize: 10, color: "#c8a860", letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 6 }}>Time Capsule</div>
            {capsule.city && <div style={{ fontSize: 9, color: "#a098b0", letterSpacing: ".10em", marginBottom: 12 }}>sealed near {capsule.city}</div>}
            <div style={{
              padding: "16px 24px", borderRadius: 14,
              background: "rgba(200,168,96,.08)", border: "1px solid rgba(200,168,96,.18)",
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, color: "#e8dcd0", fontStyle: "italic", letterSpacing: ".02em" }}>
                Sealed until {fmtDate(capsule.unlockDate)}
              </div>
              <div style={{ fontSize: 10, color: "#a098b0", marginTop: 6 }}>
                {days === 1 ? "Opens tomorrow" : `${days} days remaining`}
              </div>
            </div>
            <div style={{ fontSize: 9, color: "#686070", fontStyle: "italic", lineHeight: 1.6 }}>
              This message is waiting for the right moment to reveal itself.
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 16, animation: "fadeIn 1.5s ease" }}>🎉</div>
            <div style={{
              display: "inline-block", padding: "3px 12px", borderRadius: 10,
              background: "rgba(200,168,96,.15)", color: "#c8a860",
              fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase", marginBottom: 10,
            }}>Time capsule opened!</div>
            {capsule.city && <div style={{ fontSize: 9, color: "#a098b0", letterSpacing: ".10em", marginBottom: 12 }}>from {capsule.city}</div>}
            <p style={{
              fontSize: 14, lineHeight: 2, color: "#e8dcd0",
              whiteSpace: "pre-wrap", fontStyle: "italic",
              animation: "fadeIn 2s ease",
            }}>{capsule.message}</p>
            <p style={{ fontSize: 9, color: "#686070", marginTop: 16, letterSpacing: ".10em" }}>
              sealed on {fmtDate(capsule.createdAt)} · opened {fmtDate(capsule.unlockDate)}
            </p>
          </>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 18 }}>
          <button onClick={onClose} style={{
            padding: "6px 18px", background: "transparent",
            border: "1px solid rgba(160,152,176,.25)", borderRadius: 8,
            cursor: "pointer", fontSize: 10, color: "#a098b0", fontFamily: "inherit",
          }}>Close</button>
          {!isViewer && <button onClick={() => onRemove(capsule)} style={{
            padding: "6px 14px", background: "transparent",
            border: "1px solid rgba(200,120,120,.25)", borderRadius: 8,
            cursor: "pointer", fontSize: 10, color: "#c97a7a", fontFamily: "inherit",
          }}>Remove</button>}
        </div>
      </div>
    </div>
  );
}

function CapsuleCreateModal({ onClose, onSave, worldType, isMyWorld, config }) {
  const P = getP();
  const [message, setMessage] = useState("");
  const [unlockDate, setUnlockDate] = useState("");
  const [city, setCity] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [citySugg, setCitySugg] = useState([]);

  const placeholder = getCapsulePrompt(worldType, isMyWorld);
  const today = new Date().toISOString().slice(0, 10);
  const validDate = unlockDate && unlockDate > today;
  const ok = message.trim() && validDate && city.trim() && lat && lng;

  return (
    <div role="dialog" aria-modal="true" aria-label="Create time capsule" onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 55,
      background: "rgba(22,16,40,.82)", backdropFilter: "blur(20px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fadeIn .2s ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 420, maxWidth: "92vw", padding: 28,
        background: P.card, borderRadius: 16,
        boxShadow: "0 14px 48px rgba(61,53,82,.1)",
      }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 400 }}>
          🔮 New Time Capsule
        </h3>
        <p style={{ fontSize: 9, color: P.textMuted, marginBottom: 14, fontStyle: "italic" }}>
          Write a message that will stay sealed until the date you choose. A golden marker will pulse on your globe until it opens.
        </p>

        <div style={{ marginBottom: 8, position: "relative" }}>
          <label style={{ fontSize: 7, color: P.textFaint, letterSpacing: ".13em", textTransform: "uppercase", display: "block", marginBottom: 2 }}>Place on globe near...</label>
          <input value={city} onChange={e => {
            const v = e.target.value; setCity(v);
            if (v.length >= 2) { geocodeSearch(v, m => setCitySugg(m)); } else setCitySugg([]);
          }} placeholder="Type a city..." style={inputStyle()} />
          {citySugg.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: P.card, border: `1px solid ${P.textFaint}40`, borderRadius: 6, maxHeight: 120, overflowY: "auto", zIndex: 10, boxShadow: "0 6px 16px rgba(0,0,0,.1)" }}>
              {citySugg.map((c, i) => (
                <button key={i} onClick={() => { setCity(c[0]); setLat(c[2].toString()); setLng(c[3].toString()); setCitySugg([]); }}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", border: "none", borderBottom: `1px solid ${P.textFaint}15`, background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10, color: P.textMid }}
                  onMouseEnter={e => e.currentTarget.style.background = P.blush} onMouseLeave={e => e.currentTarget.style.background = "none"}>
                  <span style={{ fontWeight: 500 }}>{c[0]}</span> <span style={{ color: P.textFaint }}>{c[1]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 7, color: P.textFaint, letterSpacing: ".13em", textTransform: "uppercase", display: "block", marginBottom: 2 }}>Opens on...</label>
          <input type="date" value={unlockDate} min={(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })()} onChange={e => setUnlockDate(e.target.value)} style={inputStyle()} />
          {unlockDate && !validDate && <div style={{ fontSize: 8, color: "#c97a7a", marginTop: 2 }}>Must be a future date</div>}
          {validDate && <div style={{ fontSize: 8, color: P.textFaint, marginTop: 2 }}>Opens in {daysUntil(unlockDate)} day{daysUntil(unlockDate) !== 1 ? "s" : ""}</div>}
        </div>

        <textarea
          value={message} onChange={e => setMessage(e.target.value)}
          rows={6} placeholder={placeholder}
          style={{ ...inputStyle(), resize: "vertical", lineHeight: 1.8 }}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={() => {
            onSave({
              id: `tc-${Date.now()}`,
              message,
              unlockDate,
              city, lat: parseFloat(lat), lng: parseFloat(lng),
              createdAt: new Date().toISOString().slice(0, 10),
            });
          }} disabled={!ok} style={{
            flex: 1, padding: "10px",
            background: ok ? "linear-gradient(135deg, #c8a860, #a08840)" : `${P.textFaint}60`,
            color: "#fff", border: "none", borderRadius: 12,
            cursor: ok ? "pointer" : "default",
            fontSize: 11, fontFamily: "inherit", letterSpacing: ".04em",
            boxShadow: ok ? "0 2px 8px rgba(200,168,96,.3)" : "none",
            transition: "all .25s",
          }}>
            Seal Time Capsule 🔮
          </button>
          <button onClick={onClose} style={{
            padding: "10px 16px", background: "transparent",
            border: `1px solid ${P.textFaint}30`, borderRadius: 12,
            cursor: "pointer", fontSize: 11, fontFamily: "inherit", color: P.textMuted,
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function TimeCapsuleOverlay({
  showCapsuleId, showCreate,
  capsules, config, isViewer,
  worldType, isMyWorld,
  onCloseView, onCloseCreate,
  onSaveCapsule, onRemoveCapsule,
}) {
  return (
    <>
      {showCapsuleId && (() => {
        const capsule = (capsules || []).find(c => c.id === showCapsuleId);
        if (!capsule) return null;
        return <CapsuleViewModal capsule={capsule} onClose={onCloseView} onRemove={onRemoveCapsule} isViewer={isViewer} />;
      })()}
      {showCreate && (
        <CapsuleCreateModal
          onClose={onCloseCreate}
          onSave={onSaveCapsule}
          worldType={worldType}
          isMyWorld={isMyWorld}
          config={config}
        />
      )}
    </>
  );
}
