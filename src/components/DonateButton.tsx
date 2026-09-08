import { Heart } from "lucide-react";

// This link is public by design — see docs/RESUME_ATS_CHECKER_PLAN.md §11.
// Replace with your own PayPal.me link (or swap for a hosted PayPal Donate button ID).
const DONATE_URL = "https://streamlabs.com/artofreyes/tip";

export default function DonateButton() {
  return (
    <a
      href={DONATE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-card border border-ink/20 px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-redpen hover:text-redpen"
    >
      <Heart size={14} aria-hidden />
      Support this project
    </a>
  );
}
