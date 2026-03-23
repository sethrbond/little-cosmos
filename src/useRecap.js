import { useState, useCallback, useMemo, useEffect } from "react";
import { haversine, daysBetween } from "./geodata.js";

export function useRecap({ sorted, modals, modalDispatch, setSelected, setSliderDate, flyTo }) {
  const [recapAutoPlay, setRecapAutoPlay] = useState(false);
  const [recapPhase, setRecapPhase] = useState('title'); // 'title' | 'stats' | 'journey' | 'summary'
  const [recapStatIdx, setRecapStatIdx] = useState(0); // animated stat reveal counter
  const [recapYear, setRecapYear] = useState(null);
  const [recapIdx, setRecapIdx] = useState(0);

  const startRecap = useCallback((year) => {
    const yearEntries = sorted.filter(e => e.dateStart?.startsWith(String(year)));
    if (yearEntries.length === 0) return;
    modalDispatch({ type: 'OPEN', name: 'showRecap' });
    setRecapYear(year);
    setRecapIdx(-1);
    setRecapPhase('title');
    setRecapStatIdx(0);
    setRecapAutoPlay(false);
    modalDispatch({ type: 'CLOSE', name: 'showStats' });
    setSelected(null);
  }, [sorted]);

  const recapEntries = useMemo(() => {
    if (!recapYear) return [];
    return sorted.filter(e => e.dateStart?.startsWith(String(recapYear)));
  }, [recapYear, sorted]);

  const recapYearStats = useMemo(() => {
    if (!recapEntries.length) return null;
    const countries = new Set();
    const cities = new Set();
    const months = new Set();
    const cityVisits = {};
    let totalDays = 0, photos = 0, totalMiles = 0, favorites = 0;
    let longestTrip = { days: 0, entry: null };
    const allPhotos = [];
    recapEntries.forEach((e, i) => {
      if (e.country) countries.add(e.country);
      if (e.city) { cities.add(e.city); cityVisits[e.city] = (cityVisits[e.city] || 0) + 1; }
      (e.stops || []).forEach(s => { if (s.country) countries.add(s.country); if (s.city) cities.add(s.city); });
      if (e.dateStart) months.add(e.dateStart.slice(5, 7));
      const d = Math.max(1, daysBetween(e.dateStart, e.dateEnd || e.dateStart));
      totalDays += d;
      if (d > longestTrip.days) longestTrip = { days: d, entry: e };
      const pLen = (e.photos || []).length;
      photos += pLen;
      if (pLen > 0) (e.photos || []).forEach(url => allPhotos.push({ url, city: e.city }));
      if (e.favorite) favorites++;
      if (i > 0) totalMiles += haversine(recapEntries[i - 1].lat, recapEntries[i - 1].lng, e.lat, e.lng);
    });
    const topCity = Object.entries(cityVisits).sort((a, b) => b[1] - a[1])[0];
    const firstTrip = recapEntries[0]; // sorted oldest-first
    const lastTrip = recapEntries[recapEntries.length - 1];
    return {
      countries: countries.size, countryNames: [...countries],
      cities: cities.size, entries: recapEntries.length, totalDays, photos, totalMiles,
      months: months.size, favorites,
      longestTrip, topCity: topCity ? { name: topCity[0], count: topCity[1] } : null,
      firstTrip, lastTrip, allPhotos: allPhotos.slice(0, 20),
    };
  }, [recapEntries]);

  // Animated stat reveal for recap stats phase
  useEffect(() => {
    if (!modals.showRecap || recapPhase !== 'stats' || recapStatIdx >= 5) return;
    const t = setTimeout(() => setRecapStatIdx(i => i + 1), 300);
    return () => clearTimeout(t);
  }, [modals.showRecap, recapPhase, recapStatIdx]);

  // Auto-play timer for recap journey phase
  useEffect(() => {
    if (!recapAutoPlay || !modals.showRecap || recapPhase !== 'journey') return;
    const t = setTimeout(() => {
      if (recapIdx >= recapEntries.length - 1) { setRecapPhase('summary'); setRecapAutoPlay(false); }
      else { const next = recapIdx + 1; setRecapIdx(next); const e = recapEntries[next]; if (e) { setSliderDate(e.dateStart); flyTo(e.lat, e.lng, 2.4); } }
    }, 4500);
    return () => clearTimeout(t);
  }, [recapAutoPlay, modals.showRecap, recapPhase, recapIdx, recapEntries]); // flyTo via _flyTo ref (stable)

  const closeRecap = useCallback(() => {
    modalDispatch({ type: 'CLOSE', name: 'showRecap' });
    setRecapYear(null);
    setRecapAutoPlay(false);
    setRecapPhase('title');
  }, []);

  return {
    recapAutoPlay, setRecapAutoPlay,
    recapPhase, setRecapPhase,
    recapStatIdx, setRecapStatIdx,
    recapYear, recapIdx, setRecapIdx,
    startRecap, recapEntries, recapYearStats, closeRecap,
  };
}
