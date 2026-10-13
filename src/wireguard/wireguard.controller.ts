import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { WireguardGuard } from './wireguard.guard.js';
import { WireguardService } from './wireguard.service.js';

@Controller('wireguard')
@UseGuards(WireguardGuard)
export class WireguardController {
  constructor(
    @Inject(WireguardService) private readonly service: WireguardService,
  ) {}

  @Post('ip-allocations')
  allocateIp(@Body() body: unknown) {
    return this.service.allocateIp(body);
  }

  @Post(['clients', 'join'])
  join(@Body() body: unknown) {
    return this.service.join(body);
  }
}
