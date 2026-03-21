import { useState, useRef, useCallback, useEffect } from "react";

export function usePlayStory({ sorted, togetherList, isPartnerWorld, flyTo, tSpinSpd, showToast, setSelected, setShowGallery, setPhotoIdx, setCardTab, setSliderDate, tZm }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [cinemaEntry, setCinemaEntry] = useState(null);
  const [cinemaPhotoIdx, setCinemaPhotoIdx] = useState(0);
  const [cinemaProgress, setCinemaProgress] = useState(0);
  const [cinemaTotal, setCinemaTotal] = useState(0);
  const [cinemaIdx, setCinemaIdx] = useState(0);
  const [cinemaPhase, setCinemaPhase] = useState('fly');
  const playRef = useRef(null);
  const photoTimerRef = useRef(null);

  const stopPlay = useCallback(() => {
    setIsPlaying(false);
    setCinemaEntry(null);
    setCinemaPhase('fly');
    if (playRef.current) { clearTimeout(playRef.current); playRef.current = null; }
    if (photoTimerRef.current) { clearInterval(photoTimerRef.current); photoTimerRef.current = null; }
    if (tSpinSpd) tSpinSpd.current = 0.001;
  }, [tSpinSpd]);

  const playStory = useCallback(() => {
    const playList = isPartnerWorld ? togetherList : sorted;
    if (playList.length === 0 || isPlaying) return;
    setIsPlaying(true);
    if (setShowGallery) setShowGallery(false);
    if (tSpinSpd) tSpinSpd.current = 0;
    if (tZm) tZm.current = 2.5;
    setCinemaTotal(playList.length);
    const clearPlay = () => { if (playRef.current) { clearTimeout(playRef.current); playRef.current = null; } };
    let idx = 0;
    const step = () => {
      if (idx >= playList.length) {
        stopPlay();
        if (showToast) showToast("Story complete", "✨", 3000);
        return;
      }
      const entry = playList[idx];
      setCinemaIdx(idx);
      setCinemaPhase('fly');
      setCinemaProgress(idx / playList.length);
      if (flyTo) flyTo(entry.lat, entry.lng, 2.5);
      clearPlay();
      playRef.current = setTimeout(() => {
        setCinemaEntry(entry);
        setCinemaPhase('show');
        setCinemaPhotoIdx(0);
        if (setSelected) setSelected(entry);
        if (setPhotoIdx) setPhotoIdx(0);
        if (setCardTab) setCardTab("overview");
        if (setSliderDate) setSliderDate(entry.dateStart);
        const photoCount = entry.photos?.length || 0;
        const showTime = 2000 + photoCount * 1200;
        if (photoCount > 1 && photoTimerRef.current === null) {
          let pi = 0;
          photoTimerRef.current = setInterval(() => { pi = (pi + 1) % photoCount; setCinemaPhotoIdx(pi); }, 2000);
        }
        clearPlay();
        playRef.current = setTimeout(() => {
          if (photoTimerRef.current) { clearInterval(photoTimerRef.current); photoTimerRef.current = null; }
          setCinemaPhase('transition');
          clearPlay();
          playRef.current = setTimeout(() => { idx++; step(); }, 1000);
        }, showTime);
      }, 1500);
    };
    step();
  }, [togetherList, sorted, isPartnerWorld, isPlaying, stopPlay, showToast, flyTo, tSpinSpd, tZm, setSelected, setShowGallery, setPhotoIdx, setCardTab, setSliderDate]);

  // Cleanup timers on unmount to prevent firing on unmounted component
  useEffect(() => {
    return () => {
      if (playRef.current) { clearTimeout(playRef.current); playRef.current = null; }
      if (photoTimerRef.current) { clearInterval(photoTimerRef.current); photoTimerRef.current = null; }
    };
  }, []);

  return { isPlaying, cinemaEntry, cinemaPhotoIdx, cinemaProgress, cinemaTotal, cinemaIdx, cinemaPhase, stopPlay, playStory, playRef, photoTimerRef };
}
