import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Post,
  Query,
} from '@nestjs/common';
import { CryptService } from './modules/crypt/crypt.service.js';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { WgProcessService } from './modules/system/wg-process.service.js';

@Controller()
export class AppController {
  constructor(
    private readonly cryptService: CryptService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly wgProcess: WgProcessService,
  ) {}

  @Get()
  getStatus() {
    return {
      ok: true,
    };
  }

  @Post('connection')
  async generateKeyPair(@Query('user') userId: string) {
    const serverPublicKey = 'jBzAa1D/KVBgvL0kGgm2WKoz4uSYqs/DGnliK3KDJns=';
    if (!userId) return new BadRequestException('userId is required');

    const keys = this.cryptService.generateKeys();
    const nextIp = ((await this.cache.get('next')) ?? 2) as number;
    let userIp = (await this.cache.get(`user:ip:${userId}`)) as number;

    if (!userIp) {
      userIp = nextIp;
      await this.cache.set(`user:ip:${userId}`, nextIp);
      await this.cache.set(`user:key:${userId}`, keys.public);
      await this.cache.set('next', nextIp + 1);
    }

    await this.wgProcess.removePeer(keys.public);
    await this.wgProcess.addPeer(keys.public, `10.0.0.${userIp}`);

    return {
      ...keys,
      ip: `10.0.0.${userIp}/32`,
      serverPublicKey
    };
  }
}
