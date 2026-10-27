import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';

export function loadEnvFiles(): void {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), 'apps/api/.env'),
    resolve(process.cwd(), '../../.env'),
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    const contents = readFileSync(filePath, 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const rawVal = trimmed.slice(eqIdx + 1).trim();
      const val = rawVal.replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvFiles();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(__dirname, '../../**/*.entity{.ts,.js}')],
  subscribers: [join(__dirname, '../../**/*.subscriber{.ts,.js}')],
  migrations: [join(__dirname, '../../migrations/*{.ts,.js}')],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
};

export const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
