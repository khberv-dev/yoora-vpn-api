import { Injectable } from '@nestjs/common';
import { resolve } from 'node:path';

@Injectable()
export class WireguardSettings {
  readonly interface = process.env.WG_INTERFACE ?? 'wg0';
  readonly wgBinary = process.env.WG_BINARY ?? 'wg';
  readonly quickBinary = process.env.WG_QUICK_BINARY ?? 'wg-quick';
  readonly stateFile = resolve(
    process.env.WG_STATE_FILE ?? 'data/wireguard.json',
  );
  readonly apiKey = process.env.WG_API_KEY ?? '';

  constructor() {
    if (!this.apiKey) {
      throw new Error('WG_API_KEY is required');
    }
    if (!/^[a-zA-Z0-9_=+.-]{1,15}$/.test(this.interface)) {
      throw new Error('WG_INTERFACE must be a valid interface name');
    }
  }
}
