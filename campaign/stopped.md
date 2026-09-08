# Campaign stopped by user

The user requested a clean stop, commit and push on 2026-09-08. No further
iterations are authorized. The original target of 300 was not completed.

- 208 parent-verified iterations; 191 without an engine rules finding.
- 17 iterations exposed 14 distinct rules defects, all fixed. This includes
  retrospective findings in 034 and 079, whose corrected full regressions remain.
- 23,534 valid reviewed actions, 10,076 valid regular move commands and 2,450
  card plays. Offending generated states and unreviewed suffixes are excluded.
- All 80 catalog cards sampled, played and applied; 20 fresh coverage audits,
  through iteration 200. No iteration-210 audit is claimed.
- Iteration 209's agent-reviewed draft and iteration 210's incomplete replay core
  are preserved under `drafts/`; both original traces remain under `iterations/`.
  Neither is counted as parent-verified or included in the runnable suite.

Final engine verification: 5,265 passed, zero failed, in 192.153 seconds:

```sh
node --import tsx --test --test-concurrency=2 src/game/cards/*.test.ts
npm run typecheck
```

Typecheck passed. The initial default-concurrency run passed 5,264 tests but timed
out the Challenge performance subprocess at its unchanged two-second limit.
That exact test then passed independently in 0.936 seconds; the entire suite
passed with bounded concurrency. No test threshold or production behavior was
changed to obtain the final result. No UI tests ran.

The working campaign is stopped, rather than marked as completing 300 iterations.
Physical-card proposals are uniform; accepted legal, rescue and terminal-conditioned
positions are not a uniform sample of all possible game states.
