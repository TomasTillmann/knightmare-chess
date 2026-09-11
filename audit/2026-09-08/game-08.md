# Game 08 — Peace Talks direct mate after Pacifism

Prediction: canceling Pacifism on the rook at h8 exposes the black king at a8 to direct checkmate. Ordinary Peace Talks must fizzle under rules 11.1, 11.2, and 22.6.

One game only: FEN `k5n1/pp6/8/8/8/8/8/4K1NR w - - 0 1`, White hand Pacifism and Peace Talks. Planned sequence: Pacifism h1, Ng1-f3, end turn, Ng8-f6, end turn, Rh1-h8, Peace Talks cancel Pacifism, end turn.

## Result: no bug established; predicted mate was wrong

All eight planned actions were accepted in one process and one game. Removing Pacifism checked the black King, but this was **not checkmate**: Nf6-e8 or Nf6-g8 interposes on the rook's eighth-rank attack. Therefore Peace Talks was permitted to remove Pacifism. This fixture does not establish a direct-mate violation. No replay or second game was initialized.

| Action | Prediction made before action | Observation | Result digest |
|---|---|---|---|
| Pacifism h1 | Pacifism attaches to Rh1 | Accepted; both Kings safe | `1613d5c3af0dd144aac20844d57b791c54ebab0722581d8ceb0d654934d0e31b` |
| Ng1-f3 | Nf3 safe | Accepted; both Kings safe | `64a634083828f660c7d2eca07c9f6761a7c8dd5499cef2f8f16b9946070356de` |
| endTurn | Black turn safe | Accepted; both Kings safe | `d5eea3cf2207e9bb71ae47d2fa814244a39f81e87b750e345bc9759c5f6d1363` |
| Ng8-f6 | Nf6 safe | Accepted; both Kings safe | `a43f3b91fe9f89d9716b258efa3031f97ebbd9dd6e779086bc8f47d7d47c24ea` |
| endTurn | White turn safe | Accepted; both Kings safe | `15aad00446e0ca3e8fabbf5d22331aae39f584cd3fdca3ad34a7a3e2c0550419` |
| Rh1-h8 | Rh8 cannot check under Pacifism | Accepted; both Kings safe | `558dffe6b3e2b4a1b4693bf68db964dc7fd3b9cd3c87eeae58e4b08fe61dac1f` |
| Peace Talks target white-hand-0-pacifism | Incorrectly predicted mate and fizzle | Accepted; Black checked, White safe, effects empty, outcome null | `fb0a34de728a50c9a0e4b3f5f9fda48e5f18c980c9bc55920203b4afed191979` |
| endTurn | Incorrectly predicted continuing Pacifism | Accepted; Black checked, White safe, outcome null | `dd91f87d1f941c2669c14d52c16dbde4df3a1de584c54f20e57bbe6ef467f8e1` |

Before cancellation, FEN was `k6R/pp6/5n2/8/8/5N2/8/4K3 b - - 3 2`; turn was White afterMove, moveMade true, both card-play counts zero. Effect was `{"type":"pacifism","owner":"white","card":{"id":"white-hand-0-pacifism","cardId":"pacifism"},"pieceId":"white-rook-h1"}`. White had Peace Talks in hand and an empty discard pile. After cancellation the FEN and pieces were unchanged; effects were empty; White card-play count became one; both Peace Talks and Pacifism entered White's discard pile in that order. The appended event was `{"type":"cardPlayed","cardId":"peace-talks","movement":[],"preservePreviousMove":true}`. Outcome remained null, correctly allowing Black to answer the check.

Complete final state after endTurn:

```json
{"fen":"k6R/pp6/5n2/8/8/5N2/8/4K3 b - - 3 2","pieces":[{"id":"white-king-e1","owner":"white","role":"king","originalRole":"king","square":"e1","zone":"board","promoted":false,"royal":true,"neutral":false},{"id":"white-knight-g1","owner":"white","role":"knight","originalRole":"knight","square":"f3","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"white-rook-h1","owner":"white","role":"rook","originalRole":"rook","square":"h8","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-pawn-a7","owner":"black","role":"pawn","originalRole":"pawn","square":"a7","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-pawn-b7","owner":"black","role":"pawn","originalRole":"pawn","square":"b7","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-king-a8","owner":"black","role":"king","originalRole":"king","square":"a8","zone":"board","promoted":false,"royal":true,"neutral":false},{"id":"black-knight-g8","owner":"black","role":"knight","originalRole":"knight","square":"f6","zone":"board","promoted":false,"royal":false,"neutral":false}],"players":{"white":{"hand":[],"deck":[],"discard":[{"id":"white-hand-1-peace-talks","cardId":"peace-talks"},{"id":"white-hand-0-pacifism","cardId":"pacifism"}]},"black":{"hand":[],"deck":[],"discard":[]}},"turn":{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},"effects":[],"history":[{"type":"cardPlayed","cardId":"pacifism","target":"h1","movement":[],"preservePreviousMove":false},{"type":"move","from":"g1","to":"f3"},{"type":"move","from":"g8","to":"f6"},{"type":"move","from":"h1","to":"h8"},{"type":"cardPlayed","cardId":"peace-talks","movement":[],"preservePreviousMove":true}],"orientation":0,"enPassant":[],"pendingRescue":null,"pendingDoomsayer":null,"outcome":null,"playedCards":[{"player":"white","cardInstanceId":"white-hand-0-pacifism"},{"player":"white","cardInstanceId":"white-hand-1-peace-talks"}]}
```

The parent scaffold passed using `campaign/fixtures/plots-rescue.json.state`: `checkState`, rejected malformed z9-a1 move, unchanged original digest, and valid returned state. The initial directed state and all eight returned states passed `checkState`; each action preserved the input digest. No source, test, or harness files were edited. Runner: `node --import tsx --input-type=module -e`.

GAME_08_DONE — 8 accepted directed actions, 0 rejected directed actions, 1 scaffold rejection, 0 confirmed findings, measured scaffold-plus-game wall time 18 ms.
