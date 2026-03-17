import { useState, useRef, useCallback } from "react";

export function usePlayStory(sorted, togetherList, isPartnerWorld, flyTo) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [cinemaEntry, setCinemaEntry] = useState(null);
  const [cinemaPhotoIdx, setCinemaPhotoIdx] = useState(0);
  const [cinemaProgress, setCinemaProgress] = useState(0);
  const [cinemaTotal, setCinemaTotal] = useState(0);
  const [cinemaIdx, setCinemaIdx] = useState(0);
  const [cinemaPhase, setCinemaPhase] = useState('fly');

  const photoTimerRef = useRef(null);
  const playRef = useRef(null);

  const stopPlay = useCallback(() => {
    setIsPlaying(false);
    setCinemaEntry(null);
    setCinemaPhase('fly');
    if (playRef.current) { clearTimeout(playRef.current); playRef.current = null; }
    if (photoTimerRef.current) { clearInterval(photoTimerRef.current); photoTimerRef.current = null; }
  }, []);

  const playStory = useCallback(({ setSelected, setShowGallery, setPhotoIdx, setCardTab, setSliderDate, tSpinSpd, tZm, showToast }) => {
    const playList = isPartnerWorld ? togetherList : sorted;
    if (playList.length === 0 || isPlaying) return;
    setIsPlaying(true);
    setSelected(null);
    setShowGallery(false);
    setCinemaTotal(playList.length);
    let idx = 0;

    const clearPlay = () => { if (playRef.current) { clearTimeout(playRef.current); playRef.current = null; } };
    const clearPhotoTimer = () => { if (photoTimerRef.current) { clearInterval(photoTimerRef.current); photoTimerRef.current = null; } };

    const step = () => {
      if (idx >= playList.length) { stopPlay(); showToast("Story complete", "✨", 3000); return; }
      const entry = playList[idx];
      setCinemaIdx(idx);
      setCinemaProgress(idx / playList.length);
      setCinemaPhase('fly');
      setCinemaEntry(entry);
      setCinemaPhotoIdx(0);
      setSliderDate(entry.dateStart);
      flyTo(entry.lat, entry.lng, 2.4);

      clearPlay();
      playRef.current = setTimeout(() => {
        setCinemaPhase('show');
        setSelected(entry);
        setPhotoIdx(0);
        setCardTab("overview");

        const photos = entry.photos || [];
        if (photos.length > 1) {
          let pIdx = 0;
          clearPhotoTimer();
          photoTimerRef.current = setInterval(() => {
            pIdx = (pIdx + 1) % photos.length;
            setCinemaPhotoIdx(pIdx);
          }, 2000);
          clearPlay();
          playRef.current = setTimeout(() => {
            clearPhotoTimer();
            setCinemaPhase('transition');
            setSelected(null);
            idx++;
            if (idx < playList.length) {
              tSpinSpd.current = 0.015;
              tZm.current = 3.0;
              clearPlay();
              playRef.current = setTimeout(step, 1000);
            } else {
              setCinemaProgress(1);
              clearPlay();
              playRef.current = setTimeout(() => { stopPlay(); showToast("Story complete", "✨", 3000); }, 800);
            }
          }, Math.min(5000, 2000 + photos.length * 1200));
        } else {
          clearPlay();
          playRef.current = setTimeout(() => {
            setCinemaPhase('transition');
            setSelected(null);
            idx++;
            if (idx < playList.length) {
              tSpinSpd.current = 0.015;
              tZm.current = 3.0;
              clearPlay();
              playRef.current = setTimeout(step, 1000);
            } else {
              setCinemaProgress(1);
              clearPlay();
              playRef.current = setTimeout(() => { stopPlay(); showToast("Story complete", "✨", 3000); }, 800);
            }
          }, 4000);
        }
      }, 1600);
    };
    step();
  }, [togetherList, sorted, isPartnerWorld, isPlaying, stopPlay, flyTo]);

  return {
    isPlaying,
    cinemaEntry, cinemaPhotoIdx, cinemaProgress, cinemaTotal, cinemaIdx, cinemaPhase,
    stopPlay, playStory, playRef, photoTimerRef,
  };
}
