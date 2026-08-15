import 'server-only';
import { COMPONENT_NAME } from '../constants';
import { ServerHealthAdapter } from './server-adapter';
import { DatabaseHealthAdapter } from './database-adapter';
import { InternetHealthAdapter } from './internet-adapter';
import { MockDeviceAdapter } from './mock-device-adapter';

/**
 * Builds the adapter to use for a given component_name check. Every
 * device category (RADIO_MF_HF/RADIO_DSC/AIS/VTS) and every per-station
 * check currently resolves to MockDeviceAdapter (item 15 — no real
 * device integration exists yet).
 *
 * TODO CONFIGURATION REQUIRED: once a real device/vendor API is known
 * for a given category, add a concrete adapter (see
 * src/lib/radio-relay/adapters/http-adapter.js for the pattern this
 * would follow) and swap it in below — HealthCheckService and
 * everything downstream (timeout, status thresholds, logging) does not
 * need to change.
 */
export function getComponentAdapter(componentName, { supabase } = {}) {
  switch (componentName) {
    case COMPONENT_NAME.SERVER:
      return new ServerHealthAdapter();
    case COMPONENT_NAME.DATABASE:
      return new DatabaseHealthAdapter(supabase);
    case COMPONENT_NAME.INTERNET:
      return new InternetHealthAdapter();
    case COMPONENT_NAME.RADIO_MF_HF:
    case COMPONENT_NAME.RADIO_DSC:
    case COMPONENT_NAME.AIS:
    case COMPONENT_NAME.VTS:
      return new MockDeviceAdapter();
    default:
      throw new Error(`Tidak ada adapter untuk component_name "${componentName}".`);
  }
}

/** Adapter for an individual station's device check (station_type-specific in the future — mock for now). */
export function getStationAdapter(_stationType) {
  return new MockDeviceAdapter();
}
