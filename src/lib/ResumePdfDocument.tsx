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
    paddingTop: 38,
    paddingBottom: 40,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 10.2,
    lineHeight: 1.38,
    color: INK,
  },
  header: {
    borderBottomWidth: 1.4,
    borderBottomColor: ACCENT,
    paddingBottom: 8,
    marginBottom: 12,
  },
  name: {
    fontFamily: "Times-Bold",
    fontSize: 21,
    color: ACCENT,
    marginBottom: 3,
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
    paddingBottom: 2.5,
    marginTop: 13,
    marginBottom: 6,
  },
  roleLine: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.2,
    color: INK,
    marginBottom: 3,
    marginTop: 2,
  },
  text: {
    fontFamily: "Helvetica",
    fontSize: 10.2,
    color: INK,
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 3,
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
    height: 5,
  },
});

export default function ResumePdfDocument({ text }: { text: string }) {
  const blocks = parseResumeForPdf(text);

  // Leading "name" + "contact" blocks form the header; everything after renders in
  // document order, with a spacer suppressed right before a section header since
  // that already carries its own top margin (avoids doubled whitespace).
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

        {bodyBlocks.map((block, i) => {
          if (block.type === "spacer") {
            const next = bodyBlocks[i + 1];
            if (next && next.type === "sectionHeader") return null;
            return <View key={i} style={styles.spacer} />;
          }
          if (block.type === "sectionHeader") {
            return (
              <Text key={i} style={styles.sectionHeader}>
                {block.text}
              </Text>
            );
          }
          if (block.type === "roleLine") {
            return (
              <Text key={i} style={styles.roleLine}>
                {block.text}
              </Text>
            );
          }
          if (block.type === "bullet") {
            return (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bulletGlyph}>•</Text>
                <Text style={styles.bulletText}>{block.text}</Text>
              </View>
            );
          }
          return (
            <Text key={i} style={styles.text}>
              {block.text}
            </Text>
          );
        })}
      </Page>
    </Document>
  );
}
