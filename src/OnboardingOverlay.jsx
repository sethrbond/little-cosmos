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
        ? "This is your family's travel globe. Every trip, vacation, and reunion becomes a glowing marker. Everyone in the family can add entries, photos, and highlights."
        : worldType === "friends"
        ? "This is your crew's travel globe. Group trips, meetups, and adventures all light up as markers. Everyone can add entries, photos, and highlights."
        : "This is a shared travel globe. Every adventure you add together lights up your world as a glowing marker. Everyone in this world can add entries, photos, and highlights.",
      icon: worldType === "family" ? "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}" : worldType === "friends" ? "\u{1F46F}" : "\u{1F30D}",
      hint: worldType === "family" ? "Every family adventure in one place" : worldType === "friends" ? "Your squad's adventures, all mapped out" : "Your globe fills up as you add trips together" },
    startDateStep,
    { title: "Navigate Your Globe",
      body: "Drag to spin the globe. Scroll to zoom in and out. Click any marker to open its details — photos, notes, highlights, and more.",
      icon: "\u{1F5B1}", hint: "Try it! The globe is interactive" },
    { title: "Your Toolkit",
      body: "The toolbar has everything: search, filter by type, stats dashboard, constellation view, gallery, and color customization in settings.",
      icon: "\u{1F9F0}", hint: "The toolbar has all your tools" },
    { title: "Timeline & Story",
      body: "Use the timeline slider at the bottom to travel through time. Press the play button to watch your story unfold, marker by marker.",
      icon: "\u25B6", hint: "The best part \u2014 watching your story play out" },
    { title: "Add Your First Trip",
      body: "Click the + button in the toolbar to add your first entry. Fill in the city, dates, type, and add photos and highlights to bring it to life.",
      icon: "\u2728", hint: "Start with somewhere meaningful" },
  ] : isSharedWorld && isPartnerWorld ? [
    { title: `Welcome to ${worldName || "Your Shared World"}`,
      body: "This is your shared travel globe \u2014 a living map of your relationship. Every adventure you add together lights up as a glowing marker. Both of you can add entries, photos, and highlights.",
      icon: "\u{1F495}", hint: "Your love story, mapped across the world" },
    startDateStep,
    { title: "Navigate Your Globe",
      body: "Drag to spin the globe. Scroll to zoom in and out. Click any marker to open its details \u2014 photos, notes, highlights, and more.",
      icon: "\u{1F5B1}", hint: "Try it! The globe is interactive" },
    { title: "Partner Features",
      body: "Write love letters that live on the globe. Add love notes to any entry. Watch the love thread connect your journeys. See your constellation of adventures. Track days together vs apart.",
      icon: "\u{1F48C}", hint: "These features are unique to partner worlds" },
    { title: "Celebrations & Milestones",
      body: "Your world celebrates with you \u2014 anniversaries trigger a special popup, milestone entries (5, 10, 25, 50, 100) earn badges, and your Year-in-Review replays your story.",
      icon: "\u{1F389}", hint: "Keep adding adventures to unlock celebrations" },
    { title: "Timeline & Story",
      body: "Use the timeline slider to travel through time. Press play to watch your story unfold, marker by marker, with photos fading in at each stop.",
      icon: "\u25B6", hint: "The best part \u2014 watching your story play out" },
    { title: "Add Your First Trip",
      body: "Click + to add your first entry. Fill in the city, dates, and type. Add photos and highlights to bring it to life. Quick-add (\u26A1) is there for fast entries.",
      icon: "\u2728", hint: "Start with somewhere meaningful to you both" },
  ] : isMyWorld ? [
    { title: "Welcome to My World",
      body: "This is your personal travel globe. Every trip you add becomes a glowing marker, building a visual story of everywhere you've been.",
      icon: "\u{1F30D}", hint: "Your world grows with every adventure" },
    { title: "Navigate Your Globe",
      body: "Drag to spin the globe. Scroll to zoom in and out. Click any marker to see its full details \u2014 photos, notes, highlights, and more.",
      icon: "\u{1F5B1}", hint: "Try it! The globe is interactive" },
    { title: "12 Trip Types",
      body: "Adventures, road trips, city breaks, beach getaways, cruises, backpacking, friends trips, family visits, events, nature escapes, work travel, and home. Each gets its own unique marker shape.",
      icon: "\u{1F3A8}", hint: "Different markers for different adventures" },
    { title: "Features to Explore",
      body: "Bucket list for dream destinations. Photo journey for a cinematic slideshow. Year-in-Review to replay any year. Stats dashboard. Constellation view. Custom color themes in settings.",
      icon: "\u{1F9F0}", hint: "All in the toolbar on the left" },
    { title: "Timeline & Story",
      body: "The timeline slider lets you travel through time. Press play to watch your story unfold, trip by trip, with photos at every stop.",
      icon: "\u25B6", hint: "Best with a few entries added" },
    { title: "Add Your First Trip",
      body: "Click + to add your first entry. Pick a city, choose your trip type, add dates, photos, and highlights. Quick-add (\u26A1) is there for speed.",
      icon: "\u2728", hint: "Start with your favorite trip" },
  ] : [
    { title: "Welcome to Our World",
      body: "This is your shared travel globe. Every adventure you add together lights up your world as a glowing marker on the map.",
      icon: "\u{1F30D}", hint: "Your love story, mapped across the world" },
    startDateStep,
    { title: "Navigate Your Globe",
      body: "Drag to spin the globe. Scroll to zoom in and out. Click any marker to open its details \u2014 photos, highlights, and love notes.",
      icon: "\u{1F5B1}", hint: "Try it! The globe is interactive" },
    { title: "Your Toolkit",
      body: "The left toolbar has everything: search, filter, stats, love letters, constellation view, dark mode, and color customization in settings.",
      icon: "\u{1F9F0}", hint: "Lots to discover in the toolbar" },
    { title: "Timeline & Story",
      body: "Use the timeline slider to travel through time. Press play to watch your story unfold across the globe, adventure by adventure.",
      icon: "\u25B6", hint: "The best part \u2014 watching it all play out" },
    { title: "Add Your First Trip",
      body: "Click the + button to add your first entry. Fill in the city, dates, and type, then add photos and highlights to bring it to life.",
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
            <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i === onboardStep ? "#c9a96e" : "rgba(255,255,255,0.12)", transition: "background .3s", boxShadow: i === onboardStep ? "0 0 6px rgba(200,170,110,0.4)" : "none" }} />
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
