// collaborative code by the group and claude sonnet 5.5

// runs prisma migrate deploy, DIRECT_URL falls back to DATABASE_URL
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
process.env.DIRECT_URL ||= process.env.DATABASE_URL;

if (!process.env.DIRECT_URL) {
  console.error('DATABASE_URL is not set. Add it to backend/.env first, see .env.example.');
  process.exit(1);
}

execFileSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' });
