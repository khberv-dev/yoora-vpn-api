import { Injectable } from '@nestjs/common';
import { ShellService } from './shell.service.js';

@Injectable()
export class WgProcessService {
  constructor(private readonly shell: ShellService) {}

  async addPeer(publicKey: string, ip: string) {
    await this.shell.run('awg', [
      'set',
      'wg0',
      'peer',
      publicKey,
      'allowed-ips',
      `${ip}/32`,
    ]);
  }

  async removePeer(publicKey: string) {
    await this.shell.run('awg', ['set', 'wg0', 'peer', publicKey, 'remove']);
  }

  async status() {
    return this.shell.run('awg', ['show', 'wg0', 'dump']);
  }
}
