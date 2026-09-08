"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

interface DownloadButtonProps {
  text: string;
  filename?: string;
}

export default function DownloadButton({ text, filename = "resume.pdf" }: DownloadButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    setBusy(true);
    try {
      // Loaded only when the button is actually clicked: @react-pdf/renderer resolves
      // differently under Next's server bundling context than in the browser, so it's
      // kept out of the static import graph entirely rather than risking it leaking
      // into server-side rendering.
      const [{ pdf }, { default: ResumePdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/ResumePdfDocument"),
      ]);
      const blob = await pdf(<ResumePdfDocument text={text} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[DownloadButton] PDF generation failed:", err);
      alert("Couldn't generate the PDF — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-card bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />}
      {busy ? "Preparing PDF…" : "Download as PDF"}
    </button>
  );
}
