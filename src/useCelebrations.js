import { useState, useEffect, useRef, useMemo } from "react";

// Local copies of utilities — avoids importing from shared modules that pull in heavy deps
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * useCelebrations — anniversary, milestone, and "on this day" logic.
 *
 * deps:
 *   introComplete, isPartnerWorld, config, worldId, userId, stats, entries, selected, sliderDate
 *
 * Returns:
 *   showCelebration, setShowCelebration, celebrationData, setCelebrationData,
 *   isAnniversary, milestoneRef,
 *   onThisDayEntry, setOnThisDayEntry,
 *   onThisDay (array with yearsAgo),
 *   dismissOnThisDay, setDismissOnThisDay
 */
export function useCelebrations(deps) {
  const {
    introComplete,
    isPartnerWorld,
    config,
    worldId,
    userId,
    stats,
    entries,
    selected,
    sliderDate,
  } = deps;

  // ---- State ----
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState(null);
  const [onThisDayEntry, setOnThisDayEntry] = useState(null);
  const [dismissOnThisDay, setDismissOnThisDay] = useState(false);

  // Reset On This Day dismissal when deselecting an entry
  useEffect(() => {
    if (!selected) setDismissOnThisDay(false);
  }, [selected]);

  // ---- Anniversary check ----
  const isAnniversary = useMemo(() => {
    if (!config.startDate) return false;
    const sd = config.startDate.slice(5);
    const today = sliderDate.slice(5);
    return sd === today && sliderDate !== config.startDate;
  }, [sliderDate, config.startDate]);

  // ---- Auto-trigger anniversary celebration (once per session per world) ----
  useEffect(() => {
    if (!introComplete || !isAnniversary || !isPartnerWorld) return;
    const annivKey = `v2_anniv_${worldId || userId}_${todayStr()}`;
    if (localStorage.getItem(annivKey)) return;
    localStorage.setItem(annivKey, '1');
    const years = Math.floor(daysBetween(config.startDate, todayStr()) / 365);
    setCelebrationData({
      type: 'anniversary',
      message: years === 1 ? '1 Year Together' : `${years} Years Together`,
      sub: `${stats.trips} adventures, ${stats.countries} countries, ${Math.round(stats.totalMiles).toLocaleString()} miles`,
    });
    setShowCelebration(true);
    const t = setTimeout(() => setShowCelebration(false), 8000);
    return () => clearTimeout(t);
  }, [introComplete, isAnniversary, isPartnerWorld, config.startDate, worldId, userId, stats.trips, stats.countries, stats.totalMiles]);

  // ---- Milestone celebrations ----
  const milestoneRef = useRef(null);
  useEffect(() => {
    if (!introComplete || entries.length < 2) return;
    const n = entries.length;
    const c = stats.countries;
    const m = Math.round(stats.totalMiles);
    const milestones = [
      { check: n === 5, msg: "5 Adventures!", sub: "Your globe is coming alive", icon: "🎯" },
      { check: n === 10, msg: "10 Adventures!", sub: "Double digits — you're on a roll", icon: "🌟" },
      { check: n === 25, msg: "25 Adventures!", sub: "A seasoned traveler", icon: "✨" },
      { check: n === 50, msg: "50 Adventures!", sub: "Half a century of adventures", icon: "👑" },
      { check: n === 100, msg: "100 Adventures!", sub: "Your globe is legendary", icon: "💎" },
      { check: c === 5, msg: "5 Countries!", sub: "Your world is expanding", icon: "🗺" },
      { check: c === 10, msg: "10 Countries!", sub: "A true globetrotter", icon: "✈️" },
      { check: c === 25, msg: "25 Countries!", sub: "World explorer status", icon: "🌐" },
      { check: m >= 1000 && milestoneRef.current !== '1000mi', msg: "1,000 Miles!", sub: "Your adventures span a thousand miles", icon: "🛤" },
      { check: m >= 10000 && milestoneRef.current !== '10000mi', msg: "10,000 Miles!", sub: "You've circled a good chunk of the Earth", icon: "🚀" },
      { check: m >= 25000 && milestoneRef.current !== '25000mi', msg: "25,000 Miles!", sub: "Nearly around the world", icon: "🌎" },
    ];
    const hit = milestones.find(ms => ms.check);
    if (!hit) return;
    const key = `v2_milestone_${worldId || userId}_${hit.msg}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    if (m >= 25000) milestoneRef.current = '25000mi';
    else if (m >= 10000) milestoneRef.current = '10000mi';
    else if (m >= 1000) milestoneRef.current = '1000mi';
    setCelebrationData({ type: 'milestone', message: hit.msg, sub: hit.sub });
    setShowCelebration(true);
    const t = setTimeout(() => setShowCelebration(false), 5000);
    return () => clearTimeout(t);
  }, [introComplete, entries.length, stats.countries, stats.totalMiles, worldId, userId]);

  // ---- "On This Day" — entry toast (single random pick, auto-dismiss) ----
  useEffect(() => {
    if (!introComplete || entries.length < 2) return;
    const today = todayStr();
    const md = today.slice(5);
    const thisYear = today.slice(0, 4);
    const matches = entries.filter(e => {
      if (!e.dateStart) return false;
      const eYear = e.dateStart.slice(0, 4);
      if (eYear === thisYear) return false;
      const eMd = e.dateStart.slice(5);
      if (eMd === md) return true;
      if (e.dateEnd) {
        const endMd = e.dateEnd.slice(5);
        if (eMd <= md && endMd >= md) return true;
      }
      return false;
    });
    if (matches.length === 0) return;
    const otdKey = `otd_${worldId || userId}_${today}`;
    if (localStorage.getItem(otdKey)) return;
    localStorage.setItem(otdKey, '1');
    const pick = matches[Math.floor(Math.random() * matches.length)];
    setOnThisDayEntry(pick);
    const t = setTimeout(() => setOnThisDayEntry(null), 12000);
    return () => clearTimeout(t);
  }, [introComplete, entries, worldId, userId]);

  // ---- "On This Day" — list for scrapbook card ----
  const onThisDay = useMemo(() => {
    const today = todayStr();
    const md = today.slice(5);
    return entries.filter(e => {
      if (!e.dateStart) return false;
      const eMd = e.dateStart.slice(5);
      const eYear = parseInt(e.dateStart.slice(0, 4));
      const thisYear = parseInt(today.slice(0, 4));
      return eMd === md && eYear < thisYear;
    }).map(e => ({
      ...e,
      yearsAgo: parseInt(todayStr().slice(0, 4)) - parseInt(e.dateStart.slice(0, 4))
    }));
  }, [entries]);

  return {
    showCelebration,
    setShowCelebration,
    celebrationData,
    setCelebrationData,
    isAnniversary,
    milestoneRef,
    onThisDayEntry,
    setOnThisDayEntry,
    onThisDay,
    dismissOnThisDay,
    setDismissOnThisDay,
  };
}
