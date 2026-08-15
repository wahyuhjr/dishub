'use server';

import { requireRole } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Creates a station. ADMIN-only (see permissions.js "stations.manage").
 */
export async function createStationAction(formData) {
  await requireRole('ADMIN');

  const stationCode = String(formData.get('station_code') ?? '').trim();
  const stationName = String(formData.get('station_name') ?? '').trim();
  const stationType = String(formData.get('station_type') ?? '').trim();

  if (!stationCode || !stationName || !stationType) {
    return { error: 'Semua field wajib diisi.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('stations').insert({
    station_code: stationCode,
    station_name: stationName,
    station_type: stationType,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
