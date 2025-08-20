// utils/pdfGenerator.tsx
import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 16, fontFamily: 'Times-Roman' },
  paragraph: { marginBottom: 12 },
  justifiedText: { textAlign: 'justify' as const },
});

export const generateTranscriptPDF = (text: string): React.ReactElement => {
  const cleaned = text.replace(/⏳\s*Transcribing.*$/gi, '').trim();
  const paragraphs = cleaned.split('\n').filter((p) => p.trim());

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {paragraphs.map((para, i) => (
          <View key={i} style={styles.paragraph}>
            <Text style={styles.justifiedText}>{para}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
};
