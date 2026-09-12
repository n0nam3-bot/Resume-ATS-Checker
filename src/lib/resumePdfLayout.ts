export type ResumeBlockType = "name" | "contact" | "sectionHeader" | "roleLine" | "bullet" | "text" | "spacer";

export interface ResumeBlock {
  type: ResumeBlockType;
  text: string;
}

// Resume text has no guaranteed structure — this infers it from common conventions
// rather than requiring a schema. Imperfect on unusual formats by nature, but it
// covers the large majority of real resumes.
const SECTION_HEADER_KEYWORDS = [
  "experience", "work experience", "professional experience", "employment history",
  "education", "skills", "technical skills", "core competencies", "summary",
  "professional summary", "objective", "career objective", "projects",
  "certifications", "certifications & licenses", "awards", "honors", "publications",
  "volunteer experience", "volunteer", "languages", "references",
  "additional information", "interests",
];

const DATE_RANGE_PATTERN = /\b(19|20)\d{2}\b.{0,20}(\b(19|20)\d{2}\b|present|current)/i;
const BULLET_PATTERN = /^\s*[-•*◦]\s+/;

function isSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 45) return false;
  const lower = trimmed.toLowerCase().replace(/:+$/, "");
  if (SECTION_HEADER_KEYWORDS.includes(lower)) return true;

  // A short, all-caps line with no sentence-ending punctuation reads as a header
  // even if it's not in the keyword list (covers custom section names).
  const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  const endsLikeSentence = /[.,;]$/.test(trimmed);
  return isAllCaps && !endsLikeSentence && trimmed.length <= 40;
}

export function parseResumeForPdf(rawText: string): ResumeBlock[] {
  // The mechanical (no-AI) rewrite path appends a "consider adding" keyword note —
  // that's a suggestion for the user to review, not resume content, so it's cut
  // before rendering rather than shipping it inside an actual downloaded resume.
  const cutIndex = rawText.indexOf("--- Consider adding");
  const text = (cutIndex >= 0 ? rawText.slice(0, cutIndex) : rawText).trim();

  const rawLines = text.split("\n");

  // AI output has occasionally put a bullet marker on its own line, separated from
  // its content by a line break instead of a space — merge it back with the next
  // line so it doesn't render as an empty bullet followed by an orphaned paragraph.
  const lines: string[] = [];
  for (let j = 0; j < rawLines.length; j++) {
    const trimmed = rawLines[j].trim();
    if (/^[-•*◦]$/.test(trimmed) && rawLines[j + 1]?.trim()) {
      lines.push(`${trimmed} ${rawLines[j + 1].trim()}`);
      j++;
      continue;
    }
    lines.push(rawLines[j]);
  }

  const blocks: ResumeBlock[] = [];

  // Header block: first non-empty line is the name; subsequent lines up to the next
  // blank line are contact info (email, phone, location, etc.).
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i < lines.length) {
    blocks.push({ type: "name", text: lines[i].trim() });
    i++;
    while (i < lines.length && lines[i].trim() !== "") {
      blocks.push({ type: "contact", text: lines[i].trim() });
      i++;
    }
  }

  for (; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (trimmed === "") {
      if (blocks[blocks.length - 1]?.type !== "spacer") blocks.push({ type: "spacer", text: "" });
      continue;
    }
    if (isSectionHeader(trimmed)) {
      blocks.push({ type: "sectionHeader", text: trimmed.replace(/:+$/, "") });
      continue;
    }
    if (BULLET_PATTERN.test(raw)) {
      blocks.push({ type: "bullet", text: raw.replace(BULLET_PATTERN, "").trim() });
      continue;
    }

    const isDateLineItself = trimmed.length < 100 && DATE_RANGE_PATTERN.test(trimmed);
    const nextLine = lines[i + 1]?.trim();
    const precedesDateLine =
      !trimmed.endsWith(".") &&
      trimmed.length < 80 &&
      !!nextLine &&
      nextLine.length < 100 &&
      DATE_RANGE_PATTERN.test(nextLine);

    if (isDateLineItself || precedesDateLine) {
      blocks.push({ type: "roleLine", text: trimmed });
      continue;
    }
    blocks.push({ type: "text", text: trimmed });
  }

  return blocks;
}
