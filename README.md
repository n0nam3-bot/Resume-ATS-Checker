# Resume ATS Checker

Upload a resume and a job posting. Get an ATS compatibility score, specific feedback on what's
missing or should be trimmed, and an auto-fixed version of the resume you can compare side by
side and download as a PDF. Works on desktop and mobile as a single responsive web app.

Full design rationale, architecture diagrams, and roadmap: [`docs/RESUME_ATS_CHECKER_PLAN.md`](./docs/RESUME_ATS_CHECKER_PLAN.md).

## What works right now

- **Upload** a `.pdf` or `.docx` resume — parsed entirely in the browser (pdf.js / mammoth.js),
  the file itself never has to touch a server.
- **Job posting** via pasted text or a URL (scraped server-side to dodge CORS).
- **Deterministic ATS score** (`/100`, broken into keyword match, formatting, content quality,
  structure) with specific, explainable feedback — no AI call required for this part.
- **Auto-fix**: rewrites the resume using a pooled free-tier AI provider (Gemini → Groq →
  OpenRouter, tried in order with automatic fallback), or a rule-based mechanical cleanup if no
  AI key is configured — the feature works either way.
- **Side-by-side before/after** with word-level diff highlighting (two columns on desktop, a
  tabbed view on mobile), plus a final editable text box before download.
- **PDF download** of the finished resume.
- **Support button** wired to `.github/FUNDING.yml` and an in-app PayPal.me link — no secrets
  required for either.

## Setup

```bash
npm install
cp .env.example .env.local   # optional — the app works with zero keys filled in
npm run dev
```

Open http://localhost:3000.

### Adding free AI keys (optional but recommended)

The app works with no keys at all — score is always deterministic, and Auto-Fix falls back to a
rule-based cleanup. Add any of these to `.env.local` to unlock full AI-quality rewrites:

| Provider | Get a key |
|---|---|
| Google Gemini | https://aistudio.google.com/app/apikey |
| Groq | https://console.groq.com/keys |
| OpenRouter | https://openrouter.ai/keys |

The router tries them in that order and falls back automatically if one is rate-limited. See
`docs/RESUME_ATS_CHECKER_PLAN.md` §10 for the reasoning and current free-tier shape of each.

### Before you deploy

- The donate link is already set to `https://streamlabs.com/artofreyes/tip` in both
  `src/components/DonateButton.tsx` and `.github/FUNDING.yml` — update both if that ever changes.
- Add real `public/icon-192.png` and `public/icon-512.png` files (any square PNG works) — the
  manifest references them for PWA installability; the app runs fine without them, browsers just
  won't have an icon to show.
- Put your real API keys in your hosting platform's environment variables (Vercel/Netlify
  dashboard) — **not** only in GitHub Secrets, which by themselves only reach GitHub Actions
  workflows, not a deployed app. See docs §10 for the two valid patterns.

### Deploying

Any host that runs Next.js server functions works (Vercel and Netlify both have free tiers).
Rough steps for Vercel:

1. Push this repo to GitHub.
2. Import it at vercel.com → New Project.
3. Add the env vars from `.env.example` under Project → Settings → Environment Variables.
4. Deploy.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## Known limitations (honest list)

- **PDF table/column detection is heuristic, not exact.** DOCX table/image detection is reliable
  (mammoth exposes real HTML structure); PDF detection relies on text-position clustering, which
  is a best-effort signal, not certainty — this is why the UI always says "may use a multi-column
  layout" rather than a flat claim.
- **The downloaded PDF uses its own clean, ATS-safe template, not your original file's
  visual styling.** It infers structure (name, contact line, section headers, bold role/date
  lines, bullets) from the plain text, so unusual formats may not classify perfectly — but it's
  a real single-column, text-only layout with visual hierarchy, not just a plain reflow.
- **The rate limiter is in-memory**, so it resets on a cold start and doesn't share state across
  multiple serverless instances. Fine for a small/solo project; swap in Upstash Redis or similar
  before this gets serious traffic.
- **Free-tier AI model names and limits change.** The defaults in `aiProviderRouter.ts` are
  reasonable as of this writing but worth checking against each provider's current docs.
- **The AI rewrite is instructed never to fabricate experience**, but always review the diff
  before using the output — it's a drafting aid, not a guarantee.

## License

MIT — see [`LICENSE`](./LICENSE).
