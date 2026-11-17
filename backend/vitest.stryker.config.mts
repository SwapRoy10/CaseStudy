import { defineConfig, configDefaults } from 'vitest/config';

// used only by `npm run test:mutation`. stryker runs the tests in a copy of the
// backend folder, and the sample canvas export lives outside it, so that one
// test can't find its file there. it doesn't touch the matching code anyway.
export default defineConfig({
  test: {
    globalSetup: ['./src/globalSetup.ts'],
    exclude: [...configDefaults.exclude, 'src/enrollment/rosterFile.test.ts'],
  },
});
