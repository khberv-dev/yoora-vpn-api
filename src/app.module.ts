import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { WireguardModule } from './wireguard/wireguard.module.js';

@Module({
  imports: [WireguardModule],
  controllers: [AppController],
})
export class AppModule {}
