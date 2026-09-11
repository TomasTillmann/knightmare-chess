# Cancellation of a Crusade rescue after the complete turn

Source-only review; no engine or test inspection. Scenario supplied by the parent: a Black Bishop made royal by Coup moves h7–e4 into check from a White Rook on c4, then completes Crusade e4–b7 safely. White Chaos subsequently rolls back only the extra move and leaves Black checked. The initial report of no accepted continuation is **unestablished**: the parent subsequently reported that an independent minimal engine probe accepts e4–f5 as an ordinary replacement. The full random fixture still requires a continuation check.

## Explicit local contract

- `rules.md:455`: Coup's replacement retains its movement and receives every King protection and check/checkmate rule. A royal Bishop remains a Bishop for its ordinary movement.
- `rules.md:273`: a move may temporarily leave the moving King checked only when a card on the same turn removes that check before the turn ends.
- `rules.md:277`: after the Regular Move, a regular card—including an opponent's reaction—that would leave the moving player's King checked has no board effect; it is spent and the immediately preceding position restored.
- `rules.md:534`: Chaos follows the completed move and optional after-move card, and can cancel the latest additional-card move.
- `rules.md:536`: rollback restores pending movement obligations and the moving player's replacement opportunity. An earlier independent move is preserved; this text does not establish independence of an unsafe move from its required saving card.
- `rules.md:538`: the canceled movement is prohibited as a replacement; cancellation itself is subject to §11 and fizzles if it directly creates board checkmate.
- `rules.md:714–716`: Crusade's second movement must satisfy royal safety and completes the turn's existing Regular Move without granting a third ordinary move.

These clauses do not permit an accepted, nonterminal position with neither a legal continuation nor adjudication. A temporarily checked rollback is not by itself a violation: §17.1 promises a replacement opportunity, and a different legal replacement can cure the check before the turn ends. If that opportunity works, an internal pending-rescue flag alone establishes no bug. If cancellation actually makes a legal completion impossible, §11.6's reaction-fizzle contract and §17.1's direct-mate prohibition must be considered; the engine cannot simply preserve an unsafe pending state while preventing every replacement and declining adjudication. The inspected excerpts do not explicitly choose one general rollback algorithm for every additional-move dependency.

## Explicit publisher/card text and limit

- `cards.md:263`: Crusade grants an immediate second move to the Bishop just moved without capture.
- `cards.md:291` (and equivalent Knightmare!/Think Again! text at 307/319): cancellation requires a different move and permits retrieval of the used card.
- Official FAQ p.16, text lines 654–657: these three cancellers are played after the entire opponent turn, including optional card play. The question's rescue has already completed when Chaos is played; this differs from interrupting the initial unsafe move before Crusade.
- Official FAQ p.4, text lines 110–116: in the Bog example, a regular card that causes either player's King to remain checked at the end of that player's turn has no effect but is spent and replaced. This is a final-position restriction, not a blanket ban on a checked intermediate replacement position.
- Official FAQ p.37, text lines 1589–1596: these cancellers cancel a move, permit retrieval of the used card, and permit the same or another card with a different move. This supports a real replacement opportunity, not a mandatory frozen rollback.

The exact royal-Bishop/Crusade/Chaos combination is not itself printed in the inspected source excerpts. The sources support identifying a forbidden deadlock **if one is demonstrated**, plus the §11.6 final-position fizzle contract; they do not justify claiming that the publisher expressly orders one particular rollback of both moves. The explicit saving-card rollback rule at `rules.md:281` names Fog of War, matching official FAQ p.3 lines 86–100. Extending that exact procedure to Chaos without additional authority would be an inference. No engine finding is confirmed by this source review.
