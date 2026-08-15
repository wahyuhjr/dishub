/**
 * Shared category metadata for the document generator — one entry per
 * berita bahaya type, used by both the live HTML preview
 * (templates/preview-templates.jsx) and the server-only PDF templates
 * (templates/pdf-templates.jsx) so the two stay visually consistent.
 */
export const CATEGORY_LABELS = {
  DISTRESS: 'Distress',
  URGENCY: 'Urgency',
  SAFETY: 'Safety',
  NTM: 'Notice To Marine',
};

export const CATEGORY_DOCUMENT_TITLES = {
  DISTRESS: 'BERITA BAHAYA — DISTRESS',
  URGENCY: 'BERITA BAHAYA — URGENCY',
  SAFETY: 'BERITA BAHAYA — SAFETY',
  NTM: 'NOTICE TO MARINE',
};

/** Priority framing shown in the official document header, per category. */
export const CATEGORY_PRIORITY_NOTE = {
  DISTRESS: 'PRIORITAS TERTINGGI — SEGERA DITERUSKAN',
  URGENCY: 'PRIORITAS URGENSI — SEGERA DITERUSKAN',
  SAFETY: 'INFORMASI KESELAMATAN PELAYARAN',
  NTM: 'PEMBERITAHUAN KEPADA PELAUT',
};
