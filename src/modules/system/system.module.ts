import { Module } from '@nestjs/common';
import { ShellService } from './shell.service.js';
import { WgProcessService } from './wg-process.service.js';

@Module({
  providers: [ShellService, WgProcessService],
  exports: [WgProcessService],
})
export class SystemModule {}
