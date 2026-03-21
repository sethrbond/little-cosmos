import { useState, useRef, useCallback, useEffect, useReducer } from "react";

export const modalReducer = (state, action) => {
  switch (action.type) {
    case 'OPEN': return { ...state, [action.name]: true };
    case 'CLOSE': return { ...state, [action.name]: false };
    case 'TOGGLE': return { ...state, [action.name]: !state[action.name] };
    case 'CLOSE_ALL': return Object.fromEntries(Object.keys(state).map(k => [k, false]));
    default: return state;
  }
};

const INITIAL_MODALS = {
  showAdd: false, showSettings: false, showGallery: false, showFilter: false,
  showStats: false, showRecap: false, showSearch: false, showLoveThread: false,
  showConstellation: false, showRoutes: false, showDreams: false, showShortcuts: false,
  showPhotoJourney: false, showPhotoMap: false, showMilestones: false, showTravelStats: false,
  showExportHub: false, showYearReview: false, showTemplates: false, showTrash: false,
  showTripJournal: false, showLinkPicker: false, showCelebration: false, quickAddMode: false,
};

let _toastId = 0;
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const [modals, modalDispatch] = useReducer(modalReducer, INITIAL_MODALS);
  const dismissTimers = useRef([]);
  const toastTimerKeys = useRef(new Set());

  const showToast = useCallback((message, icon = "✓", duration = 2500, undoAction = null) => {
    const t = { message, icon, duration, key: ++_toastId, undoAction };
    setToasts(prev => [...prev.slice(-4), t]);
  }, []);

  const dismissToast = useCallback((key) => {
    setToasts(prev => prev.map(t => t.key === key ? { ...t, exiting: true } : t));
    const t = setTimeout(() => setToasts(prev => prev.filter(t => t.key !== key)), 300);
    dismissTimers.current.push(t);
  }, []);

  const handleUndo = useCallback((toast) => {
    if (!toast) return;
    if (toast.undoAction) toast.undoAction();
    dismissToast(toast.key);
  }, [dismissToast]);

  // Auto-dismiss
  useEffect(() => {
    if (toasts.length === 0) return;
    const newTimers = [];
    toasts.forEach(t => {
      if (toastTimerKeys.current.has(t.key)) return;
      toastTimerKeys.current.add(t.key);
      newTimers.push(setTimeout(() => {
        dismissToast(t.key);
        toastTimerKeys.current.delete(t.key);
      }, t.duration || 2500));
    });
    return () => newTimers.forEach(clearTimeout);
  }, [toasts, dismissToast]);

  // Cleanup on unmount
  useEffect(() => () => dismissTimers.current.forEach(clearTimeout), []);

  return { toasts, showToast, dismissToast, handleUndo, modals, modalDispatch };
}
