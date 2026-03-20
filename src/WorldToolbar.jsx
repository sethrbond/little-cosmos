import { useState } from "react";
import { TBtn } from "./uiPrimitives.jsx";
import { hasDraft, getDraftSummary } from "./formUtils.jsx";
import { getP } from "./cosmosGetP.js";
import SyncIndicator from "./SyncIndicator.jsx";
import NotificationCenter from "./NotificationCenter.jsx";

export default function WorldToolbar({
  worldId, worldMode, isViewer, isSharedWorld, isPartnerWorld, isMyWorld,
  entries, allPhotos, togetherList, sorted, recentlyDeleted,
  undoCount, redoCount, notifications,
  isPlaying, ambientPlaying, ambientMusicUrl,
  showSearch, showStats, showConstellation, showRoutes,
  showMilestones, showTravelStats, showLoveThread, showDreams, showGallery, showPhotoMap,
  onAdd, onQuickAdd, onResumeDraft, onSettings,
  onToggleSearch, onToggleStats,
  onToggleConstellation, onToggleRoutes, onToggleMilestones,
  onToggleTravelStats, onToggleLoveThread, onToggleDreams,
  onToggleGallery, onPhotoJourney, onTogglePhotoMap,
  onPlayStory, onStopPlay, onSurpriseMe, onToggleAmbient,
  onUndo, onRedo,
  onScreenshot, onTemplates, onTripJournal, onExportHub, onYearReview, onTrash,
  onDismissNotification, onDismissAllNotifications, onClickNotification,
  onSwitchWorld, onSignOut, syncProps, introComplete,
}) {
  const P = getP();
  const [menuOpen, setMenuOpen] = useState(null); // null | "explore" | "photos" | "play" | "tools"

  const draftKeyAdd = `cosmos-draft-add-${worldId || worldMode}`;
  const draftKeyQuick = `cosmos-draft-quick-${worldId || worldMode}`;
  const hasDraftEntry = !isViewer && (hasDraft(draftKeyAdd) || hasDraft(draftKeyQuick));
  const draftTip = (() => {
    const d = getDraftSummary(draftKeyAdd) || getDraftSummary(draftKeyQuick);
    return d ? `Resume draft${d.city ? `: ${d.city}` : ""}` : "Resume draft";
  })();

  const toggle = (cat) => setMenuOpen(v => v === cat ? null : cat);

  // Category button style
  const catBtn = (cat, icon, label) => (
    <button onClick={() => toggle(cat)} style={{
      padding: "8px 14px", borderRadius: 12, fontSize: 12, cursor: "pointer",
      fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, fontWeight: 500,
      background: P.glass || "rgba(255,255,255,0.08)",
      border: menuOpen === cat ? `2px solid ${P.rose || '#c9a96e'}` : `1px solid ${(P.textFaint || '#888')}30`,
      color: menuOpen === cat ? (P.rose || '#c9a96e') : (P.text || '#e8e0d0'),
      transition: "all .2s", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    }}>{icon} {label}</button>
  );

  // Horizontal menu items
  const menuItems = {
    explore: [
      !isViewer && { icon: "⚡", tip: "Quick Add", onClick: onQuickAdd },
      entries.length > 0 && { icon: "🔍", tip: "Search", onClick: onToggleSearch, a: showSearch },
      entries.length > 0 && { icon: "📊", tip: "Stats", onClick: onToggleStats, a: showStats },
      entries.length > 2 && { icon: "⭐", tip: "Constellation", onClick: onToggleConstellation, a: showConstellation },
      sorted.length > 1 && { icon: "🛤", tip: "Routes", onClick: onToggleRoutes, a: showRoutes },
      entries.length > 0 && { icon: "✨", tip: "Milestones", onClick: onToggleMilestones, a: showMilestones },
      entries.length > 2 && { icon: "📈", tip: "Travel Stats", onClick: onToggleTravelStats, a: showTravelStats },
      isPartnerWorld && togetherList.length > 1 && { icon: "🧵", tip: "Love Thread", onClick: onToggleLoveThread, a: showLoveThread },
      { icon: isMyWorld ? "🗺️" : "✦", tip: isMyWorld ? "Bucket List" : "Dreams", onClick: onToggleDreams, a: showDreams },
    ].filter(Boolean),
    photos: [
      allPhotos.length > 0 && { icon: "📸", tip: "Scrapbook", onClick: onToggleGallery, a: showGallery },
      allPhotos.length > 2 && { icon: "🎞", tip: "Photo Journey", onClick: onPhotoJourney },
      allPhotos.length > 0 && { icon: "📍", tip: "Photo Map", onClick: onTogglePhotoMap, a: showPhotoMap },
    ].filter(Boolean),
    play: [
      (isPartnerWorld ? togetherList.length > 0 : sorted.length > 0) && !isPlaying && { icon: "▶", tip: "Play Story", onClick: onPlayStory },
      isPlaying && { icon: "⏹", tip: "Stop", onClick: onStopPlay, a: true },
      { icon: "🎲", tip: "Surprise Me", onClick: onSurpriseMe },
      ambientMusicUrl && { icon: ambientPlaying ? "🔊" : "🎵", tip: "Music", onClick: onToggleAmbient, a: ambientPlaying },
    ].filter(Boolean),
    tools: [
      undoCount > 0 && { icon: "↩", tip: `Undo (${undoCount})`, onClick: onUndo },
      redoCount > 0 && { icon: "↪", tip: `Redo (${redoCount})`, onClick: onRedo },
      { icon: "📷", tip: "Screenshot", onClick: onScreenshot },
      !isViewer && { icon: "📋", tip: "Templates", onClick: onTemplates },
      entries.length >= 2 && { icon: "📖", tip: "Journal", onClick: onTripJournal },
      entries.length > 0 && { icon: "📤", tip: "Export", onClick: onExportHub },
      entries.length > 0 && { icon: "🎬", tip: "Year Review", onClick: onYearReview },
      recentlyDeleted.length > 0 && { icon: "🗑", tip: `Trash (${recentlyDeleted.length})`, onClick: onTrash },
    ].filter(Boolean),
  };

  const activeItems = menuOpen ? menuItems[menuOpen] : [];

  return (
    <div role="toolbar" aria-label="World tools" style={{ position: "absolute", top: 22, left: 22, zIndex: 20, display: "flex", flexDirection: "column", gap: 7, opacity: introComplete ? 1 : 0, transition: "opacity .8s ease" }}>

      {!isViewer && <TBtn onClick={onAdd} accent tip="Add Entry">＋</TBtn>}
      {!isViewer && <TBtn onClick={onSettings} tip="Settings">⚙️</TBtn>}

      {hasDraftEntry && (
        <TBtn onClick={onResumeDraft} tip={draftTip}>
          <span style={{ position: "relative" }}>📝<span style={{ position: "absolute", top: -4, right: -6, width: 7, height: 7, borderRadius: "50%", background: "#c9a96e", border: "1.5px solid rgba(255,255,255,.9)", animation: "pulse 2s infinite" }} /></span>
        </TBtn>
      )}

      {/* Category buttons — expand items to the right */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {catBtn("explore", "🔍", "Explore")}
          {menuOpen === "explore" && <div style={{ display: "flex", flexWrap: "wrap", gap: 4, background: 'rgba(30,26,42,0.97)', backdropFilter: "blur(16px)", border: "1px solid rgba(232,224,208,0.2)", borderRadius: 12, padding: "6px 8px", animation: "fadeIn .15s ease" }}>
            {menuItems.explore.map((item, i) => <TBtn key={i} a={item.a} onClick={() => { item.onClick(); setMenuOpen(null); }} tip={item.tip}>{item.icon}</TBtn>)}
          </div>}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {catBtn("photos", "📸", "Photos")}
          {menuOpen === "photos" && <div style={{ display: "flex", flexWrap: "wrap", gap: 4, background: 'rgba(30,26,42,0.97)', backdropFilter: "blur(16px)", border: "1px solid rgba(232,224,208,0.2)", borderRadius: 12, padding: "6px 8px", animation: "fadeIn .15s ease" }}>
            {menuItems.photos.map((item, i) => <TBtn key={i} a={item.a} onClick={() => { item.onClick(); setMenuOpen(null); }} tip={item.tip}>{item.icon}</TBtn>)}
          </div>}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {catBtn("play", "▶", "Play")}
          {menuOpen === "play" && <div style={{ display: "flex", flexWrap: "wrap", gap: 4, background: 'rgba(30,26,42,0.97)', backdropFilter: "blur(16px)", border: "1px solid rgba(232,224,208,0.2)", borderRadius: 12, padding: "6px 8px", animation: "fadeIn .15s ease" }}>
            {menuItems.play.map((item, i) => <TBtn key={i} a={item.a} onClick={() => { item.onClick(); setMenuOpen(null); }} tip={item.tip}>{item.icon}</TBtn>)}
          </div>}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {catBtn("tools", "🔧", "Tools")}
        {menuOpen === "tools" && <div style={{ display: "flex", flexWrap: "wrap", gap: 4, background: 'rgba(30,26,42,0.97)', backdropFilter: "blur(16px)", border: "1px solid rgba(232,224,208,0.2)", borderRadius: 12, padding: "6px 8px", animation: "fadeIn .15s ease" }}>
          {menuItems.tools.map((item, i) => <TBtn key={i} a={item.a} onClick={() => { item.onClick(); setMenuOpen(null); }} tip={item.tip}>{item.icon}</TBtn>)}
        </div>}
      </div>



      {isSharedWorld && <NotificationCenter notifications={notifications} palette={P} onDismiss={onDismissNotification} onDismissAll={onDismissAllNotifications} onClickNotification={onClickNotification} />}
      {onSwitchWorld && <TBtn onClick={onSwitchWorld} tip="Switch World">🔄</TBtn>}
      <SyncIndicator {...syncProps} style={{ margin: '4px auto' }} />
      <TBtn onClick={onSignOut} tip="Sign Out">🚪</TBtn>
    </div>
  );
}
