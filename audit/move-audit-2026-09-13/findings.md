# Findings and qualified observations

## O1 — Existing random oracle rejects legal Knightmare castling (not an engine bug)

Seed 9130169, step 51: White castles e1–a1 after a Madman SELF_CHECK fizzle. Before: `r1b2n1r/pp1p1kpp/b1p5/5P2/4P3/6QN/PPPNq2P/R3KB1R w KQ - 6 12`. After: `r1b2n1r/pp1p1kpp/b1p5/5P2/4P3/6QN/PPPNq2P/2KR1B1R b - - 7 12`.

The existing generator reports `ordinary move must be independently legal` because its ordinary-chess oracle forbids castling from check. Publisher FAQ p.8 explicitly permits castling through/out of check if the King is safe at turn end; rules.md §11.6 agrees. The engine's accepted castle is correct. Preserve current engine behavior. Evidence: campaign-9130100-9130169-failure.json and its review.jsonl. Existing generator source is intentionally unchanged under this audit's no-production-edits constraint.

## O2 — One timeout was not reproducible

Seed 9130150's first process recorded ETIMEDOUT with 251,847 ms elapsed, despite producing a complete clean 50-move/108-action result. A separate instrumented run completed the same 50 moves in approximately 3.1 seconds without findings. This is not evidence of an engine performance defect; a scheduling/suspension interruption remains possible. No timing assertion will be added without reproducible engine evidence.

## Confirmed engine defects

None yet. Audit is ongoing; neither clean tests nor random replay proves completeness.
