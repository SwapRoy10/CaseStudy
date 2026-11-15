// mutation testing for the matching code (`npm run test:mutation`).
// stryker makes lots of small changes to the code, like flipping < to <= or
// deleting a line, and runs our tests against each one. if a test fails, that
// change was "killed". the mutation score is how many changes our tests caught.
// report ends up in reports/mutation/mutation.html (gitignored).
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
  vitest: { related: false },
  tempDirName: '.stryker-tmp',
  // stryker's tsconfig step breaks on our typescript version and we don't use
  // project references anyway, so point it at nothing to skip that step
  tsconfigFile: 'no-tsconfig-for-stryker.json',
};
