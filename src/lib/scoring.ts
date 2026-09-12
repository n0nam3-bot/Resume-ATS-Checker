import type {
  AnalysisResult,
  FeedbackItem,
  FormatMeta,
  KeywordResult,
  ScoreBreakdown,
} from "./types";
import { matchKeywords } from "./keywordExtract";

const WEAK_PHRASES = [
  "team player", "hard worker", "hardworking", "go-getter", "results-oriented",
  "responsible for", "duties included", "detail-oriented", "self-starter",
  "references available upon request", "think outside the box", "synergy",
  "excellent communication skills", "proven track record",
];

const PRONOUN_PATTERN = /\b(i|my|me|myself)\b/i;
const QUANTIFIER_PATTERN = /(\$\s?\d|%|\b\d{1,3}(,\d{3})*\b|\b\d+\s?(x|hours|weeks|months|years|users|customers|clients))/i;
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_PATTERN = /(\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;

function scoreLabel(total: number): ScoreBreakdown["label"] {
  if (total >= 80) return "Likely to pass";
  if (total >= 60) return "Needs work";
  return "High risk of rejection";
}

function computeKeywordScore(keywords: KeywordResult): number {
  const totalKeywords = keywords.matched.length + keywords.missing.length;
  if (totalKeywords === 0) return 30; // no detectable requirements — don't penalize the resume
  const ratio = keywords.matched.length / totalKeywords;
  return Math.round(ratio * 40);
}

function computeFormattingScore(meta: FormatMeta, feedback: FeedbackItem[]): number {
  let score = 30;
  if (meta.possibleMultiColumn) {
    score -= 12;
    feedback.push({
      category: "formatting",
      message:
        "This resume may use a multi-column layout. Many ATS parsers read left-to-right across the whole page and scramble multi-column text — a single-column layout is safer.",
    });
  }
  if (meta.hasTables) {
    score -= 10;
    feedback.push({
      category: "formatting",
      message:
        "Tables were detected. ATS parsers frequently drop or misread table content — move that information into plain paragraphs or bullet lists.",
    });
  }
  if (meta.hasImages) {
    score -= 8;
    feedback.push({
      category: "formatting",
      message:
        "Images or icons were detected (e.g. a headshot, skill-rating graphics). ATS systems can't read them at all — replace icon-based ratings with plain text.",
    });
  }
  if (meta.wordCount < 150) {
    score -= 5;
    feedback.push({
      category: "formatting",
      message: "The extracted text is quite short — check that the file isn't a scanned image without a selectable text layer.",
    });
  }
  if (meta.wordCount > 1300) {
    score -= 3;
    feedback.push({
      category: "formatting",
      message: "This resume runs long. Most ATS-friendly resumes are 1–2 pages (roughly 400–900 words).",
    });
  }
  return Math.max(0, score);
}

function computeContentQualityScore(resumeText: string, feedback: FeedbackItem[]): number {
  let score = 20;
  const lines = resumeText.split(/\n+/).filter((l) => l.trim().length > 0);
  const bulletLikeLines = lines.filter((l) => /^[\s]*[-•*]|^\s*\d+\./.test(l) || l.trim().length < 200);

  const quantified = bulletLikeLines.filter((l) => QUANTIFIER_PATTERN.test(l));
  const quantifiedRatio = bulletLikeLines.length > 0 ? quantified.length / bulletLikeLines.length : 0;
  if (quantifiedRatio < 0.2) {
    score -= 7;
    feedback.push({
      category: "remove",
      message:
        "Most bullet points have no numbers — add measurable results where you can (e.g. \"cut processing time 30%\" instead of \"improved processing time\").",
    });
  }

  const foundWeakPhrases = WEAK_PHRASES.filter((phrase) =>
    new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(resumeText)
  );
  if (foundWeakPhrases.length > 0) {
    score -= Math.min(8, foundWeakPhrases.length * 2);
    feedback.push({
      category: "remove",
      message: `Generic filler phrases found: ${foundWeakPhrases.join(", ")}. These add length without adding information — cut them or replace with a specific example.`,
    });
  }

  const pronounLines = lines.filter((l) => PRONOUN_PATTERN.test(l));
  if (pronounLines.length > 2) {
    score -= 3;
    feedback.push({
      category: "remove",
      message: "First-person pronouns (\"I\", \"my\") appear several times — resume bullets are conventionally written without them (\"Led the migration\", not \"I led the migration\").",
    });
  }

  return Math.max(0, score);
}

function computeStructureScore(resumeText: string, feedback: FeedbackItem[]): number {
  let score = 10;
  const lower = resumeText.toLowerCase();

  const hasExperience = /experience|employment history/.test(lower);
  const hasEducation = /education/.test(lower);
  const hasSkills = /skills|core competencies|areas of expertise/.test(lower);

  if (!hasExperience) {
    score -= 3;
    feedback.push({ category: "structure", message: "No clear \"Experience\" section header found — use a standard header so ATS software can locate your work history." });
  }
  if (!hasEducation) {
    score -= 2;
    feedback.push({ category: "structure", message: "No \"Education\" section header found." });
  }
  if (!hasSkills) {
    score -= 2;
    feedback.push({ category: "structure", message: "No \"Skills\" section found — a dedicated skills list makes keyword matching easier for both ATS and recruiters." });
  }
  if (!EMAIL_PATTERN.test(resumeText)) {
    score -= 2;
    feedback.push({ category: "structure", message: "No email address detected in the extracted text — make sure contact info isn't sitting inside a header/footer or graphic, which many ATS parsers skip." });
  }
  if (!PHONE_PATTERN.test(resumeText)) {
    score -= 1;
    feedback.push({ category: "structure", message: "No phone number detected in the extracted text." });
  }

  return Math.max(0, score);
}

export function scoreResume(resumeText: string, jobText: string, meta: FormatMeta): AnalysisResult {
  const feedback: FeedbackItem[] = [];
  const keywords = matchKeywords(jobText, resumeText);

  if (keywords.missing.length > 0) {
    feedback.push({
      category: "missing",
      message: `Missing keywords the posting mentions: ${keywords.missing.slice(0, 12).join(", ")}${keywords.missing.length > 12 ? ", …" : ""}. Add any of these you genuinely have experience with.`,
    });
  }

  const keywordMatch = computeKeywordScore(keywords);
  const formatting = computeFormattingScore(meta, feedback);
  const contentQuality = computeContentQualityScore(resumeText, feedback);
  const structure = computeStructureScore(resumeText, feedback);
  const total = keywordMatch + formatting + contentQuality + structure;

  const score: ScoreBreakdown = {
    keywordMatch,
    formatting,
    contentQuality,
    structure,
    total,
    label: scoreLabel(total),
  };

  const extractionPreview = resumeText.replace(/\n{3,}/g, "\n\n").trim();

  return { score, keywords, feedback, extractionPreview };
}

/**
 * A zero-AI fallback for the "Auto-Fix" step: mechanically appends missing keywords
 * as a callout and strips the weakest filler phrases. It's intentionally conservative —
 * it never invents experience — and is meant to be a floor, not a replacement for the
 * AI-powered rewrite in aiProviderRouter.ts.
 */
export function basicMechanicalRewrite(resumeText: string, keywords: KeywordResult): string {
  let text = resumeText;
  for (const phrase of WEAK_PHRASES) {
    text = text.replace(new RegExp(`\\b${phrase}\\b\\.?`, "gi"), "");
  }
  text = text.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  if (keywords.missing.length > 0) {
    text += `\n\n--- Consider adding (only if true) ---\n${keywords.missing.slice(0, 15).join(", ")}`;
  }
  return text;
}
