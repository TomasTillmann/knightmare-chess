# Adversarial engine self-play audit — 2026-09-08

Completed discovery audit against commit `33e03989fab9449d87b857fc5673f67d05841928`. No engine, test, configuration, or dependency files changed. Only Markdown audit reports were added. No fixes or commits were made.

Method: public engine actions, explicit rule-based predictions before critical actions, state invariants, and bounded seeded self-play. Reports distinguish confirmed defects, suspected defects, and rejected hypotheses. Finite self-play cannot prove correctness for every possible game.

## Confirmed findings

Six reproducible discrepancies across five bug families. Each linked report includes initial position/hands, public actions, predictions, actual results, and verification evidence.

| Priority | Finding | Reproduction |
| --- | --- | --- |
| P1 | Peace Talks reverses Earthquake without required promotion. A white pawn remains unpromoted on f8 after orientation returns to zero, and play continues. | [Game 05](game-05.md) |
| P1 | Earthquake wrongly fizzles a permitted Continuing Effect mate, spending the card without applying rotation/promotions. | [Game 07](game-07.md) |
| P1 | Confabulation likewise wrongly fizzles a permitted Continuing Effect mate, spending both card and move. Same rule-failure family as Earthquake; a separate affected handler and reproduction. | [Game 16](game-16.md) |
| P1 | Cancelling Confabulation strands a component in `away` with no effect or pending resolution. It remains unavailable after the owner's next move and subsequent turns. The precise splitting remedy is underspecified; the orphan state is reproduced. | [Game 09](game-09.md) |
| P1 | Peace Talks cancels Confabulation supporting a Coup King after the Prince was captured, despite both effects being protected by the official ruling. | [Game 13](game-13.md) |
| P2 | Vulture rejects an active Continuing Effect card that the official ruling permits it to retrieve while a proxy preserves the effect. | [Game 11](game-11.md) |

The final two findings rely on the [official FAQ, page 50](https://www.sjgames.com/knightmare/KnightmareChess_FAQ.pdf), which takes precedence under local rules §1. They are explicitly identified as official-rule discrepancies, rather than silently treating the local provisional interpretations as authoritative.

## Qualified candidates

- [Game 04](game-04.md): Panic timeout skips a checked player's turn, allowing the opponent another move while the checked King remains exposed. Behavior is reproduced; the timeout-versus-King-safety ruling needs resolution before calling it an unqualified defect.
- [Game 14](game-14.md): Truce suppresses a later Vendetta, which expires without forcing an available geometric capture. This may violate later-Continuing-Effect priority, but the meaning of Vendetta's conditional capture instruction needs adjudication.

These two candidates are excluded from the confirmed count.

## Coverage and negative results

Sixteen fresh agents received sixteen game assignments: thirteen directed scenarios and three seeded random runs. No agent was assigned two distinct games. A few agents diagnostically replayed their same scenario; those repetitions and corrected promotion choices are disclosed in their reports, not counted as extra coverage.

Two random runs completed: seed `9080301` played 60 Regular Moves / 128 accepted actions; seed `9081501` played 60 Regular Moves / 139 accepted actions. Their structural checks passed, and agents separately reviewed critical card transitions. The third run, seed `9081201`, exceeded its callback budget and is inconclusive; its completed move count was not retained. It is neither a clean pass nor a confirmed performance defect.

| Game | Focus and result |
| --- | --- |
| [01](game-01.md) | Plots, move cancellation, Fog rollback and allowance reset: no confirmed defect; later Hidden Passage probes used an incorrect target shape. |
| [02](game-02.md) | Stacked Earthquakes, Neutrality, Crab and Peace Talks: no defect on the exercised path; actual promotion/en passant not reached. |
| [03](game-03.md) | Completed seeded random self-play; seven critical event groups reviewed. |
| [04](game-04.md) | Panic candidate above. |
| [05](game-05.md) | Confirmed reversal-promotion defect. |
| [06](game-06.md) | Inconclusive setup: Pacifism was attempted at the wrong timing; excluded from bug evidence. |
| [07](game-07.md) | Confirmed Earthquake mate defect; incorrect initial promotion assumptions corrected in report. |
| [08](game-08.md) | Rejected false mate hypothesis: a defending Knight can interpose. |
| [09](game-09.md) | Confirmed orphan component after cancellation. |
| [10](game-10.md) | Independently validated direct-mate fixture: Peace Talks correctly fizzles and retains Pacifism. |
| [11](game-11.md) | Confirmed Vulture official-rule discrepancy. |
| [12](game-12.md) | Random run exceeded budget; inconclusive. |
| [13](game-13.md) | Confirmed Coup/Confabulation dependency discrepancy. |
| [14](game-14.md) | Truce/Vendetta candidate above. |
| [15](game-15.md) | Completed seeded random self-play; six card transitions independently reviewed. |
| [16](game-16.md) | Confirmed Confabulation mate defect. |

## Verification and limits

The parent validated the existing plots-rescue fixture using `checkState`, invalid-action rejection, and input-immutability probes, without initializing a new engine game. Agents used inline commands and the existing engine helper; no harness files were created. Recorded actions used public engine APIs. Sparse custom FEN positions were used for directed scenarios, with no injected effects or fabricated history.

The parent reviewed every report, checked the recorded rules and relevant production paths, and independently validated both mating geometries with chessops. For Game 05, the parent also applied the recorded action to its saved pre-action state without initializing a new game: the resulting digest exactly matched the agent's recorded state, and f8 was independently identified as a promotion square while its pawn remained unpromoted. Existing invariant checks can pass while semantic defects remain: they do not establish required promotion after reversal, absence of orphan `away` pieces, or correctness of card-specific legality.

Several agent setup/report phases exceeded the repository's 45-second turnaround target. Completed directed engine runs themselves were short; the timed-out random run is separately disclosed. No UI tests or full engine test suite were run. This was discovery self-play, not implementation or regression-test work.

Final verification: tracked working-tree and staged diffs are empty. Reports are the only additions. This finite audit is not a proof that every possible sequence is valid, and unexercised card combinations remain unaudited.
