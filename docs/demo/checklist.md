# Demo checklist

## Before the demo (once)

- [ ] `git pull` on the demo laptop
- [ ] `npm run setup`
- [ ] `npm run demo` starts without errors
- [ ] In a second terminal, `npm run smoke:demo` passes all checks
- [ ] Nothing else is using ports 4000 or 4173

## Walkthrough

Open http://localhost:4173. You land on the sign in screen.

0. **Sign in.** Under "Demo" pick a course and a student, then "Sign in as this student". Or type `axr101@case.edu` with the password `casestudy123`. A wrong password shows "Email or password is incorrect." and stays on the sign in screen.

1. **The app is connected.** Point out the green "API connected" dot: the React frontend is talking to the Express backend.
2. **Matching works.** Signed in as `101` (Alex Rivera), you see three ranked candidates. #1 shares the most free time (two blocks).
3. **Tiebreaks follow the spec.** #2 and #3 each share one block. #2 is ranked higher because it shares 101's group work style.
4. **Ratings don't affect order.** #3 has the best rating (4.9) and is still last. Reviews are only shown, never used to rank (CO-3).
5. **Privacy.** Cards show no names or contact details before a match (limited view).
6. **Filters.** Sign out and pick `104` (pass track): only classmates with the same grade goal appear.
7. **Error handling.** Sign out and pick `107` (no availability saved): the app explains what to do instead of failing.

## If something goes wrong

| Symptom | Fix |
| --- | --- |
| "API offline" in the header | Backend isn't running. Check the `[api]` lines in the terminal |
| `Port 4000 is already in use` | Stop the other process, or set `PORT` in `backend/.env` and `VITE_PROXY_TARGET` in `frontend/.env.local` to match |
| Blank page | Run `npm run build` and read the first error |
