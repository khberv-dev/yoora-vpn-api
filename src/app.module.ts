import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { CryptModule } from './modules/crypt/crypt.module.js';
import { CacheModule } from '@nestjs/cache-manager';
import { SystemModule } from './modules/system/system.module.js';

@Module({
  imports: [
    CryptModule,
    SystemModule,
    CacheModule.register({
      isGlobal: true,
      ttl: 0,
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
