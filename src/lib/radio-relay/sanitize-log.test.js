import { describe, expect, it } from 'vitest';
import { sanitizeForLog } from './sanitize-log';

describe('sanitizeForLog', () => {
  it('redacts keys that look like credentials', () => {
    const input = {
      password: 'hunter2',
      apiKey: 'sk_live_abc',
      api_key: 'sk_live_abc',
      token: 'abc.def.ghi',
      secret: 'shh',
      credential: 'x',
      Authorization: 'Bearer xyz',
      messageId: 'msg-1',
    };

    const result = sanitizeForLog(input);

    expect(result.password).toBe('[REDACTED]');
    expect(result.apiKey).toBe('[REDACTED]');
    expect(result.api_key).toBe('[REDACTED]');
    expect(result.token).toBe('[REDACTED]');
    expect(result.secret).toBe('[REDACTED]');
    expect(result.credential).toBe('[REDACTED]');
    expect(result.Authorization).toBe('[REDACTED]');
    expect(result.messageId).toBe('msg-1');
  });

  it('redacts nested objects and arrays', () => {
    const input = {
      station: { connectionConfig: { host: '1.2.3.4' }, secret_id: 'vault-ref' },
      items: [{ password: 'x' }, { ok: true }],
    };

    const result = sanitizeForLog(input);

    expect(result.station.secret_id).toBe('[REDACTED]');
    expect(result.station.connectionConfig.host).toBe('1.2.3.4');
    expect(result.items[0].password).toBe('[REDACTED]');
    expect(result.items[1].ok).toBe(true);
  });

  it('does not throw on circular references', () => {
    const input = { name: 'x' };
    input.self = input;
    expect(() => sanitizeForLog(input)).not.toThrow();
  });

  it('leaves primitives untouched', () => {
    expect(sanitizeForLog('hello')).toBe('hello');
    expect(sanitizeForLog(42)).toBe(42);
    expect(sanitizeForLog(null)).toBe(null);
  });
});
