# Coverage review

Reviewed only `/tmp/knightmare-all-completed-coverage.json`, `/tmp/knightmare-terminal-coverage.ts`, and the public debug fixture initializer. No games, engine audit, or browser tests were run for this review.

- Recomputed **79 games, 79 unique seeds, and 6,147 actions**. All records have a terminal outcome, `completed` status, no replay errors, and zero recorded legal final card responses.
- Recomputed **1,439 `cardPlayed` events** and **133 `cardFizzled` events**. All **80 cards** have successful plays in **at least three distinct completed games**. Stored per-card game sets and event counts match the recomputation exactly.
- Compared the complete initialized state plus ordered actions, with object keys canonicalized: **79 distinct traces, no duplicates** hidden behind different seeds.
- The collector compares history before and after each recorded action, excluding **25 setup history events**. It counts fizzles separately and amends deferred resolutions instead of counting them twice. The report contains 17 history amendments; no count discrepancies were found.

At review time these were **engine replay results**, and the final 27-game browser batch was still running. Parent completion: that batch passed; successful browser attachments were joined for all 79 games, with exact action counts and outcomes matching this ledger.

There are **59 `full-board` games and 20 default-practice games**. Default practice can include prepared positions or setup moves, so the full campaign should not be described as 79 games all played from the normal initial position.

“Successful” means the engine emitted `cardPlayed`, including plays subsequently cancelled by Fog. All three Man of Straw games (9137000–9137002) use Fog cancellation; they do not cover continuing after an uncancelled escape. Three successful games per card and recorded partners establish this coverage threshold, not exhaustive combinations or independent proof of every rule. No count errors were found.
