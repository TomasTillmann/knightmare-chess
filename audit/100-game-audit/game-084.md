# Game 084 — seed 908084

## Pre-run predictions

- Board squares hold at most one piece; piece IDs remain unique and piece colors/types remain valid.
- Ordinary chess moves respect the active side and available legal actions; any apparent deviation requires an explicit card rule.
- Captures remove their victim, and king safety and terminal status remain consistent with engine rules.
- Card plays require the applicable timing, ownership, and targets; their observed board/state effects will be checked independently against the authoritative card and general rules.

## Independent review plan

Run exactly one bounded seeded campaign, retain initial state, options, action trace, final FEN, card coverage, action count, and elapsed time. Review at least three critical observed transitions against rules.md/cards.md, separating these post-run checks from the predictions above. Run the parent scaffold before and after the game. No replay or second game.

## Run result

- Exactly one `generateTrace(908084, 20, progress)` call; no replay, reset, or second game.
- Completed 45 accepted actions: 20 ordinary moves, 4 card plays, 21 end-turn actions. Candidate rejection count is unavailable because the existing helper does not expose it; do not interpret this as zero rejections.
- Measured generation wall time: 732.703833 ms. Callback limit: 80 accepted actions or 15 seconds. No budget stop and no helper failure.
- Saved-fixture scaffold before and after: `SCAFFOLD_OK probes=4 findings=0` each; eight scaffold probes total.
- Final FEN: `1rbqk3/1ppppp2/p4nb1/6p1/1P1P3r/1QP4N/P3P3/R1BNK3 b Q - 2 11`.
- Played cards: Plots Within Plots, Holy War, Dubbing, Fireball, once each. Sampled-card counts: `{"plots-within-plots":2,"holy-war":1,"merciless":5,"toll":2,"split-knight":4,"under-elf-hill":1,"charge":2,"dubbing":2,"annexation":4,"riposte":3,"hidden-passage":1,"fireball":2}`.
- Findings: zero confirmed defects on the observed path; prior audit findings were consulted and none reproduced.

## Independent post-run semantic review

These conclusions were made after observing the game; they are not claimed as card-specific pre-action predictions.

1. **Step 3, Holy War (cards.md Holy War; rules.md §20 and §6 Swap).** White had just moved b2–b4 and remained in afterMove. White's physical Knight b1 and Bishop f1 must exchange squares without capture or identity/role changes. The two recorded deltas put the Knight on f1 and Bishop on b1, preserve both roles/owners, and do not consume another move. White alone spends a card and receives Split Knight. Black's Plots expenditure remains separate. The apparently changed FEN en-passant field (`-` to `b3`) accompanies unchanged explicit enPassant metadata; there is no black adjacent capturing pawn and no demonstrated legality difference, so this is not classified as a defect.
2. **Step 29, Dubbing (cards.md Dubbing; rules.md §13.9).** Black's Bishop f8 may move to empty g6 using displacement (1,-2), jumping the pawn on f7; the Bishop must remain a Bishop and this must replace Black's Regular Move. The trace preserves physical identity/role, moves only f8→g6, sets afterMove/moveMade, increases halfmove 2→3 and fullmove 7→8, and clears enPassant. Step 30 ends that turn without an additional ordinary move. Correct on this path.
3. **Steps 39–40, Fireball (cards.md Fireball; rules.md §22.1).** White's h1→g1 rook move captures nothing and qualifies as the immediate trigger. The g1 center and occupied neighboring f2/g2/h2 must be captured; empty f1/h1 contribute no victims, and the King e1 lies outside adjacency. Exactly those four white physical records become captured with their IDs preserved; the halfmove clock resets 3→0, fullmove stays 10, and White remains afterMove. The black bishop g6 line to e4 is empty but continues toward d3/c2/b1 rather than e1; the black rook h4 attacks the blocked fourth rank and h3, so the blast does not expose White's King. Correct on this path.
4. **Step 2, Plots Within Plots (cards.md Plots Within Plots; rules.md §17.3 and §9).** Black uses the available opposing-move window immediately after b2–b4. The board and clocks remain unchanged, Black's allowance becomes one, exactly the named card enters Black's discard, and Riposte is drawn. White then spends its own independent allowance on Holy War; Black uses zero additional Plots cards before endTurn, explicitly permitted by §17.3. This checks consumption and expiration behavior through the trace, not unexercised saved-target edge cases.
5. **Steps 23 and 33, lasting identity after swap (rules.md §1, §6 Swap, §20).** The Bishop originally from f1 must keep bishop movement after Holy War. Its b1→h7 diagonal passes through c2,d3,e4,f5,g6, all empty at step 23, and captures the h7 pawn. Black's later h8→h7 rook capture removes that same bishop ID and revokes Black's kingside castling right. Both recorded transitions agree.

## Limits and protocol disclosure

This is a finite seeded path with automated structural/ordinary-chess checks plus independent semantic review, not exhaustive correctness evidence. Catalog timings were inspected in the post-run review; the required existing generator itself invokes cardPlayTargets before selecting every played target. No card artwork was independently opened. The helper reports 20 ordinary moves but Dubbing is also a completed replacement move, explaining 21 ended turns. Report/review work exceeded the 45-second overall audit target, while the game itself completed within its explicit budget. The first report patch preceded exploration; no source, test, or harness file was written and no tests were read.

## Exact initial state

```json
{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","pieces":[{"id":"white-rook-a1","owner":"white","role":"rook","originalRole":"rook","square":"a1","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"white-knight-b1","owner":"white","role":"knight","originalRole":"knight","square":"b1","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"white-bishop-c1","owner":"white","role":"bishop","originalRole":"bishop","square":"c1","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"white-queen-d1","owner":"white","role":"queen","originalRole":"queen","square":"d1","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"white-king-e1","owner":"white","role":"king","originalRole":"king","square":"e1","zone":"board","promoted":false,"royal":true,"neutral":false},{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"f1","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"g1","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"white-rook-h1","owner":"white","role":"rook","originalRole":"rook","square":"h1","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"white-pawn-a2","owner":"white","role":"pawn","originalRole":"pawn","square":"a2","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"white-pawn-b2","owner":"white","role":"pawn","originalRole":"pawn","square":"b2","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"white-pawn-c2","owner":"white","role":"pawn","originalRole":"pawn","square":"c2","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"white-pawn-d2","owner":"white","role":"pawn","originalRole":"pawn","square":"d2","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"white-pawn-e2","owner":"white","role":"pawn","originalRole":"pawn","square":"e2","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"white-pawn-f2","owner":"white","role":"pawn","originalRole":"pawn","square":"f2","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"white-pawn-g2","owner":"white","role":"pawn","originalRole":"pawn","square":"g2","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"white-pawn-h2","owner":"white","role":"pawn","originalRole":"pawn","square":"h2","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-pawn-a7","owner":"black","role":"pawn","originalRole":"pawn","square":"a7","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-pawn-b7","owner":"black","role":"pawn","originalRole":"pawn","square":"b7","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-pawn-c7","owner":"black","role":"pawn","originalRole":"pawn","square":"c7","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-pawn-d7","owner":"black","role":"pawn","originalRole":"pawn","square":"d7","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-pawn-e7","owner":"black","role":"pawn","originalRole":"pawn","square":"e7","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-pawn-f7","owner":"black","role":"pawn","originalRole":"pawn","square":"f7","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-pawn-g7","owner":"black","role":"pawn","originalRole":"pawn","square":"g7","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-pawn-h7","owner":"black","role":"pawn","originalRole":"pawn","square":"h7","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-rook-a8","owner":"black","role":"rook","originalRole":"rook","square":"a8","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":"b8","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-bishop-c8","owner":"black","role":"bishop","originalRole":"bishop","square":"c8","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-queen-d8","owner":"black","role":"queen","originalRole":"queen","square":"d8","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-king-e8","owner":"black","role":"king","originalRole":"king","square":"e8","zone":"board","promoted":false,"royal":true,"neutral":false},{"id":"black-bishop-f8","owner":"black","role":"bishop","originalRole":"bishop","square":"f8","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-knight-g8","owner":"black","role":"knight","originalRole":"knight","square":"g8","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-rook-h8","owner":"black","role":"rook","originalRole":"rook","square":"h8","zone":"board","promoted":false,"royal":false,"neutral":false}],"players":{"white":{"hand":[{"id":"white-hand-0-under-elf-hill","cardId":"under-elf-hill"},{"id":"white-hand-1-toll","cardId":"toll"},{"id":"white-hand-2-hidden-passage","cardId":"hidden-passage"},{"id":"white-hand-3-fireball","cardId":"fireball"},{"id":"white-hand-4-holy-war","cardId":"holy-war"}],"deck":[{"id":"white-deck-0-split-knight","cardId":"split-knight"},{"id":"white-deck-1-cathedral","cardId":"cathedral"},{"id":"white-deck-2-irresistible-force","cardId":"irresistible-force"},{"id":"white-deck-3-onslaught","cardId":"onslaught"},{"id":"white-deck-4-doomsayer","cardId":"doomsayer"},{"id":"white-deck-5-treason","cardId":"treason"},{"id":"white-deck-6-rebirth","cardId":"rebirth"},{"id":"white-deck-7-guardian","cardId":"guardian"},{"id":"white-deck-8-neutrality","cardId":"neutrality"},{"id":"white-deck-9-revenge","cardId":"revenge"},{"id":"white-deck-10-hostage","cardId":"hostage"},{"id":"white-deck-11-riposte","cardId":"riposte"},{"id":"white-deck-12-anathema","cardId":"anathema"},{"id":"white-deck-13-lost-castle","cardId":"lost-castle"},{"id":"white-deck-14-forbidden-city","cardId":"forbidden-city"},{"id":"white-deck-15-curse","cardId":"curse"},{"id":"white-deck-16-fog-of-war","cardId":"fog-of-war"},{"id":"white-deck-17-dubbing","cardId":"dubbing"},{"id":"white-deck-18-evil-eye","cardId":"evil-eye"},{"id":"white-deck-19-earthquake","cardId":"earthquake"},{"id":"white-deck-20-fortification","cardId":"fortification"},{"id":"white-deck-21-forced-march","cardId":"forced-march"},{"id":"white-deck-22-bombard","cardId":"bombard"},{"id":"white-deck-23-passing-in-the-night","cardId":"passing-in-the-night"},{"id":"white-deck-24-chaos","cardId":"chaos"},{"id":"white-deck-25-disintegration","cardId":"disintegration"},{"id":"white-deck-26-winged-victory","cardId":"winged-victory"},{"id":"white-deck-27-mystic-shield","cardId":"mystic-shield"},{"id":"white-deck-28-legacy","cardId":"legacy"},{"id":"white-deck-29-vulture","cardId":"vulture"},{"id":"white-deck-30-ghostwalk","cardId":"ghostwalk"},{"id":"white-deck-31-knightmare","cardId":"knightmare"},{"id":"white-deck-32-figure-dance","cardId":"figure-dance"},{"id":"white-deck-33-breakthrough","cardId":"breakthrough"},{"id":"white-deck-34-doppelganger","cardId":"doppelganger"},{"id":"white-deck-35-squaring-the-circle","cardId":"squaring-the-circle"},{"id":"white-deck-36-vendetta","cardId":"vendetta"},{"id":"white-deck-37-merciless","cardId":"merciless"},{"id":"white-deck-38-think-again","cardId":"think-again"},{"id":"white-deck-39-blessing","cardId":"blessing"},{"id":"white-deck-40-masquerade","cardId":"masquerade"},{"id":"white-deck-41-siege","cardId":"siege"},{"id":"white-deck-42-abduction","cardId":"abduction"},{"id":"white-deck-43-tournament","cardId":"tournament"},{"id":"white-deck-44-assassin","cardId":"assassin"},{"id":"white-deck-45-evangelists","cardId":"evangelists"},{"id":"white-deck-46-panic","cardId":"panic"},{"id":"white-deck-47-confabulation","cardId":"confabulation"},{"id":"white-deck-48-resurrection","cardId":"resurrection"},{"id":"white-deck-49-crab","cardId":"crab"},{"id":"white-deck-50-long-jump","cardId":"long-jump"},{"id":"white-deck-51-betrayal","cardId":"betrayal"},{"id":"white-deck-52-haunting-memories","cardId":"haunting-memories"},{"id":"white-deck-53-coup","cardId":"coup"},{"id":"white-deck-54-man-trap","cardId":"man-trap"},{"id":"white-deck-55-cowardice","cardId":"cowardice"},{"id":"white-deck-56-holy-quest","cardId":"holy-quest"},{"id":"white-deck-57-plots-within-plots","cardId":"plots-within-plots"},{"id":"white-deck-58-truce","cardId":"truce"},{"id":"white-deck-59-dark-mirror","cardId":"dark-mirror"},{"id":"white-deck-60-fatal-attraction","cardId":"fatal-attraction"},{"id":"white-deck-61-bog","cardId":"bog"},{"id":"white-deck-62-annexation","cardId":"annexation"},{"id":"white-deck-63-crusade","cardId":"crusade"},{"id":"white-deck-64-challenge","cardId":"challenge"},{"id":"white-deck-65-madman","cardId":"madman"},{"id":"white-deck-66-fanatic","cardId":"fanatic"},{"id":"white-deck-67-dungeon","cardId":"dungeon"},{"id":"white-deck-68-pacifism","cardId":"pacifism"},{"id":"white-deck-69-heresy","cardId":"heresy"},{"id":"white-deck-70-peace-talks","cardId":"peace-talks"},{"id":"white-deck-71-no-quarter","cardId":"no-quarter"},{"id":"white-deck-72-charge","cardId":"charge"},{"id":"white-deck-73-sanctuary","cardId":"sanctuary"},{"id":"white-deck-74-man-of-straw","cardId":"man-of-straw"}],"discard":[]},"black":{"hand":[{"id":"black-hand-0-plots-within-plots","cardId":"plots-within-plots"},{"id":"black-hand-1-charge","cardId":"charge"},{"id":"black-hand-2-merciless","cardId":"merciless"},{"id":"black-hand-3-dubbing","cardId":"dubbing"},{"id":"black-hand-4-annexation","cardId":"annexation"}],"deck":[{"id":"black-deck-0-riposte","cardId":"riposte"},{"id":"black-deck-1-irresistible-force","cardId":"irresistible-force"},{"id":"black-deck-2-man-of-straw","cardId":"man-of-straw"},{"id":"black-deck-3-assassin","cardId":"assassin"},{"id":"black-deck-4-long-jump","cardId":"long-jump"},{"id":"black-deck-5-siege","cardId":"siege"},{"id":"black-deck-6-evil-eye","cardId":"evil-eye"},{"id":"black-deck-7-forbidden-city","cardId":"forbidden-city"},{"id":"black-deck-8-blessing","cardId":"blessing"},{"id":"black-deck-9-rebirth","cardId":"rebirth"},{"id":"black-deck-10-heresy","cardId":"heresy"},{"id":"black-deck-11-fanatic","cardId":"fanatic"},{"id":"black-deck-12-pacifism","cardId":"pacifism"},{"id":"black-deck-13-man-trap","cardId":"man-trap"},{"id":"black-deck-14-dark-mirror","cardId":"dark-mirror"},{"id":"black-deck-15-lost-castle","cardId":"lost-castle"},{"id":"black-deck-16-toll","cardId":"toll"},{"id":"black-deck-17-doppelganger","cardId":"doppelganger"},{"id":"black-deck-18-truce","cardId":"truce"},{"id":"black-deck-19-hostage","cardId":"hostage"},{"id":"black-deck-20-fatal-attraction","cardId":"fatal-attraction"},{"id":"black-deck-21-dungeon","cardId":"dungeon"},{"id":"black-deck-22-fireball","cardId":"fireball"},{"id":"black-deck-23-tournament","cardId":"tournament"},{"id":"black-deck-24-madman","cardId":"madman"},{"id":"black-deck-25-think-again","cardId":"think-again"},{"id":"black-deck-26-bog","cardId":"bog"},{"id":"black-deck-27-vendetta","cardId":"vendetta"},{"id":"black-deck-28-haunting-memories","cardId":"haunting-memories"},{"id":"black-deck-29-sanctuary","cardId":"sanctuary"},{"id":"black-deck-30-abduction","cardId":"abduction"},{"id":"black-deck-31-cathedral","cardId":"cathedral"},{"id":"black-deck-32-doomsayer","cardId":"doomsayer"},{"id":"black-deck-33-breakthrough","cardId":"breakthrough"},{"id":"black-deck-34-ghostwalk","cardId":"ghostwalk"},{"id":"black-deck-35-holy-war","cardId":"holy-war"},{"id":"black-deck-36-passing-in-the-night","cardId":"passing-in-the-night"},{"id":"black-deck-37-bombard","cardId":"bombard"},{"id":"black-deck-38-evangelists","cardId":"evangelists"},{"id":"black-deck-39-split-knight","cardId":"split-knight"},{"id":"black-deck-40-neutrality","cardId":"neutrality"},{"id":"black-deck-41-panic","cardId":"panic"},{"id":"black-deck-42-peace-talks","cardId":"peace-talks"},{"id":"black-deck-43-hidden-passage","cardId":"hidden-passage"},{"id":"black-deck-44-guardian","cardId":"guardian"},{"id":"black-deck-45-coup","cardId":"coup"},{"id":"black-deck-46-earthquake","cardId":"earthquake"},{"id":"black-deck-47-forced-march","cardId":"forced-march"},{"id":"black-deck-48-anathema","cardId":"anathema"},{"id":"black-deck-49-winged-victory","cardId":"winged-victory"},{"id":"black-deck-50-confabulation","cardId":"confabulation"},{"id":"black-deck-51-challenge","cardId":"challenge"},{"id":"black-deck-52-under-elf-hill","cardId":"under-elf-hill"},{"id":"black-deck-53-masquerade","cardId":"masquerade"},{"id":"black-deck-54-fortification","cardId":"fortification"},{"id":"black-deck-55-fog-of-war","cardId":"fog-of-war"},{"id":"black-deck-56-mystic-shield","cardId":"mystic-shield"},{"id":"black-deck-57-crab","cardId":"crab"},{"id":"black-deck-58-chaos","cardId":"chaos"},{"id":"black-deck-59-disintegration","cardId":"disintegration"},{"id":"black-deck-60-crusade","cardId":"crusade"},{"id":"black-deck-61-resurrection","cardId":"resurrection"},{"id":"black-deck-62-revenge","cardId":"revenge"},{"id":"black-deck-63-curse","cardId":"curse"},{"id":"black-deck-64-knightmare","cardId":"knightmare"},{"id":"black-deck-65-onslaught","cardId":"onslaught"},{"id":"black-deck-66-figure-dance","cardId":"figure-dance"},{"id":"black-deck-67-betrayal","cardId":"betrayal"},{"id":"black-deck-68-holy-quest","cardId":"holy-quest"},{"id":"black-deck-69-legacy","cardId":"legacy"},{"id":"black-deck-70-treason","cardId":"treason"},{"id":"black-deck-71-no-quarter","cardId":"no-quarter"},{"id":"black-deck-72-cowardice","cardId":"cowardice"},{"id":"black-deck-73-vulture","cardId":"vulture"},{"id":"black-deck-74-squaring-the-circle","cardId":"squaring-the-circle"}],"discard":[]}},"turn":{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},"effects":[],"history":[],"orientation":0,"enPassant":[],"pendingRescue":null,"pendingDoomsayer":null,"outcome":null}
```

## Exact options and accepted action trace

```json
{
  "seed": 908084,
  "maxMoves": 20,
  "digestVersion": 2,
  "initial": {
    "hands": {
      "white": [
        "under-elf-hill",
        "toll",
        "hidden-passage",
        "fireball",
        "holy-war"
      ],
      "black": [
        "plots-within-plots",
        "charge",
        "merciless",
        "dubbing",
        "annexation"
      ]
    },
    "decks": {
      "white": [
        "split-knight",
        "cathedral",
        "irresistible-force",
        "onslaught",
        "doomsayer",
        "treason",
        "rebirth",
        "guardian",
        "neutrality",
        "revenge",
        "hostage",
        "riposte",
        "anathema",
        "lost-castle",
        "forbidden-city",
        "curse",
        "fog-of-war",
        "dubbing",
        "evil-eye",
        "earthquake",
        "fortification",
        "forced-march",
        "bombard",
        "passing-in-the-night",
        "chaos",
        "disintegration",
        "winged-victory",
        "mystic-shield",
        "legacy",
        "vulture",
        "ghostwalk",
        "knightmare",
        "figure-dance",
        "breakthrough",
        "doppelganger",
        "squaring-the-circle",
        "vendetta",
        "merciless",
        "think-again",
        "blessing",
        "masquerade",
        "siege",
        "abduction",
        "tournament",
        "assassin",
        "evangelists",
        "panic",
        "confabulation",
        "resurrection",
        "crab",
        "long-jump",
        "betrayal",
        "haunting-memories",
        "coup",
        "man-trap",
        "cowardice",
        "holy-quest",
        "plots-within-plots",
        "truce",
        "dark-mirror",
        "fatal-attraction",
        "bog",
        "annexation",
        "crusade",
        "challenge",
        "madman",
        "fanatic",
        "dungeon",
        "pacifism",
        "heresy",
        "peace-talks",
        "no-quarter",
        "charge",
        "sanctuary",
        "man-of-straw"
      ],
      "black": [
        "riposte",
        "irresistible-force",
        "man-of-straw",
        "assassin",
        "long-jump",
        "siege",
        "evil-eye",
        "forbidden-city",
        "blessing",
        "rebirth",
        "heresy",
        "fanatic",
        "pacifism",
        "man-trap",
        "dark-mirror",
        "lost-castle",
        "toll",
        "doppelganger",
        "truce",
        "hostage",
        "fatal-attraction",
        "dungeon",
        "fireball",
        "tournament",
        "madman",
        "think-again",
        "bog",
        "vendetta",
        "haunting-memories",
        "sanctuary",
        "abduction",
        "cathedral",
        "doomsayer",
        "breakthrough",
        "ghostwalk",
        "holy-war",
        "passing-in-the-night",
        "bombard",
        "evangelists",
        "split-knight",
        "neutrality",
        "panic",
        "peace-talks",
        "hidden-passage",
        "guardian",
        "coup",
        "earthquake",
        "forced-march",
        "anathema",
        "winged-victory",
        "confabulation",
        "challenge",
        "under-elf-hill",
        "masquerade",
        "fortification",
        "fog-of-war",
        "mystic-shield",
        "crab",
        "chaos",
        "disintegration",
        "crusade",
        "resurrection",
        "revenge",
        "curse",
        "knightmare",
        "onslaught",
        "figure-dance",
        "betrayal",
        "holy-quest",
        "legacy",
        "treason",
        "no-quarter",
        "cowardice",
        "vulture",
        "squaring-the-circle"
      ]
    }
  },
  "steps": [
    {
      "action": {
        "type": "move",
        "from": "b2",
        "to": "b4"
      },
      "expected": "fc9f52df2ffb03ecddf71ab7bb78a95f185bbea13924eae60ed8fef799a326aa"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "plots-within-plots",
        "cardInstanceId": "black-hand-0-plots-within-plots",
        "target": {
          "player": "black"
        }
      },
      "expected": "766876c77a5be508b904d44267f798dda8a3ae05ffeabb136ff3bfaccf3c0b21"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "holy-war",
        "cardInstanceId": "white-hand-4-holy-war",
        "target": {
          "knight": "b1",
          "bishop": "f1"
        }
      },
      "expected": "4e0c8e0eb53f36fcdd81add6de70c1c9f2b664a77230c921ef5e2c8796833175"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "89e344e81e24cd11fd8705a1dfbf1ced420eb139ec5fa3ae03165577131375d1"
    },
    {
      "action": {
        "type": "move",
        "from": "b8",
        "to": "c6"
      },
      "expected": "2920ef56e2dbfaca86fcddf9307415b852bab54e511cccdb0656fb194f865d87"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "227a62436b5ac7d578b1450a0b2c52e2075b1c5fa7a6206f6e4573d609868196"
    },
    {
      "action": {
        "type": "move",
        "from": "c2",
        "to": "c3"
      },
      "expected": "6a086a35c2b6efb6940cbf5ef77a99b9795b9599498f17762354a88b635ed44f"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "60f1bb04a5fa54283ba6b1a50f05c25aa6c58d976c342e3199d4db680e9ee6f3"
    },
    {
      "action": {
        "type": "move",
        "from": "c6",
        "to": "d4"
      },
      "expected": "06a4746ff60ace4de52028b88d51dc092c61cbcc131463b68dcff14a0dabddb3"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "7357e0ff847fad0b81f8649a4b54b751dbddbaf7615ac2bea9e8469f2b69f57e"
    },
    {
      "action": {
        "type": "move",
        "from": "g1",
        "to": "h3"
      },
      "expected": "efedd3d5fb168966b38afbb4376c42640894b4267835cc3e08184c7918d017db"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "e31237bf50bb535b3515053360abbbb35b231fe24c979af59bdbef94f3fde594"
    },
    {
      "action": {
        "type": "move",
        "from": "d4",
        "to": "b3"
      },
      "expected": "b309fcbe17cc94d3d168ad6d1b4f52608af5d956aaea26c4739834bdf342a51a"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "8eb73764a4cef617c14cd80056ee412f7deb6baeb553cd6d24cf0c781d93eff4"
    },
    {
      "action": {
        "type": "move",
        "from": "d1",
        "to": "b3"
      },
      "expected": "781d4cca9d9b25deab15676bf5debb6bb8767e70204ab53366c1e2aeb59acac9"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "cac10903ee2b0be530261a198c8823b5dc70ab1962c578cdd79976365268de37"
    },
    {
      "action": {
        "type": "move",
        "from": "a7",
        "to": "a6"
      },
      "expected": "485b502857460cfc74c004bb2a31860c4f3dfab288e2756eaea81eb354c00e83"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "bd3f8e74fcc033771e52dc45a945c40181d8979a79ded672041f31c7b2574f65"
    },
    {
      "action": {
        "type": "move",
        "from": "b3",
        "to": "a3"
      },
      "expected": "e1050662669cad7ff3fceee92524112e1ec91f507a1b498bb5b94e989c3c9c8f"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "4369a930dfadb5e652838af3f11473208d1a461bfcf1d6d5e601ade162f126ac"
    },
    {
      "action": {
        "type": "move",
        "from": "g7",
        "to": "g5"
      },
      "expected": "2c40997cbd8dd66ad85afa623cf447a5265e6a91049d944096d34e98008e559b"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "e0211a3b545c64feea740ec4e0d1ee20ef271344a8f9ddf78b98644e74a426d9"
    },
    {
      "action": {
        "type": "move",
        "from": "b1",
        "to": "h7"
      },
      "expected": "eca36c2002f7ffc88475097c9c6ec4bce9a56ab64a00b365599f27a788388855"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "186917340e60cb007bcfd722b3d244e37f379074f5fd8c4f5ec36024d643b93f"
    },
    {
      "action": {
        "type": "move",
        "from": "a8",
        "to": "b8"
      },
      "expected": "54f3f755d1c4af574d8571a27caa678f9e9952419692bc199149ab5ec8f82760"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "ccbaf4226299a63f45639c598a5445e25fd078ac745e203e7727143e6ab04d18"
    },
    {
      "action": {
        "type": "move",
        "from": "f1",
        "to": "e3"
      },
      "expected": "84b10aca2821fc832d047293cfcb0db786a7f14620668332d930a55092997043"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "90ab95a454d78d6a7faf0ca8a948a6933510a6e389fa8046fed92f8b0e05ee23"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "dubbing",
        "cardInstanceId": "black-hand-3-dubbing",
        "target": [
          {
            "from": "f8",
            "to": "g6"
          }
        ]
      },
      "expected": "343cc9aa875d4afae5e413535ae9fb2b13ed71418d7ff5277d2e62889cd68f30"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "6d10aef111cd68a88ef7fa7413731dfb9e9553c83f4097365d8d593b42a452c5"
    },
    {
      "action": {
        "type": "move",
        "from": "d2",
        "to": "d4"
      },
      "expected": "755adba0851cae9edd610ca134977ff6dbb94edbc7b6c011697355418bfbb900"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "3ac3e09b790eb4a834681323036184d8837b2b4966e93aac0d62ce873774ed49"
    },
    {
      "action": {
        "type": "move",
        "from": "h8",
        "to": "h7"
      },
      "expected": "cf8c5ccf878736b37080aca2cf67e55792a08dbc8cd263933b36bbe682a34073"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "b7c78ae65d6288d0b008983e893dd5155059f4199576c9a483de0e6d7a42290e"
    },
    {
      "action": {
        "type": "move",
        "from": "a3",
        "to": "b3"
      },
      "expected": "01ffa0ed8d7423003f8ec77e461ed32147e2c0505615f53bf820f33dbd383885"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "5344bd238ec7b46e6189f07ef4acaff0f35268bfa456151aabccb826ffb8614d"
    },
    {
      "action": {
        "type": "move",
        "from": "h7",
        "to": "h4"
      },
      "expected": "4512cc2fe7cf685cb6d4c806345d2a38627cd325b2bb80af8979f9a17e31e52d"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "8250b8660804f97b171b69025cf4d1ca0c7aa64f6ed29c12c7a240cd36437874"
    },
    {
      "action": {
        "type": "move",
        "from": "h1",
        "to": "g1"
      },
      "expected": "45f1aa00a1cff477fbcff767e3b078aa42104b515222b05040953a0cba7dd8fe"
    },
    {
      "action": {
        "type": "playCard",
        "cardId": "fireball",
        "cardInstanceId": "white-hand-3-fireball",
        "target": "g1"
      },
      "expected": "ed52d9ed8309ddb72cc81aee0acb9c04d91e1888c89ed758745b82187a52adbd"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "1c6c330c2aae546fb9254597fb2130541bcd306cecf1d2e2b433b4c25ec779d0"
    },
    {
      "action": {
        "type": "move",
        "from": "g8",
        "to": "f6"
      },
      "expected": "dfe8f1ebf1339c04e33cb40c84ae82268d276c50a969d346596258af61fc9444"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "4ff92ca01c77b539fac9815d97c6235773e03bf863eaa6b551d408d000900b5a"
    },
    {
      "action": {
        "type": "move",
        "from": "e3",
        "to": "d1"
      },
      "expected": "630f4f6bf88a87eff51ce121df315f00b7d21ffb9b06b24a31affb18f7604cd6"
    },
    {
      "action": {
        "type": "endTurn"
      },
      "expected": "1ddb43ca132a2c4d7ed3bf750a11d85bcc3c540964d69bec335279631ff39987"
    }
  ],
  "moves": 20,
  "finalFen": "1rbqk3/1ppppp2/p4nb1/6p1/1P1P3r/1QP4N/P3P3/R1BNK3 b Q - 2 11",
  "sampledCards": {
    "plots-within-plots": 2,
    "holy-war": 1,
    "merciless": 5,
    "toll": 2,
    "split-knight": 4,
    "under-elf-hill": 1,
    "charge": 2,
    "dubbing": 2,
    "annexation": 4,
    "riposte": 3,
    "hidden-passage": 1,
    "fireball": 2
  }
}
```

## Sequential before/after evidence

```jsonl
Seed 908084; standard starting board; shuffled catalog house-variant decks (rules §4.3).
Each row must be independently reviewed against rules.md/cards.md; hashes alone are not an oracle.
{"step":1,"move":1,"action":{"type":"move","from":"b2","to":"b4"},"fen":["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","rnbqkbnr/pppppppp/8/8/1P6/8/P1PPPPPP/RNBQKBNR b KQkq - 0 1"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-b2","owner":"white","role":"pawn","originalRole":"pawn","square":"b2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-b2","owner":"white","role":"pawn","originalRole":"pawn","square":"b4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"b2","to":"b4"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","holy-war"],"after":["under-elf-hill","toll","hidden-passage","fireball","holy-war"],"decks":[75,75],"discard":[]},{"color":"black","before":["plots-within-plots","charge","merciless","dubbing","annexation"],"after":["plots-within-plots","charge","merciless","dubbing","annexation"],"decks":[75,75],"discard":[]}],"enPassant":[{"target":"b3","pawnId":"white-pawn-b2"}],"pendingRescue":false}
{"step":2,"move":1,"action":{"type":"playCard","cardId":"plots-within-plots","cardInstanceId":"black-hand-0-plots-within-plots","target":{"player":"black"}},"fen":["rnbqkbnr/pppppppp/8/8/1P6/8/P1PPPPPP/RNBQKBNR b KQkq - 0 1","rnbqkbnr/pppppppp/8/8/1P6/8/P1PPPPPP/RNBQKBNR b KQkq - 0 1"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}}],"pieces":[],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"plots-within-plots","player":"black","preservePreviousMove":true,"movement":[]}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","holy-war"],"after":["under-elf-hill","toll","hidden-passage","fireball","holy-war"],"decks":[75,75],"discard":[]},{"color":"black","before":["plots-within-plots","charge","merciless","dubbing","annexation"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[75,74],"discard":["plots-within-plots"]}],"enPassant":[{"target":"b3","pawnId":"white-pawn-b2"}],"pendingRescue":false}
{"step":3,"move":1,"action":{"type":"playCard","cardId":"holy-war","cardInstanceId":"white-hand-4-holy-war","target":{"knight":"b1","bishop":"f1"}},"fen":["rnbqkbnr/pppppppp/8/8/1P6/8/P1PPPPPP/RNBQKBNR b KQkq - 0 1","rnbqkbnr/pppppppp/8/8/1P6/8/P1PPPPPP/RBBQKNNR b KQkq b3 0 1"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":1,"black":1}}],"pieces":[{"before":{"id":"white-knight-b1","owner":"white","role":"knight","originalRole":"knight","square":"b1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-knight-b1","owner":"white","role":"knight","originalRole":"knight","square":"f1","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"f1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"b1","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"holy-war","target":{"knight":"b1","bishop":"f1"},"movement":[{"from":"b1","to":"f1"},{"from":"f1","to":"b1"}],"preservePreviousMove":true}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","holy-war"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[75,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[{"target":"b3","pawnId":"white-pawn-b2"}],"pendingRescue":false}
{"step":4,"move":1,"action":{"type":"endTurn"},"fen":["rnbqkbnr/pppppppp/8/8/1P6/8/P1PPPPPP/RBBQKNNR b KQkq b3 0 1","rnbqkbnr/pppppppp/8/8/1P6/8/P1PPPPPP/RBBQKNNR b KQkq b3 0 1"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":1,"black":1}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"holy-war","target":{"knight":"b1","bishop":"f1"},"movement":[{"from":"b1","to":"f1"},{"from":"f1","to":"b1"}],"preservePreviousMove":true}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[{"target":"b3","pawnId":"white-pawn-b2"}],"pendingRescue":false}
{"step":5,"move":2,"action":{"type":"move","from":"b8","to":"c6"},"fen":["rnbqkbnr/pppppppp/8/8/1P6/8/P1PPPPPP/RBBQKNNR b KQkq b3 0 1","r1bqkbnr/pppppppp/2n5/8/1P6/8/P1PPPPPP/RBBQKNNR w KQkq - 1 2"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":"b8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":"c6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"b8","to":"c6","movedPieceId":"black-knight-b8","movedRoles":["knight"]}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":6,"move":2,"action":{"type":"endTurn"},"fen":["r1bqkbnr/pppppppp/2n5/8/1P6/8/P1PPPPPP/RBBQKNNR w KQkq - 1 2","r1bqkbnr/pppppppp/2n5/8/1P6/8/P1PPPPPP/RBBQKNNR w KQkq - 1 2"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"b8","to":"c6","movedPieceId":"black-knight-b8","movedRoles":["knight"]}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":7,"move":3,"action":{"type":"move","from":"c2","to":"c3"},"fen":["r1bqkbnr/pppppppp/2n5/8/1P6/8/P1PPPPPP/RBBQKNNR w KQkq - 1 2","r1bqkbnr/pppppppp/2n5/8/1P6/2P5/P2PPPPP/RBBQKNNR b KQkq - 0 2"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-c2","owner":"white","role":"pawn","originalRole":"pawn","square":"c2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-c2","owner":"white","role":"pawn","originalRole":"pawn","square":"c3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"c2","to":"c3"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":8,"move":3,"action":{"type":"endTurn"},"fen":["r1bqkbnr/pppppppp/2n5/8/1P6/2P5/P2PPPPP/RBBQKNNR b KQkq - 0 2","r1bqkbnr/pppppppp/2n5/8/1P6/2P5/P2PPPPP/RBBQKNNR b KQkq - 0 2"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"c2","to":"c3"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":9,"move":4,"action":{"type":"move","from":"c6","to":"d4"},"fen":["r1bqkbnr/pppppppp/2n5/8/1P6/2P5/P2PPPPP/RBBQKNNR b KQkq - 0 2","r1bqkbnr/pppppppp/8/8/1P1n4/2P5/P2PPPPP/RBBQKNNR w KQkq - 1 3"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":"c6","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":"d4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"c6","to":"d4","movedPieceId":"black-knight-b8","movedRoles":["knight"]}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":10,"move":4,"action":{"type":"endTurn"},"fen":["r1bqkbnr/pppppppp/8/8/1P1n4/2P5/P2PPPPP/RBBQKNNR w KQkq - 1 3","r1bqkbnr/pppppppp/8/8/1P1n4/2P5/P2PPPPP/RBBQKNNR w KQkq - 1 3"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"c6","to":"d4","movedPieceId":"black-knight-b8","movedRoles":["knight"]}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":11,"move":5,"action":{"type":"move","from":"g1","to":"h3"},"fen":["r1bqkbnr/pppppppp/8/8/1P1n4/2P5/P2PPPPP/RBBQKNNR w KQkq - 1 3","r1bqkbnr/pppppppp/8/8/1P1n4/2P4N/P2PPPPP/RBBQKN1R b KQkq - 2 3"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"g1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"h3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"g1","to":"h3"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":12,"move":5,"action":{"type":"endTurn"},"fen":["r1bqkbnr/pppppppp/8/8/1P1n4/2P4N/P2PPPPP/RBBQKN1R b KQkq - 2 3","r1bqkbnr/pppppppp/8/8/1P1n4/2P4N/P2PPPPP/RBBQKN1R b KQkq - 2 3"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"g1","to":"h3"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":13,"move":6,"action":{"type":"move","from":"d4","to":"b3"},"fen":["r1bqkbnr/pppppppp/8/8/1P1n4/2P4N/P2PPPPP/RBBQKN1R b KQkq - 2 3","r1bqkbnr/pppppppp/8/8/1P6/1nP4N/P2PPPPP/RBBQKN1R w KQkq - 3 4"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":"d4","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":"b3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"d4","to":"b3","movedPieceId":"black-knight-b8","movedRoles":["knight"]}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":14,"move":6,"action":{"type":"endTurn"},"fen":["r1bqkbnr/pppppppp/8/8/1P6/1nP4N/P2PPPPP/RBBQKN1R w KQkq - 3 4","r1bqkbnr/pppppppp/8/8/1P6/1nP4N/P2PPPPP/RBBQKN1R w KQkq - 3 4"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"d4","to":"b3","movedPieceId":"black-knight-b8","movedRoles":["knight"]}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":15,"move":7,"action":{"type":"move","from":"d1","to":"b3"},"fen":["r1bqkbnr/pppppppp/8/8/1P6/1nP4N/P2PPPPP/RBBQKN1R w KQkq - 3 4","r1bqkbnr/pppppppp/8/8/1P6/1QP4N/P2PPPPP/RBB1KN1R b KQkq - 0 4"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-queen-d1","owner":"white","role":"queen","originalRole":"queen","square":"d1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-queen-d1","owner":"white","role":"queen","originalRole":"queen","square":"b3","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":"b3","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-knight-b8","owner":"black","role":"knight","originalRole":"knight","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"white"}}],"effects":[[],[]],"events":[{"type":"move","from":"d1","to":"b3","capturedId":"black-knight-b8"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":16,"move":7,"action":{"type":"endTurn"},"fen":["r1bqkbnr/pppppppp/8/8/1P6/1QP4N/P2PPPPP/RBB1KN1R b KQkq - 0 4","r1bqkbnr/pppppppp/8/8/1P6/1QP4N/P2PPPPP/RBB1KN1R b KQkq - 0 4"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"d1","to":"b3","capturedId":"black-knight-b8"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":17,"move":8,"action":{"type":"move","from":"a7","to":"a6"},"fen":["r1bqkbnr/pppppppp/8/8/1P6/1QP4N/P2PPPPP/RBB1KN1R b KQkq - 0 4","r1bqkbnr/1ppppppp/p7/8/1P6/1QP4N/P2PPPPP/RBB1KN1R w KQkq - 0 5"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-pawn-a7","owner":"black","role":"pawn","originalRole":"pawn","square":"a7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-a7","owner":"black","role":"pawn","originalRole":"pawn","square":"a6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"a7","to":"a6","movedPieceId":"black-pawn-a7","movedRoles":["pawn"]}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":18,"move":8,"action":{"type":"endTurn"},"fen":["r1bqkbnr/1ppppppp/p7/8/1P6/1QP4N/P2PPPPP/RBB1KN1R w KQkq - 0 5","r1bqkbnr/1ppppppp/p7/8/1P6/1QP4N/P2PPPPP/RBB1KN1R w KQkq - 0 5"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"a7","to":"a6","movedPieceId":"black-pawn-a7","movedRoles":["pawn"]}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":19,"move":9,"action":{"type":"move","from":"b3","to":"a3"},"fen":["r1bqkbnr/1ppppppp/p7/8/1P6/1QP4N/P2PPPPP/RBB1KN1R w KQkq - 0 5","r1bqkbnr/1ppppppp/p7/8/1P6/Q1P4N/P2PPPPP/RBB1KN1R b KQkq - 1 5"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-queen-d1","owner":"white","role":"queen","originalRole":"queen","square":"b3","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-queen-d1","owner":"white","role":"queen","originalRole":"queen","square":"a3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"b3","to":"a3"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":20,"move":9,"action":{"type":"endTurn"},"fen":["r1bqkbnr/1ppppppp/p7/8/1P6/Q1P4N/P2PPPPP/RBB1KN1R b KQkq - 1 5","r1bqkbnr/1ppppppp/p7/8/1P6/Q1P4N/P2PPPPP/RBB1KN1R b KQkq - 1 5"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"b3","to":"a3"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":21,"move":10,"action":{"type":"move","from":"g7","to":"g5"},"fen":["r1bqkbnr/1ppppppp/p7/8/1P6/Q1P4N/P2PPPPP/RBB1KN1R b KQkq - 1 5","r1bqkbnr/1ppppp1p/p7/6p1/1P6/Q1P4N/P2PPPPP/RBB1KN1R w KQkq - 0 6"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-pawn-g7","owner":"black","role":"pawn","originalRole":"pawn","square":"g7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-g7","owner":"black","role":"pawn","originalRole":"pawn","square":"g5","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"g7","to":"g5","movedPieceId":"black-pawn-g7","movedRoles":["pawn"]}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[{"target":"g6","pawnId":"black-pawn-g7"}],"pendingRescue":false}
{"step":22,"move":10,"action":{"type":"endTurn"},"fen":["r1bqkbnr/1ppppp1p/p7/6p1/1P6/Q1P4N/P2PPPPP/RBB1KN1R w KQkq - 0 6","r1bqkbnr/1ppppp1p/p7/6p1/1P6/Q1P4N/P2PPPPP/RBB1KN1R w KQkq - 0 6"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"g7","to":"g5","movedPieceId":"black-pawn-g7","movedRoles":["pawn"]}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[{"target":"g6","pawnId":"black-pawn-g7"}],"pendingRescue":false}
{"step":23,"move":11,"action":{"type":"move","from":"b1","to":"h7"},"fen":["r1bqkbnr/1ppppp1p/p7/6p1/1P6/Q1P4N/P2PPPPP/RBB1KN1R w KQkq - 0 6","r1bqkbnr/1ppppp1B/p7/6p1/1P6/Q1P4N/P2PPPPP/R1B1KN1R b KQkq - 0 6"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"b1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"h7","zone":"board","promoted":false,"royal":false,"neutral":false}},{"before":{"id":"black-pawn-h7","owner":"black","role":"pawn","originalRole":"pawn","square":"h7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-pawn-h7","owner":"black","role":"pawn","originalRole":"pawn","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"white"}}],"effects":[[],[]],"events":[{"type":"move","from":"b1","to":"h7","capturedId":"black-pawn-h7"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":24,"move":11,"action":{"type":"endTurn"},"fen":["r1bqkbnr/1ppppp1B/p7/6p1/1P6/Q1P4N/P2PPPPP/R1B1KN1R b KQkq - 0 6","r1bqkbnr/1ppppp1B/p7/6p1/1P6/Q1P4N/P2PPPPP/R1B1KN1R b KQkq - 0 6"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"b1","to":"h7","capturedId":"black-pawn-h7"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":25,"move":12,"action":{"type":"move","from":"a8","to":"b8"},"fen":["r1bqkbnr/1ppppp1B/p7/6p1/1P6/Q1P4N/P2PPPPP/R1B1KN1R b KQkq - 0 6","1rbqkbnr/1ppppp1B/p7/6p1/1P6/Q1P4N/P2PPPPP/R1B1KN1R w KQk - 1 7"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-rook-a8","owner":"black","role":"rook","originalRole":"rook","square":"a8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-rook-a8","owner":"black","role":"rook","originalRole":"rook","square":"b8","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"a8","to":"b8","movedPieceId":"black-rook-a8","movedRoles":["rook"]}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":26,"move":12,"action":{"type":"endTurn"},"fen":["1rbqkbnr/1ppppp1B/p7/6p1/1P6/Q1P4N/P2PPPPP/R1B1KN1R w KQk - 1 7","1rbqkbnr/1ppppp1B/p7/6p1/1P6/Q1P4N/P2PPPPP/R1B1KN1R w KQk - 1 7"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"a8","to":"b8","movedPieceId":"black-rook-a8","movedRoles":["rook"]}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":27,"move":13,"action":{"type":"move","from":"f1","to":"e3"},"fen":["1rbqkbnr/1ppppp1B/p7/6p1/1P6/Q1P4N/P2PPPPP/R1B1KN1R w KQk - 1 7","1rbqkbnr/1ppppp1B/p7/6p1/1P6/Q1P1N2N/P2PPPPP/R1B1K2R b KQk - 2 7"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-knight-b1","owner":"white","role":"knight","originalRole":"knight","square":"f1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-knight-b1","owner":"white","role":"knight","originalRole":"knight","square":"e3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"f1","to":"e3"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":28,"move":13,"action":{"type":"endTurn"},"fen":["1rbqkbnr/1ppppp1B/p7/6p1/1P6/Q1P1N2N/P2PPPPP/R1B1K2R b KQk - 2 7","1rbqkbnr/1ppppp1B/p7/6p1/1P6/Q1P1N2N/P2PPPPP/R1B1K2R b KQk - 2 7"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"f1","to":"e3"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","dubbing","annexation","riposte"],"decks":[74,74],"discard":["plots-within-plots"]}],"enPassant":[],"pendingRescue":false}
{"step":29,"move":13,"action":{"type":"playCard","cardId":"dubbing","cardInstanceId":"black-hand-3-dubbing","target":[{"from":"f8","to":"g6"}]},"fen":["1rbqkbnr/1ppppp1B/p7/6p1/1P6/Q1P1N2N/P2PPPPP/R1B1K2R b KQk - 2 7","1rbqk1nr/1ppppp1B/p5b1/6p1/1P6/Q1P1N2N/P2PPPPP/R1B1K2R w KQk - 3 8"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}}],"pieces":[{"before":{"id":"black-bishop-f8","owner":"black","role":"bishop","originalRole":"bishop","square":"f8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-bishop-f8","owner":"black","role":"bishop","originalRole":"bishop","square":"g6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"dubbing","target":[{"from":"f8","to":"g6"}],"movement":[{"from":"f8","to":"g6"}],"preservePreviousMove":false}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","dubbing","annexation","riposte"],"after":["charge","merciless","annexation","riposte","irresistible-force"],"decks":[74,73],"discard":["plots-within-plots","dubbing"]}],"enPassant":[],"pendingRescue":false}
{"step":30,"move":13,"action":{"type":"endTurn"},"fen":["1rbqk1nr/1ppppp1B/p5b1/6p1/1P6/Q1P1N2N/P2PPPPP/R1B1K2R w KQk - 3 8","1rbqk1nr/1ppppp1B/p5b1/6p1/1P6/Q1P1N2N/P2PPPPP/R1B1K2R w KQk - 3 8"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":1}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"dubbing","target":[{"from":"f8","to":"g6"}],"movement":[{"from":"f8","to":"g6"}],"preservePreviousMove":false}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","annexation","riposte","irresistible-force"],"after":["charge","merciless","annexation","riposte","irresistible-force"],"decks":[73,73],"discard":["plots-within-plots","dubbing"]}],"enPassant":[],"pendingRescue":false}
{"step":31,"move":14,"action":{"type":"move","from":"d2","to":"d4"},"fen":["1rbqk1nr/1ppppp1B/p5b1/6p1/1P6/Q1P1N2N/P2PPPPP/R1B1K2R w KQk - 3 8","1rbqk1nr/1ppppp1B/p5b1/6p1/1P1P4/Q1P1N2N/P3PPPP/R1B1K2R b KQk - 0 8"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-pawn-d2","owner":"white","role":"pawn","originalRole":"pawn","square":"d2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-d2","owner":"white","role":"pawn","originalRole":"pawn","square":"d4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"d2","to":"d4"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","annexation","riposte","irresistible-force"],"after":["charge","merciless","annexation","riposte","irresistible-force"],"decks":[73,73],"discard":["plots-within-plots","dubbing"]}],"enPassant":[{"target":"d3","pawnId":"white-pawn-d2"}],"pendingRescue":false}
{"step":32,"move":14,"action":{"type":"endTurn"},"fen":["1rbqk1nr/1ppppp1B/p5b1/6p1/1P1P4/Q1P1N2N/P3PPPP/R1B1K2R b KQk - 0 8","1rbqk1nr/1ppppp1B/p5b1/6p1/1P1P4/Q1P1N2N/P3PPPP/R1B1K2R b KQk - 0 8"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"d2","to":"d4"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","annexation","riposte","irresistible-force"],"after":["charge","merciless","annexation","riposte","irresistible-force"],"decks":[73,73],"discard":["plots-within-plots","dubbing"]}],"enPassant":[{"target":"d3","pawnId":"white-pawn-d2"}],"pendingRescue":false}
{"step":33,"move":15,"action":{"type":"move","from":"h8","to":"h7"},"fen":["1rbqk1nr/1ppppp1B/p5b1/6p1/1P1P4/Q1P1N2N/P3PPPP/R1B1K2R b KQk - 0 8","1rbqk1n1/1ppppp1r/p5b1/6p1/1P1P4/Q1P1N2N/P3PPPP/R1B1K2R w KQ - 0 9"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":"h7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-bishop-f1","owner":"white","role":"bishop","originalRole":"bishop","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"black"}},{"before":{"id":"black-rook-h8","owner":"black","role":"rook","originalRole":"rook","square":"h8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-rook-h8","owner":"black","role":"rook","originalRole":"rook","square":"h7","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"h8","to":"h7","capturedId":"white-bishop-f1","movedPieceId":"black-rook-h8","movedRoles":["rook"]}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","annexation","riposte","irresistible-force"],"after":["charge","merciless","annexation","riposte","irresistible-force"],"decks":[73,73],"discard":["plots-within-plots","dubbing"]}],"enPassant":[],"pendingRescue":false}
{"step":34,"move":15,"action":{"type":"endTurn"},"fen":["1rbqk1n1/1ppppp1r/p5b1/6p1/1P1P4/Q1P1N2N/P3PPPP/R1B1K2R w KQ - 0 9","1rbqk1n1/1ppppp1r/p5b1/6p1/1P1P4/Q1P1N2N/P3PPPP/R1B1K2R w KQ - 0 9"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"h8","to":"h7","capturedId":"white-bishop-f1","movedPieceId":"black-rook-h8","movedRoles":["rook"]}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","annexation","riposte","irresistible-force"],"after":["charge","merciless","annexation","riposte","irresistible-force"],"decks":[73,73],"discard":["plots-within-plots","dubbing"]}],"enPassant":[],"pendingRescue":false}
{"step":35,"move":16,"action":{"type":"move","from":"a3","to":"b3"},"fen":["1rbqk1n1/1ppppp1r/p5b1/6p1/1P1P4/Q1P1N2N/P3PPPP/R1B1K2R w KQ - 0 9","1rbqk1n1/1ppppp1r/p5b1/6p1/1P1P4/1QP1N2N/P3PPPP/R1B1K2R b KQ - 1 9"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-queen-d1","owner":"white","role":"queen","originalRole":"queen","square":"a3","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-queen-d1","owner":"white","role":"queen","originalRole":"queen","square":"b3","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"a3","to":"b3"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","annexation","riposte","irresistible-force"],"after":["charge","merciless","annexation","riposte","irresistible-force"],"decks":[73,73],"discard":["plots-within-plots","dubbing"]}],"enPassant":[],"pendingRescue":false}
{"step":36,"move":16,"action":{"type":"endTurn"},"fen":["1rbqk1n1/1ppppp1r/p5b1/6p1/1P1P4/1QP1N2N/P3PPPP/R1B1K2R b KQ - 1 9","1rbqk1n1/1ppppp1r/p5b1/6p1/1P1P4/1QP1N2N/P3PPPP/R1B1K2R b KQ - 1 9"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"a3","to":"b3"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","annexation","riposte","irresistible-force"],"after":["charge","merciless","annexation","riposte","irresistible-force"],"decks":[73,73],"discard":["plots-within-plots","dubbing"]}],"enPassant":[],"pendingRescue":false}
{"step":37,"move":17,"action":{"type":"move","from":"h7","to":"h4"},"fen":["1rbqk1n1/1ppppp1r/p5b1/6p1/1P1P4/1QP1N2N/P3PPPP/R1B1K2R b KQ - 1 9","1rbqk1n1/1ppppp2/p5b1/6p1/1P1P3r/1QP1N2N/P3PPPP/R1B1K2R w KQ - 2 10"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-rook-h8","owner":"black","role":"rook","originalRole":"rook","square":"h7","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-rook-h8","owner":"black","role":"rook","originalRole":"rook","square":"h4","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"h7","to":"h4","movedPieceId":"black-rook-h8","movedRoles":["rook"]}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","annexation","riposte","irresistible-force"],"after":["charge","merciless","annexation","riposte","irresistible-force"],"decks":[73,73],"discard":["plots-within-plots","dubbing"]}],"enPassant":[],"pendingRescue":false}
{"step":38,"move":17,"action":{"type":"endTurn"},"fen":["1rbqk1n1/1ppppp2/p5b1/6p1/1P1P3r/1QP1N2N/P3PPPP/R1B1K2R w KQ - 2 10","1rbqk1n1/1ppppp2/p5b1/6p1/1P1P3r/1QP1N2N/P3PPPP/R1B1K2R w KQ - 2 10"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"h7","to":"h4","movedPieceId":"black-rook-h8","movedRoles":["rook"]}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","annexation","riposte","irresistible-force"],"after":["charge","merciless","annexation","riposte","irresistible-force"],"decks":[73,73],"discard":["plots-within-plots","dubbing"]}],"enPassant":[],"pendingRescue":false}
{"step":39,"move":18,"action":{"type":"move","from":"h1","to":"g1"},"fen":["1rbqk1n1/1ppppp2/p5b1/6p1/1P1P3r/1QP1N2N/P3PPPP/R1B1K2R w KQ - 2 10","1rbqk1n1/1ppppp2/p5b1/6p1/1P1P3r/1QP1N2N/P3PPPP/R1B1K1R1 b Q - 3 10"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-rook-h1","owner":"white","role":"rook","originalRole":"rook","square":"h1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-rook-h1","owner":"white","role":"rook","originalRole":"rook","square":"g1","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"h1","to":"g1"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"decks":[74,74],"discard":["holy-war"]},{"color":"black","before":["charge","merciless","annexation","riposte","irresistible-force"],"after":["charge","merciless","annexation","riposte","irresistible-force"],"decks":[73,73],"discard":["plots-within-plots","dubbing"]}],"enPassant":[],"pendingRescue":false}
{"step":40,"move":18,"action":{"type":"playCard","cardId":"fireball","cardInstanceId":"white-hand-3-fireball","target":"g1"},"fen":["1rbqk1n1/1ppppp2/p5b1/6p1/1P1P3r/1QP1N2N/P3PPPP/R1B1K1R1 b Q - 3 10","1rbqk1n1/1ppppp2/p5b1/6p1/1P1P3r/1QP1N2N/P3P3/R1B1K3 b Q - 0 10"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":1,"black":0}}],"pieces":[{"before":{"id":"white-rook-h1","owner":"white","role":"rook","originalRole":"rook","square":"g1","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-rook-h1","owner":"white","role":"rook","originalRole":"rook","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"white"}},{"before":{"id":"white-pawn-f2","owner":"white","role":"pawn","originalRole":"pawn","square":"f2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-f2","owner":"white","role":"pawn","originalRole":"pawn","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"white"}},{"before":{"id":"white-pawn-g2","owner":"white","role":"pawn","originalRole":"pawn","square":"g2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-g2","owner":"white","role":"pawn","originalRole":"pawn","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"white"}},{"before":{"id":"white-pawn-h2","owner":"white","role":"pawn","originalRole":"pawn","square":"h2","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-pawn-h2","owner":"white","role":"pawn","originalRole":"pawn","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"white"}}],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"fireball","target":"g1","capturedIds":["white-rook-h1","white-pawn-f2","white-pawn-g2","white-pawn-h2"],"player":"white","movement":[],"preservePreviousMove":true}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","fireball","split-knight"],"after":["under-elf-hill","toll","hidden-passage","split-knight","cathedral"],"decks":[74,73],"discard":["holy-war","fireball"]},{"color":"black","before":["charge","merciless","annexation","riposte","irresistible-force"],"after":["charge","merciless","annexation","riposte","irresistible-force"],"decks":[73,73],"discard":["plots-within-plots","dubbing"]}],"enPassant":[],"pendingRescue":false}
{"step":41,"move":18,"action":{"type":"endTurn"},"fen":["1rbqk1n1/1ppppp2/p5b1/6p1/1P1P3r/1QP1N2N/P3P3/R1B1K3 b Q - 0 10","1rbqk1n1/1ppppp2/p5b1/6p1/1P1P3r/1QP1N2N/P3P3/R1B1K3 b Q - 0 10"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":1,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"cardPlayed","cardId":"fireball","target":"g1","capturedIds":["white-rook-h1","white-pawn-f2","white-pawn-g2","white-pawn-h2"],"player":"white","movement":[],"preservePreviousMove":true}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","split-knight","cathedral"],"after":["under-elf-hill","toll","hidden-passage","split-knight","cathedral"],"decks":[73,73],"discard":["holy-war","fireball"]},{"color":"black","before":["charge","merciless","annexation","riposte","irresistible-force"],"after":["charge","merciless","annexation","riposte","irresistible-force"],"decks":[73,73],"discard":["plots-within-plots","dubbing"]}],"enPassant":[],"pendingRescue":false}
{"step":42,"move":19,"action":{"type":"move","from":"g8","to":"f6"},"fen":["1rbqk1n1/1ppppp2/p5b1/6p1/1P1P3r/1QP1N2N/P3P3/R1B1K3 b Q - 0 10","1rbqk3/1ppppp2/p4nb1/6p1/1P1P3r/1QP1N2N/P3P3/R1B1K3 w Q - 1 11"],"turn":[{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"black-knight-g8","owner":"black","role":"knight","originalRole":"knight","square":"g8","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"black-knight-g8","owner":"black","role":"knight","originalRole":"knight","square":"f6","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"g8","to":"f6","movedPieceId":"black-knight-g8","movedRoles":["knight"]}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","split-knight","cathedral"],"after":["under-elf-hill","toll","hidden-passage","split-knight","cathedral"],"decks":[73,73],"discard":["holy-war","fireball"]},{"color":"black","before":["charge","merciless","annexation","riposte","irresistible-force"],"after":["charge","merciless","annexation","riposte","irresistible-force"],"decks":[73,73],"discard":["plots-within-plots","dubbing"]}],"enPassant":[],"pendingRescue":false}
{"step":43,"move":19,"action":{"type":"endTurn"},"fen":["1rbqk3/1ppppp2/p4nb1/6p1/1P1P3r/1QP1N2N/P3P3/R1B1K3 w Q - 1 11","1rbqk3/1ppppp2/p4nb1/6p1/1P1P3r/1QP1N2N/P3P3/R1B1K3 w Q - 1 11"],"turn":[{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"g8","to":"f6","movedPieceId":"black-knight-g8","movedRoles":["knight"]}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","split-knight","cathedral"],"after":["under-elf-hill","toll","hidden-passage","split-knight","cathedral"],"decks":[73,73],"discard":["holy-war","fireball"]},{"color":"black","before":["charge","merciless","annexation","riposte","irresistible-force"],"after":["charge","merciless","annexation","riposte","irresistible-force"],"decks":[73,73],"discard":["plots-within-plots","dubbing"]}],"enPassant":[],"pendingRescue":false}
{"step":44,"move":20,"action":{"type":"move","from":"e3","to":"d1"},"fen":["1rbqk3/1ppppp2/p4nb1/6p1/1P1P3r/1QP1N2N/P3P3/R1B1K3 w Q - 1 11","1rbqk3/1ppppp2/p4nb1/6p1/1P1P3r/1QP4N/P3P3/R1BNK3 b Q - 2 11"],"turn":[{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}}],"pieces":[{"before":{"id":"white-knight-b1","owner":"white","role":"knight","originalRole":"knight","square":"e3","zone":"board","promoted":false,"royal":false,"neutral":false},"after":{"id":"white-knight-b1","owner":"white","role":"knight","originalRole":"knight","square":"d1","zone":"board","promoted":false,"royal":false,"neutral":false}}],"effects":[[],[]],"events":[{"type":"move","from":"e3","to":"d1"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","split-knight","cathedral"],"after":["under-elf-hill","toll","hidden-passage","split-knight","cathedral"],"decks":[73,73],"discard":["holy-war","fireball"]},{"color":"black","before":["charge","merciless","annexation","riposte","irresistible-force"],"after":["charge","merciless","annexation","riposte","irresistible-force"],"decks":[73,73],"discard":["plots-within-plots","dubbing"]}],"enPassant":[],"pendingRescue":false}
{"step":45,"move":20,"action":{"type":"endTurn"},"fen":["1rbqk3/1ppppp2/p4nb1/6p1/1P1P3r/1QP4N/P3P3/R1BNK3 b Q - 2 11","1rbqk3/1ppppp2/p4nb1/6p1/1P1P3r/1QP4N/P3P3/R1BNK3 b Q - 2 11"],"turn":[{"color":"white","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}}],"pieces":[],"effects":[[],[]],"events":[{"type":"move","from":"e3","to":"d1"}],"hands":[{"color":"white","before":["under-elf-hill","toll","hidden-passage","split-knight","cathedral"],"after":["under-elf-hill","toll","hidden-passage","split-knight","cathedral"],"decks":[73,73],"discard":["holy-war","fireball"]},{"color":"black","before":["charge","merciless","annexation","riposte","irresistible-force"],"after":["charge","merciless","annexation","riposte","irresistible-force"],"decks":[73,73],"discard":["plots-within-plots","dubbing"]}],"enPassant":[],"pendingRescue":false}
FINAL {"moves":20,"fen":"1rbqk3/1ppppp2/p4nb1/6p1/1P1P3r/1QP4N/P3P3/R1BNK3 b Q - 2 11"}
```

GAME_084_DONE
