# CaseStudy backend

Right now the backend only has the matching module in [`src/matching/`](src/matching/). How it works is explained in [`docs/README.md`](../docs/README.md).

## Running it

There is no server yet, so the tests are the way to run the code.

```sh
npm ci
npm test
npm run typecheck
```

## Waiting on other parts

Matching is written so it can be tested on its own, but it still depends on parts other people are building. Until those are in, matching runs on mock data in [`src/matching/data.ts`](src/matching/data.ts).

| Needed from | What matching needs | Where it plugs in |
|---|---|---|
| Database | Real queries for profiles and enrollment. Only students on the roster with a complete profile should come back, and blocks should be read in one batch | Replace `getProfile` and `getCourseProfiles` in `data.ts` |
| Peer review | A real `getAverage` | Replace the mock `getAverage` in `data.ts` |
| API layer | A route that calls `findCandidates` with the student id from the session, and turns thrown errors into API errors | Calls `findCandidates` in `src/matching/findCandidates.ts` |
| Match requests | A check before saving a request that the recipient is still eligible | Calls `isEligible` in `src/matching/pipeline.ts` |
| Profiles | Cleaning up blocks the same way when a profile is saved | Calls `normalizeBlocks` in `src/matching/availability.ts` |

The function signatures in `data.ts` are what the real queries should match. `findCandidates` already checks the data it gets back, so if a real query returns rows in the wrong shape, `findCandidates` throws an error instead of quietly giving wrong matches.
