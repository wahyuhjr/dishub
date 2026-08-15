import { describe, expect, it } from 'vitest';
import { generateDocumentPdf } from './pdf-generator';

const BASE_DATA = {
  message_number: 'BB-2026-0001',
  location_description: 'Perairan Merauke',
  latitude: '-8.4999',
  longitude: '140.4010',
  incident_at: '2026-08-15T10:00:00.000Z',
  valid_until: '2026-08-20T10:00:00.000Z',
  navigation_area: 'Alur Pelayaran Merauke',
  content: 'Isi berita uji coba untuk pengujian template dokumen.',
  sender_name: 'Kapten KM Uji Coba',
  operator_name: 'Andi Wijaya',
  verifier_name: 'Siti Rahma',
};

describe('generateDocumentPdf — one test per berita bahaya template', () => {
  it.each(['DISTRESS', 'URGENCY', 'SAFETY', 'NTM'])('generates a valid PDF buffer for %s', async (category) => {
    const buffer = await generateDocumentPdf({ ...BASE_DATA, category });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    // PDF magic bytes — confirms a real PDF was produced, not just any buffer.
    expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
  });

  it('throws a clear error for an unknown category rather than producing a blank document', async () => {
    await expect(generateDocumentPdf({ ...BASE_DATA, category: 'UNKNOWN' })).rejects.toThrow(/Tidak ada template PDF/);
  });
});
