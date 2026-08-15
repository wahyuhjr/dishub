import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { CATEGORY_DOCUMENT_TITLES, CATEGORY_PRIORITY_NOTE } from '../categories';

/**
 * Server-only PDF templates (@react-pdf/renderer primitives — Document/
 * Page/View/Text, NOT regular HTML/JSX). One exported component per
 * berita bahaya category (DISTRESS/URGENCY/SAFETY/NTM), each with its
 * own accent color and heading, per "Template berbeda untuk
 * DISTRESS/URGENCY/SAFETY/NTM". They share a common layout/field list so
 * the four stay visually and structurally consistent, and consistent
 * with the HTML live-preview in templates/preview-templates.jsx.
 *
 * IMPORTANT: only ever imported by src/features/document-generator/pdf-generator.js
 * (marked `server-only`) — never rendered in the browser.
 */

const ACCENT_COLORS = {
  DISTRESS: '#B91C1C',
  URGENCY: '#B45309',
  SAFETY: '#15803D',
  NTM: '#1D4ED8',
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#111827' },
  headerBar: { borderBottom: 2, paddingBottom: 10, marginBottom: 16 },
  agency: { fontSize: 9, color: '#4B5563', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 16, fontWeight: 700, marginTop: 4 },
  priorityNote: { fontSize: 9, fontWeight: 700, marginTop: 4, textTransform: 'uppercase' },
  metaRow: { flexDirection: 'row', marginBottom: 6 },
  metaLabel: { width: 140, fontSize: 9, color: '#4B5563', textTransform: 'uppercase' },
  metaValue: { flex: 1, fontSize: 10 },
  section: { marginTop: 16 },
  sectionLabel: { fontSize: 9, color: '#4B5563', textTransform: 'uppercase', marginBottom: 4 },
  contentBox: { border: 1, borderColor: '#D1D5DB', padding: 10, fontSize: 10, lineHeight: 1.5 },
  signatureRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 32 },
  signatureBlock: { width: '30%', textAlign: 'center' },
  signatureLine: { marginTop: 40, borderTop: 1, borderColor: '#111827', paddingTop: 4, fontSize: 9 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 8, color: '#6B7280', textAlign: 'center' },
});

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd MMMM yyyy, HH:mm', { locale: idLocale }) + ' WIT';
  } catch {
    return '—';
  }
}

function MetaRow({ label, value }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value || '—'}</Text>
    </View>
  );
}

/** Shared layout used by every category-specific template below. */
function OfficialDocumentLayout({ category, data }) {
  const accent = ACCENT_COLORS[category];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.headerBar, { borderBottomColor: accent }]}>
          <Text style={styles.agency}>Distrik Navigasi Tipe A Kelas III Merauke — Kementerian Perhubungan</Text>
          <Text style={[styles.title, { color: accent }]}>{CATEGORY_DOCUMENT_TITLES[category]}</Text>
          <Text style={[styles.priorityNote, { color: accent }]}>{CATEGORY_PRIORITY_NOTE[category]}</Text>
        </View>

        <MetaRow label="Nomor Berita" value={data.message_number} />
        <MetaRow label="Lokasi Kejadian" value={data.location_description} />
        <MetaRow label="Koordinat" value={`${data.latitude}, ${data.longitude}`} />
        <MetaRow label="Waktu Kejadian" value={formatDateTime(data.incident_at)} />
        <MetaRow label="Berlaku Hingga" value={formatDateTime(data.valid_until)} />
        <MetaRow label="Area Navigasi" value={data.navigation_area} />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Isi Berita</Text>
          <Text style={styles.contentBox}>{data.content}</Text>
        </View>

        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <Text>{data.sender_name}</Text>
            <Text style={styles.signatureLine}>Pengirim</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text>{data.operator_name}</Text>
            <Text style={styles.signatureLine}>Operator</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text>{data.verifier_name || '—'}</Text>
            <Text style={styles.signatureLine}>Verifikator</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Dokumen dibuat otomatis oleh Sistem Digital Relay Berita Bahaya & NTM — {formatDateTime(new Date().toISOString())}
        </Text>
      </Page>
    </Document>
  );
}

export function DistressPdfDocument({ data }) {
  return <OfficialDocumentLayout category="DISTRESS" data={data} />;
}

export function UrgencyPdfDocument({ data }) {
  return <OfficialDocumentLayout category="URGENCY" data={data} />;
}

export function SafetyPdfDocument({ data }) {
  return <OfficialDocumentLayout category="SAFETY" data={data} />;
}

export function NtmPdfDocument({ data }) {
  return <OfficialDocumentLayout category="NTM" data={data} />;
}

export const PDF_TEMPLATES_BY_CATEGORY = {
  DISTRESS: DistressPdfDocument,
  URGENCY: UrgencyPdfDocument,
  SAFETY: SafetyPdfDocument,
  NTM: NtmPdfDocument,
};
