# CaseStudy backend

Backend & Integration; API routing, debugging,
Matching  Algorithm

## Running the server

Express 5 + TypeScript. From the repo root, `npm run dev` starts this together with the frontend.

```bash
npm install
npm run dev        # http://localhost:4000/api, reloads on save
npm test           # matching + API + config tests
npm run build && npm start
```

Config: copy `.env.example` to `.env` (optional; defaults work for local dev). Every setting is validated with Zod in `src/config.ts`. A bad value stops the server at startup with a message naming the variable.

## How a request flows

```
requestLogger → helmet → cors → json → rate limit → routes/index.ts
                                                         ↓
                                     validate(...) → controller → module (matching/, profile/, ...)
                                                                     ↓ throws
                                                   middleware/errorHandler.ts → { error: { code, reason?, message } }
```

- **Routes** map URLs to a controller, with `validate({ params, query, body })` in front to check input with Zod schemas.
- **Controllers** read validated input from `res.locals.params` / `.query` / `.body` and the student from `res.locals.studentId`, call one module function and send its result. No business logic.
- **Modules** know nothing about Express. They throw `StateConflictError` for expected failures and plain errors for everything else.
- **errorHandler** maps those to HTTP statuses (SDD 10.3) and logs unexpected errors with the request id. See `docs/api/README.md`.

## Adding an endpoint

1. Write the module function (e.g. `profile/saveProfile.ts`) with its own tests.
2. Add Zod schemas for its input (reuse `courseParams` / `idString` from `middleware/validate.ts`).
3. Add a controller in `controllers/`.
4. Add one line in `routes/index.ts`: `apiRouter.put('/courses/:courseId/profile', validate({ params: courseParams, body: profileBody }), saveProfile);`
5. Add a test in `src/app.test.ts` and document it in `docs/api/README.md`.

## Borrowed from the express-typescript-prisma-postgresql template

| From the template | Here | Notes |
| --- | --- | --- |
| Zod env validation, fail fast | `src/config.ts` | Uses Node's built-in `.env` loading instead of dotenv |
| helmet, CORS whitelist, rate limiting | `src/app.ts`, `middleware/security.ts` | Health checks exempt; 429s use our error shape |
| pino + pino-http, request ids, redaction | `middleware/logger.ts` | Logs to stdout (one line per request in dev), silent in tests |
| Zod request validation middleware | `middleware/validate.ts` | Validates params, query and body, not just body |
| Graceful shutdown | `src/server.ts` | Add the DB disconnect there once the database module lands |
| App/server split, `tsconfig.build.json`, Supertest integration tests | already matched | |

Not taken: `uni-response` (the SDD defines our error shape), JWT/bcrypt auth (login isn't designed yet; when it is, the template's `auth.middleware.ts` and the stricter login rate limiter are good references), the `features/<name>/{controllers,routes,...}` folder nesting (the matching module's flat layout is already established), and ESLint/Prettier/Husky (worth a team decision; adding them would reformat everyone's code). Prisma is the database owner's call; see the template's `prisma/` and `src/config/prisma.config.ts` if you go that way.

## Matching Algorithm

The matching module is in [`src/matching/`](src/matching/). Matching takes one student's profile for a course and gives back a ranked list of classmates they could work with. This is a quick outline. The full walkthrough with worked examples is in [`docs/README.md`](../docs/README.md).

### What's done

| File | What it does |
|---|---|
| [`findCandidates.ts`](src/matching/findCandidates.ts) | The entry point. Loads the profiles, checks the data, ranks, then adds review averages |
| [`pipeline.ts`](src/matching/pipeline.ts) | `rankCandidates` runs the five rules in order. Also has `isEligible` |
| [`stages.ts`](src/matching/stages.ts) | One function for each rule |
| [`availability.ts`](src/matching/availability.ts) | The time math: checking blocks, finding overlaps, merging, counting |
| [`types.ts`](src/matching/types.ts), [`errors.ts`](src/matching/errors.ts) | Shared types and the `NO_PROFILE` error |
| [`data.ts`](src/matching/data.ts) | Mock data for now (see below) |

The tests are in the `.test.ts` files next to the code. There are 57 and they all pass.

### Inputs

`findCandidates(studentId, courseId)` looks up the student's profile and everyone else's profile in that course. A profile has:

* `gradeGoal`: `A_TRACK` or `PASS_TRACK`
* `workStyle`: `SOLO` or `GROUP`
* `blocks`: weekly free times, like `{ weekday: 1, startMinute: 540, endMinute: 600 }` for Monday 9:00 to 10:00

Weekdays go from 0 (Sunday) to 6. Times are minutes from midnight, so a block has to fit inside one day (0 to 1440).

### How ranking works

There's no weighted score. Matching goes through five rules in a fixed order, and each later rule only sorts out ties left by the earlier ones.

1. **Same grade goal.** Anyone with a different goal is removed. You're also removed from your own list.
2. **Some shared time.** Anyone who doesn't share at least some time with you is removed. Blocks that only touch (9:00 to 10:00 and 10:00 to 11:00) don't count as shared.
3. **Overlap count.** Sort by how many of your blocks overlap with theirs, most first.
4. **Work style.** If two people have the same count, the one with your work style goes first.
5. **Random.** If they're still tied after that, they're shuffled.

The overlap count is about your blocks, not total minutes. Before counting, your blocks are cleaned up: duplicates go away and blocks that overlap get merged. Blocks that only touch stay separate. So if a classmate is free for a whole hour, two 30 minute blocks inside it count as 2, but one 1 hour block counts as 1. We did that on purpose so each 30 minute slot counts.

Review averages are never used for ranking. They're only added on after the order is decided.

### What comes back

A list of everyone who passed both filters, in rank order, with no limit on how many. Each person has `candidateId`, `gradeGoal`, `workStyle`, `sharedIntervals` (just the overlapping times, not their whole schedule) and `reviewAverage` (`null` if nobody has reviewed them yet). No names or emails.

### Edge cases

* **No matches:** you get an empty list. That's a normal result, not an error.
* **No profile, or a profile with no free times:** throws `StateConflictError` with reason `NO_PROFILE`.
* **Classmate with no free times:** they just don't show up.
* **Duplicate or overlapping blocks:** cleaned up before counting, so they can't make someone's count higher.
* **Bad data:** throws an error instead of giving wrong matches. This covers a profile from the wrong course, enum values spelled differently (like `'A track'`), number ids instead of strings, invalid blocks, the same student twice, and a review average that isn't `null` or a number from 1 to 5.
* **Not handled:** blocks that go past midnight have to be saved as two blocks. Nothing converts time zones.

### Running it

`npm test` runs the matching tests along with the API tests. Over HTTP, matching is served at `GET /api/courses/:courseId/candidates` (see [Running the server](#running-the-server) and [`docs/api/README.md`](../docs/api/README.md)).

### Waiting on other parts

Matching is written so it can be tested on its own, but it still depends on parts other people are building. Until those are in, matching runs on mock data in [`src/matching/data.ts`](src/matching/data.ts).

| Needed from | What matching needs | Where it plugs in |
|---|---|---|
| Database | Real queries for profiles and enrollment. Only students on the roster with a complete profile should come back, and blocks should be read in one batch | Replace `getProfile` and `getCourseProfiles` in `data.ts` |
| Peer review | A real `getAverage` | Replace the mock `getAverage` in `data.ts` |
| API layer | ~~A route that calls `findCandidates` with the student id from the session, and turns thrown errors into API errors~~ **Done**: `GET /api/courses/:courseId/candidates` | [`src/controllers/candidates.controller.ts`](src/controllers/candidates.controller.ts) |
| Match requests | A check before saving a request that the recipient is still eligible | Calls `isEligible` in `src/matching/pipeline.ts` |
| Profiles | Cleaning up blocks the same way when a profile is saved | Calls `normalizeBlocks` in `src/matching/availability.ts` |

The function signatures in `data.ts` are what the real queries should match. `findCandidates` already checks the data it gets back, so if a real query returns rows in the wrong shape, `findCandidates` throws an error instead of quietly giving wrong matches.
