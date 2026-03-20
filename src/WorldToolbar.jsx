import { useState } from "react";
import { TBtn, TBtnGroup } from "./uiPrimitives.jsx";
import { hasDraft, getDraftSummary } from "./formUtils.jsx";
import { getP } from "./cosmosGetP.js";
import SyncIndicator from "./SyncIndicator.jsx";
import NotificationCenter from "./NotificationCenter.jsx";

/* ================================================================
   WorldToolbar — extracted from OurWorld.jsx
   4 always-visible buttons: Add, Settings, More (toggle), Exit
   Everything else lives inside the More menu.
   ================================================================ */

export default function WorldToolbar({
  // Identity / mode
  worldId, worldMode, isViewer, isSharedWorld, isPartnerWorld, isMyWorld,
  // Data
  entries, allPhotos, togetherList, sorted, recentlyDeleted,
  undoCount, redoCount,
  notifications,
  // Playback
  isPlaying, ambientPlaying, ambientMusicUrl,
  // Overlay visibility flags (active states)
  showSearch, showStats, showConstellation, showRoutes,
  showMilestones, showTravelStats, showLoveThread, showDreams, showGallery, showPhotoMap,
  // Actions
  onAdd, onQuickAdd, onResumeDraft, onSettings,
  onToggleSearch, onToggleStats,
  onToggleConstellation, onToggleRoutes, onToggleMilestones,
  onToggleTravelStats, onToggleLoveThread, onToggleDreams,
  onToggleGallery, onPhotoJourney, onTogglePhotoMap,
  onPlayStory, onStopPlay, onSurpriseMe,
  onToggleAmbient,
  onUndo, onRedo,
  onScreenshot, onTemplates, onTripJournal, onExportHub, onYearReview, onTrash,
  onDismissNotification, onDismissAllNotifications, onClickNotification,
  onSwitchWorld, onSignOut,
  // Sync indicator
  syncProps,
  // Animation
  introComplete,
}) {
  const P = getP();

  const draftKeyAdd = `cosmos-draft-add-${worldId || worldMode}`;
  const draftKeyQuick = `cosmos-draft-quick-${worldId || worldMode}`;
  const hasDraftEntry = !isViewer && (hasDraft(draftKeyAdd) || hasDraft(draftKeyQuick));

  const draftTip = (() => {
    const d = getDraftSummary(draftKeyAdd) || getDraftSummary(draftKeyQuick);
    return d ? `Resume draft${d.city ? `: ${d.city}` : ""}` : "Resume draft";
  })();

  return (
    <div role="toolbar" aria-label="World tools" style={{ position: "absolute", top: 22, left: 22, zIndex: 20, display: "flex", flexDirection: "column", gap: 7, opacity: introComplete ? 1 : 0, transition: "opacity .8s ease" }}>

      {/* — Always visible: Add — */}
      {!isViewer && <TBtn onClick={onAdd} accent tip="Add Entry">＋</TBtn>}

      {/* — Always visible: Settings — */}
      {!isViewer && <TBtn onClick={onSettings} tip="Settings">⚙️</TBtn>}

      {/* — Draft indicator (always visible when draft exists) — */}
      {hasDraftEntry && (
        <TBtn onClick={onResumeDraft} tip={draftTip}>
          <span style={{ position: "relative" }}>📝<span style={{ position: "absolute", top: -4, right: -6, width: 7, height: 7, borderRadius: "50%", background: "#c9a96e", border: "1.5px solid rgba(255,255,255,.9)", animation: "pulse 2s infinite" }} /></span>
        </TBtn>
      )}

      {/* — Always visible: More toggle — */}
      <TBtnGroup icon="⋯" label="more">
        {/* Quick Add */}
        {!isViewer && <TBtn onClick={onQuickAdd} tip="Quick Add">⚡</TBtn>}

        {/* Explore */}
        {entries.length > 0 && <TBtn a={showSearch} onClick={onToggleSearch} tip="Search Entries">🔍</TBtn>}
        {entries.length > 0 && <TBtn a={showStats} onClick={onToggleStats} tip="Stats & Insights">📊</TBtn>}

        {/* Discover */}
        {entries.length > 2 && <TBtn a={showConstellation} onClick={onToggleConstellation} tip="Constellation">⭐</TBtn>}
        {sorted.length > 1 && <TBtn a={showRoutes} onClick={onToggleRoutes} tip="Travel Routes">🛤</TBtn>}
        {entries.length > 0 && <TBtn a={showMilestones} onClick={onToggleMilestones} tip="Milestones">✨</TBtn>}
        {entries.length > 2 && <TBtn a={showTravelStats} onClick={onToggleTravelStats} tip="Travel Stats">📈</TBtn>}
        {isPartnerWorld && togetherList.length > 1 && <TBtn a={showLoveThread} onClick={onToggleLoveThread} tip="Love Thread">🧵</TBtn>}
        <TBtn a={showDreams} onClick={onToggleDreams} tip={isMyWorld ? "Bucket List" : isPartnerWorld ? "Dream Destinations" : "Wish List"}>{isMyWorld ? "🗺️" : "✦"}</TBtn>

        {/* Photos */}
        {allPhotos.length > 0 && <>
          <TBtn a={showGallery} onClick={onToggleGallery} tip="Scrapbook">📸</TBtn>
          {allPhotos.length > 2 && <TBtn onClick={onPhotoJourney} tip="Photo Journey">🎞</TBtn>}
          <TBtn a={showPhotoMap} onClick={onTogglePhotoMap} tip="Photo Map">📍</TBtn>
        </>}

        {/* Play */}
        {entries.length > 1 && <>
          {(isPartnerWorld ? togetherList.length > 0 : sorted.length > 0) && !isPlaying && <TBtn onClick={onPlayStory} tip={isPartnerWorld ? "Play Our Story" : "Play Story"}>▶</TBtn>}
          {isPlaying && <TBtn onClick={onStopPlay} a tip="Stop Playback">⏹</TBtn>}
          <TBtn onClick={onSurpriseMe} tip="Surprise Me">🎲</TBtn>
          {ambientMusicUrl && <TBtn a={ambientPlaying} onClick={onToggleAmbient} tip={ambientPlaying ? "Pause Ambient Music" : "Play Ambient Music"}>{ambientPlaying ? "🔊" : "🎵"}</TBtn>}
        </>}

        {/* Undo/Redo */}
        {!isViewer && (undoCount > 0 || redoCount > 0) && <>
          {undoCount > 0 && <TBtn onClick={onUndo} tip={`Undo (${undoCount})`}>↩</TBtn>}
          {redoCount > 0 && <TBtn onClick={onRedo} tip={`Redo (${redoCount})`}>↪</TBtn>}
        </>}

        {/* System */}
        <TBtn onClick={onScreenshot} tip="Save Globe Screenshot">📷</TBtn>
        {!isViewer && <TBtn onClick={onTemplates} tip="Entry Templates">📋</TBtn>}
        {entries.length >= 2 && <TBtn onClick={onTripJournal} tip="Trip Journal">📖</TBtn>}
        {entries.length > 0 && <TBtn onClick={onExportHub} tip="Export & Import">📤</TBtn>}
        {entries.length > 0 && <TBtn onClick={onYearReview} tip="Year in Review">🎬</TBtn>}
        {recentlyDeleted.length > 0 && <TBtn onClick={onTrash} tip={`Recently Deleted (${recentlyDeleted.length})`}>🗑</TBtn>}
      </TBtnGroup>

      {/* Notifications (shared worlds only) */}
      {isSharedWorld && <NotificationCenter
        notifications={notifications}
        palette={P}
        onDismiss={onDismissNotification}
        onDismissAll={onDismissAllNotifications}
        onClickNotification={onClickNotification}
      />}

      {/* Switch World */}
      {onSwitchWorld && <TBtn onClick={onSwitchWorld} tip="Switch World">🔄</TBtn>}

      {/* Sync */}
      <SyncIndicator {...syncProps} style={{ margin: '4px auto' }} />

      {/* — Always visible: Exit / Sign Out — */}
      <TBtn onClick={onSignOut} tip="Sign Out">🚪</TBtn>
    </div>
  );
}
