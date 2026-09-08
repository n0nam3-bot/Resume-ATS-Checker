import { NextRequest, NextResponse } from "next/server";
import { scoreResume } from "@/lib/scoring";
import { isAiConfigured } from "@/lib/aiProviderRouter";
import type { FormatMeta } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const resumeText: unknown = body?.resumeText;
  const jobText: unknown = body?.jobText;
  const meta: unknown = body?.meta;

  if (typeof resumeText !== "string" || resumeText.trim().length < 20) {
    return NextResponse.json({ error: "Resume text is missing or too short to analyze." }, { status: 400 });
  }
  if (typeof jobText !== "string" || jobText.trim().length < 20) {
    return NextResponse.json({ error: "Job posting text is missing or too short to analyze." }, { status: 400 });
  }

  const formatMeta = (meta ?? {
    fileType: "pdf",
    possibleMultiColumn: false,
    hasTables: false,
    hasImages: false,
    wordCount: resumeText.split(/\s+/).filter(Boolean).length,
  }) as FormatMeta;

  const analysis = scoreResume(resumeText, jobText, formatMeta);

  return NextResponse.json({ analysis, aiAvailable: isAiConfigured() });
}
