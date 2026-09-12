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
