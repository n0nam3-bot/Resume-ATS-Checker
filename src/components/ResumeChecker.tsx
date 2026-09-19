"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, ChevronDown, RotateCcw, RefreshCw, FileText } from "lucide-react";
import dynamic from "next/dynamic";
import UploadDropzone from "./UploadDropzone";
import JobPostingInput from "./JobPostingInput";
import ScoreBreakdownCard from "./ScoreBreakdown";
import FeedbackList from "./FeedbackList";
import DiffView from "./DiffView";
import DonateButton from "./DonateButton";
import { parseResumeFile } from "@/lib/parseResume";
import { parseJsonResponse } from "@/lib/safeFetchJson";
import { loadPersistedInputs, savePersistedInputs, clearPersistedInputs } from "@/lib/persistedState";
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

/** A sensible starting filename derived from the uploaded resume's own name. */
function buildDefaultFilenameBase(sourceFileName: string): string {
  const stripped = sourceFileName
    .replace(/\s*\(edited\)\s*$/i, "")
    .replace(/\.(pdf|docx|doc)$/i, "")
    .trim();
  return stripped ? `${stripped}-tailored` : "resume-tailored";
}

/** Strips characters invalid in filenames and guarantees a non-empty base. */
function sanitizeFilenameBase(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\.pdf$/i, "").trim();
  return cleaned || "resume-tailored";
}

export default function ResumeChecker() {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // The resume itself is stored as already-extracted text, not a File object — a
  // File can't survive a page reload, but plain text can be persisted to
  // localStorage and re-hydrated directly, which is what makes "stays loaded across
  // visits" possible at all.
  const [resumeText, setResumeText] = useState("");
  const [formatMeta, setFormatMeta] = useState<FormatMeta | null>(null);
  const [resumeFileName, setResumeFileName] = useState("");
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [resumeParseError, setResumeParseError] = useState<string | null>(null);

  const [jobMode, setJobMode] = useState<"url" | "text">("text");
  const [jobUrl, setJobUrl] = useState("");
  const [jobTextInput, setJobTextInput] = useState("");
  const [jobText, setJobText] = useState(""); // resolved/scraped job text, cached

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const [rewritten, setRewritten] = useState("");
  const [editedText, setEditedText] = useState("");
  const [rewriteNotes, setRewriteNotes] = useState<string[]>([]);
  const [usedAI, setUsedAI] = useState(false);
  const [aiProvider, setAiProvider] = useState<string | undefined>();
  const [downloadFilenameBase, setDownloadFilenameBase] = useState("resume-tailored");

  const [showAiSettings, setShowAiSettings] = useState(false);
  const [byokProvider, setByokProvider] = useState<AiProvider>("gemini");
  const [byokKey, setByokKey] = useState("");

  // Hydrate once on mount — only in the browser, only after mount, so this never
  // runs during server-side rendering of this client component.
  useEffect(() => {
    const persisted = loadPersistedInputs();
    if (persisted.resumeText) {
      setResumeText(persisted.resumeText);
      setFormatMeta(persisted.formatMeta);
      setResumeFileName(persisted.resumeFileName);
    }
    setJobMode(persisted.jobMode);
    setJobUrl(persisted.jobUrl);
    setJobTextInput(persisted.jobTextInput);
    setJobText(persisted.jobText);
    setHydrated(true);
  }, []);

  // Persist on every relevant change, but only after hydration has actually run —
  // otherwise the initial blank state would overwrite real saved data with nothing
  // in the instant before hydration completes.
  useEffect(() => {
    if (!hydrated) return;
    savePersistedInputs({ resumeText, formatMeta, resumeFileName, jobMode, jobUrl, jobTextInput, jobText });
  }, [hydrated, resumeText, formatMeta, resumeFileName, jobMode, jobUrl, jobTextInput, jobText]);

  const canAnalyze =
    resumeText.trim().length > 0 && (jobMode === "url" ? jobUrl.trim().length > 0 : jobTextInput.trim().length > 0);

  async function handleResumeFileSelected(file: File | null) {
    setPickedFile(file);
    setResumeParseError(null);
    if (!file) return;
    setIsParsingResume(true);
    try {
      const { text, meta } = await parseResumeFile(file);
      setResumeText(text);
      setFormatMeta(meta);
      setResumeFileName(file.name);
      // A different resume invalidates any score/rewrite computed for the old one.
      setAnalysis(null);
      setRewritten("");
      setEditedText("");
    } catch (err) {
      setResumeParseError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setIsParsingResume(false);
      setPickedFile(null);
    }
  }

  function handleChangeResume() {
    setResumeText("");
    setFormatMeta(null);
    setResumeFileName("");
    setResumeParseError(null);
    setAnalysis(null);
    setRewritten("");
    setEditedText("");
    setStep("upload");
  }

  function handleJobModeChange(mode: "url" | "text") {
    setJobMode(mode);
    setJobText(""); // invalidate the resolved cache — the underlying input changed
  }
  function handleJobUrlChange(url: string) {
    setJobUrl(url);
    setJobText("");
  }
  function handleJobTextInputChange(text: string) {
    setJobTextInput(text);
    setJobText("");
  }

  function handleChangeJob() {
    setJobUrl("");
    setJobTextInput("");
    setJobText("");
    setAnalysis(null);
    setRewritten("");
    setEditedText("");
    setStep("upload");
  }

  /**
   * Shared by the normal "Check my resume" click and the editor's "Re-check this
   * version" action. `overrideResumeText`/`overrideMeta` let a re-check score the
   * in-memory edited text directly, without requiring a download-and-reupload round
   * trip — reading `resumeText` from state alone would race React's state batching
   * if called right after `setResumeText`, so the value is threaded through
   * explicitly instead.
   */
  async function handleAnalyze(overrideResumeText?: string, overrideMeta?: FormatMeta | null) {
    const textToAnalyze = overrideResumeText ?? resumeText;
    if (!textToAnalyze.trim()) return;
    setError(null);
    setStep("analyzing");
    try {
      // Reuse an already-resolved job text (e.g. from a prior check, or a re-check
      // that isn't touching the job posting at all) instead of re-scraping —
      // handleJob*Change always clears this the instant the raw input changes, so
      // a non-empty value here is guaranteed to match the current job fields.
      let resolvedJobText = jobText;
      if (!resolvedJobText) {
        if (jobMode === "url") {
          const res = await fetch("/api/scrape-job", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: jobUrl }),
          });
          const data = await parseJsonResponse<{ text: string }>(res);
          resolvedJobText = data.text;
        } else {
          resolvedJobText = jobTextInput;
        }
      }

      const metaToUse = overrideMeta !== undefined ? overrideMeta : formatMeta;
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: textToAnalyze, jobText: resolvedJobText, meta: metaToUse }),
      });
      const analyzeData = await parseJsonResponse<{ analysis: AnalysisResult }>(analyzeRes);

      setResumeText(textToAnalyze);
      setFormatMeta(metaToUse ?? null);
      setJobText(resolvedJobText);
      setAnalysis(analyzeData.analysis);
      // Only clear the rewrite/edit state once we know the re-check succeeded —
      // clearing it beforehand would lose the user's edited text on a failed request.
      setRewritten("");
      setEditedText("");
      setStep("report");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
      setStep(overrideResumeText !== undefined ? "editor" : "upload");
    }
  }

  /** Re-scores the edited/AI-rewritten text directly — no download or re-upload needed. */
  function handleRecheckEditedVersion() {
    if (!editedText.trim()) return;
    const cleanMeta: FormatMeta = {
      fileType: formatMeta?.fileType ?? "pdf",
      possibleMultiColumn: false,
      hasTables: false,
      hasImages: false,
      wordCount: editedText.split(/\s+/).filter(Boolean).length,
    };
    setResumeFileName((prev) => (prev ? `${prev} (edited)` : "Edited resume"));
    handleAnalyze(editedText, cleanMeta);
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
      const data = await parseJsonResponse<{
        rewrittenResume: string;
        usedAI: boolean;
        aiProvider?: string;
        notes: string[];
      }>(res);

      setRewritten(data.rewrittenResume);
      setEditedText(data.rewrittenResume);
      setRewriteNotes(data.notes ?? []);
      setUsedAI(Boolean(data.usedAI));
      setAiProvider(data.aiProvider);
      setDownloadFilenameBase(buildDefaultFilenameBase(resumeFileName));
      setStep("editor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
      setStep("report");
    }
  }

  function handleStartOver() {
    setStep("upload");
    setError(null);
    setPickedFile(null);
    setResumeParseError(null);
    setResumeText("");
    setFormatMeta(null);
    setResumeFileName("");
    setJobUrl("");
    setJobTextInput("");
    setJobText("");
    setAnalysis(null);
    setRewritten("");
    setEditedText("");
    setDownloadFilenameBase("resume-tailored");
    clearPersistedInputs();
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
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Your resume</label>
            {resumeText ? (
              <ResumeLoadedCard fileName={resumeFileName} onChange={handleChangeResume} />
            ) : (
              <UploadDropzone
                file={pickedFile}
                onFileSelected={handleResumeFileSelected}
                disabled={step === "analyzing" || isParsingResume}
              />
            )}
            {isParsingResume && <p className="mt-1.5 text-xs text-ink-soft">Reading your resume…</p>}
            {resumeParseError && <p className="mt-1.5 text-xs text-redpen">{resumeParseError}</p>}
          </div>

          <JobPostingInput
            mode={jobMode}
            onModeChange={handleJobModeChange}
            url={jobUrl}
            onUrlChange={handleJobUrlChange}
            text={jobTextInput}
            onTextChange={handleJobTextInputChange}
            disabled={step === "analyzing"}
          />
          <button
            type="button"
            onClick={() => handleAnalyze()}
            disabled={!canAnalyze || step === "analyzing" || isParsingResume}
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

          <div className="flex flex-col flex-wrap gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleAutoFix}
              className="inline-flex items-center justify-center gap-2 rounded-card bg-redpen px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <Sparkles size={16} aria-hidden />
              Auto-fix my resume
            </button>
            <button type="button" onClick={handleChangeJob} className="text-sm text-ink-soft hover:text-ink">
              Change job posting
            </button>
            <button type="button" onClick={handleChangeResume} className="text-sm text-ink-soft hover:text-ink">
              Change resume
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
          <div
            className={`rounded-card border p-4 text-sm ${
              usedAI ? "border-redpen/30 bg-redpen-soft text-ink" : "border-ink/15 bg-white/40 text-ink-soft"
            }`}
          >
            {usedAI ? (
              <>
                <p className="font-semibold text-redpen">Verify this before you use it.</p>
                <p className="mt-1">
                  Rewritten using {aiProvider}. This was screened for invented employer names, but that check
                  can&apos;t catch every kind of AI error — for example, true company names given false duties.
                  Check every job title, employer, date, and claim below against your real resume before downloading.
                </p>
              </>
            ) : (
              <p>
                {rewriteNotes[0]} Review the changes below — you can still edit the text before downloading.
              </p>
            )}
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

          <div className="space-y-4 border-t border-ink/10 pt-5">
            <div>
              <label htmlFor="download-filename" className="mb-1.5 block text-sm font-medium text-ink">
                Save as
              </label>
              <div className="flex max-w-sm items-center gap-1.5">
                <input
                  id="download-filename"
                  type="text"
                  value={downloadFilenameBase}
                  onChange={(e) => setDownloadFilenameBase(e.target.value)}
                  placeholder="resume-tailored"
                  className="min-w-0 flex-1 rounded-card border border-ink/25 bg-white/60 px-3 py-2 text-sm text-ink focus-visible:border-redpen"
                />
                <span className="shrink-0 text-sm text-ink-soft">.pdf</span>
              </div>
            </div>

            <div className="flex flex-col flex-wrap gap-3 sm:flex-row sm:items-center">
              <DownloadButton text={editedText} filename={`${sanitizeFilenameBase(downloadFilenameBase)}.pdf`} />
              <button
                type="button"
                onClick={handleRecheckEditedVersion}
                className="inline-flex items-center gap-1.5 rounded-card border border-ink/25 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-white/60"
              >
                <RefreshCw size={14} aria-hidden />
                Re-check this version&apos;s score
              </button>
              <button type="button" onClick={handleChangeJob} className="text-sm text-ink-soft hover:text-ink">
                Change job posting
              </button>
              <button type="button" onClick={handleChangeResume} className="text-sm text-ink-soft hover:text-ink">
                Change resume
              </button>
              <button
                type="button"
                onClick={handleStartOver}
                className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
              >
                <RotateCcw size={14} aria-hidden />
                Start over
              </button>
            </div>
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

function ResumeLoadedCard({ fileName, onChange }: { fileName: string; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-card border border-stamp/30 bg-stamp-soft px-4 py-3">
      <div className="flex min-w-0 items-center gap-2 text-sm text-ink">
        <FileText size={18} className="shrink-0 text-stamp" aria-hidden />
        <span className="truncate">{fileName || "Resume loaded"}</span>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 text-sm font-medium text-ink-soft hover:text-ink"
      >
        Change
      </button>
    </div>
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
