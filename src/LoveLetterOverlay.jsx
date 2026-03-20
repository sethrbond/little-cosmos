import { useState } from "react";
import { getP } from "./cosmosGetP.js";
import { inputStyle } from "./formUtils.jsx";
import { geocodeSearch } from "./geocode.js";

function LetterViewModal({ letter, userId, config, onClose, onEdit, onSend, onRemove }) {
  const P = getP();
  const isMyLetter = !letter.author || letter.author === userId;
  if (letter.draft && !isMyLetter) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Love letter" onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 50, background: `linear-gradient(135deg, rgba(22,16,40,.84), rgba(30,24,48,.90))`, backdropFilter: "blur(30px)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", animation: "fadeIn .8s ease" }}>
      <div style={{ maxWidth: 460, padding: 36, textAlign: "center" }} onClick={e => e.stopPropagation()}>
        {letter.draft && <div style={{ display: "inline-block", padding: "2px 10px", borderRadius: 10, background: `${P.gold}20`, color: P.gold, fontSize: 9, letterSpacing: ".08em", marginBottom: 10 }}>📝 Draft — only you can see this</div>}
        <div style={{ fontSize: 30, marginBottom: 14 }}>💌</div>
        {letter.city && <div style={{ fontSize: 9, color: "#a098b0", letterSpacing: ".12em", marginBottom: 8 }}>found near {letter.city}</div>}
        <p style={{ fontSize: 14, lineHeight: 2, color: "#e8dcd0", whiteSpace: "pre-wrap", fontStyle: "italic" }}>{letter.text}</p>
        <p style={{ fontSize: 10, color: "#a098b0", marginTop: 20, letterSpacing: ".15em" }}>— {config.youName || "You"}</p>
        {isMyLetter && <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
          <button onClick={() => onEdit(letter)} style={{ background: "none", border: `1px solid ${P.rose}28`, borderRadius: 5, padding: "4px 12px", fontSize: 9, color: P.textMuted, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
          {letter.draft && <button onClick={() => onSend(letter)} style={{ background: `${P.rose}20`, border: `1px solid ${P.rose}40`, borderRadius: 5, padding: "4px 12px", fontSize: 9, color: P.rose, cursor: "pointer", fontFamily: "inherit" }}>Send 💌</button>}
          <button onClick={() => onRemove(letter)} style={{ background: "none", border: `1px solid #c97a7a28`, borderRadius: 5, padding: "4px 12px", fontSize: 9, color: "#c97a7a", cursor: "pointer", fontFamily: "inherit" }}>Remove</button>
        </div>}
      </div>
    </div>
  );
}

function LetterEditModal({ letterEditId, initialDraft, initialCity, initialLat, initialLng, config, onClose, onSave, onSaveDraft }) {
  const P = getP();
  const [letterDraft, setLetterDraft] = useState(initialDraft || "");
  const [letterCity, setLetterCity] = useState(initialCity || "");
  const [letterLat, setLetterLat] = useState(initialLat || "");
  const [letterLng, setLetterLng] = useState(initialLng || "");
  const [citySugg, setCitySugg] = useState([]);

  const buildObj = (draft) => ({
    text: letterDraft,
    city: letterCity,
    lat: parseFloat(letterLat) || (20 + Math.random() * 40),
    lng: parseFloat(letterLng) || (-120 + Math.random() * 240),
    draft,
  });

  return (
    <div role="dialog" aria-modal="true" aria-label="Edit love letter" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 55, background: "rgba(22,16,40,.82)", backdropFilter: "blur(20px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .2s ease" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 420, maxWidth: "92vw", padding: 28, background: P.card, borderRadius: 16, boxShadow: "0 14px 48px rgba(61,53,82,.1)" }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 400 }}>💌 {letterEditId ? "Edit" : "New"} Love Letter</h3>
        <p style={{ fontSize: 9, color: P.textMuted, marginBottom: 12, fontStyle: "italic" }}>Hidden as an easter egg ❀ on the globe — {config.partnerName || "your partner"} will discover it!</p>
        <div style={{ marginBottom: 8, position: "relative" }}>
          <label style={{ fontSize: 7, color: P.textFaint, letterSpacing: ".13em", textTransform: "uppercase", display: "block", marginBottom: 2 }}>Place on globe near...</label>
          <input value={letterCity} onChange={e => {
            const v = e.target.value; setLetterCity(v);
            if (v.length >= 2) { geocodeSearch(v, m => setCitySugg(m)); } else setCitySugg([]);
          }} placeholder="Type a city..." style={inputStyle()} />
          {citySugg.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: P.card, border: `1px solid ${P.textFaint}40`, borderRadius: 6, maxHeight: 120, overflowY: "auto", zIndex: 10, boxShadow: "0 6px 16px rgba(0,0,0,.1)" }}>
              {citySugg.map((c, i) => (
                <button key={i} onClick={() => { setLetterCity(c[0]); setLetterLat(c[2].toString()); setLetterLng(c[3].toString()); setCitySugg([]); }}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", border: "none", borderBottom: `1px solid ${P.textFaint}15`, background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10, color: P.textMid }}
                  onMouseEnter={e => e.currentTarget.style.background = P.blush} onMouseLeave={e => e.currentTarget.style.background = "none"}>
                  <span style={{ fontWeight: 500 }}>{c[0]}</span> <span style={{ color: P.textFaint }}>{c[1]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <textarea value={letterDraft} onChange={e => setLetterDraft(e.target.value)} rows={8} placeholder={`Dear ${config.partnerName || "Partner"}...`} style={{ ...inputStyle(), resize: "vertical", lineHeight: 1.8 }} />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => { onSave(letterEditId, buildObj(false)); }} disabled={!letterDraft.trim()} style={{ flex: 1, padding: "10px", background: letterDraft.trim() ? `linear-gradient(135deg, ${P.rose}, ${P.sky})` : `${P.textFaint}60`, color: "#fff", border: "none", borderRadius: 12, cursor: letterDraft.trim() ? "pointer" : "default", fontSize: 11, fontFamily: "inherit", letterSpacing: ".04em", boxShadow: letterDraft.trim() ? `0 2px 8px ${P.rose}30` : "none", transition: "all .25s" }}>
            {letterEditId ? "Update & Send" : "Hide on Globe"} 💌
          </button>
          <button onClick={() => { onSaveDraft(letterEditId, buildObj(true)); }} disabled={!letterDraft.trim()} style={{ padding: "10px 14px", background: letterDraft.trim() ? `${P.textFaint}20` : `${P.textFaint}10`, color: letterDraft.trim() ? P.textMuted : P.textFaint, border: `1px solid ${P.textFaint}30`, borderRadius: 12, cursor: letterDraft.trim() ? "pointer" : "default", fontSize: 10, fontFamily: "inherit", transition: "all .2s" }}>
            📝 Draft
          </button>
          <button onClick={onClose} style={{ padding: "10px 16px", background: "transparent", border: `1px solid ${P.textFaint}30`, borderRadius: 12, cursor: "pointer", fontSize: 11, fontFamily: "inherit", color: P.textMuted, transition: "all .2s" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function LoveLetterOverlay({ showLetterId, editLetter, letters, config, userId, letterEditId, initialDraft, initialCity, initialLat, initialLng, onCloseLetter, onCloseEdit, onEditLetter, onSendLetter, onRemoveLetter, onSaveLetter, onSaveDraft }) {
  return (
    <>
      {showLetterId && (() => {
        const letter = (letters || []).find(l => l.id === showLetterId);
        if (!letter) return null;
        return <LetterViewModal letter={letter} userId={userId} config={config} onClose={onCloseLetter} onEdit={onEditLetter} onSend={onSendLetter} onRemove={onRemoveLetter} />;
      })()}
      {editLetter && (
        <LetterEditModal
          letterEditId={letterEditId}
          initialDraft={initialDraft}
          initialCity={initialCity}
          initialLat={initialLat}
          initialLng={initialLng}
          config={config}
          onClose={onCloseEdit}
          onSave={onSaveLetter}
          onSaveDraft={onSaveDraft}
        />
      )}
    </>
  );
}
