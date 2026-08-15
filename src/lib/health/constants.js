/**
 * Single source of truth for health status values and component names —
 * every file that needs to compare/display a status imports these
 * constants rather than hardcoding string literals like 'ONLINE'
 * (item 1 of the /monitoring requirements). Values match the
 * system_health_checks CHECK constraints exactly (see the migrations).
 */
export const HEALTH_STATUS = Object.freeze({
  ONLINE: 'ONLINE',
  DEGRADED: 'DEGRADED',
  OFFLINE: 'OFFLINE',
  UNKNOWN: 'UNKNOWN',
});

export const COMPONENT_NAME = Object.freeze({
  SERVER: 'SERVER',
  DATABASE: 'DATABASE',
  INTERNET: 'INTERNET',
  RADIO_MF_HF: 'RADIO_MF_HF',
  RADIO_DSC: 'RADIO_DSC',
  AIS: 'AIS',
  VTS: 'VTS',
});

/** Human-readable labels — the only place a display string is written. */
export const HEALTH_STATUS_LABELS = Object.freeze({
  [HEALTH_STATUS.ONLINE]: 'Online',
  [HEALTH_STATUS.DEGRADED]: 'Degraded',
  [HEALTH_STATUS.OFFLINE]: 'Offline',
  [HEALTH_STATUS.UNKNOWN]: 'Belum Pernah Dicek',
});

export const COMPONENT_LABELS = Object.freeze({
  [COMPONENT_NAME.SERVER]: 'Server Aplikasi',
  [COMPONENT_NAME.DATABASE]: 'Database (Supabase)',
  [COMPONENT_NAME.INTERNET]: 'Internet / Upstream Service',
  [COMPONENT_NAME.RADIO_MF_HF]: 'Radio MF/HF',
  [COMPONENT_NAME.RADIO_DSC]: 'Radio DSC',
  [COMPONENT_NAME.AIS]: 'AIS',
  [COMPONENT_NAME.VTS]: 'VTS',
});

/**
 * "App health" vs "Database health" vs "External device health" — item
 * 13 of the requirements. Used to group the dashboard's cards/sections.
 */
export const HEALTH_GROUP = Object.freeze({
  APP: 'APP',
  DATABASE: 'DATABASE',
  EXTERNAL_DEVICE: 'EXTERNAL_DEVICE',
});

export const COMPONENT_GROUP = Object.freeze({
  [COMPONENT_NAME.SERVER]: HEALTH_GROUP.APP,
  [COMPONENT_NAME.DATABASE]: HEALTH_GROUP.DATABASE,
  [COMPONENT_NAME.INTERNET]: HEALTH_GROUP.APP,
  [COMPONENT_NAME.RADIO_MF_HF]: HEALTH_GROUP.EXTERNAL_DEVICE,
  [COMPONENT_NAME.RADIO_DSC]: HEALTH_GROUP.EXTERNAL_DEVICE,
  [COMPONENT_NAME.AIS]: HEALTH_GROUP.EXTERNAL_DEVICE,
  [COMPONENT_NAME.VTS]: HEALTH_GROUP.EXTERNAL_DEVICE,
});

/** Default per-check timeout and DEGRADED latency threshold — overridable per adapter/env. */
export const DEFAULT_CHECK_TIMEOUT_MS = 5000;
export const DEFAULT_DEGRADED_LATENCY_MS = 1000;

/** Maps a station's `station_type` to the component_name category it reports under. */
export const STATION_TYPE_TO_COMPONENT_NAME = Object.freeze({
  RADIO_MF_HF: COMPONENT_NAME.RADIO_MF_HF,
  RADIO_DSC: COMPONENT_NAME.RADIO_DSC,
  AIS: COMPONENT_NAME.AIS,
  VTS: COMPONENT_NAME.VTS,
  // SROP has no dedicated component_name category — its per-station
  // check still gets logged (station_id set) under a generic label.
});
