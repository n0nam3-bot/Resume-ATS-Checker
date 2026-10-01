/**
 * A second safety net alongside fabricationGuard.ts — that one catches the AI
 * inventing false content; this one catches the opposite failure, silently
 * dropping most of the candidate's real skills. Observed directly: a resume's Core
 * Competencies section went from 22 distinct skills/tools across 5 labeled
 * categories down to 6 bare generic phrases with no tool names at all, when the AI
 * over-aggressively "simplified" the section while reframing it for a different
 * job. This is a coarse, count-based check — it can't verify which specific skills
 * survived, only that the section wasn't gutted.
 */

export interface ContentLossCheckResult {
  suspicious: boolean;
  originalCount: number;
  rewrittenCount: number;
}

const SKILLS_SECTION_HEADER = /^(core competencies|skills|technical skills|areas of expertise)$/i;

// Reused from the same section-boundary convention as elsewhere in this codebase —
// a short, capitalized/all-caps line is almost always a resume section header.
const SECTION_HEADER_KEYWORDS = [
  "experience", "work experience", "professional experience", "employment history",
  "education", "skills", "technical skills", "core competencies", "summary",
  "professional summary", "objective", "career objective", "projects",
  "certifications", "awards", "honors", "publications", "volunteer experience",
  "volunteer", "languages", "references", "additional information", "interests",
];

function looksLikeAnySectionHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 45) return false;
  const lower = trimmed.toLowerCase().replace(/:+$/, "");
  if (SECTION_HEADER_KEYWORDS.includes(lower)) return true;
  const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  const endsLikeSentence = /[.,;]$/.test(trimmed);
  return isAllCaps && !endsLikeSentence && trimmed.length <= 40;
}

function extractSkillsSectionLines(text: string): string[] {
  const lines = text.split("\n");
  let capturing = false;
  const collected: string[] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (SKILLS_SECTION_HEADER.test(trimmed)) {
      capturing = true;
      continue;
    }
    if (capturing && looksLikeAnySectionHeader(trimmed)) break;
    if (capturing) collected.push(trimmed);
  }
  return collected;
}

/** Rough item count per line: splits on commas outside parentheses, strips a leading "Category:" label first. */
function countSkillItems(lines: string[]): number {
  let count = 0;
  for (const line of lines) {
    const withoutLabel = line.replace(/^[^:]{2,60}:\s*/, "");
    let depth = 0;
    let items = 1;
    for (const ch of withoutLabel) {
      if (ch === "(") depth++;
      else if (ch === ")") depth = Math.max(0, depth - 1);
      else if (ch === "," && depth === 0) items++;
    }
    count += items;
  }
  return count;
}

export function checkForSkillsLoss(original: string, rewritten: string): ContentLossCheckResult {
  const originalCount = countSkillItems(extractSkillsSectionLines(original));
  const rewrittenCount = countSkillItems(extractSkillsSectionLines(rewritten));

  // Only flag a real drop in a section that had substantive content to begin with
  // — a tiny original section shouldn't trigger this on noise.
  const suspicious = originalCount >= 6 && rewrittenCount < originalCount * 0.6;

  return { suspicious, originalCount, rewrittenCount };
}
