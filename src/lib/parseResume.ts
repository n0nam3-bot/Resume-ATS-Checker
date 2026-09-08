import type { FormatMeta } from "./types";

export interface ParsedResume {
  text: string;
  meta: FormatMeta;
}

/**
 * Everything here runs in the browser — the resume file itself never has to touch
 * a server just to be read. Only the extracted plain text goes to /api/analyze.
 */
export async function parseResumeFile(file: File): Promise<ParsedResume> {
  const extension = file.name.toLowerCase().split(".").pop();

  if (extension === "pdf" || file.type === "application/pdf") {
    return parsePdf(file);
  }
  if (
    extension === "docx" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return parseDocx(file);
  }
  throw new Error("Unsupported file type — please upload a .pdf or .docx resume.");
}

async function parsePdf(file: File): Promise<ParsedResume> {
  // Loaded dynamically so pdf.js (a browser-only library) never gets pulled into
  // the server bundle.
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Point at the matching worker version on a CDN instead of bundling it — the
  // simplest reliable setup for pdf.js inside Next.js's webpack build. To remove
  // the CDN dependency, download this file into /public and point workerSrc at
  // "/pdf.worker.min.mjs" instead.
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pageTexts: string[] = [];
  let multiColumnSignal = 0;
  let imageSignal = false;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const items = content.items as Array<{ str: string; transform: number[] }>;
    pageTexts.push(items.map((i) => i.str).join(" "));

    // Rough multi-column heuristic: bucket each text item's x-position into left/
    // middle/right thirds of the page. If both the left and right thirds carry a
    // substantial share of the items, the layout is plausibly columnar — real
    // column detection would need full layout analysis, so treat this as a hint,
    // not a certainty (surfaced to the user as "may use", never "does use").
    const thirds = [0, 0, 0];
    for (const item of items) {
      const x = item.transform?.[4] ?? 0;
      const third = Math.min(2, Math.floor((x / viewport.width) * 3));
      thirds[Math.max(0, third)]++;
    }
    const total = items.length || 1;
    if (thirds[0] / total > 0.25 && thirds[2] / total > 0.25) {
      multiColumnSignal++;
    }

    try {
      const opList = await page.getOperatorList();
      const OPS = pdfjsLib.OPS;
      if (
        opList.fnArray.includes(OPS.paintImageXObject) ||
        opList.fnArray.includes(OPS.paintInlineImageXObject)
      ) {
        imageSignal = true;
      }
    } catch {
      // Non-fatal — image detection is a bonus signal, not a requirement.
    }
  }

  const text = pageTexts.join("\n\n");
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const meta: FormatMeta = {
    fileType: "pdf",
    possibleMultiColumn: multiColumnSignal > 0,
    hasTables: false, // Not reliably detectable from PDF text layout alone — see README limitations.
    hasImages: imageSignal,
    pageCount: doc.numPages,
    wordCount,
  };

  return { text, meta };
}

async function parseDocx(file: File): Promise<ParsedResume> {
  const mammoth = await import("mammoth/mammoth.browser");
  const arrayBuffer = await file.arrayBuffer();

  const [{ value: text }, { value: html }] = await Promise.all([
    mammoth.extractRawText({ arrayBuffer }),
    mammoth.convertToHtml({ arrayBuffer }),
  ]);

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const meta: FormatMeta = {
    fileType: "docx",
    possibleMultiColumn: false, // mammoth flattens layout, so column detection doesn't apply here.
    hasTables: /<table/i.test(html),
    hasImages: /<img/i.test(html),
    wordCount,
  };

  return { text, meta };
}
