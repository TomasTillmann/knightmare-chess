# Game 063: Abduction canceled during concealment

Pre-action hypothesis: Fog of War played immediately after Abduction in its concealment phase restores the abducted piece with its original identity and any existing effects, clears pendingAbduction, and allows ordinary turn progression. An ordinary action during concealment should reject without changing state.

Scaffold executed successfully: four probes, zero findings.

Initial options exactly: `{"fen":"7k/4p3/8/3r4/2N5/8/P7/7K b - - 0 1","hands":{"black":["fatal-attraction","fog-of-war"],"white":["abduction"]}}`. Default normal beforeMove; decks empty. Initial checkState passed; neither King checked. No injected effects, replay, reset, tests, or harness edits.

Rule grounds: cards.md Abduction removes an opposing non-King provisionally for recall; Fog of War cancels another card and discards both; Fatal Attraction immobilizes adjacent non-Kings until its magnet moves or is captured. Catalog places Abduction and Fatal Attraction afterMove and Fog immediately afterOpponentCard.

Predictions below were supplied before applying each action. All matched actual acceptance and semantic results.

| # | Exact action | Prediction / actual |
|---|---|---|
|1|move h8 g8|Accepted quiet King move|
|2|playCard fatal-attraction target d5|Accepted rook magnet|
|3|endTurn|Accepted|
|4|move a2 a3|Accepted quiet pawn move|
|5|playCard abduction target d5|Accepted; pending concealment; rook away|
|6|endTurn|Rejected INVALID_TIMING, resolve Abduction first; concealment unchanged|
|7|playCard fog-of-war, target omitted|Accepted; rook and effect restored; choice cleared|
|8|revealAbduction|Rejected INVALID_TIMING, no pending challenge|
|9|endTurn|Accepted normal progression|
|10|move e7 e6|Accepted; magnet stays stationary|
|11|endTurn|Accepted|
|12|move c4 b6|Rejected ILLEGAL_MOVE; restored magnet traps Knight|
|13|move h1 h2|Accepted seeded legal continuation|
|14|endTurn|Accepted seeded continuation|

Enumerations on this same game: initial legalDests allowed rook d5→d1,d2,d3,d4,a5,b5,c5,e5,f5,g5,h5,d6,d7,d8; pawn e7→e5,e6; King h8→g7,h7,g8. Fatal Attraction targets before action 2: d5,e7,g8. White legalDests before action 4: h1→g1,g2,h2 and a2→a3,a4; c4 absent. Abduction targets before action 5: d5,e7. Fog targets before action 7: `[undefined]` (JSON renders this as `[null]`). Targets were chosen from those actual lists.

Independent semantic observations: Abduction changed black-rook-d5 to zone away, square null. After Fog its complete piece record exactly matched the pre-Abduction record: id black-rook-d5, owner black, role/originalRole rook, square d5, zone board, promoted/royal/neutral false. The complete effects array also matched, retaining `{"type":"fatal-attraction","owner":"black","card":{"id":"black-hand-0-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"black-rook-d5"}`. pendingAbduction was absent/null. White discarded white-hand-0-abduction and Black discarded black-hand-1-fog-of-war. Both hands and decks were empty. After action 11 legalDests still excluded c4 and allowed h1→g1,g2,h2, a3→a4, independently confirming the restored effect operates beyond object restoration. Action 12's rejection message mentions Dungeon despite Fatal Attraction being the cause; recorded as cosmetic wording only, not a new gameplay finding.

Every action ran checkState; rejected actions preserved input digest. Seeded continuation used seed 63, recurrence `(Math.imul(seed,1664525)+1013904223)>>>0`, choosing flattened legalDests at `seed % moves.length`, otherwise endTurn after a move.

Result: one game, 14 actions, 11 accepted / 3 rejected; zero gameplay findings. Engine execution wall time 31.217333 ms; overall phase exceeded the 45-second target (approximately two minutes including source reading and reporting). Final FEN: `6k1/8/4p3/3r4/2N5/P7/7K/8 b - - 1 3`. Limitation: finite concealment-cancellation path with one continuing effect, not recall/timeout or all transformations; no proof of general correctness.

GAME_063_DONE
