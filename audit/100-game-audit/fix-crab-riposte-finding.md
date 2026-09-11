# Crab capture age after Riposte

The Crab repair candidate exposes an additional capture-age error in trace 191. At step 104 the FEN is Black to move, fullmove 24 (ply 47). Black's Crab captures and promotes at step 105. White reverses it with Riposte at step 106, restoring the attacker's pre-promotion Pawn form and capturing it instead.

Expected: capture age belongs to the completed Black move, ply 47. The restored Crab effect remains through the immediately following White move, including its after-move card window even when Riposte forfeits that move.

Observed: `capturedAtPly` is 46. The effect is retained immediately after Riposte but discarded at step 107 when White's forfeited move opens its after-move phase. This prematurely closes the transformation's return window. The earlier normalized replay comparison established no unrelated differences, but did not establish that this newly recorded capture age was correct.

Public reproduction: replay `campaign/iterations/191.json` through actions 104–107 using `createGameState` and `applyAction`. Step 106: FEN `N7/rb4pp/pPP1p1n1/r1bp1Bn1/2P2R2/1P1B2k1/3P3p/NR1K4 w - - 0 25`, turn Black/afterMove, captured Black Pawn `black-pawn-c7`, age 46, Crab effect retained. Step 107: White/afterMove with forfeited move, Crab already discarded.

Rules §10 preserves a captured transformation through the immediately following move. Riposte's rule preserves the completed capturing move's clocks and uses the attacker's pre-capture form. This finding stays on the Crab repair until a fresh regression, implementation and audit cycle completes.
