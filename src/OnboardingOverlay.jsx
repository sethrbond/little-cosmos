/* OnboardingOverlay.jsx — Streamlined 3-step first-visit tour */

const F = "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif";

export default function OnboardingOverlay({ worldName, worldType, isSharedWorld, isPartnerWorld, isMyWorld, onboardStep, setOnboardStep, onClose, onboardKey }) {
  const icon = isPartnerWorld ? "💕" : isMyWorld ? "🌍" : worldType === "family" ? "👨‍👩‍👧‍👦" : "👫";

  const steps = [
    {
      icon,
      title: `Welcome to ${worldName || "your world"}`,
      desc: "This is your globe. Every memory you add lights up as a marker. Drag to explore, scroll to zoom.",
      hint: "Your story starts here."
    },
    {
      icon: "✨",
      title: "Add your first memory",
      desc: "Click the + button to pin a memory. Pick a city, add photos, write what you remember.",
      hint: "You can always add more details later."
    },
    {
      icon: "🎬",
      title: "There's more to find",
      desc: "Press ⋯ for tools like Play Story, Photo Map, and Year in Review. They come alive as you add more memories.",
      hint: "The more you add, the more your globe lights up."
    }
  ];

  const step = steps[onboardStep] || steps[0];
  const isLast = onboardStep >= steps.length - 1;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(8,6,14,0.7)", backdropFilter: "blur(6px)" }}>
      <div style={{ maxWidth: 380, width: "90vw", padding: "28px 24px", borderRadius: 18, background: "rgba(20,18,28,0.95)", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 12px 48px rgba(0,0,0,.4)", fontFamily: F, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>{step.icon}</div>
        <h3 style={{ margin: "0 0 10px", fontSize: 18, color: "#e8e0d0", fontWeight: 500 }}>{step.title}</h3>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "rgba(232,224,208,0.7)", lineHeight: 1.6 }}>{step.desc}</p>
        {step.hint && <p style={{ margin: "0 0 18px", fontSize: 11, color: "rgba(232,224,208,0.35)", fontStyle: "italic" }}>{step.hint}</p>}

        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
          {steps.map((_, i) => (
            <button key={"step-" + i} onClick={() => setOnboardStep(i)} aria-label={`Go to step ${i + 1}`} style={{ width: 7, height: 7, borderRadius: "50%", background: i === onboardStep ? "#c9a96e" : "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", padding: 0, transition: "background .3s" }} />
          ))}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          {onboardStep === 0 && (
            <button onClick={() => { localStorage.setItem(onboardKey, "1"); onClose(); }} style={{ padding: "10px 20px", background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(232,224,208,0.4)", fontSize: 12, cursor: "pointer", fontFamily: F }}>Skip tour</button>
          )}
          {onboardStep > 0 && (
            <button onClick={() => setOnboardStep(s => s - 1)} style={{ padding: "10px 20px", background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(232,224,208,0.5)", fontSize: 12, cursor: "pointer", fontFamily: F }}>Back</button>
          )}
          <button onClick={() => {
            if (isLast) { localStorage.setItem(onboardKey, "1"); onClose(); }
            else setOnboardStep(s => s + 1);
          }} style={{ padding: "10px 24px", background: "linear-gradient(135deg, rgba(200,170,110,0.15), rgba(200,170,110,0.08))", border: "1px solid rgba(200,170,110,0.2)", borderRadius: 10, color: "#c9a96e", fontSize: 12, cursor: "pointer", fontFamily: F, fontWeight: 600 }}>
            {isLast ? "Start exploring" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
