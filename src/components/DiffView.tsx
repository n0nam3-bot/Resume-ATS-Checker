"use client";

import { useState } from "react";
import { computeDiff } from "@/lib/diffResume";

interface DiffViewProps {
  original: string;
  revised: string;
}

export default function DiffView({ original, revised }: DiffViewProps) {
  const [mobileTab, setMobileTab] = useState<"before" | "after">("after");
  const diffParts = computeDiff(original, revised);

  const beforeContent = (
    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-ink">
      {diffParts
        .filter((p) => !p.added)
        .map((p, i) =>
          p.removed ? (
            <span key={i} className="rounded bg-redpen-soft px-0.5 text-redpen line-through decoration-redpen/70">
              {p.value}
            </span>
          ) : (
            <span key={i}>{p.value}</span>
          )
        )}
    </pre>
  );

  const afterContent = (
    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-ink">
      {diffParts
        .filter((p) => !p.removed)
        .map((p, i) =>
          p.added ? (
            <span key={i} className="rounded bg-stamp-soft px-0.5 text-ink">
              {p.value}
            </span>
          ) : (
            <span key={i}>{p.value}</span>
          )
        )}
    </pre>
  );

  return (
    <div>
      {/* Mobile: tabbed */}
      <div className="sm:hidden">
        <div className="mb-3 inline-flex rounded-card border border-ink/20 bg-white/40 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMobileTab("before")}
            className={`rounded px-3 py-1.5 ${mobileTab === "before" ? "bg-ink text-paper" : "text-ink-soft"}`}
          >
            Before
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("after")}
            className={`rounded px-3 py-1.5 ${mobileTab === "after" ? "bg-ink text-paper" : "text-ink-soft"}`}
          >
            After
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto rounded-card border border-ink/15 bg-white/50 p-4">
          {mobileTab === "before" ? beforeContent : afterContent}
        </div>
      </div>

      {/* Desktop: side-by-side */}
      <div className="hidden gap-4 sm:grid sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-ink-soft">Before</p>
          <div className="max-h-[65vh] overflow-y-auto rounded-card border border-ink/15 bg-white/50 p-4">
            {beforeContent}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-ink-soft">After</p>
          <div className="max-h-[65vh] overflow-y-auto rounded-card border border-ink/15 bg-white/50 p-4">
            {afterContent}
          </div>
        </div>
      </div>
    </div>
  );
}
