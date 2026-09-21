const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December";

// A word character directly followed by a month name (e.g. "ComplianceAugust 2025")
// — the specific pattern seen when a source tab character between a job title and
// its date range gets silently dropped during AI rewriting instead of preserved as
// whitespace. Targeted at month names specifically so it can't misfire on ordinary
// camelCase-looking product names (PowerShell, LinkedIn, etc.).
const TITLE_DATE_JAM = new RegExp(`([a-zA-Z])(${MONTHS})(\\s+\\d{4})`, "g");

// Compound adjectives common in resumes that some free-tier models render without
// their hyphen (e.g. "cross-functional" -> "crossfunctional"). Matches only when the
// suffix is glued directly onto a preceding word — already-correct hyphenated or
// spaced text doesn't match, so this can't double up a hyphen that's already there.
// Case-insensitive so "CrossFunctional" (capitalized, as in a competency heading) is
// caught too, not just the all-lowercase mid-sentence form.
//
// Deliberately excludes "wide" as a general suffix — "-wide" compounds are
// inconsistent in standard English (nationwide/worldwide are one word, but
// organization-wide is hyphenated) and a generic rule can't tell "Citywide" the
// company name from "organizationwide" the descriptive compound. Handled instead as
// explicit, safe dictionary entries below.
const HYPHEN_SUFFIXES = ["based", "driven", "focused", "functional", "oriented", "friendly"];
const HYPHEN_JAM = new RegExp(`\\b([A-Za-z]{3,}?)(${HYPHEN_SUFFIXES.join("|")})\\b`, "gi");

// A few specific, known-safe compounds handled by name rather than a general suffix
// rule — a generic "user" or "wide" suffix, for example, would also wrongly split
// real words and proper nouns ("abuser", or a company literally named "Citywide").
// Matched case-insensitively; capitalization of the result follows whether the
// original match started with a capital letter.
const KNOWN_COMPOUNDS: Array<[RegExp, string]> = [
  [/\bend[- ]?user\b/gi, "end-user"],
  [/\bon[- ]?site\b/gi, "on-site"],
  [/\boff[- ]?site\b/gi, "off-site"],
  [/\borganization[- ]?wide\b/gi, "organization-wide"],
  [/\bcompany[- ]?wide\b/gi, "company-wide"],
  [/\bindustry[- ]?wide\b/gi, "industry-wide"],
];

function applyKnownCompoundFixes(text: string): string {
  let result = text;
  for (const [pattern, fixed] of KNOWN_COMPOUNDS) {
    result = result.replace(pattern, (match) =>
      /^[A-Z]/.test(match) ? fixed[0].toUpperCase() + fixed.slice(1) : fixed
    );
  }
  return result;
}

/**
 * Makes sure every job duty in the Professional Experience section has a bullet
 * marker. Free-tier models have been observed failing this two different ways:
 * (1) writing the whole entry as one dense multi-sentence paragraph, and (2) — the
 * case that got past the first fix — putting each duty on its own line, correctly
 * separated, but with no "- " marker on any of them at all. This handles both,
 * despite an explicit prompt instruction to always use bullets, as a backstop for
 * when that instruction alone doesn't hold. Only applies inside the Professional
 * Experience section; a summary/objective paragraph is supposed to stay prose.
 *
 * Within an entry, the first non-blank line is the role/title (+ date) and is
 * never bulleted; the second is treated as the company/location line and skipped
 * too, unless it doesn't actually look like one (no "|", and either long or
 * sentence-like) — in which case there was no separate company line, and it's
 * treated as the first duty instead. Every line after that is a duty.
 */
const EXPERIENCE_SECTION_HEADER = /^(professional experience|work experience|employment history|experience)$/i;
const OTHER_SECTION_HEADER =
  /^(professional summary|summary|objective|career objective|core competencies|skills|technical skills|education|certifications|projects|awards|honors|publications|volunteer experience|languages|references|additional information|interests)$/i;
// Splits after a sentence-ending period only when it follows a lowercase letter or
// digit (so abbreviations like "U.S." or a citation like "800.3" aren't split) and
// is followed by a capitalized word (a new sentence, not a mid-sentence decimal).
const SENTENCE_BOUNDARY = /(?<=[a-z0-9])\.\s+(?=[A-Z])/g;
const BULLET_MARKER = /^[-•*◦]\s/;

function bulletizeDuty(trimmed: string, result: string[]): void {
  const sentenceCount = (trimmed.match(SENTENCE_BOUNDARY)?.length ?? 0) + 1;
  if (trimmed.length > 150 && sentenceCount >= 2) {
    const sentences = trimmed
      .split(SENTENCE_BOUNDARY)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (/[.!?]$/.test(s) ? s : `${s}.`));
    for (const sentence of sentences) result.push(`- ${sentence}`);
  } else {
    result.push(`- ${trimmed}`);
  }
}

export function bulletizeDenseParagraphs(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let inExperienceSection = false;
  let lineIndexInEntry = 0; // 0 = expect role/title line, 1 = expect company/location line, 2+ = duties

  for (const line of lines) {
    const trimmed = line.trim();

    if (EXPERIENCE_SECTION_HEADER.test(trimmed)) {
      inExperienceSection = true;
      lineIndexInEntry = 0;
      result.push(line);
      continue;
    }
    if (OTHER_SECTION_HEADER.test(trimmed)) {
      inExperienceSection = false;
      result.push(line);
      continue;
    }
    if (trimmed === "") {
      lineIndexInEntry = 0; // the next non-blank line starts a new entry
      result.push(line);
      continue;
    }
    if (!inExperienceSection) {
      result.push(line);
      continue;
    }
    if (BULLET_MARKER.test(trimmed)) {
      lineIndexInEntry = Math.max(lineIndexInEntry, 2); // an existing bullet means we're past the header lines
      result.push(line);
      continue;
    }

    if (lineIndexInEntry === 0) {
      lineIndexInEntry = 1;
      result.push(line);
      continue;
    }
    if (lineIndexInEntry === 1) {
      const looksLikeCompanyLine = trimmed.includes("|") || (trimmed.length < 80 && !/[.!?]$/.test(trimmed));
      lineIndexInEntry = 2;
      if (looksLikeCompanyLine) {
        result.push(line);
        continue;
      }
      // Doesn't look like a company/location line, so there wasn't a separate one
      // — this is actually the first duty and needs a bullet like any other.
    }

    bulletizeDuty(trimmed, result);
  }

  return result.join("\n");
}

/**
 * Repairs word-jam patterns observed from free-tier AI models during resume
 * rewriting. Applied once, right where the AI's response comes back, so every
 * downstream consumer (diff view, edit textarea, PDF export) sees the same
 * corrected text rather than each needing its own fix-up.
 */
export function repairWordJams(text: string): string {
  const withCompounds = applyKnownCompoundFixes(text);
  return withCompounds
    .replace(TITLE_DATE_JAM, "$1 $2$3")
    .replace(HYPHEN_JAM, (match, prefix: string, suffix: string) => {
      if (prefix.length < 3) return match;
      return `${prefix}-${suffix}`;
    });
}
