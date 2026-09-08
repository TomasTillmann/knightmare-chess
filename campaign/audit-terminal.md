# Delayed terminal outcome sampler audit

Seed 860171 originally reached a valid Black checkmate after 90 actions and
35 regular moves. The engine declared the outcome when `endTurn` closed the
reaction window; the generator rejected that terminal action and stalled.
The independently reviewed original sequence remains in `171.stalled.json/.txt`
and its historical engine regression. This was a sampler limitation, not a new
engine rules bug.

Regression `a646669` failed 35 versus 50 moves. Fix `3131b92` adds a shared
candidate check for outcomes deferred until a successful `endTurn`. It does not
alter random-number generation, physical-card proposal weights, or target order.
Terminal avoidance remains an explicit sampling condition, including positions
whose still-open card window could potentially avert the terminal result.

Parent targeted gate: 9 passed, zero failed, 3.706 seconds (sampler and 172).
Full ready engine gate: 5,176 passed, zero failed, 39.656 seconds; unfinished171
excluded. Typecheck passed. Historical171 separately passed in 1.004 seconds.

`SAMPLER_TERMINAL_AUDIT_DONE`: 239 probes, 3 groups, zero findings, 7,132 ms.
The parent validated the original public move/checkmate checkpoint and generated
seed860171: 126 actions, 50 moves, 19 card plays. The fresh auditor added exactly
one independent seed900171: 111 actions, 50 moves, 9 card plays. Every generated
action replayed, preserved its input, and avoided a successful terminal handoff
before the fiftieth move.

Fresh dispatch06:00:24 UTC on2026-09-08; baseline06:00:36, realpatch06:00:47,
final06:01:01. Parent verified source, timestamps, journal, and source SHA-256
`514a81a743fcfe7bb14de7ea1bbcd0305d57d3d868fde8f0255e992fff772767`
before temporary scaffold deletion. The journal remains committed.
