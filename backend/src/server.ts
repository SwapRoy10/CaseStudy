import { createApp } from './app';
import { config } from './config';

const server = createApp().listen(config.port, () => {
  console.log(`CaseStudy API listening on http://localhost:${config.port}/api`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} is already in use. Stop the other process or set PORT in backend/.env.`);
    process.exit(1);
  }
  throw err;
});
