import { useState, useCallback } from "react";

/**
 * useModalStates — consolidates ~35 modal/overlay visibility toggles
 * into a single hook, reducing OurWorld.jsx useState count significantly.
 *
 * Returns an object of [value, setter] pairs plus a closeAll() function
 * that resets every modal to its closed/default state.
 */
export function useModalStates({ isPartnerWorld = false } = {}) {
  const [showPhotoJourney, setShowPhotoJourney] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showLoveNotes, setShowLoveNotes] = useState(false);
  const [showLoveThread, setShowLoveThread] = useState(isPartnerWorld);
  const [showConstellation, setShowConstellation] = useState(false);
  const [showRoutes, setShowRoutes] = useState(false);
  const [showDreams, setShowDreams] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [quickAddMode, setQuickAddMode] = useState(false);
  const [showPhotoMap, setShowPhotoMap] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);
  const [showTravelStats, setShowTravelStats] = useState(false);
  const [showExportHub, setShowExportHub] = useState(false);
  const [showYearReview, setShowYearReview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTripJournal, setShowTripJournal] = useState(false);
  const [showLetter, setShowLetter] = useState(null);
  const [editLetter, setEditLetter] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [cardGallery, setCardGallery] = useState(false);
  const [showZoomHint, setShowZoomHint] = useState(true);
  // These were previously undeclared in OurWorld — adding proper state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardStep, setOnboardStep] = useState(0);
  const [shareMenu, setShareMenu] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [showTrash, setShowTrash] = useState(false);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [photoDeleteMode, setPhotoDeleteMode] = useState(false);
  const [pjIndex, setPjIndex] = useState(0);
  const [pjAutoPlay, setPjAutoPlay] = useState(false);
  const [polaroidMode, setPolaroidMode] = useState(true);

  const closeAll = useCallback(() => {
    setShowPhotoJourney(false);
    setShowAdd(false);
    setShowSettings(false);
    setShowGallery(false);
    setShowFilter(false);
    setShowStats(false);
    setShowRecap(false);
    setShowSearch(false);
    setShowDreams(false);
    setShowShortcuts(false);
    setQuickAddMode(false);
    setShowPhotoMap(false);
    setShowMilestones(false);
    setShowTravelStats(false);
    setShowExportHub(false);
    setShowYearReview(false);
    setShowTemplates(false);
    setShowTripJournal(false);
    setShowLetter(null);
    setEditLetter(false);
    setLightboxOpen(false);
    setCardGallery(false);
    setShowOnboarding(false);
    setShareMenu(null);
    setConfirmModal(null);
    setShowTrash(false);
    setShowLinkPicker(false);
    setPhotoDeleteMode(false);
    setShowConstellation(false);
    setShowRoutes(false);
    setShowLoveThread(false);
    setPjIndex(0);
    setPjAutoPlay(false);
  }, []);

  return {
    showPhotoJourney, setShowPhotoJourney,
    showAdd, setShowAdd,
    showSettings, setShowSettings,
    showGallery, setShowGallery,
    showFilter, setShowFilter,
    showStats, setShowStats,
    showRecap, setShowRecap,
    showSearch, setShowSearch,
    showLoveNotes, setShowLoveNotes,
    showLoveThread, setShowLoveThread,
    showConstellation, setShowConstellation,
    showRoutes, setShowRoutes,
    showDreams, setShowDreams,
    showShortcuts, setShowShortcuts,
    quickAddMode, setQuickAddMode,
    showPhotoMap, setShowPhotoMap,
    showMilestones, setShowMilestones,
    showTravelStats, setShowTravelStats,
    showExportHub, setShowExportHub,
    showYearReview, setShowYearReview,
    showTemplates, setShowTemplates,
    showTripJournal, setShowTripJournal,
    showLetter, setShowLetter,
    editLetter, setEditLetter,
    lightboxOpen, setLightboxOpen,
    cardGallery, setCardGallery,
    showZoomHint, setShowZoomHint,
    showOnboarding, setShowOnboarding,
    onboardStep, setOnboardStep,
    shareMenu, setShareMenu,
    confirmModal, setConfirmModal,
    showTrash, setShowTrash,
    showLinkPicker, setShowLinkPicker,
    photoDeleteMode, setPhotoDeleteMode,
    pjIndex, setPjIndex,
    pjAutoPlay, setPjAutoPlay,
    polaroidMode, setPolaroidMode,
    closeAll,
  };
}
