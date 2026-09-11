# Game 090 — seed 908090

Pre-run hypothesis: a seeded random legal-action walk preserves engine state invariants.

Pre-run invariants: every recorded choice comes from the current public legal-action options; action application remains bounded; final state and card coverage remain inspectable. Post-run rule reviews are distinguished below.

Result: one `generateTrace(908090, 20, progress)` call, no replay, reset, or second game. **No findings on this finite path.** Accepted 45 actions: 20 regular moves, 3 card plays, 22 endTurn actions. Runtime 805.578 ms; no failure or budget stop. Callback limits: 80 accepted actions or 15 seconds. Internal rejected-candidate count is not exposed by the helper and was not measured. Saved-fixture scaffold before and after: 4 probes each, zero findings (each contains 3 rejected actions plus structural validation).

Exact initial options (standard board defaults, shuffled full-catalog house variant under rules §4.3):
```json
{"hands":{"white":["assassin","knightmare","no-quarter","legacy","winged-victory"],"black":["ghostwalk","hidden-passage","riposte","cathedral","irresistible-force"]},"decks":{"white":["toll","man-of-straw","haunting-memories","truce","chaos","forced-march","blessing","merciless","peace-talks","figure-dance","tournament","fanatic","hostage","vendetta","earthquake","under-elf-hill","fog-of-war","fortification","abduction","fatal-attraction","cowardice","resurrection","dark-mirror","coup","crusade","plots-within-plots","doomsayer","passing-in-the-night","charge","panic","evil-eye","man-trap","rebirth","ghostwalk","challenge","curse","siege","doppelganger","holy-quest","dubbing","cathedral","disintegration","vulture","anathema","long-jump","irresistible-force","guardian","onslaught","revenge","squaring-the-circle","betrayal","breakthrough","sanctuary","madman","fireball","riposte","hidden-passage","bombard","neutrality","mystic-shield","annexation","think-again","forbidden-city","pacifism","evangelists","treason","heresy","crab","confabulation","split-knight","masquerade","holy-war","bog","dungeon","lost-castle"],"black":["forced-march","vendetta","betrayal","abduction","rebirth","charge","passing-in-the-night","fanatic","vulture","neutrality","figure-dance","man-trap","man-of-straw","squaring-the-circle","onslaught","bombard","coup","disintegration","no-quarter","anathema","cowardice","doppelganger","long-jump","toll","forbidden-city","madman","blessing","fatal-attraction","dungeon","knightmare","guardian","pacifism","evangelists","sanctuary","doomsayer","split-knight","curse","panic","confabulation","annexation","think-again","fortification","tournament","assassin","chaos","hostage","lost-castle","haunting-memories","breakthrough","crab","mystic-shield","heresy","evil-eye","masquerade","bog","winged-victory","resurrection","merciless","under-elf-hill","holy-quest","fireball","holy-war","plots-within-plots","siege","peace-talks","truce","dark-mirror","revenge","fog-of-war","treason","earthquake","dubbing","challenge","legacy","crusade"]}}
```

Exact sequential accepted-action trace (each row accepted; counts include replacement-move cards separately from regular moves):
```jsonl
{"step":1,"action":{"type":"move","from":"d2","to":"d4"}}
{"step":2,"action":{"type":"endTurn"}}
{"step":3,"action":{"type":"playCard","cardId":"hidden-passage","cardInstanceId":"black-hand-1-hidden-passage","target":[{"from":"e8","to":"c6"}]}}
{"step":4,"action":{"type":"endTurn"}}
{"step":5,"action":{"type":"move","from":"b1","to":"a3"}}
{"step":6,"action":{"type":"endTurn"}}
{"step":7,"action":{"type":"move","from":"g7","to":"g6"}}
{"step":8,"action":{"type":"playCard","cardId":"cathedral","cardInstanceId":"black-hand-3-cathedral","target":{"rook":"h8","bishop":"c8"}}}
{"step":9,"action":{"type":"endTurn"}}
{"step":10,"action":{"type":"move","from":"b2","to":"b4"}}
{"step":11,"action":{"type":"endTurn"}}
{"step":12,"action":{"type":"move","from":"h8","to":"f6"}}
{"step":13,"action":{"type":"endTurn"}}
{"step":14,"action":{"type":"move","from":"c1","to":"e3"}}
{"step":15,"action":{"type":"endTurn"}}
{"step":16,"action":{"type":"move","from":"f6","to":"g7"}}
{"step":17,"action":{"type":"endTurn"}}
{"step":18,"action":{"type":"move","from":"g2","to":"g3"}}
{"step":19,"action":{"type":"endTurn"}}
{"step":20,"action":{"type":"move","from":"g7","to":"d4"}}
{"step":21,"action":{"type":"endTurn"}}
{"step":22,"action":{"type":"playCard","cardId":"winged-victory","cardInstanceId":"white-hand-4-winged-victory","target":{"pieceId":"white-pawn-d2","to":"e5"}}}
{"step":23,"action":{"type":"endTurn"}}
{"step":24,"action":{"type":"move","from":"e7","to":"e6"}}
{"step":25,"action":{"type":"endTurn"}}
{"step":26,"action":{"type":"move","from":"f1","to":"h3"}}
{"step":27,"action":{"type":"endTurn"}}
{"step":28,"action":{"type":"move","from":"d7","to":"d5"}}
{"step":29,"action":{"type":"endTurn"}}
{"step":30,"action":{"type":"move","from":"h3","to":"g2"}}
{"step":31,"action":{"type":"endTurn"}}
{"step":32,"action":{"type":"move","from":"d8","to":"g5"}}
{"step":33,"action":{"type":"endTurn"}}
{"step":34,"action":{"type":"move","from":"e3","to":"d2"}}
{"step":35,"action":{"type":"endTurn"}}
{"step":36,"action":{"type":"move","from":"b8","to":"a6"}}
{"step":37,"action":{"type":"endTurn"}}
{"step":38,"action":{"type":"move","from":"f2","to":"f4"}}
{"step":39,"action":{"type":"endTurn"}}
{"step":40,"action":{"type":"move","from":"g5","to":"g3"}}
{"step":41,"action":{"type":"endTurn"}}
{"step":42,"action":{"type":"move","from":"e1","to":"f1"}}
{"step":43,"action":{"type":"endTurn"}}
{"step":44,"action":{"type":"move","from":"c8","to":"e8"}}
{"step":45,"action":{"type":"endTurn"}}
```

Sampled cards and counts: `{"ghostwalk":4,"hidden-passage":1,"assassin":4,"legacy":4,"cathedral":1,"forced-march":4,"winged-victory":1,"knightmare":1,"no-quarter":2,"riposte":2,"irresistible-force":2,"toll":1}`.
Played cards: hidden-passage 1, cathedral 1, winged-victory 1.
Final FEN: `r3rbn1/ppp2p1p/n1k1p1p1/3pP3/1P1b1P2/N5q1/P1PBP1BP/R2Q1KNR w - - 2 12`.

Post-run independent semantic review (these are observations checked against authoritative prose after execution, not pre-action card predictions):

1. **Hidden Passage, step 3** — cards.md “Hidden Passage” and rules §22.5 permit the owned royal to relocate to an empty square instead of moving, ignoring intervening pieces. Black king e8→c6 is empty and safe: White's only advanced piece is d4 pawn, which attacks c5/e5; no White piece attacks c6. Physical identity remains black-king-e8. Black castling rights disappear, en-passant clears, halfmove becomes 1 and fullmove 2, and moveMade becomes true. Black spends one card and draws Forced March (deck 75→74). Expected and actual agree.

2. **Cathedral, step 8** — cards.md “Cathedral” and rules card-interaction text at lines 656–656 require swapping controlled Rook/Bishop after moving; rules §6 defines swaps as non-captures without movement geometry. After Black g7→g6, bishop c8 and rook h8 swap simultaneously, keeping their original identities and roles. Thus the later h8→f6→g7→d4 path is a Bishop path, consistent with the recorded capture before Winged Victory. FEN clocks and afterMove status stay fixed at the swap; only Black card allowance becomes 1, deck 74→73, and Vendetta replaces Cathedral. King c6 stays safe and White king e1 is not newly mated. Expected and actual agree.

3. **Winged Victory, step 22** — cards.md “Winged Victory”, rules card-interaction text at line 654, and §6 Return require an opponent-captured Pawn and empty center square, as a replacement move. White pawn d2 moved to d4 in step 1 and Black's Bishop captured it at step 20. Immediately before the card it is captured with capturedBy=black; e5 is empty. Placement returns that same identity to e5 with pawn role, clearing capturedBy, and leaves the capturing bishop at d4. No capture or promotion occurs. It consumes White's move, clears en-passant, resets halfmove clock to 0, retains fullmove 6, and draws Toll (deck 75→74). Expected and actual agree.

Critical before/after evidence:
- Step 3: FEN `rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1` → `rnbq1bnr/pppppppp/2k5/8/3P4/8/PPP1PPPP/RNBQKBNR w KQ - 1 2`; turn `[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}}]`.
- Step 8: FEN `rnbq1bnr/pppppp1p/2k3p1/8/3P4/N7/PPP1PPPP/R1BQKBNR w KQ - 0 3` → `rnrq1bnb/pppppp1p/2k3p1/8/3P4/N7/PPP1PPPP/R1BQKBNR w KQ - 0 3`; turn `[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}}]`.
- Step 22: FEN `rnrq1bn1/pppppp1p/2k3p1/8/1P1b4/N3B1P1/P1P1PP1P/R2QKBNR w KQ - 0 6` → `rnrq1bn1/pppppp1p/2k3p1/4P3/1P1b4/N3B1P1/P1P1PP1P/R2QKBNR b KQ - 0 6`; turn `[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":1,"black":0}}]`.

Limitations: the generator's structural and ordinary-chess transition assertions passed, but hashes are not a card-semantics oracle. Three observed card plays were reviewed independently; unsampled interactions, invalid-card probes, and exhaustive king-safety cases were not covered. Individual candidate rejections are unavailable. The complete assignment/report wall time was not instrumented, so the 45-second reporting target is not certified; measured game runtime remained below its bound. No tests or implementation files were read or written.

GAME_090_DONE
