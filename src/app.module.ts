import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { CryptModule } from './modules/crypt/crypt.module.js';
import { CacheModule } from '@nestjs/cache-manager';
import { SystemModule } from './modules/system/system.module.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 0,
    }),
    ConfigModule.forRoot(),
    CryptModule,
    SystemModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
