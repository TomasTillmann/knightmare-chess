# Original random-campaign ledger reconciliation

Scope: only the 16 `campaign-<digits>.jsonl` ledgers in this directory were read. Each contains 100 original rows: 1,600 rows and 1,600 distinct seeds. Totals below parse the `FOLLOWUP_RANDOM_DONE` JSON object from stdout only when the original row has exit code 0. All 18 nonzero rows, their partial counters, and any later retries are excluded.

| Quantity | Original-ledger total |
| --- | ---: |
| Clean traces | 1,582 |
| Moves | 559,255 |
| Actions | 1,222,953 |
| Ordinary discards | 103,658 |
| Explicit quiet choices | 139,340 |
| Distinct card IDs with positive played counts | 80 |

These are observed ledger counts, with no statistical confidence claim or certification of source correctness. Later recovery or generator correction does not retroactively convert an original nonzero row into a clean original trace.

The supplied reconciliation identifies five root findings overall: F1 is separately directed; F2 through F5 recur in the random campaigns. Multiple failing seeds for a root finding do not increase that five-finding count. Seed 9102094 timed out and was later recovered; seed 9109176 was later corrected as a generator false positive. Those later classifications are supplied context, not independently established by reading retry records.

All original nonzero rows:

| Seed | Exit | Recorded invariant or timeout | Supplied group |
| --- | ---: | --- | --- |
| 9102094 | 124 | Subprocess timed out after 75 seconds | Later recovered |
| 9104063 | 1 | white: royal identities, including explicit Coup surrender; 0 !== 1 | F2 |
| 9104093 | 1 | f4: FEN role; king !== pawn | F3 |
| 9106085 | 1 | f3: FEN role; king !== pawn | F3 |
| 9106087 | 1 | No continuing action at step 409; outcome=null | F5 |
| 9106089 | 1 | white: royal identities, including explicit Coup surrender; 0 !== 1 | F2 |
| 9107020 | 1 | No continuing action at step 113; outcome=null | F4 |
| 9108381 | 1 | b3: FEN role; king !== bishop | F3 |
| 9109080 | 1 | No continuing action at step 529; outcome=null | F5 |
| 9109127 | 1 | white: royal identities, including explicit Coup surrender; 0 !== 1 | F2 |
| 9109176 | 1 | No continuing action at step 554; outcome=null | Generator false positive, later corrected |
| 9109223 | 1 | white: royal identities, including explicit Coup surrender; 0 !== 1 | F2 |
| 9109232 | 1 | f7: FEN role; king !== bishop | F3 |
| 9109264 | 1 | No continuing action at step 441; outcome=null | F4 |
| 9109435 | 1 | black: royal identities, including explicit Coup surrender; 0 !== 1 | F2 |
| 9109701 | 1 | white: royal identities, including explicit Coup surrender; 0 !== 1 | F2 |
| 9109767 | 1 | d6: FEN role; king !== knight | F3 |
| 9109789 | 1 | white: royal identities, including explicit Coup surrender; 0 !== 1 | F2 |

Thus F2 has 7 occurrences, F3 has 5, F4 has 2, and F5 has 2: 16 root-finding occurrences plus one timeout and one generator false positive = 18 nonzero original rows.

The actual-played union is the set of positive-count keys in `played` across the 1,582 clean records, not the declared `totalCards` field:

`abduction`, `anathema`, `annexation`, `assassin`, `betrayal`, `blessing`, `bog`, `bombard`, `breakthrough`, `cathedral`, `challenge`, `chaos`, `charge`, `confabulation`, `coup`, `cowardice`, `crab`, `crusade`, `curse`, `dark-mirror`, `disintegration`, `doomsayer`, `doppelganger`, `dubbing`, `dungeon`, `earthquake`, `evangelists`, `evil-eye`, `fanatic`, `fatal-attraction`, `figure-dance`, `fireball`, `fog-of-war`, `forbidden-city`, `forced-march`, `fortification`, `ghostwalk`, `guardian`, `haunting-memories`, `heresy`, `hidden-passage`, `holy-quest`, `holy-war`, `hostage`, `irresistible-force`, `knightmare`, `legacy`, `long-jump`, `lost-castle`, `madman`, `man-of-straw`, `man-trap`, `masquerade`, `merciless`, `mystic-shield`, `neutrality`, `no-quarter`, `onslaught`, `pacifism`, `panic`, `passing-in-the-night`, `peace-talks`, `plots-within-plots`, `rebirth`, `resurrection`, `revenge`, `riposte`, `sanctuary`, `siege`, `split-knight`, `squaring-the-circle`, `think-again`, `toll`, `tournament`, `treason`, `truce`, `under-elf-hill`, `vendetta`, `vulture`, `winged-victory`.

Exact input campaigns, each with 100 original rows:

`campaign-9102000.jsonl`, `campaign-9103000.jsonl`, `campaign-9104000.jsonl`, `campaign-9105000.jsonl`, `campaign-9106000.jsonl`, `campaign-9107000.jsonl`, `campaign-9108300.jsonl`, `campaign-9108400.jsonl`, `campaign-9109000.jsonl`, `campaign-9109100.jsonl`, `campaign-9109200.jsonl`, `campaign-9109300.jsonl`, `campaign-9109400.jsonl`, `campaign-9109500.jsonl`, `campaign-9109700.jsonl`, `campaign-9109800.jsonl`.

No engine execution, production-source reading, test-source reading, or matching `random-<seed>.json` reading was needed for this reconciliation.
