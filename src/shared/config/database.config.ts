import 'dotenv/config';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from './snake-naming.strategy.js';
import { AppEnvironment, resolveEnvironment } from './environment.config.js';

export const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize:
    resolveEnvironment(process.env.ENVIRONMENT) === AppEnvironment.DEVELOPMENT,
  migrations: ['dist/migrations/*.js'],
  migrationsRun: true,
  namingStrategy: new SnakeNamingStrategy(),
  entities: ['dist/**/*.entity.js'],
});
