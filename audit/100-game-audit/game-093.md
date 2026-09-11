# Game 093

Seed: `908093`

## Pre-run invariants and hypothesis

- Use one seeded game only; preserve every accepted action without replay or reset.
- Check turn progression, king safety, piece/card conservation, and terminal-state consistency against public engine behavior.
- Hypothesis: random legal-action generation preserves engine invariants through card interactions; bounded termination alone is not a defect.

## Result

Completed exactly one `generateTrace(908093, 20, progress)` invocation in 1088.954 ms. Callback bounds: 80 accepted actions / 15 seconds. No replay, reset, second game, or external termination. Accepted: 45 actions (20 ordinary moves, 20 endTurn actions, 5 card plays including one fizzle). Generator failure: none. Rejected candidate count: not exposed by the helper, therefore unknown.

Initial and final saved-fixture scaffold: 4 probes each, 0 findings each (8 total). Structural checks and the helper's conditional ordinary-chess oracle passed. One qualified rollback-rule concern below; no confirmed defect.

Final FEN: `1nbk2rr/1p1p2pp/n1pb2B1/p3pp2/7q/PPP1PPP1/R2P3P/1NBQK1NR w K - 0 11`. Final phase: white beforeMove, moveMade=false, no pending rescue; reached move budget without unfinished turn. Total reporting phase exceeded the 45-second target; only game execution wall time was instrumented.

## Exact initial options

Default standard starting board; shuffled full-catalog decks are the house variant in rules §4.3.

```json
{"hands":{"white":["toll","doomsayer","long-jump","bombard","plots-within-plots"],"black":["confabulation","pacifism","split-knight","masquerade","heresy"]},"decks":{"white":["peace-talks","treason","fireball","panic","revenge","man-of-straw","crusade","hidden-passage","no-quarter","charge","legacy","disintegration","forced-march","fortification","cathedral","lost-castle","curse","confabulation","under-elf-hill","challenge","abduction","dark-mirror","forbidden-city","anathema","doppelganger","figure-dance","passing-in-the-night","blessing","chaos","siege","annexation","bog","heresy","squaring-the-circle","holy-war","pacifism","rebirth","dubbing","evil-eye","crab","neutrality","masquerade","guardian","betrayal","onslaught","split-knight","tournament","sanctuary","evangelists","fog-of-war","vulture","knightmare","think-again","coup","breakthrough","truce","riposte","holy-quest","cowardice","winged-victory","earthquake","fanatic","assassin","merciless","dungeon","fatal-attraction","hostage","ghostwalk","man-trap","madman","vendetta","resurrection","irresistible-force","haunting-memories","mystic-shield"],"black":["disintegration","figure-dance","long-jump","truce","rebirth","haunting-memories","squaring-the-circle","mystic-shield","no-quarter","coup","dark-mirror","betrayal","fatal-attraction","charge","panic","treason","forced-march","challenge","annexation","neutrality","fortification","irresistible-force","bog","forbidden-city","hostage","resurrection","cathedral","doomsayer","crab","tournament","holy-war","merciless","man-trap","earthquake","lost-castle","breakthrough","dungeon","crusade","winged-victory","fanatic","siege","passing-in-the-night","madman","hidden-passage","doppelganger","under-elf-hill","man-of-straw","bombard","evangelists","toll","onslaught","anathema","assassin","plots-within-plots","think-again","peace-talks","guardian","riposte","vulture","fireball","curse","holy-quest","ghostwalk","abduction","blessing","legacy","vendetta","dubbing","evil-eye","sanctuary","knightmare","cowardice","revenge","chaos","fog-of-war"]}}
```

## Accepted action trace

Every action below returned accepted; card fizzle at 37 is an accepted spent-card result.

```jsonl
{"step":1,"action":{"type":"move","from":"a2","to":"a3"}}
{"step":2,"action":{"type":"endTurn"}}
{"step":3,"action":{"type":"move","from":"e7","to":"e5"}}
{"step":4,"action":{"type":"endTurn"}}
{"step":5,"action":{"type":"move","from":"b2","to":"b3"}}
{"step":6,"action":{"type":"endTurn"}}
{"step":7,"action":{"type":"move","from":"a7","to":"a5"}}
{"step":8,"action":{"type":"endTurn"}}
{"step":9,"action":{"type":"move","from":"e2","to":"e3"}}
{"step":10,"action":{"type":"endTurn"}}
{"step":11,"action":{"type":"move","from":"f8","to":"c5"}}
{"step":12,"action":{"type":"endTurn"}}
{"step":13,"action":{"type":"playCard","cardId":"plots-within-plots","cardInstanceId":"white-hand-4-plots-within-plots","target":{"player":"white"}}}
{"step":14,"action":{"type":"playCard","cardId":"bombard","cardInstanceId":"white-hand-3-bombard","target":[{"from":"a1","to":"a2"}]}}
{"step":15,"action":{"type":"endTurn"}}
{"step":16,"action":{"type":"playCard","cardId":"pacifism","cardInstanceId":"black-hand-1-pacifism","target":"e5"}}
{"step":17,"action":{"type":"move","from":"d8","to":"f6"}}
{"step":18,"action":{"type":"endTurn"}}
{"step":19,"action":{"type":"move","from":"f2","to":"f3"}}
{"step":20,"action":{"type":"endTurn"}}
{"step":21,"action":{"type":"move","from":"a8","to":"a6"}}
{"step":22,"action":{"type":"endTurn"}}
{"step":23,"action":{"type":"move","from":"f1","to":"b5"}}
{"step":24,"action":{"type":"playCard","cardId":"treason","cardInstanceId":"white-deck-1-treason","target":{"rook":"a6","knight":"g8"}}}
{"step":25,"action":{"type":"endTurn"}}
{"step":26,"action":{"type":"move","from":"c5","to":"d6"}}
{"step":27,"action":{"type":"endTurn"}}
{"step":28,"action":{"type":"move","from":"b5","to":"d3"}}
{"step":29,"action":{"type":"endTurn"}}
{"step":30,"action":{"type":"move","from":"c7","to":"c6"}}
{"step":31,"action":{"type":"endTurn"}}
{"step":32,"action":{"type":"move","from":"d3","to":"g6"}}
{"step":33,"action":{"type":"endTurn"}}
{"step":34,"action":{"type":"move","from":"f6","to":"h4"}}
{"step":35,"action":{"type":"endTurn"}}
{"step":36,"action":{"type":"move","from":"c2","to":"c3"}}
{"step":37,"action":{"type":"playCard","cardId":"peace-talks","cardInstanceId":"white-deck-0-peace-talks","target":"black-hand-1-pacifism"}}
{"step":38,"action":{"type":"move","from":"g2","to":"g3"}}
{"step":39,"action":{"type":"endTurn"}}
{"step":40,"action":{"type":"move","from":"e8","to":"d8"}}
{"step":41,"action":{"type":"endTurn"}}
{"step":42,"action":{"type":"move","from":"c2","to":"c3"}}
{"step":43,"action":{"type":"endTurn"}}
{"step":44,"action":{"type":"move","from":"f7","to":"f5"}}
{"step":45,"action":{"type":"endTurn"}}
```

## Card coverage

Sample counts (sampling does not mean eligibility or play):
```json
{"doomsayer":5,"heresy":4,"bombard":2,"confabulation":4,"masquerade":3,"plots-within-plots":1,"toll":4,"pacifism":1,"treason":1,"split-knight":3,"fireball":2,"long-jump":1,"peace-talks":1,"disintegration":1}
```
Played once each: Plots Within Plots, Bombard, Pacifism, Treason, Peace Talks (fizzled).

## Independent post-run rule reviews

These are post-run semantic reviews, distinct from the pre-run invariants and hypothesis.

1. **Plots Within Plots → Bombard (13–15), rules §17.3, §21.1; cards “Plots Within Plots” and “Bombard”.** Expected: Plots opens additional card allowance without moving; the originally held Bombard may replace the move; ending the turn closes remaining allowance. Actual: step 13 preserved board/clocks, spent/replaced Plots, and set White card count to 1; step 14 moved the same Rook a1→a2, a vacant straight destination, consumed the move and raised card count to 2. FEN changed from `rnbqk1nr/1ppp1ppp/8/p1b1p3/8/PP2P3/2PP1PPP/RNBQKBNR w KQkq - 1 4` to `rnbqk1nr/1ppp1ppp/8/p1b1p3/8/PP2P3/R1PP1PPP/1NBQKBNR b Kkq - 2 4`: queenside rights removed, halfmove incremented, no capture. Step 15 ended turn. Consistent on observed path; no jumping obstacle exercised.
2. **Pacifism (16), rules §16.1; card “Pacifism”.** Expected: own non-King Pawn receives continuing protection, with no board relocation or move consumption. Actual: Black's original e7 Pawn on e5 gained a Pacifism effect tied to its identity, Black drew Disintegration (deck 75→74), the board/clocks remained unchanged, and Black subsequently moved its Queen. Consistent application; capture immunity was not separately exercised.
3. **Treason (24), card “Treason”; rules §20 simultaneous principles.** Expected: White swaps an opposing Rook and Knight, preserving their ownership/identity without capture. Actual: black-rook-a8 a6→g8 and black-knight-g8 g8→a6; clocks and afterMove phase unchanged, no other piece delta, one replacement draw. Consistent.
4. **Peace Talks rescue fizzle (34–39), rules §11.6 and §22.6; card “Peace Talks”.** Black Queen h4 checks White King e1 along g3/f2. White c2→c3 does not block that line; the engine marked pendingRescue. Canceling Pacifism on the unrelated e5 Pawn cannot cure this check. Expected fizzle and retaining Pacifism are consistent, and subsequent g2→g3 correctly blocks the Queen line. **Qualified concern:** §11.6 says an after-move self-check fizzle restores immediately before the card. Actual step 37 also undid c2→c3, restored its clocks, and reopened beforeMove while spending Peace Talks. This may be an intentional failed-rescue rollback, but that extension is not explicit in the cited rule. Classify as a local-rule ambiguity/candidate, not a confirmed bug; no second game or diagnostic replay was run. It is not among the prior README's listed findings.

### Evidence retained for the qualified concern

```json
[{"step":34,"action":{"type":"move","from":"f6","to":"h4"},"fen":["1nb1k1rr/1p1p1ppp/n1pb1qB1/p3p3/8/PP2PP2/R1PP2PP/1NBQK1NR b Kk - 1 8","1nb1k1rr/1p1p1ppp/n1pb2B1/p3p3/7q/PP2PP2/R1PP2PP/1NBQK1NR w Kk - 2 9"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pendingRescue":false,"events":[{"type":"move","from":"f6","to":"h4"}]},{"step":36,"action":{"type":"move","from":"c2","to":"c3"},"fen":["1nb1k1rr/1p1p1ppp/n1pb2B1/p3p3/7q/PP2PP2/R1PP2PP/1NBQK1NR w Kk - 2 9","1nb1k1rr/1p1p1ppp/n1pb2B1/p3p3/7q/PPP1PP2/R2P2PP/1NBQK1NR b Kk - 0 9"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pendingRescue":true,"events":[{"type":"move","from":"c2","to":"c3"}]},{"step":37,"action":{"type":"playCard","cardId":"peace-talks","cardInstanceId":"white-deck-0-peace-talks","target":"black-hand-1-pacifism"},"fen":["1nb1k1rr/1p1p1ppp/n1pb2B1/p3p3/7q/PPP1PP2/R2P2PP/1NBQK1NR b Kk - 0 9","1nb1k1rr/1p1p1ppp/n1pb2B1/p3p3/7q/PP2PP2/R1PP2PP/1NBQK1NR w Kk - 2 9"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":1,"black":0}}],"pendingRescue":false,"events":[{"type":"cardFizzled","cardId":"peace-talks","reason":"SELF_CHECK","movement":[],"preservePreviousMove":false}],"pieces":[{"before":{"id":"white-pawn-c2","owner":"white","role":"pawn","originalRole":"pawn","square":"c3","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-c2","owner":"white","role":"pawn","originalRole":"pawn","square":"c2","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"pacifism","owner":"black","card":{"id":"black-hand-1-pacifism","cardId":"pacifism"},"pieceId":"black-pawn-e7"}],[{"type":"pacifism","owner":"black","card":{"id":"black-hand-1-pacifism","cardId":"pacifism"},"pieceId":"black-pawn-e7"}]],"hands":[{"color":"white","before":["toll","doomsayer","long-jump","peace-talks","fireball"],"after":["toll","doomsayer","long-jump","fireball","panic"],"decks":[72,71],"discard":["plots-within-plots","bombard","treason","peace-talks"]},{"color":"black","before":["confabulation","split-knight","masquerade","heresy","disintegration"],"after":["confabulation","split-knight","masquerade","heresy","disintegration"],"decks":[74,74],"discard":[]}]},{"step":38,"action":{"type":"move","from":"g2","to":"g3"},"fen":["1nb1k1rr/1p1p1ppp/n1pb2B1/p3p3/7q/PP2PP2/R1PP2PP/1NBQK1NR w Kk - 2 9","1nb1k1rr/1p1p1ppp/n1pb2B1/p3p3/7q/PP2PPP1/R1PP3P/1NBQK1NR b Kk - 0 9"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":1,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":1,"black":0}}],"pendingRescue":false,"events":[{"type":"move","from":"g2","to":"g3"}]}]
```

## Limitations

One finite path is not proof of correctness. Digests/structural assertions are not an independent card-semantics oracle. Sampling covered 14 distinct cards, while only five were played; the helper does not expose rejected candidate totals. No code, test, config, or harness changes; no test sources read or tests run. The setup and observed game continued successfully, but the rollback-rule concern needs adjudication or a separately authorized fresh regression phase.

GAME_093_DONE
