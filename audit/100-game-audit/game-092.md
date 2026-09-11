# Game 092

Seed: 908092. Status: completed; zero findings in the bounded path.

Pre-run invariants: every selected action must come from the current public legal-action options; piece locations must be unique; exactly one king per color must remain; trace must preserve initial options and every chosen action.

Pre-run hypothesis: a bounded seeded game can exercise card transitions without breaking turn ownership or board integrity. A time-bound stop alone is not a finding.


## Executed result

One generateTrace(908092, 20, progress) call; no replay or second game. Completed 46 accepted actions, 20 regular-move actions, four card plays, and two Abduction boundary actions in 1119.296083 ms. Rejected candidate count is not exposed by the helper; no rejected count is claimed. Failure: none. Findings: zero. Scaffold before and after: four probes each, zero findings. Structural checks also ran on the initial state and each callback. The run remained below the 80-action/15-second bounds; report preparation exceeded the 45-second target.

Final FEN: `rn2qb1r/2p1p1pp/p1R1bp1n/1P1pP1k1/1P1P4/5Q2/P4PPP/RN2KB1B w Q - 2 11`.

Sampled cards (sampling is not play): `{"fatal-attraction":4,"no-quarter":3,"dark-mirror":1,"panic":1,"toll":3,"squaring-the-circle":3,"hidden-passage":1,"siege":4,"abduction":3,"vulture":3,"cathedral":2,"cowardice":3,"haunting-memories":3}`.
Played cards: Panic, Hidden Passage, Cathedral, Abduction, once each.

## Exact initial options

Default normal starting position and beforeMove phase; only the following options were supplied by the existing generator. Catalog-shuffled decks are a house variant under rules §4.3.

```json
{"hands":{"white":["cathedral","no-quarter","toll","siege","panic"],"black":["hidden-passage","cowardice","dark-mirror","squaring-the-circle","fatal-attraction"]},"decks":{"white":["vulture","haunting-memories","madman","dubbing","evangelists","fanatic","blessing","irresistible-force","annexation","under-elf-hill","passing-in-the-night","curse","doppelganger","onslaught","betrayal","masquerade","peace-talks","fortification","heresy","split-knight","legacy","pacifism","mystic-shield","bog","long-jump","challenge","sanctuary","think-again","fatal-attraction","tournament","confabulation","knightmare","disintegration","anathema","dark-mirror","breakthrough","rebirth","coup","holy-quest","riposte","dungeon","forced-march","merciless","lost-castle","hostage","treason","abduction","doomsayer","earthquake","hidden-passage","evil-eye","winged-victory","vendetta","squaring-the-circle","charge","man-trap","figure-dance","crab","man-of-straw","truce","fog-of-war","neutrality","bombard","guardian","plots-within-plots","cowardice","forbidden-city","fireball","ghostwalk","assassin","crusade","revenge","chaos","resurrection","holy-war"],"black":["abduction","figure-dance","long-jump","disintegration","madman","legacy","vendetta","evangelists","riposte","fog-of-war","annexation","fireball","think-again","holy-quest","dubbing","lost-castle","curse","guardian","cathedral","treason","man-trap","neutrality","truce","coup","heresy","assassin","challenge","doomsayer","blessing","vulture","panic","bog","peace-talks","charge","fanatic","merciless","toll","pacifism","chaos","forbidden-city","passing-in-the-night","confabulation","sanctuary","split-knight","mystic-shield","ghostwalk","irresistible-force","betrayal","fortification","onslaught","breakthrough","no-quarter","crusade","anathema","revenge","earthquake","plots-within-plots","winged-victory","hostage","under-elf-hill","crab","resurrection","rebirth","holy-war","tournament","dungeon","evil-eye","masquerade","siege","forced-march","knightmare","bombard","doppelganger","haunting-memories","man-of-straw"]}}
```

## Complete accepted action trace

Each row gives step, exact action, acceptance, and resulting FEN. These are recorded observations, not an independent semantics oracle.

```jsonl
{"step":1,"action":{"type":"move","from":"b2","to":"b4"},"ok":true,"fen":"rnbqkbnr/pppppppp/8/8/1P6/8/P1PPPPPP/RNBQKBNR b KQkq - 0 1"}
{"step":2,"action":{"type":"endTurn"},"ok":true,"fen":"rnbqkbnr/pppppppp/8/8/1P6/8/P1PPPPPP/RNBQKBNR b KQkq - 0 1"}
{"step":3,"action":{"type":"move","from":"b7","to":"b5"},"ok":true,"fen":"rnbqkbnr/p1pppppp/8/1p6/1P6/8/P1PPPPPP/RNBQKBNR w KQkq - 0 2"}
{"step":4,"action":{"type":"endTurn"},"ok":true,"fen":"rnbqkbnr/p1pppppp/8/1p6/1P6/8/P1PPPPPP/RNBQKBNR w KQkq - 0 2"}
{"step":5,"action":{"type":"move","from":"c2","to":"c4"},"ok":true,"fen":"rnbqkbnr/p1pppppp/8/1p6/1PP5/8/P2PPPPP/RNBQKBNR b KQkq - 0 2"}
{"step":6,"action":{"type":"playCard","cardId":"panic","cardInstanceId":"white-hand-4-panic"},"ok":true,"fen":"rnbqkbnr/p1pppppp/8/1p6/1PP5/8/P2PPPPP/RNBQKBNR b KQkq - 0 2"}
{"step":7,"action":{"type":"endTurn"},"ok":true,"fen":"rnbqkbnr/p1pppppp/8/1p6/1PP5/8/P2PPPPP/RNBQKBNR b KQkq - 0 2"}
{"step":8,"action":{"type":"move","from":"g8","to":"h6"},"ok":true,"fen":"rnbqkb1r/p1pppppp/7n/1p6/1PP5/8/P2PPPPP/RNBQKBNR w KQkq - 1 3"}
{"step":9,"action":{"type":"endTurn"},"ok":true,"fen":"rnbqkb1r/p1pppppp/7n/1p6/1PP5/8/P2PPPPP/RNBQKBNR w KQkq - 1 3"}
{"step":10,"action":{"type":"move","from":"g1","to":"h3"},"ok":true,"fen":"rnbqkb1r/p1pppppp/7n/1p6/1PP5/7N/P2PPPPP/RNBQKB1R b KQkq - 2 3"}
{"step":11,"action":{"type":"endTurn"},"ok":true,"fen":"rnbqkb1r/p1pppppp/7n/1p6/1PP5/7N/P2PPPPP/RNBQKB1R b KQkq - 2 3"}
{"step":12,"action":{"type":"playCard","cardId":"hidden-passage","cardInstanceId":"black-hand-0-hidden-passage","target":[{"from":"e8","to":"f5"}]},"ok":true,"fen":"rnbq1b1r/p1pppppp/7n/1p3k2/1PP5/7N/P2PPPPP/RNBQKB1R w KQ - 3 4"}
{"step":13,"action":{"type":"endTurn"},"ok":true,"fen":"rnbq1b1r/p1pppppp/7n/1p3k2/1PP5/7N/P2PPPPP/RNBQKB1R w KQ - 3 4"}
{"step":14,"action":{"type":"move","from":"c4","to":"b5"},"ok":true,"fen":"rnbq1b1r/p1pppppp/7n/1P3k2/1P6/7N/P2PPPPP/RNBQKB1R b KQ - 0 4"}
{"step":15,"action":{"type":"endTurn"},"ok":true,"fen":"rnbq1b1r/p1pppppp/7n/1P3k2/1P6/7N/P2PPPPP/RNBQKB1R b KQ - 0 4"}
{"step":16,"action":{"type":"move","from":"d8","to":"e8"},"ok":true,"fen":"rnb1qb1r/p1pppppp/7n/1P3k2/1P6/7N/P2PPPPP/RNBQKB1R w KQ - 1 5"}
{"step":17,"action":{"type":"endTurn"},"ok":true,"fen":"rnb1qb1r/p1pppppp/7n/1P3k2/1P6/7N/P2PPPPP/RNBQKB1R w KQ - 1 5"}
{"step":18,"action":{"type":"move","from":"h3","to":"g5"},"ok":true,"fen":"rnb1qb1r/p1pppppp/7n/1P3kN1/1P6/8/P2PPPPP/RNBQKB1R b KQ - 2 5"}
{"step":19,"action":{"type":"endTurn"},"ok":true,"fen":"rnb1qb1r/p1pppppp/7n/1P3kN1/1P6/8/P2PPPPP/RNBQKB1R b KQ - 2 5"}
{"step":20,"action":{"type":"move","from":"f5","to":"g6"},"ok":true,"fen":"rnb1qb1r/p1pppppp/6kn/1P4N1/1P6/8/P2PPPPP/RNBQKB1R w KQ - 3 6"}
{"step":21,"action":{"type":"endTurn"},"ok":true,"fen":"rnb1qb1r/p1pppppp/6kn/1P4N1/1P6/8/P2PPPPP/RNBQKB1R w KQ - 3 6"}
{"step":22,"action":{"type":"move","from":"e2","to":"e4"},"ok":true,"fen":"rnb1qb1r/p1pppppp/6kn/1P4N1/1P2P3/8/P2P1PPP/RNBQKB1R b KQ - 0 6"}
{"step":23,"action":{"type":"endTurn"},"ok":true,"fen":"rnb1qb1r/p1pppppp/6kn/1P4N1/1P2P3/8/P2P1PPP/RNBQKB1R b KQ - 0 6"}
{"step":24,"action":{"type":"move","from":"f7","to":"f6"},"ok":true,"fen":"rnb1qb1r/p1ppp1pp/5pkn/1P4N1/1P2P3/8/P2P1PPP/RNBQKB1R w KQ - 0 7"}
{"step":25,"action":{"type":"endTurn"},"ok":true,"fen":"rnb1qb1r/p1ppp1pp/5pkn/1P4N1/1P2P3/8/P2P1PPP/RNBQKB1R w KQ - 0 7"}
{"step":26,"action":{"type":"move","from":"d2","to":"d4"},"ok":true,"fen":"rnb1qb1r/p1ppp1pp/5pkn/1P4N1/1P1PP3/8/P4PPP/RNBQKB1R b KQ - 0 7"}
{"step":27,"action":{"type":"playCard","cardId":"cathedral","cardInstanceId":"white-hand-0-cathedral","target":{"rook":"h1","bishop":"c1"}},"ok":true,"fen":"rnb1qb1r/p1ppp1pp/5pkn/1P4N1/1P1PP3/8/P4PPP/RNRQKB1B b HQ d3 0 7"}
{"step":28,"action":{"type":"endTurn"},"ok":true,"fen":"rnb1qb1r/p1ppp1pp/5pkn/1P4N1/1P1PP3/8/P4PPP/RNRQKB1B b HQ d3 0 7"}
{"step":29,"action":{"type":"move","from":"g6","to":"g5"},"ok":true,"fen":"rnb1qb1r/p1ppp1pp/5p1n/1P4k1/1P1PP3/8/P4PPP/RNRQKB1B w HQ - 0 8"}
{"step":30,"action":{"type":"endTurn"},"ok":true,"fen":"rnb1qb1r/p1ppp1pp/5p1n/1P4k1/1P1PP3/8/P4PPP/RNRQKB1B w HQ - 0 8"}
{"step":31,"action":{"type":"move","from":"e4","to":"e5"},"ok":true,"fen":"rnb1qb1r/p1ppp1pp/5p1n/1P2P1k1/1P1P4/8/P4PPP/RNRQKB1B b HQ - 0 8"}
{"step":32,"action":{"type":"endTurn"},"ok":true,"fen":"rnb1qb1r/p1ppp1pp/5p1n/1P2P1k1/1P1P4/8/P4PPP/RNRQKB1B b HQ - 0 8"}
{"step":33,"action":{"type":"move","from":"d7","to":"d5"},"ok":true,"fen":"rnb1qb1r/p1p1p1pp/5p1n/1P1pP1k1/1P1P4/8/P4PPP/RNRQKB1B w HQ d6 0 9"}
{"step":34,"action":{"type":"endTurn"},"ok":true,"fen":"rnb1qb1r/p1p1p1pp/5p1n/1P1pP1k1/1P1P4/8/P4PPP/RNRQKB1B w HQ d6 0 9"}
{"step":35,"action":{"type":"move","from":"c1","to":"c6"},"ok":true,"fen":"rnb1qb1r/p1p1p1pp/2R2p1n/1P1pP1k1/1P1P4/8/P4PPP/RN1QKB1B b Q - 1 9"}
{"step":36,"action":{"type":"endTurn"},"ok":true,"fen":"rnb1qb1r/p1p1p1pp/2R2p1n/1P1pP1k1/1P1P4/8/P4PPP/RN1QKB1B b Q - 1 9"}
{"step":37,"action":{"type":"move","from":"g5","to":"g4"},"ok":true,"fen":"rnb1qb1r/p1p1p1pp/2R2p1n/1P1pP3/1P1P2k1/8/P4PPP/RN1QKB1B w Q - 2 10"}
{"step":38,"action":{"type":"playCard","cardId":"abduction","cardInstanceId":"black-deck-0-abduction","target":"b4"},"ok":true,"fen":"rnb1qb1r/p1p1p1pp/2R2p1n/1P1pP3/3P2k1/8/P4PPP/RN1QKB1B w Q - 2 10"}
{"step":39,"action":{"type":"revealAbduction"},"ok":true,"fen":"rnb1qb1r/p1p1p1pp/2R2p1n/1P1pP3/3P2k1/8/P4PPP/RN1QKB1B w Q - 2 10"}
{"step":40,"action":{"type":"abductionTimeout"},"ok":true,"fen":"rnb1qb1r/p1p1p1pp/2R2p1n/1P1pP1k1/1P1P4/8/P4PPP/RN1QKB1B b Q - 1 9"}
{"step":41,"action":{"type":"move","from":"a7","to":"a6"},"ok":true,"fen":"rnb1qb1r/2p1p1pp/p1R2p1n/1P1pP1k1/1P1P4/8/P4PPP/RN1QKB1B w Q - 0 10"}
{"step":42,"action":{"type":"endTurn"},"ok":true,"fen":"rnb1qb1r/2p1p1pp/p1R2p1n/1P1pP1k1/1P1P4/8/P4PPP/RN1QKB1B w Q - 0 10"}
{"step":43,"action":{"type":"move","from":"d1","to":"f3"},"ok":true,"fen":"rnb1qb1r/2p1p1pp/p1R2p1n/1P1pP1k1/1P1P4/5Q2/P4PPP/RN2KB1B b Q - 1 10"}
{"step":44,"action":{"type":"endTurn"},"ok":true,"fen":"rnb1qb1r/2p1p1pp/p1R2p1n/1P1pP1k1/1P1P4/5Q2/P4PPP/RN2KB1B b Q - 1 10"}
{"step":45,"action":{"type":"move","from":"c8","to":"e6"},"ok":true,"fen":"rn2qb1r/2p1p1pp/p1R1bp1n/1P1pP1k1/1P1P4/5Q2/P4PPP/RN2KB1B w Q - 2 11"}
{"step":46,"action":{"type":"endTurn"},"ok":true,"fen":"rn2qb1r/2p1p1pp/p1R1bp1n/1P1pP1k1/1P1P4/5Q2/P4PPP/RN2KB1B w Q - 2 11"}
```

## Independent post-run rule reviews

These reviews were reasoned after observing the trace; the original pre-run predictions above were structural, not predictions of these randomly selected cards.

1. Hidden Passage, step 12 (cards.md Hidden Passage; rules §22.5 and §11.6). Expected: Black's royal King may relocate from e8 to empty f5, consume the move and one card, lose both black castling rights, and remain safe. White pawns on b4/c4 attack a5/c5 and b5/d5; the h3 Knight attacks f4/f2/g5/g1, and the undeveloped pieces do not attack f5. Actual: only black-king-e8 moves e8→f5, turn becomes black afterMove/moveMade=true, black cardPlays=1, rights change KQkq→KQ, clocks 2 3→3 4; Hidden Passage is discarded and Abduction drawn (deck 75→74). Matches.
2. Cathedral, step 27 (cards.md Cathedral; rules §20). Expected: simultaneous non-capturing swap of the acting White Rook h1 and Bishop c1 after d2→d4, retaining identities and completed move. Actual: white-rook-h1 is on c1 and white-bishop-c1 is on h1; no other piece changes, white remains afterMove/moveMade=true, white cardPlays=1. Cathedral enters discard and Haunting Memories replaces it (deck 74→73). The later c1→c6 move follows a clear rook file c2,c3,c4,c5, confirming the swapped Rook's movement role. Matches the swap and identity rules.
3. Abduction, steps 37–40 (cards.md Abduction; rules §19.2 and §11.6). Expected: after the temporarily illegal black King g5→g4, removing White's b4 Pawn cannot cure the Queen d1–e2–f3–g4 diagonal check. Concealment must preserve identity without capture, and the eventual timeout must fail King-safety resolution and roll back the illegal move while spending Abduction only once. Actual: step 38 sends white-pawn-b2 b4→away with no public target leakage in card history; step 39 changes concealment→recall; step 40 records cardFizzled/SELF_CHECK, restores that Pawn to b4 and King to g5, resets Black to beforeMove/moveMade=false, retains black cardPlays=1 and the already drawn Figure Dance. Deck remains 73 through resolution, with no second draw. This is the specified failed rescue, not a defect.
4. Panic, steps 6–8 (cards.md Panic; rules §18.5). Expected: White's after-move play applies a 15000 ms deadline obligation to Black's next move without relocating pieces. Actual: effect {type:panic, owner:white, player:black, durationMs:15000}, no piece changes, then Black moves g8→h6; effect is absent before the later Hidden Passage. Matches the ordinary timely-move path. This does not test timer expiry.

## Limits

A finite seeded path does not establish universal correctness. No separate directed game was created. Timer boundaries were engine actions, not human real-time waits; hidden information was assessed from recorded public card events. The generator checks structural consistency and eligible ordinary chess transitions independently, but hashes and successful actions do not prove card semantics. No production, test, or harness files were written or read as tests.

GAME_092_DONE
