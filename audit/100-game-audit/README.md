# 100 fresh-agent engine games

Completed: **100 numbered games by 100 distinct game-playing agents** — 83 directed and 17 seeded random. Four additional agents were aborted before starting games. Only audit Markdown was written.

Baseline: `33e03989fab9449d87b857fc5673f67d05841928`. Audit date: 2026-09-08.

## Findings

Four confirmed new defect families, one additional conflict with the local rules, and two reproduced previously known defects. Reproductions of the same underlying failure are grouped together. Qualified candidates are excluded from the confirmed count.

| ID | Priority | Confirmed new defect | Expected versus observed | Evidence |
| --- | --- | --- | --- | --- |
| N1 | P1 | Bog loses part of a captured Confabulation composite | Shortening the capturing rook move should undo the whole capture. Only the carrier returns; the second component remains captured and combined movement disappears. | [028](game-028.md) |
| N2 | P1 | Immediate return loses Crab transformation | A recently captured Crab pawn should retain its transformation when returned. Hostage and Winged Victory return an ordinary-moving pawn; a diagonal move is rejected and a straight move accepted. | [027](game-027.md), [051](game-051.md) |
| N3 | P2 | Bog rejects qualifying moves made by cards | Bog should shorten the qualifying movement. Bombard, Masquerade, Crusade, and Merciless after castling instead produce INVALID_TIMING and leave Bog unspent. | [019](game-019.md), [034](game-034.md), [069](game-069.md), [073](game-073.md) |
| N4 | P2 | Doppelganger refuses to copy an opponent Pawn | After Black g7–g6, White's Knight on d4 should be able to copy the Pawn's quiet forward move to d5. The engine rejects it because the copied piece is a Pawn. The printed restriction excludes a Pawn as the acting piece. | [016](game-016.md), decisive quiet-move reproduction [021](game-021.md) |

For N1, the recorded sequence is Black's Bishop c7 joining Knight a5 through Confabulation, White Rook a1 capturing the composite on a5, then Bog. The rook stops on a2, but only the Knight returns to a5. Parent source review found that `playBog` restores only `move.capturedId`, without the other physical component or composite effect. The same capture canceled by Think Again restores both components and their powers correctly in [083](game-083.md), helping isolate the defect.

For N2, parent review traced capture-time effect expiry and return handling. Capture discards the Crab effect; the return path restores piece fields but does not restore that effect. Structural invariants still pass. The separate Hostage and Winged Victory reproductions establish an actual movement consequence.

For N3, parent review found a shared Bog gate requiring a plain `move` event; card movement is recorded as `cardPlayed`. The official [FAQ](https://www.sjgames.com/knightmare/KnightmareChess_FAQ.pdf), pages 13 and 40, explicitly covers Bog with Bombard, Crusade/Merciless total displacement, and a Bishop moving through Masquerade. Those rulings support the expected reactions. The exact shortened destination is not reached because the timing gate rejects first.

For N4, the parent viewed `final_cards/KC4_card4.png` and checked the card wording against the explicit copied-Pawn rejection in production. Game 016 alone was not a valid quiet-move proof; game 021 supplies it.

## Additional local-rule conflict

**L1 — Curse rejects non-move swaps:** [026](game-026.md) reproduces Anathema rejecting a long swap of a cursed Rook and Bishop; [060](game-060.md) extends it to Siege. The local Anathema rule explicitly calls the exchange a non-move swap. The engine applies Curse's movement-distance limit and rejects the advertised swap target. This is a reproducible conflict with the repository's rule text. Exact official Curse/swap adjudication remains unresolved: official rulings treat swaps as movement for some other restrictions. It is therefore listed separately from the four unqualified new families.

## Previously known defects reproduced

- [036](game-036.md): reversing Earthquake through Peace Talks leaves an unpromoted Pawn on its new last rank and play continues. Duplicate of prior game 05.
- [038](game-038.md): Vulture rejects taking an active Continuing Effect, contrary to the official ruling. Duplicate of prior game 11, now exercised with Truce.
- [091](game-091.md) additionally repeats the cancellation/no-correction symptom of the prior Confabulation orphan-component finding. Its final component zone was not explicitly retained, so this is qualified supporting evidence, excluded from the two full reproductions above.

The pre-existing [16-game audit](../2026-09-08/README.md) contains these and other earlier findings. Those sixteen games are not included in this audit's hundred.

## Candidates and unresolved rules

- [014](game-014.md): Bog rejects after Man-Trap captures the qualifying mover. The response-order interpretation needs adjudication.
- [010](game-010.md): Madman advertises a route landing on Forbidden City mid-sequence. The advertised route was not executed, and this early fixture had inconsistent turn metadata; no confirmed execution defect.
- [060](game-060.md), [065](game-065.md): a rook swapped away and back through Siege retains rights and actually castles. Whether a non-move swap revokes rights is not explicit locally. Capture/Hostage rights were correctly removed in [071](game-071.md).
- [043](game-043.md): play continues with bare Kings and no cards. Missing dead-position support depends on the selected draw convention.
- [086](game-086.md), [093](game-093.md): a failed after-move rescue card rolls back the unsafe underlying move and allows a replacement. This preserves King safety; the precise failed-rescue rollback rule is not explicit in the cited general fizzle passage. Treated as a rule question, not a confirmed defect.

Cosmetic error messages naming Dungeon or Chaos for another card are not counted as engine-state bugs. Incorrect auditor predictions, malformed targets, missing promotion choices, and legitimate card fizzles are also excluded.

## Method and limits

Each numbered game was assigned to a distinct fresh agent. Four additional agents assigned to 012, 040, 072, and 079 were stopped before creating their independent game; fresh replacements played those numbered games. No agent was authorized to initialize a second game, reset, or replay. Continuing an exact saved state inside the same report was permitted.

Games 001–083 are bounded directed sequences, usually using sparse legal FENs and configured hands, with actual public actions establishing card timing. Many include a small seeded continuation. Games 084–100 use the existing `generateTrace` helper, standard starting boards, and shuffled full-catalog house-variant decks. These are bounded game paths, not one hundred games all played to a terminal outcome.

The parent validated a nonempty saved-fixture scaffold before delegation: structural validation plus three immutable invalid-action rejections. Agents used public engine APIs and the existing helper, with inline commands and Markdown evidence rather than new harness files. No engine or UI test suite was run. No production, test, configuration, dependency, or tracked file changes were made; no fixes or commits were made.

The automated checks cover physical identities, occupancy, FEN agreement, card-zone uniqueness, and applicable ordinary-chess transitions. They do not prove semantic correctness: Crab loss, missing promotion, and composite loss can pass them. Directed reports record critical pre-action predictions; random reports distinguish pre-run invariants from independent retrospective review of selected card transitions. The parent reviewed all reports and checked the production/rule basis of confirmed findings without starting new games.

Important coverage limitations:
- Early games 001, 002, 004, and 009 contain malformed driver attempts; 008 failed to reach its intended card; 010 used inconsistent afterMove setup. Their unexercised hypotheses are not passes or findings.
- Game 020 is inconclusive for Bog/Merciless because total displacement was only one square; later 073 supplies a qualifying path.
- Games 021–023 accidentally displayed test-source search matches. Their independence is qualified. No tests were run or edited. Later prompts prohibit directory/glob searches.
- Several agent preparation/report phases exceeded the 45-second target, and not every first-scaffold latency was independently measured. Measured game execution is distinguished from total reporting time. No claim of universal protocol compliance is made.
- Random-game candidate rejection totals are unavailable from the existing helper; recorded traces contain accepted actions, including accepted card fizzles and subsequently canceled moves.
- Output truncation affected 091, 094, and 095. Missing fields and retained evidence are disclosed in those reports; no game was restarted to hide an evidence gap.

Finite adversarial sampling cannot establish that every possible move/card combination produces a valid state. This audit found reproducible counterexamples and records the boundaries of its negative results.

## Seeded-random totals

Seventeen single runs reached 20 Regular Move action records each: **340 move records and 789 accepted actions**. Counts include canceled moves and accepted card fizzles, and exclude unreported rejected candidates. These are not 340 retained plies. Games 094 and 095 have incomplete trace/timing evidence; completion counts do not make them fully documented passes. No new confirmed defect was established by the reviewed random transitions.

| Game / seed | Accepted actions | Move records | Played cards | Game time |
| --- | ---: | ---: | ---: | --- |
| [084](game-084.md) / 908084 | 45 | 20 | 4 | 0.733 s |
| [085](game-085.md) / 908085 | 48 | 20 | 6 | 0.907 s |
| [086](game-086.md) / 908086 | 46 | 20 | 6 | 2.747 s |
| [087](game-087.md) / 908087 | 44 | 20 | 4 | 0.679 s |
| [088](game-088.md) / 908088 | 46 | 20 | 4 | 1.484 s |
| [089](game-089.md) / 908089 | 47 | 20 | 5 | 0.678 s |
| [090](game-090.md) / 908090 | 45 | 20 | 3 | 0.806 s |
| [091](game-091.md) / 908091 | 48 | 20 | 5 | 0.773 s |
| [092](game-092.md) / 908092 | 46 | 20 | 4 | 1.119 s |
| [093](game-093.md) / 908093 | 45 | 20 | 5 | 1.089 s |
| [094](game-094.md) / 908094 | 51 | 20 | 8 | unknown; last callback 7.497 s |
| [095](game-095.md) / 908095 | 51 | 20 | not fully retained | not retained |
| [096](game-096.md) / 908096 | 49 | 20 | 7 | 1.787 s |
| [097](game-097.md) / 908097 | 43 | 20 | 4 | 1.348 s |
| [098](game-098.md) / 908098 | 49 | 20 | 7 | 0.808 s |
| [099](game-099.md) / 908099 | 44 | 20 | 6 | 4.710 s |
| [100](game-100.md) / 908100 | 42 | 20 | 2 | 0.725 s |

## All game reports

Each report records its own hypothesis, actions, findings or negative result, and limitations.

[001](game-001.md) · [002](game-002.md) · [003](game-003.md) · [004](game-004.md) · [005](game-005.md) · [006](game-006.md) · [007](game-007.md) · [008](game-008.md) · [009](game-009.md) · [010](game-010.md)

[011](game-011.md) · [012](game-012.md) · [013](game-013.md) · [014](game-014.md) · [015](game-015.md) · [016](game-016.md) · [017](game-017.md) · [018](game-018.md) · [019](game-019.md) · [020](game-020.md)

[021](game-021.md) · [022](game-022.md) · [023](game-023.md) · [024](game-024.md) · [025](game-025.md) · [026](game-026.md) · [027](game-027.md) · [028](game-028.md) · [029](game-029.md) · [030](game-030.md)

[031](game-031.md) · [032](game-032.md) · [033](game-033.md) · [034](game-034.md) · [035](game-035.md) · [036](game-036.md) · [037](game-037.md) · [038](game-038.md) · [039](game-039.md) · [040](game-040.md)

[041](game-041.md) · [042](game-042.md) · [043](game-043.md) · [044](game-044.md) · [045](game-045.md) · [046](game-046.md) · [047](game-047.md) · [048](game-048.md) · [049](game-049.md) · [050](game-050.md)

[051](game-051.md) · [052](game-052.md) · [053](game-053.md) · [054](game-054.md) · [055](game-055.md) · [056](game-056.md) · [057](game-057.md) · [058](game-058.md) · [059](game-059.md) · [060](game-060.md)

[061](game-061.md) · [062](game-062.md) · [063](game-063.md) · [064](game-064.md) · [065](game-065.md) · [066](game-066.md) · [067](game-067.md) · [068](game-068.md) · [069](game-069.md) · [070](game-070.md)

[071](game-071.md) · [072](game-072.md) · [073](game-073.md) · [074](game-074.md) · [075](game-075.md) · [076](game-076.md) · [077](game-077.md) · [078](game-078.md) · [079](game-079.md) · [080](game-080.md)

[081](game-081.md) · [082](game-082.md) · [083](game-083.md) · [084](game-084.md) · [085](game-085.md) · [086](game-086.md) · [087](game-087.md) · [088](game-088.md) · [089](game-089.md) · [090](game-090.md)

[091](game-091.md) · [092](game-092.md) · [093](game-093.md) · [094](game-094.md) · [095](game-095.md) · [096](game-096.md) · [097](game-097.md) · [098](game-098.md) · [099](game-099.md) · [100](game-100.md)

## Final parent verification

All 100 numbered report files and their completion sentinels are present. The audit directory contains Markdown files only. HEAD remains the baseline above; both tracked working-tree and staged diffs are empty. The only untracked top-level addition reported by Git is `audit/`, which also contains the pre-existing audit. No fixes were attempted.
