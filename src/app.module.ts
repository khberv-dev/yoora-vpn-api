import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { CryptModule } from './modules/crypt/crypt.module.js';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSource } from './shared/config/database.config.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UserModule } from './modules/user/user.module.js';
import { CoreModule } from './modules/core/core.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { FileModule } from './modules/file/file.module.js';
import { JwtAccessGuard } from './common/guards/jwt-access.guard.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { ApiErrorLoggingFilter } from './common/filters/api-error-logging.filter.js';

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSource.options),
    CacheModule.register({
      isGlobal: true,
      ttl: 0,
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    CryptModule,
    AuthModule,
    UserModule,
    CoreModule,
    ChatModule,
    FileModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: ApiErrorLoggingFilter },
    { provide: APP_GUARD, useClass: JwtAccessGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
