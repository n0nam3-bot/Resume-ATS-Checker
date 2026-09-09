import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const BLOCKED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];

function isSafeUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    const hostname = url.hostname.toLowerCase();
    if (BLOCKED_HOSTS.includes(hostname)) return false;
    // Basic guard against obviously-private ranges. This is defense-in-depth, not a
    // complete SSRF protection — harden further (e.g. a DNS-resolution check) before
    // exposing this endpoint to untrusted high-volume traffic.
    if (/^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`scrape:${ip}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const { url } = await req.json().catch(() => ({ url: undefined }));
  if (typeof url !== "string" || !isSafeUrl(url)) {
    return NextResponse.json({ error: "Please provide a valid http(s) URL." }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ResumeATSChecker/1.0; +https://github.com/) job-posting-fetch",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      let hint = "";
      if (res.status === 401 || res.status === 403) {
        hint = " This usually means the site requires a login or blocks automated requests — Indeed and LinkedIn both commonly do this. Switch to \"Paste text\" instead.";
      } else if (res.status === 429) {
        hint = " The site is rate-limiting requests right now — try again shortly, or use \"Paste text\".";
      }
      return NextResponse.json(
        { error: `The page responded with status ${res.status}.${hint}` },
        { status: 502 }
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, noscript, svg, nav, footer").remove();

    const text = $("body").text().replace(/[ \t]{2,}/g, " ").replace(/\n{2,}/g, "\n").trim();

    if (text.length < 100) {
      return NextResponse.json(
        { error: "Couldn't find readable text on that page — it may require login or JavaScript rendering. Try pasting the job description text instead." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: text.slice(0, 20_000) });
  } catch (err) {
    console.error("[scrape-job] failed:", err);
    return NextResponse.json(
      { error: "Couldn't fetch that URL. Try pasting the job description text instead." },
      { status: 502 }
    );
  }
}
