import { Module } from '@nestjs/common';
import { SystemModule } from '../system/system.module.js';
import { ConnectionController } from './controllers/connection.controller.js';
import { ConnectionService } from './services/connection.service.js';

@Module({
  imports: [SystemModule],
  controllers: [ConnectionController],
  providers: [ConnectionService],
})
export class CoreModule {}
