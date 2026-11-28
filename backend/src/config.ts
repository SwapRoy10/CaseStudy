// original code by swap, written by hand

import { existsSync } from 'node:fs';
import { z } from 'zod';

// env validation from the template, bad settings stop the server at startup

// loads backend/.env if present (copy .env.example), real env vars win
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
  // only for direct api calls, the vite proxy makes dev and the demo same origin
  CORS_ORIGIN: commaList.default(['http://localhost:5173', 'http://localhost:4173']),
  // requests per ip per 15 minutes on /api, health checks don't count
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  // proxies in front of the server, 0 for none (else all share one rate limit)
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  DATABASE_URL: z.string().optional(),
  // use the in memory sample list, on by default with no DATABASE_URL
  USE_MOCK_DATA: z.enum(['true', 'false']).optional(),
  // signs the session cookie, required in production
  SESSION_SECRET: z.string().min(32, 'must be at least 32 characters').optional(),
  // key for roster import, unset turns import off
  OPERATOR_KEY: z.string().min(16, 'must be at least 16 characters').optional(),
  // demo roster and passwordless sign in, on outside production only
  DEMO_ROUTES: z.enum(['true', 'false']).optional(),
  // canvas rosters only have a login id, so build the school email from it
  SCHOOL_EMAIL_DOMAIN: z.string().min(1).default('case.edu'),
});

export type Env = z.infer<typeof envSchema>;

// split out so tests can pass fake environments
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid backend environment (check backend/.env):\n${problems}`);
  }
  // a guessable secret lets anyone forge a session cookie
  if (result.data.NODE_ENV === 'production' && !result.data.SESSION_SECRET) {
    throw new Error('Invalid backend environment (check backend/.env):\n  SESSION_SECRET: required in production');
  }
  if (result.data.NODE_ENV === 'production' && result.data.DEMO_ROUTES === 'true') {
    throw new Error('Invalid backend environment (check backend/.env):\n  DEMO_ROUTES: can not be true in production');
  }
  return result.data;
}

let env: Env;
try {
  env = parseEnv(process.env);
} catch (err) {
  // logger isn't ready yet, it reads LOG_LEVEL from here
  console.error((err as Error).message);
  process.exit(1);
}

export const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  // silent in tests, debug in dev, info in production
  logLevel: env.LOG_LEVEL ?? (env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'development' ? 'debug' : 'info'),
  corsOrigins: env.CORS_ORIGIN,
  rateLimitMax: env.RATE_LIMIT_MAX,
  trustProxy: env.TRUST_PROXY,
  // explicit setting wins, no database means mock data
  useMockData: env.USE_MOCK_DATA ? env.USE_MOCK_DATA === 'true' : !env.DATABASE_URL,
  sessionSecret: env.SESSION_SECRET ?? 'dev-only-session-secret-do-not-use-in-production',
  demoRoutes: env.DEMO_ROUTES ? env.DEMO_ROUTES === 'true' : env.NODE_ENV !== 'production',
  operatorKey: env.OPERATOR_KEY,
  schoolEmailDomain: env.SCHOOL_EMAIL_DOMAIN.toLowerCase(),
};
