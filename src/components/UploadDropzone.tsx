"use client";

import { useCallback, useRef, useState } from "react";
import { FileText, UploadCloud, X } from "lucide-react";

interface UploadDropzoneProps {
  file: File | null;
  onFileSelected: (file: File | null) => void;
  disabled?: boolean;
}

const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];

export default function UploadDropzone({ file, onFileSelected, disabled }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSet = useCallback(
    (candidate: File | undefined) => {
      if (!candidate) return;
      const lower = candidate.name.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
        alert("Please upload a .pdf or .docx file.");
        return;
      }
      onFileSelected(candidate);
    },
    [onFileSelected]
  );

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-ink">Your resume</label>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload your resume, PDF or DOCX"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (!disabled) validateAndSet(e.dataTransfer.files?.[0]);
        }}
        className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed px-4 py-6 text-center transition-colors ${
          isDragging ? "border-redpen bg-redpen-soft" : "border-ink/25 bg-white/40 hover:border-ink/40"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => validateAndSet(e.target.files?.[0])}
          disabled={disabled}
        />
        {file ? (
          <div className="flex items-center gap-2 text-ink">
            <FileText size={20} className="shrink-0 text-stamp" aria-hidden />
            <span className="max-w-[220px] truncate text-sm font-medium">{file.name}</span>
            <button
              type="button"
              aria-label="Remove uploaded file"
              onClick={(e) => {
                e.stopPropagation();
                onFileSelected(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="ml-1 rounded-full p-1 text-ink-soft hover:bg-ink/10"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <UploadCloud size={24} className="text-ink-soft" aria-hidden />
            <p className="text-sm text-ink-soft">
              <span className="font-medium text-ink">Tap to upload</span> or drag a file here
            </p>
            <p className="text-xs text-ink-soft">PDF or DOCX</p>
          </>
        )}
      </div>
    </div>
  );
}
