import type { RewriteResult } from "./types";

/**
 * Server-only. This file must never be imported from a client component — it reads
 * secrets out of process.env and calls out to third-party APIs with them.
 *
 * Design decision (see docs/RESUME_ATS_CHECKER_PLAN.md §5 and §10): ATS scoring
 * stays fully deterministic and local (lib/scoring.ts) so the score is explainable
 * and free. The AI pool below is reserved for the one job that genuinely benefits
 * from language generation: rewriting the resume in the Auto-Fix step.
 *
 * Free-tier model names and endpoints shift over time — check each provider's docs
 * before relying on the defaults below in production.
 */

interface Provider {
  name: string;
  call: (prompt: string) => Promise<string>;
}

export interface UserSuppliedKey {
  provider: "gemini" | "groq" | "openrouter";
  key: string;
}

// OpenRouter's own free-model router (released Feb 2026) auto-selects among whatever
// specific free models are currently available, so it never goes stale the way a
// hardcoded list of individual ":free" model slugs does — that rotation is exactly
// what broke the original hardcoded list here. Override via OPENROUTER_MODELS if you
// want to pin specific models instead.
const DEFAULT_OPENROUTER_MODELS = ["openrouter/free"];

function buildRewritePrompt(resumeText: string, jobText: string, missingKeywords: string[]): string {
  return `You are an expert resume editor helping a real job seeker tailor their resume to a specific job posting.

STRICT RULES:
- Never invent job titles, employers, dates, degrees, certifications, or skills the candidate did not already state.
- You may rephrase, reorder, tighten, and emphasize existing true content.
- You may naturally weave in any of the "keywords to consider" below, ONLY if the resume already implies the candidate has that experience; otherwise leave it out entirely.
- Keep the output as a plain-text resume — no markdown tables, no HTML, no commentary.
- Return ONLY the rewritten resume text. Do not include a preamble, an explanation, or code fences.

JOB POSTING:
"""
${jobText.slice(0, 6000)}
"""

KEYWORDS TO CONSIDER (only if truthfully applicable): ${missingKeywords.slice(0, 20).join(", ") || "none"}

ORIGINAL RESUME:
"""
${resumeText.slice(0, 8000)}
"""

Rewritten resume:`;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text");
  return text as string;
}

async function callGroq(prompt: string, apiKey: string): Promise<string> {
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned no text");
  return text as string;
}

async function callOpenRouter(prompt: string, apiKey: string): Promise<string> {
  const models = (process.env.OPENROUTER_MODELS || DEFAULT_OPENROUTER_MODELS.join(","))
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.APP_URL || "https://github.com",
      "X-Title": "Resume ATS Checker",
    },
    // Listing several free models lets OpenRouter fall back internally if one is
    // rate-limited or offline — see docs §10.
    body: JSON.stringify({ models, messages: [{ role: "user", content: prompt }], temperature: 0.4 }),
  });
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenRouter returned no text");
  return text as string;
}

function getConfiguredProviders(userKey?: UserSuppliedKey): Provider[] {
  const providers: Provider[] = [];

  if (process.env.GEMINI_API_KEY) {
    providers.push({ name: "Google Gemini", call: (p) => callGemini(p, process.env.GEMINI_API_KEY as string) });
  }
  if (process.env.GROQ_API_KEY) {
    providers.push({ name: "Groq", call: (p) => callGroq(p, process.env.GROQ_API_KEY as string) });
  }
  if (process.env.OPENROUTER_API_KEY) {
    providers.push({ name: "OpenRouter", call: (p) => callOpenRouter(p, process.env.OPENROUTER_API_KEY as string) });
  }

  // BYOK overflow: a key the visitor pasted in for this request only. Never persisted
  // server-side. Tried last since the pooled keys above are free to the visitor.
  if (userKey?.key) {
    if (userKey.provider === "gemini") providers.push({ name: "your Gemini key", call: (p) => callGemini(p, userKey.key) });
    if (userKey.provider === "groq") providers.push({ name: "your Groq key", call: (p) => callGroq(p, userKey.key) });
    if (userKey.provider === "openrouter") providers.push({ name: "your OpenRouter key", call: (p) => callOpenRouter(p, userKey.key) });
  }

  return providers;
}

export function isAiConfigured(userKey?: UserSuppliedKey): boolean {
  return getConfiguredProviders(userKey).length > 0;
}

export async function rewriteWithAI(
  resumeText: string,
  jobText: string,
  missingKeywords: string[],
  userKey?: UserSuppliedKey
): Promise<RewriteResult | null> {
  const providers = getConfiguredProviders(userKey);
  if (providers.length === 0) return null;

  const prompt = buildRewritePrompt(resumeText, jobText, missingKeywords);

  for (const provider of providers) {
    try {
      const raw = await provider.call(prompt);
      const cleaned = raw.replace(/^```[\w]*\n?/, "").replace(/```\s*$/, "").trim();
      if (!cleaned) throw new Error("empty response");
      return {
        rewrittenResume: cleaned,
        usedAI: true,
        aiProvider: provider.name,
        notes: [`Rewritten using ${provider.name}. Review every change before using this resume.`],
      };
    } catch (err) {
      console.warn(`[aiProviderRouter] ${provider.name} failed, trying next provider:`, err);
      continue;
    }
  }

  return null; // Every configured provider failed — the caller falls back to the mechanical rewrite.
}
