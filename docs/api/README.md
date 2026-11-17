# API reference

Base path: `/api`. In development the frontend calls it through the Vite proxy, so requests are same-origin.

## Signing in

Students sign in with their school email and password (`POST /api/session`). The response sets a `session` cookie that the browser keeps and sends on its own. It is HttpOnly and SameSite=Strict, it is signed with `SESSION_SECRET`, and it lasts 8 hours. The student id for every call comes from that cookie and nowhere else, see `backend/src/middleware/session.ts`. Signing out (`DELETE /api/session`) clears the cookie in the browser. A copied cookie keeps working until it expires, because sessions aren't stored on the server (SDD 9.4).

Passwords are hashed with Argon2id. There is no sign up, accounts have to exist before someone can sign in (SDD 9.3).

Every `POST`, `PUT` and `DELETE` that uses the cookie has to send `X-Requested-With: CaseStudy`. The frontend always does. Without it the call gets a 403, which stops other websites from sending changes with a student's cookie.

The old `X-Student-Id` header is gone and does nothing now.

For the local database and the demo, every sample student has the password `casestudy123`, for example `axr101@case.edu` or `mxc1001@case.edu`.

## Errors

Every error response has the same body:

```json
{ "error": { "code": "CONFLICT", "reason": "NO_PROFILE", "message": "Complete your profile to see matches." } }
```

| Status | `code` | When |
| --- | --- | --- |
| 400 | `VALIDATION` | Bad path param, malformed JSON body, or a roster file with unusable rows (`rows` lists them) |
| 401 | `UNAUTHENTICATED` | No signed-in student, an expired or made up cookie, or a wrong email or password |
| 403 | `FORBIDDEN` | A change sent without the `X-Requested-With` header, or a roster import without the operator key |
| 404 | `NOT_FOUND` | Unknown route |
| 409 | `CONFLICT` | A module threw `StateConflictError`; `reason` says which (SDD 10.3) |
| 429 | `RATE_LIMITED` | More than `RATE_LIMIT_MAX` requests (default 300) from one IP in 15 minutes. `/api/health` is exempt. Signing in is tighter: 10 wrong tries in 15 minutes |
| 503 | `UNAVAILABLE` | Any unexpected error, e.g. a failed database read. Details are logged on the server, never sent to the client |

`message` is written for end users and can be shown as-is.

Every response carries an `X-Request-Id` header (or echoes the one you sent). The same id appears in the server log line for that request, so a bug report with the id leads straight to the log.

## Endpoints

### `GET /api/health`

Public. Returns `{ "status": "ok", "uptimeSeconds": 12 }`.

### `POST /api/session`

Public, but needs the `X-Requested-With` header. Body is `{ "email": "axr101@case.edu", "password": "..." }`. The email can be in any case. On success it sets the session cookie and returns:

```json
{ "studentId": "101", "tutorialCompleted": false }
```

A wrong password and an email with no account get the same `401` and the same message, so nobody can use it to find out who has an account.

### `DELETE /api/session`

Needs the `X-Requested-With` header. Clears the cookie and returns `204`.

### `GET /api/me`

Signed in. Who the session belongs to and the courses they are on the roster of, for the current term only (the newest term any course is in, "Fall 2026" right now). Past semesters stay in the database for their groups and reviews but aren't listed. The frontend calls it on load to see if someone is already signed in. It never sends the password hash.

```json
{
  "studentId": "101",
  "name": "Alex Rivera",
  "tutorialCompleted": false,
  "courses": [
    { "id": "1", "code": "SAMPLE 101", "title": "Sample Course (testing doc data)", "section": "001", "term": "Fall 2026", "hasProfile": true }
  ]
}
```

### `GET /api/courses`

Signed in. This term's courses for a class selector (SDD 6.3.1), all of them and not just the ones the student is on the roster of, since saving a profile does that check. `/api/me` has the student's own courses.

```json
{ "courses": [{ "courseId": "3", "code": "CSDS 393", "title": "Software Engineering", "section": "100", "term": "Fall 2026" }] }
```

### `PUT /api/me/password`

Signed in, and needs the `X-Requested-With` header. Body is `{ "currentPassword": "...", "newPassword": "..." }`. The new one has to be 8 to 128 characters and different from the current one. Answers `204`. A wrong current password gets a `400`. Without a database the change only lasts until the server restarts.

### `GET /api/demo/roster` and `POST /api/demo/session`

Demo only. Both are on by default and switched off when `NODE_ENV` is `production`, or anywhere with `DEMO_ROUTES=false` in `backend/.env` (`DEMO_ROUTES=true` is refused in production). The server logs a warning at startup when they are on with a real database. The roster lists each course that has profiles with the students on it (names and ids, never emails), and it needs no sign in. It reads from whichever database `DATABASE_URL` points at, so with Supabase set up the demo class list comes from Supabase. The sign in page uses it as a picker.

`POST /api/demo/session` takes `{ "studentId": "101" }` and signs you in as that student with no password, setting the same cookie as a normal sign in. It needs the `X-Requested-With` header like any other change, and answers `404` for a student that doesn't exist. Because it skips the password it must never be reachable on a real deployment, so turn it off there.

### `POST /api/operator/courses/:courseId/roster`

For the team operator, not students (SDD 6.5). It needs the `X-Operator-Key` header to match `OPERATOR_KEY` in `backend/.env`. If `OPERATOR_KEY` isn't set the route is off and always answers `403`. A signed in student gets the same `403`.

The body is the roster file, sent as `text/csv`. It can be either of these:

* **A Canvas gradebook export.** Canvas has no roster export of its own, so this is the one most people use: in the course go to Grades, then Export, then Export Entire Gradebook. It has the columns `Student, ID, SIS User ID, SIS Login ID, Section`, then one column per assignment. The school email is the `SIS Login ID` (the case id) plus `@case.edu`. The "Points Possible" row, the "Manual Posting" row and "Test Student" are skipped, and so are the assignment columns. If a file has an `Email` column instead, that is used as is. `SCHOOL_EMAIL_DOMAIN` in `.env` changes the domain.
* **The SDD format.** The columns `course_code, section, term, school_email`. Every row has to match the course in the url.

Excel can open the file and save it as CSV, but an `.xlsx` file isn't read, it has to be CSV.

```sh
curl -X POST localhost:4000/api/operator/courses/3/roster \
  -H "X-Operator-Key: $OPERATOR_KEY" -H "Content-Type: text/csv" \
  --data-binary @database/sample-canvas-roster.csv
```

```json
{ "enrolled": 36, "added": 0 }
```

`enrolled` is how many students the file had, and `added` is how many were not already on the roster. A student listed twice counts once.

The whole file is checked before anything is saved. If any row can't be used, nothing is saved and the answer is a `400` that lists each one with its row number in the sheet (the header is row 1):

```json
{
  "error": {
    "code": "VALIDATION",
    "message": "Some rows could not be matched, so nothing was imported.",
    "rows": [{ "row": 4, "reason": "no account for that email" }]
  }
}
```

The reasons are `no login id`, `no account for that email` and `row is for a different course`. A file with no login or email column at all gets `400` with `fields: ["header"]`, and an empty file gets `fields: ["file"]`. An unknown course gets `409`.

**Accounts.** By default a student who has no account fails the row (`no account for that email`), since the SDD has no sign up. Add `?createAccounts=true` to make an account for each of those students instead. Each gets a random 10 character first password, which comes back once in the answer and is only saved hashed:

```json
{
  "enrolled": 36, "added": 36, "created": 2,
  "accounts": [{ "email": "axr101@case.edu", "name": "Alex Rivera", "password": "k7Hn2pQwXe" }]
}
```

The answer is sent with `Cache-Control: no-store`. The names come from the Canvas `Student` column ("Last, First" becomes "First Last"). Hand the passwords out, and students change them with `PUT /api/me/password`.

### Needs the database

Everything from here down to the peer reviews (profile saves, requests, groups, reviews) writes to the database and has no in memory version. With no `DATABASE_URL`, which is the mock data demo, these answer `503 UNAVAILABLE` with a message saying to set it. Matching, sign in and `/api/me` still work without one.

### `GET /api/courses/:courseId/profile` and `PUT /api/courses/:courseId/profile`

Signed in. `GET` gives the student's own saved profile for the course. Before anything is saved `gradeGoal` and `workStyle` are `null` and `blocks` is empty. `reviewAverage` is the string `Not yet rated` or a number like `3.2`.

```json
{
  "courseId": "1", "name": "Alex Rivera", "schoolEmail": "axr101@case.edu",
  "gradeGoal": "A_TRACK", "workStyle": "GROUP",
  "blocks": [{ "weekday": 1, "startMinute": 540, "endMinute": 660 }],
  "reviewAverage": "Not yet rated"
}
```

`PUT` takes `{ "gradeGoal", "workStyle", "blocks" }` and saves it, replacing the whole availability in one transaction, then answers with the saved profile. Overlapping blocks are merged and a block that crosses midnight is split in two, the same way matching counts them. The next matching run uses it, nothing needs a restart.

Errors: `400 VALIDATION` with `fields` listing every missing or bad field, `409 NOT_ENROLLED` if the course roster doesn't have the student. A failed save leaves the old profile as it was.

### `POST /api/me/tutorial-complete`

Signed in, needs the client header. Marks the first time tutorial as seen so it doesn't open again. Answers `204`.

### `POST /api/courses/:courseId/requests`

Signed in. Body `{ "recipientId": "102" }`. Sends a match request and answers `201` with the pending record:

```json
{
  "requestId": "7", "courseId": "1", "requesterId": "101", "recipientId": "102",
  "status": "PENDING", "requestedAt": "2026-11-17T04:00:00.000Z", "respondedAt": null
}
```

Both students are locked and both profiles are read again inside the transaction, so a profile change can't slip in between the check and the save. Errors:

| Status | Reason | When |
| --- | --- | --- |
| 400 | `VALIDATION`, `fields: ["recipientId"]` | A request to yourself, or an id that isn't a number |
| 409 | `NOT_ENROLLED` | Either student isn't on the course roster |
| 409 | `NO_PROFILE` | The sender has no complete profile |
| 409 | `NO_LONGER_ELIGIBLE` | The recipient has no profile, or no longer passes the grade goal and shared time filters |
| 409 | `DUPLICATE_REQUEST` | The sender already has a pending request to the same student in this course |

### `GET /api/courses/:courseId/requests`

Signed in. `{ "courseId", "requests": [...] }`, the student's sent and received requests in the course, newest first. A canceled request stays in the sender's list but is left out of the recipient's. Each one has an `other` field, the other student's limited summary worked out from the caller's side (grade goal, work style, shared times, review average, same as a candidate card), or `null` if they no longer match. No names or emails are in it.

### `POST /api/requests/:requestId/response`

Signed in. Body `{ "decision": "ACCEPT" }` or `"DECLINE"`. Only the recipient can answer. Answers with the updated record.

Accepting does all of this in one transaction: if neither student has a group a new one is made with both, if one has a group the other is added to it, and if both already have groups nothing changes and it answers `409 GROUP_MERGE` ("Group merging is not available in this release."). A pair who are already in the same group get the same answer. Declining only locks the request.

| Status | Reason | When |
| --- | --- | --- |
| 403 | `FORBIDDEN` | The caller isn't the recipient. A request that doesn't exist gets the same answer |
| 409 | `NOT_PENDING` | Already accepted, declined or canceled |
| 409 | `GROUP_MERGE` | Both already belong to groups |
| 409 | `NOT_ENROLLED`, `NO_LONGER_ELIGIBLE` | When accepting, one of them left the roster or lost their profile |

### `POST /api/requests/:requestId/cancel`

Signed in. Only the sender, and only while pending. Sets it to `CANCELED` and answers with the record. `403 FORBIDDEN` for anyone else, `409 NOT_PENDING` if it was already answered.

### `GET /api/courses/:courseId/group`

Signed in. `{ "group": null }` if the student has no group in the course, otherwise:

```json
{
  "group": {
    "groupId": "3", "courseId": "1", "formedAt": "2026-11-17T04:00:00.000Z",
    "members": [{ "studentId": "101", "name": "Alex Rivera", "reviewedByMe": false }],
    "criteria": ["Communication", "Reliability", "Contribution"]
  }
}
```

### `GET /api/courses/:courseId/members/:studentId`

Signed in. The full profile of a student you have an accepted request with in this course, in the same shape as the profile above plus `studentId`. It has their `schoolEmail`, which stays hidden until a match (PR-2). The check runs on every call. A pending, declined or canceled request doesn't count, and neither does being in the same group without a request between the two of you. Anything else is `403`, and an id that doesn't exist gets the same answer.

### `POST /api/groups/:groupId/reviews`

Signed in. Body has one rating for every criterion in the group's `criteria`, no more and no less, each a whole number from 1 to 5:

```json
{
  "revieweeId": "102",
  "ratings": [
    { "criteriaName": "Communication", "rating": 5 },
    { "criteriaName": "Reliability", "rating": 4 },
    { "criteriaName": "Contribution", "rating": 4 }
  ]
}
```

Answers `201` with `{ "reviewId": "9", "revieweeAverage": 4.33 }`, the mean of every rating that student has received. Errors: `400 VALIDATION` with `fields` (`ratings` for a missing, extra or out of range rating), `403 FORBIDDEN` if you or the reviewee aren't in the group or you review yourself, `409 DUPLICATE_REVIEW` for a second review of the same person in the same group. The average shows on profiles and candidate cards but never changes the match order.

### `GET /api/courses/:courseId/candidates`

Signed in. Ranked study-partner candidates for the signed-in student in this course (SDD 6.3.4). The order is the ranking; there is no cap.

```json
{
  "courseId": "1",
  "candidates": [
    {
      "candidateId": "102",
      "gradeGoal": "A_TRACK",
      "workStyle": "GROUP",
      "sharedIntervals": [{ "weekday": 1, "startMinute": 600, "endMinute": 660 }],
      "reviewAverage": 3.2
    }
  ]
}
```

`weekday` is 0–6 (Sunday = 0); minutes are from midnight, America/New_York. `reviewAverage` is `null` when the candidate has no reviews.

Errors: `409 NO_PROFILE` if the student has no profile or no availability for the course.
