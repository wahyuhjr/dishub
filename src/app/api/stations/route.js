import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Demonstrates the redirect-based guards working inside a Route Handler
 * too (Next.js explicitly supports calling redirect() from Route
 * Handlers). ADMIN-only (see permissions.js "stations.manage").
 *
 * Note: for a machine-consumed JSON API this is usually less ergonomic
 * than explicit status codes (see /api/dashboard-summary/route.js) —
 * shown here to satisfy "protect Route Handlers, not just the UI" with
 * the exact same requireRole() used by Server Actions/pages.
 */
export async function POST(request) {
  await requireRole('ADMIN');

  const body = await request.json();
  const { station_code: stationCode, station_name: stationName, station_type: stationType } = body ?? {};

  if (!stationCode || !stationName || !stationType) {
    return NextResponse.json({ error: 'station_code, station_name, station_type wajib diisi.' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('stations')
    .insert({ station_code: stationCode, station_name: stationName, station_type: stationType })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
