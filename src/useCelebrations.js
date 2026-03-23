import { useState, useEffect, useRef, useMemo } from "react";
import { getMilestoneConfig } from "./worldConfigs.js";

// Local copies of utilities — avoids importing from shared modules that pull in heavy deps
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * useCelebrations — anniversary, milestone, and "on this day" logic.
 *
 * deps:
 *   introComplete, isPartnerWorld, isMyWorld, worldType, worldName,
 *   config, worldId, userId, stats, entries, selected, sliderDate,
 *   modalDispatch, setCelebrationData
 *
 * Returns:
 *   isAnniversary, milestoneRef,
 *   onThisDayEntry, setOnThisDayEntry,
 *   onThisDay (array with yearsAgo),
 *   dismissOnThisDay, setDismissOnThisDay
 */
export function useCelebrations(deps) {
  const {
    introComplete,
    isPartnerWorld,
    isMyWorld,
    worldType,
    worldName,
    config,
    worldId,
    userId,
    stats,
    entries,
    selected,
    sliderDate,
    modalDispatch,
    setCelebrationData,
  } = deps;

  // ---- State ----
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
    if (!introComplete || !isAnniversary) return;
    const annivKey = `v2_anniv_${worldId || userId}_${todayStr()}`;
    if (localStorage.getItem(annivKey)) return;
    localStorage.setItem(annivKey, '1');
    const years = Math.floor(daysBetween(config.startDate, todayStr()) / 365);
    // Personalize anniversary message per world type
    let annivLabel;
    if (isPartnerWorld && config.youName && config.partnerName) {
      annivLabel = years === 1 ? `${config.youName} & ${config.partnerName}'s 1st Year` : `${config.youName} & ${config.partnerName} — ${years} Years`;
    } else if (isPartnerWorld) {
      annivLabel = years === 1 ? '1 Year Together' : `${years} Years Together`;
    } else if (worldType === "friends") {
      annivLabel = years === 1 ? `${worldName || "The Crew"}'s 1st Year` : `${worldName || "The Crew"} — ${years} Years`;
    } else if (worldType === "family") {
      annivLabel = years === 1 ? `${worldName || "Family"}'s 1st Year` : `${worldName || "Family"} — ${years} Years`;
    } else if (isMyWorld) {
      annivLabel = years === 1 ? 'Your 1st Year of Adventures' : `${years} Years of Adventures`;
    } else {
      annivLabel = years === 1 ? '1 Year Together' : `${years} Years Together`;
    }
    setCelebrationData({
      type: 'anniversary',
      message: annivLabel,
      sub: `${stats.trips} adventures, ${stats.countries} countries, ${Math.round(stats.totalMiles).toLocaleString()} miles`,
    });
    modalDispatch({ type: 'OPEN', name: 'showCelebration' });
    const t = setTimeout(() => modalDispatch({ type: 'CLOSE', name: 'showCelebration' }), 8000);
    return () => clearTimeout(t);
  }, [introComplete, isAnniversary, config.startDate, worldId, userId, stats.trips, stats.countries, stats.totalMiles]);

  // ---- Milestone celebrations ----
  const milestoneRef = useRef(null);
  useEffect(() => {
    if (!introComplete || entries.length < 2) return;
    const n = entries.length;
    const c = stats.countries;
    const m = Math.round(stats.totalMiles);
    const msConfig = getMilestoneConfig(worldType, isMyWorld);

    // Build personalized name prefix for milestone messages
    let namePrefix = "";
    if (isPartnerWorld && config.youName && config.partnerName) {
      namePrefix = `${config.youName} & ${config.partnerName}'s `;
    } else if (worldType === "friends" && worldName) {
      namePrefix = `${worldName}'s `;
    } else if (worldType === "family" && worldName) {
      namePrefix = `${worldName}'s `;
    } else if (isMyWorld) {
      namePrefix = "Your ";
    }

    const milestones = [
      ...msConfig.entries.map(ms => ({ check: n === ms.count, msg: namePrefix ? `${namePrefix}${ms.msg}` : ms.msg, sub: ms.sub, icon: ms.icon })),
      ...msConfig.countries.map(ms => ({ check: c === ms.count, msg: namePrefix ? `${namePrefix}${ms.msg}` : ms.msg, sub: ms.sub, icon: ms.icon })),
      ...msConfig.distance.map(ms => ({ check: m >= ms.miles && milestoneRef.current !== `${ms.miles}mi`, msg: namePrefix ? `${namePrefix}${ms.msg}` : ms.msg, sub: ms.sub, icon: ms.icon })),
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
    modalDispatch({ type: 'OPEN', name: 'showCelebration' });
    const t = setTimeout(() => modalDispatch({ type: 'CLOSE', name: 'showCelebration' }), 5000);
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
    isAnniversary,
    milestoneRef,
    onThisDayEntry,
    setOnThisDayEntry,
    onThisDay,
    dismissOnThisDay,
    setDismissOnThisDay,
  };
}
