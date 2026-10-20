import { existsSync } from 'node:fs';

// Load backend/.env if there is one (copy .env.example to start). Node 22 can
// read .env files itself, so no dotenv dependency.
if (existsSync('.env')) process.loadEnvFile('.env');

export const config = {
  port: Number(process.env.PORT ?? 4000),
  // Comma-separated list. Only matters when the frontend calls the API directly;
  // in dev the Vite proxy makes requests same-origin.
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
