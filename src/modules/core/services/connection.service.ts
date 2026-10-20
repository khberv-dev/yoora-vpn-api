import { Inject, Injectable } from '@nestjs/common';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { CryptService } from '../../crypt/crypt.service.js';
import { WgProcessService } from '../../system/wg-process.service.js';

const SERVER_PUBLIC_KEY = 'jBzAa1D/KVBgvL0kGgm2WKoz4uSYqs/DGnliK3KDJns=';

@Injectable()
export class ConnectionService {
  constructor(
    private readonly cryptService: CryptService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly wgProcess: WgProcessService,
  ) {}

  async connect(userId: string) {
    const keys = this.cryptService.generateKeys();
    const nextIp = ((await this.cache.get('next')) ?? 2) as number;
    let userIp = (await this.cache.get(`user:ip:${userId}`)) as number;
    const userKey = (await this.cache.get(`user:key:${userId}`)) as
      string | null;

    if (userKey) {
      await this.wgProcess.removePeer(userKey);
    }

    if (!userIp) {
      userIp = nextIp;
      await this.cache.set(`user:ip:${userId}`, nextIp);
      await this.cache.set('next', nextIp + 1);
    }

    await this.cache.set(`user:key:${userId}`, keys.public);
    await this.wgProcess.addPeer(keys.public, `10.0.0.${userIp}`);

    return {
      ...keys,
      ip: `10.0.0.${userIp}/32`,
      serverPublicKey: SERVER_PUBLIC_KEY,
    };
  }
}
