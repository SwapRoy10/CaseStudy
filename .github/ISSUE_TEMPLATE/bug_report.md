---
name: Bug report
about: A test failed or something doesn't match the SRS
title: "TEST-ID: short summary"
labels: bug
---

<!-- title format from the testing doc (6.1), for example "SEC-2: health check counted toward rate limit" -->

**Test case**
Which test from the functional testing doc failed, for example ORDER-2. Write "none" if you found it some other way.

**Where**
Which part: matching, API, profile, database, frontend.

**Steps to reproduce**
1.
2.
3.

**Expected result**
Copy it from the testing doc, or quote the SRS / SDD line.

**Actual result**
Status code and error body, the failing test output, or a screenshot for screen tests.

**X-Request-Id**
For backend failures, the id from the response header so the server log line can be found (LOG-1).

**Owner**
The person who owns this part, from section 6.2 of the testing doc.
