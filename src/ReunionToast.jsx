import { useRef, useEffect } from "react";

/**
 * Lazy-loaded reunion detection.
 * Fires a toast when partners transition from apart → together.
 * Pure side-effect component — renders nothing.
 */
export default function ReunionToast({ areTogether, worldId, showToast, isPartnerWorld }) {
  const prevRef = useRef(null); // null = first render, skip transition detection
  const worldRef = useRef(worldId);

  useEffect(() => {
    // Reset tracking when world changes
    if (worldRef.current !== worldId) {
      worldRef.current = worldId;
      prevRef.current = null;
      return;
    }

    if (!isPartnerWorld) return;

    // Detect false → true transition (reunion)
    if (prevRef.current === false && areTogether === true) {
      showToast("You're in the same place! 💕", "🎉", 5000);
    }

    prevRef.current = areTogether;
  }, [areTogether, worldId, isPartnerWorld, showToast]);

  return null;
}
