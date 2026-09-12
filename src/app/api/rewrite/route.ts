import { NextRequest, NextResponse } from "next/server";
import { rewriteWithAI, isAiConfigured, type UserSuppliedKey } from "@/lib/aiProviderRouter";
import { basicMechanicalRewrite } from "@/lib/scoring";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import type { KeywordResult } from "@/lib/types";

const DAILY_LIMIT = Number(process.env.DAILY_FREE_ANALYSES_PER_IP ?? 5);

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`rewrite:${ip}`, DAILY_LIMIT, 24 * 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Daily free rewrite limit reached (${DAILY_LIMIT}/day). Add your own free API key in Settings to keep going, or try again tomorrow.` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const resumeText: unknown = body?.resumeText;
  const jobText: unknown = body?.jobText;
  const keywords = (body?.keywords ?? { matched: [], missing: [] }) as KeywordResult;
  const userKey: UserSuppliedKey | undefined = body?.userKey;

  if (typeof resumeText !== "string" || resumeText.trim().length < 20) {
    return NextResponse.json({ error: "Resume text is missing or too short to rewrite." }, { status: 400 });
  }
  if (typeof jobText !== "string" || jobText.trim().length < 20) {
    return NextResponse.json({ error: "Job posting text is missing or too short to rewrite against." }, { status: 400 });
  }

  const wasConfigured = isAiConfigured(userKey);
  const { result: aiResult, fabricationBlocked } = await rewriteWithAI(
    resumeText,
    jobText,
    keywords.missing ?? [],
    userKey
  );
  if (aiResult) {
    return NextResponse.json(aiResult);
  }

  // Three genuinely different situations were being collapsed into one message
  // before — split them so it's actually diagnosable from the UI instead of
  // guesswork. Fabrication is deliberately checked first: it's a hard safety gate,
  // not just another kind of failure, so it gets its own explicit message rather
  // than reading as a generic "the API call failed" note.
  const rewrittenResume = basicMechanicalRewrite(resumeText, keywords);
  const note = fabricationBlocked
    ? "The AI rewrite was rejected by a safety check: it referenced an employer or organization name that doesn't appear anywhere in your original resume, which usually means it invented content. Falling back to a basic rule-based cleanup instead — always review every line of an AI rewrite against your real resume before using it."
    : wasConfigured
      ? "An AI key is configured, but every attempt failed just now (invalid key, wrong model name, or a rate limit). Falling back to a basic rule-based cleanup — check your Vercel project's Runtime Logs for the exact error."
      : "No AI provider is configured, so this is a basic rule-based cleanup: filler phrases removed and missing keywords listed for you to consider. Add a free API key (see .env.example) for a full AI rewrite.";

  return NextResponse.json({ rewrittenResume, usedAI: false, notes: [note] });
}
