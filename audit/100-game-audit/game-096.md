# Game 096 audit

Seed: 908096. Status: complete.

Pre-run invariants: one seeded `generateTrace(seed, 20, progress)` call only; no replay, reset, or second game; at most 80 actions and 15 seconds in the progress callback; engine-only inspection; no test reads; Markdown-only writes.

Pre-action hypothesis: card enumeration followed by public actions must preserve unique physical identities and board squares, exactly one royal identity per player, FEN/physical-board agreement, and ordinary-chess legality when no variant modifier applies. Rejected candidate actions must preserve their input. Semantic card judgments will be explicitly post-run reviews.

Initial saved-fixture scaffold executed: 4 probes, 0 findings.

## Completed result

Baseline: `33e03989fab9449d87b857fc5673f67d05841928`. Exactly one `generateTrace(908096, 20, progress)` invocation; no replay, reset, or second independent game. The callback checked structural invariants and stopped at 80 accepted actions or 15 seconds. Completed normally: 49 accepted actions, 20 regular moves, 7 played cards, 1,786.507375 ms; no helper failure. Candidate rejection count is unavailable from this helper and is not claimed to be zero. The initial and final saved-fixture scaffolds each passed 4 probes with 0 findings.

Final FEN: `rbpq2nr/p2nkpb1/p5p1/3pp2p/N3P3/1QP1PN2/PP1P1P1P/R1B1K2R w KQ - 0 12`.

## Independent semantic review (post-run)

These are post-run judgments, distinct from the pre-action invariant hypothesis. Target shapes came from the helper's public `cardPlayTargets` enumeration.

1. **Step 2, Holy Quest.** `cards.md` Holy Quest and `rules.md` §20 require an opponent Bishop/Knight swap after the acting player's move, preserving identity without capture. White had moved e2–e4; Black's Bishop c8 and Knight b8 were swapped to b8/c8, their physical IDs, owners and roles unchanged. The afterMove phase remained and only White's card allowance rose to one. White drew Tournament, with deck 75→74 and Holy Quest in discard, consistent with §9. Neither King was threatened by the back-rank exchange. Expected and actual agree on the reviewed dimensions. The FEN's en-passant encoding changes from `-` to `e3`; the physical opportunity still refers to White's just-double-moved e-pawn, so this is not evidence of a newly created opportunity.

2. **Step 8, Pacifism.** `cards.md` Pacifism, `rules.md` §16.1 and §10 require an owned non-King to become non-capturing/non-capturable with a continuing physical marker. Black selected b8: the Bishop previously swapped by Holy Quest, physical ID `black-bishop-c8`. The board remained unchanged, the effect bound exactly that ID, the card stayed out of discard, Black drew Panic (deck 75→74), and the regular move remained available. Expected attachment, timing and accounting agree. This path does not independently demonstrate all capture-immunity enforcement; that remains a limitation.

3. **Step 19, Doppelganger.** `cards.md` Doppelganger and `rules.md` §21 require a non-Pawn to copy the opponent's most recently moved piece's kind without capture. Step 17 moved Black's Knight c8→b6; after step 18 endTurn, White used Knight a4→c5. The displacement is (2,1), the destination was empty, the same White Knight identity survived, and no capture occurred. The phase became afterMove with moveMade true; White discarded Doppelganger and drew Dubbing (deck 74→73), matching §8.2 and §9. Expected and actual agree. Copying a Knight with a Knight is limited coverage and does not retest the already reported Pawn-copy rejection.

Findings: no new defect established in the three reviewed transitions or structural/ordinary-chess checks. Prior finding summaries were read; the known Doppelganger Pawn-copy issue is not exercised here.

## Exact initial options and sequential accepted action/result evidence

Standard starting board; shuffled catalog decks are the §4.3 house variant. The `expected` values below are observed result digests, not independent semantic expectations.

```json
{
  "seed": 908096,
  "maxMoves": 20,
  "digestVersion": 2,
  "initial": {
    "hands": {
      "white": [
        "madman",
        "doppelganger",
        "toll",
        "holy-quest",
        "cowardice"
      ],
      "black": [
        "cowardice",
        "anathema",
        "crab",
        "challenge",
        "pacifism"
      ]
    },
    "decks": {
      "white": [
        "tournament",
        "dubbing",
        "confabulation",
        "panic",
        "sanctuary",
        "squaring-the-circle",
        "charge",
        "fanatic",
        "man-trap",
        "fog-of-war",
        "ghostwalk",
        "curse",
        "abduction",
        "no-quarter",
        "betrayal",
        "haunting-memories",
        "think-again",
        "treason",
        "dark-mirror",
        "breakthrough",
        "fireball",
        "passing-in-the-night",
        "bog",
        "truce",
        "crusade",
        "challenge",
        "evangelists",
        "peace-talks",
        "bombard",
        "vendetta",
        "legacy",
        "merciless",
        "holy-war",
        "pacifism",
        "dungeon",
        "mystic-shield",
        "forced-march",
        "disintegration",
        "chaos",
        "riposte",
        "assassin",
        "onslaught",
        "revenge",
        "cathedral",
        "masquerade",
        "earthquake",
        "figure-dance",
        "split-knight",
        "man-of-straw",
        "coup",
        "blessing",
        "doomsayer",
        "guardian",
        "fortification",
        "rebirth",
        "under-elf-hill",
        "anathema",
        "resurrection",
        "evil-eye",
        "long-jump",
        "plots-within-plots",
        "heresy",
        "knightmare",
        "irresistible-force",
        "lost-castle",
        "siege",
        "crab",
        "vulture",
        "winged-victory",
        "neutrality",
        "hostage",
        "forbidden-city",
        "fatal-attraction",
        "hidden-passage",
        "annexation"
      ],
      "black": [
        "panic",
        "lost-castle",
        "man-of-straw",
        "neutrality",
        "truce",
        "knightmare",
        "fireball",
        "charge",
        "dubbing",
        "madman",
        "cathedral",
        "curse",
        "haunting-memories",
        "assassin",
        "irresistible-force",
        "tournament",
        "bog",
        "evil-eye",
        "forced-march",
        "confabulation",
        "hostage",
        "doppelganger",
        "vendetta",
        "doomsayer",
        "blessing",
        "riposte",
        "passing-in-the-night",
        "winged-victory",
        "annexation",
        "disintegration",
        "fog-of-war",
        "bombard",
        "figure-dance",
        "fatal-attraction",
        "ghostwalk",
        "forbidden-city",
        "holy-quest",
        "fortification",
        "holy-war",
        "peace-talks",
        "breakthrough",
        "resurrection",
        "crusade",
        "think-again",
        "man-trap",
        "onslaught",
        "dark-mirror",
        "no-quarter",
        "hidden-passage",
        "under-elf-hill",
        "split-knight",
        "abduction",
        "rebirth",
        "squaring-the-circle",
        "toll",
        "treason",
        "earthquake",
        "chaos",
        "evangelists",
        "coup",
        "revenge",
        "guardian",
        "dungeon",
        "fanatic",
        "vulture",
        "masquerade",
        "betrayal",
        "mystic-shield",
        "legacy",
        "sanctuary",
        "plots-within-plots",
        "heresy",
        "siege",
        "merciless",
        "long-jump"
      ]
    }
  },
  "steps": [
    {
      "action": {
        "type": "move",
        "from": "e2",
        "to": "e4"
      },
      "expected": "47df165fc28b4442940fa6045c8e9424720c5eb7cd636aa334fa45284aef5c9f"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "holy-quest",
        "cardInstanceId": "white-hand-3-holy-quest",
        "target": {
          "bishop": "c8",
          "knight": "b8"
        }
      },
      "expected": "a37e75d4c899177e9601659dfe09859ddb0e896235d3c1fc11e9f2aa4ba2e8bd"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "f6b93e3ec0d00199baf55a79dd3a827a77b5da85bcc1c5bce8f1b3da464acf8a"
    },
    {
      "action": {
        "type": "move",
        "from": "e7",
        "to": "e5"
      },
      "expected": "2889bec464cd89d3ba1be5e06c2b500604db6cf8546ce2f61044ec495b5bdd27"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "f47ef88e8ef0dc3d69e587f0fa0e64591d3fe85f152b222283bc7ff6e67d06d4"
    },
    {
      "action": {
        "type": "move",
        "from": "f1",
        "to": "a6"
      },
      "expected": "3dbada761ccf99e2743d6a53642aa3a18d05293668d184433b8aabd42bc1ad44"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "4531eaa51a8d780f4ecb5a8bb8810e6d23c3b9f80671f2f05697356e21b42d0a"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "pacifism",
        "cardInstanceId": "black-hand-4-pacifism",
        "target": "b8"
      },
      "expected": "e2586f692be9acb04129a1459d676ddacba93728460ee922ac786c56695ed957"
    },
    {
      "action": {
        "type": "move",
        "from": "e8",
        "to": "e7"
      },
      "expected": "9dacc59542fdbcd89dcf185a2982a0d7553e52eb687f1e636099dc4188964676"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "6447685209ba67f6f46c61401fcaaceb25d27970d5f7cb6b35ba85ac1b76ee4b"
    },
    {
      "action": {
        "type": "move",
        "from": "b1",
        "to": "c3"
      },
      "expected": "28540217cbea7df33abc61fe722f0b40dc484312afd71b723015465616d6f59a"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "2ae0aeeffb8e9e125e5c4b6acebbcc65f7ca5a15a1e3be0c05da87a59512010f"
    },
    {
      "action": {
        "type": "move",
        "from": "h7",
        "to": "h5"
      },
      "expected": "8c34e53d9cf3fec3e0deeab5473aa8b544c82011aa2c6232c46fd3d3f76a8d36"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "087cb1078a97dabe60cc0f3768abba1a3183b767849b284dcd1466e3e1149c16"
    },
    {
      "action": {
        "type": "move",
        "from": "c3",
        "to": "a4"
      },
      "expected": "356444066a2bb0b951d06b833656f722a85c6796df757c967f46cad6c689d528"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "6e180ea98f1db06f37bd4f2db37b90120c6bc83da34c9791d5b38c9cc32c7c53"
    },
    {
      "action": {
        "type": "move",
        "from": "c8",
        "to": "b6"
      },
      "expected": "35cd39931c26d256e2a9cea45a550fc3e80f6fd5bcfdc8f743c70c570ca45fdd"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "521549b81ba35d59d1827cbca85ed4a2a38a23b9b1b95253ccb5915f1c70c9ce"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "doppelganger",
        "cardInstanceId": "white-hand-1-doppelganger",
        "target": [
          {
            "from": "a4",
            "to": "c5"
          }
        ]
      },
      "expected": "9a8d998cef98fba80f269ec7aadf8a799fa3591e7910e0a3625277dff0587d8a"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "2cbc46d98fdcbab41dee4d45db451073fc49e05251b9c670722a62bd5db9075b"
    },
    {
      "action": {
        "type": "move",
        "from": "d7",
        "to": "d5"
      },
      "expected": "b8adb56cf77d7c6dec84b4180a968bdce28b1c2a3974b65c6c7907bf86236d8d"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "d53235a2af821e7e98170242bccba7b86e1f0dcbcc22a060ac7abd54613b1c94"
    },
    {
      "action": {
        "type": "move",
        "from": "c2",
        "to": "c3"
      },
      "expected": "5b9dd0557503982b640c9aa41646e5f4e43848eb2e724a7f26a866e1276385eb"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "3a0395f2adaf0c1999cb7633383ff75884389e0d9d706eb457de33034577931e"
    },
    {
      "action": {
        "type": "move",
        "from": "e7",
        "to": "d7"
      },
      "expected": "7c818ee2c41663abf19544eb54dbc03b676259728aec4fdba9f930703b1bbe40"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "challenge",
        "cardInstanceId": "black-hand-3-challenge",
        "target": "g2"
      },
      "expected": "c8fdc138c1042d11b19a31846f2263244c39abacbe0a0a192e30ea0cf96e5a60"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "ce11e1f718ac969d311e9f23f1d92f14529e08c98add9cb708a0f35d4a8f69b7"
    },
    {
      "action": {
        "type": "move",
        "from": "g2",
        "to": "g4"
      },
      "expected": "cfdbc2ba104fd3fed57a734f273cd4dad4a7c10517f080bf9f325637de7cceaf"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "4eb2ff1d9b46964bf234d511a13d3142d27cce03e86549dfc9d878c40a508302"
    },
    {
      "action": {
        "type": "move",
        "from": "d7",
        "to": "e7"
      },
      "expected": "b44573f6b5d162844582a60174883a6800fc3b54caa30ee08f6cbbd3927f8ad0"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "crab",
        "cardInstanceId": "black-hand-2-crab",
        "target": "f7"
      },
      "expected": "d4a567737011530a99f6003f30fc62e25bdd80f46952c0f31e4121db077e9126"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "777d7c866039c4d6b27a890f0625c0879753386683622f92b5aaafae472e0f69"
    },
    {
      "action": {
        "type": "move",
        "from": "c5",
        "to": "a4"
      },
      "expected": "b37a793e786805a282cfc5983c74645ef389a04043ba76b38849d3801ec3ac3e"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "cowardice",
        "cardInstanceId": "white-hand-4-cowardice",
        "target": [
          {
            "from": "c7",
            "to": "c8"
          }
        ]
      },
      "expected": "b4556e5293f0b1153d63e00179aa5b477736ad8bd906a0761b2b649faaa74275"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "a78911a30001cfa7ca112c24ccfd162f610fc1575cd848f631ff921ba2a7a1d1"
    },
    {
      "action": {
        "type": "move",
        "from": "b6",
        "to": "d7"
      },
      "expected": "d7bd7adf73294b0f40fe9cc83393d69f22f20a75e32cba84015e84cbab5e502a"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "1371e278bb683de4dd29325f44bf7c04b26f798f901a249d0e2f7f0136bc992b"
    },
    {
      "action": {
        "type": "move",
        "from": "g1",
        "to": "f3"
      },
      "expected": "e6c0583ed9209039bea15edf547355f92c2f954b1108c1dac58ba5f18b9cdcf4"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "3559dd746c771aeadc55c564c18698c5fd8c8d50bb5aaf4e6c6606ecf3156e24"
    },
    {
      "action": {
        "type": "move",
        "from": "g7",
        "to": "g6"
      },
      "expected": "8fa86d79822cca7c2138b02ebd435c2d1b30f429f0b5d6ee904c982b5f78f1e6"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "54edf8dbfc9c07499a6ee39d31e3dae39fe5cca628ca1d325bfb77c3ad08e3ca"
    },
    {
      "action": {
        "type": "move",
        "from": "d1",
        "to": "b3"
      },
      "expected": "f5687ddb1b841e6f8e72f30e8f7ac73eae05b14251af22f49d8e5353a6404c98"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "e05d1b9654467770ccc317d5eb512793b13c5bfeeb2c5079313a3c9de1abe837"
    },
    {
      "action": {
        "type": "move",
        "from": "f8",
        "to": "g7"
      },
      "expected": "87eecd10fecd44d42c46a61e71f8cd6a1fdec050eeea9dac8521ff2d0dae1ba7"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "6e1e222972e5aa46d70604cdc18fef111bd6f7bd1cd7a57475fe6aae64edbc46"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "dubbing",
        "cardInstanceId": "white-deck-1-dubbing",
        "target": [
          {
            "from": "g4",
            "to": "e3"
          }
        ]
      },
      "expected": "2eaadcdf1e56e92ec6b76ad576b4e4ad640fc0cbf5c55d3b9d74490a4843bc2b"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "4b299caedbd36f2ef475886d325b92d9ab53fc291dbcf4d4197cc93eae244949"
    },
    {
      "action": {
        "type": "move",
        "from": "b7",
        "to": "a6"
      },
      "expected": "898b41fd95cc894b419b23df351fbd936e53c27b30b0e11a6a1623b4fb317d46"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "43dc9321f9e8baaedc2a812a32949be2e27488c6b38f8d14d899a8654e609da4"
    }
  ],
  "moves": 20,
  "finalFen": "rbpq2nr/p2nkpb1/p5p1/3pp2p/N3P3/1QP1PN2/PP1P1P1P/R1B1K2R w KQ - 0 12",
  "sampledCards": {
    "holy-quest": 2,
    "madman": 3,
    "tournament": 2,
    "cowardice": 5,
    "pacifism": 1,
    "challenge": 3,
    "toll": 6,
    "crab": 3,
    "anathema": 3,
    "doppelganger": 1,
    "panic": 5,
    "dubbing": 2,
    "lost-castle": 1,
    "confabulation": 1
  }
}
```

## Three retained transition snapshots

```json
[
  {
    "step": 2,
    "move": 1,
    "action": {
      "type": "playCard",
      "cardId": "holy-quest",
      "cardInstanceId": "white-hand-3-holy-quest",
      "target": {
        "bishop": "c8",
        "knight": "b8"
      }
    },
    "fen": [
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      "rbnqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
    ],
    "turn": [
      {
        "color": "white",
        "phase": "afterMove",
        "moveMade": true,
        "cardPlays": {
          "white": 0,
          "black": 0
        }
      },
      {
        "color": "white",
        "phase": "afterMove",
        "moveMade": true,
        "cardPlays": {
          "white": 1,
          "black": 0
        }
      }
    ],
    "pieces": [
      {
        "before": {
          "id": "black-knight-b8",
          "owner": "black",
          "role": "knight",
          "originalRole": "knight",
          "square": "b8",
          "zone": "board",
          "promoted": false,
          "royal": false,
          "neutral": false
        },
        "after": {
          "id": "black-knight-b8",
          "owner": "black",
          "role": "knight",
          "originalRole": "knight",
          "square": "c8",
          "zone": "board",
          "promoted": false,
          "royal": false,
          "neutral": false
        }
      },
      {
        "before": {
          "id": "black-bishop-c8",
          "owner": "black",
          "role": "bishop",
          "originalRole": "bishop",
          "square": "c8",
          "zone": "board",
          "promoted": false,
          "royal": false,
          "neutral": false
        },
        "after": {
          "id": "black-bishop-c8",
          "owner": "black",
          "role": "bishop",
          "originalRole": "bishop",
          "square": "b8",
          "zone": "board",
          "promoted": false,
          "royal": false,
          "neutral": false
        }
      }
    ],
    "effects": [
      [],
      []
    ],
    "events": [
      {
        "type": "cardPlayed",
        "cardId": "holy-quest",
        "target": {
          "bishop": "c8",
          "knight": "b8"
        },
        "movement": [
          {
            "from": "b8",
            "to": "c8"
          },
          {
            "from": "c8",
            "to": "b8"
          }
        ],
        "preservePreviousMove": true
      }
    ],
    "hands": [
      {
        "color": "white",
        "before": [
          "madman",
          "doppelganger",
          "toll",
          "holy-quest",
          "cowardice"
        ],
        "after": [
          "madman",
          "doppelganger",
          "toll",
          "cowardice",
          "tournament"
        ],
        "decks": [
          75,
          74
        ],
        "discard": [
          "holy-quest"
        ]
      },
      {
        "color": "black",
        "before": [
          "cowardice",
          "anathema",
          "crab",
          "challenge",
          "pacifism"
        ],
        "after": [
          "cowardice",
          "anathema",
          "crab",
          "challenge",
          "pacifism"
        ],
        "decks": [
          75,
          75
        ],
        "discard": []
      }
    ],
    "enPassant": [
      {
        "target": "e3",
        "pawnId": "white-pawn-e2"
      }
    ],
    "pendingRescue": false
  },
  {
    "step": 8,
    "move": 3,
    "action": {
      "type": "playCard",
      "cardId": "pacifism",
      "cardInstanceId": "black-hand-4-pacifism",
      "target": "b8"
    },
    "fen": [
      "rbnqkbnr/pppp1ppp/B7/4p3/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2",
      "rbnqkbnr/pppp1ppp/B7/4p3/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2"
    ],
    "turn": [
      {
        "color": "black",
        "phase": "beforeMove",
        "moveMade": false,
        "cardPlays": {
          "white": 0,
          "black": 0
        }
      },
      {
        "color": "black",
        "phase": "beforeMove",
        "moveMade": false,
        "cardPlays": {
          "white": 0,
          "black": 1
        }
      }
    ],
    "pieces": [],
    "effects": [
      [],
      [
        {
          "type": "pacifism",
          "owner": "black",
          "card": {
            "id": "black-hand-4-pacifism",
            "cardId": "pacifism"
          },
          "pieceId": "black-bishop-c8"
        }
      ]
    ],
    "events": [
      {
        "type": "cardPlayed",
        "cardId": "pacifism",
        "target": "b8",
        "movement": [],
        "preservePreviousMove": false
      }
    ],
    "hands": [
      {
        "color": "white",
        "before": [
          "madman",
          "doppelganger",
          "toll",
          "cowardice",
          "tournament"
        ],
        "after": [
          "madman",
          "doppelganger",
          "toll",
          "cowardice",
          "tournament"
        ],
        "decks": [
          74,
          74
        ],
        "discard": [
          "holy-quest"
        ]
      },
      {
        "color": "black",
        "before": [
          "cowardice",
          "anathema",
          "crab",
          "challenge",
          "pacifism"
        ],
        "after": [
          "cowardice",
          "anathema",
          "crab",
          "challenge",
          "panic"
        ],
        "decks": [
          75,
          74
        ],
        "discard": []
      }
    ],
    "enPassant": [],
    "pendingRescue": false
  },
  {
    "step": 19,
    "move": 8,
    "action": {
      "type": "playCard",
      "cardId": "doppelganger",
      "cardInstanceId": "white-hand-1-doppelganger",
      "target": [
        {
          "from": "a4",
          "to": "c5"
        }
      ]
    },
    "fen": [
      "rb1q1bnr/ppppkpp1/Bn6/4p2p/N3P3/8/PPPP1PPP/R1BQK1NR w KQ - 2 5",
      "rb1q1bnr/ppppkpp1/Bn6/2N1p2p/4P3/8/PPPP1PPP/R1BQK1NR b KQ - 3 5"
    ],
    "turn": [
      {
        "color": "white",
        "phase": "beforeMove",
        "moveMade": false,
        "cardPlays": {
          "white": 0,
          "black": 0
        }
      },
      {
        "color": "white",
        "phase": "afterMove",
        "moveMade": true,
        "cardPlays": {
          "white": 1,
          "black": 0
        }
      }
    ],
    "pieces": [
      {
        "before": {
          "id": "white-knight-b1",
          "owner": "white",
          "role": "knight",
          "originalRole": "knight",
          "square": "a4",
          "zone": "board",
          "promoted": false,
          "royal": false,
          "neutral": false
        },
        "after": {
          "id": "white-knight-b1",
          "owner": "white",
          "role": "knight",
          "originalRole": "knight",
          "square": "c5",
          "zone": "board",
          "promoted": false,
          "royal": false,
          "neutral": false
        }
      }
    ],
    "effects": [
      [
        {
          "type": "pacifism",
          "owner": "black",
          "card": {
            "id": "black-hand-4-pacifism",
            "cardId": "pacifism"
          },
          "pieceId": "black-bishop-c8"
        }
      ],
      [
        {
          "type": "pacifism",
          "owner": "black",
          "card": {
            "id": "black-hand-4-pacifism",
            "cardId": "pacifism"
          },
          "pieceId": "black-bishop-c8"
        }
      ]
    ],
    "events": [
      {
        "type": "cardPlayed",
        "cardId": "doppelganger",
        "target": [
          {
            "from": "a4",
            "to": "c5"
          }
        ],
        "movement": [
          {
            "from": "a4",
            "to": "c5"
          }
        ],
        "preservePreviousMove": false
      }
    ],
    "hands": [
      {
        "color": "white",
        "before": [
          "madman",
          "doppelganger",
          "toll",
          "cowardice",
          "tournament"
        ],
        "after": [
          "madman",
          "toll",
          "cowardice",
          "tournament",
          "dubbing"
        ],
        "decks": [
          74,
          73
        ],
        "discard": [
          "holy-quest",
          "doppelganger"
        ]
      },
      {
        "color": "black",
        "before": [
          "cowardice",
          "anathema",
          "crab",
          "challenge",
          "panic"
        ],
        "after": [
          "cowardice",
          "anathema",
          "crab",
          "challenge",
          "panic"
        ],
        "decks": [
          74,
          74
        ],
        "discard": []
      }
    ],
    "enPassant": [],
    "pendingRescue": false
  }
]
```

## Limits and protocol timing

Only this Markdown report was written; no code, tests, harness, configuration or commits were changed. No test sources were inspected and no tests were run. The one game stayed within its callback budget. The total assignment exceeded the 45-second turnaround target during source review and reporting; exact total assignment wall time was not instrumented. First report update and scaffold were prompt, but exact 15/30-second checkpoint compliance was not measured. An overbroad named-file rules search produced truncated source output, followed by bounded relevant reads; the game output itself was fully retained and was never rerun. Seven cards were played, but only the three above received independent detailed semantic review. Finite coverage is not proof of correctness.

GAME_096_DONE
