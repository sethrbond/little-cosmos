/* OnboardingOverlay.jsx — First-visit tour extracted from OurWorld.jsx */
import { useState } from "react";

const F = "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif";

export default function OnboardingOverlay({ worldName, worldType, isSharedWorld, isPartnerWorld, isMyWorld, onboardStep, setOnboardStep, onClose, onboardKey, startDate, onStartDateChange }) {
  const [localDate, setLocalDate] = useState(startDate || "");

  const startDateStep = isSharedWorld ? {
    title: "Set Your Start Date",
    body: isPartnerWorld
      ? "When did your story begin? Set the date you became a couple — this powers your timeline, anniversary celebrations, and 'days together' counter."
      : worldType === "family"
      ? "When should your family timeline start? Pick a date like a first family trip or a meaningful milestone."
      : worldType === "friends"
      ? "When did your crew's adventures begin? Pick the date of your first trip or when the group came together."
      : "When did this shared journey begin? This date anchors your timeline and story playback.",
    icon: isPartnerWorld ? "💕" : "📅",
    hint: isPartnerWorld ? "This date is used for anniversaries and milestones" : "You can always change this later in Settings",
    interactive: true,
  } : null;

  const baseSteps = isSharedWorld && !isPartnerWorld ? [
    { title: `Welcome to ${worldName || "Your Shared World"}`,
      body: worldType === "family"
        ? "Your family's travel globe. Trips, vacations, reunions \u2014 everyone can add memories and watch them glow."
        : worldType === "friends"
        ? "Your crew's travel globe. Group trips, meetups, adventures \u2014 everyone can add memories and watch them glow."
        : "A shared travel globe. Every adventure lights up as a marker. Everyone in this world can add to it.",
      icon: worldType === "family" ? "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}" : worldType === "friends" ? "\u{1F46F}" : "\u{1F30D}",
      hint: worldType === "family" ? "Every family adventure in one place" : worldType === "friends" ? "Your squad's adventures, all mapped out" : "It grows as you add trips together" },
    startDateStep,
    { title: "Navigate Your Globe",
      body: "Drag to spin the globe. Scroll to zoom in and out. Click any glowing marker to open its details \u2014 photos, notes, and highlights.",
      icon: "\u{1F5B1}", hint: "Try it! The globe is interactive" },
    { title: "Your Toolkit",
      body: "The toolbar on the left has everything you need \u2014 search entries, filter by trip type, view stats, see your trips as a constellation, browse your scrapbook, and customize your world's colors.",
      icon: "\u{1F9F0}", hint: "Explore it at your own pace" },
    { title: "Timeline & Story",
      body: "Use the timeline slider at the bottom to travel through time. Press the play button to watch your story unfold across the globe, marker by marker.",
      icon: "\u25B6", hint: "The best part \u2014 watching it all play out" },
    { title: "Add Your First Trip",
      body: "Hit + in the toolbar to add your first entry. Pick a city, add dates and photos \u2014 your marker will glow to life on the globe.",
      icon: "\u2728", hint: "Start with somewhere meaningful" },
  ] : isSharedWorld && isPartnerWorld ? [
    { title: `Welcome to ${worldName || "Your Shared World"}`,
      body: "A living map of your relationship. Every adventure lights up as a marker. Both of you can add to it.",
      icon: "\u{1F495}", hint: "Your love story, mapped across the world" },
    startDateStep,
    { title: "Navigate Your Globe",
      body: "Drag to spin the globe. Scroll to zoom in and out. Click any glowing marker to open its details \u2014 photos, notes, and love notes.",
      icon: "\u{1F5B1}", hint: "Try it! The globe is interactive" },
    { title: "Partner Features",
      body: "Write love letters that live hidden on the globe. Add love notes to any entry. Watch the love thread connect your journeys across the map. See your adventures form a constellation. Track days together vs apart.",
      icon: "\u{1F48C}", hint: "These are unique to partner worlds" },
    { title: "Celebrations & Milestones",
      body: "Your world celebrates with you \u2014 anniversaries trigger a special moment, milestone entries earn badges, and you can replay any year as a cinematic Year-in-Review.",
      icon: "\u{1F389}", hint: "They unlock as you add adventures" },
    { title: "Timeline & Story",
      body: "Use the timeline slider at the bottom to travel through time. Press play to watch your story unfold across the globe, with photos fading in at each stop.",
      icon: "\u25B6", hint: "The best part \u2014 watching it all play out" },
    { title: "Add Your First Trip",
      body: "Hit + to add your first entry. Pick a city, add dates and photos. Quick-add (\u26A1) is there when you want speed.",
      icon: "\u2728", hint: "Start with somewhere meaningful to you both" },
  ] : isMyWorld ? [
    { title: "Welcome to My World",
      body: "Your personal travel globe. Every trip becomes a glowing marker \u2014 a visual story of everywhere you've been.",
      icon: "\u{1F30D}", hint: "Your world grows with every adventure" },
    { title: "Navigate Your Globe",
      body: "Drag to spin the globe. Scroll to zoom in and out. Click any glowing marker to see its full details \u2014 photos, notes, and highlights.",
      icon: "\u{1F5B1}", hint: "Try it! The globe is interactive" },
    { title: "12 Trip Types",
      body: "Adventures, road trips, city breaks, beach getaways, backpacking, and more. Each type gets its own unique marker shape on the globe, so you can tell them apart at a glance.",
      icon: "\u{1F3A8}", hint: "You'll see the shapes as you add trips" },
    { title: "Features to Explore",
      body: "Save dream destinations to your bucket list. Play a cinematic photo journey. Replay any year as a Year-in-Review recap. See your trips as a constellation. Customize your world's colors in settings \u2014 all from the toolbar.",
      icon: "\u{1F9F0}", hint: "No rush \u2014 they're always there" },
    { title: "Timeline & Story",
      body: "Use the timeline slider at the bottom to travel through time. Press play to watch your story unfold across the globe, trip by trip.",
      icon: "\u25B6", hint: "Best with a few entries added" },
    { title: "Add Your First Trip",
      body: "Hit + in the toolbar to add your first entry. Pick a city, choose the trip type, and add photos to bring it to life. Quick-add (\u26A1) is there when you want speed.",
      icon: "\u2728", hint: "Start with your favorite trip" },
  ] : [
    { title: "Welcome to Our World",
      body: "Your shared travel globe. Every adventure lights up as a glowing marker.",
      icon: "\u{1F30D}", hint: "Your love story, mapped across the world" },
    startDateStep,
    { title: "Navigate Your Globe",
      body: "Drag to spin the globe. Scroll to zoom in and out. Click any glowing marker to open its details \u2014 photos, highlights, and love notes.",
      icon: "\u{1F5B1}", hint: "Try it! The globe is interactive" },
    { title: "Your Toolkit",
      body: "The toolbar on the left has everything \u2014 search entries, filter by type, view your stats, write love letters, see your trips as a constellation, and customize colors in settings.",
      icon: "\u{1F9F0}", hint: "Explore at your own pace" },
    { title: "Timeline & Story",
      body: "Use the timeline slider at the bottom to travel through time. Press play to watch your story unfold across the globe, adventure by adventure.",
      icon: "\u25B6", hint: "The best part \u2014 watching it all play out" },
    { title: "Add Your First Trip",
      body: "Hit + to add your first entry. Pick a city, add dates and photos \u2014 your marker will glow to life on the globe.",
      icon: "\u2728", hint: "Start with somewhere special to you both" },
  ];

  // Filter out null steps (startDateStep is null for non-shared worlds)
  const steps = baseSteps.filter(Boolean);
  const step = steps[onboardStep];

  return (
    <div role="dialog" aria-modal="true" aria-label="Welcome tour" style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(4,2,10,0.50)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .5s ease" }}>
      <div style={{ background: "rgba(22,16,32,0.88)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 22, padding: "36px 32px", width: 380, maxWidth: "90vw", textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>{step.icon}</div>
        <div style={{ fontSize: 19, fontWeight: 500, color: "#e8e0d0", marginBottom: 10, letterSpacing: ".04em" }}>{step.title}</div>
        <div style={{ fontSize: 13, color: "#a098a8", lineHeight: 1.7, marginBottom: 10 }}>{step.body}</div>

        {/* Interactive date picker for start date step */}
        {step.interactive && (
          <div style={{ margin: "14px 0 6px" }}>
            <input
              type="date"
              value={localDate}
              onChange={e => {
                setLocalDate(e.target.value);
                if (onStartDateChange && e.target.value) onStartDateChange(e.target.value);
              }}
              style={{
                padding: "10px 16px", background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10,
                color: "#e8e0d0", fontSize: 14, fontFamily: F,
                outline: "none", cursor: "pointer", textAlign: "center",
                width: "auto", minWidth: 180,
              }}
            />
            {!localDate && (
              <div style={{ fontSize: 10, color: "#605868", marginTop: 6 }}>Optional — you can skip this and set it later</div>
            )}
          </div>
        )}

        {step.hint && <div style={{ fontSize: 10, color: "#c9a96e", letterSpacing: "0.5px", marginBottom: 18, fontStyle: "italic" }}>{step.hint}</div>}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          {steps.map((_, i) => (
            <div key={"onb-" + i} role="button" aria-label={`Go to step ${i + 1}`} tabIndex={0} onClick={() => setOnboardStep(i)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOnboardStep(i); } }} style={{ minWidth: 24, minHeight: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: i === onboardStep ? "#c9a96e" : "rgba(255,255,255,0.12)", transition: "background .3s", boxShadow: i === onboardStep ? "0 0 6px rgba(200,170,110,0.4)" : "none" }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          {onboardStep > 0 && (
            <button onClick={() => setOnboardStep(s => s - 1)}
              style={{ padding: "9px 20px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, color: "#a098a8", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>
              Back
            </button>
          )}
          <button onClick={() => {
            if (onboardStep < steps.length - 1) { setOnboardStep(s => s + 1); }
            else { onClose(); localStorage.setItem(onboardKey, "1"); }
          }}
            style={{ padding: "9px 24px", background: "linear-gradient(135deg, #c9a96e, #b8944f)", border: "none", borderRadius: 12, color: "#1a1520", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 2px 12px rgba(200,170,110,0.2)" }}>
            {onboardStep < steps.length - 1 ? "Next" : "Start Exploring"}
          </button>
        </div>
        {onboardStep === 0 && (
          <button onClick={() => { onClose(); localStorage.setItem(onboardKey, "1"); }}
            style={{ marginTop: 14, background: "none", border: "none", color: "#605868", fontSize: 11, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.3px" }}>
            Skip tour
          </button>
        )}
      </div>
    </div>
  );
}
