# Game 054 — Dungeon last-rank pawn

Pre-action hypothesis: Dungeon relocates the opponent pawn to a last-rank corner without promotion. The pawn remains immobile during the next opponent turn, and the restriction expires when that turn ends, including a forfeited turn if reachable.

Parent scaffold executed successfully: four probes, zero findings.

## Setup and grounds

Exact createGameState options: `{"fen":"4k3/8/8/3p4/8/8/1N5R/4K3 w - - 0 1","hands":{"white":["dungeon"],"black":["dark-mirror","dark-mirror"]}}`. Normal beforeMove; no phase or history overrides. checkState passed initially and after every action. Both initial kings independently returned not in check.

cards.md Dungeon permits relocation to an empty corner and prevents the opponent moving the piece on the following turn. Catalog timing is afterMove. rules.md §13.2 says non-Pawn-move relocation does not promote absent explicit permission. Dark Mirror text permits backward diagonal capture, catalog beforeMove.

Initial legalDests: e1→d1,f1,d2,e2,f2; b2→d1,d3,a4,c4; h2→h1,c2,d2,e2,f2,g2,h3,h4,h5,h6,h7,h8. After action 1, Dungeon targets were exactly d5→a1,a8,h1,h8; action 2 selected the returned a1 target.

## Sequential evidence

| # | Exact action | Prediction before action | Actual |
|---|---|---|---|
|1|move h2→h3|accept|accepted|
|2|playCard dungeon, target [{from:d5,to:a1}]|accept, no promotion|accepted; black-pawn-d5 on a1, role pawn, promoted false; Dungeon effect player black|
|3|endTurn|lock survives white turn|accepted; black beforeMove, lock retained|
|4|playCard dark-mirror, no target|modifier might arm|rejected INVALID_TARGET: Choose exactly one Pawn capture|
|5|move a1→b2|reject Dungeon|rejected ILLEGAL_MOVE: Dungeon prevents moving that piece this turn|
|6|move e8→d8|accept|accepted; Dungeon retained through black afterMove|
|7|endTurn|lock expires|accepted; white beforeMove, effects []|
|8|move h3→h4|accept|accepted|
|9|endTurn|accept|accepted; black beforeMove, effects []|
|10|playCard dark-mirror, no target|accept|rejected INVALID_TARGET: Choose exactly one Pawn capture|
|11|move a1→b2|accept after expiration|rejected ILLEGAL_MOVE: That is not a legal chess move|
|12|endTurn|accept|rejected INVALID_TIMING: Make the regular move before ending the turn|

Dark Mirror cardPlayTargets was enumerated on the same game before actions 4 and 10, both returning `[[{from:"a1",to:"b2"}]]`. The driver incorrectly omitted that target, so actions 4 and 10 are driver errors and the subsequent ordinary backward Pawn move cannot substantiate a failure. No reset or replay occurred. Locked legalDests contained only e8→d7,e7,f7,d8,f8; unlocked ordinary legalDests contained only d8→c7,d7,e7,c8,e8. The relocated pawn remained unpromoted at a1 throughout all 12 actions.

## Result

One game, 12 actions: 7 accepted, 5 rejected; measured game execution 24.574 ms. Scaffold: four probes, zero findings. Zero confirmed engine findings. Verified non-promotion, direct movement prohibition during the opponent turn, retention through that turn's afterMove, and effect removal at its end. Actual card-assisted movement after expiration is inconclusive because of the target omissions; forfeited-turn expiry and seeded continuation were not exercised. This finite path is not proof of correctness.

GAME_054_DONE
