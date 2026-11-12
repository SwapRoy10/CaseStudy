import { defineConfig } from 'vitest/config';

// `npm test` runs the tests. `npm run test:coverage` also measures which lines
// and branches the tests actually ran, and writes a browsable report to
// coverage/index.html (the folder is gitignored).
export default defineConfig({
  test: {
    globalSetup: ['./src/globalSetup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // tests, test helpers and the startup file aren't code we're measuring
      exclude: ['src/**/*.test.ts', 'src/**/testUtils.ts', 'src/server.ts', 'src/globalSetup.ts'],
      reporter: ['text', 'html', 'json-summary'],
      // the run fails if coverage drops under these. they're a little under what
      // we measured with the database tests on (about 97% of lines, 86% of
      // branches), so this needs postgres running. see database/README.md
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 80,
      },
    },
  },
});
