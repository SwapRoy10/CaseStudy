// original code by swap, written by hand

import { createApp } from './app';
import { config } from './config';
import { prisma } from './db';
import { logger } from './middleware/logger';

// shutdown adapted from the template, forced exit after 10s
const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = createApp().listen(config.port, () => {
  logger.info(`CaseStudy API listening on http://localhost:${config.port}/api`);
  logger.info(config.useMockData ? 'Matching is using the mock student list' : 'Matching is reading from Postgres');
  // with demo routes on, anyone can sign in as any student
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

  server.close(async () => { // stops new connections, waits for open ones
    await prisma.$disconnect(); // release db connections so the process can exit
    logger.info('Server closed');
    process.exit(0);
  });
  server.closeIdleConnections(); // browsers keep idle ones open, so ctrl+c would hit the timeout

  setTimeout(() => { // force exit if close() hangs
    logger.error('Forcing shutdown after timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
// unhandled promise means unknown state, so crash instead of serving bad data
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});
