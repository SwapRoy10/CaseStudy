# CaseStudy database

The app stores everything in PostgreSQL. The tables come from the Prisma schema in [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma) and the migrations next to it.

## Running it locally

You need Docker Desktop running.

```sh
cp backend/.env.example backend/.env    # then set DATABASE_URL, see below
npm run db:up       # starts postgres in docker and applies the migrations
npm run db:seed     # loads the sample students and courses
npm run dev         # backend now reads from postgres instead of the mock list
npm run db:down     # stops postgres (your data is kept)
```

The `DATABASE_URL` for the local database in [`docker-compose.yml`](../docker-compose.yml) is:

```
DATABASE_URL=postgresql://casestudy:casestudy@localhost:5432/casestudy
```

That password only exists on your laptop. Without a `DATABASE_URL` the backend falls back to the same data in memory, so the demo still runs on a machine without Docker.

## Running it on Supabase

Same app, different database. Put the connection strings from the Supabase dashboard (Project Settings, Database) in `backend/.env`, which is gitignored, never in the repo or a chat:

```
# the pooler string, port 6543, with the options on the end
DATABASE_URL=postgresql://postgres.<project>:<password>@<host>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
# the session pooler string, port 5432, used by migrations
DIRECT_URL=postgresql://postgres.<project>:<password>@<host>.pooler.supabase.com:5432/postgres
```

Then, from the repo root:

```sh
npm run db:migrate   # creates the tables
npm run db:seed      # loads the demo class, so the demo roster comes from Supabase
npm run demo
```

Two things to watch:

* The seed saves students and courses under fixed ids (courses 1 to 5, students 101 to 108, 501, 999 and 1001 up), and a rerun overwrites rows with those ids. Only seed a database that is for the demo.
* `npm test` seeds the database in `DATABASE_URL` before it runs and some tests add and delete rows. Run tests against the local docker database, not Supabase.

## What gets seeded

All of it lives in [`backend/src/sampleData.ts`](../backend/src/sampleData.ts). The seed writes that file into Postgres, and the no-database mode reads the same file, so the two always agree.

| Course | What it is |
|---|---|
| 1, SAMPLE 101 | The sample data from the functional testing doc (Figure 1): students 101 to 108. Many tests expect exactly this, so leave it alone |
| 2, SAMPLE 102 | Second course for the cross-course tests. 105 and 501 are on the roster |
| 3, CSDS 393 Software Engineering | The real class: 36 students, 34 with profiles, 2 who joined but haven't made one |
| 4, CSDS 132 and 5, CSDS 233 | Past semesters. Their groups and peer reviews give students review averages |

Student 999 exists but isn't on any roster, for the NOT_ENROLLED tests. Names and emails are made up.

Every sample student signs in with the password `casestudy123` (`DEMO_PASSWORD` in `sampleData.ts`), so the seed saves a real Argon2id hash of it for each one. Never use it for real students.

[`sample-canvas-roster.csv`](sample-canvas-roster.csv) is the CSDS 393 class in the format a Canvas gradebook export has, for trying the roster import (see [`docs/api/README.md`](../docs/api/README.md)). Posting it to course 3 says `enrolled: 36, added: 0`, since the seed already has them on that roster.

Running the seed again puts the sample rows back the way the file says. It doesn't touch rows it didn't create.

## Database tests

Tests that need Postgres skip themselves when there's no `DATABASE_URL`. With the database up, `npm test` in `backend` runs all of them. CI starts its own Postgres, so they run on every pull request.
