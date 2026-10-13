import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isIPv4 } from 'node:net';
import { WireguardCli } from './wireguard.cli.js';
import { WireguardSettings } from './wireguard.settings.js';

type Allocation = {
  publicKey: string;
  ip: string;
  status: 'reserved' | 'active';
};
type State = { version: 1; interface: string; allocations: Allocation[] };

function validKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9+/]{43}=$/.test(value) &&
    Buffer.from(value, 'base64').length === 32 &&
    Buffer.from(value, 'base64').toString('base64') === value &&
    Buffer.from(value, 'base64').some((byte) => byte !== 0)
  );
}

function poolIp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^10\.0\.0\.[0-9]+$/.test(value) &&
    isIPv4(value) &&
    Number(value.split('.')[3]) >= 2 &&
    Number(value.split('.')[3]) <= 254
  );
}

function covers(cidr: string, ip: string): boolean {
  if (cidr.includes(':')) return false;
  const [address, prefix] = cidr.split('/');
  if (!isIPv4(address) || !/^\d+$/.test(prefix ?? '') || Number(prefix) > 32) {
    throw new ServiceUnavailableException('Invalid WireGuard allowed IPs');
  }
  const number = (value: string) =>
    value.split('.').reduce((n, octet) => n * 256 + Number(octet), 0);
  const size = 2 ** (32 - Number(prefix));
  return Math.floor(number(address) / size) === Math.floor(number(ip) / size);
}

@Injectable()
export class WireguardService {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    @Inject(WireguardSettings) private readonly settings: WireguardSettings,
    @Inject(WireguardCli) private readonly cli: WireguardCli,
  ) {}

  private validate(body: unknown): string {
    if (
      !body ||
      typeof body !== 'object' ||
      !('publicKey' in body) ||
      !validKey(body.publicKey)
    ) {
      throw new BadRequestException(
        'publicKey must be a canonical base64 WireGuard public key (32 bytes)',
      );
    }
    if (Object.keys(body).some((key) => key !== 'publicKey')) {
      throw new BadRequestException(
        'Only publicKey is accepted; IP addresses are assigned by the server',
      );
    }
    return body.publicKey;
  }

  private async readState(): Promise<State> {
    let parsed: State;
    try {
      parsed = JSON.parse(
        await readFile(this.settings.stateFile, 'utf8'),
      ) as State;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          version: 1,
          interface: this.settings.interface,
          allocations: [],
        };
      }
      throw new ServiceUnavailableException('Cannot read allocation state');
    }
    const keys = new Set<string>();
    const ips = new Set<string>();
    if (
      !parsed ||
      parsed.version !== 1 ||
      parsed.interface !== this.settings.interface ||
      !Array.isArray(parsed.allocations) ||
      parsed.allocations.some((entry) => {
        if (
          !entry ||
          !validKey(entry.publicKey) ||
          !poolIp(entry.ip) ||
          !['reserved', 'active'].includes(entry.status) ||
          keys.has(entry.publicKey) ||
          ips.has(entry.ip)
        )
          return true;
        keys.add(entry.publicKey);
        ips.add(entry.ip);
        return false;
      })
    ) {
      throw new ServiceUnavailableException(
        'Invalid allocation state; refusing to allocate IPs',
      );
    }
    return parsed;
  }

  private async writeState(state: State): Promise<void> {
    const temporary = `${this.settings.stateFile}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(state, null, 2), {
        mode: 0o600,
        flag: 'wx',
      });
      await rename(temporary, this.settings.stateFile);
    } catch {
      throw new ServiceUnavailableException('Cannot persist allocation state');
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }

  private serialized<T>(work: () => Promise<T>): Promise<T> {
    const task = this.queue.then(async () => {
      await mkdir(dirname(this.settings.stateFile), {
        recursive: true,
        mode: 0o700,
      });
      const lockPath = `${this.settings.stateFile}.lock`;
      const lock = await open(lockPath, 'wx', 0o600).catch(() => {
        throw new ServiceUnavailableException(
          'Allocation state is locked or unavailable; retry later',
        );
      });
      try {
        return await work();
      } finally {
        await lock.close();
        await unlink(lockPath);
      }
    });
    this.queue = task.catch(() => undefined);
    return task;
  }

  private async allocate(
    publicKey: string,
    state: State,
    peers: Map<string, string[]>,
  ): Promise<Allocation> {
    let allocation = state.allocations.find(
      (entry) => entry.publicKey === publicKey,
    );
    const live = peers.get(publicKey);
    if (
      live &&
      (live.length !== 1 ||
        !live[0].endsWith('/32') ||
        !poolIp(live[0].slice(0, -3)))
    ) {
      throw new ConflictException(
        'Existing peer does not have a single client IP in this pool',
      );
    }
    if (allocation && live && live[0] !== `${allocation.ip}/32`) {
      throw new ConflictException(
        'Stored allocation differs from the existing peer',
      );
    }
    const occupied = (ip: string) =>
      state.allocations.some(
        (entry) => entry.publicKey !== publicKey && entry.ip === ip,
      ) ||
      [...peers].some(
        ([key, ranges]) =>
          key !== publicKey && ranges.some((range) => covers(range, ip)),
      );
    if (!allocation) {
      let ip = live?.[0].slice(0, -3);
      if (!ip) {
        for (let host = 2; host <= 254; host++) {
          const candidate = `10.0.0.${host}`;
          if (!occupied(candidate)) {
            ip = candidate;
            break;
          }
        }
      }
      if (!ip) throw new ConflictException('IP pool exhausted');
      allocation = { publicKey, ip, status: 'reserved' };
      if (occupied(ip))
        throw new ConflictException('IP is already used by another peer');
      state.allocations.push(allocation);
      // Reserve before the CLI call: failures and uncertain timeouts never release an IP.
      await this.writeState(state);
    } else if (occupied(allocation.ip)) {
      throw new ConflictException('Allocated IP conflicts with another peer');
    }
    return allocation;
  }

  private response(allocation: Allocation) {
    return {
      ...allocation,
      interface: this.settings.interface,
      address: `${allocation.ip}/32`,
      subnet: '10.0.0.0/24',
    };
  }

  allocateIp(body: unknown) {
    const publicKey = this.validate(body);
    return this.serialized(async () => {
      const state = await this.readState();
      const allocation = await this.allocate(
        publicKey,
        state,
        await this.cli.peers(),
      );
      return this.response(allocation);
    });
  }

  join(body: unknown) {
    const publicKey = this.validate(body);
    return this.serialized(async () => {
      const state = await this.readState();
      const peers = await this.cli.peers();
      const allocation = await this.allocate(publicKey, state, peers);
      if (!peers.has(publicKey))
        await this.cli.addPeer(publicKey, allocation.ip);
      // Retry save even for an existing peer after a previous partial failure.
      await this.cli.save();
      allocation.status = 'active';
      await this.writeState(state);
      return this.response(allocation);
    });
  }
}
