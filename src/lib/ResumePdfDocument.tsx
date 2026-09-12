import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { parseResumeForPdf, type ResumeBlock } from "./resumePdfLayout";

// Everything here still parses as plain single-column text for ATS purposes — color,
// bold weight, and border rules are purely visual and don't affect text extraction.
// Uses only @react-pdf/renderer's built-in standard PDF fonts (no font files to load),
// so generation stays fast and can't fail on a missing font asset.
const ACCENT = "#1E3A5F"; // deep navy — section headers and name
const INK = "#1F2937"; // body text
const MUTED = "#5B6472"; // contact line, de-emphasized text
const RULE = "#C7CDD6"; // hairline borders

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 34,
    paddingHorizontal: 46,
    fontFamily: "Helvetica",
    fontSize: 10.2,
    lineHeight: 1.32,
    color: INK,
  },
  header: {
    borderBottomWidth: 1.4,
    borderBottomColor: ACCENT,
    paddingBottom: 6,
    marginBottom: 10,
  },
  name: {
    fontFamily: "Times-Bold",
    fontSize: 20,
    color: ACCENT,
    marginBottom: 2,
  },
  contact: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: MUTED,
  },
  sectionHeader: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: ACCENT,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    borderBottomWidth: 0.75,
    borderBottomColor: RULE,
    paddingBottom: 2,
    marginTop: 9,
    marginBottom: 4,
  },
  roleLine: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.2,
    color: INK,
    marginBottom: 2,
    marginTop: 1,
  },
  text: {
    fontFamily: "Helvetica",
    fontSize: 10.2,
    color: INK,
    marginBottom: 3,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 2,
    paddingLeft: 2,
  },
  bulletGlyph: {
    width: 11,
    fontFamily: "Helvetica",
    fontSize: 10.2,
    color: ACCENT,
  },
  bulletText: {
    flex: 1,
    fontFamily: "Helvetica",
    fontSize: 10.2,
    color: INK,
  },
  spacer: {
    height: 4,
  },
});

function renderBlock(block: ResumeBlock, key: string | number) {
  if (block.type === "spacer") return <View key={key} style={styles.spacer} />;
  if (block.type === "sectionHeader") {
    return (
      <Text key={key} style={styles.sectionHeader}>
        {block.text}
      </Text>
    );
  }
  if (block.type === "roleLine") {
    return (
      <Text key={key} style={styles.roleLine}>
        {block.text}
      </Text>
    );
  }
  if (block.type === "bullet") {
    return (
      <View key={key} style={styles.bulletRow}>
        <Text style={styles.bulletGlyph}>•</Text>
        <Text style={styles.bulletText}>{block.text}</Text>
      </View>
    );
  }
  return (
    <Text key={key} style={styles.text}>
      {block.text}
    </Text>
  );
}

function splitIntoSpacerDelimitedRuns(blocks: ResumeBlock[]): ResumeBlock[][] {
  const runs: ResumeBlock[][] = [];
  let current: ResumeBlock[] = [];
  for (const block of blocks) {
    if (block.type === "spacer") {
      if (current.length) runs.push(current);
      runs.push([block]);
      current = [];
      continue;
    }
    current.push(block);
  }
  if (current.length) runs.push(current);
  return runs;
}

/**
 * Within one entry (a run of blocks between blank lines), only the header portion —
 * role/date/company-style lines, plus the first bullet or line of content — is kept
 * together as a non-splitting unit. This is enough to prevent the worst case (a bold
 * title stranded alone at the bottom of a page with all its bullets on the next),
 * without forcing an entire long, multi-bullet entry to jump to a new page and leave
 * a large blank gap — which would fight the actual goal of fitting more per page. A
 * short entry with no bullets at all (e.g. Education) ends up entirely "header," so
 * it still stays fully intact as one piece.
 */
function splitRunForPagination(run: ResumeBlock[]): ResumeBlock[][] {
  if (run.length === 1) return [run];

  const HEAD_TYPES = new Set(["roleLine", "text", "sectionHeader"]);
  let headEnd = 0;
  while (headEnd < run.length && HEAD_TYPES.has(run[headEnd].type) && headEnd < 4) headEnd++;

  if (headEnd >= run.length) return [run]; // the whole entry was header-like — keep it together

  const head = run.slice(0, headEnd + 1); // header lines + first content line
  const rest = run.slice(headEnd + 1);
  return [head, ...rest.map((block) => [block])];
}

/**
 * Groups blocks so a job entry's title/company/date lines can't be split from their
 * first bullet across a page boundary, and a short, tightly-knit entry like Education
 * can't be split at all — the cause of the "two stray lines alone on an otherwise
 * blank page" problem. A lone section header also merges into the entry that follows
 * it so the header can't be stranded separately from its content.
 */
function groupIntoKeepTogetherRuns(blocks: ResumeBlock[]): ResumeBlock[][] {
  const spacerRuns = splitIntoSpacerDelimitedRuns(blocks);
  const expanded: ResumeBlock[][] = [];
  for (const run of spacerRuns) expanded.push(...splitRunForPagination(run));

  const consumed = new Set<number>();
  const merged: ResumeBlock[][] = [];
  for (let i = 0; i < expanded.length; i++) {
    if (consumed.has(i)) continue;
    const group = expanded[i];
    if (group.length === 1 && group[0].type === "sectionHeader") {
      let j = i + 1;
      while (j < expanded.length && expanded[j].length === 1 && expanded[j][0].type === "spacer") j++;
      if (j < expanded.length) {
        merged.push([...group, ...expanded[j]]);
        for (let k = i + 1; k <= j; k++) consumed.add(k);
        continue;
      }
    }
    merged.push(group);
  }

  // Drop a spacer that immediately precedes a section-header group — the header's
  // own top margin already provides that gap, so keeping the spacer would double it.
  return merged.filter((group, idx) => {
    if (group.length === 1 && group[0].type === "spacer") {
      const next = merged[idx + 1];
      if (next?.[0]?.type === "sectionHeader") return false;
    }
    return true;
  });
}

export default function ResumePdfDocument({ text }: { text: string }) {
  const blocks = parseResumeForPdf(text);

  // Leading "name" + "contact" blocks form the header; everything after renders in
  // document order, grouped to avoid mid-entry page breaks (see above).
  const headerBlocks: ResumeBlock[] = [];
  let bodyStart = 0;
  if (blocks[0]?.type === "name") {
    headerBlocks.push(blocks[0]);
    bodyStart = 1;
    while (blocks[bodyStart]?.type === "contact") {
      headerBlocks.push(blocks[bodyStart]);
      bodyStart++;
    }
  }
  const bodyBlocks = blocks.slice(bodyStart);
  const runs = groupIntoKeepTogetherRuns(bodyBlocks);

  const name = headerBlocks.find((b) => b.type === "name")?.text ?? "";
  const contactLine = headerBlocks
    .filter((b) => b.type === "contact")
    .map((b) => b.text)
    .join("   •   ");

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {name && (
          <View style={styles.header}>
            <Text style={styles.name}>{name}</Text>
            {contactLine && <Text style={styles.contact}>{contactLine}</Text>}
          </View>
        )}

        {runs.map((run, i) => {
          if (run.length === 1) return renderBlock(run[0], i);
          return (
            <View key={i} wrap={false}>
              {run.map((block, j) => renderBlock(block, `${i}-${j}`))}
            </View>
          );
        })}
      </Page>
    </Document>
  );
}
