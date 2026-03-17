import { useState, useEffect, useRef, useMemo } from "react";
import { todayStr, daysBetween } from "./globeUtils.js";

/**
 * useCelebrations — manages anniversary, milestone, and "on this day" logic.
 *
 * @param {object} deps
 * @param {boolean}  deps.introComplete
 * @param {boolean}  deps.isPartnerWorld
 * @param {object}   deps.config          - world config ({ startDate, ... })
 * @param {string}   deps.sliderDate
 * @param {string}   deps.worldId
 * @param {string}   deps.userId
 * @param {object}   deps.stats           - { trips, countries, totalMiles }
 * @param {object}   deps.data            - { entries: [] }
 * @param {object}   deps.TYPES           - entry type map
 * @param {object}   deps.DEFAULT_TYPE    - fallback type
 * @param {function} deps.showToast
 */
export function useCelebrations(deps) {
  const {
    introComplete, isPartnerWorld, config, sliderDate,
    worldId, userId, stats, data, TYPES, DEFAULT_TYPE, showToast,
  } = deps;

  // ---- State ----
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState(null); // { type: 'first'|'anniversary'|'milestone', message, sub }
  const [onThisDayEntry, setOnThisDayEntry] = useState(null);
  const [dismissOnThisDay, setDismissOnThisDay] = useState(false);

  // ---- Anniversary check ----
  const isAnniversary = useMemo(() => {
    if (!config.startDate) return false;
    const sd = config.startDate.slice(5);
    const today = sliderDate.slice(5);
    return sd === today && sliderDate !== config.startDate;
  }, [sliderDate, config.startDate]);

  // Auto-trigger anniversary celebration (once per session per world)
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
    if (!introComplete || data.entries.length < 2) return;
    const n = data.entries.length;
    const c = stats.countries;
    const m = Math.round(stats.totalMiles);
    const milestones = [
      { check: n === 5, msg: "5 Adventures!", sub: "Your globe is coming alive", icon: "\uD83C\uDFAF" },
      { check: n === 10, msg: "10 Adventures!", sub: "Double digits \u2014 you\u2019re on a roll", icon: "\uD83C\uDF1F" },
      { check: n === 25, msg: "25 Adventures!", sub: "A seasoned traveler", icon: "\u2728" },
      { check: n === 50, msg: "50 Adventures!", sub: "Half a century of adventures", icon: "\uD83D\uDC51" },
      { check: n === 100, msg: "100 Adventures!", sub: "Your globe is legendary", icon: "\uD83D\uDC8E" },
      { check: c === 5, msg: "5 Countries!", sub: "Your world is expanding", icon: "\uD83D\uDDFA" },
      { check: c === 10, msg: "10 Countries!", sub: "A true globetrotter", icon: "\u2708\uFE0F" },
      { check: c === 25, msg: "25 Countries!", sub: "World explorer status", icon: "\uD83C\uDF10" },
      { check: m >= 1000 && milestoneRef.current !== '1000mi', msg: "1,000 Miles!", sub: "Your adventures span a thousand miles", icon: "\uD83D\uDEE4" },
      { check: m >= 10000 && milestoneRef.current !== '10000mi', msg: "10,000 Miles!", sub: "You\u2019ve circled a good chunk of the Earth", icon: "\uD83D\uDE80" },
      { check: m >= 25000 && milestoneRef.current !== '25000mi', msg: "25,000 Miles!", sub: "Nearly around the world", icon: "\uD83C\uDF0E" },
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
  }, [introComplete, data.entries.length, stats.countries, stats.totalMiles, worldId, userId]);

  // ---- "On This Day" entry banner (top of globe) ----
  useEffect(() => {
    if (!introComplete || data.entries.length < 2) return;
    const today = todayStr();
    const md = today.slice(5); // "MM-DD"
    const thisYear = today.slice(0, 4);
    const matches = data.entries.filter(e => {
      if (!e.dateStart) return false;
      const eYear = e.dateStart.slice(0, 4);
      if (eYear === thisYear) return false; // only past years
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
  }, [introComplete, data.entries, worldId, userId]);

  // ---- "On This Day" memories list (bottom card) ----
  const onThisDay = useMemo(() => {
    const today = todayStr();
    const md = today.slice(5); // "MM-DD"
    return data.entries.filter(e => {
      if (!e.dateStart) return false;
      const eMd = e.dateStart.slice(5);
      const eYear = parseInt(e.dateStart.slice(0, 4));
      const thisYear = parseInt(today.slice(0, 4));
      return eMd === md && eYear < thisYear;
    }).map(e => ({
      ...e,
      yearsAgo: parseInt(today.slice(0, 4)) - parseInt(e.dateStart.slice(0, 4))
    }));
  }, [data.entries]);

  // Show "On This Day" toast on load (once per session)
  const onThisDayShownRef = useRef(false);
  useEffect(() => {
    if (onThisDayShownRef.current) return;
    if (onThisDay.length > 0 && introComplete) {
      onThisDayShownRef.current = true;
      const mem = onThisDay[0];
      const label = mem.yearsAgo === 1 ? "1 year ago today" : `${mem.yearsAgo} years ago today`;
      const icon = (TYPES[mem.type] || DEFAULT_TYPE).icon;
      showToast(`${label}: ${mem.city} ${icon}`, "\uD83D\uDCAB", 5000);
    }
  }, [onThisDay, introComplete, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    showCelebration,
    celebrationData,
    setShowCelebration,
    setCelebrationData,
    onThisDayEntry,
    setOnThisDayEntry,
    onThisDay,
    dismissOnThisDay,
    setDismissOnThisDay,
    milestoneRef,
  };
}
