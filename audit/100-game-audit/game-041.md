# Game 041

Result: PASS. Challenge survives Dungeon relocation and forces forfeiture when the named piece cannot move. The combination is legal in the afterMove timing window.

One game, custom sparse legal position `1n2k3/p7/8/8/8/8/4P3/4K3 w - - 0 1`, starting normally in beforeMove with no effects and white holding Plots Within Plots, Challenge, Dungeon. Rule sources: cards.md Challenge, Dungeon, Plots Within Plots; public production APIs createGameState, applyAction, cardPlayTargets, legalDests. No test sources read and no code, tests, or harness files written.

Every action's expected acceptance was printed before execution:

| # | Action | Prediction | Actual |
|---|---|---|---|
| 1 | White e2-e3 | Accept | Accept |
| 2 | Plots Within Plots, `{player:"white"}` | Accept | Accept |
| 3 | Challenge, `"b8"` | Accept | Accept |
| 4 | Dungeon, `[{from:"b8",to:"a8"}]` | Accept | Accept |
| 5 | End white turn | Accept | Accept |
| 6 | Black a7-a6 | Reject | ILLEGAL_MOVE: Challenge requires moving the named piece. |
| 7 | Black a8-b6 | Reject | ILLEGAL_MOVE: Dungeon prevents moving that piece this turn. |
| 8 | End black turn without moving | Accept forfeiture | Accept; white beforeMove |

Observed exact options: initial moves e1→d1/f1/d2/f2, e2→e3/e4. After e2-e3, Plots target `{player:"white"}`; Challenge targets a7,b8; Dungeon targets each of a7,b8 to each of a1,a8,h1,h8. After Plots, Challenge still offered a7,b8. After Challenge, all eight Dungeon targets remained available. At black turn, legalDests was predicted empty and returned `[]`; both effects retained piece ID `black-knight-b8`. After forfeiture both expired and outcome remained null.

Executed: 8 actions, 0 prediction mismatches, 0 findings; engine wall time 51 ms. Initial execution was blocked before starting by the read-only sandbox's heredoc temporary-file restriction; the authorized escalated execution ran the single game once. No resets or replays.

GAME_041_DONE
