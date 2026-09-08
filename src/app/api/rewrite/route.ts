import { NextRequest, NextResponse } from "next/server";
import { rewriteWithAI, type UserSuppliedKey } from "@/lib/aiProviderRouter";
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

  const aiResult = await rewriteWithAI(resumeText, jobText, keywords.missing ?? [], userKey);
  if (aiResult) {
    return NextResponse.json(aiResult);
  }

  // No provider configured, or every provider failed — fall back so the feature
  // still does something useful with zero setup.
  const rewrittenResume = basicMechanicalRewrite(resumeText, keywords);
  return NextResponse.json({
    rewrittenResume,
    usedAI: false,
    notes: [
      "No AI provider is configured (or the pool is temporarily unavailable), so this is a basic rule-based cleanup: filler phrases removed and missing keywords listed for you to consider. Add a free API key (see .env.example) for a full AI rewrite.",
    ],
  });
}
