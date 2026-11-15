# Code coverage and mutation testing

How we measure how well the backend is tested. The test cases themselves are in the functional testing doc. This page covers the measurement.

## Coverage

We use Vitest's built-in V8 coverage (`@vitest/coverage-v8`). It reports four control-flow criteria for every backend file:

* **Statements**: was each statement run?
* **Branches**: did each `if`, `?:`, `&&` and `||` go both ways?
* **Functions**: was each function called?
* **Lines**: was each line run?

```sh
npm run db:up                     # from the repo root, starts postgres
cd backend && npm run test:coverage
```

The report opens from `backend/coverage/index.html`. The run fails if coverage drops below 90% of statements, lines and functions, or 80% of branches (`backend/vitest.config.mts`). CI starts its own Postgres, so the database tests count, and the HTML report can be downloaded from each run.

Results on November 12, 2026, 122 tests:

| Criterion | Coverage |
|---|---|
| Statements | 96.1% |
| Branches | 85.0% |
| Functions | 95.6% |
| Lines | 97.1% |

Without a database the same suite only reaches about 70% of lines, because the database tests skip. That's why CI runs with Postgres.

**How we use it.** Coverage tells us where to look. It isn't a score to chase. When a file comes up short, we check the SRS and SDD and write tests for what they say. For example, the seed code and the no-database roster weren't covered. Their new tests check two things the docs promise: that the seed can be rerun safely, and that the mock data and the database return the same roster.

We don't measure condition coverage or MC/DC. V8 doesn't report them, and they're aimed at safety-critical software.

## Mutation testing

Coverage only shows that a line ran, not that a test would notice if it were wrong. For the matching engine we also run Stryker:

```sh
cd backend && npm run test:mutation
```

Stryker makes small changes, called mutants, to `availability.ts`, `stages.ts`, `pipeline.ts` and `findCandidates.ts`. For example, it flips `<=` to `<` or replaces a condition with `true`. Then it reruns the tests. A mutant is killed if at least one test fails.

| Run | Mutants | Killed or timed out | Survived | Score |
|---|---|---|---|---|
| First | 234 | 232 | 2 | 99.15% |
| After two new tests | 234 | 234 | 0 | 100% |

The two survivors were missing boundary tests in `isValidBlock`:

* `weekday <= 6` changed to `weekday < 6` survived, because nothing checked that Saturday (6) is valid.
* `startMinute >= 0` replaced with `true` survived, because nothing checked a block that starts before midnight.

Both edges come from SDD 5.1, and both now have tests.

## Other things we found

* A rare failure in the 200-student test traced back to the seed. When it reset the id counters it could move them backwards, so a new student could get an id that was already taken. The fix only ever moves the counters forward, and a test now reproduces the problem on the old code.
* Errors from the profile and enrollment modules would have come back as 503 once their routes were wired. The error handler now maps them to 400 and 409, with tests.

## What isn't measured yet

* The frontend has no automated tests, so it has no coverage numbers. Screen tests are checked by hand.
* Mutation testing only covers the matching engine.
* Match requests, groups, peer review and sign in aren't built yet, so their test cases can't run.
