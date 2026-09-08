"use client";

import { useState } from "react";
import { Loader2, Sparkles, ChevronDown, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import UploadDropzone from "./UploadDropzone";
import JobPostingInput from "./JobPostingInput";
import ScoreBreakdownCard from "./ScoreBreakdown";
import FeedbackList from "./FeedbackList";
import DiffView from "./DiffView";
import DonateButton from "./DonateButton";
import { parseResumeFile } from "@/lib/parseResume";
import type { AnalysisResult, FormatMeta } from "@/lib/types";

// @react-pdf/renderer (pulled in by DownloadButton) resolves differently between
// Next's server bundling context and the browser — loading it client-only avoids
// that mismatch entirely instead of risking it leaking into server-side rendering.
const DownloadButton = dynamic(() => import("./DownloadButton"), {
  ssr: false,
  loading: () => (
    <button disabled className="inline-flex items-center gap-2 rounded-card bg-ink/40 px-4 py-2.5 text-sm font-medium text-paper">
      Loading…
    </button>
  ),
});

type Step = "upload" | "analyzing" | "report" | "rewriting" | "editor";
type AiProvider = "gemini" | "groq" | "openrouter";

export default function ResumeChecker() {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [jobMode, setJobMode] = useState<"url" | "text">("text");
  const [jobUrl, setJobUrl] = useState("");
  const [jobTextInput, setJobTextInput] = useState("");

  const [resumeText, setResumeText] = useState("");
  const [formatMeta, setFormatMeta] = useState<FormatMeta | null>(null);
  const [jobText, setJobText] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const [rewritten, setRewritten] = useState("");
  const [editedText, setEditedText] = useState("");
  const [rewriteNotes, setRewriteNotes] = useState<string[]>([]);
  const [usedAI, setUsedAI] = useState(false);
  const [aiProvider, setAiProvider] = useState<string | undefined>();

  const [showAiSettings, setShowAiSettings] = useState(false);
  const [byokProvider, setByokProvider] = useState<AiProvider>("gemini");
  const [byokKey, setByokKey] = useState("");

  const canAnalyze = file !== null && (jobMode === "url" ? jobUrl.trim().length > 0 : jobTextInput.trim().length > 0);

  async function handleAnalyze() {
    if (!file) return;
    setError(null);
    setStep("analyzing");
    try {
      const { text: parsedResumeText, meta } = await parseResumeFile(file);

      let resolvedJobText = jobTextInput;
      if (jobMode === "url") {
        const res = await fetch("/api/scrape-job", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: jobUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't fetch that job posting.");
        resolvedJobText = data.text;
      }

      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: parsedResumeText, jobText: resolvedJobText, meta }),
      });
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(analyzeData.error || "Couldn't analyze the resume.");

      setResumeText(parsedResumeText);
      setFormatMeta(meta);
      setJobText(resolvedJobText);
      setAnalysis(analyzeData.analysis);
      setStep("report");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
      setStep("upload");
    }
  }

  async function handleAutoFix() {
    if (!analysis) return;
    setError(null);
    setStep("rewriting");
    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobText,
          keywords: analysis.keywords,
          userKey: byokKey ? { provider: byokProvider, key: byokKey } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't rewrite the resume.");

      setRewritten(data.rewrittenResume);
      setEditedText(data.rewrittenResume);
      setRewriteNotes(data.notes ?? []);
      setUsedAI(Boolean(data.usedAI));
      setAiProvider(data.aiProvider);
      setStep("editor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
      setStep("report");
    }
  }

  function handleStartOver() {
    setStep("upload");
    setError(null);
    setFile(null);
    setJobUrl("");
    setJobTextInput("");
    setResumeText("");
    setFormatMeta(null);
    setJobText("");
    setAnalysis(null);
    setRewritten("");
    setEditedText("");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold leading-tight text-ink sm:text-4xl">
            Will your resume pass the filter?
          </h1>
          <p className="mt-3 max-w-prose text-ink-soft">
            Upload a resume and a job posting. Get a real score, exactly what to fix, and a
            rewritten version you can compare side by side before you download it.
          </p>
        </div>
      </header>

      {step === "upload" && (
        <ExampleCorrectionHint />
      )}

      {error && (
        <div className="mb-6 rounded-card border border-redpen/30 bg-redpen-soft px-4 py-3 text-sm text-ink">
          {error}
        </div>
      )}

      {(step === "upload" || step === "analyzing") && (
        <section className="space-y-6 rounded-card border border-ink/15 bg-white/40 p-5 sm:p-6">
          <UploadDropzone file={file} onFileSelected={setFile} disabled={step === "analyzing"} />
          <JobPostingInput
            mode={jobMode}
            onModeChange={setJobMode}
            url={jobUrl}
            onUrlChange={setJobUrl}
            text={jobTextInput}
            onTextChange={setJobTextInput}
            disabled={step === "analyzing"}
          />
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!canAnalyze || step === "analyzing"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-card bg-ink px-4 py-3 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40 sm:w-auto"
          >
            {step === "analyzing" && <Loader2 size={16} className="animate-spin" aria-hidden />}
            {step === "analyzing" ? "Checking your resume…" : "Check my resume"}
          </button>
        </section>
      )}

      {step === "report" && analysis && (
        <section className="space-y-6">
          <ScoreBreakdownCard score={analysis.score} />
          <div>
            <h2 className="mb-3 font-serif text-lg font-semibold text-ink">What to fix</h2>
            <FeedbackList items={analysis.feedback} />
          </div>

          <details className="rounded-card border border-ink/15 bg-white/30 p-4">
            <summary className="cursor-pointer text-sm font-medium text-ink-soft">
              What an ATS actually sees
            </summary>
            <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-xs text-ink-soft">
              {analysis.extractionPreview}
            </pre>
          </details>

          <div className="flex flex-col gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleAutoFix}
              className="inline-flex items-center justify-center gap-2 rounded-card bg-redpen px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <Sparkles size={16} aria-hidden />
              Auto-fix my resume
            </button>
            <button type="button" onClick={handleStartOver} className="text-sm text-ink-soft hover:text-ink">
              Start over
            </button>
          </div>

          <AiSettingsPanel
            open={showAiSettings}
            onToggle={() => setShowAiSettings((v) => !v)}
            provider={byokProvider}
            onProviderChange={setByokProvider}
            apiKey={byokKey}
            onApiKeyChange={setByokKey}
          />
        </section>
      )}

      {step === "rewriting" && (
        <div className="flex flex-col items-center gap-3 py-16 text-ink-soft">
          <Loader2 size={24} className="animate-spin" aria-hidden />
          <p className="text-sm">Rewriting your resume…</p>
        </div>
      )}

      {step === "editor" && (
        <section className="space-y-6">
          <div className="rounded-card border border-ink/15 bg-white/40 p-4 text-sm text-ink-soft">
            {usedAI ? `Rewritten using ${aiProvider}.` : rewriteNotes[0]}
            {" "}Review the changes below — you can still edit the text before downloading.
          </div>

          <DiffView original={resumeText} revised={rewritten} />

          <div>
            <h2 className="mb-2 font-serif text-lg font-semibold text-ink">Final edit before download</h2>
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={14}
              className="w-full resize-y rounded-card border border-ink/25 bg-white/60 p-4 font-sans text-sm text-ink focus-visible:border-redpen"
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:items-center">
            <DownloadButton text={editedText} filename="resume-tailored.pdf" />
            <button
              type="button"
              onClick={handleStartOver}
              className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
            >
              <RotateCcw size={14} aria-hidden />
              Start over
            </button>
          </div>
        </section>
      )}

      <footer className="mt-16 flex items-center justify-between border-t border-ink/10 pt-6 text-sm text-ink-soft">
        <span>Open source and free to run.</span>
        <DonateButton />
      </footer>
    </main>
  );
}

function ExampleCorrectionHint() {
  return (
    <div className="mb-8 rounded-card border border-ink/15 bg-white/30 p-4 text-sm sm:p-5">
      <p className="mb-2 text-ink-soft">This is the kind of fix it makes:</p>
      <p className="font-sans leading-relaxed">
        <span className="rounded bg-redpen-soft px-0.5 text-redpen line-through decoration-redpen/70">
          Responsible for managing a team and improving processes.
        </span>{" "}
        <span className="rounded bg-stamp-soft px-0.5 text-ink">
          Led a 6-person support team and cut average ticket resolution time 40%.
        </span>
      </p>
    </div>
  );
}

function AiSettingsPanel({
  open,
  onToggle,
  provider,
  onProviderChange,
  apiKey,
  onApiKeyChange,
}: {
  open: boolean;
  onToggle: () => void;
  provider: AiProvider;
  onProviderChange: (p: AiProvider) => void;
  apiKey: string;
  onApiKeyChange: (k: string) => void;
}) {
  return (
    <div className="rounded-card border border-ink/10">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm text-ink-soft"
      >
        Add your own free API key (optional)
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="space-y-3 border-t border-ink/10 px-4 py-4">
          <p className="text-xs text-ink-soft">
            The site already tries a shared pool of free-tier AI keys. If that pool is busy, paste
            your own free key here — it&apos;s used only for this request and never stored.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={provider}
              onChange={(e) => onProviderChange(e.target.value as AiProvider)}
              className="rounded-card border border-ink/25 bg-white/60 px-3 py-2 text-sm text-ink"
            >
              <option value="gemini">Google Gemini</option>
              <option value="groq">Groq</option>
              <option value="openrouter">OpenRouter</option>
            </select>
            <input
              type="password"
              placeholder="Paste your API key"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              className="flex-1 rounded-card border border-ink/25 bg-white/60 px-3 py-2 text-sm text-ink"
            />
          </div>
        </div>
      )}
    </div>
  );
}
