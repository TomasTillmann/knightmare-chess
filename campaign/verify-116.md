# Iteration 116 independent verification

Rule verification: cards.md explicitly grants Doomsayer's opponent an immediate optional naming choice. Rule 11.6 allows a checked Regular Move when a same-turn card removes the check before turn end; it requires evaluating the complete card effect. Independent public-API probes will distinguish offering that choice from resolving a declined or ineffective choice, and verify whether losing White's Queen actually cures this position.

## Verdict: TRUE

Artwork `final_cards/KC1_card3.png`, cards.md, and rules.md §19.3 agree: the opponent may immediately name a piece and chooses an owned eligible piece to lose. The artwork also says the effect continues until a piece is lost. Under §11.6 the engine must evaluate that offered response before deciding whether Doomsayer cures the checked move.

Exactly eight `applyAction` probes executed, with read-only `isKingInCheck` and `doomsayerTargets` observations. Measured combined probe wall time: 545.588 ms. No test sources or test commits were inspected; no test commands were run. No temporary harness files were created (inline Node execution only).

1. Saved public state after action 77: `move d8 d7` succeeds in 527.625 ms, keeping Black afterMove with pendingRescue and Black checked.
2. Actual Doomsayer play succeeds only as SELF_CHECK cardFizzled in 9.874 ms, rewinds the Rook to d8, spends Black's card allowance, and exposes no pendingDoomsayer choice. This is the defect.
3. Isolated response fixture: remove only pendingRescue from the moved public state, then publicly play Doomsayer (0.797 ms). The engine offers White the immediate choice and leaves Rd7 intact. Restore the original pendingRescue into this offered state before probing responses. This deliberately constructed fixture tests the public response handler; it is not claimed to be an already reachable successful replay. Public target enumeration returns White's physical Queen `white-queen-d1` at e6.
4. White names queen and loses `white-queen-d1` to `black-hand-0-doomsayer` (1.938 ms): Queen captured, Black no longer checked, Rd7 retained, pendingRescue cleared, pendingDoomsayer cleared, and the effect consumed. This proves the exact board has a successful complete card result.
5. White declines the isolated offer (0.775 ms): current handler removes the choice but leaves Black checked with pendingRescue and Rd7. That cannot be accepted as a completed legal turn under §11.6; failed-rescue settlement must provide a replacement-move continuation, preserving the card expenditure. Merely bypassing initial settlement without handling decline would strand this branch.
6. White names rook while selecting the Queen (0.025 ms): WRONG_ROLE rejection preserves the pending choice and board. Such a malformed choice must remain retryable, without spending/capturing again. A correctly typed loss of a non-checking piece is distinct: it must not count as a cure while Qe6 still checks Ke7; this latter variant was not executed within the eight-action budget.
7. End turn after successful Queen loss (1.659 ms): succeeds, White beforeMove, no outcome, Black safe, Rd7 retained. Compatible successful continuation is therefore name Queen, lose Qe6, endTurn.
8. Independently safe fixture (`4k3/8/8/8/8/8/8/3QK3 b - - 0 1`, Black afterMove with Doomsayer) publicly offers White the same immediate choice (0.093 ms), establishing the ordinary offer works when no rescue settlement intervenes.

Correct outcome requirements: action 79 offers White a choice before any SELF_CHECK fizzle; a valid Queen loss commits the rescue and allows endTurn; an invalid identity/role selection rejects atomically and retains the choice; declining or completing a loss that does not cure Black's check must not commit Rd7 or allow a checked turn to end. The checked failed-rescue branch must spend the attempted card once and restore a playable replacement-move state under §11.6. Ordinary safe Doomsayer play must keep its optional response and continuing-effect behavior.

Production observation: `settlePendingRescue` currently judges the offered-but-unanswered state, restores the earlier pendingDoomsayer value, and rewinds before the existing `namePiece` handler can resolve the cure. Timing of `legalDests` was neither measured nor conflated with these probes.

VERIFY_116_DONE verdict=TRUE probes=8 wallMs=545.588 findings=1 temporaryHarnesses=0
