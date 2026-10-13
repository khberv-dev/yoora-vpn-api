import { WireguardSettings } from './wireguard.settings.js';

describe('WireGuard settings', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([undefined, ''])('requires a nonempty API key: %j', (value) => {
    vi.stubEnv('WG_API_KEY', value);
    expect(() => new WireguardSettings()).toThrow('WG_API_KEY is required');
  });

  it('accepts even a one-character API key', () => {
    vi.stubEnv('WG_API_KEY', 'x');
    vi.stubEnv('WG_INTERFACE', 'wg0');
    expect(new WireguardSettings().apiKey).toBe('x');
  });
});
