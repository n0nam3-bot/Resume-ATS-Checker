import type { KeywordResult } from "./types";

/**
 * This is a rule-based extractor, not an AI call — it runs instantly, costs nothing,
 * and never leaves the server (see docs/RESUME_ATS_CHECKER_PLAN.md for why scoring
 * stays deterministic while the AI pool is reserved for the resume rewrite step).
 *
 * It won't catch every possible skill a job posting cares about. It's built to catch
 * the common, high-signal ones reliably rather than guess at everything.
 */

// A working dictionary of common hard skills, tools, and certifications. Extend this
// freely — it's the easiest lever for improving match quality without touching an API.
const SKILL_DICTIONARY = [
  // Languages
  "javascript", "typescript", "python", "java", "c++", "c#", "go", "golang", "rust",
  "ruby", "php", "swift", "kotlin", "scala", "sql", "r", "matlab", "html", "css",
  // Frontend
  "react", "next.js", "vue", "angular", "svelte", "redux", "tailwind", "webpack",
  // Backend / infra
  "node.js", "express", "django", "flask", "spring", "graphql", "rest api", "microservices",
  "docker", "kubernetes", "terraform", "ci/cd", "jenkins", "github actions",
  // Cloud
  "aws", "azure", "gcp", "google cloud", "lambda", "s3", "ec2",
  // Data
  "pandas", "numpy", "pytorch", "tensorflow", "scikit-learn", "spark", "hadoop",
  "power bi", "tableau", "excel", "etl", "data pipeline", "machine learning",
  "deep learning", "nlp", "llm", "airflow",
  // Databases
  "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "dynamodb", "snowflake",
  // PM / business tools
  "jira", "confluence", "asana", "figma", "salesforce", "hubspot", "sap", "workday",
  "agile", "scrum", "kanban", "six sigma",
  // Certifications / credentials
  "pmp", "cpa", "cfa", "aws certified", "cissp", "comptia", "shrm", "phr",
  // Soft-skill phrasing that still shows up as literal JD requirements
  "stakeholder management", "cross-functional", "public speaking", "project management",
  "data analysis", "budget management", "vendor management", "client relations",
];

const STOPWORDS = new Set([
  "the", "and", "for", "with", "you", "your", "our", "are", "will", "have", "has",
  "this", "that", "from", "who", "what", "role", "job", "work", "team", "years",
  "experience", "ability", "skills", "including", "such", "into", "using", "able",
  "strong", "excellent", "a", "an", "of", "to", "in", "on", "as", "is", "be", "or",
]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Small synonym map so "JS" matches "JavaScript" and similar common equivalences. */
const SYNONYMS: Record<string, string[]> = {
  javascript: ["js"],
  "node.js": ["node", "nodejs"],
  "next.js": ["nextjs"],
  postgresql: ["postgres"],
  "google cloud": ["gcp"],
  "machine learning": ["ml"],
  "natural language processing": ["nlp"],
  "project management": ["pm"],
};

function textContainsTerm(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Word-boundary match where practical; terms with symbols (c++, ci/cd) fall back to substring.
  const boundarySafe = /^[a-z0-9\s]+$/.test(term);
  const pattern = boundarySafe ? `\\b${escaped}\\b` : escaped;
  return new RegExp(pattern, "i").test(haystack);
}

function anyFormMatches(haystack: string, term: string): boolean {
  if (textContainsTerm(haystack, term)) return true;
  const synonyms = SYNONYMS[term] ?? [];
  return synonyms.some((s) => textContainsTerm(haystack, s));
}

/**
 * Pulls candidate skill phrases directly out of the job posting: dictionary hits,
 * plus capitalized acronyms (2-6 letters, e.g. "AWS", "CI/CD") that the dictionary
 * doesn't already cover, since those are frequently tool names.
 */
export function extractJobKeywords(jobText: string): string[] {
  const normalized = normalize(jobText);
  const found = new Set<string>();

  for (const skill of SKILL_DICTIONARY) {
    if (anyFormMatches(normalized, skill)) found.add(skill);
  }

  const acronymPattern = /\b[A-Z]{2,6}(?:\/[A-Z]{2,6})?\b/g;
  const acronyms = jobText.match(acronymPattern) ?? [];
  for (const raw of acronyms) {
    const term = raw.toLowerCase();
    if (STOPWORDS.has(term) || term.length < 2) continue;
    found.add(term);
  }

  return Array.from(found);
}

/** Compares extracted job keywords against the resume text. */
export function matchKeywords(jobText: string, resumeText: string): KeywordResult {
  const jobKeywords = extractJobKeywords(jobText);
  const normalizedResume = normalize(resumeText);

  const matched: string[] = [];
  const missing: string[] = [];

  for (const keyword of jobKeywords) {
    if (anyFormMatches(normalizedResume, keyword)) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  return { matched, missing };
}
