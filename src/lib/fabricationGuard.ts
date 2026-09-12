/**
 * A backstop against AI-fabricated employment history. Prompt instructions telling a
 * model "never invent an employer" are not reliable enough on their own — a free-tier
 * model has been observed inventing entire fake jobs (including a fake job at the
 * exact company from the job posting) despite an explicit instruction not to.
 *
 * This targets specifically the "Company | Location" line every job entry has —
 * not generic capitalized phrases — because checking all capitalized phrases also
 * flags ordinary reworded skill/competency lines (which is expected and fine in any
 * rewrite) and would end up rejecting nearly every AI rewrite, not just fabricated
 * ones. This is a safety net, not a guarantee: it can't verify that a *true* company
 * name wasn't given fabricated duties, only that no entirely new organization name
 * was introduced. The user should still review every AI rewrite.
 */

export interface FabricationCheckResult {
  suspicious: boolean;
  unexplainedEmployers: string[];
}

const YEAR_PATTERN = /\b(19|20)\d{2}\b/;

/** Lines matching the "Company Name | City, State" convention nearly all resumes use. */
function extractEmployerCandidates(text: string): string[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const candidates: string[] = [];
  for (const line of lines) {
    if (!line.includes("|")) continue;
    if (YEAR_PATTERN.test(line)) continue; // likely a "Title | Date" line, not employer/location
    const company = line.split("|")[0].trim();
    if (company.length >= 3 && company.length <= 60) candidates.push(company);
  }
  return candidates;
}

function normalize(phrase: string): string {
  return phrase.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function isGrounded(company: string, originalNormalized: string, originalWords: Set<string>): boolean {
  const norm = normalize(company);
  if (!norm) return true;
  if (originalNormalized.includes(norm)) return true;
  // Allow minor rewording by requiring only the significant (4+ letter) words to
  // all appear somewhere in the original, not an exact substring match.
  const words = norm.split(" ").filter((w) => w.length >= 4);
  if (words.length === 0) return true;
  return words.every((w) => originalWords.has(w));
}

export function checkForFabrication(original: string, rewritten: string): FabricationCheckResult {
  const originalNormalized = normalize(original);
  const originalWords = new Set(originalNormalized.split(" ").filter((w) => w.length >= 4));
  const candidates = extractEmployerCandidates(rewritten);

  const seen = new Set<string>();
  const unexplainedEmployers = candidates.filter((company) => {
    if (isGrounded(company, originalNormalized, originalWords)) return false;
    const key = normalize(company);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { suspicious: unexplainedEmployers.length > 0, unexplainedEmployers };
}
