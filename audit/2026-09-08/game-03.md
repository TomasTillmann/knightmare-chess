# Game 03 audit

Scope: one seeded random multi-card self-play game, seed 9080301, at most 60 steps and a 45-second execution budget. No production or test changes.

Before play, expected invariants: piece identities stay unique; FEN and board agree; royal pieces cannot be captured; rejected actions leave their input state unchanged. Card transitions should preserve card identity and implement the timing, movement, and restrictions stated in rules.md/cards.md.

Status: complete. Scaffold printed `SCAFFOLD_OK` (exit 0). Exactly one seeded game executed: 60 Regular Moves, 128 accepted actions, six card plays, no generated failure. Generator wall time: 2,989 ms. No second game or replay was run.

## Independent card-event review

The following expectations were derived from cards.md and rules.md, then compared against the recorded deltas. They are retrospective checks; only the global invariants above were recorded before generation.

| Steps | Expected from rules | Observed | Result |
| --- | --- | --- | --- |
| 7 | Confabulation merges h8 Rook into friendly h7 Pawn, retaining both physical identities and consuming the Regular Move; h8 castling right expires. | One board representative at h7; Rook retained away in composite; black kingside castling removed; move consumed; replacement drawn. | Matches cards.md Confabulation and rules.md 15.4. |
| 42, 46, 58 | Fatal Attraction marks b4 Pawn; c2-c3 may enter its adjacent area, while magnet may itself move; b4xc5 then removes the marker and releases neighbors. | No board mutation when marked; c2-c3 accepted; b4xc5 captures frozen Knight and removes/discards Fatal Attraction. | Matches rules.md 18.6; entering a frozen area is allowed, and frozen pieces remain capturable. |
| 58-59 | White b4xc5 crosses frontier toward Black; Toll may remove White's selected Pawn without undoing paid-for move. | a2 Pawn captured by Black, c5 Pawn remains, no clock or move increment. | Matches cards.md Toll. API target is interpreted as payer's selected payment; trace alone cannot establish who chose it. |
| 73, 85, 93, 97, 100 | Composite may use Rook movement despite its Pawn board representative; capture of composite must capture both components and remove effect. | h7xh3, h3-h2, h2-g2, g2xe2 use clear Rook lines; White King e1xe2 captures both physical IDs, discards Confabulation. | Matches rules.md 15.4. The seemingly illegal sideways Pawn moves are correct composite behavior. |
| 77 | Blessing allows c7-b8 diagonal quiet move; a Black Pawn on its own back rank does not promote. | c7-b8 succeeds, remains Pawn, consumes move, resets halfmove clock, replaces/discards card. | Matches cards.md Blessing and rules.md 21. |
| 98 | Anathema exchanges opposing Bishop c1 and Rook f3 simultaneously, preserving physical roles and identities; no additional move consumed. | Bishop appears f3, Rook c1; existing Black move preserved; FEN clocks unchanged; card replaced/discarded. | Matches rules.md 20. |
| 118-119 | Black e5xf4 crosses frontier toward White; Toll may take Black g6 Pawn without undoing the paid-for capture. | g6 captured by White; f4 Black Pawn remains; clocks unchanged. | Matches cards.md Toll. |

## Findings and limits

Confirmed bugs: **0** in this game. Independent reviewed critical event groups: **7**, including all **6** card plays and composite capture/expiry. Automated structural checks covered all 128 accepted transitions; candidate evaluation checked input immutability, and the scaffold additionally checked a rejected malformed move. Candidate-attempt count is not exposed and is not claimed.

This bounded seed sampled few distinct successful cards and did not exercise promotion, cancellation chains, or late deck exhaustion. No claim of general correctness follows from this result. No production or test files were read or edited.

**GAME_03_DONE** — scaffold: 1 pass; independent seeded game: 1; moves: 60; actions: 128; card plays: 6; reviewed critical groups: 7; confirmed findings: 0; generator wall time: 2,989 ms.

## Recorded game

```json
{
  "seed": 9080301,
  "maxMoves": 60,
  "digestVersion": 2,
  "initial": {
    "hands": {
      "white": [
        "betrayal",
        "legacy",
        "fatal-attraction",
        "pacifism",
        "holy-quest"
      ],
      "black": [
        "toll",
        "no-quarter",
        "confabulation",
        "peace-talks",
        "forbidden-city"
      ]
    },
    "decks": {
      "white": [
        "toll",
        "under-elf-hill",
        "curse",
        "hostage",
        "irresistible-force",
        "vendetta",
        "split-knight",
        "challenge",
        "fortification",
        "forced-march",
        "resurrection",
        "hidden-passage",
        "man-trap",
        "plots-within-plots",
        "breakthrough",
        "annexation",
        "long-jump",
        "fireball",
        "tournament",
        "confabulation",
        "no-quarter",
        "crusade",
        "cathedral",
        "fog-of-war",
        "coup",
        "man-of-straw",
        "figure-dance",
        "evil-eye",
        "doppelganger",
        "haunting-memories",
        "dubbing",
        "passing-in-the-night",
        "bombard",
        "dark-mirror",
        "lost-castle",
        "anathema",
        "masquerade",
        "abduction",
        "blessing",
        "disintegration",
        "earthquake",
        "neutrality",
        "heresy",
        "fanatic",
        "bog",
        "crab",
        "siege",
        "cowardice",
        "truce",
        "assassin",
        "treason",
        "guardian",
        "mystic-shield",
        "merciless",
        "evangelists",
        "knightmare",
        "ghostwalk",
        "charge",
        "forbidden-city",
        "peace-talks",
        "think-again",
        "dungeon",
        "doomsayer",
        "onslaught",
        "winged-victory",
        "vulture",
        "squaring-the-circle",
        "sanctuary",
        "riposte",
        "holy-war",
        "revenge",
        "chaos",
        "madman",
        "panic",
        "rebirth"
      ],
      "black": [
        "blessing",
        "anathema",
        "riposte",
        "truce",
        "dungeon",
        "pacifism",
        "disintegration",
        "long-jump",
        "crab",
        "think-again",
        "neutrality",
        "cathedral",
        "fog-of-war",
        "earthquake",
        "fortification",
        "cowardice",
        "bog",
        "sanctuary",
        "forced-march",
        "masquerade",
        "man-trap",
        "split-knight",
        "bombard",
        "treason",
        "onslaught",
        "passing-in-the-night",
        "fatal-attraction",
        "fireball",
        "evil-eye",
        "fanatic",
        "hidden-passage",
        "evangelists",
        "plots-within-plots",
        "dubbing",
        "mystic-shield",
        "winged-victory",
        "ghostwalk",
        "coup",
        "siege",
        "tournament",
        "chaos",
        "vulture",
        "crusade",
        "irresistible-force",
        "holy-quest",
        "dark-mirror",
        "man-of-straw",
        "hostage",
        "panic",
        "revenge",
        "doppelganger",
        "assassin",
        "lost-castle",
        "madman",
        "curse",
        "resurrection",
        "knightmare",
        "squaring-the-circle",
        "challenge",
        "under-elf-hill",
        "merciless",
        "figure-dance",
        "charge",
        "guardian",
        "annexation",
        "haunting-memories",
        "rebirth",
        "legacy",
        "betrayal",
        "breakthrough",
        "doomsayer",
        "heresy",
        "holy-war",
        "abduction",
        "vendetta"
      ]
    }
  },
  "steps": [
    {
      "action": {
        "type": "move",
        "from": "g1",
        "to": "h3"
      },
      "expected": "d46d9aef666face171ae8b8cb0325ac9fabfcdf15e39673435608a1d8109ed41"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "eebe0b4fc37c1b8779c170b1cb4916b33befd992eab3e7a5bdb58670959dbc1e"
    },
    {
      "action": {
        "type": "move",
        "from": "e7",
        "to": "e5"
      },
      "expected": "8c0f5079df585df569fe8dd5e1220715cfe784733df3ffcfa30941d566733fbc"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "89654c890582df2527bbfc8804d972d9478c0f8d87ae8dd382144c91428f4c4e"
    },
    {
      "action": {
        "type": "move",
        "from": "e2",
        "to": "e4"
      },
      "expected": "b8fc5356a21a5d0085b3e4de817f2a1f11c6965a6b558e0b22d9b868fd689a88"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "ac99282f6bb77572397ec781cc4d63eaab1f369c5fef38a68bfec5871f753171"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "confabulation",
        "cardInstanceId": "black-hand-2-confabulation",
        "target": [
          {
            "from": "h8",
            "to": "h7"
          }
        ]
      },
      "expected": "708f5915c4f9ede208046f8f122494c367bf62e06ba3821b7e4500f264f0ba8d"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "99e128dfe66620e382c62e0d38cca0b843fe3ff8117dba86b047137be700b4a7"
    },
    {
      "action": {
        "type": "move",
        "from": "f1",
        "to": "a6"
      },
      "expected": "899062cd4d135a1b3611ffc07cc5568a9a7b44d254bc40ef1b723c7cdc81d826"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "4f2fd30853f9e3da189b9df4541aef4e4a2d2140ccdc9664861d570b56fadde8"
    },
    {
      "action": {
        "type": "move",
        "from": "e8",
        "to": "e7"
      },
      "expected": "932c4b2a14c0b9251f29770db88c387b95bcc629a4dd48d771e62843de286174"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "f27a34305e9b38a8729db7bd793217351d4ea71b2d4089081edce88d6c268aed"
    },
    {
      "action": {
        "type": "move",
        "from": "a6",
        "to": "c4"
      },
      "expected": "62ab0eb404bfe178ee92402248508deac61cb37dbac218822c27ae4df37a90fe"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "e43cf53135ac1a85b6fe3658d548056a81f3a71959ef7d346dbb358fbd4126d2"
    },
    {
      "action": {
        "type": "move",
        "from": "e7",
        "to": "e8"
      },
      "expected": "49474fda9c228346567ecb4342d5f8e104e2b75b521776b4a49a360119161dbf"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "bc5f78096628c1ece9d7851befe3095fef55d21becd529f67ca165fac416997d"
    },
    {
      "action": {
        "type": "move",
        "from": "c4",
        "to": "d5"
      },
      "expected": "db7c6211b12046c7f10a1e577863b7cc6dde59051b9ce3c42086ac5ff385a032"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "004e2dc7f3fbabfdfcc5106186a5780eadbb5d4c1cccbf73d0a0f250d61de4a6"
    },
    {
      "action": {
        "type": "move",
        "from": "b8",
        "to": "a6"
      },
      "expected": "56c29d0c4de9f384377cca8aaad07c3a5fe6bc58e028cee81d07d4db0aeb41a9"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "6d2ff4cad004c01aa710189eb9d7d17822e353bfc5c948b3b184331baf187d1a"
    },
    {
      "action": {
        "type": "move",
        "from": "d5",
        "to": "f7"
      },
      "expected": "d60187f3fcba5ee85d59f4f8daefabffe79571f6e813a9f08b12fb80c64c68c8"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "6665d5ab19633284926f8baed9970297f52e42a4fc464b2f4897a51fbfeef748"
    },
    {
      "action": {
        "type": "move",
        "from": "e8",
        "to": "e7"
      },
      "expected": "e8610d796221b6bac749648ccf1ee032fb685d58a2e20a2f0e656bda9ea3f250"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "a45da2f78abfdeeb2978b413c3130f5e9ce50c80c146f93f442d643de5d538d2"
    },
    {
      "action": {
        "type": "move",
        "from": "f7",
        "to": "e6"
      },
      "expected": "e417175b18ca91bdd39984060d191781a5433e29cfa375cd42986cd3d4d20c86"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "20b05664ac1efb62c781eba7bee2dfb7126cad8234b8d3ec2963b6243d8a2276"
    },
    {
      "action": {
        "type": "move",
        "from": "a6",
        "to": "c5"
      },
      "expected": "0ca07e3f53a759d8f118f2d62a829d98e66d67e590d02d6a548ad26ea5425b2f"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "82647deff5befbdd3d0dc62f7ba7c3e4c491d8cd2672075bf7a6eacb1b1799ce"
    },
    {
      "action": {
        "type": "move",
        "from": "e6",
        "to": "g8"
      },
      "expected": "cb53a1fe28a6c40b7305af14c6b318de85383babba20d49d8400b3edae06422f"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "cf73b84f63d2fce84b6d198033c262d977c6cfca031279f75be0eec4d5009ce5"
    },
    {
      "action": {
        "type": "move",
        "from": "d8",
        "to": "e8"
      },
      "expected": "db708667b416af212144f6ca3499dc3c48e2725e6c1399a387859f25cedec3bb"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "2735873e2b052cdeee87e4f5b4222a2130e483aaa8876f6b14694ddc8e4b14f3"
    },
    {
      "action": {
        "type": "move",
        "from": "h3",
        "to": "g5"
      },
      "expected": "d7794f42c9d63d78da04ccfc273ed5435396d1b9628efcc53e4b31e36a37bc9a"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "5d3940e666f1d180d1a89963b04397474a2a7f769dc5322aee26ac7b310ed879"
    },
    {
      "action": {
        "type": "move",
        "from": "d7",
        "to": "d6"
      },
      "expected": "098ff3cd9de3e8175ed79f7a7a3aabb7e0bd569afa55dc8dedc561adee03c27f"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "101bd3e2171d173cfa39259fc8f09c28416f53324ae3cdf274515ca9da2ae94b"
    },
    {
      "action": {
        "type": "move",
        "from": "b2",
        "to": "b4"
      },
      "expected": "1dfbeb95d3987d0be93fa6f116304614b6e519c65c3a3c27410b600027661d11"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "29c73a1ce40855c219b079cce19403de4808eb317e3347aa22fcadae7bf2744f"
    },
    {
      "action": {
        "type": "move",
        "from": "c8",
        "to": "g4"
      },
      "expected": "e94566c59af9fd8a4c4c777088c9e79f955ba7e20f36d956084e9678951dabb0"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "a37df942c5b1463df1c56fa80bc30c9572b4abbd4b2554cb1f3d6550624cfbf3"
    },
    {
      "action": {
        "type": "move",
        "from": "h1",
        "to": "f1"
      },
      "expected": "b7bf3beb1b2f3decaced7ff59edce5d43b00ce1e3183c8c278f559bfbb2ed297"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "fatal-attraction",
        "cardInstanceId": "white-hand-2-fatal-attraction",
        "target": "b4"
      },
      "expected": "025f9fd1560419569ab23a7a2d3ce22b37bdd952129138450050daf95dcb4357"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "bb3b55a96ec558e90ff870e89251072871b6fc26da0a495e67b1b8a8b66651de"
    },
    {
      "action": {
        "type": "move",
        "from": "b7",
        "to": "b6"
      },
      "expected": "52cd13c1d1f206aa90c3fced5d58a655a3359f9b7fde786075a376948f86a827"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "f4fd2e8b6c1e201713dc5ccc2d36c3b5b4e45d9bad06e6476f62ad1711d5c52f"
    },
    {
      "action": {
        "type": "move",
        "from": "c2",
        "to": "c3"
      },
      "expected": "b57fd57c9fc9b68c679c57a68607887d96be5ac7f5ec4edc104c97a197acaa4c"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "88fbfe25251434aea39d76df9b4449627c358892e3d952b7d5314bcf2bb9d9e3"
    },
    {
      "action": {
        "type": "move",
        "from": "g4",
        "to": "e6"
      },
      "expected": "c7f0429809891991fa7b2b91d52cf1591d4c3267fd8104dd7d00c7062f3100e0"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "e3a7c3d58b63c08cd908d3584472fb89d86a8f3cab358d88f38946d1ff5ca235"
    },
    {
      "action": {
        "type": "move",
        "from": "f2",
        "to": "f4"
      },
      "expected": "d80599545da8a521ba7a5c948ff4f4716cf632ab4819d7811316a96a99780ce6"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "f95ae4dcf39c8cccab3d0b8d9a9108b99dc179394b0ba55570176abe21d19db4"
    },
    {
      "action": {
        "type": "move",
        "from": "e7",
        "to": "f6"
      },
      "expected": "91edff024853daa5a4e78c01dc6c10b72937cae3dd90494d8239ad414e4cc3ee"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "f74fd3dd75586eb1057f897c5bf8fd80b892a14602499d78c6f5edd461b974df"
    },
    {
      "action": {
        "type": "move",
        "from": "f1",
        "to": "f3"
      },
      "expected": "06a141fe12d8824bf65f9c708e709f3f731481edeb7e817fa6316e21f862c3f7"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "262d6102c4b0a2fcfb3a0e7ae69ddf1f478480b74bd0b5bea9784fdc3faad036"
    },
    {
      "action": {
        "type": "move",
        "from": "e6",
        "to": "d7"
      },
      "expected": "208f052cc487a4ccfa1d78aea6c01c214bc025a82a44d579d2b6d5ddc8c3a7bc"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "c85a0e0def96be65e5e881898bace64a4e22d036ecf43d7bdf659407a386221a"
    },
    {
      "action": {
        "type": "move",
        "from": "b4",
        "to": "c5"
      },
      "expected": "2a1f782f9d737f587a58342069c38b6151df7484e3d0f83c6fe7caa2903dfb52"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "toll",
        "cardInstanceId": "black-hand-0-toll",
        "target": "a2"
      },
      "expected": "c9a10b49d9d4b909edadad701be3a0126af8d4d9e24a8175eaf27164df821d6c"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "7e4505da3fee8f6f8d51f7270ea32ddeb97fd915d4182a0cfa7de11269f19ecc"
    },
    {
      "action": {
        "type": "move",
        "from": "d7",
        "to": "e6"
      },
      "expected": "be716faebfab4497efe52939a44df6df60d6a1226c2463080556c7f73ed822ac"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "5d2b708c5df91e9a99eb881bc7da8af8b6ce26cd59f20eb69c53160ee41f29ea"
    },
    {
      "action": {
        "type": "move",
        "from": "g2",
        "to": "g3"
      },
      "expected": "4bc17df800b2d0046db922e7ec39900f542f19ca2fc6fb0f441f6a16de9dde7e"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "7e86628b3e1fa10610909e9ed1cf7ba284f7351542e147c55ac12daa3f1ced70"
    },
    {
      "action": {
        "type": "move",
        "from": "a7",
        "to": "a5"
      },
      "expected": "1b4d877340bd62e1fb3276fd18a82e7fe0549e2854af06d4e893ea8da2e50c7d"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "5152d55f58047bf183f807cd840957ef6a1e2c6fc0544c7e37b79e8328db1810"
    },
    {
      "action": {
        "type": "move",
        "from": "h2",
        "to": "h3"
      },
      "expected": "074820b5b810a63dc52dd01de2baafc6bea6128651407ebfa07a5e0636bdfa04"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "8d2aae3247c9ceb65aa0ce9a42764d89c31d24cb4f4ceb25f5319bde93fcffbd"
    },
    {
      "action": {
        "type": "move",
        "from": "g7",
        "to": "g6"
      },
      "expected": "a124dbc7115befccdb959022da1f74be65a113c170b296b2686debfc57653f04"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "7c9d5054718cde7781a9db36ff97a821ea82c10d2a552bc0adda0b6e0386b70d"
    },
    {
      "action": {
        "type": "move",
        "from": "a1",
        "to": "a4"
      },
      "expected": "bff6df358b480f81ec5e4fbb5f42c1c461de9c9b8c4f8559200a10a6e8f4d667"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "36154b20d219ab2360816ffe685c331ef4fc38595767f28f9cb49acb6acd9b1f"
    },
    {
      "action": {
        "type": "move",
        "from": "h7",
        "to": "h3"
      },
      "expected": "5c42d8a8f8201d08e1466470aaaef8be7b13add78dcb01e371e7bb222a275dff"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "e536f60b4486a8e6740181bd8ea3cb254a6d02ce96d46ff908e8c9707f7285fc"
    },
    {
      "action": {
        "type": "move",
        "from": "a4",
        "to": "a1"
      },
      "expected": "d90ef0963d5a5bc173ecb9629f7ab24fed8ce12fd55ad878d5c174c9cd8f45df"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "3f947e9f4002501640d6cbf1cf7d9076687f7dbf37d0c3b6736fe0925d666895"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "blessing",
        "cardInstanceId": "black-deck-0-blessing",
        "target": [
          {
            "from": "c7",
            "to": "b8"
          }
        ]
      },
      "expected": "0fcc24b88dc17325e5b797f2d1df7f96b29df036b76af9ed8c43590bd0442707"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "c065e08168e899b79510d3aa95d1e8907a86d2376e2cd7d8b17132ff1d000116"
    },
    {
      "action": {
        "type": "move",
        "from": "g8",
        "to": "f7"
      },
      "expected": "2d9afe60e1dab34414ac1609850d31ccde9a37f6bc1cdd44e3a9e9c60ceaae00"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "c9757877a6c395dfadf1eca1a7e1e3b1fa31dec913fffe7ba51b13e75e32a684"
    },
    {
      "action": {
        "type": "move",
        "from": "e8",
        "to": "f7"
      },
      "expected": "85c9a049a405b3f5d899f1a98e3d1433bde28c80ba182a8a0ab89dfd71ecd3e5"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "b540383cb1bc5b503ec80770107f6f10d61015f382195fdee78b0edfd371d0c2"
    },
    {
      "action": {
        "type": "move",
        "from": "c5",
        "to": "d6"
      },
      "expected": "6e6e2e4aa964bc516ff1c2e45b9ecf06780c4ba380a6d25c7c25b4722bd3b932"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "90e19ef816a67b9fca0239ee83cb0ee905a53a8294b2fd215df727920984b1eb"
    },
    {
      "action": {
        "type": "move",
        "from": "h3",
        "to": "h2"
      },
      "expected": "f76066d0e2478573eb9df25ae9817d88f7c66b30225461a6531999a315c7c663"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "b7bd2722c7efe40b173ce096c36602dcc11e2f920697f9d5b397f176086445f4"
    },
    {
      "action": {
        "type": "move",
        "from": "d1",
        "to": "e2"
      },
      "expected": "0426933ab1317d48be6dc595aed06d1d95c7cc5311cf71e464c0f77c614951ed"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "dd2eb0d9f6cf3cf749bc0408afe7e950f9f36481f7a1d8f943e8099caebe2bca"
    },
    {
      "action": {
        "type": "move",
        "from": "f8",
        "to": "e7"
      },
      "expected": "d7981417071b673d0d9d7f7f8c72b69e749e2d5e24999dff0c8d43ce6a2701bd"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "f68e1318b52c81aacbd1faed8ea06b3500f669d2221d4f762da78591b66284ec"
    },
    {
      "action": {
        "type": "move",
        "from": "g5",
        "to": "e6"
      },
      "expected": "00de4f6ef0b597ab2d6315aaf11f3f015deeee2e40370175d66800fac6487d5c"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "9fabb25f63bb6823ed038b6e95e55f17b47da86865c88928984d7c5bb49a8631"
    },
    {
      "action": {
        "type": "move",
        "from": "h2",
        "to": "g2"
      },
      "expected": "4f4da09dcbdea3d6c8246cf11e02e409895c988a9fc856b1924787f7308f16f9"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "a7873fb85218872f55e1918b8b0d99677745321d61cc83a013f9f5a95180af95"
    },
    {
      "action": {
        "type": "move",
        "from": "c3",
        "to": "c4"
      },
      "expected": "6c5dcd933e49f8934be33f2649ab4e8896b9a2d1e81e43207471e730497a935a"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "622d92873e520f7009f2f098e3a6e646d4995603b31d5fe61374f107bbe8e181"
    },
    {
      "action": {
        "type": "move",
        "from": "g2",
        "to": "e2"
      },
      "expected": "28774a94eb18c80cb8503d3e9f7a99cee7c04877ad71b5cfea21f05453971401"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "anathema",
        "cardInstanceId": "black-deck-1-anathema",
        "target": {
          "bishop": "c1",
          "rook": "f3"
        }
      },
      "expected": "88408056cb1e62e094186f358aa9d69483f1364c322621791a2d044bec8fa774"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "8c7556f0cb8c47c8b4eb67367e63197ba841080b4ad53b7fe99c4c0a13faeb72"
    },
    {
      "action": {
        "type": "move",
        "from": "e1",
        "to": "e2"
      },
      "expected": "07331d7ea059ff2630ff44d2a6514a79b41bc9fde44358ec743cbaaf5d2265c7"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "f52456ab77fcf11f46ffd4834c08aeda99671ec3abcf45750cf6f527a4be169e"
    },
    {
      "action": {
        "type": "move",
        "from": "f7",
        "to": "g7"
      },
      "expected": "ad0f3a63079eb1ec45ba6b7fb5d5a6bf89c6109099ee806013b11a65b1b6cf57"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "be918f42a2495505cdbc2871e38850db9411caabfb47afdf3e50dd9b51ced93d"
    },
    {
      "action": {
        "type": "move",
        "from": "e2",
        "to": "d3"
      },
      "expected": "8ac9137e432146104bb742d98d29a0d4a5f12f97d6d0c0b06fe187506045b6e3"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "b6f08b745cbdefdf05cfa7941e7e3e3f8aa4b687e489cfc981cfa84e7742109d"
    },
    {
      "action": {
        "type": "move",
        "from": "e7",
        "to": "f8"
      },
      "expected": "69519732cdbf7e6309ffb71e019d51419060cb3fc86b7dc2d2aef05253e1f49f"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "b8ce0311d6a382f3e1ca8bca0502e749fabfb4057a91a8e504e400acac697955"
    },
    {
      "action": {
        "type": "move",
        "from": "a1",
        "to": "a5"
      },
      "expected": "1401bdc7d5140f7cf2cf4cf302a68d480ca88acb00a18d734e2fe5307c9a690d"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "62fa7a6d2f2ab7290fe3053dc27e229a03aa16a744dd41646eb9cb8a13562786"
    },
    {
      "action": {
        "type": "move",
        "from": "a8",
        "to": "a6"
      },
      "expected": "31103f00e3351729395f21e67931b45f5d7c7e42449ce30f24e00c97be63696d"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "a3ea7b71915f50676bc9ae2c6bdb07b6567e0e7e67a8326c8a08b9a67f8723aa"
    },
    {
      "action": {
        "type": "move",
        "from": "c4",
        "to": "c5"
      },
      "expected": "892f05a38e4dea767617f99daaace3c096b79f51cfab3e2966622dd43b5557a9"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "7db2dccfe51828c4492d340ec99c782524953aad7358135b80338290f15eb9bf"
    },
    {
      "action": {
        "type": "move",
        "from": "b6",
        "to": "a5"
      },
      "expected": "b6e48d2e69f0fc151c647d304a7252db82b77570ab80903bd0d9e451007a8dbc"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "f0a38c864b3103908edc03d7acaafb79cdd5c44d807fc5a44ea895faf7d453aa"
    },
    {
      "action": {
        "type": "move",
        "from": "e6",
        "to": "d4"
      },
      "expected": "04576f8ca97d76495a3d5fc7cfd42beba1123ac9bd42d07fe3f78f6f5732464e"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "50b64a6d07460caafd49d2fcbc044fbb002398adbb6d4195c5f89f5ce7347c1b"
    },
    {
      "action": {
        "type": "move",
        "from": "e5",
        "to": "f4"
      },
      "expected": "202a6e5a8e528618057337561f25f66b06ebbf620d8fe805fec48e5fb46665f9"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "toll",
        "cardInstanceId": "white-deck-0-toll",
        "target": "g6"
      },
      "expected": "6554a7b39b0bbbd824126a895901fc6c82eb67c07f2911fd7e68e4cd13b60c3e"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "3f1b4066458ad4e806bde466231568874d9d1399c895dd588c34a6085752eb65"
    },
    {
      "action": {
        "type": "move",
        "from": "c1",
        "to": "f1"
      },
      "expected": "87147cefb1fe73a89fe2e4795b68e068e5804c1da76b6bda465d882c4a7116b9"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "2b16a841967e6305c3d35f4e7ff36dc65c9a69841df49899cdf0c93ef98fdc44"
    },
    {
      "action": {
        "type": "move",
        "from": "g7",
        "to": "g3"
      },
      "expected": "656134dab544480e9bf7ae92c6a100bc30370db3d3e3d41415c4a0772c994b99"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "9a6f36df51a9cb283f6dde68ef511c971f544b8ce44cb8d4d7babf73bcba620e"
    },
    {
      "action": {
        "type": "move",
        "from": "d3",
        "to": "c2"
      },
      "expected": "63d50a8c4974bb943d99d69ff4e464c9318f8835ea0fe40fab6b66a37d2a9ea2"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "36b1f48ab886e8bb1595bf29c7f3c3bc39317c930c4fb0c428a6187ae5bb7fe5"
    },
    {
      "action": {
        "type": "move",
        "from": "g3",
        "to": "h4"
      },
      "expected": "4f2a241f9eb31ea10fed7ce11d16ab3eb8434409c565555408f75fc7937a9e08"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "57b3d6cdaa63241fbb29f0c1410350e133d79a114b87185c33bc11586a526c99"
    }
  ],
  "moves": 60,
  "finalFen": "1p3b2/8/r2P1k2/p1P5/3NPp1q/5B2/2KP4/1N3R2 w - - 2 32",
  "sampledCards": {
    "forbidden-city": 10,
    "betrayal": 9,
    "no-quarter": 14,
    "legacy": 9,
    "confabulation": 1,
    "toll": 8,
    "fatal-attraction": 3,
    "blessing": 5,
    "pacifism": 4,
    "peace-talks": 4,
    "holy-quest": 7,
    "anathema": 3,
    "riposte": 3,
    "under-elf-hill": 1
  }
}
```

## Action deltas

```jsonl
Seed 9080301; standard starting board; shuffled catalog house-variant decks (rules §4.3).
Each row must be independently reviewed against rules.md/cards.md; hashes alone are not an oracle.
{"step":1,"move":1,"action":{"type":"move","from":"g1","to":"h3"},"fen":["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","rnbqkbnr/pppppppp/8/8/8/7N/PPPPPPPP/RNBQKB1R b KQkq - 1 1"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"g1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"h3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"g1","to":"h3"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","confabulation","peace-talks","forbidden-city"],"after":["toll","no-quarter","confabulation","peace-talks","forbidden-city"],"decks":[75,75],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":2,"move":1,"action":{"type":"endTurn"},"fen":["rnbqkbnr/pppppppp/8/8/8/7N/PPPPPPPP/RNBQKB1R b KQkq - 1 1","rnbqkbnr/pppppppp/8/8/8/7N/PPPPPPPP/RNBQKB1R b KQkq - 1 1"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"g1","to":"h3"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","confabulation","peace-talks","forbidden-city"],"after":["toll","no-quarter","confabulation","peace-talks","forbidden-city"],"decks":[75,75],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":3,"move":2,"action":{"type":"move","from":"e7","to":"e5"},"fen":["rnbqkbnr/pppppppp/8/8/8/7N/PPPPPPPP/RNBQKB1R b KQkq - 1 1","rnbqkbnr/pppp1ppp/8/4p3/8/7N/PPPPPPPP/RNBQKB1R w KQkq - 0 2"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-pawn-e7","owner":"black","role":"pawn","originalRole":"pawn","square":"e7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-e7","owner":"black","role":"pawn","originalRole":"pawn","square":"e5","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"e7","to":"e5"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","confabulation","peace-talks","forbidden-city"],"after":["toll","no-quarter","confabulation","peace-talks","forbidden-city"],"decks":[75,75],"discard":[]}],"enPassant":[{"target":"e6","pawnId":"black-pawn-e7"}],"pendingRescue":false}
{"step":4,"move":2,"action":{"type":"endTurn"},"fen":["rnbqkbnr/pppp1ppp/8/4p3/8/7N/PPPPPPPP/RNBQKB1R w KQkq - 0 2","rnbqkbnr/pppp1ppp/8/4p3/8/7N/PPPPPPPP/RNBQKB1R w KQkq - 0 2"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"e7","to":"e5"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","confabulation","peace-talks","forbidden-city"],"after":["toll","no-quarter","confabulation","peace-talks","forbidden-city"],"decks":[75,75],"discard":[]}],"enPassant":[{"target":"e6","pawnId":"black-pawn-e7"}],"pendingRescue":false}
{"step":5,"move":3,"action":{"type":"move","from":"e2","to":"e4"},"fen":["rnbqkbnr/pppp1ppp/8/4p3/8/7N/PPPPPPPP/RNBQKB1R w KQkq - 0 2","rnbqkbnr/pppp1ppp/8/4p3/4P3/7N/PPPP1PPP/RNBQKB1R b KQkq - 0 2"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-e2","owner":"white","role":"pawn","originalRole":"pawn","square":"e2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-e2","owner":"white","role":"pawn","originalRole":"pawn","square":"e4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"e2","to":"e4"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","confabulation","peace-talks","forbidden-city"],"after":["toll","no-quarter","confabulation","peace-talks","forbidden-city"],"decks":[75,75],"discard":[]}],"enPassant":[{"target":"e3","pawnId":"white-pawn-e2"}],"pendingRescue":false}
{"step":6,"move":3,"action":{"type":"endTurn"},"fen":["rnbqkbnr/pppp1ppp/8/4p3/4P3/7N/PPPP1PPP/RNBQKB1R b KQkq - 0 2","rnbqkbnr/pppp1ppp/8/4p3/4P3/7N/PPPP1PPP/RNBQKB1R b KQkq - 0 2"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"e2","to":"e4"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","confabulation","peace-talks","forbidden-city"],"after":["toll","no-quarter","confabulation","peace-talks","forbidden-city"],"decks":[75,75],"discard":[]}],"enPassant":[{"target":"e3","pawnId":"white-pawn-e2"}],"pendingRescue":false}
{"step":7,"move":3,"action":{"type":"playCard","cardId":"confabulation","cardInstanceId":"black-hand-2-confabulation","target":[{"from":"h8","to":"h7"}]},"fen":["rnbqkbnr/pppp1ppp/8/4p3/4P3/7N/PPPP1PPP/RNBQKB1R b KQkq - 0 2","rnbqkbn1/pppp1ppp/8/4p3/4P3/7N/PPPP1PPP/RNBQKB1R w KQq - 1 3"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}}],"pieces":[{"before":{"id":"black-rook-h8","owner":"black","role":"rook","originalRole":"rook","square":"h8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-rook-h8","owner":"black","role":"rook","originalRole":"rook","square":null,"zone":"away","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"cardPlayed","cardId":"confabulation","target":[{"from":"h8","to":"h7"}],"movement":[{"from":"h8","to":"h7"}],"preservePreviousMove":false}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","confabulation","peace-talks","forbidden-city"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[75,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":8,"move":3,"action":{"type":"endTurn"},"fen":["rnbqkbn1/pppp1ppp/8/4p3/4P3/7N/PPPP1PPP/RNBQKB1R w KQq - 1 3","rnbqkbn1/pppp1ppp/8/4p3/4P3/7N/PPPP1PPP/RNBQKB1R w KQq - 1 3"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"cardPlayed","cardId":"confabulation","target":[{"from":"h8","to":"h7"}],"movement":[{"from":"h8","to":"h7"}],"preservePreviousMove":false}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":9,"move":4,"action":{"type":"move","from":"f1","to":"a6"},"fen":["rnbqkbn1/pppp1ppp/8/4p3/4P3/7N/PPPP1PPP/RNBQKB1R w KQq - 1 3","rnbqkbn1/pppp1ppp/B7/4p3/4P3/7N/PPPP1PPP/RNBQK2R b KQq - 2 3"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"f1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"a6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"f1","to":"a6"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":10,"move":4,"action":{"type":"endTurn"},"fen":["rnbqkbn1/pppp1ppp/B7/4p3/4P3/7N/PPPP1PPP/RNBQK2R b KQq - 2 3","rnbqkbn1/pppp1ppp/B7/4p3/4P3/7N/PPPP1PPP/RNBQK2R b KQq - 2 3"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"f1","to":"a6"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":11,"move":5,"action":{"type":"move","from":"e8","to":"e7"},"fen":["rnbqkbn1/pppp1ppp/B7/4p3/4P3/7N/PPPP1PPP/RNBQK2R b KQq - 2 3","rnbq1bn1/ppppkppp/B7/4p3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 3 4"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-king-e8","owner":"black","role":"king","originalRole":"king","square":"e8","zone":"board","promoted":false,"royal":true,"neutral":false},"after":{"id":"black-king-e8","owner":"black","role":"king","originalRole":"king","square":"e7","zone":"board","promoted":false,"royal":true,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"e8","to":"e7"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":12,"move":5,"action":{"type":"endTurn"},"fen":["rnbq1bn1/ppppkppp/B7/4p3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 3 4","rnbq1bn1/ppppkppp/B7/4p3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 3 4"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"e8","to":"e7"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":13,"move":6,"action":{"type":"move","from":"a6","to":"c4"},"fen":["rnbq1bn1/ppppkppp/B7/4p3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 3 4","rnbq1bn1/ppppkppp/8/4p3/2B1P3/7N/PPPP1PPP/RNBQK2R b KQ - 4 4"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"a6","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"c4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"a6","to":"c4"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":14,"move":6,"action":{"type":"endTurn"},"fen":["rnbq1bn1/ppppkppp/8/4p3/2B1P3/7N/PPPP1PPP/RNBQK2R b KQ - 4 4","rnbq1bn1/ppppkppp/8/4p3/2B1P3/7N/PPPP1PPP/RNBQK2R b KQ - 4 4"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"a6","to":"c4"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":15,"move":7,"action":{"type":"move","from":"e7","to":"e8"},"fen":["rnbq1bn1/ppppkppp/8/4p3/2B1P3/7N/PPPP1PPP/RNBQK2R b KQ - 4 4","rnbqkbn1/pppp1ppp/8/4p3/2B1P3/7N/PPPP1PPP/RNBQK2R w KQ - 5 5"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-king-e8","owner":"black","role":"king","originalRole":"king","square":"e7","zone":"board","promoted":false,"royal":true,"neutral":false},"after":{"id":"black-king-e8","owner":"black","role":"king","originalRole":"king","square":"e8","zone":"board","promoted":false,"royal":true,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"e7","to":"e8"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":16,"move":7,"action":{"type":"endTurn"},"fen":["rnbqkbn1/pppp1ppp/8/4p3/2B1P3/7N/PPPP1PPP/RNBQK2R w KQ - 5 5","rnbqkbn1/pppp1ppp/8/4p3/2B1P3/7N/PPPP1PPP/RNBQK2R w KQ - 5 5"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"e7","to":"e8"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":17,"move":8,"action":{"type":"move","from":"c4","to":"d5"},"fen":["rnbqkbn1/pppp1ppp/8/4p3/2B1P3/7N/PPPP1PPP/RNBQK2R w KQ - 5 5","rnbqkbn1/pppp1ppp/8/3Bp3/4P3/7N/PPPP1PPP/RNBQK2R b KQ - 6 5"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"c4","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"d5","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"c4","to":"d5"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":18,"move":8,"action":{"type":"endTurn"},"fen":["rnbqkbn1/pppp1ppp/8/3Bp3/4P3/7N/PPPP1PPP/RNBQK2R b KQ - 6 5","rnbqkbn1/pppp1ppp/8/3Bp3/4P3/7N/PPPP1PPP/RNBQK2R b KQ - 6 5"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"c4","to":"d5"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":19,"move":9,"action":{"type":"move","from":"b8","to":"a6"},"fen":["rnbqkbn1/pppp1ppp/8/3Bp3/4P3/7N/PPPP1PPP/RNBQK2R b KQ - 6 5","r1bqkbn1/pppp1ppp/n7/3Bp3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 7 6"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":"b8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":"a6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"b8","to":"a6"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":20,"move":9,"action":{"type":"endTurn"},"fen":["r1bqkbn1/pppp1ppp/n7/3Bp3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 7 6","r1bqkbn1/pppp1ppp/n7/3Bp3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 7 6"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"b8","to":"a6"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":21,"move":10,"action":{"type":"move","from":"d5","to":"f7"},"fen":["r1bqkbn1/pppp1ppp/n7/3Bp3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 7 6","r1bqkbn1/pppp1Bpp/n7/4p3/4P3/7N/PPPP1PPP/RNBQK2R b KQ - 0 6"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"d5","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"f7","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"black-pawn-f7","owner":"black","role":"pawn","originalRole":"pawn","square":"f7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-f7","owner":"black","role":"pawn","originalRole":"pawn","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"white"}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"d5","to":"f7","capturedId":"black-pawn-f7"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":22,"move":10,"action":{"type":"endTurn"},"fen":["r1bqkbn1/pppp1Bpp/n7/4p3/4P3/7N/PPPP1PPP/RNBQK2R b KQ - 0 6","r1bqkbn1/pppp1Bpp/n7/4p3/4P3/7N/PPPP1PPP/RNBQK2R b KQ - 0 6"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"d5","to":"f7","capturedId":"black-pawn-f7"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":23,"move":11,"action":{"type":"move","from":"e8","to":"e7"},"fen":["r1bqkbn1/pppp1Bpp/n7/4p3/4P3/7N/PPPP1PPP/RNBQK2R b KQ - 0 6","r1bq1bn1/ppppkBpp/n7/4p3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 1 7"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-king-e8","owner":"black","role":"king","originalRole":"king","square":"e8","zone":"board","promoted":false,"royal":true,"neutral":false},"after":{"id":"black-king-e8","owner":"black","role":"king","originalRole":"king","square":"e7","zone":"board","promoted":false,"royal":true,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"e8","to":"e7"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":24,"move":11,"action":{"type":"endTurn"},"fen":["r1bq1bn1/ppppkBpp/n7/4p3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 1 7","r1bq1bn1/ppppkBpp/n7/4p3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 1 7"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"e8","to":"e7"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":25,"move":12,"action":{"type":"move","from":"f7","to":"e6"},"fen":["r1bq1bn1/ppppkBpp/n7/4p3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 1 7","r1bq1bn1/ppppk1pp/n3B3/4p3/4P3/7N/PPPP1PPP/RNBQK2R b KQ - 2 7"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"f7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"e6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"f7","to":"e6"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":26,"move":12,"action":{"type":"endTurn"},"fen":["r1bq1bn1/ppppk1pp/n3B3/4p3/4P3/7N/PPPP1PPP/RNBQK2R b KQ - 2 7","r1bq1bn1/ppppk1pp/n3B3/4p3/4P3/7N/PPPP1PPP/RNBQK2R b KQ - 2 7"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"f7","to":"e6"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":27,"move":13,"action":{"type":"move","from":"a6","to":"c5"},"fen":["r1bq1bn1/ppppk1pp/n3B3/4p3/4P3/7N/PPPP1PPP/RNBQK2R b KQ - 2 7","r1bq1bn1/ppppk1pp/4B3/2n1p3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 3 8"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":"a6","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":"c5","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"a6","to":"c5"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":28,"move":13,"action":{"type":"endTurn"},"fen":["r1bq1bn1/ppppk1pp/4B3/2n1p3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 3 8","r1bq1bn1/ppppk1pp/4B3/2n1p3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 3 8"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"a6","to":"c5"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":29,"move":14,"action":{"type":"move","from":"e6","to":"g8"},"fen":["r1bq1bn1/ppppk1pp/4B3/2n1p3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 3 8","r1bq1bB1/ppppk1pp/8/2n1p3/4P3/7N/PPPP1PPP/RNBQK2R b KQ - 0 8"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"e6","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"g8","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"black-knight-g8","owner":"black","role":"knight","originalRole":"knight","square":"g8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-knight-g8","owner":"black","role":"knight","originalRole":"knight","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"white"}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"e6","to":"g8","capturedId":"black-knight-g8"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":30,"move":14,"action":{"type":"endTurn"},"fen":["r1bq1bB1/ppppk1pp/8/2n1p3/4P3/7N/PPPP1PPP/RNBQK2R b KQ - 0 8","r1bq1bB1/ppppk1pp/8/2n1p3/4P3/7N/PPPP1PPP/RNBQK2R b KQ - 0 8"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"e6","to":"g8","capturedId":"black-knight-g8"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":31,"move":15,"action":{"type":"move","from":"d8","to":"e8"},"fen":["r1bq1bB1/ppppk1pp/8/2n1p3/4P3/7N/PPPP1PPP/RNBQK2R b KQ - 0 8","r1b1qbB1/ppppk1pp/8/2n1p3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 1 9"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-queen-d8","owner":"black","role":"queen","originalRole":"queen","square":"d8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-queen-d8","owner":"black","role":"queen","originalRole":"queen","square":"e8","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"d8","to":"e8"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":32,"move":15,"action":{"type":"endTurn"},"fen":["r1b1qbB1/ppppk1pp/8/2n1p3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 1 9","r1b1qbB1/ppppk1pp/8/2n1p3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 1 9"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"d8","to":"e8"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":33,"move":16,"action":{"type":"move","from":"h3","to":"g5"},"fen":["r1b1qbB1/ppppk1pp/8/2n1p3/4P3/7N/PPPP1PPP/RNBQK2R w KQ - 1 9","r1b1qbB1/ppppk1pp/8/2n1p1N1/4P3/8/PPPP1PPP/RNBQK2R b KQ - 2 9"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"h3","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"g5","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"h3","to":"g5"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":34,"move":16,"action":{"type":"endTurn"},"fen":["r1b1qbB1/ppppk1pp/8/2n1p1N1/4P3/8/PPPP1PPP/RNBQK2R b KQ - 2 9","r1b1qbB1/ppppk1pp/8/2n1p1N1/4P3/8/PPPP1PPP/RNBQK2R b KQ - 2 9"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"h3","to":"g5"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":35,"move":17,"action":{"type":"move","from":"d7","to":"d6"},"fen":["r1b1qbB1/ppppk1pp/8/2n1p1N1/4P3/8/PPPP1PPP/RNBQK2R b KQ - 2 9","r1b1qbB1/ppp1k1pp/3p4/2n1p1N1/4P3/8/PPPP1PPP/RNBQK2R w KQ - 0 10"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-pawn-d7","owner":"black","role":"pawn","originalRole":"pawn","square":"d7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-d7","owner":"black","role":"pawn","originalRole":"pawn","square":"d6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"d7","to":"d6"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":36,"move":17,"action":{"type":"endTurn"},"fen":["r1b1qbB1/ppp1k1pp/3p4/2n1p1N1/4P3/8/PPPP1PPP/RNBQK2R w KQ - 0 10","r1b1qbB1/ppp1k1pp/3p4/2n1p1N1/4P3/8/PPPP1PPP/RNBQK2R w KQ - 0 10"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"d7","to":"d6"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":37,"move":18,"action":{"type":"move","from":"b2","to":"b4"},"fen":["r1b1qbB1/ppp1k1pp/3p4/2n1p1N1/4P3/8/PPPP1PPP/RNBQK2R w KQ - 0 10","r1b1qbB1/ppp1k1pp/3p4/2n1p1N1/1P2P3/8/P1PP1PPP/RNBQK2R b KQ - 0 10"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-b2","owner":"white","role":"pawn","originalRole":"pawn","square":"b2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-b2","owner":"white","role":"pawn","originalRole":"pawn","square":"b4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"b2","to":"b4"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[{"target":"b3","pawnId":"white-pawn-b2"}],"pendingRescue":false}
{"step":38,"move":18,"action":{"type":"endTurn"},"fen":["r1b1qbB1/ppp1k1pp/3p4/2n1p1N1/1P2P3/8/P1PP1PPP/RNBQK2R b KQ - 0 10","r1b1qbB1/ppp1k1pp/3p4/2n1p1N1/1P2P3/8/P1PP1PPP/RNBQK2R b KQ - 0 10"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"b2","to":"b4"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[{"target":"b3","pawnId":"white-pawn-b2"}],"pendingRescue":false}
{"step":39,"move":19,"action":{"type":"move","from":"c8","to":"g4"},"fen":["r1b1qbB1/ppp1k1pp/3p4/2n1p1N1/1P2P3/8/P1PP1PPP/RNBQK2R b KQ - 0 10","r3qbB1/ppp1k1pp/3p4/2n1p1N1/1P2P1b1/8/P1PP1PPP/RNBQK2R w KQ - 1 11"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-bishop-c8","owner":"black","role":"bishop","originalRole":"bishop","square":"c8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-bishop-c8","owner":"black","role":"bishop","originalRole":"bishop","square":"g4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"c8","to":"g4"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":40,"move":19,"action":{"type":"endTurn"},"fen":["r3qbB1/ppp1k1pp/3p4/2n1p1N1/1P2P1b1/8/P1PP1PPP/RNBQK2R w KQ - 1 11","r3qbB1/ppp1k1pp/3p4/2n1p1N1/1P2P1b1/8/P1PP1PPP/RNBQK2R w KQ - 1 11"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"c8","to":"g4"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":41,"move":20,"action":{"type":"move","from":"h1","to":"f1"},"fen":["r3qbB1/ppp1k1pp/3p4/2n1p1N1/1P2P1b1/8/P1PP1PPP/RNBQK2R w KQ - 1 11","r3qbB1/ppp1k1pp/3p4/2n1p1N1/1P2P1b1/8/P1PP1PPP/RNBQKR2 b Q - 2 11"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-rook-h1","owner":"white","role":"rook","originalRole":"rook","square":"h1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-rook-h1","owner":"white","role":"rook","originalRole":"rook","square":"f1","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"h1","to":"f1"}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"decks":[75,75],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":42,"move":20,"action":{"type":"playCard","cardId":"fatal-attraction","cardInstanceId":"white-hand-2-fatal-attraction","target":"b4"},"fen":["r3qbB1/ppp1k1pp/3p4/2n1p1N1/1P2P1b1/8/P1PP1PPP/RNBQKR2 b Q - 2 11","r3qbB1/ppp1k1pp/3p4/2n1p1N1/1P2P1b1/8/P1PP1PPP/RNBQKR2 b Q - 2 11"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":1,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}]],"events":[{"type":"cardPlayed","cardId":"fatal-attraction","target":"b4","movement":[],"preservePreviousMove":true}],"hands":[{"color":"white","before":["betrayal","legacy","fatal-attraction","pacifism","holy-quest"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[75,74],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":43,"move":20,"action":{"type":"endTurn"},"fen":["r3qbB1/ppp1k1pp/3p4/2n1p1N1/1P2P1b1/8/P1PP1PPP/RNBQKR2 b Q - 2 11","r3qbB1/ppp1k1pp/3p4/2n1p1N1/1P2P1b1/8/P1PP1PPP/RNBQKR2 b Q - 2 11"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":1,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}]],"events":[{"type":"cardPlayed","cardId":"fatal-attraction","target":"b4","movement":[],"preservePreviousMove":true}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":44,"move":21,"action":{"type":"move","from":"b7","to":"b6"},"fen":["r3qbB1/ppp1k1pp/3p4/2n1p1N1/1P2P1b1/8/P1PP1PPP/RNBQKR2 b Q - 2 11","r3qbB1/p1p1k1pp/1p1p4/2n1p1N1/1P2P1b1/8/P1PP1PPP/RNBQKR2 w Q - 0 12"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-pawn-b7","owner":"black","role":"pawn","originalRole":"pawn","square":"b7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-b7","owner":"black","role":"pawn","originalRole":"pawn","square":"b6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}]],"events":[{"type":"move","from":"b7","to":"b6"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":45,"move":21,"action":{"type":"endTurn"},"fen":["r3qbB1/p1p1k1pp/1p1p4/2n1p1N1/1P2P1b1/8/P1PP1PPP/RNBQKR2 w Q - 0 12","r3qbB1/p1p1k1pp/1p1p4/2n1p1N1/1P2P1b1/8/P1PP1PPP/RNBQKR2 w Q - 0 12"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}]],"events":[{"type":"move","from":"b7","to":"b6"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":46,"move":22,"action":{"type":"move","from":"c2","to":"c3"},"fen":["r3qbB1/p1p1k1pp/1p1p4/2n1p1N1/1P2P1b1/8/P1PP1PPP/RNBQKR2 w Q - 0 12","r3qbB1/p1p1k1pp/1p1p4/2n1p1N1/1P2P1b1/2P5/P2P1PPP/RNBQKR2 b Q - 0 12"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-c2","owner":"white","role":"pawn","originalRole":"pawn","square":"c2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-c2","owner":"white","role":"pawn","originalRole":"pawn","square":"c3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}]],"events":[{"type":"move","from":"c2","to":"c3"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":47,"move":22,"action":{"type":"endTurn"},"fen":["r3qbB1/p1p1k1pp/1p1p4/2n1p1N1/1P2P1b1/2P5/P2P1PPP/RNBQKR2 b Q - 0 12","r3qbB1/p1p1k1pp/1p1p4/2n1p1N1/1P2P1b1/2P5/P2P1PPP/RNBQKR2 b Q - 0 12"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}]],"events":[{"type":"move","from":"c2","to":"c3"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":48,"move":23,"action":{"type":"move","from":"g4","to":"e6"},"fen":["r3qbB1/p1p1k1pp/1p1p4/2n1p1N1/1P2P1b1/2P5/P2P1PPP/RNBQKR2 b Q - 0 12","r3qbB1/p1p1k1pp/1p1pb3/2n1p1N1/1P2P3/2P5/P2P1PPP/RNBQKR2 w Q - 1 13"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-bishop-c8","owner":"black","role":"bishop","originalRole":"bishop","square":"g4","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-bishop-c8","owner":"black","role":"bishop","originalRole":"bishop","square":"e6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}]],"events":[{"type":"move","from":"g4","to":"e6"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":49,"move":23,"action":{"type":"endTurn"},"fen":["r3qbB1/p1p1k1pp/1p1pb3/2n1p1N1/1P2P3/2P5/P2P1PPP/RNBQKR2 w Q - 1 13","r3qbB1/p1p1k1pp/1p1pb3/2n1p1N1/1P2P3/2P5/P2P1PPP/RNBQKR2 w Q - 1 13"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}]],"events":[{"type":"move","from":"g4","to":"e6"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":50,"move":24,"action":{"type":"move","from":"f2","to":"f4"},"fen":["r3qbB1/p1p1k1pp/1p1pb3/2n1p1N1/1P2P3/2P5/P2P1PPP/RNBQKR2 w Q - 1 13","r3qbB1/p1p1k1pp/1p1pb3/2n1p1N1/1P2PP2/2P5/P2P2PP/RNBQKR2 b Q - 0 13"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-f2","owner":"white","role":"pawn","originalRole":"pawn","square":"f2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-f2","owner":"white","role":"pawn","originalRole":"pawn","square":"f4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}]],"events":[{"type":"move","from":"f2","to":"f4"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[{"target":"f3","pawnId":"white-pawn-f2"}],"pendingRescue":false}
{"step":51,"move":24,"action":{"type":"endTurn"},"fen":["r3qbB1/p1p1k1pp/1p1pb3/2n1p1N1/1P2PP2/2P5/P2P2PP/RNBQKR2 b Q - 0 13","r3qbB1/p1p1k1pp/1p1pb3/2n1p1N1/1P2PP2/2P5/P2P2PP/RNBQKR2 b Q - 0 13"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}]],"events":[{"type":"move","from":"f2","to":"f4"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[{"target":"f3","pawnId":"white-pawn-f2"}],"pendingRescue":false}
{"step":52,"move":25,"action":{"type":"move","from":"e7","to":"f6"},"fen":["r3qbB1/p1p1k1pp/1p1pb3/2n1p1N1/1P2PP2/2P5/P2P2PP/RNBQKR2 b Q - 0 13","r3qbB1/p1p3pp/1p1pbk2/2n1p1N1/1P2PP2/2P5/P2P2PP/RNBQKR2 w Q - 1 14"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-king-e8","owner":"black","role":"king","originalRole":"king","square":"e7","zone":"board","promoted":false,"royal":true,"neutral":false},"after":{"id":"black-king-e8","owner":"black","role":"king","originalRole":"king","square":"f6","zone":"board","promoted":false,"royal":true,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}]],"events":[{"type":"move","from":"e7","to":"f6"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":53,"move":25,"action":{"type":"endTurn"},"fen":["r3qbB1/p1p3pp/1p1pbk2/2n1p1N1/1P2PP2/2P5/P2P2PP/RNBQKR2 w Q - 1 14","r3qbB1/p1p3pp/1p1pbk2/2n1p1N1/1P2PP2/2P5/P2P2PP/RNBQKR2 w Q - 1 14"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}]],"events":[{"type":"move","from":"e7","to":"f6"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":54,"move":26,"action":{"type":"move","from":"f1","to":"f3"},"fen":["r3qbB1/p1p3pp/1p1pbk2/2n1p1N1/1P2PP2/2P5/P2P2PP/RNBQKR2 w Q - 1 14","r3qbB1/p1p3pp/1p1pbk2/2n1p1N1/1P2PP2/2P2R2/P2P2PP/RNBQK3 b Q - 2 14"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-rook-h1","owner":"white","role":"rook","originalRole":"rook","square":"f1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-rook-h1","owner":"white","role":"rook","originalRole":"rook","square":"f3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}]],"events":[{"type":"move","from":"f1","to":"f3"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":55,"move":26,"action":{"type":"endTurn"},"fen":["r3qbB1/p1p3pp/1p1pbk2/2n1p1N1/1P2PP2/2P2R2/P2P2PP/RNBQK3 b Q - 2 14","r3qbB1/p1p3pp/1p1pbk2/2n1p1N1/1P2PP2/2P2R2/P2P2PP/RNBQK3 b Q - 2 14"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}]],"events":[{"type":"move","from":"f1","to":"f3"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":56,"move":27,"action":{"type":"move","from":"e6","to":"d7"},"fen":["r3qbB1/p1p3pp/1p1pbk2/2n1p1N1/1P2PP2/2P2R2/P2P2PP/RNBQK3 b Q - 2 14","r3qbB1/p1pb2pp/1p1p1k2/2n1p1N1/1P2PP2/2P2R2/P2P2PP/RNBQK3 w Q - 3 15"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-bishop-c8","owner":"black","role":"bishop","originalRole":"bishop","square":"e6","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-bishop-c8","owner":"black","role":"bishop","originalRole":"bishop","square":"d7","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}]],"events":[{"type":"move","from":"e6","to":"d7"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":57,"move":27,"action":{"type":"endTurn"},"fen":["r3qbB1/p1pb2pp/1p1p1k2/2n1p1N1/1P2PP2/2P2R2/P2P2PP/RNBQK3 w Q - 3 15","r3qbB1/p1pb2pp/1p1p1k2/2n1p1N1/1P2PP2/2P2R2/P2P2PP/RNBQK3 w Q - 3 15"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}]],"events":[{"type":"move","from":"e6","to":"d7"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":[]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":58,"move":28,"action":{"type":"move","from":"b4","to":"c5"},"fen":["r3qbB1/p1pb2pp/1p1p1k2/2n1p1N1/1P2PP2/2P2R2/P2P2PP/RNBQK3 w Q - 3 15","r3qbB1/p1pb2pp/1p1p1k2/2P1p1N1/4PP2/2P2R2/P2P2PP/RNBQK3 b Q - 0 15"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-b2","owner":"white","role":"pawn","originalRole":"pawn","square":"b4","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-b2","owner":"white","role":"pawn","originalRole":"pawn","square":"c5","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":"c5","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"white"}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]},{"type":"fatal-attraction","owner":"white","card":{"id":"white-hand-2-fatal-attraction","cardId":"fatal-attraction"},"pieceId":"white-pawn-b2"}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"b4","to":"c5","capturedId":"black-knight-b8"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"decks":[74,74],"discard":[]}],"enPassant":[],"pendingRescue":false}
{"step":59,"move":28,"action":{"type":"playCard","cardId":"toll","cardInstanceId":"black-hand-0-toll","target":"a2"},"fen":["r3qbB1/p1pb2pp/1p1p1k2/2P1p1N1/4PP2/2P2R2/P2P2PP/RNBQK3 b Q - 0 15","r3qbB1/p1pb2pp/1p1p1k2/2P1p1N1/4PP2/2P2R2/3P2PP/RNBQK3 b Q - 0 15"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}}],"pieces":[{"before":{"id":"white-pawn-a2","owner":"white","role":"pawn","originalRole":"pawn","square":"a2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-a2","owner":"white","role":"pawn","originalRole":"pawn","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"black"}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"cardPlayed","cardId":"toll","player":"black","target":"a2","capturedId":"white-pawn-a2","movement":[],"preservePreviousMove":true}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["toll","no-quarter","peace-talks","forbidden-city","blessing"],"after":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"decks":[74,73],"discard":["toll"]}],"enPassant":[],"pendingRescue":false}
{"step":60,"move":28,"action":{"type":"endTurn"},"fen":["r3qbB1/p1pb2pp/1p1p1k2/2P1p1N1/4PP2/2P2R2/3P2PP/RNBQK3 b Q - 0 15","r3qbB1/p1pb2pp/1p1p1k2/2P1p1N1/4PP2/2P2R2/3P2PP/RNBQK3 b Q - 0 15"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"cardPlayed","cardId":"toll","player":"black","target":"a2","capturedId":"white-pawn-a2","movement":[],"preservePreviousMove":true}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"after":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"decks":[73,73],"discard":["toll"]}],"enPassant":[],"pendingRescue":false}
{"step":61,"move":29,"action":{"type":"move","from":"d7","to":"e6"},"fen":["r3qbB1/p1pb2pp/1p1p1k2/2P1p1N1/4PP2/2P2R2/3P2PP/RNBQK3 b Q - 0 15","r3qbB1/p1p3pp/1p1pbk2/2P1p1N1/4PP2/2P2R2/3P2PP/RNBQK3 w Q - 1 16"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-bishop-c8","owner":"black","role":"bishop","originalRole":"bishop","square":"d7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-bishop-c8","owner":"black","role":"bishop","originalRole":"bishop","square":"e6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"d7","to":"e6"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"after":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"decks":[73,73],"discard":["toll"]}],"enPassant":[],"pendingRescue":false}
{"step":62,"move":29,"action":{"type":"endTurn"},"fen":["r3qbB1/p1p3pp/1p1pbk2/2P1p1N1/4PP2/2P2R2/3P2PP/RNBQK3 w Q - 1 16","r3qbB1/p1p3pp/1p1pbk2/2P1p1N1/4PP2/2P2R2/3P2PP/RNBQK3 w Q - 1 16"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"d7","to":"e6"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"after":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"decks":[73,73],"discard":["toll"]}],"enPassant":[],"pendingRescue":false}
{"step":63,"move":30,"action":{"type":"move","from":"g2","to":"g3"},"fen":["r3qbB1/p1p3pp/1p1pbk2/2P1p1N1/4PP2/2P2R2/3P2PP/RNBQK3 w Q - 1 16","r3qbB1/p1p3pp/1p1pbk2/2P1p1N1/4PP2/2P2RP1/3P3P/RNBQK3 b Q - 0 16"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-g2","owner":"white","role":"pawn","originalRole":"pawn","square":"g2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-g2","owner":"white","role":"pawn","originalRole":"pawn","square":"g3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"g2","to":"g3"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"after":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"decks":[73,73],"discard":["toll"]}],"enPassant":[],"pendingRescue":false}
{"step":64,"move":30,"action":{"type":"endTurn"},"fen":["r3qbB1/p1p3pp/1p1pbk2/2P1p1N1/4PP2/2P2RP1/3P3P/RNBQK3 b Q - 0 16","r3qbB1/p1p3pp/1p1pbk2/2P1p1N1/4PP2/2P2RP1/3P3P/RNBQK3 b Q - 0 16"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"g2","to":"g3"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"after":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"decks":[73,73],"discard":["toll"]}],"enPassant":[],"pendingRescue":false}
{"step":65,"move":31,"action":{"type":"move","from":"a7","to":"a5"},"fen":["r3qbB1/p1p3pp/1p1pbk2/2P1p1N1/4PP2/2P2RP1/3P3P/RNBQK3 b Q - 0 16","r3qbB1/2p3pp/1p1pbk2/p1P1p1N1/4PP2/2P2RP1/3P3P/RNBQK3 w Q - 0 17"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-pawn-a7","owner":"black","role":"pawn","originalRole":"pawn","square":"a7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-a7","owner":"black","role":"pawn","originalRole":"pawn","square":"a5","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"a7","to":"a5"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"after":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"decks":[73,73],"discard":["toll"]}],"enPassant":[{"target":"a6","pawnId":"black-pawn-a7"}],"pendingRescue":false}
{"step":66,"move":31,"action":{"type":"endTurn"},"fen":["r3qbB1/2p3pp/1p1pbk2/p1P1p1N1/4PP2/2P2RP1/3P3P/RNBQK3 w Q - 0 17","r3qbB1/2p3pp/1p1pbk2/p1P1p1N1/4PP2/2P2RP1/3P3P/RNBQK3 w Q - 0 17"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"a7","to":"a5"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"after":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"decks":[73,73],"discard":["toll"]}],"enPassant":[{"target":"a6","pawnId":"black-pawn-a7"}],"pendingRescue":false}
{"step":67,"move":32,"action":{"type":"move","from":"h2","to":"h3"},"fen":["r3qbB1/2p3pp/1p1pbk2/p1P1p1N1/4PP2/2P2RP1/3P3P/RNBQK3 w Q - 0 17","r3qbB1/2p3pp/1p1pbk2/p1P1p1N1/4PP2/2P2RPP/3P4/RNBQK3 b Q - 0 17"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-h2","owner":"white","role":"pawn","originalRole":"pawn","square":"h2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-h2","owner":"white","role":"pawn","originalRole":"pawn","square":"h3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"h2","to":"h3"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"after":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"decks":[73,73],"discard":["toll"]}],"enPassant":[],"pendingRescue":false}
{"step":68,"move":32,"action":{"type":"endTurn"},"fen":["r3qbB1/2p3pp/1p1pbk2/p1P1p1N1/4PP2/2P2RPP/3P4/RNBQK3 b Q - 0 17","r3qbB1/2p3pp/1p1pbk2/p1P1p1N1/4PP2/2P2RPP/3P4/RNBQK3 b Q - 0 17"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"h2","to":"h3"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"after":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"decks":[73,73],"discard":["toll"]}],"enPassant":[],"pendingRescue":false}
{"step":69,"move":33,"action":{"type":"move","from":"g7","to":"g6"},"fen":["r3qbB1/2p3pp/1p1pbk2/p1P1p1N1/4PP2/2P2RPP/3P4/RNBQK3 b Q - 0 17","r3qbB1/2p4p/1p1pbkp1/p1P1p1N1/4PP2/2P2RPP/3P4/RNBQK3 w Q - 0 18"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-pawn-g7","owner":"black","role":"pawn","originalRole":"pawn","square":"g7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-g7","owner":"black","role":"pawn","originalRole":"pawn","square":"g6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"g7","to":"g6"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"after":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"decks":[73,73],"discard":["toll"]}],"enPassant":[],"pendingRescue":false}
{"step":70,"move":33,"action":{"type":"endTurn"},"fen":["r3qbB1/2p4p/1p1pbkp1/p1P1p1N1/4PP2/2P2RPP/3P4/RNBQK3 w Q - 0 18","r3qbB1/2p4p/1p1pbkp1/p1P1p1N1/4PP2/2P2RPP/3P4/RNBQK3 w Q - 0 18"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"g7","to":"g6"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"after":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"decks":[73,73],"discard":["toll"]}],"enPassant":[],"pendingRescue":false}
{"step":71,"move":34,"action":{"type":"move","from":"a1","to":"a4"},"fen":["r3qbB1/2p4p/1p1pbkp1/p1P1p1N1/4PP2/2P2RPP/3P4/RNBQK3 w Q - 0 18","r3qbB1/2p4p/1p1pbkp1/p1P1p1N1/R3PP2/2P2RPP/3P4/1NBQK3 b - - 1 18"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-rook-a1","owner":"white","role":"rook","originalRole":"rook","square":"a1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-rook-a1","owner":"white","role":"rook","originalRole":"rook","square":"a4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"a1","to":"a4"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"after":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"decks":[73,73],"discard":["toll"]}],"enPassant":[],"pendingRescue":false}
{"step":72,"move":34,"action":{"type":"endTurn"},"fen":["r3qbB1/2p4p/1p1pbkp1/p1P1p1N1/R3PP2/2P2RPP/3P4/1NBQK3 b - - 1 18","r3qbB1/2p4p/1p1pbkp1/p1P1p1N1/R3PP2/2P2RPP/3P4/1NBQK3 b - - 1 18"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"a1","to":"a4"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"after":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"decks":[73,73],"discard":["toll"]}],"enPassant":[],"pendingRescue":false}
{"step":73,"move":35,"action":{"type":"move","from":"h7","to":"h3"},"fen":["r3qbB1/2p4p/1p1pbkp1/p1P1p1N1/R3PP2/2P2RPP/3P4/1NBQK3 b - - 1 18","r3qbB1/2p5/1p1pbkp1/p1P1p1N1/R3PP2/2P2RPp/3P4/1NBQK3 w - - 0 19"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-h2","owner":"white","role":"pawn","originalRole":"pawn","square":"h3","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-h2","owner":"white","role":"pawn","originalRole":"pawn","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"black"}},{"before":{"id":"black-pawn-h7","owner":"black","role":"pawn","originalRole":"pawn","square":"h7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-h7","owner":"black","role":"pawn","originalRole":"pawn","square":"h3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"h7","to":"h3","capturedId":"white-pawn-h2"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"after":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"decks":[73,73],"discard":["toll"]}],"enPassant":[],"pendingRescue":false}
{"step":74,"move":35,"action":{"type":"endTurn"},"fen":["r3qbB1/2p5/1p1pbkp1/p1P1p1N1/R3PP2/2P2RPp/3P4/1NBQK3 w - - 0 19","r3qbB1/2p5/1p1pbkp1/p1P1p1N1/R3PP2/2P2RPp/3P4/1NBQK3 w - - 0 19"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"h7","to":"h3","capturedId":"white-pawn-h2"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"after":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"decks":[73,73],"discard":["toll"]}],"enPassant":[],"pendingRescue":false}
{"step":75,"move":36,"action":{"type":"move","from":"a4","to":"a1"},"fen":["r3qbB1/2p5/1p1pbkp1/p1P1p1N1/R3PP2/2P2RPp/3P4/1NBQK3 w - - 0 19","r3qbB1/2p5/1p1pbkp1/p1P1p1N1/4PP2/2P2RPp/3P4/RNBQK3 b - - 1 19"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-rook-a1","owner":"white","role":"rook","originalRole":"rook","square":"a4","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-rook-a1","owner":"white","role":"rook","originalRole":"rook","square":"a1","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"a4","to":"a1"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"after":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"decks":[73,73],"discard":["toll"]}],"enPassant":[],"pendingRescue":false}
{"step":76,"move":36,"action":{"type":"endTurn"},"fen":["r3qbB1/2p5/1p1pbkp1/p1P1p1N1/4PP2/2P2RPp/3P4/RNBQK3 b - - 1 19","r3qbB1/2p5/1p1pbkp1/p1P1p1N1/4PP2/2P2RPp/3P4/RNBQK3 b - - 1 19"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"a4","to":"a1"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"after":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"decks":[73,73],"discard":["toll"]}],"enPassant":[],"pendingRescue":false}
{"step":77,"move":36,"action":{"type":"playCard","cardId":"blessing","cardInstanceId":"black-deck-0-blessing","target":[{"from":"c7","to":"b8"}]},"fen":["r3qbB1/2p5/1p1pbkp1/p1P1p1N1/4PP2/2P2RPp/3P4/RNBQK3 b - - 1 19","rp2qbB1/8/1p1pbkp1/p1P1p1N1/4PP2/2P2RPp/3P4/RNBQK3 w - - 0 20"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}}],"pieces":[{"before":{"id":"black-pawn-c7","owner":"black","role":"pawn","originalRole":"pawn","square":"c7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-c7","owner":"black","role":"pawn","originalRole":"pawn","square":"b8","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"cardPlayed","cardId":"blessing","target":[{"from":"c7","to":"b8"}],"movement":[{"from":"c7","to":"b8"}],"preservePreviousMove":false}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","blessing","anathema"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[73,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":78,"move":36,"action":{"type":"endTurn"},"fen":["rp2qbB1/8/1p1pbkp1/p1P1p1N1/4PP2/2P2RPp/3P4/RNBQK3 w - - 0 20","rp2qbB1/8/1p1pbkp1/p1P1p1N1/4PP2/2P2RPp/3P4/RNBQK3 w - - 0 20"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"cardPlayed","cardId":"blessing","target":[{"from":"c7","to":"b8"}],"movement":[{"from":"c7","to":"b8"}],"preservePreviousMove":false}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":79,"move":37,"action":{"type":"move","from":"g8","to":"f7"},"fen":["rp2qbB1/8/1p1pbkp1/p1P1p1N1/4PP2/2P2RPp/3P4/RNBQK3 w - - 0 20","rp2qb2/5B2/1p1pbkp1/p1P1p1N1/4PP2/2P2RPp/3P4/RNBQK3 b - - 1 20"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"g8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"f7","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"g8","to":"f7"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":80,"move":37,"action":{"type":"endTurn"},"fen":["rp2qb2/5B2/1p1pbkp1/p1P1p1N1/4PP2/2P2RPp/3P4/RNBQK3 b - - 1 20","rp2qb2/5B2/1p1pbkp1/p1P1p1N1/4PP2/2P2RPp/3P4/RNBQK3 b - - 1 20"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"g8","to":"f7"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":81,"move":38,"action":{"type":"move","from":"e8","to":"f7"},"fen":["rp2qb2/5B2/1p1pbkp1/p1P1p1N1/4PP2/2P2RPp/3P4/RNBQK3 b - - 1 20","rp3b2/5q2/1p1pbkp1/p1P1p1N1/4PP2/2P2RPp/3P4/RNBQK3 w - - 0 21"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"f7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"black"}},{"before":{"id":"black-queen-d8","owner":"black","role":"queen","originalRole":"queen","square":"e8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-queen-d8","owner":"black","role":"queen","originalRole":"queen","square":"f7","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"e8","to":"f7","capturedId":"white-bishop-f1"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":82,"move":38,"action":{"type":"endTurn"},"fen":["rp3b2/5q2/1p1pbkp1/p1P1p1N1/4PP2/2P2RPp/3P4/RNBQK3 w - - 0 21","rp3b2/5q2/1p1pbkp1/p1P1p1N1/4PP2/2P2RPp/3P4/RNBQK3 w - - 0 21"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"e8","to":"f7","capturedId":"white-bishop-f1"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":83,"move":39,"action":{"type":"move","from":"c5","to":"d6"},"fen":["rp3b2/5q2/1p1pbkp1/p1P1p1N1/4PP2/2P2RPp/3P4/RNBQK3 w - - 0 21","rp3b2/5q2/1p1Pbkp1/p3p1N1/4PP2/2P2RPp/3P4/RNBQK3 b - - 0 21"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-b2","owner":"white","role":"pawn","originalRole":"pawn","square":"c5","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-b2","owner":"white","role":"pawn","originalRole":"pawn","square":"d6","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"black-pawn-d7","owner":"black","role":"pawn","originalRole":"pawn","square":"d6","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-d7","owner":"black","role":"pawn","originalRole":"pawn","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"white"}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"c5","to":"d6","capturedId":"black-pawn-d7"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":84,"move":39,"action":{"type":"endTurn"},"fen":["rp3b2/5q2/1p1Pbkp1/p3p1N1/4PP2/2P2RPp/3P4/RNBQK3 b - - 0 21","rp3b2/5q2/1p1Pbkp1/p3p1N1/4PP2/2P2RPp/3P4/RNBQK3 b - - 0 21"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"c5","to":"d6","capturedId":"black-pawn-d7"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":85,"move":40,"action":{"type":"move","from":"h3","to":"h2"},"fen":["rp3b2/5q2/1p1Pbkp1/p3p1N1/4PP2/2P2RPp/3P4/RNBQK3 b - - 0 21","rp3b2/5q2/1p1Pbkp1/p3p1N1/4PP2/2P2RP1/3P3p/RNBQK3 w - - 0 22"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-pawn-h7","owner":"black","role":"pawn","originalRole":"pawn","square":"h3","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-h7","owner":"black","role":"pawn","originalRole":"pawn","square":"h2","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"h3","to":"h2"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":86,"move":40,"action":{"type":"endTurn"},"fen":["rp3b2/5q2/1p1Pbkp1/p3p1N1/4PP2/2P2RP1/3P3p/RNBQK3 w - - 0 22","rp3b2/5q2/1p1Pbkp1/p3p1N1/4PP2/2P2RP1/3P3p/RNBQK3 w - - 0 22"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"h3","to":"h2"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":87,"move":41,"action":{"type":"move","from":"d1","to":"e2"},"fen":["rp3b2/5q2/1p1Pbkp1/p3p1N1/4PP2/2P2RP1/3P3p/RNBQK3 w - - 0 22","rp3b2/5q2/1p1Pbkp1/p3p1N1/4PP2/2P2RP1/3PQ2p/RNB1K3 b - - 1 22"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-queen-d1","owner":"white","role":"queen","originalRole":"queen","square":"d1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-queen-d1","owner":"white","role":"queen","originalRole":"queen","square":"e2","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"d1","to":"e2"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":88,"move":41,"action":{"type":"endTurn"},"fen":["rp3b2/5q2/1p1Pbkp1/p3p1N1/4PP2/2P2RP1/3PQ2p/RNB1K3 b - - 1 22","rp3b2/5q2/1p1Pbkp1/p3p1N1/4PP2/2P2RP1/3PQ2p/RNB1K3 b - - 1 22"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"d1","to":"e2"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":89,"move":42,"action":{"type":"move","from":"f8","to":"e7"},"fen":["rp3b2/5q2/1p1Pbkp1/p3p1N1/4PP2/2P2RP1/3PQ2p/RNB1K3 b - - 1 22","rp6/4bq2/1p1Pbkp1/p3p1N1/4PP2/2P2RP1/3PQ2p/RNB1K3 w - - 2 23"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-bishop-f8","owner":"black","role":"bishop","originalRole":"bishop","square":"f8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-bishop-f8","owner":"black","role":"bishop","originalRole":"bishop","square":"e7","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"f8","to":"e7"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":90,"move":42,"action":{"type":"endTurn"},"fen":["rp6/4bq2/1p1Pbkp1/p3p1N1/4PP2/2P2RP1/3PQ2p/RNB1K3 w - - 2 23","rp6/4bq2/1p1Pbkp1/p3p1N1/4PP2/2P2RP1/3PQ2p/RNB1K3 w - - 2 23"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"f8","to":"e7"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":91,"move":43,"action":{"type":"move","from":"g5","to":"e6"},"fen":["rp6/4bq2/1p1Pbkp1/p3p1N1/4PP2/2P2RP1/3PQ2p/RNB1K3 w - - 2 23","rp6/4bq2/1p1PNkp1/p3p3/4PP2/2P2RP1/3PQ2p/RNB1K3 b - - 0 23"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"g5","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"e6","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"black-bishop-c8","owner":"black","role":"bishop","originalRole":"bishop","square":"e6","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-bishop-c8","owner":"black","role":"bishop","originalRole":"bishop","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"white"}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"g5","to":"e6","capturedId":"black-bishop-c8"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":92,"move":43,"action":{"type":"endTurn"},"fen":["rp6/4bq2/1p1PNkp1/p3p3/4PP2/2P2RP1/3PQ2p/RNB1K3 b - - 0 23","rp6/4bq2/1p1PNkp1/p3p3/4PP2/2P2RP1/3PQ2p/RNB1K3 b - - 0 23"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"g5","to":"e6","capturedId":"black-bishop-c8"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":93,"move":44,"action":{"type":"move","from":"h2","to":"g2"},"fen":["rp6/4bq2/1p1PNkp1/p3p3/4PP2/2P2RP1/3PQ2p/RNB1K3 b - - 0 23","rp6/4bq2/1p1PNkp1/p3p3/4PP2/2P2RP1/3PQ1p1/RNB1K3 w - - 0 24"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-pawn-h7","owner":"black","role":"pawn","originalRole":"pawn","square":"h2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-h7","owner":"black","role":"pawn","originalRole":"pawn","square":"g2","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"h2","to":"g2"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":94,"move":44,"action":{"type":"endTurn"},"fen":["rp6/4bq2/1p1PNkp1/p3p3/4PP2/2P2RP1/3PQ1p1/RNB1K3 w - - 0 24","rp6/4bq2/1p1PNkp1/p3p3/4PP2/2P2RP1/3PQ1p1/RNB1K3 w - - 0 24"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"h2","to":"g2"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":95,"move":45,"action":{"type":"move","from":"c3","to":"c4"},"fen":["rp6/4bq2/1p1PNkp1/p3p3/4PP2/2P2RP1/3PQ1p1/RNB1K3 w - - 0 24","rp6/4bq2/1p1PNkp1/p3p3/2P1PP2/5RP1/3PQ1p1/RNB1K3 b - - 0 24"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-c2","owner":"white","role":"pawn","originalRole":"pawn","square":"c3","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-c2","owner":"white","role":"pawn","originalRole":"pawn","square":"c4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"c3","to":"c4"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":96,"move":45,"action":{"type":"endTurn"},"fen":["rp6/4bq2/1p1PNkp1/p3p3/2P1PP2/5RP1/3PQ1p1/RNB1K3 b - - 0 24","rp6/4bq2/1p1PNkp1/p3p3/2P1PP2/5RP1/3PQ1p1/RNB1K3 b - - 0 24"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"c3","to":"c4"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":97,"move":46,"action":{"type":"move","from":"g2","to":"e2"},"fen":["rp6/4bq2/1p1PNkp1/p3p3/2P1PP2/5RP1/3PQ1p1/RNB1K3 b - - 0 24","rp6/4bq2/1p1PNkp1/p3p3/2P1PP2/5RP1/3Pp3/RNB1K3 w - - 0 25"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-queen-d1","owner":"white","role":"queen","originalRole":"queen","square":"e2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-queen-d1","owner":"white","role":"queen","originalRole":"queen","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"black"}},{"before":{"id":"black-pawn-h7","owner":"black","role":"pawn","originalRole":"pawn","square":"g2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-h7","owner":"black","role":"pawn","originalRole":"pawn","square":"e2","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"move","from":"g2","to":"e2","capturedId":"white-queen-d1"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"decks":[72,72],"discard":["toll","blessing"]}],"enPassant":[],"pendingRescue":false}
{"step":98,"move":46,"action":{"type":"playCard","cardId":"anathema","cardInstanceId":"black-deck-1-anathema","target":{"bishop":"c1","rook":"f3"}},"fen":["rp6/4bq2/1p1PNkp1/p3p3/2P1PP2/5RP1/3Pp3/RNB1K3 w - - 0 25","rp6/4bq2/1p1PNkp1/p3p3/2P1PP2/5BP1/3Pp3/RNR1K3 w - - 0 25"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}}],"pieces":[{"before":{"id":"white-bishop-c1","owner":"white","role":"bishop","originalRole":"bishop","square":"c1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-bishop-c1","owner":"white","role":"bishop","originalRole":"bishop","square":"f3","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"white-rook-h1","owner":"white","role":"rook","originalRole":"rook","square":"f3","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-rook-h1","owner":"white","role":"rook","originalRole":"rook","square":"c1","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"cardPlayed","cardId":"anathema","target":{"bishop":"c1","rook":"f3"},"movement":[{"from":"c1","to":"f3"},{"from":"f3","to":"c1"}],"preservePreviousMove":true}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","anathema","riposte"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[72,71],"discard":["toll","blessing","anathema"]}],"enPassant":[],"pendingRescue":false}
{"step":99,"move":46,"action":{"type":"endTurn"},"fen":["rp6/4bq2/1p1PNkp1/p3p3/2P1PP2/5BP1/3Pp3/RNR1K3 w - - 0 25","rp6/4bq2/1p1PNkp1/p3p3/2P1PP2/5BP1/3Pp3/RNR1K3 w - - 0 25"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}]],"events":[{"type":"cardPlayed","cardId":"anathema","target":{"bishop":"c1","rook":"f3"},"movement":[{"from":"c1","to":"f3"},{"from":"f3","to":"c1"}],"preservePreviousMove":true}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema"]}],"enPassant":[],"pendingRescue":false}
{"step":100,"move":47,"action":{"type":"move","from":"e1","to":"e2"},"fen":["rp6/4bq2/1p1PNkp1/p3p3/2P1PP2/5BP1/3Pp3/RNR1K3 w - - 0 25","rp6/4bq2/1p1PNkp1/p3p3/2P1PP2/5BP1/3PK3/RNR5 b - - 0 25"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-king-e1","owner":"white","role":"king","originalRole":"king","square":"e1","zone":"board","promoted":false,"royal":true,"neutral":false},"after":{"id":"white-king-e1","owner":"white","role":"king","originalRole":"king","square":"e2","zone":"board","promoted":false,"royal":true,"neutral":false}},{"before":{"id":"black-pawn-h7","owner":"black","role":"pawn","originalRole":"pawn","square":"e2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-h7","owner":"black","role":"pawn","originalRole":"pawn","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"white"}},{"before":{"id":"black-rook-h8","owner":"black","role":"rook","originalRole":"rook","square":null,"zone":"away","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-rook-h8","owner":"black","role":"rook","originalRole":"rook","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"white"}}],"effects":[[{"type":"confabulation","owner":"black","card":{"id":"black-hand-2-confabulation","cardId":"confabulation"},"pieceIds":["black-pawn-h7","black-rook-h8"]}],[]],"events":[{"type":"move","from":"e1","to":"e2","capturedId":"black-pawn-h7","capturedIds":["black-pawn-h7","black-rook-h8"]}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":101,"move":47,"action":{"type":"endTurn"},"fen":["rp6/4bq2/1p1PNkp1/p3p3/2P1PP2/5BP1/3PK3/RNR5 b - - 0 25","rp6/4bq2/1p1PNkp1/p3p3/2P1PP2/5BP1/3PK3/RNR5 b - - 0 25"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"e1","to":"e2","capturedId":"black-pawn-h7","capturedIds":["black-pawn-h7","black-rook-h8"]}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":102,"move":48,"action":{"type":"move","from":"f7","to":"g7"},"fen":["rp6/4bq2/1p1PNkp1/p3p3/2P1PP2/5BP1/3PK3/RNR5 b - - 0 25","rp6/4b1q1/1p1PNkp1/p3p3/2P1PP2/5BP1/3PK3/RNR5 w - - 1 26"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-queen-d8","owner":"black","role":"queen","originalRole":"queen","square":"f7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-queen-d8","owner":"black","role":"queen","originalRole":"queen","square":"g7","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"f7","to":"g7"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":103,"move":48,"action":{"type":"endTurn"},"fen":["rp6/4b1q1/1p1PNkp1/p3p3/2P1PP2/5BP1/3PK3/RNR5 w - - 1 26","rp6/4b1q1/1p1PNkp1/p3p3/2P1PP2/5BP1/3PK3/RNR5 w - - 1 26"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"f7","to":"g7"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":104,"move":49,"action":{"type":"move","from":"e2","to":"d3"},"fen":["rp6/4b1q1/1p1PNkp1/p3p3/2P1PP2/5BP1/3PK3/RNR5 w - - 1 26","rp6/4b1q1/1p1PNkp1/p3p3/2P1PP2/3K1BP1/3P4/RNR5 b - - 2 26"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-king-e1","owner":"white","role":"king","originalRole":"king","square":"e2","zone":"board","promoted":false,"royal":true,"neutral":false},"after":{"id":"white-king-e1","owner":"white","role":"king","originalRole":"king","square":"d3","zone":"board","promoted":false,"royal":true,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"e2","to":"d3"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":105,"move":49,"action":{"type":"endTurn"},"fen":["rp6/4b1q1/1p1PNkp1/p3p3/2P1PP2/3K1BP1/3P4/RNR5 b - - 2 26","rp6/4b1q1/1p1PNkp1/p3p3/2P1PP2/3K1BP1/3P4/RNR5 b - - 2 26"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"e2","to":"d3"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":106,"move":50,"action":{"type":"move","from":"e7","to":"f8"},"fen":["rp6/4b1q1/1p1PNkp1/p3p3/2P1PP2/3K1BP1/3P4/RNR5 b - - 2 26","rp3b2/6q1/1p1PNkp1/p3p3/2P1PP2/3K1BP1/3P4/RNR5 w - - 3 27"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-bishop-f8","owner":"black","role":"bishop","originalRole":"bishop","square":"e7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-bishop-f8","owner":"black","role":"bishop","originalRole":"bishop","square":"f8","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"e7","to":"f8"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":107,"move":50,"action":{"type":"endTurn"},"fen":["rp3b2/6q1/1p1PNkp1/p3p3/2P1PP2/3K1BP1/3P4/RNR5 w - - 3 27","rp3b2/6q1/1p1PNkp1/p3p3/2P1PP2/3K1BP1/3P4/RNR5 w - - 3 27"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"e7","to":"f8"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":108,"move":51,"action":{"type":"move","from":"a1","to":"a5"},"fen":["rp3b2/6q1/1p1PNkp1/p3p3/2P1PP2/3K1BP1/3P4/RNR5 w - - 3 27","rp3b2/6q1/1p1PNkp1/R3p3/2P1PP2/3K1BP1/3P4/1NR5 b - - 0 27"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-rook-a1","owner":"white","role":"rook","originalRole":"rook","square":"a1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-rook-a1","owner":"white","role":"rook","originalRole":"rook","square":"a5","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"black-pawn-a7","owner":"black","role":"pawn","originalRole":"pawn","square":"a5","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-a7","owner":"black","role":"pawn","originalRole":"pawn","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"white"}}],"effects":[[],[]],"events":[{"type":"move","from":"a1","to":"a5","capturedId":"black-pawn-a7"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":109,"move":51,"action":{"type":"endTurn"},"fen":["rp3b2/6q1/1p1PNkp1/R3p3/2P1PP2/3K1BP1/3P4/1NR5 b - - 0 27","rp3b2/6q1/1p1PNkp1/R3p3/2P1PP2/3K1BP1/3P4/1NR5 b - - 0 27"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"a1","to":"a5","capturedId":"black-pawn-a7"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":110,"move":52,"action":{"type":"move","from":"a8","to":"a6"},"fen":["rp3b2/6q1/1p1PNkp1/R3p3/2P1PP2/3K1BP1/3P4/1NR5 b - - 0 27","1p3b2/6q1/rp1PNkp1/R3p3/2P1PP2/3K1BP1/3P4/1NR5 w - - 1 28"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-rook-a8","owner":"black","role":"rook","originalRole":"rook","square":"a8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-rook-a8","owner":"black","role":"rook","originalRole":"rook","square":"a6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"a8","to":"a6"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":111,"move":52,"action":{"type":"endTurn"},"fen":["1p3b2/6q1/rp1PNkp1/R3p3/2P1PP2/3K1BP1/3P4/1NR5 w - - 1 28","1p3b2/6q1/rp1PNkp1/R3p3/2P1PP2/3K1BP1/3P4/1NR5 w - - 1 28"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"a8","to":"a6"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":112,"move":53,"action":{"type":"move","from":"c4","to":"c5"},"fen":["1p3b2/6q1/rp1PNkp1/R3p3/2P1PP2/3K1BP1/3P4/1NR5 w - - 1 28","1p3b2/6q1/rp1PNkp1/R1P1p3/4PP2/3K1BP1/3P4/1NR5 b - - 0 28"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-c2","owner":"white","role":"pawn","originalRole":"pawn","square":"c4","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-c2","owner":"white","role":"pawn","originalRole":"pawn","square":"c5","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"c4","to":"c5"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":113,"move":53,"action":{"type":"endTurn"},"fen":["1p3b2/6q1/rp1PNkp1/R1P1p3/4PP2/3K1BP1/3P4/1NR5 b - - 0 28","1p3b2/6q1/rp1PNkp1/R1P1p3/4PP2/3K1BP1/3P4/1NR5 b - - 0 28"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"c4","to":"c5"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":114,"move":54,"action":{"type":"move","from":"b6","to":"a5"},"fen":["1p3b2/6q1/rp1PNkp1/R1P1p3/4PP2/3K1BP1/3P4/1NR5 b - - 0 28","1p3b2/6q1/r2PNkp1/p1P1p3/4PP2/3K1BP1/3P4/1NR5 w - - 0 29"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-rook-a1","owner":"white","role":"rook","originalRole":"rook","square":"a5","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-rook-a1","owner":"white","role":"rook","originalRole":"rook","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"black"}},{"before":{"id":"black-pawn-b7","owner":"black","role":"pawn","originalRole":"pawn","square":"b6","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-b7","owner":"black","role":"pawn","originalRole":"pawn","square":"a5","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"b6","to":"a5","capturedId":"white-rook-a1"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":115,"move":54,"action":{"type":"endTurn"},"fen":["1p3b2/6q1/r2PNkp1/p1P1p3/4PP2/3K1BP1/3P4/1NR5 w - - 0 29","1p3b2/6q1/r2PNkp1/p1P1p3/4PP2/3K1BP1/3P4/1NR5 w - - 0 29"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"b6","to":"a5","capturedId":"white-rook-a1"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":116,"move":55,"action":{"type":"move","from":"e6","to":"d4"},"fen":["1p3b2/6q1/r2PNkp1/p1P1p3/4PP2/3K1BP1/3P4/1NR5 w - - 0 29","1p3b2/6q1/r2P1kp1/p1P1p3/3NPP2/3K1BP1/3P4/1NR5 b - - 1 29"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"e6","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"d4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"e6","to":"d4"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":117,"move":55,"action":{"type":"endTurn"},"fen":["1p3b2/6q1/r2P1kp1/p1P1p3/3NPP2/3K1BP1/3P4/1NR5 b - - 1 29","1p3b2/6q1/r2P1kp1/p1P1p3/3NPP2/3K1BP1/3P4/1NR5 b - - 1 29"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"e6","to":"d4"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":118,"move":56,"action":{"type":"move","from":"e5","to":"f4"},"fen":["1p3b2/6q1/r2P1kp1/p1P1p3/3NPP2/3K1BP1/3P4/1NR5 b - - 1 29","1p3b2/6q1/r2P1kp1/p1P5/3NPp2/3K1BP1/3P4/1NR5 w - - 0 30"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-f2","owner":"white","role":"pawn","originalRole":"pawn","square":"f4","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-f2","owner":"white","role":"pawn","originalRole":"pawn","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"black"}},{"before":{"id":"black-pawn-e7","owner":"black","role":"pawn","originalRole":"pawn","square":"e5","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-e7","owner":"black","role":"pawn","originalRole":"pawn","square":"f4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"e5","to":"f4","capturedId":"white-pawn-f2"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","toll"],"decks":[74,74],"discard":["fatal-attraction"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":119,"move":56,"action":{"type":"playCard","cardId":"toll","cardInstanceId":"white-deck-0-toll","target":"g6"},"fen":["1p3b2/6q1/r2P1kp1/p1P5/3NPp2/3K1BP1/3P4/1NR5 w - - 0 30","1p3b2/6q1/r2P1k2/p1P5/3NPp2/3K1BP1/3P4/1NR5 w - - 0 30"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":1,"black":0}}],"pieces":[{"before":{"id":"black-pawn-g7","owner":"black","role":"pawn","originalRole":"pawn","square":"g6","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-g7","owner":"black","role":"pawn","originalRole":"pawn","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"white"}}],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"toll","player":"white","target":"g6","capturedId":"black-pawn-g7","movement":[],"preservePreviousMove":true}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","toll"],"after":["betrayal","legacy","pacifism","holy-quest","under-elf-hill"],"decks":[74,73],"discard":["fatal-attraction","toll"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":120,"move":56,"action":{"type":"endTurn"},"fen":["1p3b2/6q1/r2P1k2/p1P5/3NPp2/3K1BP1/3P4/1NR5 w - - 0 30","1p3b2/6q1/r2P1k2/p1P5/3NPp2/3K1BP1/3P4/1NR5 w - - 0 30"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":1,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"toll","player":"white","target":"g6","capturedId":"black-pawn-g7","movement":[],"preservePreviousMove":true}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","under-elf-hill"],"after":["betrayal","legacy","pacifism","holy-quest","under-elf-hill"],"decks":[73,73],"discard":["fatal-attraction","toll"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":121,"move":57,"action":{"type":"move","from":"c1","to":"f1"},"fen":["1p3b2/6q1/r2P1k2/p1P5/3NPp2/3K1BP1/3P4/1NR5 w - - 0 30","1p3b2/6q1/r2P1k2/p1P5/3NPp2/3K1BP1/3P4/1N3R2 b - - 1 30"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-rook-h1","owner":"white","role":"rook","originalRole":"rook","square":"c1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-rook-h1","owner":"white","role":"rook","originalRole":"rook","square":"f1","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"c1","to":"f1"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","under-elf-hill"],"after":["betrayal","legacy","pacifism","holy-quest","under-elf-hill"],"decks":[73,73],"discard":["fatal-attraction","toll"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":122,"move":57,"action":{"type":"endTurn"},"fen":["1p3b2/6q1/r2P1k2/p1P5/3NPp2/3K1BP1/3P4/1N3R2 b - - 1 30","1p3b2/6q1/r2P1k2/p1P5/3NPp2/3K1BP1/3P4/1N3R2 b - - 1 30"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"c1","to":"f1"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","under-elf-hill"],"after":["betrayal","legacy","pacifism","holy-quest","under-elf-hill"],"decks":[73,73],"discard":["fatal-attraction","toll"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":123,"move":58,"action":{"type":"move","from":"g7","to":"g3"},"fen":["1p3b2/6q1/r2P1k2/p1P5/3NPp2/3K1BP1/3P4/1N3R2 b - - 1 30","1p3b2/8/r2P1k2/p1P5/3NPp2/3K1Bq1/3P4/1N3R2 w - - 0 31"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-g2","owner":"white","role":"pawn","originalRole":"pawn","square":"g3","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-g2","owner":"white","role":"pawn","originalRole":"pawn","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"black"}},{"before":{"id":"black-queen-d8","owner":"black","role":"queen","originalRole":"queen","square":"g7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-queen-d8","owner":"black","role":"queen","originalRole":"queen","square":"g3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"g7","to":"g3","capturedId":"white-pawn-g2"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","under-elf-hill"],"after":["betrayal","legacy","pacifism","holy-quest","under-elf-hill"],"decks":[73,73],"discard":["fatal-attraction","toll"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":124,"move":58,"action":{"type":"endTurn"},"fen":["1p3b2/8/r2P1k2/p1P5/3NPp2/3K1Bq1/3P4/1N3R2 w - - 0 31","1p3b2/8/r2P1k2/p1P5/3NPp2/3K1Bq1/3P4/1N3R2 w - - 0 31"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"g7","to":"g3","capturedId":"white-pawn-g2"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","under-elf-hill"],"after":["betrayal","legacy","pacifism","holy-quest","under-elf-hill"],"decks":[73,73],"discard":["fatal-attraction","toll"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":125,"move":59,"action":{"type":"move","from":"d3","to":"c2"},"fen":["1p3b2/8/r2P1k2/p1P5/3NPp2/3K1Bq1/3P4/1N3R2 w - - 0 31","1p3b2/8/r2P1k2/p1P5/3NPp2/5Bq1/2KP4/1N3R2 b - - 1 31"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-king-e1","owner":"white","role":"king","originalRole":"king","square":"d3","zone":"board","promoted":false,"royal":true,"neutral":false},"after":{"id":"white-king-e1","owner":"white","role":"king","originalRole":"king","square":"c2","zone":"board","promoted":false,"royal":true,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"d3","to":"c2"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","under-elf-hill"],"after":["betrayal","legacy","pacifism","holy-quest","under-elf-hill"],"decks":[73,73],"discard":["fatal-attraction","toll"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":126,"move":59,"action":{"type":"endTurn"},"fen":["1p3b2/8/r2P1k2/p1P5/3NPp2/5Bq1/2KP4/1N3R2 b - - 1 31","1p3b2/8/r2P1k2/p1P5/3NPp2/5Bq1/2KP4/1N3R2 b - - 1 31"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"d3","to":"c2"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","under-elf-hill"],"after":["betrayal","legacy","pacifism","holy-quest","under-elf-hill"],"decks":[73,73],"discard":["fatal-attraction","toll"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":127,"move":60,"action":{"type":"move","from":"g3","to":"h4"},"fen":["1p3b2/8/r2P1k2/p1P5/3NPp2/5Bq1/2KP4/1N3R2 b - - 1 31","1p3b2/8/r2P1k2/p1P5/3NPp1q/5B2/2KP4/1N3R2 w - - 2 32"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-queen-d8","owner":"black","role":"queen","originalRole":"queen","square":"g3","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-queen-d8","owner":"black","role":"queen","originalRole":"queen","square":"h4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"g3","to":"h4"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","under-elf-hill"],"after":["betrayal","legacy","pacifism","holy-quest","under-elf-hill"],"decks":[73,73],"discard":["fatal-attraction","toll"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
{"step":128,"move":60,"action":{"type":"endTurn"},"fen":["1p3b2/8/r2P1k2/p1P5/3NPp1q/5B2/2KP4/1N3R2 w - - 2 32","1p3b2/8/r2P1k2/p1P5/3NPp1q/5B2/2KP4/1N3R2 w - - 2 32"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"g3","to":"h4"}],"hands":[{"color":"white","before":["betrayal","legacy","pacifism","holy-quest","under-elf-hill"],"after":["betrayal","legacy","pacifism","holy-quest","under-elf-hill"],"decks":[73,73],"discard":["fatal-attraction","toll"]},{"color":"black","before":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"after":["no-quarter","peace-talks","forbidden-city","riposte","truce"],"decks":[71,71],"discard":["toll","blessing","anathema","confabulation"]}],"enPassant":[],"pendingRescue":false}
FINAL {"moves":60,"fen":"1p3b2/8/r2P1k2/p1P5/3NPp1q/5B2/2KP4/1N3R2 w - - 2 32"}
```
