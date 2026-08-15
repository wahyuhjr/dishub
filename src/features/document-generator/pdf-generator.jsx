import 'server-only';
import { renderToBuffer } from '@react-pdf/renderer';
import { PDF_TEMPLATES_BY_CATEGORY } from './templates/pdf-templates';

/**
 * Generates the official berita bahaya PDF for `data.category`
 * (DISTRESS/URGENCY/SAFETY/NTM), entirely server-side. This module is
 * `server-only` and must NEVER be imported by a Client Component — PDF
 * generation happens exclusively in Server Actions (see actions.js).
 */
export async function generateDocumentPdf(data) {
  const Template = PDF_TEMPLATES_BY_CATEGORY[data.category];
  if (!Template) {
    throw new Error(`Tidak ada template PDF untuk kategori "${data.category}".`);
  }
  return renderToBuffer(<Template data={data} />);
}
