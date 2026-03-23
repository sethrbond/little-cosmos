import { useState, useRef, useEffect } from "react";
import { TBtn } from "./uiPrimitives.jsx";
import { hasDraft, getDraftSummary } from "./formUtils.jsx";
import { getP } from "./cosmosGetP.js";
import SyncIndicator from "./SyncIndicator.jsx";
import NotificationCenter from "./NotificationCenter.jsx";

/* ---- Category button with hover state ---- */
function CatBtn({ cat, icon, label, isOpen, onToggle, P }) {
  const [hov, setHov] = useState(false);
  const active = isOpen;
  return (
    <button
      onClick={() => onToggle(cat)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onTouchStart={e => { e.currentTarget.style.opacity = '0.6'; setTimeout(() => { if (e.currentTarget) e.currentTarget.style.opacity = '1'; }, 150); }}
      aria-label={`${label} menu`}
      aria-expanded={active}
      style={{
        width: 44, height: 44, borderRadius: 12,
        padding: 0, cursor: "pointer",
        fontFamily: "inherit",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
        background: active ? (P.card || "rgba(252,249,246,0.96)") : (P.glass || "rgba(248,244,240,0.92)"),
        border: `1px solid ${active ? (P.rose || '#c48aa8') + "50" : (P.textFaint || '#b8aec8') + "20"}`,
        color: active ? (P.rose || '#c48aa8') : (P.text || '#2e2440'),
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        transition: "all .3s ease",
        boxShadow: hov
          ? `0 4px 16px ${(P.text || '#2e2440')}12, 0 1px 3px ${(P.text || '#2e2440')}08`
          : `0 1px 4px ${(P.text || '#2e2440')}06`,
        transform: hov ? "translateY(-1px)" : "none",
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".04em", lineHeight: 1, opacity: 0.7 }}>{label}</span>
    </button>
  );
}

/* ---- Flyout panel for category sub-items ---- */
function CatFlyout({ items, onSelect, P }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 4,
      background: P.card || "rgba(252,249,246,0.96)",
      backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      border: `1px solid ${(P.textFaint || '#b8aec8')}20`,
      borderRadius: 12, padding: "6px 8px",
      animation: "fadeIn .15s ease",
      boxShadow: `0 4px 20px ${(P.text || '#2e2440')}10, 0 1px 4px ${(P.text || '#2e2440')}06`,
    }}>
      {items.map((item, i) => (
        <TBtn key={i} a={item.a} onClick={() => { item.onClick(); onSelect(); }} tip={item.tip}>{item.icon}</TBtn>
      ))}
    </div>
  );
}

/* ---- Thin separator line ---- */
function ToolbarSep({ P, horizontal }) {
  return horizontal
    ? <div style={{ width: 1, height: 28, background: (P.textFaint || '#b8aec8') + "18", margin: "auto 2px", borderRadius: 1 }} />
    : <div style={{ width: 28, height: 1, background: (P.textFaint || '#b8aec8') + "18", margin: "2px auto", borderRadius: 1 }} />;
}

/* ---- Mobile flyout (opens upward from bottom bar) ---- */
function MobileFlyout({ items, onSelect, P }) {
  return (
    <div style={{
      position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
      marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center",
      background: P.card || "rgba(252,249,246,0.96)",
      backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      border: `1px solid ${(P.textFaint || '#b8aec8')}20`,
      borderRadius: 12, padding: "6px 8px",
      animation: "fadeIn .15s ease",
      boxShadow: `0 4px 20px ${(P.text || '#2e2440')}10, 0 1px 4px ${(P.text || '#2e2440')}06`,
      minWidth: 180, maxWidth: 280,
    }}>
      {items.map((item, i) => (
        <TBtn key={i} a={item.a} onClick={() => { item.onClick(); onSelect(); }} tip={item.tip}>{item.icon}</TBtn>
      ))}
    </div>
  );
}

/* ---- Mobile overflow menu (for extra buttons) ---- */
function MobileOverflow({ items, onClose, P }) {
  return (
    <div style={{
      position: "absolute", bottom: "100%", right: 0,
      marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center",
      background: P.card || "rgba(252,249,246,0.96)",
      backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      border: `1px solid ${(P.textFaint || '#b8aec8')}20`,
      borderRadius: 12, padding: "8px 10px",
      animation: "fadeIn .15s ease",
      boxShadow: `0 4px 20px ${(P.text || '#2e2440')}10, 0 1px 4px ${(P.text || '#2e2440')}06`,
      minWidth: 160,
    }}>
      {items.map((item, i) => (
        <TBtn key={i} a={item.a} onClick={() => { item.onClick(); onClose(); }} tip={item.tip}>{item.icon}</TBtn>
      ))}
    </div>
  );
}

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
  onScreenshot, onShare, onTemplates, onTripJournal, onExportHub, onYearReview, onTrash,
  onTimeCapsule,
  onDismissNotification, onDismissAllNotifications, onClickNotification,
  onSwitchWorld, onSignOut, syncProps, introComplete, isMobile,
}) {
  const P = getP();
  const [menuOpen, setMenuOpen] = useState(null); // null | "explore" | "photos" | "play" | "tools" | "overflow"
  const toolbarRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = e => { if (toolbarRef.current && !toolbarRef.current.contains(e.target)) setMenuOpen(null); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const draftKeyAdd = `cosmos-draft-add-${worldId || worldMode}`;
  const draftKeyQuick = `cosmos-draft-quick-${worldId || worldMode}`;
  const hasDraftEntry = !isViewer && (hasDraft(draftKeyAdd) || hasDraft(draftKeyQuick));
  const draftTip = (() => {
    const d = getDraftSummary(draftKeyAdd) || getDraftSummary(draftKeyQuick);
    return d ? `Resume draft${d.city ? `: ${d.city}` : ""}` : "Resume draft";
  })();

  const toggle = (cat) => setMenuOpen(v => v === cat ? null : cat);
  const closeMenu = () => setMenuOpen(null);

  // Menu items
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
      !isViewer && onTimeCapsule && { icon: "🔮", tip: "Time Capsule", onClick: onTimeCapsule },
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
      { icon: "🌍", tip: "Share Card", onClick: onShare },
      !isViewer && { icon: "📋", tip: "Templates", onClick: onTemplates },
      entries.length >= 2 && { icon: "📖", tip: "Journal", onClick: onTripJournal },
      entries.length > 0 && { icon: "📤", tip: "Export", onClick: onExportHub },
      entries.length > 0 && { icon: "🎬", tip: "Year Review", onClick: onYearReview },
      recentlyDeleted.length > 0 && { icon: "🗑", tip: `Trash (${recentlyDeleted.length})`, onClick: onTrash },
    ].filter(Boolean),
  };

  // Mobile: collect overflow items (buttons beyond the 6 primary ones)
  const mobileOverflowItems = isMobile ? [
    ...(isSharedWorld && notifications?.length ? [{ icon: "🔔", tip: "Notifications", onClick: () => {}, a: false }] : []),
    ...(onSwitchWorld ? [{ icon: "🔄", tip: "Switch World", onClick: onSwitchWorld }] : []),
    { icon: "🚪", tip: "Sign Out", onClick: onSignOut },
  ] : [];

  if (isMobile) {
    // Mobile: horizontal bar at bottom
    return (
      <div ref={toolbarRef} role="toolbar" aria-label="World tools" style={{
        position: "fixed", bottom: "env(safe-area-inset-bottom, 8px)", left: "50%", transform: "translateX(-50%)",
        zIndex: 20, display: "flex", flexDirection: "row", alignItems: "center", gap: 4,
        background: P.card || "rgba(252,249,246,0.96)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        borderRadius: 16, padding: "6px 8px",
        boxShadow: `0 4px 20px ${(P.text || '#2e2440')}12, 0 1px 4px ${(P.text || '#2e2440')}08`,
        border: `1px solid ${(P.textFaint || '#b8aec8')}20`,
        opacity: introComplete ? 1 : 0, transition: "opacity .8s ease",
      }}>
        {/* 1. Add */}
        {!isViewer && <TBtn onClick={onAdd} accent tip="Add Entry">＋</TBtn>}
        {/* 2. Settings */}
        {!isViewer && <TBtn onClick={onSettings} tip="Settings">⚙️</TBtn>}

        <ToolbarSep P={P} horizontal />

        {/* 3. Explore */}
        <div style={{ position: "relative" }}>
          <CatBtn cat="explore" icon="🔍" label="Explore" isOpen={menuOpen === "explore"} onToggle={toggle} P={P} />
          {menuOpen === "explore" && <MobileFlyout items={menuItems.explore} onSelect={closeMenu} P={P} />}
        </div>
        {/* 4. Photos */}
        <div style={{ position: "relative" }}>
          <CatBtn cat="photos" icon="📸" label="Photos" isOpen={menuOpen === "photos"} onToggle={toggle} P={P} />
          {menuOpen === "photos" && <MobileFlyout items={menuItems.photos} onSelect={closeMenu} P={P} />}
        </div>
        {/* 5. Play */}
        <div style={{ position: "relative" }}>
          <CatBtn cat="play" icon="▶" label="Play" isOpen={menuOpen === "play"} onToggle={toggle} P={P} />
          {menuOpen === "play" && <MobileFlyout items={menuItems.play} onSelect={closeMenu} P={P} />}
        </div>
        {/* 6. Tools */}
        <div style={{ position: "relative" }}>
          <CatBtn cat="tools" icon="🔧" label="Tools" isOpen={menuOpen === "tools"} onToggle={toggle} P={P} />
          {menuOpen === "tools" && <MobileFlyout items={menuItems.tools} onSelect={closeMenu} P={P} />}
        </div>

        {/* Overflow "..." for remaining items */}
        {mobileOverflowItems.length > 0 && <>
          <ToolbarSep P={P} horizontal />
          <div style={{ position: "relative" }}>
            <TBtn onClick={() => setMenuOpen(v => v === "overflow" ? null : "overflow")} tip="More">⋯</TBtn>
            {menuOpen === "overflow" && <MobileOverflow items={mobileOverflowItems} onClose={closeMenu} P={P} />}
          </div>
        </>}
      </div>
    );
  }

  // Desktop: vertical toolbar on the left
  return (
    <div ref={toolbarRef} role="toolbar" aria-label="World tools" style={{
      position: "absolute", top: 22, left: 22, zIndex: 20,
      display: "flex", flexDirection: "column", gap: 6,
      maxHeight: "calc(100vh - 44px)", overflowY: "auto",
      opacity: introComplete ? 1 : 0, transition: "opacity .8s ease",
    }}>

      {/* Primary actions */}
      {!isViewer && <TBtn onClick={onAdd} accent tip="Add Entry">＋</TBtn>}
      {!isViewer && <TBtn onClick={onSettings} tip="Settings">⚙️</TBtn>}

      {hasDraftEntry && (
        <TBtn onClick={onResumeDraft} tip={draftTip}>
          <span style={{ position: "relative" }}>📝<span style={{ position: "absolute", top: -4, right: -6, width: 7, height: 7, borderRadius: "50%", background: P.gold || "#c8a060", border: "1.5px solid rgba(255,255,255,.9)", animation: "pulse 2s infinite" }} /></span>
        </TBtn>
      )}

      <ToolbarSep P={P} />

      {/* Category buttons with flyout panels */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <CatBtn cat="explore" icon="🔍" label="Explore" isOpen={menuOpen === "explore"} onToggle={toggle} P={P} />
        {menuOpen === "explore" && <CatFlyout items={menuItems.explore} onSelect={closeMenu} P={P} />}
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <CatBtn cat="photos" icon="📸" label="Photos" isOpen={menuOpen === "photos"} onToggle={toggle} P={P} />
        {menuOpen === "photos" && <CatFlyout items={menuItems.photos} onSelect={closeMenu} P={P} />}
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <CatBtn cat="play" icon="▶" label="Play" isOpen={menuOpen === "play"} onToggle={toggle} P={P} />
        {menuOpen === "play" && <CatFlyout items={menuItems.play} onSelect={closeMenu} P={P} />}
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <CatBtn cat="tools" icon="🔧" label="Tools" isOpen={menuOpen === "tools"} onToggle={toggle} P={P} />
        {menuOpen === "tools" && <CatFlyout items={menuItems.tools} onSelect={closeMenu} P={P} />}
      </div>

      <ToolbarSep P={P} />

      {/* Utility buttons */}
      {isSharedWorld && <NotificationCenter notifications={notifications} palette={P} onDismiss={onDismissNotification} onDismissAll={onDismissAllNotifications} onClickNotification={onClickNotification} />}
      {onSwitchWorld && <TBtn onClick={onSwitchWorld} tip="Switch World">🔄</TBtn>}
      <SyncIndicator {...syncProps} style={{ margin: '4px auto' }} />
      <TBtn onClick={onSignOut} tip="Sign Out">🚪</TBtn>
    </div>
  );
}
