export type FileKind = "pdf" | "docx";

/** Structural signals gathered while parsing the resume, used by the formatting score. */
export interface FormatMeta {
  fileType: FileKind;
  possibleMultiColumn: boolean;
  hasTables: boolean;
  hasImages: boolean;
  pageCount?: number;
  wordCount: number;
}

export interface ScoreBreakdown {
  keywordMatch: number; // out of 40
  formatting: number; // out of 30
  contentQuality: number; // out of 20
  structure: number; // out of 10
  total: number; // out of 100
  label: "Likely to pass" | "Needs work" | "High risk of rejection";
}

export interface KeywordResult {
  matched: string[];
  missing: string[];
}

export type FeedbackCategory = "missing" | "remove" | "formatting" | "structure";

export interface FeedbackItem {
  category: FeedbackCategory;
  message: string;
}

export interface AnalysisResult {
  score: ScoreBreakdown;
  keywords: KeywordResult;
  feedback: FeedbackItem[];
  extractionPreview: string;
}

export interface RewriteResult {
  rewrittenResume: string;
  usedAI: boolean;
  aiProvider?: string;
  notes: string[];
}

export interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}
