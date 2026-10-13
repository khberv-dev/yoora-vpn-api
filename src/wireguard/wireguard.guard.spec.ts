import type { ExecutionContext } from '@nestjs/common';
import { WireguardGuard } from './wireguard.guard.js';
import { WireguardSettings } from './wireguard.settings.js';

describe('WireGuard API authentication', () => {
  const apiKey = 'a'.repeat(32);
  const guard = new WireguardGuard({ apiKey } as WireguardSettings);
  const context = (value: unknown) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-api-key': value } }),
      }),
    }) as unknown as ExecutionContext;

  it('accepts the configured API key', () => {
    expect(guard.canActivate(context(apiKey))).toBe(true);
  });

  it('accepts a configured key without a minimum length', () => {
    const shortKeyGuard = new WireguardGuard({
      apiKey: 'test',
    } as WireguardSettings);
    expect(shortKeyGuard.canActivate(context('test'))).toBe(true);
    expect(() => shortKeyGuard.canActivate(context(undefined))).toThrow(
      'Invalid API key',
    );
  });

  it.each([undefined, '', 'wrong', 'b'.repeat(32), [apiKey]])(
    'rejects invalid credentials %j',
    (value) => {
      expect(() => guard.canActivate(context(value))).toThrow(
        'Invalid API key',
      );
    },
  );
});
