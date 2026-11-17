// runs prisma migrate deploy. prisma wants DIRECT_URL set (see the datasource in
// schema.prisma), but for a local database it's the same as DATABASE_URL, so fall
// back to that instead of making everyone add a second line to .env.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
process.env.DIRECT_URL ||= process.env.DATABASE_URL;

if (!process.env.DIRECT_URL) {
  console.error('DATABASE_URL is not set. Add it to backend/.env first, see .env.example.');
  process.exit(1);
}

execFileSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' });
