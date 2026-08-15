import { describe, expect, it, vi } from 'vitest';
import { determineStatus } from './health-check-service';
import { withTimeout } from './with-timeout';
import { resolveDisplayStatus } from './status-helpers';
import { HealthCheckTimeoutError } from './errors';
import { HEALTH_STATUS } from './constants';
import { MockDeviceAdapter } from './adapters/mock-device-adapter';

describe('determineStatus', () => {
  it('returns ONLINE when the check succeeds within the latency threshold', () => {
    const result = determineStatus({ error: null, latencyMs: 50 }, 1000);
    expect(result).toEqual({ status: HEALTH_STATUS.ONLINE, errorMessage: null });
  });

  it('returns DEGRADED when latency exceeds the threshold, even without an error', () => {
    const result = determineStatus({ error: null, latencyMs: 1500 }, 1000);
    expect(result.status).toBe(HEALTH_STATUS.DEGRADED);
    expect(result.errorMessage).toBeNull();
  });

  it('returns OFFLINE when the check errored (device down, or a network failure)', () => {
    const result = determineStatus({ error: new Error('Perangkat tidak merespons.'), latencyMs: null }, 1000);
    expect(result.status).toBe(HEALTH_STATUS.OFFLINE);
    expect(result.errorMessage).toBe('Perangkat tidak merespons.');
  });

  it('returns OFFLINE when the check timed out (timeout surfaces as an error)', () => {
    const result = determineStatus({ error: new HealthCheckTimeoutError('Pemeriksaan melebihi batas waktu 5000ms.'), latencyMs: null }, 1000);
    expect(result.status).toBe(HEALTH_STATUS.OFFLINE);
    expect(result.errorMessage).toMatch(/batas waktu/);
  });
});

describe('resolveDisplayStatus', () => {
  it('returns UNKNOWN when a component/station has never been checked', () => {
    expect(resolveDisplayStatus(null)).toBe(HEALTH_STATUS.UNKNOWN);
    expect(resolveDisplayStatus(undefined)).toBe(HEALTH_STATUS.UNKNOWN);
  });

  it('returns the latest row status otherwise', () => {
    expect(resolveDisplayStatus({ status: HEALTH_STATUS.ONLINE })).toBe(HEALTH_STATUS.ONLINE);
  });
});

describe('MockDeviceAdapter — online/degraded/offline/timeout scenarios', () => {
  it('online: resolves quickly with a latency figure', async () => {
    const adapter = new MockDeviceAdapter({ latencyMs: 10, forceOutcome: 'online' });
    const result = await adapter.checkHealth();
    expect(result.latencyMs).toBe(10);
  });

  it('degraded: a slow-but-successful check is classified DEGRADED by determineStatus, not the adapter itself', async () => {
    const adapter = new MockDeviceAdapter({ latencyMs: 2000, forceOutcome: 'online' });
    const result = await adapter.checkHealth();
    const { status } = determineStatus({ error: null, latencyMs: result.latencyMs }, 1000);
    expect(status).toBe(HEALTH_STATUS.DEGRADED);
  });

  it('offline: throws so the caller can mark the component OFFLINE', async () => {
    const adapter = new MockDeviceAdapter({ latencyMs: 5, forceOutcome: 'offline' });
    await expect(adapter.checkHealth()).rejects.toThrow(/tidak merespons/);
  });

  it('timeout: withTimeout rejects with HealthCheckTimeoutError when the adapter never settles', async () => {
    const adapter = new MockDeviceAdapter({ forceOutcome: 'timeout' });
    await expect(withTimeout(() => adapter.checkHealth(), 20)).rejects.toBeInstanceOf(HealthCheckTimeoutError);
  });
});

describe('withTimeout', () => {
  it('resolves normally when fn finishes before the timeout', async () => {
    const result = await withTimeout(async () => 'ok', 50);
    expect(result).toBe('ok');
  });

  it('propagates a non-timeout error from fn as-is', async () => {
    const boom = new Error('boom');
    await expect(withTimeout(() => Promise.reject(boom), 50)).rejects.toBe(boom);
  });
});
