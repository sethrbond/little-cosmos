import { useState } from "react";
import { MY_WORLD_TYPES, OUR_WORLD_TYPES, FRIENDS_TYPES, FAMILY_TYPES } from "./worldConfigs.js";

/* EntryTemplates.jsx — Save & reuse entry templates per world type
 * Templates store the "shape" of an entry (type, country, highlights, etc.)
 * but not dates, cities, or photos. Persisted in localStorage.
 */

const MAX_TEMPLATES = 20;
const STORAGE_KEY = (wt) => `cosmos_templates_${wt || "my"}`;

const TYPES_MAP = { my: MY_WORLD_TYPES, partner: OUR_WORLD_TYPES, friends: FRIENDS_TYPES, family: FAMILY_TYPES };

const STARTERS = [
  { name: "Beach Vacation", type: "beach", country: "", highlights: ["Swimming", "Sunset watching", "Seafood"], museums: [], restaurants: [], notes: "" },
  { name: "City Explorer", type: "city", country: "", highlights: ["Museums", "Local food", "Walking tour"], museums: [], restaurants: [], notes: "" },
  { name: "Road Trip", type: "road-trip", country: "", highlights: ["Scenic drives", "Roadside stops", "New towns"], museums: [], restaurants: [], notes: "" },
];

// Resolve type key to best match for current world
function resolveType(t, worldType) {
  const types = TYPES_MAP[worldType] || MY_WORLD_TYPES;
  if (types[t]) return t;
  if (t === "beach" && types["together"]) return "together";
  if (t === "city" && types["adventure"]) return "adventure";
  return Object.keys(types)[0];
}

export function loadTemplates(worldType) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(worldType));
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) return arr; }
  } catch { /* ignore */ }
  return STARTERS.map((s) => ({ ...s, type: resolveType(s.type, worldType), createdAt: new Date().toISOString() }));
}

export function saveTemplate(worldType, template) {
  const list = loadTemplates(worldType).filter((t) => t.name !== template.name);
  list.unshift({ ...template, createdAt: new Date().toISOString() });
  localStorage.setItem(STORAGE_KEY(worldType), JSON.stringify(list.slice(0, MAX_TEMPLATES)));
}

function deleteTemplate(worldType, name) {
  const list = loadTemplates(worldType).filter((t) => t.name !== name);
  localStorage.setItem(STORAGE_KEY(worldType), JSON.stringify(list));
  return list;
}

export function EntryTemplates({ palette, worldType, onApplyTemplate, onClose, entryData }) {
  const P = palette || {};
  const types = TYPES_MAP[worldType] || MY_WORLD_TYPES;
  const [templates, setTemplates] = useState(() => loadTemplates(worldType));
  const [mode, setMode] = useState(entryData ? "save" : "browse");
  const [name, setName] = useState("");

  const accent = P.rose || "#c9a96e";
  const bg = P.card || "rgba(26,26,46,0.97)";
  const text = P.text || "#e8e0d0";
  const muted = P.textMuted || "#888";
  const faint = P.textFaint || "#555";

  const overlay = { position: "fixed", inset: 0, zIndex: 310, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" };
  const panel = { background: bg, borderRadius: 16, padding: "24px 28px", maxWidth: 400, width: "90vw", maxHeight: "70vh", overflowY: "auto", border: `1px solid ${accent}20`, boxShadow: `0 8px 32px rgba(0,0,0,0.4)` };
  const btnBase = { padding: "6px 14px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: "inherit", border: "none", transition: "opacity .15s" };

  const handleSave = () => {
    if (!name.trim() || !entryData) return;
    const tpl = {
      name: name.trim(),
      type: entryData.type || Object.keys(types)[0],
      country: entryData.country || "",
      highlights: entryData.highlights || [],
      museums: entryData.museums || [],
      restaurants: entryData.restaurants || [],
      notes: entryData.notes || "",
    };
    saveTemplate(worldType, tpl);
    setTemplates(loadTemplates(worldType));
    setMode("browse");
    setName("");
  };

  const handleDelete = (tplName) => {
    const updated = deleteTemplate(worldType, tplName);
    setTemplates(updated.length ? updated : STARTERS.map((s) => ({ ...s, type: resolveType(s.type, worldType), createdAt: new Date().toISOString() })));
  };

  const handleApply = (tpl) => {
    onApplyTemplate({ type: tpl.type, country: tpl.country, highlights: [...(tpl.highlights || [])], museums: [...(tpl.museums || [])], restaurants: [...(tpl.restaurants || [])], notes: tpl.notes || "" });
    onClose();
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: text }}>Entry Templates</div>
          <button onClick={onClose} style={{ ...btnBase, background: "transparent", color: muted, fontSize: 16, padding: 4 }} aria-label="Close">&times;</button>
        </div>

        {entryData && (
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {["browse", "save"].map((m) => (
              <button key={m} onClick={() => setMode(m)} style={{ ...btnBase, background: mode === m ? `${accent}30` : "transparent", color: mode === m ? accent : muted, border: `1px solid ${mode === m ? accent + "40" : faint + "30"}` }}>
                {m === "browse" ? "Browse" : "Save Current"}
              </button>
            ))}
          </div>
        )}

        {mode === "save" && entryData && (
          <div style={{ marginBottom: 12 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name..." maxLength={40} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${faint}40`, background: `${accent}08`, color: text, fontSize: 12, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} onKeyDown={(e) => e.key === "Enter" && handleSave()} />
            <button onClick={handleSave} disabled={!name.trim()} style={{ ...btnBase, marginTop: 8, background: name.trim() ? accent : faint, color: "#fff", opacity: name.trim() ? 1 : 0.4 }}>
              Save Template
            </button>
          </div>
        )}

        {mode === "browse" && (
          templates.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: muted, fontSize: 12 }}>No templates yet. Save one from an entry form.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {templates.map((tpl) => {
                const typeInfo = types[tpl.type] || { icon: "\u{1F4CD}", label: tpl.type };
                return (
                  <div key={tpl.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: `${accent}08`, border: `1px solid ${accent}15`, cursor: "pointer", transition: "background .15s" }} onClick={() => handleApply(tpl)} onMouseEnter={(e) => (e.currentTarget.style.background = `${accent}18`)} onMouseLeave={(e) => (e.currentTarget.style.background = `${accent}08`)}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{typeInfo.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tpl.name}</div>
                      <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>
                        {typeInfo.label}{tpl.country ? ` \u00b7 ${tpl.country}` : ""}{tpl.highlights?.length ? ` \u00b7 ${tpl.highlights.length} highlight${tpl.highlights.length > 1 ? "s" : ""}` : ""}
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(tpl.name); }} style={{ ...btnBase, background: "transparent", color: faint, fontSize: 14, padding: "2px 6px" }} aria-label={`Delete ${tpl.name}`}>&times;</button>
                  </div>
                );
              })}
            </div>
          )
        )}

        {mode === "browse" && templates.length >= MAX_TEMPLATES && (
          <div style={{ fontSize: 10, color: faint, marginTop: 8, textAlign: "center" }}>Maximum {MAX_TEMPLATES} templates reached. Delete one to add more.</div>
        )}
      </div>
    </div>
  );
}
