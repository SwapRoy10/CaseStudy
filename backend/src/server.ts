import { createApp } from './app';
import { config } from './config';
import { logger } from './middleware/logger';

// Graceful shutdown adapted from the template: on Ctrl+C / SIGTERM, stop taking
// new connections, let in-flight requests finish, then exit (forced after 10s).

const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = createApp().listen(config.port, () => {
  logger.info(`CaseStudy API listening on http://localhost:${config.port}/api`);
  logger.info(config.useMockData ? 'Matching is using the mock student list' : 'Matching is reading from Postgres');
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
    // TODO (database module): close the DB pool / Prisma client here
    logger.info('Server closed');
    process.exit(0);
  });
  server.closeIdleConnections();

  setTimeout(() => {
    logger.error('Forcing shutdown after timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});
