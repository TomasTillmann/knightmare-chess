# Game 074 — Mystic Shield on a neutral piece

Pre-action hypothesis: Mystic Shield can protect a neutral physical piece from capture during the opponent's next turn; moving that neutral piece preserves protection by identity, and protection expires at the stated turn boundary.

Scaffold executed: four probes, zero findings. One independent game executed once, 15 public actions, 13 accepted and 2 rejected; zero findings. Measured game execution wall time: 46.920458 ms. No reset, replay, source modification, test reads, or temporary harness.

## Exact initial options

```json
{"fen":"5r1k/8/8/6b1/3n4/8/8/K7 w - - 0 1","hands":{"white":["neutrality","mystic-shield"],"black":["fireball"]},"decks":{"white":[],"black":[]}}
```

Normal beforeMove initialization; checkState passed and isKingInCheck returned false for both colors. checkState also passed after every accepted action. Physical subject throughout: `black-knight-d4`, originally owned by black.

## Sequential evidence

Predictions were printed before each application. All matched actual results.

| # | Exact action | Pre-action prediction / actual result |
| --- | --- | --- |
| 1 | `{"type":"move","from":"a1","to":"b1"}` | Accepted quiet move; white afterMove. |
| 2 | `{"type":"playCard","cardId":"neutrality","target":"d4"}` | Accepted; knight becomes neutral, retaining original black ownership. |
| 3 | `{"type":"endTurn"}` | Accepted; black beforeMove. |
| 4 | `{"type":"move","from":"h8","to":"g8"}` | Accepted quiet move. |
| 5 | `{"type":"endTurn"}` | Accepted; white beforeMove. |
| 6 | `{"type":"move","from":"d4","to":"f5"}` | Accepted; white controls neutral knight. |
| 7 | `{"type":"playCard","cardId":"mystic-shield","target":"f5"}` | Accepted; effect `{type:"mystic-shield",owner:"white",player:"white",pieceId:"black-knight-d4"}`. |
| 8 | `{"type":"endTurn"}` | Accepted; black protected turn begins. |
| 9 | `{"type":"move","from":"f8","to":"f5"}` | Rejected `ILLEGAL_MOVE`: `That piece cannot capture or be captured.` Input digest unchanged. |
| 10 | `{"type":"move","from":"f5","to":"h4"}` | Accepted; black moves protected neutral knight; identical shield effect persists on its identity. |
| 11 | `{"type":"playCard","cardId":"fireball","target":"h4"}` | Rejected `INVALID_TARGET`: `Choose an unprotected nonroyal piece you just moved.` Input digest unchanged. |
| 12 | `{"type":"endTurn"}` | Accepted; white beforeMove; shield removed, Neutrality remains. |
| 13 | `{"type":"move","from":"b1","to":"a1"}` | Accepted quiet move after shield expiry. |
| 14 | `{"type":"endTurn"}` | Accepted; black beforeMove. |
| 15 | `{"type":"move","from":"g5","to":"h4"}` | Accepted; bishop captures same physical knight. Knight is captured, square null, capturedBy black; Neutrality expires and effects are empty. |

Card target enumeration immediately before plays: Neutrality `["d4","g5","f8"]`; Mystic Shield `["f5"]`; Fireball `[]`. The focal shield selected its returned target. Fireball deliberately supplied the moved square absent from returned targets, exercising capture immunity after relocation with valid public target syntax.

Legal destination enumeration before every attempted move, in order:

```json
{"a1":["b1","a2","b2"]}
{"h8":["g7","h7","g8"]}
{"d4":["c2","e2","b3","f3","b5","f5","c6","e6"]}
{"f8":["f6","f7","a8","b8","c8","d8","e8"]}
{"f5":["e3","g3","d4","h4","d6","g7"]}
{"b1":["a1","a2","b2","c2"]}
{"g5":["c1","d2","e3","f4","f6","h6","e7","d8","h4"]}
```

Final FEN: `5rk1/8/8/8/7b/8/8/K7 w - - 0 4`; outcome null.

## Rule grounds and limits

cards.md Mystic Shield and rules.md §16.3 protect a just-moved neutral physical piece regardless of its original owner during the card player's opponent's next turn, follow relocation, allow its own movement, and expire at that turn's end. §15.1 permits both players to move the neutral piece. §22.1 makes a shield-protected Fireball center ineligible. Catalog timings for Neutrality and Mystic Shield were afterMove; actual moves reached those windows.

This bounded directed three-card game confirms neutral ownership, ordinary capture immunity, relocation-preserved card-capture immunity, and later capture after expiry on this path. No randomized continuation was added because the requested expiry sequence completed the minimal game. It does not cover all transformations, reactions, or composite cases and is not proof of correctness.

GAME_074_DONE
