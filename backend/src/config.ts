import { existsSync } from 'node:fs';
import { z } from 'zod';

// env validation adapted from the express-typescript-prisma-postgresql template:
// every setting is declared and validated here, and the server refuses to start
// with a clear message instead of failing later in some confusing way.

// load backend/.env if there is one (copy .env.example to start). node 22 reads
// .env files itself, so no dotenv dependency. real env vars win over the file.
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
  // only matters when the frontend calls the api directly. in dev and the demo
  // the vite proxy makes requests same-origin.
  CORS_ORIGIN: commaList.default(['http://localhost:5173', 'http://localhost:4173']),
  // requests per IP per 15 minutes on /api (health checks don't count)
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  // how many proxies sit between the internet and this server. behind them every
  // request looks like it comes from the proxy, so the rate limits would be shared
  // by everyone. 0 means none.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  DATABASE_URL: z.string().optional(),
  // matching reads the short mock list in matching/mockData.ts instead of postgres.
  // left unset, it is on only when there is no DATABASE_URL.
  USE_MOCK_DATA: z.enum(['true', 'false']).optional(),
  // signs the session cookie. needed in production, dev and tests use a fixed one.
  SESSION_SECRET: z.string().min(32, 'must be at least 32 characters').optional(),
  // the key the team operator sends to import a roster. left unset, roster
  // import is switched off.
  OPERATOR_KEY: z.string().min(16, 'must be at least 16 characters').optional(),
  // the demo roster and the sign in without a password. on everywhere except
  // production, set false to turn them off on any other server. can't be on in production.
  DEMO_ROUTES: z.enum(['true', 'false']).optional(),
  // canvas rosters only list a login id (the case id), so this turns it into
  // the school email we store. a login id that already has an @ is used as is.
  SCHOOL_EMAIL_DOMAIN: z.string().min(1).default('case.edu'),
});

export type Env = z.infer<typeof envSchema>;

// separate from the startup code below so tests can feed it fake environments.
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid backend environment (check backend/.env):\n${problems}`);
  }
  // a guessable secret would let anyone make their own session cookie
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
  // logger isn't set up yet (it reads LOG_LEVEL from here), so plain console
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
  trustProxy: env.TRUST_PROXY,
  // explicit setting wins, otherwise no database means mock data, so the demo
  // and tests run on any laptop without postgres
  useMockData: env.USE_MOCK_DATA ? env.USE_MOCK_DATA === 'true' : !env.DATABASE_URL,
  sessionSecret: env.SESSION_SECRET ?? 'dev-only-session-secret-do-not-use-in-production',
  demoRoutes: env.DEMO_ROUTES ? env.DEMO_ROUTES === 'true' : env.NODE_ENV !== 'production',
  operatorKey: env.OPERATOR_KEY,
  schoolEmailDomain: env.SCHOOL_EMAIL_DOMAIN.toLowerCase(),
};
