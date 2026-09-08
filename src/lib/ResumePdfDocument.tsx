import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// Deliberately plain: a single-column, Helvetica-based layout that reads cleanly to
// both humans and ATS parsers. It does not attempt to reproduce the original resume's
// visual template — see docs/RESUME_ATS_CHECKER_PLAN.md for why a from-scratch,
// ATS-safe layout is the safer default for this feature.
const styles = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingBottom: 42,
    paddingHorizontal: 46,
    fontFamily: "Helvetica",
    fontSize: 10.5,
    lineHeight: 1.45,
    color: "#1C2321",
  },
  paragraph: { marginBottom: 9 },
});

export default function ResumePdfDocument({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {paragraphs.map((para, i) => (
          <View key={i} style={styles.paragraph} wrap>
            {para.split("\n").map((line, j) => (
              <Text key={j}>{line}</Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
