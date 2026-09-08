import type { ScoreBreakdown } from "@/lib/types";

const CATEGORY_ROWS: Array<{ key: keyof ScoreBreakdown; label: string; max: number }> = [
  { key: "keywordMatch", label: "Keyword match", max: 40 },
  { key: "formatting", label: "Formatting", max: 30 },
  { key: "contentQuality", label: "Content quality", max: 20 },
  { key: "structure", label: "Structure", max: 10 },
];

function labelColor(label: ScoreBreakdown["label"]) {
  if (label === "Likely to pass") return "text-stamp";
  if (label === "Needs work") return "text-manila-dark";
  return "text-redpen";
}

export default function ScoreBreakdownCard({ score }: { score: ScoreBreakdown }) {
  return (
    <div className="rounded-card border border-ink/15 bg-white/50 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-ink/10 pb-4">
        <span className="font-mono text-5xl font-medium tabular-nums text-ink">{score.total}</span>
        <span className="font-mono text-lg text-ink-soft">/100</span>
        <span className={`ml-auto text-sm font-medium ${labelColor(score.label)}`}>{score.label}</span>
      </div>

      <dl className="mt-4 space-y-3">
        {CATEGORY_ROWS.map((row) => {
          const value = score[row.key] as number;
          const pct = Math.max(0, Math.min(100, (value / row.max) * 100));
          return (
            <div key={row.key}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <dt className="text-ink-soft">{row.label}</dt>
                <dd className="font-mono text-ink">
                  {value}/{row.max}
                </dd>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-dim">
                <div
                  className="h-full rounded-full bg-ink transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
