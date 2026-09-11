# Game 062 — Under Elf Hill and Coup royal

Pre-action hypothesis: a Knight designated royal by Coup royal retains that identity after Under Elf Hill removal and mandatory edge return. The returned physical Knight cannot move during its return turn, including attempts that would otherwise be legal Knight moves.

Scaffold executed: four probes, zero findings. One game executed once through public APIs: 20 actions, 16 accepted, 4 rejected, 38.882125 ms measured game wall time. No engine correctness findings. No temporary harness created.

Rule grounds: cards.md Coup makes the chosen piece royal while preserving its normal move; Under Elf Hill removes that King and requires a vacant, safe edge return at the beginning of its next turn, followed by a normal turn in which that King cannot move. Catalog timing: Coup afterMove; Under Elf Hill beforeMove. Predictions below were supplied before each action. Initial checkState passed; both isKingInCheck results were false. checkState passed after every accepted action, and digest remained unchanged after every rejection.

Exact createGameState options (no overrides):
```json
{"fen":"7k/6p1/8/8/8/8/P7/KN6 w - - 0 1","hands":{"white":["coup","under-elf-hill"]}}
```

Actions use move(from,to), playCard(cardId,target?), returnKing(to), and endTurn with precisely those named public fields.

| # | Action | Pre-action expected / actual |
|---|---|---|
|1|move a2 a3|Accept / accepted; white afterMove|
|2|playCard coup b1|Accept and royal Knight / accepted; white-knight-b1 royal=true, role=knight|
|3|endTurn|Accept / accepted; black beforeMove|
|4|move g7 g6|Accept / accepted|
|5|endTurn|Accept / accepted; white beforeMove|
|6|playCard under-elf-hill (target omitted)|Accept, remove royal Knight / accepted; white-knight-b1 away, square=null, royal=true|
|7|endTurn|Accept / accepted; black beforeMove|
|8|move g6 g5|Accept / accepted|
|9|endTurn|Accept, mandatory return / accepted; white beforeMove; returning=true|
|10|move a3 a4|Reject until return / INVALID_TIMING, Return your King before taking another action|
|11|returnKing d4|Reject interior / INVALID_TARGET|
|12|returnKing a1|Reject occupied / INVALID_TARGET|
|13|returnKing h1|Accept same royal physical Knight / accepted; white-knight-b1 board h1, role=knight, royal=true; returned=true|
|14|move h1 f2|Reject returned Knight / ILLEGAL_MOVE; message says Dungeon prevents moving that piece this turn|
|15|move a1 b1|Accept Prince normal move / accepted; white afterMove|
|16|endTurn|Accept / accepted; black beforeMove; underElfHill=[]|
|17|move h8 h7|Accept seeded continuation / accepted|
|18|endTurn|Accept / accepted; white beforeMove|
|19|move h1 f2|Accept next-turn Knight movement / accepted; same physical Knight royal=true at f2|
|20|endTurn|Accept / accepted; black beforeMove|

Exact enumerations: initial legalDests a1:[b2], b1:[d2,a3,c3], a2:[a3,a4]. Before #2 cardPlayTargets(coup)=[b1,a3], selecting b1. Before #4 legalDests g7:[g5,g6], h8:[h7,g8]. Before #6 cardPlayTargets(under-elf-hill)=[undefined] (JSON serializes as [null]); selected the no-target action. Before #8 legalDests g6:[g5], h8:[g7,h7,g8]. Pending return legalDests=[]; return squares=[b1,c1,d1,e1,f1,g1,h1,a2,h2,h3,a4,a5,h5,a6,h6,a7,a8,b8,c8,d8,e8,f8]. Interior d4 and occupied a1 are absent; h4, attacked by black pawn g5, is also absent. Selected h1. After return legalDests a1:[b1,a2,b2], a3:[a4], with no h1 entry. Before seeded #17 legalDests g5:[g4], h8:[g7,h7,g8]; seed 62062 modulo four flattened moves selected h8-h7. Before #19 legalDests b1:[a1,c1,a2,b2,c2], h1:[f2,g3], a3:[a4].

The return freeze correctly follows white-knight-b1 physical identity, preserves its royalty and Knight geometry, leaves the Prince free to move, and expires after the return turn. The rejection wording mentions Dungeon although the applied restriction comes from Under Elf Hill; this is wording only, outside the engine-correctness finding scope.

Limitations: one sparse finite path, one seeded move; does not prove all card-induced movement restrictions or mating/attack consequences. No duplicate of the prior audit's confirmed findings. Only this report was written; no test sources read, no UI tests run, no game reset/replay.

GAME_062_DONE
