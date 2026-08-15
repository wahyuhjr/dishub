import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { CATEGORY_DOCUMENT_TITLES, CATEGORY_PRIORITY_NOTE } from '../categories';

/**
 * Live HTML preview of the official document — rendered with regular
 * Tailwind/JSX (unlike templates/pdf-templates.jsx, which uses
 * @react-pdf/renderer primitives and only ever runs server-side). Kept
 * visually consistent with the PDF (same fields, same per-category
 * accent) so "preview dalam format dokumen resmi" genuinely matches
 * what gets printed/exported.
 *
 * `id="document-preview"` is targeted by the print stylesheet (see
 * components/document-preview.jsx) so only this element prints, not the
 * surrounding form/page chrome.
 */

const ACCENT_CLASSNAMES = {
  DISTRESS: 'border-red-700 text-red-700',
  URGENCY: 'border-amber-700 text-amber-700',
  SAFETY: 'border-green-700 text-green-700',
  NTM: 'border-blue-700 text-blue-700',
};

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return format(new Date(value), "dd MMMM yyyy, HH:mm", { locale: idLocale }) + ' WIT';
  } catch {
    return '—';
  }
}

function MetaRow({ label, value }) {
  return (
    <div className="flex gap-4 py-0.5 text-sm">
      <dt className="w-40 shrink-0 text-xs tracking-wide text-zinc-500 uppercase">{label}</dt>
      <dd className="text-zinc-900">{value || '—'}</dd>
    </div>
  );
}

export function OfficialDocumentPreview({ category, data }) {
  const accent = ACCENT_CLASSNAMES[category] ?? ACCENT_CLASSNAMES.NTM;

  return (
    <div id="document-preview" className="mx-auto w-full max-w-[210mm] bg-white p-10 text-zinc-900 print:p-0 print:shadow-none">
      <div className={`border-b-2 pb-3 ${accent}`}>
        <p className="text-xs tracking-widest text-zinc-500 uppercase">
          Distrik Navigasi Tipe A Kelas III Merauke — Kementerian Perhubungan
        </p>
        <h1 className="mt-1 text-xl font-bold">{CATEGORY_DOCUMENT_TITLES[category] ?? 'BERITA BAHAYA'}</h1>
        <p className="mt-1 text-xs font-bold tracking-wide uppercase">{CATEGORY_PRIORITY_NOTE[category]}</p>
      </div>

      <dl className="mt-4 divide-y divide-zinc-100">
        <MetaRow label="Nomor Berita" value={data.message_number} />
        <MetaRow label="Lokasi Kejadian" value={data.location_description} />
        <MetaRow label="Koordinat" value={data.latitude && data.longitude ? `${data.latitude}, ${data.longitude}` : ''} />
        <MetaRow label="Waktu Kejadian" value={formatDateTime(data.incident_at)} />
        <MetaRow label="Berlaku Hingga" value={formatDateTime(data.valid_until)} />
        <MetaRow label="Area Navigasi" value={data.navigation_area} />
      </dl>

      <div className="mt-4">
        <p className="text-xs tracking-wide text-zinc-500 uppercase">Isi Berita</p>
        <p className="mt-1 rounded border border-zinc-300 p-3 text-sm whitespace-pre-wrap">{data.content || '—'}</p>
      </div>

      <div className="mt-10 grid grid-cols-3 gap-4 text-center text-sm">
        <div>
          <p className="mb-10">{data.sender_name || '—'}</p>
          <p className="border-t border-zinc-900 pt-1 text-xs">Pengirim</p>
        </div>
        <div>
          <p className="mb-10">{data.operator_name || '—'}</p>
          <p className="border-t border-zinc-900 pt-1 text-xs">Operator</p>
        </div>
        <div>
          <p className="mb-10">{data.verifier_name || '—'}</p>
          <p className="border-t border-zinc-900 pt-1 text-xs">Verifikator</p>
        </div>
      </div>

      <p className="mt-10 text-center text-[10px] text-zinc-400">
        Dokumen dibuat otomatis oleh Sistem Digital Relay Berita Bahaya &amp; NTM
      </p>
    </div>
  );
}
