import { useState } from "react";
import { TBtn, TBtnGroup, hasDraft, getDraftSummary } from "./EntryForms.jsx";
import SyncIndicator from "./SyncIndicator.jsx";
import NotificationCenter from "./NotificationCenter.jsx";

const P = window.__cosmosP;

export default function WorldToolbar({
  actions, isViewer, isMyWorld, isPartnerWorld, isSharedWorld,
  worldId, worldMode, introComplete,
  entryCount, sortedCount, togetherCount, allPhotosCount,
  undoCount, redoCount, recentlyDeletedCount,
  isPlaying, showSearch, showStats, showConstellation, showRoutes,
  showMilestones, showTravelStats, showLoveThread, showDreams,
  showGallery, showPhotoMap, ambientPlaying, hasAmbientMusic,
  notifications, onSwitchWorld, pendingOffline, lastSync, sceneBg,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const draftKey = `cosmos-draft-add-${worldId || worldMode}`;
  const quickDraftKey = `cosmos-draft-quick-${worldId || worldMode}`;
  const hasDraftEntry = hasDraft(draftKey) || hasDraft(quickDraftKey);

  return (
    <div role="toolbar" aria-label="World tools" style={{ position: "absolute", top: 22, left: 22, zIndex: 20, display: "flex", flexDirection: "column", gap: 7, opacity: introComplete ? 1 : 0, transition: "opacity .8s ease" }}>

      {/* Always visible: Add + Settings + More + Exit */}
      {!isViewer && <TBtn onClick={actions.addEntry} accent tip="Add Entry">{"\uFF0B"}</TBtn>}

      {!isViewer && hasDraftEntry && (
        <TBtn onClick={() => { if (hasDraft(draftKey)) actions.addEntry(); else actions.quickAdd(); }} tip="Resume draft">
          <span style={{ position: "relative" }}>{"\uD83D\uDCDD"}<span style={{ position: "absolute", top: -4, right: -6, width: 7, height: 7, borderRadius: "50%", background: "#c9a96e", border: "1.5px solid rgba(255,255,255,.9)", animation: "pulse 2s infinite" }} /></span>
        </TBtn>
      )}

      {!isViewer && <TBtn onClick={actions.openSettings} tip="Settings">{"\u2699\uFE0F"}</TBtn>}

      {/* Everything else toggle */}
      <TBtn onClick={() => setMenuOpen(v => !v)} a={menuOpen} tip={menuOpen ? "Close menu" : "More tools"}>{"\u22EF"}</TBtn>

      {/* Expanded menu */}
      {menuOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: "4px 0", borderTop: `1px solid ${(P?.textFaint || '#888')}18`, borderBottom: `1px solid ${(P?.textFaint || '#888')}18`, margin: "2px 0" }}>
          {!isViewer && <TBtn onClick={actions.quickAdd} tip="Quick Add">{"\u26A1"}</TBtn>}
          {entryCount > 0 && <TBtn a={showSearch} onClick={actions.toggleSearch} tip="Search">{"\uD83D\uDD0D"}</TBtn>}
          {entryCount > 0 && <TBtn a={showStats} onClick={actions.toggleStats} tip="Stats">{"\uD83D\uDCCA"}</TBtn>}
          {entryCount > 2 && <TBtn a={showConstellation} onClick={actions.toggleConstellation} tip="Constellation">{"\u2B50"}</TBtn>}
          {sortedCount > 1 && <TBtn a={showRoutes} onClick={actions.toggleRoutes} tip="Routes">{"\uD83D\uDEE4"}</TBtn>}
          {entryCount > 0 && <TBtn a={showMilestones} onClick={actions.toggleMilestones} tip="Milestones">{"\u2728"}</TBtn>}
          {entryCount > 2 && <TBtn a={showTravelStats} onClick={actions.toggleTravelStats} tip="Travel Stats">{"\uD83D\uDCC8"}</TBtn>}
          {isPartnerWorld && togetherCount > 1 && <TBtn a={showLoveThread} onClick={actions.toggleLoveThread} tip="Love Thread">{"\uD83E\uDDF5"}</TBtn>}
          <TBtn a={showDreams} onClick={actions.toggleDreams} tip={isMyWorld ? "Bucket List" : isPartnerWorld ? "Dreams" : "Wish List"}>{isMyWorld ? "\uD83D\uDDFA\uFE0F" : "\u2726"}</TBtn>
          {allPhotosCount > 0 && <TBtn a={showGallery} onClick={actions.toggleGallery} tip="Scrapbook">{"\uD83D\uDCF8"}</TBtn>}
          {allPhotosCount > 2 && <TBtn onClick={actions.startPhotoJourney} tip="Photo Journey">{"\uD83C\uDF9E"}</TBtn>}
          {allPhotosCount > 0 && <TBtn a={showPhotoMap} onClick={actions.togglePhotoMap} tip="Photo Map">{"\uD83D\uDCCD"}</TBtn>}
          {(isPartnerWorld ? togetherCount > 0 : sortedCount > 0) && !isPlaying && <TBtn onClick={actions.playStory} tip="Play Story">{"\u25B6"}</TBtn>}
          {isPlaying && <TBtn onClick={actions.stopPlay} a tip="Stop">{"\u23F9"}</TBtn>}
          <TBtn onClick={actions.surpriseMe} tip="Surprise Me">{"\uD83C\uDFB2"}</TBtn>
          {hasAmbientMusic && <TBtn a={ambientPlaying} onClick={actions.toggleAmbient} tip="Music">{ambientPlaying ? "\uD83D\uDD0A" : "\uD83C\uDFB5"}</TBtn>}
          {undoCount > 0 && <TBtn onClick={actions.undo} tip={`Undo (${undoCount})`}>{"\u21A9"}</TBtn>}
          {redoCount > 0 && <TBtn onClick={actions.redo} tip={`Redo (${redoCount})`}>{"\u21AA"}</TBtn>}
          <TBtn onClick={actions.saveScreenshot} tip="Screenshot">{"\uD83D\uDCF7"}</TBtn>
          {!isViewer && <TBtn onClick={actions.openTemplates} tip="Templates">{"\uD83D\uDCCB"}</TBtn>}
          {entryCount >= 2 && <TBtn onClick={actions.openTripJournal} tip="Journal">{"\uD83D\uDCD6"}</TBtn>}
          {entryCount > 0 && <TBtn onClick={actions.openExportHub} tip="Export">{"\uD83D\uDCE4"}</TBtn>}
          {entryCount > 0 && <TBtn onClick={actions.openYearReview} tip="Year Review">{"\uD83C\uDFAC"}</TBtn>}
          {recentlyDeletedCount > 0 && <TBtn onClick={actions.openTrash} tip={`Trash (${recentlyDeletedCount})`}>{"\uD83D\uDDD1"}</TBtn>}
        </div>
      )}

      {isSharedWorld && <NotificationCenter notifications={notifications} palette={P} onDismiss={actions.dismissNotification} onDismissAll={actions.dismissAllNotifications} onClickNotification={actions.clickNotification} />}
      {pendingOffline > 0 && <SyncIndicator isConnected={true} lastSync={lastSync} pendingOffline={pendingOffline} palette={{ bg: sceneBg, text: P?.text }} style={{ margin: '4px auto' }} />}

      <div style={{ flex: 1 }} />
      {onSwitchWorld && <TBtn onClick={actions.switchWorld} tip="Back to Cosmos">{"\uD83D\uDD04"}</TBtn>}
      <TBtn onClick={actions.signOut} tip="Sign Out">{"\uD83D\uDEAA"}</TBtn>
    </div>
  );
}
