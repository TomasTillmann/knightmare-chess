# Sampler target eligibility verification

Verdict: PASS.

Root cause: ordinary proposals tried only one raw `cardPlayTargets` candidate. Fanatic exposes 32 starting-board candidates but only eight succeed. Rejecting one non-Pawn therefore abandoned a playable uniformly proposed card.

The sampling tool now shuffles all candidates using its existing unbiased Fisher–Yates helper and accepts the first eligible successful action. The hand-card proposal remains unchanged and uniform. Every eligible successful target has equal probability of appearing first in a uniform permutation. This also retains the rescue eligibility filter and continuing-game filter.

Independent public-API smoke used `generateTrace` callbacks interrupted at step 1. Seed 900582 has 32 Fanatic candidates and eight legal targets; its first action is now Fanatic on c2, moving c2 to c5. Seven generated prefixes across seeds 0, 1, and 900582 verified the case and repeated-prefix determinism.

Validation: `node --import tsx --test src/game/cards/random-campaign-tools.test.ts` passed 5/5 in 240 ms (supplied baseline: 4 pass, 1 fail). `npm run typecheck` passed. No test source was inspected, no full/UI suite was run, and prior trace artifacts were untouched.

Changed tool SHA-256: `0fa15b267c1fc8ef365ed982092a54cee2b4da921c5a4e27fbf8dc984903753f`.
