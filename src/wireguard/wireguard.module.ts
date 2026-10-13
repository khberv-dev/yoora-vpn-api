import { Module } from '@nestjs/common';
import { WireguardController } from './wireguard.controller.js';
import { WireguardService } from './wireguard.service.js';
import { WireguardSettings } from './wireguard.settings.js';
import { WireguardCli } from './wireguard.cli.js';
import { WireguardGuard } from './wireguard.guard.js';

@Module({
  controllers: [WireguardController],
  providers: [
    WireguardSettings,
    WireguardCli,
    WireguardService,
    WireguardGuard,
  ],
})
export class WireguardModule {}
