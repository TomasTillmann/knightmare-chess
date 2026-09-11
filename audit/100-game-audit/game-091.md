# Game 091 — seed 908091

## Pre-run

- Invariants: every chosen action must come from the public legal-action surface; state transitions must preserve valid board and turn state; card resolution must obey the authoritative rules.
- Hypothesis: one seeded random game will expose no engine inconsistency; bounded termination alone is not a finding.
- Planned review: independently inspect three critical transitions against card and general rules after this single run.

## Execution

Completed exactly one `generateTrace(908091, 20, progress)` call: **48 accepted actions, 20 Regular Moves, 5 card plays, 773.16425 ms**. No helper failure; no budget stop. Rejected candidate count is not exposed by the helper. Both saved-fixture scaffold runs passed (4 probes each, 0 findings). Initial and each callback state passed checkState; the helper also checked transition structure and ordinary moves where its ordinary-position guard applied.

## Exact initial options
Standard starting FEN: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`. No setup overrides beyond these options; shuffled full-catalog decks are the §4.3 house variant.
```json
{"hands":{"white":["masquerade","disintegration","madman","hostage","panic"],"black":["haunting-memories","fireball","blessing","forced-march","confabulation"]},"decks":{"white":["neutrality","abduction","anathema","tournament","hidden-passage","haunting-memories","challenge","crab","man-of-straw","squaring-the-circle","treason","doomsayer","heresy","peace-talks","guardian","coup","under-elf-hill","plots-within-plots","fortification","curse","fog-of-war","think-again","vendetta","legacy","forced-march","long-jump","cathedral","knightmare","confabulation","rebirth","fireball","mystic-shield","sanctuary","riposte","betrayal","ghostwalk","cowardice","fatal-attraction","pacifism","crusade","dubbing","onslaught","fanatic","resurrection","forbidden-city","breakthrough","evil-eye","bog","holy-war","blessing","winged-victory","no-quarter","charge","passing-in-the-night","lost-castle","evangelists","revenge","annexation","bombard","siege","split-knight","chaos","figure-dance","earthquake","dark-mirror","holy-quest","dungeon","doppelganger","man-trap","truce","vulture","merciless","irresistible-force","toll","assassin"],"black":["peace-talks","evangelists","coup","irresistible-force","evil-eye","assassin","fog-of-war","dark-mirror","mystic-shield","treason","panic","plots-within-plots","madman","fanatic","bog","bombard","forbidden-city","figure-dance","tournament","dungeon","neutrality","challenge","split-knight","holy-quest","rebirth","cathedral","curse","anathema","siege","revenge","toll","squaring-the-circle","think-again","disintegration","betrayal","chaos","masquerade","sanctuary","winged-victory","crab","hidden-passage","guardian","riposte","cowardice","hostage","man-of-straw","legacy","dubbing","heresy","fortification","vendetta","breakthrough","no-quarter","vulture","holy-war","crusade","onslaught","abduction","fatal-attraction","earthquake","charge","under-elf-hill","passing-in-the-night","resurrection","knightmare","long-jump","ghostwalk","man-trap","doomsayer","pacifism","merciless","truce","annexation","doppelganger","lost-castle"]}}
```

## Accepted action trace
All rows accepted. FEN is the result after the numbered action; endTurn rows preserve the previous FEN. Exact card instance IDs and targets are retained.
```jsonl
{"step":1,"action":{"type":"move","from":"f2","to":"f3"},"fen":"rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1"}
{"step":2,"action":{"type":"endTurn"}}
{"step":3,"action":{"type":"move","from":"h7","to":"h5"},"fen":"rnbqkbnr/ppppppp1/8/7p/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2"}
{"step":4,"action":{"type":"endTurn"}}
{"step":5,"action":{"type":"move","from":"b1","to":"a3"},"fen":"rnbqkbnr/ppppppp1/8/7p/8/N4P2/PPPPP1PP/R1BQKBNR b KQkq - 1 2"}
{"step":6,"action":{"type":"endTurn"}}
{"step":7,"action":{"type":"move","from":"d7","to":"d6"},"fen":"rnbqkbnr/ppp1ppp1/3p4/7p/8/N4P2/PPPPP1PP/R1BQKBNR w KQkq - 0 3"}
{"step":8,"action":{"type":"endTurn"}}
{"step":9,"action":{"type":"move","from":"h2","to":"h3"},"fen":"rnbqkbnr/ppp1ppp1/3p4/7p/8/N4P1P/PPPPP1P1/R1BQKBNR b KQkq - 0 3"}
{"step":10,"action":{"type":"endTurn"}}
{"step":11,"action":{"type":"move","from":"e7","to":"e5"},"fen":"rnbqkbnr/ppp2pp1/3p4/4p2p/8/N4P1P/PPPPP1P1/R1BQKBNR w KQkq - 0 4"}
{"step":12,"action":{"type":"endTurn"}}
{"step":13,"action":{"type":"move","from":"a3","to":"b1"},"fen":"rnbqkbnr/ppp2pp1/3p4/4p2p/8/5P1P/PPPPP1P1/RNBQKBNR b KQkq - 1 4"}
{"step":14,"action":{"type":"endTurn"}}
{"step":15,"action":{"type":"playCard","cardId":"confabulation","cardInstanceId":"black-hand-4-confabulation","target":[{"from":"h8","to":"g8"}]},"fen":"rnbqkbn1/ppp2pp1/3p4/4p2p/8/5P1P/PPPPP1P1/RNBQKBNR w KQq - 2 5"}
{"step":16,"action":{"type":"endTurn"}}
{"step":17,"action":{"type":"move","from":"d2","to":"d4"},"fen":"rnbqkbn1/ppp2pp1/3p4/4p2p/3P4/5P1P/PPP1P1P1/RNBQKBNR b KQq - 0 5"}
{"step":18,"action":{"type":"endTurn"}}
{"step":19,"action":{"type":"move","from":"c8","to":"f5"},"fen":"rn1qkbn1/ppp2pp1/3p4/4pb1p/3P4/5P1P/PPP1P1P1/RNBQKBNR w KQq - 1 6"}
{"step":20,"action":{"type":"endTurn"}}
{"step":21,"action":{"type":"move","from":"c1","to":"e3"},"fen":"rn1qkbn1/ppp2pp1/3p4/4pb1p/3P4/4BP1P/PPP1P1P1/RN1QKBNR b KQq - 2 6"}
{"step":22,"action":{"type":"endTurn"}}
{"step":23,"action":{"type":"move","from":"f7","to":"f6"},"fen":"rn1qkbn1/ppp3p1/3p1p2/4pb1p/3P4/4BP1P/PPP1P1P1/RN1QKBNR w KQq - 0 7"}
{"step":24,"action":{"type":"endTurn"}}
{"step":25,"action":{"type":"move","from":"g2","to":"g4"},"fen":"rn1qkbn1/ppp3p1/3p1p2/4pb1p/3P2P1/4BP1P/PPP1P3/RN1QKBNR b KQq - 0 7"}
{"step":26,"action":{"type":"endTurn"}}
{"step":27,"action":{"type":"playCard","cardId":"haunting-memories","cardInstanceId":"black-hand-0-haunting-memories","target":[{"from":"d8","to":"b8"}]},"fen":"rn2kbn1/ppp3p1/3p1p2/4pb1p/3P2P1/4BP1P/PPP1P3/RN1QKBNR w KQq - 1 8"}
{"step":28,"action":{"type":"endTurn"}}
{"step":29,"action":{"type":"move","from":"f3","to":"f4"},"fen":"rn2kbn1/ppp3p1/3p1p2/4pb1p/3P1PP1/4B2P/PPP1P3/RN1QKBNR b KQq - 0 8"}
{"step":30,"action":{"type":"endTurn"}}
{"step":31,"action":{"type":"move","from":"h5","to":"h4"},"fen":"rn2kbn1/ppp3p1/3p1p2/4pb2/3P1PPp/4B2P/PPP1P3/RN1QKBNR w KQq - 0 9"}
{"step":32,"action":{"type":"endTurn"}}
{"step":33,"action":{"type":"move","from":"e1","to":"d2"},"fen":"rn2kbn1/ppp3p1/3p1p2/4pb2/3P1PPp/4B2P/PPPKP3/RN1Q1BNR b q - 1 9"}
{"step":34,"action":{"type":"endTurn"}}
{"step":35,"action":{"type":"playCard","cardId":"forced-march","cardInstanceId":"black-hand-3-forced-march","target":[{"from":"c7","to":"d7"},{"from":"e5","to":"d5"}]},"fen":"rn2kbn1/pp1p2p1/3p1p2/3p1b2/3P1PPp/4B2P/PPPKP3/RN1Q1BNR w q - 0 10"}
{"step":36,"action":{"type":"endTurn"}}
{"step":37,"action":{"type":"move","from":"a2","to":"a3"},"fen":"rn2kbn1/pp1p2p1/3p1p2/3p1b2/3P1PPp/P3B2P/1PPKP3/RN1Q1BNR b q - 0 10"}
{"step":38,"action":{"type":"playCard","cardId":"disintegration","cardInstanceId":"white-hand-1-disintegration","target":"a3"},"fen":"rn2kbn1/pp1p2p1/3p1p2/3p1b2/3P1PPp/4B2P/1PPKP3/RN1Q1BNR b q - 0 10"}
{"step":39,"action":{"type":"endTurn"}}
{"step":40,"action":{"type":"move","from":"f5","to":"d3"},"fen":"rn2kbn1/pp1p2p1/3p1p2/3p4/3P1PPp/3bB2P/1PPKP3/RN1Q1BNR w q - 1 11"}
{"step":41,"action":{"type":"playCard","cardId":"peace-talks","cardInstanceId":"black-deck-0-peace-talks","target":"black-hand-4-confabulation"},"fen":"rn2kbn1/pp1p2p1/3p1p2/3p4/3P1PPp/3bB2P/1PPKP3/RN1Q1BNR w q - 1 11"}
{"step":42,"action":{"type":"endTurn"}}
{"step":43,"action":{"type":"move","from":"d2","to":"d3"},"fen":"rn2kbn1/pp1p2p1/3p1p2/3p4/3P1PPp/3KB2P/1PP1P3/RN1Q1BNR b q - 0 11"}
{"step":44,"action":{"type":"endTurn"}}
{"step":45,"action":{"type":"move","from":"b7","to":"b6"},"fen":"rn2kbn1/p2p2p1/1p1p1p2/3p4/3P1PPp/3KB2P/1PP1P3/RN1Q1BNR w q - 0 12"}
{"step":46,"action":{"type":"endTurn"}}
{"step":47,"action":{"type":"move","from":"d1","to":"c1"},"fen":"rn2kbn1/p2p2p1/1p1p1p2/3p4/3P1PPp/3KB2P/1PP1P3/RNQ2BNR b q - 1 12"}
{"step":48,"action":{"type":"endTurn"}}
```

Final FEN: `rn2kbn1/p2p2p1/1p1p1p2/3p4/3P1PPp/3KB2P/1PP1P3/RNQ2BNR b q - 1 12`; final action ends White's turn and leaves Black beforeMove. Sampled cards (sampling does not imply successful play):
```json
{"panic":4,"forced-march":5,"masquerade":3,"madman":4,"hostage":5,"confabulation":3,"blessing":2,"haunting-memories":2,"fireball":2,"peace-talks":2,"evangelists":2,"coup":1,"disintegration":1,"neutrality":1}
```
Played once each: Confabulation, Haunting Memories (copies Confabulation), Forced March, Disintegration, Peace Talks.

## Independent post-run rule reviews
These are post-run semantic reviews, distinct from the pre-run invariant prediction and automated hashes.

1. **Haunting Memories, step 27 — matches rules §22.7 and cards.md Haunting Memories/Confabulation.** The latest preceding card was nonunique Confabulation at step 15. Black queen d8 traverses empty c8 to friendly knight b8; the king is excluded and neither component is royal. Before FEN `rn1qkbn1/ppp3p1/3p1p2/4pb1p/3P2P1/4BP1P/PPP1P3/RN1QKBNR b KQq - 0 7`; after FEN `rn2kbn1/ppp3p1/3p1p2/4pb1p/3P2P1/4BP1P/PPP1P3/RN1QKBNR w KQq - 1 8`. Queen d8 changes board→away, and a separate Confabulation effect links black-knight-b8/black-queen-d8 using the Haunting Memories instance. The first g8/h8 composite remains. The move and card allowances are consumed and one replacement is drawn. No discrepancy in this observed copying/merge transition.
2. **Forced March, step 35 — matches rules §13.6 and cards.md Forced March.** Initially c7/e5 hold distinct black pawns, d7/d5 are empty. Both move exactly one file sideways, to distinct destinations without capture. Before FEN `rn2kbn1/ppp3p1/3p1p2/4pb2/3P1PPp/4B2P/PPPKP3/RN1Q1BNR b q - 1 9`; after FEN `rn2kbn1/pp1p2p1/3p1p2/3p1b2/3P1PPp/4B2P/PPPKP3/RN1Q1BNR w q - 0 10`. Both physical pawn deltas match the target, Black becomes afterMove with moveMade=true/cardPlays.black=1, and enPassant remains empty. This agrees with simultaneous movement and consuming the Regular Move.
3. **Disintegration, step 38 — matches cards.md Disintegration and rules §6 death terminology.** After a2–a3 at step 37, White removes its own pawn a3. Physical white-pawn-a2 changes from board/a3 to dead/null (not captured), while the turn remains White afterMove. The card is discarded and replaced with Neutrality; board removal matches the printed permanent-death action. A later return attempt was not exercised.
4. **Peace Talks, step 41 — duplicate cancellation symptom of prior 2026-09-08 game 09.** Per cards.md Peace Talks/rules §22.6, cancellation must end the combined effect and address an illegal piece situation on the owner's next move. The g8/h8 Confabulation effect is removed and its physical card discarded, but the board is identical before/after and the recorded piece delta is empty. Black later makes b7–b6 at step 45; neither composite component is restored or removed in any later recorded delta. This supports the previously documented orphan-component defect family, not a new finding. Exact split procedure remains underspecified locally; this run did not retain the canceled rook's final physical zone explicitly, so the evidence here is the matching cancellation/no-correction symptom.

Cancellation evidence: step 41 retained only the copied Confabulation:
```json
{"step":41,"fen":["rn2kbn1/pp1p2p1/3p1p2/3p4/3P1PPp/3bB2P/1PPKP3/RN1Q1BNR w q - 1 11","rn2kbn1/pp1p2p1/3p1p2/3p4/3P1PPp/3bB2P/1PPKP3/RN1Q1BNR w q - 1 11"],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-4-confabulation","cardId":"confabulation"},"pieceIds":["black-knight-g8","black-rook-h8"]},{"type":"confabulation","owner":"black","card":{"id":"black-hand-0-haunting-memories","cardId":"haunting-memories"},"pieceIds":["black-knight-b8","black-queen-d8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-0-haunting-memories","cardId":"haunting-memories"},"pieceIds":["black-knight-b8","black-queen-d8"]}]],"step45Pieces":[{"before":{"id":"black-pawn-b7","owner":"black","role":"pawn","originalRole":"pawn","square":"b7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-b7","owner":"black","role":"pawn","originalRole":"pawn","square":"b6","zone":"board","promoted":false,"royal":false,"neutral":false}}]}
```

## Limitations
Zero new confirmed defects; one prior defect symptom recurred. This finite 20-move path does not prove correctness. Only 5 card types were played, and merged-piece movement and corrective cancellation choices were not independently probed. Tool output truncated part of the raw review text; exact initial options, the full 48-action trace, all callback FEN/history snapshots, and complete rows 17–48 survived. Semantic evidence above uses surviving rows only. No replay, second game, tests, code changes, or temporary harnesses. The full report/review phase exceeded 45 seconds; measured engine execution stayed under 15 seconds. First report patch preceded source inspection; scaffold ran promptly after protocol inspection.

GAME_091_DONE
