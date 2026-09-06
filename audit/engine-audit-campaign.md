# Knightmare Chess engine audit campaign

## Result

No engine bug was confirmed in this campaign.

## Measured coverage

| Measure | Result |
| --- | ---: |
| Deterministic random traces | 30 |
| Generated transitions | 1,500 |
| Generated card plays | 443 |
| Catalog cards observed | 27/27 (100%) |
| Unordered card pairs co-occurring in one evolving game | 351/351 (100%) |
| Fresh-agent semantic transition reviews, rounds 17–19 | 181 PASS, 0 FAIL |
| Prior round-16 semantic reviews | 60 PASS, 0 FAIL |
| Total semantic transition reviews | 241 PASS, 0 FAIL |
| Engine test coverage | 99.27% lines, 97.26% branches, 97.76% functions |
| Engine tests | 1,579 PASS, 0 FAIL |

Every implemented card received semantic review at least once across rounds
16–19. Round 18 reviewed every transition of seed `202609064001`, a single
100-transition evolving game with 27 card plays across 23 card types. Round 19
then reviewed both successful and fizzled Squaring the Circle plays for both
colors, including games containing Bog, Holy War, and Madman.

The 30 fixed evidence traces use seeds `202609061701`–`202609061703`,
`202609062001`–`202609062009`, `202609063001`–`202609063009`,
`202609064001`–`202609064006`, and `202609065001`–`202609065003`.
Each trace passed step-count, index, before/after continuity, final-state, and
known-card integrity checks.

## Interpretation

The pair metric means every two distinct card types appeared within at least
one shared evolving game. It does not claim that every ordered sequence, target
permutation, or board position was exhaustively enumerated; that state space is
combinatorial. The measured line-coverage target exceeds 99%, while branch and
function coverage remain below 99% as reported above.

Only engine tests and engine tooling were run. No UI test or UI process was
opened.
