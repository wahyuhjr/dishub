import { requireRole } from '@/lib/auth/guards';
import { createStationAction } from '@/features/stations/actions';

// ADMIN-only page: station configuration (see permissions.js "stations.manage").
export default async function StationsSettingsPage() {
  await requireRole('ADMIN');

  return (
    <div>
      <h1>Konfigurasi Station</h1>
      <form action={createStationAction} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
        <label>
          Kode Station
          <input type="text" name="station_code" required />
        </label>
        <label>
          Nama Station
          <input type="text" name="station_name" required />
        </label>
        <label>
          Tipe Station
          <select name="station_type" required defaultValue="">
            <option value="" disabled>
              Pilih tipe
            </option>
            <option value="SROP">SROP</option>
            <option value="RADIO_MF_HF">RADIO_MF_HF</option>
            <option value="RADIO_DSC">RADIO_DSC</option>
            <option value="AIS">AIS</option>
            <option value="VTS">VTS</option>
          </select>
        </label>
        <button type="submit">Simpan</button>
      </form>
    </div>
  );
}
