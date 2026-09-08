"use client";

import { useState } from "react";
import { Link as LinkIcon, ClipboardList } from "lucide-react";

interface JobPostingInputProps {
  mode: "url" | "text";
  onModeChange: (mode: "url" | "text") => void;
  url: string;
  onUrlChange: (url: string) => void;
  text: string;
  onTextChange: (text: string) => void;
  disabled?: boolean;
}

export default function JobPostingInput({
  mode,
  onModeChange,
  url,
  onUrlChange,
  text,
  onTextChange,
  disabled,
}: JobPostingInputProps) {
  const [localMode, setLocalMode] = useState(mode);

  const setMode = (m: "url" | "text") => {
    setLocalMode(m);
    onModeChange(m);
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-ink">Job posting</label>
      <div className="mb-3 inline-flex rounded-card border border-ink/20 bg-white/40 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("url")}
          disabled={disabled}
          className={`flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors ${
            localMode === "url" ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
          }`}
        >
          <LinkIcon size={14} aria-hidden /> Link
        </button>
        <button
          type="button"
          onClick={() => setMode("text")}
          disabled={disabled}
          className={`flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors ${
            localMode === "text" ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
          }`}
        >
          <ClipboardList size={14} aria-hidden /> Paste text
        </button>
      </div>

      {localMode === "url" ? (
        <input
          type="url"
          inputMode="url"
          placeholder="https://company.com/careers/job-posting"
          value={url}
          disabled={disabled}
          onChange={(e) => onUrlChange(e.target.value)}
          className="w-full rounded-card border border-ink/25 bg-white/60 px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/70 focus-visible:border-redpen"
        />
      ) : (
        <textarea
          placeholder="Paste the full job description here…"
          value={text}
          disabled={disabled}
          onChange={(e) => onTextChange(e.target.value)}
          rows={6}
          className="w-full resize-y rounded-card border border-ink/25 bg-white/60 px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/70 focus-visible:border-redpen"
        />
      )}
      {localMode === "url" && (
        <p className="mt-1.5 text-xs text-ink-soft">
          Some sites block automated fetches — if that happens, switch to &quot;Paste text&quot; instead.
        </p>
      )}
    </div>
  );
}
