import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { WireguardSettings } from './wireguard.settings.js';

const execute = promisify(execFile);

@Injectable()
export class WireguardCli {
  constructor(
    @Inject(WireguardSettings) private readonly settings: WireguardSettings,
  ) {}

  private async run(binary: string, args: string[]): Promise<string> {
    try {
      const { stdout } = await execute(binary, args, {
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
      });
      return stdout;
    } catch {
      // Do not expose command output or server configuration to callers.
      throw new ServiceUnavailableException(
        'WireGuard command failed; check the interface, tools and permissions',
      );
    }
  }

  async peers(): Promise<Map<string, string[]>> {
    const output = await this.run(this.settings.wgBinary, [
      'show',
      this.settings.interface,
      'allowed-ips',
    ]);
    const peers = new Map<string, string[]>();
    for (const line of output.trim().split('\n').filter(Boolean)) {
      const [key, ...parts] = line.trim().split(/\s+/);
      peers.set(
        key,
        parts
          .join('')
          .split(',')
          .filter((ip) => ip !== '(none)' && ip !== ''),
      );
    }
    return peers;
  }

  async addPeer(publicKey: string, ip: string): Promise<void> {
    await this.run(this.settings.wgBinary, [
      'set',
      this.settings.interface,
      'peer',
      publicKey,
      'allowed-ips',
      `${ip}/32`,
    ]);
  }

  async save(): Promise<void> {
    await this.run(this.settings.quickBinary, [
      'save',
      this.settings.interface,
    ]);
  }
}
