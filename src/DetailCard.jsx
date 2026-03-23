import { useState, useEffect, useRef, useCallback } from "react";
import { getP } from "./cosmosGetP.js";
import { imageNavBtn, renderList } from "./formUtils.jsx";
import { thumbnail, compressImage } from "./imageUtils.js";

/* =================================================================
   Detail Card — entry detail overlay extracted from OurWorld
   Shows photo carousel, tabs (overview/highlights/places/photos),
   entry info, love notes, reactions/comments, edit/duplicate/delete
   ================================================================= */

import { fmtDate, daysBetween } from "./geodata.js";

export default function DetailCard({
  entry: cur,
  data,
  dispatch,
  db,
  // world type flags
  isMyWorld,
  isPartnerWorld,
  isSharedWorld,
  isViewer,
  worldId,
  userId,
  // world data
  TYPES,
  DEFAULT_TYPE,
  FIELD_LABELS,
  sorted,
  firstBadges,
  togetherIndex,
  entryStickers,
  handwrittenMode,
  // shared world features
  memberNameMap,
  worldReactions,
  setWorldReactions,
  entryComments,
  setEntryComments,
  userDisplayName,
  // share entry
  shareWorlds,
  setShareWorlds,
  // layout
  isMobile,
  isLandscape,
  // callbacks
  flyTo,
  showToast,
  onClose,
  onEdit,
  onSelectEntry,
  onDuplicate,
  onTripCard,
  // photo upload
  handlePhotos,
  uploadLockRef,
  setUploading,
  setUploadProgress,
  // link picker
  showLinkPicker,
  setShowLinkPicker,
  linkedEntryId,
  setLinkedEntryId,
  // lightbox
  setLightboxOpen,
  setLightboxIdx,
  // slider
  setSliderDate,
  // reactions/comments API
  loadAllWorldReactions,
  toggleReaction,
  loadComments,
  addComment,
  deleteComment,
  // share API
  loadMyWorlds,
  shareEntryToWorld,
  getPersonalWorldId,
  // music
  musicRef,
}) {
  const P = getP();

  // ---- Photo/card state (owned by DetailCard) ----
  const [photoIdx, setPhotoIdx] = useState(0);
  const [cardTab, setCardTab] = useState("overview");
  const [cardGallery, setCardGallery] = useState(false);
  const [photoDeleteMode, setPhotoDeleteMode] = useState(false);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState(-1);
  const [polaroidMode, setPolaroidMode] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);
  const [shareMenu, setShareMenu] = useState(null);
  const [commentText, setCommentText] = useState("");
  const photoDragRef = useRef({ from: -1, to: -1 });

  // Reset state when entry changes
  const prevEntryId = useRef(cur?.id);
  useEffect(() => {
    if (cur?.id !== prevEntryId.current) {
      prevEntryId.current = cur?.id;
      setPhotoIdx(0);
      setCardTab("overview");
      setCardGallery(false);
      setPhotoDeleteMode(false);
      setShareMenu(null);
      setCommentText("");
    }
  }, [cur?.id]);

  // Photo slideshow auto-advance
  const photoLenRef = useRef(0);
  useEffect(() => {
    if (!cur) { photoLenRef.current = 0; return; }
    const len = (cur.photos || []).length;
    photoLenRef.current = len;
    if (len > 0 && photoIdx >= len) setPhotoIdx(len - 1);
    if (len < 2) return;
    const iv = setInterval(() => setPhotoIdx(i => (i + 1) % (photoLenRef.current || 1)), 4000);
    return () => clearInterval(iv);
  }, [cur?.id, cur?.photos?.length]);

  const toggleFavorite = useCallback((id, currentFavorite) => {
    dispatch({ type: "UPDATE", id, data: { favorite: !currentFavorite } });
    if (!currentFavorite) { setHeartBurst(true); setTimeout(() => setHeartBurst(false), 700); }
  }, [dispatch]);

  if (!cur) return null;

  return (
    <div style={isMobile && !isLandscape
      ? { position: "absolute", bottom: 105, left: 0, right: 0, zIndex: 25, background: P.card, backdropFilter: "blur(24px)", borderRadius: "18px 18px 0 0", maxHeight: "55vh", boxShadow: "0 -2px 8px rgba(61,53,82,.04), 0 -8px 32px rgba(61,53,82,.08)", border: `1px solid ${P.rose}08`, animation: "fadeIn .3s ease", overflow: "hidden", display: "flex", flexDirection: "column" }
      : isMobile && isLandscape
      ? { position: "absolute", top: "env(safe-area-inset-top, 8px)", right: "env(safe-area-inset-right, 8px)", bottom: "env(safe-area-inset-bottom, 8px)", width: 300, zIndex: 25, background: P.card, backdropFilter: "blur(24px)", borderRadius: 18, boxShadow: "0 1px 3px rgba(61,53,82,.04), 0 8px 24px rgba(61,53,82,.06), 0 20px 60px rgba(61,53,82,.08)", border: `1px solid ${P.rose}08`, animation: "cardIn .3s ease", overflow: "hidden", display: "flex", flexDirection: "column" }
      : { position: "absolute", top: "42%", right: 18, transform: "translateY(-50%)", zIndex: 25, background: P.card, backdropFilter: "blur(24px)", borderRadius: 18, maxWidth: 350, minWidth: 270, maxHeight: "65vh", boxShadow: "0 1px 3px rgba(61,53,82,.04), 0 8px 24px rgba(61,53,82,.06), 0 20px 60px rgba(61,53,82,.08)", border: `1px solid ${P.rose}08`, animation: "cardIn .5s ease", overflow: "hidden", display: "flex", flexDirection: "column" }
    }>
      {(cur.photos || []).length > 0 && !cardGallery && (
        <div
          onDragOver={!isViewer ? e => { e.preventDefault(); setDragOver(true); } : undefined}
          onDragLeave={!isViewer ? () => setDragOver(false) : undefined}
          onDrop={!isViewer ? e => {
            e.preventDefault(); setDragOver(false);
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
            if (files.length === 0) return;
            const cid = cur.id;
            uploadLockRef.current = uploadLockRef.current.then(async () => {
              setUploading(true);
              setUploadProgress({ done: 0, total: files.length });
              const urls = [];
              for (let fi = 0; fi < files.length; fi++) { try { const compressed = await compressImage(files[fi]); const url = await db.uploadPhoto(compressed, cid); if (url && typeof url === 'string') urls.push(url); } catch (err) { /* skip */ } setUploadProgress({ done: fi + 1, total: files.length }); }
              if (urls.length > 0) {
                const current = await db.readPhotos(cid);
                const merged = [...(current.ok ? current.photos : []), ...urls];
                const result = await db.savePhotos(cid, merged);
                dispatch({ type: "ADD_PHOTOS", id: cid, urls });
                if (result.ok) showToast(`${urls.length} photo${urls.length > 1 ? "s" : ""} added (${merged.length} total)`, "\u2705", 3000);
                else showToast("Couldn't save photos — try again in a moment", "\u26a0\ufe0f", 5000);
              }
              setUploading(false);
            }).catch(err => { console.error('[dragDrop] queue error:', err); setUploading(false); });
          } : undefined}
          style={{ position: "relative", width: "100%", background: P.parchment, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 120, maxHeight: 220, ...(dragOver ? { outline: `2px dashed ${P.sky}`, outlineOffset: -2 } : {}) }}>
          <img loading="lazy" src={cur.photos[photoIdx % cur.photos.length]} alt={`Photo from ${cur.city || "trip"}`} onClick={() => { setLightboxIdx(photoIdx % cur.photos.length); setLightboxOpen(true); }} style={{ maxWidth: "100%", maxHeight: 220, objectFit: "contain", display: "block", transition: "all .3s", cursor: "zoom-in", ...(polaroidMode ? { border: "6px solid #fff", borderBottom: "28px solid #fff", boxShadow: "0 4px 16px rgba(0,0,0,.15)", borderRadius: 1, transform: `rotate(${(photoIdx % 3 - 1) * 1.5}deg)` } : {}) }} />
          {cur.photos.length > 1 && (<><button aria-label="Previous photo" onClick={() => setPhotoIdx(i => (i - 1 + cur.photos.length) % cur.photos.length)} style={imageNavBtn("left")}>{"\u2039"}</button><button aria-label="Next photo" onClick={() => setPhotoIdx(i => (i + 1) % cur.photos.length)} style={imageNavBtn("right")}>{"\u203a"}</button>
            <div style={{ position: "absolute", bottom: 6, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 4, alignItems: "center" }}>{cur.photos.slice(0, 12).map((_, i) => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === photoIdx % cur.photos.length ? "#fff" : "rgba(255,255,255,.35)", transition: "background .2s" }} />)}{cur.photos.length > 12 && <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)", marginLeft: 2 }}>+{cur.photos.length - 12}</div>}</div></>)}
          <button onClick={() => setCardGallery(true)} style={{ position: "absolute", top: 6, right: 6, background: "rgba(255,255,255,.85)", border: "none", borderRadius: 5, padding: "2px 8px", fontSize: 9, cursor: "pointer", fontFamily: "inherit", color: P.textMid }}>{"\ud83d\udcf8"} {cur.photos.length}</button>
          <button onClick={() => setPolaroidMode(v => !v)} style={{ position: "absolute", bottom: 6, right: 6, background: polaroidMode ? P.goldWarm : "rgba(255,255,255,.7)", border: "none", borderRadius: 5, padding: "2px 7px", fontSize: 10, cursor: "pointer", fontFamily: "inherit", color: polaroidMode ? "#fff" : P.textFaint }} title="Polaroid mode">{"\ud83d\udcf8"}</button>
          {polaroidMode && cur.photos.length >= 3 && (
            <div style={{ position: "absolute", top: -28, left: 8, right: 8, height: 28, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
              {cur.photos.slice(0, 5).map((url, i) => {
                const rot = (i - 2) * 8 + (i % 2 ? 3 : -3);
                const off = (i - 2) * 24;
                return <img key={i} src={thumbnail(url, 64)} alt="" style={{ width: 32, height: 32, objectFit: "cover", border: "2px solid #fff", borderRadius: 1, boxShadow: "0 1px 4px rgba(0,0,0,.2)", position: "absolute", left: `calc(50% + ${off}px - 16px)`, transform: `rotate(${rot}deg)`, zIndex: i }} />;
              })}
            </div>
          )}
          {<button onClick={() => handlePhotos(cur.id)} style={{ position: "absolute", top: 6, left: 6, background: "rgba(255,255,255,.85)", border: "none", borderRadius: 5, padding: "2px 8px", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>+ {"\ud83d\udcf8"}</button>}
          {polaroidMode && (cur.photoCaptions || {})[cur.photos[photoIdx % cur.photos.length]] && (
            <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "rgba(80,60,40,.6)", fontStyle: "italic", fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", whiteSpace: "nowrap", maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", pointerEvents: "none", background: "rgba(255,255,255,.85)", padding: "1px 8px", borderRadius: 3 }}>
              {(cur.photoCaptions || {})[cur.photos[photoIdx % cur.photos.length]]}
            </div>
          )}
        </div>
      )}
      {(cur.photos || []).length > 0 && cardGallery && (
        <div style={{ flexShrink: 0, maxHeight: 280, overflowY: "auto", background: P.parchment, padding: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, padding: "0 4px" }}>
            <span style={{ fontSize: 9, color: P.textMid, letterSpacing: ".1em" }}>{"\ud83d\udcf8"} {cur.photos.length} photos</span>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {<button onClick={() => { setPhotoDeleteMode(v => !v); setConfirmDeleteIdx(-1); }} style={{ background: photoDeleteMode ? "#c07070" : "none", border: `1px solid ${photoDeleteMode ? "#c07070" : P.textFaint}40`, borderRadius: 4, padding: "1px 6px", fontSize: 10, cursor: "pointer", color: photoDeleteMode ? "#fff" : P.textFaint, fontFamily: "inherit" }}>{photoDeleteMode ? "Done" : "\ud83d\uddd1"}</button>}
              <button aria-label="Close photo grid" onClick={() => { setCardGallery(false); setPhotoDeleteMode(false); }} style={{ background: "none", border: "none", fontSize: 12, color: P.textFaint, cursor: "pointer" }}>{"\u00d7"}</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 4 }}>
            {cur.photos.map((url, i) => (
              <div key={i} style={{ position: "relative" }}
                draggable={!photoDeleteMode && !isViewer}
                onDragStart={e => { photoDragRef.current.from = i; e.dataTransfer.effectAllowed = "move"; e.currentTarget.style.opacity = "0.4"; }}
                onDragEnd={e => { e.currentTarget.style.opacity = "1"; }}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                onDrop={e => {
                  e.preventDefault();
                  const from = photoDragRef.current.from;
                  if (from === i || from < 0) return;
                  const reordered = [...cur.photos];
                  const [moved] = reordered.splice(from, 1);
                  reordered.splice(i, 0, moved);
                  dispatch({ type: "UPDATE", id: cur.id, data: { photos: reordered } });
                  db.savePhotos(cur.id, reordered);
                  showToast("Photos reordered", "\u2195\ufe0f", 1500);
                  photoDragRef.current.from = -1;
                }}>
                <button onClick={() => { if (photoDeleteMode) { setConfirmDeleteIdx(confirmDeleteIdx === i ? -1 : i); } else { setPhotoIdx(i); setCardGallery(false); setPhotoDeleteMode(false); } }} style={{ padding: 0, border: photoIdx === i ? `2px solid ${P.rose}` : "2px solid transparent", background: P.blush, cursor: photoDeleteMode ? "pointer" : "grab", borderRadius: 6, overflow: "hidden", aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", opacity: photoDeleteMode ? 0.7 : 1 }}>
                  <img loading="lazy" src={url} alt="Travel photo" draggable={false} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 4 }} />
                </button>
                {photoDeleteMode && confirmDeleteIdx !== i && <div style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "#c9777a", color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>{"\u00d7"}</div>}
                {confirmDeleteIdx === i && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <div style={{ fontSize: 9, color: "#fff", marginBottom: 2 }}>Delete?</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={e => { e.stopPropagation(); dispatch({ type: "REMOVE_PHOTO", id: cur.id, photoIndex: i }); setPhotoIdx(pi => pi >= i && pi > 0 ? pi - 1 : pi); setConfirmDeleteIdx(-1); showToast("Photo removed", "\ud83d\uddd1", 2000); }} style={{ padding: "2px 10px", background: "#c9777a", border: "none", borderRadius: 4, fontSize: 9, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>Yes</button>
                    <button onClick={e => { e.stopPropagation(); setConfirmDeleteIdx(-1); }} style={{ padding: "2px 10px", background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 4, fontSize: 9, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>No</button>
                  </div>
                </div>}
              </div>
            ))}
          </div>
          {!isViewer && <button onClick={() => handlePhotos(cur.id)} style={{ marginTop: 6, width: "100%", padding: "5px", background: `linear-gradient(135deg,${P.parchment},${P.blush})`, border: "none", borderRadius: 5, cursor: "pointer", fontSize: 9, color: P.textMuted, fontFamily: "inherit" }}>+ Add More Photos</button>}
        </div>
      )}
      {!isViewer && (cur.photos || []).length === 0 && <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault(); setDragOver(false);
          const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
          if (files.length === 0) return;
          const cid = cur.id;
          uploadLockRef.current = uploadLockRef.current.then(async () => {
            setUploading(true);
            setUploadProgress({ done: 0, total: files.length });
            const urls = [];
            for (let fi = 0; fi < files.length; fi++) { try { const compressed = await compressImage(files[fi]); const url = await db.uploadPhoto(compressed, cid); if (url && typeof url === 'string') urls.push(url); } catch (err) { /* skip failed */ } setUploadProgress({ done: fi + 1, total: files.length }); }
            if (urls.length > 0) {
              const current = await db.readPhotos(cid);
              const merged = [...(current.ok ? current.photos : []), ...urls];
              const result = await db.savePhotos(cid, merged);
              dispatch({ type: "ADD_PHOTOS", id: cid, urls });
              if (result.ok) showToast(`${urls.length} photo${urls.length > 1 ? "s" : ""} saved (${merged.length} total)`, "\u2705", 3000);
              else showToast("Couldn't save photos — try again in a moment", "\u26a0\ufe0f", 5000);
            }
            setUploading(false);
          }).catch(err => { console.error('[dragDrop] queue error:', err); setUploading(false); });
        }}
        onClick={() => handlePhotos(cur.id)}
        style={{ width: "100%", height: 70, background: dragOver ? `linear-gradient(135deg,${P.sky}18,${P.rose}18)` : `linear-gradient(135deg,${P.parchment},${P.blush})`, border: dragOver ? `2px dashed ${P.sky}` : "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: P.textMuted, fontSize: 10, fontFamily: "inherit", flexShrink: 0, transition: "all .2s" }}>
        {dragOver ? "\ud83c\udfaf Drop photos here" : "\ud83d\udcf8 Drop photos or tap to browse"}
      </div>}

      <div style={{ padding: "14px 18px 18px", overflowY: "auto", flex: 1 }}>
        <div style={{ float: "right", display: "flex", gap: 2, marginTop: -4, position: "relative" }}>
          {/* Share to another world */}
          <button onClick={async () => {
            if (shareMenu === cur.id) { setShareMenu(null); return; }
            setShareMenu(cur.id);
            if (!shareWorlds) {
              const [w, pid] = await Promise.all([loadMyWorlds(userId), getPersonalWorldId(userId)]);
              const all = pid ? [{ id: pid, name: "My World", type: "personal" }, ...w] : w;
              setShareWorlds(all);
            }
          }} style={{ background: "none", border: "none", fontSize: 12, cursor: "pointer", color: shareMenu === cur.id ? P.sky : P.textFaint, transition: "color .2s" }} title="Share to another world">{"\u2197"}</button>
          {shareMenu === cur.id && shareWorlds && (
            <div style={{ position: "absolute", top: 24, right: isMobile ? "auto" : 0, left: isMobile ? 0 : "auto", background: P.parchment, border: `1px solid ${P.rose}20`, borderRadius: 8, padding: 6, zIndex: 20, minWidth: 160, maxWidth: "70vw", boxShadow: "0 4px 16px rgba(0,0,0,.15)", animation: "fadeIn .15s ease" }}>
              <div style={{ fontSize: 10, color: P.textFaint, letterSpacing: ".1em", textTransform: "uppercase", padding: "2px 6px 4px", borderBottom: `1px solid ${P.rose}10`, marginBottom: 4 }}>Share to world</div>
              {shareWorlds.filter(w => w.id !== worldId && w.id !== cur.worldId).length === 0
                ? <div style={{ fontSize: 9, color: P.textMuted, padding: "6px" }}>No other worlds</div>
                : shareWorlds.filter(w => w.id !== worldId && w.id !== cur.worldId).map(w => (
                <button key={w.id} onClick={async () => {
                  setShareMenu(null);
                  const result = await shareEntryToWorld(cur, w.id, userId);
                  if (result.ok) showToast(`Shared to ${w.name}`, "\u2197", 3000);
                  else showToast("Couldn't share this memory — try again", "\u26a0\ufe0f", 5000);
                }} style={{ display: "block", width: "100%", padding: "5px 8px", border: "none", background: "none", cursor: "pointer", fontSize: 10, fontFamily: "inherit", color: P.text, textAlign: "left", borderRadius: 4, transition: "background .15s" }}
                  onMouseEnter={e => e.target.style.background = `${P.sky}12`}
                  onMouseLeave={e => e.target.style.background = "none"}>
                  {({ personal: "\ud83c\udf0e", partner: "\ud83d\udc95", friends: "\ud83d\udc65", family: "\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66" }[w.type] || "\ud83c\udf0d")} {w.name}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => onTripCard(cur)} style={{ background: "none", border: "none", fontSize: 12, cursor: "pointer", color: P.textFaint, transition: "color .2s" }} title="Save Trip Card">{"\ud83c\udfb4"}</button>
          <div style={{ position: "relative", display: "inline-block" }}>
            <button onClick={() => toggleFavorite(cur.id, cur.favorite)} style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: cur.favorite ? P.heart : P.textFaint, transition: "all .2s", transform: heartBurst ? "scale(1.3)" : "scale(1)" }} title={cur.favorite ? "Unfavorite" : "Favorite"}>
              {cur.favorite ? "\u2665" : "\u2661"}
            </button>
            {heartBurst && [0,1,2,3,4].map(i => (
              <span key={i} style={{ position: "absolute", left: "50%", top: "50%", fontSize: 10, pointerEvents: "none", color: P.heart, animation: `heartFloat${i} .7s ease-out forwards`, opacity: 0 }}>{"\u2665"}</span>
            ))}
          </div>
          <button aria-label="Close detail card" onClick={onClose} style={{ background: "none", border: "none", fontSize: 16, color: P.textFaint, cursor: "pointer", marginLeft: 2 }}>{"\u00d7"}</button>
        </div>

        {firstBadges[cur.id] && <div style={{ fontSize: 10, color: P.gold, letterSpacing: ".12em", marginBottom: 4 }}>{"\ud83c\udfc5"} {firstBadges[cur.id]}</div>}
        {isPartnerWorld && togetherIndex(cur.id) && <div style={{ fontSize: 10, color: P.textFaint, letterSpacing: ".1em", marginBottom: 4 }}>Trip #{togetherIndex(cur.id)}</div>}

        <div style={{ display: "inline-block", padding: "2px 7px", borderRadius: 14, fontSize: 10, letterSpacing: ".08em", color: (TYPES[cur.type] || DEFAULT_TYPE).color, border: `1px solid ${(TYPES[cur.type] || DEFAULT_TYPE).color}28`, marginBottom: 5 }}>
          {(TYPES[cur.type] || DEFAULT_TYPE).icon} {(TYPES[cur.type] || DEFAULT_TYPE).label}
        </div>

        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 400, lineHeight: 1.2, fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif" }}>{cur.city}</h2>
        <p style={{ margin: "2px 0 0", fontSize: 10, color: P.textMuted, letterSpacing: ".04em" }}>{cur.country}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: P.textMid }}>{"\ud83d\udcc5"} {fmtDate(cur.dateStart)}{cur.dateEnd && cur.dateEnd !== cur.dateStart ? ` \u2192 ${fmtDate(cur.dateEnd)}` : ""}</span>
          {cur.dateEnd && cur.dateEnd !== cur.dateStart && (() => {
            const days = daysBetween(cur.dateStart, cur.dateEnd) + 1;
            return <span style={{ fontSize: 10, padding: "1px 6px", background: `${P.rose}10`, borderRadius: 8, color: P.textFaint, letterSpacing: ".04em" }}>{days} day{days !== 1 ? "s" : ""}</span>;
          })()}
        </div>
        {entryStickers.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
            {entryStickers.map((s, i) => (
              <span key={i} style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                padding: "2px 8px", borderRadius: 10,
                background: P.rose + "12", border: `1px solid ${P.rose}20`,
                fontSize: 9, color: P.textMuted, letterSpacing: ".04em",
                whiteSpace: "nowrap"
              }}>
                <span style={{ fontSize: 10 }}>{s.emoji}</span> {s.label}
              </span>
            ))}
          </div>
        )}
        {isSharedWorld && cur.addedBy && memberNameMap[cur.addedBy] && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: `linear-gradient(135deg, ${P.rose}40, ${P.sky}40)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: P.text, flexShrink: 0 }}>
              {memberNameMap[cur.addedBy].charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 9, color: P.textFaint, letterSpacing: ".04em" }}>Added by {memberNameMap[cur.addedBy]}</span>
          </div>
        )}

        {/* TAB BAR */}
        <div style={{ display: "flex", gap: 0, marginTop: 10, borderBottom: `1px solid ${P.rose}12` }}>
          {[
            { key: "overview", label: "Overview" },
            { key: "highlights", label: "Highlights" },
            { key: "places", label: isMyWorld ? "Details" : "Places" },
            { key: "photos", label: cur.photos?.length > 0 ? `\ud83d\udcf8 Scrapbook (${cur.photos.length})` : "\ud83d\udcf8 Scrapbook" },
          ].map(tab => (
            <button key={tab.key} onClick={() => setCardTab(tab.key)}
              style={{ flex: 1, padding: "10px 4px", border: "none", borderBottom: cardTab === tab.key ? `2px solid ${P.rose}` : "2px solid transparent", background: cardTab === tab.key ? `${P.rose}06` : "none", borderRadius: cardTab === tab.key ? "6px 6px 0 0" : 0, cursor: "pointer", fontSize: 10, fontFamily: "inherit", color: cardTab === tab.key ? P.text : P.textFaint, letterSpacing: ".06em", transition: "all .2s" }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        <div key={cardTab} style={{ marginTop: 10, animation: "fadeIn .2s ease" }}>
          {cardTab === "overview" && (<>
            {!isViewer ? (
              <div style={{ marginBottom: 10, position: "relative", ...(handwrittenMode ? { background: `repeating-linear-gradient(transparent, transparent 23px, ${P.textFaint}15 23px, ${P.textFaint}15 24px)`, padding: "4px 8px", borderRadius: 8 } : {}) }}>
                <textarea
                  placeholder="Write about this memory..."
                  value={cur.notes || ""}
                  onChange={e => dispatch({ type: "UPDATE", id: cur.id, data: { notes: e.target.value }, _skipSave: true })}
                  onBlur={e => { dispatch({ type: "UPDATE", id: cur.id, data: { notes: e.target.value } }); e.currentTarget.style.borderColor = e.target.value ? "transparent" : `${P.textFaint}20`; }}
                  rows={cur.notes ? Math.min(Math.ceil(cur.notes.length / 35), 6) : 2}
                  style={{ width: "100%", fontSize: handwrittenMode ? 14 : 12, lineHeight: handwrittenMode ? "24px" : 1.7, color: P.textMid, fontFamily: handwrittenMode ? "'Segoe Script','Bradley Hand','Comic Sans MS',cursive" : "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", fontStyle: "italic", background: "none", border: `1px solid ${cur.notes ? "transparent" : P.textFaint + "20"}`, borderRadius: 8, padding: "6px 8px", outline: "none", resize: "vertical", boxSizing: "border-box", transition: "border-color .2s" }}
                  onFocus={e => e.currentTarget.style.borderColor = `${P.rose}30`}
                />
              </div>
            ) : cur.notes ? (
              <div style={{ marginBottom: 10, ...(handwrittenMode ? { background: `repeating-linear-gradient(transparent, transparent 23px, ${P.textFaint}15 23px, ${P.textFaint}15 24px)`, padding: "4px 8px", borderRadius: 8 } : {}) }}>
                <p style={{ fontSize: handwrittenMode ? 14 : 12, lineHeight: handwrittenMode ? "24px" : 1.7, margin: 0, color: P.textMid, fontFamily: handwrittenMode ? "'Segoe Script','Bradley Hand','Comic Sans MS',cursive" : "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", fontStyle: "italic" }}>{cur.notes}</p>
              </div>
            ) : null}
            {(cur.stops || []).length > 0 && (<div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: P.textFaint, letterSpacing: ".16em", textTransform: "uppercase", marginBottom: 6 }}>Trip Route</div>
              {cur.stops.map((s, si) => (
                <div key={s.sid} style={{ display: "flex", gap: 8, marginBottom: 2 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 12, flexShrink: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: si === 0 ? P.rose : `${P.rose}60`, border: `2px solid ${P.rose}40`, flexShrink: 0 }} />
                    {si < cur.stops.length - 1 && <div style={{ width: 1, flex: 1, background: `${P.rose}25`, minHeight: 16 }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: P.text }}>{s.city}{s.country ? `, ${s.country}` : ""}</div>
                    {s.dateStart && <div style={{ fontSize: 9, color: P.textFaint, marginTop: 1 }}>{fmtDate(s.dateStart)}{s.dateEnd ? ` \u2192 ${fmtDate(s.dateEnd)}` : ""}</div>}
                    {s.notes && <p style={{ fontSize: 10, color: P.textMid, margin: "2px 0 0", fontStyle: "italic" }}>{s.notes}</p>}
                  </div>
                </div>
              ))}
            </div>)}
            {cur.musicUrl && <div style={{ marginTop: 8, padding: "6px 8px", background: `${P.lavender}0a`, borderRadius: 6 }}><div style={{ fontSize: 10, color: P.textFaint, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 3 }}>{isPartnerWorld ? "Our Song" : "Music"}</div><audio ref={musicRef} controls src={cur.musicUrl} style={{ width: "100%", height: 26 }} /></div>}
            {/* Love Note — partner worlds only */}
            {isPartnerWorld && <div style={{ marginTop: 10, padding: "10px 12px", background: `${P.heart}06`, borderRadius: 8, borderLeft: `2px solid ${P.heart}20` }}>
              <div style={{ fontSize: 10, color: P.textFaint, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 4 }}>{"\ud83d\udc8c"} Love Note</div>
              {cur.loveNote ? <p style={{ fontSize: 11, lineHeight: 1.6, color: P.textMid, margin: 0, fontStyle: "italic" }}>{cur.loveNote}</p>
              : !isViewer ? <input placeholder="Write a note about this memory..." onBlur={e => { if (e.target.value.trim()) dispatch({ type: "UPDATE", id: cur.id, data: { loveNote: e.target.value.trim() } }); }}
                  style={{ width: "100%", border: "none", background: "none", fontSize: 10, fontFamily: "inherit", color: P.textMid, fontStyle: "italic", outline: "none", padding: 0 }} />
              : <div style={{ fontSize: 9, color: P.textFaint, fontStyle: "italic" }}>No note yet</div>}
              {cur.loveNote && !isViewer && <button onClick={() => dispatch({ type: "UPDATE", id: cur.id, data: { loveNote: "" } })} style={{ marginTop: 4, background: "none", border: "none", fontSize: 10, color: P.textFaint, cursor: "pointer", padding: 0 }}>Clear</button>}
            </div>}
            {/* Entry Connections — linked related entries */}
            {(() => {
              const links = cur.linkedEntries || [];
              const linked = links.map(lid => data.entries.find(e => e.id === lid)).filter(Boolean);
              return (linked.length > 0 || !isViewer) ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, color: P.textFaint, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 4 }}>{"\ud83d\udd17"} Related Trips</div>
                  {linked.map(le => (
                    <button key={le.id} onClick={() => { onSelectEntry(le); flyTo(le.lat, le.lng, 2.5); }}
                      style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "5px 8px", marginBottom: 3, background: `${P.rose}06`, border: `1px solid ${P.rose}12`, borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "background .15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = `${P.rose}14`}
                      onMouseLeave={e => e.currentTarget.style.background = `${P.rose}06`}>
                      <span style={{ fontSize: 12 }}>{(TYPES[le.type] || DEFAULT_TYPE).icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{le.city}</div>
                        <div style={{ fontSize: 10, color: P.textFaint }}>{fmtDate(le.dateStart)}</div>
                      </div>
                      {!isViewer && <button onClick={e => { e.stopPropagation(); dispatch({ type: "UPDATE", id: cur.id, data: { linkedEntries: links.filter(l => l !== le.id) } }); }} style={{ background: "none", border: "none", color: P.textFaint, fontSize: 12, cursor: "pointer", padding: 0 }}>{"\u00d7"}</button>}
                    </button>
                  ))}
                  {!isViewer && !showLinkPicker && <button onClick={() => { setLinkedEntryId(cur.id); setShowLinkPicker(true); }} style={{ fontSize: 9, color: P.rose, background: "none", border: `1px dashed ${P.rose}30`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", width: "100%", marginTop: 2, transition: "all .2s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = P.rose + "60"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = P.rose + "30"}>+ Link a trip</button>}
                  {showLinkPicker && linkedEntryId === cur.id && (
                    <div style={{ marginTop: 4, maxHeight: 120, overflowY: "auto", border: `1px solid ${P.textFaint}20`, borderRadius: 8, background: P.card }}>
                      {data.entries.filter(e => e.id !== cur.id && !links.includes(e.id)).slice(0, 20).map(e => (
                        <button key={e.id} onClick={() => { dispatch({ type: "UPDATE", id: cur.id, data: { linkedEntries: [...links, e.id] } }); setShowLinkPicker(false); setLinkedEntryId(null); showToast(`Linked to ${e.city}`, "\ud83d\udd17", 2000); }}
                          style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "5px 8px", background: "none", border: "none", borderBottom: `1px solid ${P.textFaint}10`, cursor: "pointer", fontFamily: "inherit", textAlign: "left", fontSize: 10, color: P.text, transition: "background .15s" }}
                          onMouseEnter={e => e.currentTarget.style.background = `${P.rose}08`}
                          onMouseLeave={e => e.currentTarget.style.background = "none"}>
                          <span style={{ fontSize: 11 }}>{(TYPES[e.type] || DEFAULT_TYPE).icon}</span>
                          <span>{e.city}</span>
                          <span style={{ fontSize: 10, color: P.textFaint, marginLeft: "auto" }}>{fmtDate(e.dateStart)}</span>
                        </button>
                      ))}
                      <button onClick={() => setShowLinkPicker(false)} style={{ width: "100%", padding: "4px", background: "none", border: "none", fontSize: 9, color: P.textFaint, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    </div>
                  )}
                </div>
              ) : null;
            })()}
            {/* Empty overview nudge */}
            {isViewer && !cur.notes && !(cur.stops || []).length && !cur.musicUrl && !(isPartnerWorld && cur.loveNote) && (
              <div style={{ textAlign: "center", padding: "20px 12px" }}>
                <div style={{ fontSize: 11, color: P.textFaint, fontStyle: "italic", fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif" }}>No details added yet.</div>
              </div>
            )}
          </>)}

          {cardTab === "highlights" && (<>
            {(cur.memories?.length > 0) && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: ".06em", color: P.textFaint, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 12, opacity: 0.6 }}>{"\ud83d\udcad"}</span> Memories
                </div>
                {cur.memories.map((mem, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 10px", marginBottom: 4, background: `${P.rose || P.accent}06`, borderRadius: 10, borderLeft: `2px solid ${P.rose || P.accent}25` }}>
                    <span style={{ fontSize: 10, opacity: 0.5, marginTop: 1 }}>{"\u2726"}</span>
                    <span style={{ flex: 1, fontSize: 11, lineHeight: 1.6, color: P.textMid, fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", fontStyle: "italic" }}>{mem}</span>
                    {!isViewer && (
                      <button onClick={() => {
                        const updated = [...cur.memories]; updated.splice(i, 1);
                        dispatch({ type: "UPDATE", id: cur.id, data: { memories: updated } });
                      }} style={{ background: "none", border: "none", color: P.textFaint, cursor: "pointer", fontSize: 10, padding: "0 2px", opacity: 0.4 }}>{"\u00d7"}</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {renderList(FIELD_LABELS.highlights.label, cur.highlights, FIELD_LABELS.highlights.icon, P.gold, !isViewer ? (i) => {
              const updated = [...(cur.highlights || [])]; updated.splice(i, 1);
              dispatch({ type: "UPDATE", id: cur.id, data: { highlights: updated } });
            } : null)}
            {!isViewer && (
              <div style={{ marginTop: (cur.highlights?.length) ? 8 : 0 }}>
                {!(cur.highlights?.length) && !(cur.memories?.length) && <div style={{ textAlign: "center", padding: "20px 12px 12px" }}>
                  <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>{"\u2728"}</div>
                  <div style={{ fontSize: 11, color: P.textFaint, lineHeight: 1.7, fontStyle: "italic", fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif" }}>What made this trip special?<br/>The little moments worth holding onto.</div>
                </div>}
                <input
                  type="text"
                  placeholder="+ Add a highlight..."
                  onKeyDown={e => {
                    if (e.key === "Enter" && e.target.value.trim()) {
                      const newHighlights = [...(cur.highlights || []), e.target.value.trim()];
                      dispatch({ type: "UPDATE", id: cur.id, data: { highlights: newHighlights } });
                      e.target.value = "";
                    }
                  }}
                  style={{ width: "100%", padding: "8px 10px", fontSize: 11, fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", fontStyle: "italic", color: P.textMid, background: `${P.gold}06`, border: `1px solid ${P.gold}15`, borderRadius: 8, outline: "none", boxSizing: "border-box", transition: "border-color .2s" }}
                  onFocus={e => e.currentTarget.style.borderColor = `${P.gold}35`}
                  onBlur={e => e.currentTarget.style.borderColor = `${P.gold}15`}
                />
              </div>
            )}
            {isViewer && !(cur.highlights?.length) && !(cur.memories?.length) && <div style={{ textAlign: "center", padding: "28px 16px" }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>{"\u2728"}</div>
              <div style={{ fontSize: 11, color: P.textFaint, lineHeight: 1.7, fontStyle: "italic", fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif" }}>No highlights added yet.</div>
            </div>}
          </>)}

          {cardTab === "places" && (<>
            {renderList(FIELD_LABELS.museums.label, cur.museums, FIELD_LABELS.museums.icon, P.sky, !isViewer ? (i) => {
              const updated = [...(cur.museums || [])]; updated.splice(i, 1);
              dispatch({ type: "UPDATE", id: cur.id, data: { museums: updated } });
            } : null)}
            {renderList(FIELD_LABELS.restaurants.label, cur.restaurants, FIELD_LABELS.restaurants.icon, P.roseSoft, !isViewer ? (i) => {
              const updated = [...(cur.restaurants || [])]; updated.splice(i, 1);
              dispatch({ type: "UPDATE", id: cur.id, data: { restaurants: updated } });
            } : null)}
            {!isViewer ? (<>
              {!(cur.museums?.length) && !(cur.restaurants?.length) && <div style={{ textAlign: "center", padding: "20px 12px 12px" }}>
                <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>{isMyWorld ? "\ud83d\udcdd" : "\ud83d\udccd"}</div>
                <div style={{ fontSize: 11, color: P.textFaint, lineHeight: 1.7, fontStyle: "italic", fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif" }}>{isMyWorld ? "The restaurants, the sights, the hidden gems." : "The places you explored together."}</div>
              </div>}
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input type="text" placeholder={`+ ${FIELD_LABELS.museums?.label || "Sights"}...`}
                  onKeyDown={e => { if (e.key === "Enter" && e.target.value.trim()) { dispatch({ type: "UPDATE", id: cur.id, data: { museums: [...(cur.museums || []), e.target.value.trim()] } }); e.target.value = ""; }}}
                  style={{ flex: 1, padding: "7px 10px", fontSize: 10, fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", color: P.textMid, background: `${P.sky}06`, border: `1px solid ${P.sky}15`, borderRadius: 8, outline: "none", boxSizing: "border-box" }}
                  onFocus={e => e.currentTarget.style.borderColor = `${P.sky}35`}
                  onBlur={e => e.currentTarget.style.borderColor = `${P.sky}15`} />
                <input type="text" placeholder={`+ ${FIELD_LABELS.restaurants?.label || "Food"}...`}
                  onKeyDown={e => { if (e.key === "Enter" && e.target.value.trim()) { dispatch({ type: "UPDATE", id: cur.id, data: { restaurants: [...(cur.restaurants || []), e.target.value.trim()] } }); e.target.value = ""; }}}
                  style={{ flex: 1, padding: "7px 10px", fontSize: 10, fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", color: P.textMid, background: `${P.roseSoft}06`, border: `1px solid ${P.roseSoft}15`, borderRadius: 8, outline: "none", boxSizing: "border-box" }}
                  onFocus={e => e.currentTarget.style.borderColor = `${P.roseSoft}35`}
                  onBlur={e => e.currentTarget.style.borderColor = `${P.roseSoft}15`} />
              </div>
            </>) : (!(cur.museums?.length) && !(cur.restaurants?.length) && <div style={{ textAlign: "center", padding: "28px 16px" }}>
              <div style={{ fontSize: 11, color: P.textFaint, fontStyle: "italic", fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif" }}>No places added yet.</div>
            </div>)}
          </>)}

          {cardTab === "photos" && (<>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
              <button onClick={() => setPolaroidMode(v => !v)} style={{ background: polaroidMode ? `${P.goldWarm}18` : "none", border: `1px solid ${polaroidMode ? P.goldWarm + "30" : P.textFaint + "20"}`, borderRadius: 6, padding: "2px 8px", fontSize: 10, cursor: "pointer", fontFamily: "inherit", color: polaroidMode ? P.goldWarm : P.textFaint, letterSpacing: ".04em" }}>{polaroidMode ? "\ud83d\udcf8 Polaroid" : "\u25a6 Grid"}</button>
            </div>
            {(cur.photos || []).length > 0 ? (<>
              {polaroidMode && cur.photos.length >= 3 && (
                <div style={{ position: "relative", height: 130, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {cur.photos.slice(0, 3).map((url, i) => {
                    const rotations = [-8, 3, -2];
                    const offsets = [{ x: -24, y: 6 }, { x: 22, y: -4 }, { x: 0, y: 10 }];
                    const zIndexes = [1, 2, 3];
                    return (
                      <div key={i} onClick={() => { setLightboxIdx(i); setLightboxOpen(true); }} style={{
                        position: "absolute",
                        transform: `translate(${offsets[i].x}px, ${offsets[i].y}px) rotate(${rotations[i]}deg)`,
                        zIndex: zIndexes[i],
                        background: "#fff", padding: "5px 5px 18px", borderRadius: 2,
                        boxShadow: "0 3px 12px rgba(0,0,0,.15), 0 1px 3px rgba(0,0,0,.08)",
                        cursor: "pointer", transition: "transform .3s ease",
                      }}
                        onMouseEnter={e => e.currentTarget.style.transform = `translate(${offsets[i].x}px, ${offsets[i].y - 4}px) rotate(0deg) scale(1.05)`}
                        onMouseLeave={e => e.currentTarget.style.transform = `translate(${offsets[i].x}px, ${offsets[i].y}px) rotate(${rotations[i]}deg)`}>
                        <img loading="lazy" src={url} alt="" style={{ width: 72, height: 72, objectFit: "cover", display: "block" }} />
                      </div>
                    );
                  })}
                  <div style={{ position: "absolute", bottom: 4, left: 0, right: 0, textAlign: "center", zIndex: 5 }}>
                    <div style={{ display: "inline-block", padding: "3px 12px", background: `${P.card}e0`, backdropFilter: "blur(8px)", borderRadius: 10, border: `1px solid ${P.rose}12` }}>
                      <span style={{ fontSize: 11, fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", fontStyle: "italic", color: P.textMid, letterSpacing: ".03em" }}>{cur.city}</span>
                      {cur.dateStart && <span style={{ fontSize: 9, color: P.textFaint, marginLeft: 6 }}>{fmtDate(cur.dateStart)}</span>}
                    </div>
                  </div>
                </div>
              )}
              {polaroidMode && cur.photos.length >= 3 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 10px", opacity: 0.35 }}>
                  <div style={{ flex: 1, height: 1, background: P.textFaint }} />
                  <span style={{ fontSize: 10, color: P.textFaint, letterSpacing: ".12em", textTransform: "uppercase", fontFamily: "inherit" }}>{cur.photos.length} photos</span>
                  <div style={{ flex: 1, height: 1, background: P.textFaint }} />
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: polaroidMode ? "repeat(auto-fill, minmax(100px, 1fr))" : "repeat(auto-fill, minmax(80px, 1fr))", gap: polaroidMode ? 12 : 4, padding: polaroidMode ? "4px 2px" : 0 }}>
                {cur.photos.map((url, i) => (
                  polaroidMode ? (
                    <div key={i} onMouseEnter={e => e.currentTarget.style.transform = "rotate(0deg) scale(1.03)"} onMouseLeave={e => e.currentTarget.style.transform = `rotate(${(i % 5 - 2) * 1.8}deg)`} style={{ background: "#fff", borderRadius: 2, boxShadow: "0 2px 8px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.06)", transform: `rotate(${(i % 5 - 2) * 1.8}deg)`, transition: "transform .25s ease, box-shadow .25s ease", overflow: "hidden", width: "100%", padding: "6px 6px 4px", cursor: "pointer" }}>
                      <img onClick={() => { setLightboxIdx(i); setLightboxOpen(true); }} loading="lazy" src={url} alt="Travel photo" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block", cursor: "pointer" }} />
                      {!isViewer ? (
                        <input
                          type="text"
                          placeholder="write something..."
                          value={(cur.photoCaptions || {})[url] || ""}
                          onClick={e => e.stopPropagation()}
                          onChange={e => {
                            const captions = { ...(cur.photoCaptions || {}), [url]: e.target.value };
                            dispatch({ type: "UPDATE", id: cur.id, data: { photoCaptions: captions }, _skipSave: true });
                          }}
                          onBlur={e => {
                            const captions = { ...(cur.photoCaptions || {}), [url]: e.target.value };
                            dispatch({ type: "UPDATE", id: cur.id, data: { photoCaptions: captions } });
                          }}
                          style={{ width: "100%", border: "none", background: "none", fontSize: 10, fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", color: "#555", textAlign: "center", padding: "6px 4px 4px", outline: "none", fontStyle: "italic", boxSizing: "border-box" }}
                        />
                      ) : (
                        (cur.photoCaptions || {})[url] && <div style={{ fontSize: 10, color: "#666", textAlign: "center", padding: "6px 4px 4px", fontStyle: "italic", fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif" }}>{(cur.photoCaptions || {})[url]}</div>
                      )}
                    </div>
                  ) : (
                    <button key={i} onClick={() => { setLightboxIdx(i); setLightboxOpen(true); }} style={{ padding: 0, border: "2px solid transparent", background: P.blush, cursor: "pointer", borderRadius: 6, overflow: "hidden", aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
                      <img loading="lazy" src={url} alt="Travel photo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "cover", borderRadius: 4 }} />
                    </button>
                  )
                ))}
              </div>
              {!isViewer && <button onClick={() => handlePhotos(cur.id)} style={{ marginTop: 10, width: "100%", padding: "7px", background: `linear-gradient(135deg,${P.parchment},${P.blush})`, border: `1px solid ${P.rose}12`, borderRadius: 8, cursor: "pointer", fontSize: 10, color: P.textMuted, fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", letterSpacing: ".03em" }}>+ Add more memories</button>}
            </>) : (
              <div style={{ textAlign: "center", padding: "28px 16px" }}>
                <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>{"\ud83d\udcf8"}</div>
                <div style={{ fontSize: 11, color: P.textFaint, lineHeight: 1.7, fontStyle: "italic", fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif" }}>Every trip deserves a scrapbook.<br/>Add your first photo to get started.</div>
                {!isViewer && <button onClick={() => handlePhotos(cur.id)} style={{ marginTop: 12, padding: "6px 20px", background: `linear-gradient(135deg,${P.parchment},${P.blush})`, border: `1px solid ${P.rose}18`, borderRadius: 10, fontSize: 10, color: P.textMid, fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", cursor: "pointer", letterSpacing: ".03em" }}>+ Add photos</button>}
              </div>
            )}
          </>)}
        </div>

        {!isViewer && <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button onClick={() => onEdit({ ...cur })} style={{ flex: 1, padding: "7px 0", background: `linear-gradient(135deg,${P.parchment},${P.blush})`, border: `1px solid ${P.rose}15`, borderRadius: 7, cursor: "pointer", fontSize: 9, color: P.textMuted, fontFamily: "inherit" }}>{"\u270f\ufe0f"} Edit</button>
          <button onClick={() => onDuplicate(cur)} style={{ padding: "7px 10px", background: `linear-gradient(135deg,${P.parchment},${P.blush})`, border: `1px solid ${P.rose}15`, borderRadius: 7, cursor: "pointer", fontSize: 9, color: P.textMuted, fontFamily: "inherit" }} title="Duplicate entry">{"\ud83d\udccb"}</button>
          <button onClick={() => onTripCard(cur)} style={{ padding: "7px 10px", background: `linear-gradient(135deg,${P.parchment},${P.blush})`, border: `1px solid ${P.rose}15`, borderRadius: 7, cursor: "pointer", fontSize: 9, color: P.textMuted, fontFamily: "inherit" }} title="Share card">{"\ud83c\udccf"}</button>
        </div>}

        {/* Reactions — shared worlds only (viewers cannot react) */}
        {isSharedWorld && !isViewer && (() => {
          const entryReactions = worldReactions.filter(r => r.entry_id === cur.id && !r.photo_url);
          const reactionTypes = [
            { type: "heart", icon: "\u2764\ufe0f" },
            { type: "star", icon: "\u2b50" },
            { type: "fire", icon: "\ud83d\udd25" },
            { type: "wow", icon: "\ud83d\ude2e" },
            { type: "miss", icon: "\ud83e\udd7a" },
            { type: "cozy", icon: "\ud83e\udef6" },
          ];
          return (
            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {reactionTypes.map(rt => {
                const count = entryReactions.filter(r => r.reaction_type === rt.type).length;
                const myReaction = entryReactions.find(r => r.reaction_type === rt.type && r.user_id === userId);
                return (
                  <button key={rt.type} onClick={async () => {
                    try {
                      await toggleReaction(worldId, cur.id, userId, rt.type);
                      loadAllWorldReactions(worldId).then(setWorldReactions).catch(() => {});
                    } catch { showToast("Couldn't react", "\u26a0\ufe0f", 2000); }
                  }} style={{
                    padding: "3px 8px", borderRadius: 12, border: myReaction ? `1px solid ${P.rose}40` : `1px solid ${P.rose}15`,
                    background: myReaction ? `${P.rose}12` : "transparent", cursor: "pointer", fontSize: 11,
                    fontFamily: "inherit", display: "flex", alignItems: "center", gap: 3, transition: "all .2s",
                  }}>
                    {rt.icon} {count > 0 && <span style={{ fontSize: 9, color: P.textMid }}>{count}</span>}
                  </button>
                );
              })}
            </div>
          );
        })()}

        {/* Comments — shared worlds only (viewers cannot comment) */}
        {isSharedWorld && !isViewer && (
          <div style={{ marginTop: 10, borderTop: `1px solid ${P.rose}10`, paddingTop: 8 }}>
            <div style={{ fontSize: 10, color: P.textFaint, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 6 }}>
              Comments {entryComments.length > 0 && `(${entryComments.length})`}
            </div>
            {entryComments.map(c => (
              <div key={c.id} style={{ padding: "6px 8px", background: `${P.rose}06`, borderRadius: 6, marginBottom: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: P.textMid }}>{c.user_name || "Someone"}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 10, color: P.textFaint }}>{new Date(c.created_at).toLocaleDateString()}</span>
                    {c.user_id === userId && <button onClick={async () => {
                      try {
                        await deleteComment(c.id, userId);
                        loadComments(worldId, cur.id).then(setEntryComments).catch(() => {});
                      } catch { showToast("Couldn't delete comment", "\u26a0\ufe0f", 2000); }
                    }} style={{ background: "none", border: "none", fontSize: 10, color: P.textFaint, cursor: "pointer", padding: 0 }}>{"\u2715"}</button>}
                  </div>
                </div>
                <p style={{ fontSize: 10, color: P.text, margin: "2px 0 0", lineHeight: 1.5 }}>{c.comment_text}</p>
              </div>
            ))}
            {(() => {
              const submitComment = () => {
                if (!commentText.trim()) return;
                const text = commentText.trim();
                setCommentText("");
                addComment(worldId, cur.id, userId, userDisplayName, text)
                  .then(result => {
                    if (!result) { showToast("Couldn't post comment", "\u26a0\ufe0f", 2000); return; }
                    loadComments(worldId, cur.id).then(setEntryComments).catch(() => {});
                  })
                  .catch(() => showToast("Couldn't post comment", "\u26a0\ufe0f", 2000));
              };
              return (
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  <input value={commentText} onChange={e => setCommentText(e.target.value)}
                    placeholder="Leave a comment..."
                    onKeyDown={e => { if (e.key === "Enter") submitComment(); }}
                    style={{ flex: 1, padding: "5px 8px", background: `${P.rose}06`, border: `1px solid ${P.rose}12`, borderRadius: 6, fontSize: 10, fontFamily: "inherit", color: P.text, outline: "none" }} />
                  <button onClick={submitComment} style={{ padding: "4px 10px", background: `linear-gradient(135deg,${P.rose}30,${P.rose}20)`, border: "none", borderRadius: 6, fontSize: 9, color: P.textMid, cursor: "pointer", fontFamily: "inherit" }}>Send</button>
                </div>
              );
            })()}
          </div>
        )}

        {/* Entry navigation — prev/next chronologically */}
        {sorted.length > 1 && (() => {
          const idx = sorted.findIndex(e => e.id === cur.id);
          const prev = idx > 0 ? sorted[idx - 1] : null;
          const next = idx < sorted.length - 1 ? sorted[idx + 1] : null;
          return (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTop: `1px solid ${P.rose}10` }}>
              <button disabled={!prev} onClick={() => { if (prev) { onSelectEntry(prev); setSliderDate(prev.dateStart); flyTo(prev.lat, prev.lng); } }}
                style={{ background: "none", border: "none", fontSize: 9, color: prev ? P.textMid : P.textFaint, cursor: prev ? "pointer" : "default", fontFamily: "inherit", opacity: prev ? 1 : 0.3, padding: "2px 6px" }}>
                {"\u25c2"} {prev ? prev.city : ""}
              </button>
              <span style={{ fontSize: 10, color: P.textFaint }}>{idx + 1} / {sorted.length}</span>
              <button disabled={!next} onClick={() => { if (next) { onSelectEntry(next); setSliderDate(next.dateStart); flyTo(next.lat, next.lng); } }}
                style={{ background: "none", border: "none", fontSize: 9, color: next ? P.textMid : P.textFaint, cursor: next ? "pointer" : "default", fontFamily: "inherit", opacity: next ? 1 : 0.3, padding: "2px 6px" }}>
                {next ? next.city : ""} {"\u25b8"}
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
