// mutation testing for the matching code (`npm run test:mutation`)
export default {
  testRunner: 'vitest',
  // only the matching logic, not the db reads or the mock data
  mutate: [
    'src/matching/availability.ts',
    'src/matching/stages.ts',
    'src/matching/pipeline.ts',
    'src/matching/findCandidates.ts',
  ],
  reporters: ['clear-text', 'html', 'progress'],
  coverageAnalysis: 'perTest',
  // the tests that need postgres are skipped here, they don't touch this code
  vitest: { related: false, configFile: 'vitest.stryker.config.mts' },
  tempDirName: '.stryker-tmp',
  // stryker's tsconfig step breaks on our typescript, so point it at nothing
  tsconfigFile: 'no-tsconfig-for-stryker.json',
};
