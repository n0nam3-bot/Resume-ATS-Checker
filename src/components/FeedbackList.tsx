import { AlertTriangle, ListChecks, Scissors, Search } from "lucide-react";
import type { FeedbackCategory, FeedbackItem } from "@/lib/types";

const CATEGORY_META: Record<FeedbackCategory, { label: string; icon: typeof Search; accent: string }> = {
  missing: { label: "Missing", icon: Search, accent: "text-redpen" },
  remove: { label: "Trim or remove", icon: Scissors, accent: "text-redpen" },
  formatting: { label: "Formatting", icon: AlertTriangle, accent: "text-manila-dark" },
  structure: { label: "Structure", icon: ListChecks, accent: "text-ink-soft" },
};

export default function FeedbackList({ items }: { items: FeedbackItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-card border border-stamp/30 bg-stamp-soft px-4 py-3 text-sm text-ink">
        No issues found by the checks below — nice work.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item, i) => {
        const meta = CATEGORY_META[item.category];
        const Icon = meta.icon;
        return (
          <li key={i} className="flex gap-3 rounded-card border border-ink/10 bg-white/40 p-3.5">
            <Icon size={18} className={`mt-0.5 shrink-0 ${meta.accent}`} aria-hidden />
            <div>
              <p className={`text-xs font-semibold ${meta.accent}`}>{meta.label}</p>
              <p className="mt-0.5 text-sm text-ink">{item.message}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
