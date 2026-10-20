# CaseStudy matching algorithm explanations

CaseStudy helps students in the same course find study or project partners. A student saves a course profile with a grade goal, a work style and their weekly free time. The matching code takes that profile and returns a ranked list of classmates they could work with.

This page explains the matching code in [`backend/src/matching/`](../backend/src/matching/). It only covers matching.

## What is built right now

| Part | Status |
|---|---|
| The five matching rules ([`stages.ts`](../backend/src/matching/stages.ts), [`pipeline.ts`](../backend/src/matching/pipeline.ts)) | Working, unit tested |
| Availability overlap math ([`availability.ts`](../backend/src/matching/availability.ts)) | Working, unit tested |
| `findCandidates` with input checks ([`findCandidates.ts`](../backend/src/matching/findCandidates.ts)) | Working, tested against mock data |
| Profile and review data ([`data.ts`](../backend/src/matching/data.ts)) | **Mock.** Hardcoded profiles and review averages, no database |
| HTTP route for matching | Working: `GET /api/courses/:courseId/candidates` ([`candidates.controller.ts`](../backend/src/controllers/candidates.controller.ts)), tested in [`app.test.ts`](../backend/src/app.test.ts) |
| `isEligible` check for match requests | Written and tested, but nothing calls it yet |

You can run matching through the unit tests, or over HTTP with `npm run dev` from the repo root. The route is `GET /api/courses/{courseId}/candidates`, with `courseId` from the URL and `studentId` from the session (for now a demo `X-Student-Id` header, see [`docs/api/README.md`](api/README.md)). It still reads mock data. The parts matching is waiting on from the rest of the team are listed in [`backend/README.md`](../backend/README.md#waiting-on-other-parts).

## Files

| File | What it does |
|---|---|
| [`types.ts`](../backend/src/matching/types.ts) | `Profile`, `AvailabilityBlock` and `CandidateSummary` types |
| [`availability.ts`](../backend/src/matching/availability.ts) | Block validation, overlap of two blocks, merging, overlap counting |
| [`stages.ts`](../backend/src/matching/stages.ts) | One function per matching rule |
| [`pipeline.ts`](../backend/src/matching/pipeline.ts) | `rankCandidates` runs the rules in order. Also `isEligible` |
| [`findCandidates.ts`](../backend/src/matching/findCandidates.ts) | Entry point. Loads data, checks it, ranks, adds review averages |
| [`data.ts`](../backend/src/matching/data.ts) | Mock data access (`getProfile`, `getCourseProfiles`, `getAverage`) |
| [`errors.ts`](../backend/src/matching/errors.ts) | `StateConflictError`. Matching only uses the `NO_PROFILE` reason |
| [`testUtils.ts`](../backend/src/matching/testUtils.ts) | Test helpers. `block(1, 9, 9.5)` means Monday 9:00 to 9:30 |

## How one call goes through the code

`findCandidates(studentId, courseId, rng = Math.random)` in [`findCandidates.ts`](../backend/src/matching/findCandidates.ts):

1. Load the requester's profile with `getProfile`. If there is no profile, or it has no availability blocks, throw `StateConflictError` with reason `NO_PROFILE`.
2. Check the requester's profile data (see [Bad data checks](#bad-data-checks)).
3. Load every profile in the course with `getCourseProfiles` and check each one.
4. Throw if the same student shows up twice.
5. Call `rankCandidates` in [`pipeline.ts`](../backend/src/matching/pipeline.ts), which runs the five rules below.
6. For each ranked candidate, look up their review average with `getAverage`.
7. Return a `CandidateSummary` for each one, in rank order.

The review average is added only after ranking, so it can't change anyone's position.

## Inputs

A profile looks like this:

```ts
{
  profileId: '1',
  studentId: '101',
  courseId: '1',
  gradeGoal: 'A_TRACK',       // or 'PASS_TRACK'
  workStyle: 'GROUP',         // or 'SOLO'
  blocks: [
    { weekday: 1, startMinute: 540, endMinute: 660 },   // Mon 9:00 to 11:00
  ],
}
```

Each block is one weekly time slot:

* `weekday` is 0 to 6, with 0 as Sunday.
* `startMinute` and `endMinute` are minutes from midnight. The type comment says these are in America/New_York time. The matching code does no time zone conversion.
* A valid block has whole numbers and `0 <= startMinute < endMinute <= 1440`. So a block can't go past midnight.

IDs are strings so large Postgres ids don't get rounded by JavaScript.

## The rules

Matching does **not** use a weighted score. It runs five rules in a fixed order. Each rule only filters the list or reorders within ties from the rule before it.

1. **Grade goal filter** (`filterByGradeGoal`). Keep classmates with the same grade goal. This also removes the requester from their own results.
2. **Availability filter** (`filterByAvailability`). Keep classmates who share at least one bit of time with the requester. This step also works out the overlap count and the shared intervals.
3. **Overlap ranking** (`rankByOverlap`). Sort by overlap count, highest first.
4. **Work style tie break** (`tieBreakByWorkStyle`). Among candidates with the same overlap count, put the ones with the requester's work style first.
5. **Random tie break** (`randomTieBreak`). Shuffle candidates who are still tied on both overlap count and work style. It uses a Fisher-Yates shuffle with the `rng` you pass in, so tests can pass `() => 0` to get a fixed order.

Nothing else affects the order. Review averages are not used.

Every candidate who passes both filters is returned. There is no limit on how many.

### How overlap works

Two blocks overlap only if they are on the same weekday and `max(starts) < min(ends)`. The shared part is clipped to that range. Blocks that only touch, like 9:00 to 10:00 and 10:00 to 11:00, do **not** overlap.

Before counting, the requester's blocks are cleaned up with `normalizeBlocks`:

* exact duplicates are removed
* blocks that overlap on the same day are merged into one
* blocks that only touch are **kept separate**

The **overlap count** is the number of the requester's cleaned up blocks that overlap at least one of the candidate's blocks. A requester block that hits two candidate blocks still counts once.

This means the count is about blocks, not minutes. The team decided to keep touching blocks separate so each 30 minute slot counts on its own (see the comment in [`availability.ts`](../backend/src/matching/availability.ts)). For example, against a candidate free Monday 9:00 to 10:00:

| Requester saved | Overlap count |
|---|---|
| one block, Mon 9:00 to 10:00 | 1 |
| two blocks, Mon 9:00 to 9:30 and 9:30 to 10:00 | 2 |

The candidate's blocks are not cleaned up the same way. That's fine for the count, because each requester block counts at most once however many candidate blocks it hits.

The **shared intervals** are the clipped overlaps. Overlapping pieces are merged for display and touching pieces stay separate. The candidate's full schedule is never returned.

## Output

`findCandidates` returns an array of `CandidateSummary`:

```ts
{
  candidateId: string,
  gradeGoal: 'A_TRACK' | 'PASS_TRACK',
  workStyle: 'SOLO' | 'GROUP',
  sharedIntervals: AvailabilityBlock[],
  reviewAverage: number | null,   // null means no reviews yet
}
```

It has no name, email or full availability on purpose. The overlap count is used for ranking but is not sent back.

## Example: input and output

This uses the mock data in [`data.ts`](../backend/src/matching/data.ts), and it is what `findCandidates.test.ts` checks.

Student `101` asks for matches in course `1`. They are `A_TRACK`, `GROUP`, free Mon 9:00 to 11:00 and Wed 13:00 to 15:00.

| Classmate | Goal, style | Free | Result |
|---|---|---|---|
| 102 | A_TRACK, GROUP | Mon 10:00 to 12:00, Wed 14:00 to 16:00 | count 2 |
| 103 | A_TRACK, SOLO | Mon 8:00 to 9:30 | count 1 |
| 104 | PASS_TRACK, GROUP | Mon 9:00 to 11:00 | removed, different grade goal |
| 105 | A_TRACK, GROUP | Fri 10:00 to 12:00 | removed, no shared time |
| 106 | A_TRACK, GROUP | Wed 13:00 to 14:00 | count 1 |
| 107 | A_TRACK, SOLO | nothing saved | removed, no shared time |

103 and 106 both have a count of 1. 106 has the same work style as 101 (`GROUP`), so 106 goes first. 103 has the highest review average (4.9) but still comes last, because averages don't affect ranking.

```ts
await findCandidates('101', '1');
```

```json
[
  {
    "candidateId": "102",
    "gradeGoal": "A_TRACK",
    "workStyle": "GROUP",
    "sharedIntervals": [
      { "weekday": 1, "startMinute": 600, "endMinute": 660 },
      { "weekday": 3, "startMinute": 840, "endMinute": 900 }
    ],
    "reviewAverage": 3.2
  },
  {
    "candidateId": "106",
    "gradeGoal": "A_TRACK",
    "workStyle": "GROUP",
    "sharedIntervals": [{ "weekday": 3, "startMinute": 780, "endMinute": 840 }],
    "reviewAverage": null
  },
  {
    "candidateId": "103",
    "gradeGoal": "A_TRACK",
    "workStyle": "SOLO",
    "sharedIntervals": [{ "weekday": 1, "startMinute": 540, "endMinute": 570 }],
    "reviewAverage": 4.9
  }
]
```

## Worked ranking example with a random tie

Made up data, run through `rankCandidates`. The requester is `A_TRACK`, `GROUP` and saved these blocks:

* Mon 9:00 to 9:30
* Mon 9:30 to 10:00
* Wed 14:00 to 16:00
* Wed 14:00 to 16:00 (saved twice by mistake)

After cleanup that's 3 blocks: the two Monday half hours stay separate because they only touch, and the duplicate Wednesday block is dropped.

| Classmate | Goal, style | Free | Requester blocks hit | Count |
|---|---|---|---|---|
| ana | A_TRACK, SOLO | Mon 9:00 to 10:00, Wed 15:00 to 17:00 | Mon 9:00, Mon 9:30, Wed | 3 |
| ben | A_TRACK, GROUP | Mon 9:30 to 11:00 | Mon 9:30 | 1 |
| cal | A_TRACK, GROUP | Wed 13:00 to 15:00 | Wed | 1 |
| dev | A_TRACK, SOLO | Wed 15:30 to 18:00 | Wed | 1 |
| eli | A_TRACK, GROUP | Mon 10:00 to 11:00 | none, only touches at 10:00 | removed |
| fay | PASS_TRACK, GROUP | Mon 9:00 to 10:00 | not checked | removed |
| gus | A_TRACK, GROUP | Mon 9:00 to 9:30, Wed 14:00 to 15:00 | Mon 9:00, Wed | 2 |

Going through the rules:

1. Grade goal removes fay.
2. Availability removes eli.
3. By count: ana (3), gus (2), then ben, cal, dev (all 1).
4. Work style within the count 1 group: ben and cal are `GROUP` like the requester, so they go before dev (`SOLO`). ana stays first even though ana is `SOLO`, because work style only breaks ties.
5. ben and cal are still tied on both, so their order is random.

Final order: **ana, gus, then ben and cal in random order, then dev**.

```ts
rankCandidates(me, classmates, () => 0).map((c) => c.studentId);
// ['ana', 'gus', 'cal', 'ben', 'dev']

rankCandidates(me, classmates, () => 0.99).map((c) => c.studentId);
// ['ana', 'gus', 'ben', 'cal', 'dev']
```

ana's shared intervals are Mon 9:00 to 9:30, Mon 9:30 to 10:00 and Wed 15:00 to 16:00. The two Monday pieces are listed separately because they only touch.

## Edge cases

### Empty results

If nobody passes both filters, `findCandidates` returns `[]`. That is a normal result, not an error. With the mock data, `findCandidates('104', '1')` returns `[]` because 104 is the only `PASS_TRACK` student.

### No profile

`findCandidates` throws `StateConflictError` with `reason: 'NO_PROFILE'` and the message `Complete your profile to see matches.` when:

* the student has no profile in that course (this includes a wrong `courseId`), or
* their profile has no availability blocks.

Classmates with no blocks are not an error. They just get removed by the availability filter.

### Bad data checks

`data.ts` is a mock, so `findCandidates` checks what it gets back to catch mistakes once real queries replace it. Each check throws a plain `Error`, and only ids go in the message.

| Problem | Error message |
|---|---|
| A profile has a `courseId` other than the one asked for | `bad profile data for student <id> in course <id>` |
| `gradeGoal` or `workStyle` isn't one of the exact enum values (for example `'A track'` or `'solo'`) | same as above |
| `studentId` is not a string | same as above |
| Any block fails `isValidBlock` (wrong weekday, start not before end, past 1440, not whole numbers, snake_case field names) | same as above |
| The same `studentId` appears twice in the course list | `duplicate profiles returned for course <id>` |
| A review average is not `null` or a number from 1 to 5 (for example the string `'3.2'`, `0` or `NaN`) | `bad review average for student <id>` |

These checks run on the requester and on every classmate. One bad classmate row makes the whole call fail instead of quietly giving wrong matches.

If a data function itself throws (for example a failed read), the error is passed straight up. It does not turn into an empty list.

### Things matching does not handle yet

* No enrollment check. The mock `getCourseProfiles` returns everyone with that `courseId`. The TODO in `data.ts` says the real query should only return students on the roster.
* The two reads are not in one transaction yet (TODO in `findCandidates.ts`).
* Review averages are looked up one at a time (TODO to batch it).
* Blocks can't cross midnight. A block like 23:00 to 01:00 has to be saved as two blocks, otherwise it fails `isValidBlock`.
* `normalizeBlocks` is meant to be used by profile saving too, but there is no profile saving code in the repo yet.

## `isEligible`

`isEligible(sender, recipient)` in [`pipeline.ts`](../backend/src/matching/pipeline.ts) returns `true` if the two profiles are in the same course, have the same grade goal and share some time. It returns `false` for yourself. It is meant for the match request code to call before saving a request, but nothing calls it yet.

## Running the tests

The matching tests need no server and no environment variables. You only need Node and npm. The locked `vitest` version (5.0.5) needs Node `^22.12.0`, `^24.0.0` or `>=26.0.0`.

```sh
cd backend
npm ci                 # install from package-lock.json
npm test               # run all tests once (vitest run)
npm run test:watch     # rerun tests when files change
npm run typecheck      # tsc --noEmit
```

Run one file or tests matching a name:

```sh
npx vitest run src/matching/pipeline.test.ts
npx vitest run -t "rankCandidates"
```

| Test file | What it covers |
|---|---|
| `availability.test.ts` | block validation, overlap, merging, overlap counting |
| `stages.test.ts` | each of the five rules on its own |
| `pipeline.test.ts` | all rules together, random tie fairness, `isEligible` |
| `findCandidates.test.ts` | mock data results, `NO_PROFILE`, bad data checks |

## Debugging

### Where errors show up

The matching code doesn't log anything. Errors are thrown out of `findCandidates`, so right now you see them in the vitest output. Over HTTP, [`errorHandler.ts`](../backend/src/middleware/errorHandler.ts) maps `StateConflictError` to a 409 with its `reason`, and turns any other thrown error into a 503 `UNAVAILABLE`. The full error is logged in the server terminal with the request id; the client only gets a generic message.

### Checks backed by the code and tests

* **Order changes between runs.** Only fully tied candidates move. Pass a fixed `rng` like `() => 0` to get the same order every time.
* **`bad profile data` error.** Look at the profile with that student id. Fields must be camelCase, enums must be exactly `A_TRACK`, `PASS_TRACK`, `SOLO` or `GROUP`, ids must be strings, and every block must pass `isValidBlock`.
* **`duplicate profiles returned` error.** The course list had the same student twice. The comment in `findCandidates.ts` points at a JOIN that returns one row per block as the likely cause.
* **Someone you expected is missing.** Check their grade goal first, then check whether your blocks only touch theirs. Touching doesn't count.
* **Unexpected overlap count.** Remember it counts your blocks, not minutes. Splitting one block into 30 minute pieces raises the count.

### Suggestions

* To see the overlap count, call `rankCandidates` in a test. It returns `ScoredCandidate` objects that still have `overlapCount`. `findCandidates` removes it.
* To try a bad response, copy the pattern in `findCandidates.test.ts` and use `vi.mocked(getCourseProfiles).mockResolvedValueOnce(...)`.
* Weekday 0 is Sunday. If results look shifted by a day, check how the weekday was set.
