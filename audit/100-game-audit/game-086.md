# Game 086 — seed 908086

## Pre-run invariants and hypothesis

This single seeded random game should preserve turn and phase coherence, legal board occupancy, and card consumption/replacement behavior required by the authoritative rules. Card transitions will be checked against their rule text after observation; these are pre-run hypotheses, not observed findings.

## Execution result

Baseline: `33e03989fab9449d87b857fc5673f67d05841928`. Exactly one `generateTrace(908086, 20, progress)` invocation; no replay, reset, or second game. Callback checks imposed 80 accepted-action / 15-second limits and checked structural invariants. Completed normally with **46 accepted actions, 20 Regular Move actions, 6 card plays, 0 reported failures**, in **2747.217 ms**. The helper counts accepted Regular Move actions including moves later canceled or taken back; this is not 20 retained board plies. Rejected candidate attempts are not exposed by this helper and are unknown, not zero. Both saved-fixture scaffold executions reported 4 probes / 0 findings; those fixtures created no game.

Sample coverage: 33 card samples across 14 distinct cards. Played Cathedral, Passing in the Night, Dubbing, Chaos, Forbidden City, and Siege (fizzled). White played no cards. Detailed sample counts and all exact initial hand/deck options appear below. Initial board is the standard starting position; no setup overrides were supplied.

Final FEN: `r1b2r1b/pP1kp1pp/1qnp2Q1/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 w Q - 6 11`.

## Independent post-run semantic review

These are post-run comparisons against authoritative prose and catalog timing, distinct from the pre-run invariants above. Digests were not treated as semantic proof.

1. **Cathedral, step 4** — cards.md “Cathedral”; rules.md §20 swap discussion; catalog afterMove timing. Expected the owned rook h8 and bishop f8 to exchange without capture, retaining the completed f7–f6 Regular Move. Observed bishop f8→h8 and rook h8→f8, no other piece changes, afterMove/moveMade retained, one Black card play, replacement Split Knight, and Cathedral discarded. Matches the exercised swap and accounting. No actual later castling test was performed.
2. **Passing in the Night, step 8** — cards.md named section; rules.md §20 explicit simultaneous Pawn exchange. Expected both selected opposite-owner pairs to exchange without changing ownership or capturing: b7↔g2 and f6↔h2. All four exact piece identities moved as expected, remained Pawns, and no capture occurred. Replacement move consumed; Black fullmove 2→3 and halfmove reset. Later step 31 g2→f1 captured White’s bishop and promoted the relocated Black Pawn to Bishop, consistent with rules §13.2 ordinary Pawn promotion.
3. **Dubbing, step 12** — cards.md “Dubbing” and rules.md §13.9. c7→b5 has Knight geometry (one file, two ranks) and empty destination. Expected one Black Pawn to relocate without capture or permanent transformation. Observed exactly that Pawn still role/originalRole pawn, no capture, completed replacement move, and one card expenditure. Matches.
4. **Chaos, steps 14–16** — cards.md “Chaos”; rules.md §17.1; catalog afterOpponentMove. Expected cancellation of White f6→f7 and a different White move while Black retains the spent reaction allowance. Observed the same White Pawn restored f7→f6, White beforeMove restored, Black cardPlays=1, followed by White queen d1→b3. Matches the observed rollback and changed continuation; replaying the forbidden move was not separately probed.
5. **Forbidden City, step 27 onward** — cards.md named section; catalog afterMove Continuing Effect. Expected an empty f5 marker without board movement or turn consumption beyond its card allowance. Observed identical before/after FEN, an active Black forbidden-city effect on f5, and afterMove retained. Every subsequent accepted move avoided f5. This checks placement/persistence, not rejection of a forbidden crossing.
6. **Siege attempted rescue, steps 43–45** — cards.md “Siege”; rules.md §11.6 and §20 Siege procedure. After Black bishop c8 captures b7, Black King e8 remains attacked by White queen g6 along f7–e8. The candidate swap Nh5↔Ra8 cannot cure that diagonal. Expected no completed unsafe turn. Observed SELF_CHECK fizzle, Siege spent/replaced, no Knight/Rook exchange, restoration of Bc8 and White Pb7 from the provisional capture, then a legal replacement King move e8→d7. King d7 is off the queen’s g6 diagonal. The safety outcome is consistent with the temporary-check rule. Qualification: §11.6 expressly discusses underlying-move rollback for canceled saving cards and pre-card restoration for after-move fizzles; it does not explicitly spell out this failed-rescue fizzle. Thus the broader rollback is a rule-interpretation limit, not a confirmed new defect from this run.

## Findings and limitations

No confirmed new engine defect. No duplicate of the prior confirmed audit findings was reproduced. Structural and applicable ordinary-chess checks passed throughout the finite run. The rescue rollback qualification above is retained for review.

The generated catalog decks are the agreed house variant (§4.3), not a 150-point deck. Card sampling is not successful card coverage. No game replay, independent second state initialization, test reads/runs, production changes, harness writes, or commits occurred. Only this Markdown report was written. Engine execution met its 15-second bound; total agent reading/review/reporting exceeded the 45-second phase target. Exact first-scaffold assignment latency was not instrumented and is not claimed as verified.

## Exact trace and initial options

```json
{
  "seed": 908086,
  "maxMoves": 20,
  "digestVersion": 2,
  "initial": {
    "hands": {
      "white": [
        "annexation",
        "legacy",
        "forbidden-city",
        "fog-of-war",
        "sanctuary"
      ],
      "black": [
        "dubbing",
        "passing-in-the-night",
        "siege",
        "dungeon",
        "cathedral"
      ]
    },
    "decks": {
      "white": [
        "evil-eye",
        "masquerade",
        "dubbing",
        "riposte",
        "vendetta",
        "figure-dance",
        "guardian",
        "chaos",
        "doomsayer",
        "crusade",
        "split-knight",
        "under-elf-hill",
        "hostage",
        "mystic-shield",
        "lost-castle",
        "onslaught",
        "passing-in-the-night",
        "madman",
        "fireball",
        "challenge",
        "confabulation",
        "fortification",
        "haunting-memories",
        "man-of-straw",
        "charge",
        "tournament",
        "vulture",
        "squaring-the-circle",
        "think-again",
        "truce",
        "bombard",
        "anathema",
        "peace-talks",
        "resurrection",
        "disintegration",
        "ghostwalk",
        "rebirth",
        "long-jump",
        "panic",
        "pacifism",
        "winged-victory",
        "breakthrough",
        "coup",
        "merciless",
        "holy-war",
        "blessing",
        "siege",
        "treason",
        "neutrality",
        "toll",
        "dungeon",
        "cathedral",
        "earthquake",
        "bog",
        "irresistible-force",
        "forced-march",
        "plots-within-plots",
        "dark-mirror",
        "abduction",
        "holy-quest",
        "man-trap",
        "evangelists",
        "hidden-passage",
        "fatal-attraction",
        "revenge",
        "doppelganger",
        "heresy",
        "assassin",
        "crab",
        "fanatic",
        "betrayal",
        "cowardice",
        "knightmare",
        "curse",
        "no-quarter"
      ],
      "black": [
        "split-knight",
        "chaos",
        "haunting-memories",
        "forbidden-city",
        "betrayal",
        "legacy",
        "fatal-attraction",
        "challenge",
        "resurrection",
        "long-jump",
        "under-elf-hill",
        "guardian",
        "rebirth",
        "panic",
        "fog-of-war",
        "holy-war",
        "squaring-the-circle",
        "no-quarter",
        "charge",
        "coup",
        "think-again",
        "lost-castle",
        "crusade",
        "dark-mirror",
        "annexation",
        "holy-quest",
        "riposte",
        "truce",
        "sanctuary",
        "treason",
        "doppelganger",
        "winged-victory",
        "earthquake",
        "cowardice",
        "crab",
        "ghostwalk",
        "vulture",
        "hostage",
        "merciless",
        "irresistible-force",
        "anathema",
        "onslaught",
        "assassin",
        "breakthrough",
        "evil-eye",
        "bombard",
        "evangelists",
        "blessing",
        "man-of-straw",
        "mystic-shield",
        "madman",
        "plots-within-plots",
        "pacifism",
        "forced-march",
        "masquerade",
        "fortification",
        "abduction",
        "knightmare",
        "hidden-passage",
        "revenge",
        "confabulation",
        "tournament",
        "bog",
        "curse",
        "man-trap",
        "doomsayer",
        "toll",
        "disintegration",
        "peace-talks",
        "vendetta",
        "neutrality",
        "fireball",
        "heresy",
        "fanatic",
        "figure-dance"
      ]
    }
  },
  "steps": [
    {
      "action": {
        "type": "move",
        "from": "f2",
        "to": "f4"
      },
      "expected": "891234adc59a695241a691ef6ac85261835ec20e97849083be3ea1d99b93dd65"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "34c7cbafa9279e75e560ba2acddf5aec3db972a7da6aaa2911ceab4837953ab8"
    },
    {
      "action": {
        "type": "move",
        "from": "f7",
        "to": "f6"
      },
      "expected": "34c38c5ccdd41cd0686ea0f95b99e8d5b5471dec8e2b9b77fea895f14f14a11f"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "cathedral",
        "cardInstanceId": "black-hand-4-cathedral",
        "target": {
          "rook": "h8",
          "bishop": "f8"
        }
      },
      "expected": "165a971906e96a73a1ba37839969e919bbd17f36251b1f730a1d4a301614dbfd"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "cd722798d14488ea60e688c86ec1e1503606aaa148e1cc9fefbc33d05afc595c"
    },
    {
      "action": {
        "type": "move",
        "from": "c2",
        "to": "c3"
      },
      "expected": "c4a2af155603cb879928cb40b9a075dcf2c065fd589cc17058b923a793693012"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "f308d3bf7abbba4882dce15eaf4babe23337c4900d4da41d5b95c566a25562e9"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "passing-in-the-night",
        "cardInstanceId": "black-hand-1-passing-in-the-night",
        "target": [
          {
            "from": "b7",
            "to": "g2"
          },
          {
            "from": "f6",
            "to": "h2"
          }
        ]
      },
      "expected": "b442301770fd48ecbd973f69eb6be08a293fd8a0dda395bbf1ad1b18c586cc7b"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "ed3c3778fe0b95fffa859330262af3b0b65dedf19411fb600f48bc54d7a5a886"
    },
    {
      "action": {
        "type": "move",
        "from": "g1",
        "to": "f3"
      },
      "expected": "ee5d08b1e887e418666d3811497e3aef46b885fd2ecb0cc76793727228d1af2a"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "49ef1272f0da434f7e3480d2c3a2cf3ce31387687d93c7cd8ea883d3164a4766"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "dubbing",
        "cardInstanceId": "black-hand-0-dubbing",
        "target": [
          {
            "from": "c7",
            "to": "b5"
          }
        ]
      },
      "expected": "8117a7ae44ed09cd0f3ab8720bf2766598446c6f08ed8a8403638edcf69b919d"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "c8755afa78e57f603630bae6d74ecdfa1a15a13253ab66448f855cae5c19041a"
    },
    {
      "action": {
        "type": "move",
        "from": "f6",
        "to": "f7"
      },
      "expected": "415ba4d4e369d9361f3e4523dcf4f8acf1d0b953bc0ea893f8bfd4b69a7567d0"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "chaos",
        "cardInstanceId": "black-deck-1-chaos"
      },
      "expected": "83fc18ab997c6e2c9ffbda35c6af434950abe858078bb501546d454f42990f0c"
    },
    {
      "action": {
        "type": "move",
        "from": "d1",
        "to": "b3"
      },
      "expected": "2ff877efd8016601f177336903fbb9a90fb9245ba733f63c9df4d7f572879eba"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "38b453b3800a2b68ae2f9f01fc63e1c937faf7cad8eed2523fea14453a112ab8"
    },
    {
      "action": {
        "type": "move",
        "from": "d7",
        "to": "d6"
      },
      "expected": "58289fc2b03a5abaf10be3aa2865b310873a5744498175f4b2e7f305fe0ca4c0"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "371b3b141e71078eaaf60be0abbceab9ebb88b564e05277c4d5864f5593b6302"
    },
    {
      "action": {
        "type": "move",
        "from": "f3",
        "to": "d4"
      },
      "expected": "a21e3db86341dccee7d69391f81a3b381fdb0d2244b661218263f15ac5779b62"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "d434a77b9a636cbdb8b4611da9cbc4bb88a55e90b966548140da1c4427fa03ed"
    },
    {
      "action": {
        "type": "move",
        "from": "d8",
        "to": "b6"
      },
      "expected": "dd78c7e5925332dfc0838a2ee86506cb6580c61f73454b4bd8b389d093fbc2e4"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "efea98cf643d5945c31b781b3b6c67184e371481722a5c3217a4584e7628c06c"
    },
    {
      "action": {
        "type": "move",
        "from": "d4",
        "to": "c2"
      },
      "expected": "a7590dd73401a6e32503e47935d62e105f8d1041671a5d66e551f740006024f8"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "581fa363c963e2c6fda8ecc8ce2b2d22f68dfa49884da3ad89eeb52b5f6aa27e"
    },
    {
      "action": {
        "type": "move",
        "from": "g8",
        "to": "f6"
      },
      "expected": "13f91982856aae780c3c46d456eb5471d47260df79e58a87659e524db0874d1e"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "forbidden-city",
        "cardInstanceId": "black-deck-3-forbidden-city",
        "target": "f5"
      },
      "expected": "9a755f0fabe5a2ccb5eec71c5a5f259b325bc82042466ee9b5b25df3bd79b202"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "f8f907cf2ab71bdad77b7acb530119d81b97f0ab5c8dbe42941b6aa43f87237f"
    },
    {
      "action": {
        "type": "move",
        "from": "h1",
        "to": "h2"
      },
      "expected": "734ac87ceade9b3f11db51874de1c891de80b2374aa53bed9bd2ae9e0820965d"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "57092850292a91fdee95c8b772e30f48d0f029f8c3a4e1f4f812a7645858c9ac"
    },
    {
      "action": {
        "type": "move",
        "from": "g2",
        "to": "f1",
        "promotion": "bishop"
      },
      "expected": "9cb1b0bb73b0eff2909246232bbb33c249dc365344af159bf109c5db22c2d18c"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "09ef67c92530053d914b95c9984cde0dc6f1333c8493f1397d1f1c773b15d75d"
    },
    {
      "action": {
        "type": "move",
        "from": "h2",
        "to": "h3"
      },
      "expected": "70886286876b7cce5c9fdd945908c206b53da899849598d1fc26dfde17e80bce"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "bb2a2a43f27836aaf69fd5eca01cbe0fa9a708858f42283b101f403a8eeac266"
    },
    {
      "action": {
        "type": "move",
        "from": "f6",
        "to": "h5"
      },
      "expected": "77905632dd30d3a310fe82d61da3d45adf55fa30a994ba2997c917651e54024f"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "6543b858024a805a7f9191a0ee574f2e53150acc1cf7fbf0e5d550f012bbb39b"
    },
    {
      "action": {
        "type": "move",
        "from": "b3",
        "to": "e6"
      },
      "expected": "11ea5c418c5f257919a8272cb382aa63989b29eb188f2fc79cbc040c95b13055"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "e1e6a769b724f721a2d02abddb285817bea88ac3e7fd23372ca0acb724d8a5cb"
    },
    {
      "action": {
        "type": "move",
        "from": "b8",
        "to": "c6"
      },
      "expected": "656abb007f5b877def09ca7a27043c3d4bcab2ce6b2dfc8c0020636773bb7eb5"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "f702090dc58d5be4e8cec30c438e134b03dda4c94c259eb4357fba89280b5279"
    },
    {
      "action": {
        "type": "move",
        "from": "e6",
        "to": "g6"
      },
      "expected": "12946203ed90c309871bdc89ad803d3b6eef811435455943d5ab1aaa1ff54693"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "78ca336fcec17871dac34f568edc865e50eb37664a7d4592df85a83909ba1139"
    },
    {
      "action": {
        "type": "move",
        "from": "c8",
        "to": "b7"
      },
      "expected": "7fb94dc12ba9c2654147abeca55400a79027ffcbaceb499f23e5e3252eebd060"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "siege",
        "cardInstanceId": "black-hand-2-siege",
        "target": {
          "knight": "h5",
          "rook": "a8"
        }
      },
      "expected": "36565ef1660b5e858118ee0834ec06d2d0cc6b07c1ddb00b8d9224528f3ddd9f"
    },
    {
      "action": {
        "type": "move",
        "from": "e8",
        "to": "d7"
      },
      "expected": "d65fd5e0041cec2ed535e81e5bfd589820ef52103373790460983b681c558410"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "0896863e553e09fb4e33ce95edc169dd98d5b90bc87d7c5841286153a3cb8355"
    }
  ],
  "moves": 20,
  "finalFen": "r1b2r1b/pP1kp1pp/1qnp2Q1/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 w Q - 6 11",
  "sampledCards": {
    "fog-of-war": 4,
    "cathedral": 1,
    "passing-in-the-night": 2,
    "sanctuary": 3,
    "siege": 3,
    "legacy": 3,
    "dubbing": 2,
    "dungeon": 1,
    "split-knight": 2,
    "chaos": 1,
    "annexation": 4,
    "forbidden-city": 4,
    "haunting-memories": 2,
    "betrayal": 1
  }
}
```

## Full sequential before/after evidence

```jsonl
Seed 908086; standard starting board; shuffled catalog house-variant decks (rules §4.3).
Each row must be independently reviewed against rules.md/cards.md; hashes alone are not an oracle.
{"step":1,"move":1,"action":{"type":"move","from":"f2","to":"f4"},"fen":["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","rnbqkbnr/pppppppp/8/8/5P2/8/PPPPP1PP/RNBQKBNR b KQkq - 0 1"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-f2","owner":"white","role":"pawn","originalRole":"pawn","square":"f2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-f2","owner":"white","role":"pawn","originalRole":"pawn","square":"f4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"f2","to":"f4"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["dubbing","passing-in-the-night","siege","dungeon","cathedral"],"after":["dubbing","passing-in-the-night","siege","dungeon","cathedral"],"decks":[75,75],"discard":[]}],"enPassant":[{"target":"f3","pawnId":"white-pawn-f2"}],"pendingRescue":false}
{"step":2,"move":1,"action":{"type":"endTurn"},"fen":["rnbqkbnr/pppppppp/8/8/5P2/8/PPPPP1PP/RNBQKBNR b KQkq - 0 1","rnbqkbnr/pppppppp/8/8/5P2/8/PPPPP1PP/RNBQKBNR b KQkq - 0 1"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"f2","to":"f4"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["dubbing","passing-in-the-night","siege","dungeon","cathedral"],"after":["dubbing","passing-in-the-night","siege","dungeon","cathedral"],"decks":[75,75],"discard":[]}],"enPassant":[{"target":"f3","pawnId":"white-pawn-f2"}],"pendingRescue":false}
{"step":3,"move":2,"action":{"type":"move","from":"f7","to":"f6"},"fen":["rnbqkbnr/pppppppp/8/8/5P2/8/PPPPP1PP/RNBQKBNR b KQkq - 0 1","rnbqkbnr/ppppp1pp/5p2/8/5P2/8/PPPPP1PP/RNBQKBNR w KQkq - 0 2"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-pawn-f7","owner":"black","role":"pawn","originalRole":"pawn","square":"f7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-f7","owner":"black","role":"pawn","originalRole":"pawn","square":"f6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"f7","to":"f6"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["dubbing","passing-in-the-night","siege","dungeon","cathedral"],"after":["dubbing","passing-in-the-night","siege","dungeon","cathedral"],"decks":[75,75],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":4,"move":2,"action":{"type":"playCard","cardId":"cathedral","cardInstanceId":"black-hand-4-cathedral","target":{"rook":"h8","bishop":"f8"}},"fen":["rnbqkbnr/ppppp1pp/5p2/8/5P2/8/PPPPP1PP/RNBQKBNR w KQkq - 0 2","rnbqkrnb/ppppp1pp/5p2/8/5P2/8/PPPPP1PP/RNBQKBNR w KQhq - 0 2"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}}],"pieces":[{"before":{"id":"black-bishop-f8","owner":"black","role":"bishop","originalRole":"bishop","square":"f8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-bishop-f8","owner":"black","role":"bishop","originalRole":"bishop","square":"h8","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"black-rook-h8","owner":"black","role":"rook","originalRole":"rook","square":"h8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-rook-h8","owner":"black","role":"rook","originalRole":"rook","square":"f8","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"cathedral","target":{"rook":"h8","bishop":"f8"},"movement":[{"from":"f8","to":"h8"},{"from":"h8","to":"f8"}],"preservePreviousMove":true}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["dubbing","passing-in-the-night","siege","dungeon","cathedral"],"after":["dubbing","passing-in-the-night","siege","dungeon","split-knight"],"decks":[75,74],"discard":["cathedral"]}],"enPassant":[],"pendingRescue":false}
{"step":5,"move":2,"action":{"type":"endTurn"},"fen":["rnbqkrnb/ppppp1pp/5p2/8/5P2/8/PPPPP1PP/RNBQKBNR w KQhq - 0 2","rnbqkrnb/ppppp1pp/5p2/8/5P2/8/PPPPP1PP/RNBQKBNR w KQhq - 0 2"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"cathedral","target":{"rook":"h8","bishop":"f8"},"movement":[{"from":"f8","to":"h8"},{"from":"h8","to":"f8"}],"preservePreviousMove":true}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["dubbing","passing-in-the-night","siege","dungeon","split-knight"],"after":["dubbing","passing-in-the-night","siege","dungeon","split-knight"],"decks":[74,74],"discard":["cathedral"]}],"enPassant":[],"pendingRescue":false}
{"step":6,"move":3,"action":{"type":"move","from":"c2","to":"c3"},"fen":["rnbqkrnb/ppppp1pp/5p2/8/5P2/8/PPPPP1PP/RNBQKBNR w KQhq - 0 2","rnbqkrnb/ppppp1pp/5p2/8/5P2/2P5/PP1PP1PP/RNBQKBNR b KQhq - 0 2"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-c2","owner":"white","role":"pawn","originalRole":"pawn","square":"c2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-c2","owner":"white","role":"pawn","originalRole":"pawn","square":"c3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"c2","to":"c3"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["dubbing","passing-in-the-night","siege","dungeon","split-knight"],"after":["dubbing","passing-in-the-night","siege","dungeon","split-knight"],"decks":[74,74],"discard":["cathedral"]}],"enPassant":[],"pendingRescue":false}
{"step":7,"move":3,"action":{"type":"endTurn"},"fen":["rnbqkrnb/ppppp1pp/5p2/8/5P2/2P5/PP1PP1PP/RNBQKBNR b KQhq - 0 2","rnbqkrnb/ppppp1pp/5p2/8/5P2/2P5/PP1PP1PP/RNBQKBNR b KQhq - 0 2"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"c2","to":"c3"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["dubbing","passing-in-the-night","siege","dungeon","split-knight"],"after":["dubbing","passing-in-the-night","siege","dungeon","split-knight"],"decks":[74,74],"discard":["cathedral"]}],"enPassant":[],"pendingRescue":false}
{"step":8,"move":3,"action":{"type":"playCard","cardId":"passing-in-the-night","cardInstanceId":"black-hand-1-passing-in-the-night","target":[{"from":"b7","to":"g2"},{"from":"f6","to":"h2"}]},"fen":["rnbqkrnb/ppppp1pp/5p2/8/5P2/2P5/PP1PP1PP/RNBQKBNR b KQhq - 0 2","rnbqkrnb/pPppp1pp/5P2/8/5P2/2P5/PP1PP1pp/RNBQKBNR w KQhq - 0 3"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}}],"pieces":[{"before":{"id":"white-pawn-g2","owner":"white","role":"pawn","originalRole":"pawn","square":"g2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-g2","owner":"white","role":"pawn","originalRole":"pawn","square":"b7","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"white-pawn-h2","owner":"white","role":"pawn","originalRole":"pawn","square":"h2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-h2","owner":"white","role":"pawn","originalRole":"pawn","square":"f6","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"black-pawn-b7","owner":"black","role":"pawn","originalRole":"pawn","square":"b7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-b7","owner":"black","role":"pawn","originalRole":"pawn","square":"g2","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"black-pawn-f7","owner":"black","role":"pawn","originalRole":"pawn","square":"f6","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-f7","owner":"black","role":"pawn","originalRole":"pawn","square":"h2","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"passing-in-the-night","target":[{"from":"b7","to":"g2"},{"from":"f6","to":"h2"}],"movement":[{"from":"g2","to":"b7"},{"from":"h2","to":"f6"},{"from":"b7","to":"g2"},{"from":"f6","to":"h2"}],"preservePreviousMove":false}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["dubbing","passing-in-the-night","siege","dungeon","split-knight"],"after":["dubbing","siege","dungeon","split-knight","chaos"],"decks":[74,73],"discard":["cathedral","passing-in-the-night"]}],"enPassant":[],"pendingRescue":false}
{"step":9,"move":3,"action":{"type":"endTurn"},"fen":["rnbqkrnb/pPppp1pp/5P2/8/5P2/2P5/PP1PP1pp/RNBQKBNR w KQhq - 0 3","rnbqkrnb/pPppp1pp/5P2/8/5P2/2P5/PP1PP1pp/RNBQKBNR w KQhq - 0 3"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"passing-in-the-night","target":[{"from":"b7","to":"g2"},{"from":"f6","to":"h2"}],"movement":[{"from":"g2","to":"b7"},{"from":"h2","to":"f6"},{"from":"b7","to":"g2"},{"from":"f6","to":"h2"}],"preservePreviousMove":false}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["dubbing","siege","dungeon","split-knight","chaos"],"after":["dubbing","siege","dungeon","split-knight","chaos"],"decks":[73,73],"discard":["cathedral","passing-in-the-night"]}],"enPassant":[],"pendingRescue":false}
{"step":10,"move":4,"action":{"type":"move","from":"g1","to":"f3"},"fen":["rnbqkrnb/pPppp1pp/5P2/8/5P2/2P5/PP1PP1pp/RNBQKBNR w KQhq - 0 3","rnbqkrnb/pPppp1pp/5P2/8/5P2/2P2N2/PP1PP1pp/RNBQKB1R b KQhq - 1 3"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"g1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"f3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"g1","to":"f3"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["dubbing","siege","dungeon","split-knight","chaos"],"after":["dubbing","siege","dungeon","split-knight","chaos"],"decks":[73,73],"discard":["cathedral","passing-in-the-night"]}],"enPassant":[],"pendingRescue":false}
{"step":11,"move":4,"action":{"type":"endTurn"},"fen":["rnbqkrnb/pPppp1pp/5P2/8/5P2/2P2N2/PP1PP1pp/RNBQKB1R b KQhq - 1 3","rnbqkrnb/pPppp1pp/5P2/8/5P2/2P2N2/PP1PP1pp/RNBQKB1R b KQhq - 1 3"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"g1","to":"f3"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["dubbing","siege","dungeon","split-knight","chaos"],"after":["dubbing","siege","dungeon","split-knight","chaos"],"decks":[73,73],"discard":["cathedral","passing-in-the-night"]}],"enPassant":[],"pendingRescue":false}
{"step":12,"move":4,"action":{"type":"playCard","cardId":"dubbing","cardInstanceId":"black-hand-0-dubbing","target":[{"from":"c7","to":"b5"}]},"fen":["rnbqkrnb/pPppp1pp/5P2/8/5P2/2P2N2/PP1PP1pp/RNBQKB1R b KQhq - 1 3","rnbqkrnb/pP1pp1pp/5P2/1p6/5P2/2P2N2/PP1PP1pp/RNBQKB1R w KQhq - 0 4"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}}],"pieces":[{"before":{"id":"black-pawn-c7","owner":"black","role":"pawn","originalRole":"pawn","square":"c7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-c7","owner":"black","role":"pawn","originalRole":"pawn","square":"b5","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"dubbing","target":[{"from":"c7","to":"b5"}],"movement":[{"from":"c7","to":"b5"}],"preservePreviousMove":false}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["dubbing","siege","dungeon","split-knight","chaos"],"after":["siege","dungeon","split-knight","chaos","haunting-memories"],"decks":[73,72],"discard":["cathedral","passing-in-the-night","dubbing"]}],"enPassant":[],"pendingRescue":false}
{"step":13,"move":4,"action":{"type":"endTurn"},"fen":["rnbqkrnb/pP1pp1pp/5P2/1p6/5P2/2P2N2/PP1PP1pp/RNBQKB1R w KQhq - 0 4","rnbqkrnb/pP1pp1pp/5P2/1p6/5P2/2P2N2/PP1PP1pp/RNBQKB1R w KQhq - 0 4"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"dubbing","target":[{"from":"c7","to":"b5"}],"movement":[{"from":"c7","to":"b5"}],"preservePreviousMove":false}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","chaos","haunting-memories"],"after":["siege","dungeon","split-knight","chaos","haunting-memories"],"decks":[72,72],"discard":["cathedral","passing-in-the-night","dubbing"]}],"enPassant":[],"pendingRescue":false}
{"step":14,"move":5,"action":{"type":"move","from":"f6","to":"f7"},"fen":["rnbqkrnb/pP1pp1pp/5P2/1p6/5P2/2P2N2/PP1PP1pp/RNBQKB1R w KQhq - 0 4","rnbqkrnb/pP1ppPpp/8/1p6/5P2/2P2N2/PP1PP1pp/RNBQKB1R b KQhq - 0 4"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-h2","owner":"white","role":"pawn","originalRole":"pawn","square":"f6","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-h2","owner":"white","role":"pawn","originalRole":"pawn","square":"f7","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"f6","to":"f7"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","chaos","haunting-memories"],"after":["siege","dungeon","split-knight","chaos","haunting-memories"],"decks":[72,72],"discard":["cathedral","passing-in-the-night","dubbing"]}],"enPassant":[],"pendingRescue":false}
{"step":15,"move":5,"action":{"type":"playCard","cardId":"chaos","cardInstanceId":"black-deck-1-chaos"},"fen":["rnbqkrnb/pP1ppPpp/8/1p6/5P2/2P2N2/PP1PP1pp/RNBQKB1R b KQhq - 0 4","rnbqkrnb/pP1pp1pp/5P2/1p6/5P2/2P2N2/PP1PP1pp/RNBQKB1R w KQhq - 0 4"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":1}}],"pieces":[{"before":{"id":"white-pawn-h2","owner":"white","role":"pawn","originalRole":"pawn","square":"f7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-h2","owner":"white","role":"pawn","originalRole":"pawn","square":"f6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"chaos","player":"black","movement":[{"from":"f7","to":"f6"}],"preservePreviousMove":true}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","chaos","haunting-memories"],"after":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"decks":[72,71],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":16,"move":6,"action":{"type":"move","from":"d1","to":"b3"},"fen":["rnbqkrnb/pP1pp1pp/5P2/1p6/5P2/2P2N2/PP1PP1pp/RNBQKB1R w KQhq - 0 4","rnbqkrnb/pP1pp1pp/5P2/1p6/5P2/1QP2N2/PP1PP1pp/RNB1KB1R b KQhq - 1 4"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":1}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}}],"pieces":[{"before":{"id":"white-queen-d1","owner":"white","role":"queen","originalRole":"queen","square":"d1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-queen-d1","owner":"white","role":"queen","originalRole":"queen","square":"b3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"d1","to":"b3"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"after":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"decks":[71,71],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":17,"move":6,"action":{"type":"endTurn"},"fen":["rnbqkrnb/pP1pp1pp/5P2/1p6/5P2/1QP2N2/PP1PP1pp/RNB1KB1R b KQhq - 1 4","rnbqkrnb/pP1pp1pp/5P2/1p6/5P2/1QP2N2/PP1PP1pp/RNB1KB1R b KQhq - 1 4"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"d1","to":"b3"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"after":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"decks":[71,71],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":18,"move":7,"action":{"type":"move","from":"d7","to":"d6"},"fen":["rnbqkrnb/pP1pp1pp/5P2/1p6/5P2/1QP2N2/PP1PP1pp/RNB1KB1R b KQhq - 1 4","rnbqkrnb/pP2p1pp/3p1P2/1p6/5P2/1QP2N2/PP1PP1pp/RNB1KB1R w KQhq - 0 5"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-pawn-d7","owner":"black","role":"pawn","originalRole":"pawn","square":"d7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-d7","owner":"black","role":"pawn","originalRole":"pawn","square":"d6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"d7","to":"d6"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"after":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"decks":[71,71],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":19,"move":7,"action":{"type":"endTurn"},"fen":["rnbqkrnb/pP2p1pp/3p1P2/1p6/5P2/1QP2N2/PP1PP1pp/RNB1KB1R w KQhq - 0 5","rnbqkrnb/pP2p1pp/3p1P2/1p6/5P2/1QP2N2/PP1PP1pp/RNB1KB1R w KQhq - 0 5"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"d7","to":"d6"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"after":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"decks":[71,71],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":20,"move":8,"action":{"type":"move","from":"f3","to":"d4"},"fen":["rnbqkrnb/pP2p1pp/3p1P2/1p6/5P2/1QP2N2/PP1PP1pp/RNB1KB1R w KQhq - 0 5","rnbqkrnb/pP2p1pp/3p1P2/1p6/3N1P2/1QP5/PP1PP1pp/RNB1KB1R b KQhq - 1 5"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"f3","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"d4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"f3","to":"d4"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"after":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"decks":[71,71],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":21,"move":8,"action":{"type":"endTurn"},"fen":["rnbqkrnb/pP2p1pp/3p1P2/1p6/3N1P2/1QP5/PP1PP1pp/RNB1KB1R b KQhq - 1 5","rnbqkrnb/pP2p1pp/3p1P2/1p6/3N1P2/1QP5/PP1PP1pp/RNB1KB1R b KQhq - 1 5"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"f3","to":"d4"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"after":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"decks":[71,71],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":22,"move":9,"action":{"type":"move","from":"d8","to":"b6"},"fen":["rnbqkrnb/pP2p1pp/3p1P2/1p6/3N1P2/1QP5/PP1PP1pp/RNB1KB1R b KQhq - 1 5","rnb1krnb/pP2p1pp/1q1p1P2/1p6/3N1P2/1QP5/PP1PP1pp/RNB1KB1R w KQhq - 2 6"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-queen-d8","owner":"black","role":"queen","originalRole":"queen","square":"d8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-queen-d8","owner":"black","role":"queen","originalRole":"queen","square":"b6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"d8","to":"b6"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"after":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"decks":[71,71],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":23,"move":9,"action":{"type":"endTurn"},"fen":["rnb1krnb/pP2p1pp/1q1p1P2/1p6/3N1P2/1QP5/PP1PP1pp/RNB1KB1R w KQhq - 2 6","rnb1krnb/pP2p1pp/1q1p1P2/1p6/3N1P2/1QP5/PP1PP1pp/RNB1KB1R w KQhq - 2 6"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"d8","to":"b6"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"after":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"decks":[71,71],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":24,"move":10,"action":{"type":"move","from":"d4","to":"c2"},"fen":["rnb1krnb/pP2p1pp/1q1p1P2/1p6/3N1P2/1QP5/PP1PP1pp/RNB1KB1R w KQhq - 2 6","rnb1krnb/pP2p1pp/1q1p1P2/1p6/5P2/1QP5/PPNPP1pp/RNB1KB1R b KQhq - 3 6"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"d4","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"c2","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"d4","to":"c2"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"after":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"decks":[71,71],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":25,"move":10,"action":{"type":"endTurn"},"fen":["rnb1krnb/pP2p1pp/1q1p1P2/1p6/5P2/1QP5/PPNPP1pp/RNB1KB1R b KQhq - 3 6","rnb1krnb/pP2p1pp/1q1p1P2/1p6/5P2/1QP5/PPNPP1pp/RNB1KB1R b KQhq - 3 6"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"d4","to":"c2"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"after":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"decks":[71,71],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":26,"move":11,"action":{"type":"move","from":"g8","to":"f6"},"fen":["rnb1krnb/pP2p1pp/1q1p1P2/1p6/5P2/1QP5/PPNPP1pp/RNB1KB1R b KQhq - 3 6","rnb1kr1b/pP2p1pp/1q1p1n2/1p6/5P2/1QP5/PPNPP1pp/RNB1KB1R w KQhq - 0 7"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-h2","owner":"white","role":"pawn","originalRole":"pawn","square":"f6","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-h2","owner":"white","role":"pawn","originalRole":"pawn","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"black"}},{"before":{"id":"black-knight-g8","owner":"black","role":"knight","originalRole":"knight","square":"g8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-knight-g8","owner":"black","role":"knight","originalRole":"knight","square":"f6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"g8","to":"f6","capturedId":"white-pawn-h2"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"after":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"decks":[71,71],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":27,"move":11,"action":{"type":"playCard","cardId":"forbidden-city","cardInstanceId":"black-deck-3-forbidden-city","target":"f5"},"fen":["rnb1kr1b/pP2p1pp/1q1p1n2/1p6/5P2/1QP5/PPNPP1pp/RNB1KB1R w KQhq - 0 7","rnb1kr1b/pP2p1pp/1q1p1n2/1p6/5P2/1QP5/PPNPP1pp/RNB1KB1R w KQhq - 0 7"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}}],"pieces":[],"effects":[[],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"cardPlayed","cardId":"forbidden-city","target":"f5"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","forbidden-city"],"after":["siege","dungeon","split-knight","haunting-memories","betrayal"],"decks":[71,70],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":28,"move":11,"action":{"type":"endTurn"},"fen":["rnb1kr1b/pP2p1pp/1q1p1n2/1p6/5P2/1QP5/PPNPP1pp/RNB1KB1R w KQhq - 0 7","rnb1kr1b/pP2p1pp/1q1p1n2/1p6/5P2/1QP5/PPNPP1pp/RNB1KB1R w KQhq - 0 7"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"cardPlayed","cardId":"forbidden-city","target":"f5"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","betrayal"],"after":["siege","dungeon","split-knight","haunting-memories","betrayal"],"decks":[70,70],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":29,"move":12,"action":{"type":"move","from":"h1","to":"h2"},"fen":["rnb1kr1b/pP2p1pp/1q1p1n2/1p6/5P2/1QP5/PPNPP1pp/RNB1KB1R w KQhq - 0 7","rnb1kr1b/pP2p1pp/1q1p1n2/1p6/5P2/1QP5/PPNPP1pR/RNB1KB2 b Qhq - 0 7"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-rook-h1","owner":"white","role":"rook","originalRole":"rook","square":"h1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-rook-h1","owner":"white","role":"rook","originalRole":"rook","square":"h2","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"black-pawn-f7","owner":"black","role":"pawn","originalRole":"pawn","square":"h2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-f7","owner":"black","role":"pawn","originalRole":"pawn","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"white"}}],"effects":[[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"move","from":"h1","to":"h2","capturedId":"black-pawn-f7"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","betrayal"],"after":["siege","dungeon","split-knight","haunting-memories","betrayal"],"decks":[70,70],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":30,"move":12,"action":{"type":"endTurn"},"fen":["rnb1kr1b/pP2p1pp/1q1p1n2/1p6/5P2/1QP5/PPNPP1pR/RNB1KB2 b Qhq - 0 7","rnb1kr1b/pP2p1pp/1q1p1n2/1p6/5P2/1QP5/PPNPP1pR/RNB1KB2 b Qhq - 0 7"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"move","from":"h1","to":"h2","capturedId":"black-pawn-f7"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","betrayal"],"after":["siege","dungeon","split-knight","haunting-memories","betrayal"],"decks":[70,70],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":31,"move":13,"action":{"type":"move","from":"g2","to":"f1","promotion":"bishop"},"fen":["rnb1kr1b/pP2p1pp/1q1p1n2/1p6/5P2/1QP5/PPNPP1pR/RNB1KB2 b Qhq - 0 7","rnb1kr1b/pP2p1pp/1q1p1n2/1p6/5P2/1QP5/PPNPP2R/RNB1Kb2 w Qhq - 0 8"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"f1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"black"}},{"before":{"id":"black-pawn-b7","owner":"black","role":"pawn","originalRole":"pawn","square":"g2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-b7","owner":"black","role":"bishop","originalRole":"pawn","square":"f1","zone":"board","promoted":true,"royal":false,"neutral":false}}],"effects":[[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"move","from":"g2","to":"f1","promotion":"bishop","capturedId":"white-bishop-f1"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","betrayal"],"after":["siege","dungeon","split-knight","haunting-memories","betrayal"],"decks":[70,70],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":32,"move":13,"action":{"type":"endTurn"},"fen":["rnb1kr1b/pP2p1pp/1q1p1n2/1p6/5P2/1QP5/PPNPP2R/RNB1Kb2 w Qhq - 0 8","rnb1kr1b/pP2p1pp/1q1p1n2/1p6/5P2/1QP5/PPNPP2R/RNB1Kb2 w Qhq - 0 8"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"move","from":"g2","to":"f1","promotion":"bishop","capturedId":"white-bishop-f1"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","betrayal"],"after":["siege","dungeon","split-knight","haunting-memories","betrayal"],"decks":[70,70],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":33,"move":14,"action":{"type":"move","from":"h2","to":"h3"},"fen":["rnb1kr1b/pP2p1pp/1q1p1n2/1p6/5P2/1QP5/PPNPP2R/RNB1Kb2 w Qhq - 0 8","rnb1kr1b/pP2p1pp/1q1p1n2/1p6/5P2/1QP4R/PPNPP3/RNB1Kb2 b Qhq - 1 8"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-rook-h1","owner":"white","role":"rook","originalRole":"rook","square":"h2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-rook-h1","owner":"white","role":"rook","originalRole":"rook","square":"h3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"move","from":"h2","to":"h3"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","betrayal"],"after":["siege","dungeon","split-knight","haunting-memories","betrayal"],"decks":[70,70],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":34,"move":14,"action":{"type":"endTurn"},"fen":["rnb1kr1b/pP2p1pp/1q1p1n2/1p6/5P2/1QP4R/PPNPP3/RNB1Kb2 b Qhq - 1 8","rnb1kr1b/pP2p1pp/1q1p1n2/1p6/5P2/1QP4R/PPNPP3/RNB1Kb2 b Qhq - 1 8"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"move","from":"h2","to":"h3"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","betrayal"],"after":["siege","dungeon","split-knight","haunting-memories","betrayal"],"decks":[70,70],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":35,"move":15,"action":{"type":"move","from":"f6","to":"h5"},"fen":["rnb1kr1b/pP2p1pp/1q1p1n2/1p6/5P2/1QP4R/PPNPP3/RNB1Kb2 b Qhq - 1 8","rnb1kr1b/pP2p1pp/1q1p4/1p5n/5P2/1QP4R/PPNPP3/RNB1Kb2 w Qhq - 2 9"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-knight-g8","owner":"black","role":"knight","originalRole":"knight","square":"f6","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-knight-g8","owner":"black","role":"knight","originalRole":"knight","square":"h5","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"move","from":"f6","to":"h5"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","betrayal"],"after":["siege","dungeon","split-knight","haunting-memories","betrayal"],"decks":[70,70],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":36,"move":15,"action":{"type":"endTurn"},"fen":["rnb1kr1b/pP2p1pp/1q1p4/1p5n/5P2/1QP4R/PPNPP3/RNB1Kb2 w Qhq - 2 9","rnb1kr1b/pP2p1pp/1q1p4/1p5n/5P2/1QP4R/PPNPP3/RNB1Kb2 w Qhq - 2 9"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"move","from":"f6","to":"h5"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","betrayal"],"after":["siege","dungeon","split-knight","haunting-memories","betrayal"],"decks":[70,70],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":37,"move":16,"action":{"type":"move","from":"b3","to":"e6"},"fen":["rnb1kr1b/pP2p1pp/1q1p4/1p5n/5P2/1QP4R/PPNPP3/RNB1Kb2 w Qhq - 2 9","rnb1kr1b/pP2p1pp/1q1pQ3/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 b Qhq - 3 9"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-queen-d1","owner":"white","role":"queen","originalRole":"queen","square":"b3","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-queen-d1","owner":"white","role":"queen","originalRole":"queen","square":"e6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"move","from":"b3","to":"e6"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","betrayal"],"after":["siege","dungeon","split-knight","haunting-memories","betrayal"],"decks":[70,70],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":38,"move":16,"action":{"type":"endTurn"},"fen":["rnb1kr1b/pP2p1pp/1q1pQ3/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 b Qhq - 3 9","rnb1kr1b/pP2p1pp/1q1pQ3/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 b Qhq - 3 9"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"move","from":"b3","to":"e6"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","betrayal"],"after":["siege","dungeon","split-knight","haunting-memories","betrayal"],"decks":[70,70],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":39,"move":17,"action":{"type":"move","from":"b8","to":"c6"},"fen":["rnb1kr1b/pP2p1pp/1q1pQ3/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 b Qhq - 3 9","r1b1kr1b/pP2p1pp/1qnpQ3/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 w Qhq - 4 10"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":"b8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":"c6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"move","from":"b8","to":"c6"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","betrayal"],"after":["siege","dungeon","split-knight","haunting-memories","betrayal"],"decks":[70,70],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":40,"move":17,"action":{"type":"endTurn"},"fen":["r1b1kr1b/pP2p1pp/1qnpQ3/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 w Qhq - 4 10","r1b1kr1b/pP2p1pp/1qnpQ3/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 w Qhq - 4 10"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"move","from":"b8","to":"c6"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","betrayal"],"after":["siege","dungeon","split-knight","haunting-memories","betrayal"],"decks":[70,70],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":41,"move":18,"action":{"type":"move","from":"e6","to":"g6"},"fen":["r1b1kr1b/pP2p1pp/1qnpQ3/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 w Qhq - 4 10","r1b1kr1b/pP2p1pp/1qnp2Q1/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 b Qhq - 5 10"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-queen-d1","owner":"white","role":"queen","originalRole":"queen","square":"e6","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-queen-d1","owner":"white","role":"queen","originalRole":"queen","square":"g6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"move","from":"e6","to":"g6"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","betrayal"],"after":["siege","dungeon","split-knight","haunting-memories","betrayal"],"decks":[70,70],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":42,"move":18,"action":{"type":"endTurn"},"fen":["r1b1kr1b/pP2p1pp/1qnp2Q1/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 b Qhq - 5 10","r1b1kr1b/pP2p1pp/1qnp2Q1/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 b Qhq - 5 10"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"move","from":"e6","to":"g6"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","betrayal"],"after":["siege","dungeon","split-knight","haunting-memories","betrayal"],"decks":[70,70],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":false}
{"step":43,"move":19,"action":{"type":"move","from":"c8","to":"b7"},"fen":["r1b1kr1b/pP2p1pp/1qnp2Q1/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 b Qhq - 5 10","r3kr1b/pb2p1pp/1qnp2Q1/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 w Qhq - 0 11"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-g2","owner":"white","role":"pawn","originalRole":"pawn","square":"b7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-g2","owner":"white","role":"pawn","originalRole":"pawn","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"black"}},{"before":{"id":"black-bishop-c8","owner":"black","role":"bishop","originalRole":"bishop","square":"c8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-bishop-c8","owner":"black","role":"bishop","originalRole":"bishop","square":"b7","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"move","from":"c8","to":"b7","capturedId":"white-pawn-g2"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","betrayal"],"after":["siege","dungeon","split-knight","haunting-memories","betrayal"],"decks":[70,70],"discard":["cathedral","passing-in-the-night","dubbing","chaos"]}],"enPassant":[],"pendingRescue":true}
{"step":44,"move":19,"action":{"type":"playCard","cardId":"siege","cardInstanceId":"black-hand-2-siege","target":{"knight":"h5","rook":"a8"}},"fen":["r3kr1b/pb2p1pp/1qnp2Q1/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 w Qhq - 0 11","r1b1kr1b/pP2p1pp/1qnp2Q1/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 b Qhq - 5 10"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":1}}],"pieces":[{"before":{"id":"white-pawn-g2","owner":"white","role":"pawn","originalRole":"pawn","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"black"},"after":{"id":"white-pawn-g2","owner":"white","role":"pawn","originalRole":"pawn","square":"b7","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"black-bishop-c8","owner":"black","role":"bishop","originalRole":"bishop","square":"b7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-bishop-c8","owner":"black","role":"bishop","originalRole":"bishop","square":"c8","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"cardFizzled","cardId":"siege","reason":"SELF_CHECK","movement":[],"preservePreviousMove":false}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["siege","dungeon","split-knight","haunting-memories","betrayal"],"after":["dungeon","split-knight","haunting-memories","betrayal","legacy"],"decks":[70,69],"discard":["cathedral","passing-in-the-night","dubbing","chaos","siege"]}],"enPassant":[],"pendingRescue":false}
{"step":45,"move":20,"action":{"type":"move","from":"e8","to":"d7"},"fen":["r1b1kr1b/pP2p1pp/1qnp2Q1/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 b Qhq - 5 10","r1b2r1b/pP1kp1pp/1qnp2Q1/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 w Q - 6 11"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":1}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}}],"pieces":[{"before":{"id":"black-king-e8","owner":"black","role":"king","originalRole":"king","square":"e8","zone":"board","promoted":false,"royal":true,"neutral":false},"after":{"id":"black-king-e8","owner":"black","role":"king","originalRole":"king","square":"d7","zone":"board","promoted":false,"royal":true,"neutral":false}}],"effects":[[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"move","from":"e8","to":"d7"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["dungeon","split-knight","haunting-memories","betrayal","legacy"],"after":["dungeon","split-knight","haunting-memories","betrayal","legacy"],"decks":[69,69],"discard":["cathedral","passing-in-the-night","dubbing","chaos","siege"]}],"enPassant":[],"pendingRescue":false}
{"step":46,"move":20,"action":{"type":"endTurn"},"fen":["r1b2r1b/pP1kp1pp/1qnp2Q1/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 w Q - 6 11","r1b2r1b/pP1kp1pp/1qnp2Q1/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 w Q - 6 11"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}],[{"type":"forbidden-city","owner":"black","card":{"id":"black-deck-3-forbidden-city","cardId":"forbidden-city"},"square":"f5"}]],"events":[{"type":"move","from":"e8","to":"d7"}],"hands":[{"color":"white","before":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"after":["annexation","legacy","forbidden-city","fog-of-war","sanctuary"],"decks":[75,75],"discard":[]},{"color":"black","before":["dungeon","split-knight","haunting-memories","betrayal","legacy"],"after":["dungeon","split-knight","haunting-memories","betrayal","legacy"],"decks":[69,69],"discard":["cathedral","passing-in-the-night","dubbing","chaos","siege"]}],"enPassant":[],"pendingRescue":false}
FINAL {"moves":20,"fen":"r1b2r1b/pP1kp1pp/1qnp2Q1/1p5n/5P2/2P4R/PPNPP3/RNB1Kb2 w Q - 6 11"}
```

GAME_086_DONE
