import { createApp } from './app';
import { config } from './config';
import { prisma } from './db';
import { logger } from './middleware/logger';

// graceful shutdown adapted from the template: on ctrl+c / SIGTERM, stop taking
// new connections, let in-flight requests finish, then exit (forced after 10s).

const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = createApp().listen(config.port, () => {
  logger.info(`CaseStudy API listening on http://localhost:${config.port}/api`);
  logger.info(config.useMockData ? 'Matching is using the mock student list' : 'Matching is reading from Postgres');
  // anyone who can reach the server can sign in as any student with these on
  if (config.demoRoutes && !config.useMockData) {
    logger.warn('Demo routes are on: anyone can sign in as any student. Set DEMO_ROUTES=false for a real deployment.');
  }
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logger.fatal(`Port ${config.port} is already in use. Stop the other process or set PORT in backend/.env.`);
    process.exit(1);
  }
  throw err;
});

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down`);

  server.close(async () => {
    // let go of the database connections so the process can exit cleanly
    await prisma.$disconnect();
    logger.info('Server closed');
    process.exit(0);
  });
  // close() waits for open connections, and browsers keep idle ones alive, which
  // would make every ctrl+c hit the 10s timeout
  server.closeIdleConnections();

  setTimeout(() => {
    logger.error('Forcing shutdown after timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
// a promise nobody handled means the app is in an unknown state. crash loudly
// rather than keep serving possibly wrong results.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});
