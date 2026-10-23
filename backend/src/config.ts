import { existsSync } from 'node:fs';
import { z } from 'zod';

// Env validation adapted from the express-typescript-prisma-postgresql template:
// every setting is declared and validated here, and the server refuses to start
// with a clear message instead of failing later in some confusing way.

// Load backend/.env if there is one (copy .env.example to start). Node 22 reads
// .env files itself, so no dotenv dependency. Real env vars win over the file.
if (existsSync('.env')) process.loadEnvFile('.env');

const commaList = z
  .string()
  .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
  .pipe(
    z.array(
      z.url({ protocol: /^https?$/, message: 'each entry must be a full http(s) URL, e.g. http://localhost:5173' })
    )
  );

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  // Only matters when the frontend calls the API directly; in dev and the demo
  // the Vite proxy makes requests same-origin.
  CORS_ORIGIN: commaList.default(['http://localhost:5173', 'http://localhost:4173']),
  // Requests per IP per 15 minutes on /api (health checks don't count)
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  DATABASE_URL: z.string().optional(),
  // Matching reads the short mock list in matching/mockData.ts instead of Postgres.
  // Left unset, it is on only when there is no DATABASE_URL.
  USE_MOCK_DATA: z.enum(['true', 'false']).optional(),
});

export type Env = z.infer<typeof envSchema>;

// Separate from the startup code below so tests can feed it fake environments.
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid backend environment (check backend/.env):\n${problems}`);
  }
  return result.data;
}

let env: Env;
try {
  env = parseEnv(process.env);
} catch (err) {
  // Logger isn't set up yet (it reads LOG_LEVEL from here), so plain console
  console.error((err as Error).message);
  process.exit(1);
}

export const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  // quiet tests, chatty dev, normal production, unless LOG_LEVEL says otherwise
  logLevel: env.LOG_LEVEL ?? (env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'development' ? 'debug' : 'info'),
  corsOrigins: env.CORS_ORIGIN,
  rateLimitMax: env.RATE_LIMIT_MAX,
  // Explicit setting wins; otherwise no database means mock data, so the demo
  // and tests run on any laptop without Postgres
  useMockData: env.USE_MOCK_DATA ? env.USE_MOCK_DATA === 'true' : !env.DATABASE_URL,
};
