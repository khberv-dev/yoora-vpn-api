import { WireguardCli } from './wireguard.cli.js';
import { WireguardSettings } from './wireguard.settings.js';

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('node:child_process', () => ({
  execFile: Object.assign(vi.fn(), {
    [Symbol.for('nodejs.util.promisify.custom')]: execute,
  }),
}));

describe('WireGuard CLI', () => {
  const cli = new WireguardCli({
    interface: 'wg0',
    wgBinary: '/usr/bin/wg',
    quickBinary: '/usr/bin/wg-quick',
  } as WireguardSettings);

  beforeEach(() => {
    execute.mockReset();
  });

  it('reads script-friendly allowed IPs without exposing private keys', async () => {
    execute.mockResolvedValue({
      stdout: 'key1\t10.0.0.2/32,10.1.0.0/24\nkey2\t(none)\n',
    });
    expect(await cli.peers()).toEqual(
      new Map([
        ['key1', ['10.0.0.2/32', '10.1.0.0/24']],
        ['key2', []],
      ]),
    );
    expect(execute).toHaveBeenCalledWith(
      '/usr/bin/wg',
      ['show', 'wg0', 'allowed-ips'],
      { timeout: 10_000, maxBuffer: 1024 * 1024 },
    );
  });

  it('adds a /32 peer and saves configuration using argument arrays', async () => {
    execute.mockResolvedValue({ stdout: '' });
    await cli.addPeer('client-key', '10.0.0.2');
    await cli.save();
    expect(execute.mock.calls.map((call) => call.slice(0, 2))).toEqual([
      [
        '/usr/bin/wg',
        ['set', 'wg0', 'peer', 'client-key', 'allowed-ips', '10.0.0.2/32'],
      ],
      ['/usr/bin/wg-quick', ['save', 'wg0']],
    ]);
  });

  it('returns 503 on tool failure without leaking stderr', async () => {
    execute.mockRejectedValue(new Error('private server details'));
    await expect(cli.peers()).rejects.toMatchObject({ status: 503 });
    await expect(cli.save()).rejects.not.toThrow('private server details');
  });
});
