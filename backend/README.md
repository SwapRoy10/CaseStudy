# CaseStudy backend

Backend & Integration; API routing, debugging,
Matching  Algorithm

## Matching Algorithm

Right now the backend only has the matching module in [`src/matching/`](src/matching/). Matching takes one student's profile for a course and gives back a ranked list of classmates they could work with. This is a quick outline. The full walkthrough with worked examples is in [`docs/README.md`](../docs/README.md).

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

There is no server yet, so the tests are the way to run the code.

```sh
npm ci
npm test
npm run typecheck
```

### Waiting on other parts

Matching is written so it can be tested on its own, but it still depends on parts other people are building. Until those are in, matching runs on mock data in [`src/matching/data.ts`](src/matching/data.ts).

| Needed from | What matching needs | Where it plugs in |
|---|---|---|
| Database | Real queries for profiles and enrollment. Only students on the roster with a complete profile should come back, and blocks should be read in one batch | Replace `getProfile` and `getCourseProfiles` in `data.ts` |
| Peer review | A real `getAverage` | Replace the mock `getAverage` in `data.ts` |
| API layer | A route that calls `findCandidates` with the student id from the session, and turns thrown errors into API errors | Calls `findCandidates` in `src/matching/findCandidates.ts` |
| Match requests | A check before saving a request that the recipient is still eligible | Calls `isEligible` in `src/matching/pipeline.ts` |
| Profiles | Cleaning up blocks the same way when a profile is saved | Calls `normalizeBlocks` in `src/matching/availability.ts` |

The function signatures in `data.ts` are what the real queries should match. `findCandidates` already checks the data it gets back, so if a real query returns rows in the wrong shape, `findCandidates` throws an error instead of quietly giving wrong matches.
