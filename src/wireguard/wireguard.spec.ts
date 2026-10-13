import 'reflect-metadata';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ServiceUnavailableException } from '@nestjs/common';
import { WireguardSettings } from './wireguard.settings.js';
import { WireguardCli } from './wireguard.cli.js';
import { WireguardService } from './wireguard.service.js';

const key = (n: number) => {
  const bytes = Buffer.alloc(32, 1);
  bytes.writeUInt32BE(n);
  return bytes.toString('base64');
};

const mockCli = (peers: Map<string, string[]>) => ({
  peers: vi.fn(async () => peers),
  addPeer: vi.fn(async (publicKey: string, ip: string) => {
    peers.set(publicKey, [`${ip}/32`]);
  }),
  save: vi.fn(async () => undefined),
});

describe('WireGuard allocation and joining', () => {
  let directory: string;
  let settings: WireguardSettings;
  let service: WireguardService;
  let peers: Map<string, string[]>;
  let cli: ReturnType<typeof mockCli>;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'yoora-wg-'));
    settings = {
      interface: 'wg0',
      stateFile: join(directory, 'state.json'),
      apiKey: 'x'.repeat(32),
      wgBinary: 'wg',
      quickBinary: 'wg-quick',
    };
    peers = new Map();
    cli = mockCli(peers);
    service = new WireguardService(settings, cli as unknown as WireguardCli);
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('reserves unique IPs for simultaneous calls and retains them across restarts', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, n) =>
        service.allocateIp({ publicKey: key(n) }),
      ),
    );
    expect(new Set(results.map((result) => result.ip)).size).toBe(20);
    expect(results[0].ip).toBe('10.0.0.2');
    const restarted = new WireguardService(
      settings,
      cli as unknown as WireguardCli,
    );
    expect((await restarted.allocateIp({ publicKey: key(0) })).ip).toBe(
      '10.0.0.2',
    );
    expect(cli.addPeer).not.toHaveBeenCalled();
  });

  it('joins automatically, persists the peer, and is idempotent', async () => {
    const first = await service.join({ publicKey: key(1) });
    const second = await service.join({ publicKey: key(1) });
    expect(first).toEqual(second);
    expect(first.status).toBe('active');
    expect(cli.addPeer).toHaveBeenCalledExactlyOnceWith(key(1), '10.0.0.2');
    expect(cli.save).toHaveBeenCalledTimes(2);
    expect((await service.allocateIp({ publicKey: key(1) })).status).toBe(
      'active',
    );
  });

  it('skips live peer addresses and CIDR ranges', async () => {
    peers.set(key(90), ['10.0.0.0/29']);
    peers.set(key(91), ['10.0.0.8/32']);
    expect((await service.join({ publicKey: key(1) })).ip).toBe('10.0.0.9');
  });

  it('adopts an existing peer without overwriting it', async () => {
    peers.set(key(1), ['10.0.0.12/32']);
    expect((await service.join({ publicKey: key(1) })).ip).toBe('10.0.0.12');
    expect(cli.addPeer).not.toHaveBeenCalled();
  });

  it('rejects a full pool without using network or broadcast addresses', async () => {
    peers.set(key(90), ['10.0.0.0/24']);
    await expect(service.join({ publicKey: key(1) })).rejects.toMatchObject({
      status: 409,
    });
    expect(cli.addPeer).not.toHaveBeenCalled();
  });

  it('retains the reserved IP after add failure and safely retries', async () => {
    vi.mocked(cli.addPeer).mockRejectedValueOnce(
      new ServiceUnavailableException(),
    );
    await expect(service.join({ publicKey: key(1) })).rejects.toMatchObject({
      status: 503,
    });
    expect((await service.join({ publicKey: key(2) })).ip).toBe('10.0.0.3');
    expect((await service.join({ publicKey: key(1) })).ip).toBe('10.0.0.2');
  });

  it('retries saving after the live peer was added but save failed', async () => {
    vi.mocked(cli.save).mockRejectedValueOnce(
      new ServiceUnavailableException(),
    );
    await expect(service.join({ publicKey: key(1) })).rejects.toMatchObject({
      status: 503,
    });
    const state = JSON.parse(await readFile(settings.stateFile, 'utf8'));
    expect(state.allocations[0].status).toBe('reserved');
    expect((await service.join({ publicKey: key(1) })).status).toBe('active');
    expect(cli.addPeer).toHaveBeenCalledTimes(1);
  });

  it('rejects conflicting runtime assignments and preserves existing peer routes', async () => {
    await service.allocateIp({ publicKey: key(1) });
    peers.set(key(2), ['10.0.0.2/32']);
    await expect(service.join({ publicKey: key(1) })).rejects.toMatchObject({
      status: 409,
    });
    peers.set(key(3), ['192.168.0.0/24']);
    await expect(service.join({ publicKey: key(3) })).rejects.toMatchObject({
      status: 409,
    });
    expect(cli.addPeer).not.toHaveBeenCalled();
  });

  it('fails closed on corrupt state and an existing filesystem lock', async () => {
    await writeFile(settings.stateFile, '{bad json');
    await expect(
      service.allocateIp({ publicKey: key(1) }),
    ).rejects.toMatchObject({ status: 503 });
    await writeFile(`${settings.stateFile}.lock`, '');
    await expect(
      service.allocateIp({ publicKey: key(1) }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it.each([
    null,
    {},
    { publicKey: '$(touch /tmp/injected)' },
    { publicKey: Buffer.alloc(32).toString('base64') },
    { publicKey: key(1), ip: '10.0.0.9' },
  ])('rejects invalid input %j before invoking the CLI', async (body) => {
    await expect(async () => service.join(body)).rejects.toMatchObject({
      status: 400,
    });
    expect(cli.peers).not.toHaveBeenCalled();
  });
});
