# Game 085 — seed 908085

## Pre-run invariants

- Piece and card identities remain conserved except for explicit capture, discard, draw, and rule-directed transformations.
- Every ordinary board move must be legal under the active card effects and produce the corresponding board transition.
- Turn ownership, pending reactions, and resolution order remain consistent with the active phase.

## Pre-run review hypothesis

The seeded random game may expose an interaction between card effects and ordinary legal moves; any suspected failure requires a concrete transition and an authoritative rule check. Stopping at the action or time bound is not itself a bug.

## Execution result

Exactly one `generateTrace(908085, 20, progress)` invocation, with callback stops at step >= 80 or elapsed >= 15000 ms. Completed 48 accepted actions ({"move":20,"endTurn":22,"playCard":6}), 20 regular move actions, in 907.413459 ms. No helper failure. No replay, reset, second game, test reads, or code/harness edits. Scaffold before and after: 4 probes each, zero findings (8 scaffold probes total). Initial checkpoint is the normal standard board, White beforeMove; the generator checks each resulting state. The 20 move count includes the canceled d7–d5 move and excludes replacement-card moves.

Rejected candidate count is unavailable: the existing generator does not return its internally rejected attempts. All 48 recorded actions were accepted. No explicit extra rejected-game probes were added. Sampled-card counts are candidate selections, not successful card counts.

## Independent post-run rule reviews

These are post-run semantic reviews of observed evidence, distinct from the pre-run invariant predictions above.

1. **Think Again!, step 4 then 5 — cards.md “Think Again!”, rules.md §§8.3–8.5 and 17.1.** Expected: cancel Black's just-completed d7–d5, restore the pawn on d7 and the pre-move clocks, keep Black active with its move available, spend only White's reaction card, require a different replacement. Observed: black-pawn-d7 returns d5→d7, FEN returns to fullmove 1 with Black active, Black beforeMove/moveMade=false, White card count=1 and one replacement draw. Black then plays b7–b5. This different piece and transition meet the replacement condition. No finding.

2. **Plots Within Plots, steps 7–9 — cards.md “Plots Within Plots”, rules.md §17.3.** Expected: no board/clock movement, one discard and draw, keep ordinary move available; using zero bonus cards is permitted and a regular move closes the unused allowance. Observed: unchanged FEN and pieces, White beforeMove with card count 1, holy-quest drawn; f2–f3 follows without an extra card, then normal endTurn. This permitted zero-bonus path fits the rule. The report does not infer exhaustive saved-eligibility correctness from this path. No finding.

3. **Siege, step 11 — cards.md “Siege”, rules.md §6 “Swap”, catalog afterMove timing.** Expected: Black's Knight b8 and Rook h8 exchange squares without capture, ownership change, or a further ordinary move. Observed: same physical black-knight-b8 on h8 and black-rook-h8 on b8; no other piece changes, same clocks, Black still afterMove; one Siege discarded and peace-talks drawn, then endTurn. No finding in these reviewed properties; subsequent castling was not exercised.

4. **Tournament, step 35 — cards.md “Tournament”, rules.md §6 “Swap” and §8.2.** Expected: Black's Knight on h8 swaps with White's Knight on g1, preserving identities and owners, with no capture. Observed: black-knight-b8 goes h8→g1 while white-knight-g1 goes g1→h8; both remain their original owners and board pieces. Card consumes the move and Black's allowance, followed by endTurn. No finding.

5. **Forced March, step 39 — rules.md §13.6 and cards.md “Forced March”.** Expected: two distinct Black Pawns move sideways exactly one square, simultaneously, to initially empty distinct squares b7 and a5, without capture. Observed: black-pawn-a7 goes a7→b7, black-pawn-b7 goes b5→a5; both destinations were empty in the before FEN, no capture, no en-passant right, move consumed, fullmove 9→10. The Black king on e8 remains shielded and safe; this card causes no direct mate. No finding.

6. **Breakthrough, step 41 — cards.md “Breakthrough”, rules.md §§8.2, 8.4, 9.** Expected: White's f3 Pawn captures the opposing Queen immediately forward on f4 and consumes the move. Observed: white-pawn-f2 goes f3→f4 and black-queen-d8 becomes captured with capturedBy=white; no other piece changes, halfmove resets to zero, Black is the next FEN actor while White remains afterMove until step 42. White draws mystic-shield and discards Breakthrough exactly once. Black has safe continuations, including the observed e8–d8; White's king remains safe. No finding.

## Coverage and limits

One bounded random group, six independently reviewed card transitions, 48 accepted actions, 8 scaffold probes, zero confirmed findings. Ordinary legal-move/FEN and structural checks are performed by the existing generator; digest values alone do not establish card semantics. Final state is White beforeMove after a clean endTurn, with no pending rescue in recorded evidence. This finite path is not proof of correctness. Random generation stayed well within 15 seconds and 80 actions. Overall reading/report preparation exceeded the nominal 45-second assignment target; that process timing overrun is not an engine finding. No universal protocol-compliance claim.

Final FEN: `rrbk1b1N/1ppp1p1p/4p3/p5P1/3PPP2/1PP1n3/P2Q1KP1/RNB2BnR w - - 1 12`

## Exact options, sampled cards, and complete accepted action trace

```json
{
  "seed": 908085,
  "maxMoves": 20,
  "digestVersion": 2,
  "initial": {
    "hands": {
      "white": [
        "think-again",
        "hostage",
        "plots-within-plots",
        "haunting-memories",
        "breakthrough"
      ],
      "black": [
        "tournament",
        "dark-mirror",
        "siege",
        "forced-march",
        "assassin"
      ]
    },
    "decks": {
      "white": [
        "heresy",
        "holy-quest",
        "mystic-shield",
        "merciless",
        "abduction",
        "evangelists",
        "split-knight",
        "holy-war",
        "chaos",
        "cowardice",
        "legacy",
        "panic",
        "winged-victory",
        "crusade",
        "forbidden-city",
        "cathedral",
        "challenge",
        "resurrection",
        "under-elf-hill",
        "assassin",
        "coup",
        "betrayal",
        "bog",
        "no-quarter",
        "vulture",
        "crab",
        "guardian",
        "knightmare",
        "squaring-the-circle",
        "doomsayer",
        "man-of-straw",
        "neutrality",
        "earthquake",
        "bombard",
        "pacifism",
        "forced-march",
        "onslaught",
        "fog-of-war",
        "doppelganger",
        "fatal-attraction",
        "rebirth",
        "peace-talks",
        "siege",
        "charge",
        "madman",
        "blessing",
        "fanatic",
        "truce",
        "man-trap",
        "lost-castle",
        "fortification",
        "hidden-passage",
        "toll",
        "figure-dance",
        "masquerade",
        "riposte",
        "long-jump",
        "curse",
        "treason",
        "irresistible-force",
        "confabulation",
        "passing-in-the-night",
        "vendetta",
        "ghostwalk",
        "annexation",
        "revenge",
        "dubbing",
        "tournament",
        "sanctuary",
        "dungeon",
        "evil-eye",
        "anathema",
        "fireball",
        "disintegration",
        "dark-mirror"
      ],
      "black": [
        "peace-talks",
        "masquerade",
        "fatal-attraction",
        "neutrality",
        "curse",
        "cathedral",
        "betrayal",
        "winged-victory",
        "holy-quest",
        "fireball",
        "lost-castle",
        "heresy",
        "coup",
        "think-again",
        "toll",
        "charge",
        "long-jump",
        "sanctuary",
        "abduction",
        "anathema",
        "hidden-passage",
        "vendetta",
        "blessing",
        "irresistible-force",
        "ghostwalk",
        "dungeon",
        "dubbing",
        "figure-dance",
        "squaring-the-circle",
        "confabulation",
        "no-quarter",
        "legacy",
        "crusade",
        "knightmare",
        "onslaught",
        "riposte",
        "forbidden-city",
        "bog",
        "holy-war",
        "chaos",
        "passing-in-the-night",
        "vulture",
        "revenge",
        "merciless",
        "breakthrough",
        "rebirth",
        "fortification",
        "plots-within-plots",
        "resurrection",
        "panic",
        "crab",
        "pacifism",
        "haunting-memories",
        "under-elf-hill",
        "doppelganger",
        "guardian",
        "fanatic",
        "bombard",
        "evangelists",
        "mystic-shield",
        "annexation",
        "split-knight",
        "man-of-straw",
        "fog-of-war",
        "man-trap",
        "treason",
        "disintegration",
        "madman",
        "cowardice",
        "truce",
        "evil-eye",
        "earthquake",
        "challenge",
        "doomsayer",
        "hostage"
      ]
    }
  },
  "steps": [
    {
      "action": {
        "type": "move",
        "from": "d2",
        "to": "d3"
      },
      "expected": "cfd92b6be57344990fb61ba217d8c4ae5279145d7600afc2137f110ba6cbb69c"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "d753edd84020241da934ebfdf48770ad13952bfec3f33b871f710f7582e991b3"
    },
    {
      "action": {
        "type": "move",
        "from": "d7",
        "to": "d5"
      },
      "expected": "8b952766e99c7e3e8aff456560f187fc4be6cd1979ecd2ee3eabb775fd121b6d"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "think-again",
        "cardInstanceId": "white-hand-0-think-again"
      },
      "expected": "ccfcebb0347eec166277481560693a2b1b2ee6d647dd83e64aa0baa2f9c1bde9"
    },
    {
      "action": {
        "type": "move",
        "from": "b7",
        "to": "b5"
      },
      "expected": "2952810b0646bfa649996458577b06d396177cee1342d2d26ebb7688dc587b93"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "41ce1758c977818a8a7dfe7842d3ae96e904db58f20d12d530c2bf9dbc5a4a50"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "plots-within-plots",
        "cardInstanceId": "white-hand-2-plots-within-plots",
        "target": {
          "player": "white"
        }
      },
      "expected": "d5b764349570fbce7f694bb3fa0221c80cc6457fa2e2d257b004c18ba8dcdf4d"
    },
    {
      "action": {
        "type": "move",
        "from": "f2",
        "to": "f3"
      },
      "expected": "a16af81c0f7dff399dcdd4f2d9e616d4586fca1124bd1965672f9180504ebb2e"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "a9fc6d7aeb039acaa3ed0fe83caf9212893faf81cd75078a0f25740f42a8b094"
    },
    {
      "action": {
        "type": "move",
        "from": "e7",
        "to": "e6"
      },
      "expected": "7cd8891717958e6b2daf49e6f06e2fbae5daf76fc2f62c6ab70afccbc59e6e1e"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "siege",
        "cardInstanceId": "black-hand-2-siege",
        "target": {
          "knight": "b8",
          "rook": "h8"
        }
      },
      "expected": "1d1c273986249b2b379efa0fc7670d792a52427476d20e62699758136041091f"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "89c00d73359bf58f4bee6b88c4498151f5e3bd89b0a2e3303dc5e23724e7fa2c"
    },
    {
      "action": {
        "type": "move",
        "from": "c2",
        "to": "c3"
      },
      "expected": "57c66e4f7efde5966df67b0cc18cddc2c5fe731ab4ee9826a1d970d3d1e4a4ac"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "f72af92176063b75b52924e910fae188209a7c8b862591a8800d38a33548b7a9"
    },
    {
      "action": {
        "type": "move",
        "from": "d8",
        "to": "f6"
      },
      "expected": "1c6b5e45c82704aa6e13e9df2a320a2e449daf353a0c7e08267407b273ee136b"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "08272cff1eb8cb45437a3438178ff37077563e845d4f6973c8f4ddbebe133e67"
    },
    {
      "action": {
        "type": "move",
        "from": "h2",
        "to": "h4"
      },
      "expected": "e8951f5b875797a8ef1304f71b1b7f65e4f88eb482cd862d47bbbfa3e6323ee8"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "b3f5ca03b717feae5d0542b5c931a4b94ae364e8bc2ded56c35531ed0c3b4776"
    },
    {
      "action": {
        "type": "move",
        "from": "g7",
        "to": "g5"
      },
      "expected": "f6d880dfdca076f1793b77b980c7297c8964ff7664396f05bb452922a39d69aa"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "ed319ef57e9d765322c2971f9687225f46fedadb6240e23e583cf411316f4810"
    },
    {
      "action": {
        "type": "move",
        "from": "d1",
        "to": "d2"
      },
      "expected": "975d1896859bf51c27c14d8046cfb15422862a89cf0d13dd45a94925b01efcc9"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "0d76d7c4b57642b9ce2dfe377d7a7c7dad6e2bb0a09e67d5c17c0e354abaf285"
    },
    {
      "action": {
        "type": "move",
        "from": "g8",
        "to": "e7"
      },
      "expected": "62c9941597c37dc40bc61ab121e401883fc65bef7b8c3025327b73b1a40a9b65"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "b8b642e7fc8954540a17952c7c70974b57afbbd82638523b2c443e9c324d6278"
    },
    {
      "action": {
        "type": "move",
        "from": "e2",
        "to": "e4"
      },
      "expected": "9ab3e79cdc6fe7b11e6b4affcd53fb88c44415e9141bcafc30b812c312c74dd7"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "e5a9eb3b24810323eb7b8008ae29866668f428478996bfef4f093c7a5a3d7d59"
    },
    {
      "action": {
        "type": "move",
        "from": "f6",
        "to": "f4"
      },
      "expected": "9be8c402c13f0b477a842e7bdc4288029edbc0987eac5ba91a3aa3d645499580"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "38d451831454541f35c0cd55f51baaeb0c6b43c3fe4ee25e5a03467518891196"
    },
    {
      "action": {
        "type": "move",
        "from": "e1",
        "to": "f2"
      },
      "expected": "cdb6ff5e7d9160075e1f0a8f05863ba0e816a106ec9125425f68f8435f9c845e"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "10e96ccb1645bff4f83bec407ef0949521c16e2dc6ed7adf03b81189fd58e717"
    },
    {
      "action": {
        "type": "move",
        "from": "e7",
        "to": "d5"
      },
      "expected": "b43dad9cda3c6e36f7a7162e8b1596da5a1857200161a667a7100e5614a1c4dc"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "0aaa09ac075941902218d7c0d90e8e45d2ff05c9f6570f151f7de62d2ad1e119"
    },
    {
      "action": {
        "type": "move",
        "from": "h4",
        "to": "g5"
      },
      "expected": "0caa7e0b50b6a80ee270a7d5b088a7898061599bcbdc99c7a5aa8ba66592287c"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "cbddc367651bc454e01add82861a863f3a8220b4bcf22ddf5f522e82add659c4"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "tournament",
        "cardInstanceId": "black-hand-0-tournament",
        "target": {
          "own": "h8",
          "opponent": "g1"
        }
      },
      "expected": "5fb90cf0589c3172a4e9e36889e44cc0aff441ba1ed3eed9bab2ab957f45c6a5"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "305f3a139694d66dc02f9380acc82fa71453fa5582b2b684252b4418e10c3703"
    },
    {
      "action": {
        "type": "move",
        "from": "d3",
        "to": "d4"
      },
      "expected": "224d363706741046644089012d6347df3948bf5df481bd1438c078ad743e4a7d"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "2d77e356142ccd0d429bd02ef5eaa5e8c7dcd3019dcbc79dde80ed96a0211037"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "forced-march",
        "cardInstanceId": "black-hand-3-forced-march",
        "target": [
          {
            "from": "a7",
            "to": "b7"
          },
          {
            "from": "b5",
            "to": "a5"
          }
        ]
      },
      "expected": "c141dd424bccad3592560fa3e8e4fe29ae466569b726e5c38e23b9e841e7a4f6"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "a5e4ecdacbb734c15e21a08c72bcb745401cdfce236f0b397c6acbc263f0d7eb"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "breakthrough",
        "cardInstanceId": "white-hand-4-breakthrough",
        "target": [
          {
            "from": "f3",
            "to": "f4"
          }
        ]
      },
      "expected": "bdedd470f33f86403c57900821204939508d25ff00db2fb6fe86fceb4080540e"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "173e083ce19652b9129bbcc6c6df17c950d549c5a319f83a5f681475aaf09736"
    },
    {
      "action": {
        "type": "move",
        "from": "e8",
        "to": "d8"
      },
      "expected": "e51955df150892d7fccd8fda6c35fb6c2f4dd62292ea8a8f125663d36ddef06c"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "430270a995a306f85ca913936898770a9507d90ecc19680de6be4e048d16109e"
    },
    {
      "action": {
        "type": "move",
        "from": "b2",
        "to": "b3"
      },
      "expected": "1c6b725181a4720174a0710699162655a946abc6d37ae3e71ed147922978ffa0"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "193916dc28aef33d8586e428689a830e133a641a43ef65c89c4c13b87e546852"
    },
    {
      "action": {
        "type": "move",
        "from": "d5",
        "to": "e3"
      },
      "expected": "edcc473551e60726ca959f309fa6f5a513184c0f4d98114c8d779d002aa67d36"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "23f26ff08ae54da4855488221e1585486bc5887542f69a7bed571ffb29c8e23e"
    }
  ],
  "moves": 20,
  "finalFen": "rrbk1b1N/1ppp1p1p/4p3/p5P1/3PPP2/1PP1n3/P2Q1KP1/RNB2BnR w - - 1 12",
  "sampledCards": {
    "hostage": 4,
    "forced-march": 3,
    "think-again": 1,
    "plots-within-plots": 1,
    "tournament": 2,
    "breakthrough": 3,
    "haunting-memories": 2,
    "siege": 1,
    "dark-mirror": 4,
    "holy-quest": 2,
    "peace-talks": 1,
    "heresy": 3,
    "assassin": 1,
    "masquerade": 2
  }
}
```

## Complete transition evidence

```jsonl
Seed 908085; standard starting board; shuffled catalog house-variant decks (rules §4.3).
Each row must be independently reviewed against rules.md/cards.md; hashes alone are not an oracle.
{"step":1,"move":1,"action":{"type":"move","from":"d2","to":"d3"},"fen":["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","rnbqkbnr/pppppppp/8/8/8/3P4/PPP1PPPP/RNBQKBNR b KQkq - 0 1"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-d2","owner":"white","role":"pawn","originalRole":"pawn","square":"d2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-d2","owner":"white","role":"pawn","originalRole":"pawn","square":"d3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"d2","to":"d3"}],"hands":[{"color":"white","before":["think-again","hostage","plots-within-plots","haunting-memories","breakthrough"],"after":["think-again","hostage","plots-within-plots","haunting-memories","breakthrough"],"decks":[75,75],"discard":[]},{"color":"black","before":["tournament","dark-mirror","siege","forced-march","assassin"],"after":["tournament","dark-mirror","siege","forced-march","assassin"],"decks":[75,75],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":2,"move":1,"action":{"type":"endTurn"},"fen":["rnbqkbnr/pppppppp/8/8/8/3P4/PPP1PPPP/RNBQKBNR b KQkq - 0 1","rnbqkbnr/pppppppp/8/8/8/3P4/PPP1PPPP/RNBQKBNR b KQkq - 0 1"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"d2","to":"d3"}],"hands":[{"color":"white","before":["think-again","hostage","plots-within-plots","haunting-memories","breakthrough"],"after":["think-again","hostage","plots-within-plots","haunting-memories","breakthrough"],"decks":[75,75],"discard":[]},{"color":"black","before":["tournament","dark-mirror","siege","forced-march","assassin"],"after":["tournament","dark-mirror","siege","forced-march","assassin"],"decks":[75,75],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":3,"move":2,"action":{"type":"move","from":"d7","to":"d5"},"fen":["rnbqkbnr/pppppppp/8/8/8/3P4/PPP1PPPP/RNBQKBNR b KQkq - 0 1","rnbqkbnr/ppp1pppp/8/3p4/8/3P4/PPP1PPPP/RNBQKBNR w KQkq - 0 2"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-pawn-d7","owner":"black","role":"pawn","originalRole":"pawn","square":"d7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-d7","owner":"black","role":"pawn","originalRole":"pawn","square":"d5","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"d7","to":"d5"}],"hands":[{"color":"white","before":["think-again","hostage","plots-within-plots","haunting-memories","breakthrough"],"after":["think-again","hostage","plots-within-plots","haunting-memories","breakthrough"],"decks":[75,75],"discard":[]},{"color":"black","before":["tournament","dark-mirror","siege","forced-march","assassin"],"after":["tournament","dark-mirror","siege","forced-march","assassin"],"decks":[75,75],"discard":[]}],"enPassant":[{"target":"d6","pawnId":"black-pawn-d7"}],"pendingRescue":false}
{"step":4,"move":2,"action":{"type":"playCard","cardId":"think-again","cardInstanceId":"white-hand-0-think-again"},"fen":["rnbqkbnr/ppp1pppp/8/3p4/8/3P4/PPP1PPPP/RNBQKBNR w KQkq - 0 2","rnbqkbnr/pppppppp/8/8/8/3P4/PPP1PPPP/RNBQKBNR b KQkq - 0 1"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":1,"black":0}}],"pieces":[{"before":{"id":"black-pawn-d7","owner":"black","role":"pawn","originalRole":"pawn","square":"d5","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-d7","owner":"black","role":"pawn","originalRole":"pawn","square":"d7","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"think-again","player":"white","movement":[{"from":"d5","to":"d7"}],"preservePreviousMove":true}],"hands":[{"color":"white","before":["think-again","hostage","plots-within-plots","haunting-memories","breakthrough"],"after":["hostage","plots-within-plots","haunting-memories","breakthrough","heresy"],"decks":[75,74],"discard":["think-again"]},{"color":"black","before":["tournament","dark-mirror","siege","forced-march","assassin"],"after":["tournament","dark-mirror","siege","forced-march","assassin"],"decks":[75,75],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":5,"move":3,"action":{"type":"move","from":"b7","to":"b5"},"fen":["rnbqkbnr/pppppppp/8/8/8/3P4/PPP1PPPP/RNBQKBNR b KQkq - 0 1","rnbqkbnr/p1pppppp/8/1p6/8/3P4/PPP1PPPP/RNBQKBNR w KQkq - 0 2"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":1,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":1,"black":0}}],"pieces":[{"before":{"id":"black-pawn-b7","owner":"black","role":"pawn","originalRole":"pawn","square":"b7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-b7","owner":"black","role":"pawn","originalRole":"pawn","square":"b5","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"b7","to":"b5"}],"hands":[{"color":"white","before":["hostage","plots-within-plots","haunting-memories","breakthrough","heresy"],"after":["hostage","plots-within-plots","haunting-memories","breakthrough","heresy"],"decks":[74,74],"discard":["think-again"]},{"color":"black","before":["tournament","dark-mirror","siege","forced-march","assassin"],"after":["tournament","dark-mirror","siege","forced-march","assassin"],"decks":[75,75],"discard":[]}],"enPassant":[{"target":"b6","pawnId":"black-pawn-b7"}],"pendingRescue":false}
{"step":6,"move":3,"action":{"type":"endTurn"},"fen":["rnbqkbnr/p1pppppp/8/1p6/8/3P4/PPP1PPPP/RNBQKBNR w KQkq - 0 2","rnbqkbnr/p1pppppp/8/1p6/8/3P4/PPP1PPPP/RNBQKBNR w KQkq - 0 2"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":1,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"b7","to":"b5"}],"hands":[{"color":"white","before":["hostage","plots-within-plots","haunting-memories","breakthrough","heresy"],"after":["hostage","plots-within-plots","haunting-memories","breakthrough","heresy"],"decks":[74,74],"discard":["think-again"]},{"color":"black","before":["tournament","dark-mirror","siege","forced-march","assassin"],"after":["tournament","dark-mirror","siege","forced-march","assassin"],"decks":[75,75],"discard":[]}],"enPassant":[{"target":"b6","pawnId":"black-pawn-b7"}],"pendingRescue":false}
{"step":7,"move":3,"action":{"type":"playCard","cardId":"plots-within-plots","cardInstanceId":"white-hand-2-plots-within-plots","target":{"player":"white"}},"fen":["rnbqkbnr/p1pppppp/8/1p6/8/3P4/PPP1PPPP/RNBQKBNR w KQkq - 0 2","rnbqkbnr/p1pppppp/8/1p6/8/3P4/PPP1PPPP/RNBQKBNR w KQkq - 0 2"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":1,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"plots-within-plots","player":"white","preservePreviousMove":true,"movement":[]}],"hands":[{"color":"white","before":["hostage","plots-within-plots","haunting-memories","breakthrough","heresy"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[74,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","siege","forced-march","assassin"],"after":["tournament","dark-mirror","siege","forced-march","assassin"],"decks":[75,75],"discard":[]}],"enPassant":[{"target":"b6","pawnId":"black-pawn-b7"}],"pendingRescue":false}
{"step":8,"move":4,"action":{"type":"move","from":"f2","to":"f3"},"fen":["rnbqkbnr/p1pppppp/8/1p6/8/3P4/PPP1PPPP/RNBQKBNR w KQkq - 0 2","rnbqkbnr/p1pppppp/8/1p6/8/3P1P2/PPP1P1PP/RNBQKBNR b KQkq - 0 2"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":1,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":1,"black":0}}],"pieces":[{"before":{"id":"white-pawn-f2","owner":"white","role":"pawn","originalRole":"pawn","square":"f2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-f2","owner":"white","role":"pawn","originalRole":"pawn","square":"f3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"f2","to":"f3"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","siege","forced-march","assassin"],"after":["tournament","dark-mirror","siege","forced-march","assassin"],"decks":[75,75],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":9,"move":4,"action":{"type":"endTurn"},"fen":["rnbqkbnr/p1pppppp/8/1p6/8/3P1P2/PPP1P1PP/RNBQKBNR b KQkq - 0 2","rnbqkbnr/p1pppppp/8/1p6/8/3P1P2/PPP1P1PP/RNBQKBNR b KQkq - 0 2"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":1,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"f2","to":"f3"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","siege","forced-march","assassin"],"after":["tournament","dark-mirror","siege","forced-march","assassin"],"decks":[75,75],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":10,"move":5,"action":{"type":"move","from":"e7","to":"e6"},"fen":["rnbqkbnr/p1pppppp/8/1p6/8/3P1P2/PPP1P1PP/RNBQKBNR b KQkq - 0 2","rnbqkbnr/p1pp1ppp/4p3/1p6/8/3P1P2/PPP1P1PP/RNBQKBNR w KQkq - 0 3"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-pawn-e7","owner":"black","role":"pawn","originalRole":"pawn","square":"e7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-e7","owner":"black","role":"pawn","originalRole":"pawn","square":"e6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"e7","to":"e6"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","siege","forced-march","assassin"],"after":["tournament","dark-mirror","siege","forced-march","assassin"],"decks":[75,75],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":11,"move":5,"action":{"type":"playCard","cardId":"siege","cardInstanceId":"black-hand-2-siege","target":{"knight":"b8","rook":"h8"}},"fen":["rnbqkbnr/p1pp1ppp/4p3/1p6/8/3P1P2/PPP1P1PP/RNBQKBNR w KQkq - 0 3","rrbqkbnn/p1pp1ppp/4p3/1p6/8/3P1P2/PPP1P1PP/RNBQKBNR w KQhq - 0 3"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}}],"pieces":[{"before":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":"b8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":"h8","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"black-rook-h8","owner":"black","role":"rook","originalRole":"rook","square":"h8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-rook-h8","owner":"black","role":"rook","originalRole":"rook","square":"b8","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"siege","target":{"knight":"b8","rook":"h8"},"movement":[{"from":"b8","to":"h8"},{"from":"h8","to":"b8"}],"preservePreviousMove":true}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","siege","forced-march","assassin"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[75,74],"discard":["siege"]}],"enPassant":[],"pendingRescue":false}
{"step":12,"move":5,"action":{"type":"endTurn"},"fen":["rrbqkbnn/p1pp1ppp/4p3/1p6/8/3P1P2/PPP1P1PP/RNBQKBNR w KQhq - 0 3","rrbqkbnn/p1pp1ppp/4p3/1p6/8/3P1P2/PPP1P1PP/RNBQKBNR w KQhq - 0 3"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"siege","target":{"knight":"b8","rook":"h8"},"movement":[{"from":"b8","to":"h8"},{"from":"h8","to":"b8"}],"preservePreviousMove":true}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[],"pendingRescue":false}
{"step":13,"move":6,"action":{"type":"move","from":"c2","to":"c3"},"fen":["rrbqkbnn/p1pp1ppp/4p3/1p6/8/3P1P2/PPP1P1PP/RNBQKBNR w KQhq - 0 3","rrbqkbnn/p1pp1ppp/4p3/1p6/8/2PP1P2/PP2P1PP/RNBQKBNR b KQhq - 0 3"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-c2","owner":"white","role":"pawn","originalRole":"pawn","square":"c2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-c2","owner":"white","role":"pawn","originalRole":"pawn","square":"c3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"c2","to":"c3"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[],"pendingRescue":false}
{"step":14,"move":6,"action":{"type":"endTurn"},"fen":["rrbqkbnn/p1pp1ppp/4p3/1p6/8/2PP1P2/PP2P1PP/RNBQKBNR b KQhq - 0 3","rrbqkbnn/p1pp1ppp/4p3/1p6/8/2PP1P2/PP2P1PP/RNBQKBNR b KQhq - 0 3"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"c2","to":"c3"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[],"pendingRescue":false}
{"step":15,"move":7,"action":{"type":"move","from":"d8","to":"f6"},"fen":["rrbqkbnn/p1pp1ppp/4p3/1p6/8/2PP1P2/PP2P1PP/RNBQKBNR b KQhq - 0 3","rrb1kbnn/p1pp1ppp/4pq2/1p6/8/2PP1P2/PP2P1PP/RNBQKBNR w KQhq - 1 4"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-queen-d8","owner":"black","role":"queen","originalRole":"queen","square":"d8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-queen-d8","owner":"black","role":"queen","originalRole":"queen","square":"f6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"d8","to":"f6"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[],"pendingRescue":false}
{"step":16,"move":7,"action":{"type":"endTurn"},"fen":["rrb1kbnn/p1pp1ppp/4pq2/1p6/8/2PP1P2/PP2P1PP/RNBQKBNR w KQhq - 1 4","rrb1kbnn/p1pp1ppp/4pq2/1p6/8/2PP1P2/PP2P1PP/RNBQKBNR w KQhq - 1 4"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"d8","to":"f6"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[],"pendingRescue":false}
{"step":17,"move":8,"action":{"type":"move","from":"h2","to":"h4"},"fen":["rrb1kbnn/p1pp1ppp/4pq2/1p6/8/2PP1P2/PP2P1PP/RNBQKBNR w KQhq - 1 4","rrb1kbnn/p1pp1ppp/4pq2/1p6/7P/2PP1P2/PP2P1P1/RNBQKBNR b KQhq - 0 4"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-h2","owner":"white","role":"pawn","originalRole":"pawn","square":"h2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-h2","owner":"white","role":"pawn","originalRole":"pawn","square":"h4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"h2","to":"h4"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[{"target":"h3","pawnId":"white-pawn-h2"}],"pendingRescue":false}
{"step":18,"move":8,"action":{"type":"endTurn"},"fen":["rrb1kbnn/p1pp1ppp/4pq2/1p6/7P/2PP1P2/PP2P1P1/RNBQKBNR b KQhq - 0 4","rrb1kbnn/p1pp1ppp/4pq2/1p6/7P/2PP1P2/PP2P1P1/RNBQKBNR b KQhq - 0 4"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"h2","to":"h4"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[{"target":"h3","pawnId":"white-pawn-h2"}],"pendingRescue":false}
{"step":19,"move":9,"action":{"type":"move","from":"g7","to":"g5"},"fen":["rrb1kbnn/p1pp1ppp/4pq2/1p6/7P/2PP1P2/PP2P1P1/RNBQKBNR b KQhq - 0 4","rrb1kbnn/p1pp1p1p/4pq2/1p4p1/7P/2PP1P2/PP2P1P1/RNBQKBNR w KQhq - 0 5"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-pawn-g7","owner":"black","role":"pawn","originalRole":"pawn","square":"g7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-g7","owner":"black","role":"pawn","originalRole":"pawn","square":"g5","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"g7","to":"g5"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[{"target":"g6","pawnId":"black-pawn-g7"}],"pendingRescue":false}
{"step":20,"move":9,"action":{"type":"endTurn"},"fen":["rrb1kbnn/p1pp1p1p/4pq2/1p4p1/7P/2PP1P2/PP2P1P1/RNBQKBNR w KQhq - 0 5","rrb1kbnn/p1pp1p1p/4pq2/1p4p1/7P/2PP1P2/PP2P1P1/RNBQKBNR w KQhq - 0 5"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"g7","to":"g5"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[{"target":"g6","pawnId":"black-pawn-g7"}],"pendingRescue":false}
{"step":21,"move":10,"action":{"type":"move","from":"d1","to":"d2"},"fen":["rrb1kbnn/p1pp1p1p/4pq2/1p4p1/7P/2PP1P2/PP2P1P1/RNBQKBNR w KQhq - 0 5","rrb1kbnn/p1pp1p1p/4pq2/1p4p1/7P/2PP1P2/PP1QP1P1/RNB1KBNR b KQhq - 1 5"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-queen-d1","owner":"white","role":"queen","originalRole":"queen","square":"d1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-queen-d1","owner":"white","role":"queen","originalRole":"queen","square":"d2","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"d1","to":"d2"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[],"pendingRescue":false}
{"step":22,"move":10,"action":{"type":"endTurn"},"fen":["rrb1kbnn/p1pp1p1p/4pq2/1p4p1/7P/2PP1P2/PP1QP1P1/RNB1KBNR b KQhq - 1 5","rrb1kbnn/p1pp1p1p/4pq2/1p4p1/7P/2PP1P2/PP1QP1P1/RNB1KBNR b KQhq - 1 5"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"d1","to":"d2"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[],"pendingRescue":false}
{"step":23,"move":11,"action":{"type":"move","from":"g8","to":"e7"},"fen":["rrb1kbnn/p1pp1p1p/4pq2/1p4p1/7P/2PP1P2/PP1QP1P1/RNB1KBNR b KQhq - 1 5","rrb1kb1n/p1ppnp1p/4pq2/1p4p1/7P/2PP1P2/PP1QP1P1/RNB1KBNR w KQhq - 2 6"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-knight-g8","owner":"black","role":"knight","originalRole":"knight","square":"g8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-knight-g8","owner":"black","role":"knight","originalRole":"knight","square":"e7","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"g8","to":"e7"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[],"pendingRescue":false}
{"step":24,"move":11,"action":{"type":"endTurn"},"fen":["rrb1kb1n/p1ppnp1p/4pq2/1p4p1/7P/2PP1P2/PP1QP1P1/RNB1KBNR w KQhq - 2 6","rrb1kb1n/p1ppnp1p/4pq2/1p4p1/7P/2PP1P2/PP1QP1P1/RNB1KBNR w KQhq - 2 6"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"g8","to":"e7"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[],"pendingRescue":false}
{"step":25,"move":12,"action":{"type":"move","from":"e2","to":"e4"},"fen":["rrb1kb1n/p1ppnp1p/4pq2/1p4p1/7P/2PP1P2/PP1QP1P1/RNB1KBNR w KQhq - 2 6","rrb1kb1n/p1ppnp1p/4pq2/1p4p1/4P2P/2PP1P2/PP1Q2P1/RNB1KBNR b KQhq - 0 6"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-e2","owner":"white","role":"pawn","originalRole":"pawn","square":"e2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-e2","owner":"white","role":"pawn","originalRole":"pawn","square":"e4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"e2","to":"e4"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[{"target":"e3","pawnId":"white-pawn-e2"}],"pendingRescue":false}
{"step":26,"move":12,"action":{"type":"endTurn"},"fen":["rrb1kb1n/p1ppnp1p/4pq2/1p4p1/4P2P/2PP1P2/PP1Q2P1/RNB1KBNR b KQhq - 0 6","rrb1kb1n/p1ppnp1p/4pq2/1p4p1/4P2P/2PP1P2/PP1Q2P1/RNB1KBNR b KQhq - 0 6"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"e2","to":"e4"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[{"target":"e3","pawnId":"white-pawn-e2"}],"pendingRescue":false}
{"step":27,"move":13,"action":{"type":"move","from":"f6","to":"f4"},"fen":["rrb1kb1n/p1ppnp1p/4pq2/1p4p1/4P2P/2PP1P2/PP1Q2P1/RNB1KBNR b KQhq - 0 6","rrb1kb1n/p1ppnp1p/4p3/1p4p1/4Pq1P/2PP1P2/PP1Q2P1/RNB1KBNR w KQhq - 1 7"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-queen-d8","owner":"black","role":"queen","originalRole":"queen","square":"f6","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-queen-d8","owner":"black","role":"queen","originalRole":"queen","square":"f4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"f6","to":"f4"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[],"pendingRescue":false}
{"step":28,"move":13,"action":{"type":"endTurn"},"fen":["rrb1kb1n/p1ppnp1p/4p3/1p4p1/4Pq1P/2PP1P2/PP1Q2P1/RNB1KBNR w KQhq - 1 7","rrb1kb1n/p1ppnp1p/4p3/1p4p1/4Pq1P/2PP1P2/PP1Q2P1/RNB1KBNR w KQhq - 1 7"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"f6","to":"f4"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[],"pendingRescue":false}
{"step":29,"move":14,"action":{"type":"move","from":"e1","to":"f2"},"fen":["rrb1kb1n/p1ppnp1p/4p3/1p4p1/4Pq1P/2PP1P2/PP1Q2P1/RNB1KBNR w KQhq - 1 7","rrb1kb1n/p1ppnp1p/4p3/1p4p1/4Pq1P/2PP1P2/PP1Q1KP1/RNB2BNR b hq - 2 7"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-king-e1","owner":"white","role":"king","originalRole":"king","square":"e1","zone":"board","promoted":false,"royal":true,"neutral":false},"after":{"id":"white-king-e1","owner":"white","role":"king","originalRole":"king","square":"f2","zone":"board","promoted":false,"royal":true,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"e1","to":"f2"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[],"pendingRescue":false}
{"step":30,"move":14,"action":{"type":"endTurn"},"fen":["rrb1kb1n/p1ppnp1p/4p3/1p4p1/4Pq1P/2PP1P2/PP1Q1KP1/RNB2BNR b hq - 2 7","rrb1kb1n/p1ppnp1p/4p3/1p4p1/4Pq1P/2PP1P2/PP1Q1KP1/RNB2BNR b hq - 2 7"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"e1","to":"f2"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[],"pendingRescue":false}
{"step":31,"move":15,"action":{"type":"move","from":"e7","to":"d5"},"fen":["rrb1kb1n/p1ppnp1p/4p3/1p4p1/4Pq1P/2PP1P2/PP1Q1KP1/RNB2BNR b hq - 2 7","rrb1kb1n/p1pp1p1p/4p3/1p1n2p1/4Pq1P/2PP1P2/PP1Q1KP1/RNB2BNR w hq - 3 8"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-knight-g8","owner":"black","role":"knight","originalRole":"knight","square":"e7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-knight-g8","owner":"black","role":"knight","originalRole":"knight","square":"d5","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"e7","to":"d5"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[],"pendingRescue":false}
{"step":32,"move":15,"action":{"type":"endTurn"},"fen":["rrb1kb1n/p1pp1p1p/4p3/1p1n2p1/4Pq1P/2PP1P2/PP1Q1KP1/RNB2BNR w hq - 3 8","rrb1kb1n/p1pp1p1p/4p3/1p1n2p1/4Pq1P/2PP1P2/PP1Q1KP1/RNB2BNR w hq - 3 8"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"e7","to":"d5"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[],"pendingRescue":false}
{"step":33,"move":16,"action":{"type":"move","from":"h4","to":"g5"},"fen":["rrb1kb1n/p1pp1p1p/4p3/1p1n2p1/4Pq1P/2PP1P2/PP1Q1KP1/RNB2BNR w hq - 3 8","rrb1kb1n/p1pp1p1p/4p3/1p1n2P1/4Pq2/2PP1P2/PP1Q1KP1/RNB2BNR b hq - 0 8"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-h2","owner":"white","role":"pawn","originalRole":"pawn","square":"h4","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-h2","owner":"white","role":"pawn","originalRole":"pawn","square":"g5","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"black-pawn-g7","owner":"black","role":"pawn","originalRole":"pawn","square":"g5","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-g7","owner":"black","role":"pawn","originalRole":"pawn","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"white"}}],"effects":[[],[]],"events":[{"type":"move","from":"h4","to":"g5","capturedId":"black-pawn-g7"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[],"pendingRescue":false}
{"step":34,"move":16,"action":{"type":"endTurn"},"fen":["rrb1kb1n/p1pp1p1p/4p3/1p1n2P1/4Pq2/2PP1P2/PP1Q1KP1/RNB2BNR b hq - 0 8","rrb1kb1n/p1pp1p1p/4p3/1p1n2P1/4Pq2/2PP1P2/PP1Q1KP1/RNB2BNR b hq - 0 8"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"h4","to":"g5","capturedId":"black-pawn-g7"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"decks":[74,74],"discard":["siege"]}],"enPassant":[],"pendingRescue":false}
{"step":35,"move":16,"action":{"type":"playCard","cardId":"tournament","cardInstanceId":"black-hand-0-tournament","target":{"own":"h8","opponent":"g1"}},"fen":["rrb1kb1n/p1pp1p1p/4p3/1p1n2P1/4Pq2/2PP1P2/PP1Q1KP1/RNB2BNR b hq - 0 8","rrb1kb1N/p1pp1p1p/4p3/1p1n2P1/4Pq2/2PP1P2/PP1Q1KP1/RNB2BnR w hq - 1 9"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}}],"pieces":[{"before":{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"g1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"h8","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":"h8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":"g1","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"tournament","target":{"own":"h8","opponent":"g1"},"movement":[{"from":"g1","to":"h8"},{"from":"h8","to":"g1"}],"preservePreviousMove":false}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["tournament","dark-mirror","forced-march","assassin","peace-talks"],"after":["dark-mirror","forced-march","assassin","peace-talks","masquerade"],"decks":[74,73],"discard":["siege","tournament"]}],"enPassant":[],"pendingRescue":false}
{"step":36,"move":16,"action":{"type":"endTurn"},"fen":["rrb1kb1N/p1pp1p1p/4p3/1p1n2P1/4Pq2/2PP1P2/PP1Q1KP1/RNB2BnR w hq - 1 9","rrb1kb1N/p1pp1p1p/4p3/1p1n2P1/4Pq2/2PP1P2/PP1Q1KP1/RNB2BnR w hq - 1 9"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"tournament","target":{"own":"h8","opponent":"g1"},"movement":[{"from":"g1","to":"h8"},{"from":"h8","to":"g1"}],"preservePreviousMove":false}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["dark-mirror","forced-march","assassin","peace-talks","masquerade"],"after":["dark-mirror","forced-march","assassin","peace-talks","masquerade"],"decks":[73,73],"discard":["siege","tournament"]}],"enPassant":[],"pendingRescue":false}
{"step":37,"move":17,"action":{"type":"move","from":"d3","to":"d4"},"fen":["rrb1kb1N/p1pp1p1p/4p3/1p1n2P1/4Pq2/2PP1P2/PP1Q1KP1/RNB2BnR w hq - 1 9","rrb1kb1N/p1pp1p1p/4p3/1p1n2P1/3PPq2/2P2P2/PP1Q1KP1/RNB2BnR b hq - 0 9"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-d2","owner":"white","role":"pawn","originalRole":"pawn","square":"d3","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-d2","owner":"white","role":"pawn","originalRole":"pawn","square":"d4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"d3","to":"d4"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["dark-mirror","forced-march","assassin","peace-talks","masquerade"],"after":["dark-mirror","forced-march","assassin","peace-talks","masquerade"],"decks":[73,73],"discard":["siege","tournament"]}],"enPassant":[],"pendingRescue":false}
{"step":38,"move":17,"action":{"type":"endTurn"},"fen":["rrb1kb1N/p1pp1p1p/4p3/1p1n2P1/3PPq2/2P2P2/PP1Q1KP1/RNB2BnR b hq - 0 9","rrb1kb1N/p1pp1p1p/4p3/1p1n2P1/3PPq2/2P2P2/PP1Q1KP1/RNB2BnR b hq - 0 9"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"d3","to":"d4"}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["dark-mirror","forced-march","assassin","peace-talks","masquerade"],"after":["dark-mirror","forced-march","assassin","peace-talks","masquerade"],"decks":[73,73],"discard":["siege","tournament"]}],"enPassant":[],"pendingRescue":false}
{"step":39,"move":17,"action":{"type":"playCard","cardId":"forced-march","cardInstanceId":"black-hand-3-forced-march","target":[{"from":"a7","to":"b7"},{"from":"b5","to":"a5"}]},"fen":["rrb1kb1N/p1pp1p1p/4p3/1p1n2P1/3PPq2/2P2P2/PP1Q1KP1/RNB2BnR b hq - 0 9","rrb1kb1N/1ppp1p1p/4p3/p2n2P1/3PPq2/2P2P2/PP1Q1KP1/RNB2BnR w hq - 0 10"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}}],"pieces":[{"before":{"id":"black-pawn-a7","owner":"black","role":"pawn","originalRole":"pawn","square":"a7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-a7","owner":"black","role":"pawn","originalRole":"pawn","square":"b7","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"black-pawn-b7","owner":"black","role":"pawn","originalRole":"pawn","square":"b5","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-b7","owner":"black","role":"pawn","originalRole":"pawn","square":"a5","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"forced-march","target":[{"from":"a7","to":"b7"},{"from":"b5","to":"a5"}],"movement":[{"from":"a7","to":"b7"},{"from":"b5","to":"a5"}],"preservePreviousMove":false}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["dark-mirror","forced-march","assassin","peace-talks","masquerade"],"after":["dark-mirror","assassin","peace-talks","masquerade","fatal-attraction"],"decks":[73,72],"discard":["siege","tournament","forced-march"]}],"enPassant":[],"pendingRescue":false}
{"step":40,"move":17,"action":{"type":"endTurn"},"fen":["rrb1kb1N/1ppp1p1p/4p3/p2n2P1/3PPq2/2P2P2/PP1Q1KP1/RNB2BnR w hq - 0 10","rrb1kb1N/1ppp1p1p/4p3/p2n2P1/3PPq2/2P2P2/PP1Q1KP1/RNB2BnR w hq - 0 10"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"forced-march","target":[{"from":"a7","to":"b7"},{"from":"b5","to":"a5"}],"movement":[{"from":"a7","to":"b7"},{"from":"b5","to":"a5"}],"preservePreviousMove":false}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"decks":[73,73],"discard":["think-again","plots-within-plots"]},{"color":"black","before":["dark-mirror","assassin","peace-talks","masquerade","fatal-attraction"],"after":["dark-mirror","assassin","peace-talks","masquerade","fatal-attraction"],"decks":[72,72],"discard":["siege","tournament","forced-march"]}],"enPassant":[],"pendingRescue":false}
{"step":41,"move":17,"action":{"type":"playCard","cardId":"breakthrough","cardInstanceId":"white-hand-4-breakthrough","target":[{"from":"f3","to":"f4"}]},"fen":["rrb1kb1N/1ppp1p1p/4p3/p2n2P1/3PPq2/2P2P2/PP1Q1KP1/RNB2BnR w hq - 0 10","rrb1kb1N/1ppp1p1p/4p3/p2n2P1/3PPP2/2P5/PP1Q1KP1/RNB2BnR b hq - 0 10"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":1,"black":0}}],"pieces":[{"before":{"id":"white-pawn-f2","owner":"white","role":"pawn","originalRole":"pawn","square":"f3","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-f2","owner":"white","role":"pawn","originalRole":"pawn","square":"f4","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"black-queen-d8","owner":"black","role":"queen","originalRole":"queen","square":"f4","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-queen-d8","owner":"black","role":"queen","originalRole":"queen","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"white"}}],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"breakthrough","target":[{"from":"f3","to":"f4"}],"capturedId":"black-queen-d8","movement":[{"from":"f3","to":"f4"}],"preservePreviousMove":false}],"hands":[{"color":"white","before":["hostage","haunting-memories","breakthrough","heresy","holy-quest"],"after":["hostage","haunting-memories","heresy","holy-quest","mystic-shield"],"decks":[73,72],"discard":["think-again","plots-within-plots","breakthrough"]},{"color":"black","before":["dark-mirror","assassin","peace-talks","masquerade","fatal-attraction"],"after":["dark-mirror","assassin","peace-talks","masquerade","fatal-attraction"],"decks":[72,72],"discard":["siege","tournament","forced-march"]}],"enPassant":[],"pendingRescue":false}
{"step":42,"move":17,"action":{"type":"endTurn"},"fen":["rrb1kb1N/1ppp1p1p/4p3/p2n2P1/3PPP2/2P5/PP1Q1KP1/RNB2BnR b hq - 0 10","rrb1kb1N/1ppp1p1p/4p3/p2n2P1/3PPP2/2P5/PP1Q1KP1/RNB2BnR b hq - 0 10"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":1,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"breakthrough","target":[{"from":"f3","to":"f4"}],"capturedId":"black-queen-d8","movement":[{"from":"f3","to":"f4"}],"preservePreviousMove":false}],"hands":[{"color":"white","before":["hostage","haunting-memories","heresy","holy-quest","mystic-shield"],"after":["hostage","haunting-memories","heresy","holy-quest","mystic-shield"],"decks":[72,72],"discard":["think-again","plots-within-plots","breakthrough"]},{"color":"black","before":["dark-mirror","assassin","peace-talks","masquerade","fatal-attraction"],"after":["dark-mirror","assassin","peace-talks","masquerade","fatal-attraction"],"decks":[72,72],"discard":["siege","tournament","forced-march"]}],"enPassant":[],"pendingRescue":false}
{"step":43,"move":18,"action":{"type":"move","from":"e8","to":"d8"},"fen":["rrb1kb1N/1ppp1p1p/4p3/p2n2P1/3PPP2/2P5/PP1Q1KP1/RNB2BnR b hq - 0 10","rrbk1b1N/1ppp1p1p/4p3/p2n2P1/3PPP2/2P5/PP1Q1KP1/RNB2BnR w - - 1 11"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-king-e8","owner":"black","role":"king","originalRole":"king","square":"e8","zone":"board","promoted":false,"royal":true,"neutral":false},"after":{"id":"black-king-e8","owner":"black","role":"king","originalRole":"king","square":"d8","zone":"board","promoted":false,"royal":true,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"e8","to":"d8"}],"hands":[{"color":"white","before":["hostage","haunting-memories","heresy","holy-quest","mystic-shield"],"after":["hostage","haunting-memories","heresy","holy-quest","mystic-shield"],"decks":[72,72],"discard":["think-again","plots-within-plots","breakthrough"]},{"color":"black","before":["dark-mirror","assassin","peace-talks","masquerade","fatal-attraction"],"after":["dark-mirror","assassin","peace-talks","masquerade","fatal-attraction"],"decks":[72,72],"discard":["siege","tournament","forced-march"]}],"enPassant":[],"pendingRescue":false}
{"step":44,"move":18,"action":{"type":"endTurn"},"fen":["rrbk1b1N/1ppp1p1p/4p3/p2n2P1/3PPP2/2P5/PP1Q1KP1/RNB2BnR w - - 1 11","rrbk1b1N/1ppp1p1p/4p3/p2n2P1/3PPP2/2P5/PP1Q1KP1/RNB2BnR w - - 1 11"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"e8","to":"d8"}],"hands":[{"color":"white","before":["hostage","haunting-memories","heresy","holy-quest","mystic-shield"],"after":["hostage","haunting-memories","heresy","holy-quest","mystic-shield"],"decks":[72,72],"discard":["think-again","plots-within-plots","breakthrough"]},{"color":"black","before":["dark-mirror","assassin","peace-talks","masquerade","fatal-attraction"],"after":["dark-mirror","assassin","peace-talks","masquerade","fatal-attraction"],"decks":[72,72],"discard":["siege","tournament","forced-march"]}],"enPassant":[],"pendingRescue":false}
{"step":45,"move":19,"action":{"type":"move","from":"b2","to":"b3"},"fen":["rrbk1b1N/1ppp1p1p/4p3/p2n2P1/3PPP2/2P5/PP1Q1KP1/RNB2BnR w - - 1 11","rrbk1b1N/1ppp1p1p/4p3/p2n2P1/3PPP2/1PP5/P2Q1KP1/RNB2BnR b - - 0 11"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-b2","owner":"white","role":"pawn","originalRole":"pawn","square":"b2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-b2","owner":"white","role":"pawn","originalRole":"pawn","square":"b3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"b2","to":"b3"}],"hands":[{"color":"white","before":["hostage","haunting-memories","heresy","holy-quest","mystic-shield"],"after":["hostage","haunting-memories","heresy","holy-quest","mystic-shield"],"decks":[72,72],"discard":["think-again","plots-within-plots","breakthrough"]},{"color":"black","before":["dark-mirror","assassin","peace-talks","masquerade","fatal-attraction"],"after":["dark-mirror","assassin","peace-talks","masquerade","fatal-attraction"],"decks":[72,72],"discard":["siege","tournament","forced-march"]}],"enPassant":[],"pendingRescue":false}
{"step":46,"move":19,"action":{"type":"endTurn"},"fen":["rrbk1b1N/1ppp1p1p/4p3/p2n2P1/3PPP2/1PP5/P2Q1KP1/RNB2BnR b - - 0 11","rrbk1b1N/1ppp1p1p/4p3/p2n2P1/3PPP2/1PP5/P2Q1KP1/RNB2BnR b - - 0 11"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"b2","to":"b3"}],"hands":[{"color":"white","before":["hostage","haunting-memories","heresy","holy-quest","mystic-shield"],"after":["hostage","haunting-memories","heresy","holy-quest","mystic-shield"],"decks":[72,72],"discard":["think-again","plots-within-plots","breakthrough"]},{"color":"black","before":["dark-mirror","assassin","peace-talks","masquerade","fatal-attraction"],"after":["dark-mirror","assassin","peace-talks","masquerade","fatal-attraction"],"decks":[72,72],"discard":["siege","tournament","forced-march"]}],"enPassant":[],"pendingRescue":false}
{"step":47,"move":20,"action":{"type":"move","from":"d5","to":"e3"},"fen":["rrbk1b1N/1ppp1p1p/4p3/p2n2P1/3PPP2/1PP5/P2Q1KP1/RNB2BnR b - - 0 11","rrbk1b1N/1ppp1p1p/4p3/p5P1/3PPP2/1PP1n3/P2Q1KP1/RNB2BnR w - - 1 12"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-knight-g8","owner":"black","role":"knight","originalRole":"knight","square":"d5","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-knight-g8","owner":"black","role":"knight","originalRole":"knight","square":"e3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"d5","to":"e3"}],"hands":[{"color":"white","before":["hostage","haunting-memories","heresy","holy-quest","mystic-shield"],"after":["hostage","haunting-memories","heresy","holy-quest","mystic-shield"],"decks":[72,72],"discard":["think-again","plots-within-plots","breakthrough"]},{"color":"black","before":["dark-mirror","assassin","peace-talks","masquerade","fatal-attraction"],"after":["dark-mirror","assassin","peace-talks","masquerade","fatal-attraction"],"decks":[72,72],"discard":["siege","tournament","forced-march"]}],"enPassant":[],"pendingRescue":false}
{"step":48,"move":20,"action":{"type":"endTurn"},"fen":["rrbk1b1N/1ppp1p1p/4p3/p5P1/3PPP2/1PP1n3/P2Q1KP1/RNB2BnR w - - 1 12","rrbk1b1N/1ppp1p1p/4p3/p5P1/3PPP2/1PP1n3/P2Q1KP1/RNB2BnR w - - 1 12"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"d5","to":"e3"}],"hands":[{"color":"white","before":["hostage","haunting-memories","heresy","holy-quest","mystic-shield"],"after":["hostage","haunting-memories","heresy","holy-quest","mystic-shield"],"decks":[72,72],"discard":["think-again","plots-within-plots","breakthrough"]},{"color":"black","before":["dark-mirror","assassin","peace-talks","masquerade","fatal-attraction"],"after":["dark-mirror","assassin","peace-talks","masquerade","fatal-attraction"],"decks":[72,72],"discard":["siege","tournament","forced-march"]}],"enPassant":[],"pendingRescue":false}
FINAL {"moves":20,"fen":"rrbk1b1N/1ppp1p1p/4p3/p5P1/3PPP2/1PP1n3/P2Q1KP1/RNB2BnR w - - 1 12"}
```

GAME_085_DONE
