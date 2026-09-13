# Full-game UI coverage review

## What the current runner proves

`tests/self-play.spec.ts` selects public-engine-accepted actions and `tests/support/selfPlay.ts` performs those actions through visible buttons, physical hand cards, and board coordinates. After each action the driver compares actual rendered piece positions, accessible positions, hand ordering/playability, effect types, turn controls, orientation, terminal status text, browser errors, and horizontal overflow against its model.

This is useful evidence of UI/model consistency for the executed sequence. It is not an independent proof of chess/card rules: the app and driver use the same engine, and selection checks reuse the UI adapters.

## What it does not prove about full games

- The `step < steps` loop can end with `state.outcome === null` and still pass. Defaults are only 100 actions; a larger action cap also does not require completion. The attachment records the outcome, so capped runs can be distinguished from finished games afterward.
- The runner requires an outcome only when it cannot select another action. It does not establish that random play will eventually terminate, nor cover each terminal reason. Public `GameState.outcome` supports checkmate, stalemate, and surrender; there is no general repetition/fifty-move outcome in that type.
- Unless explicitly passed an ordinary-game setting, it chooses `practiceCards` and creates debug fixture states. Those runs do not prove a full game from the normal starting position.
- A displayed outcome can still permit a response: `applyActionCore` accepts Fog of War, including a copied Fog, after an outcome. The runner checks cards before stopping at an outcome, which can continue some such games, but its target search is sampled and the action cap still applies. A terminal screenshot alone is therefore weaker than a recorded final decision after any available response.
- `initialize` freezes `Date`; timeout actions advance the clock explicitly. Long test duration does not prove real-time timer behavior during human hesitation, reading, or switching focus.
- The action selector pursues random legal moves rather than a finishing strategy. Many long nonterminal runs are an expected coverage limit, not evidence of a UI hang.

For this task, keep a per-game record of its ordinary starting state, actions, final visible result and screenshot, and whether a legal post-result response was played or deliberately left unused. Do not call an action-cap stop a finished game. Measure the new Chrome session's actual elapsed active time independently of earlier campaigns.

## Three concrete live UI checks during complete games

1. **Mate with a possible response.** At a mating move or card, inspect the result text and available responding hand. If Fog is legally offered, play it and verify the outcome clears, pieces/cards return consistently, and play resumes. Continue to a final result, then attempt an ordinary board move and verify that the result and position remain unchanged. This exercises the transition into and out of an apparent game ending.
2. **A real timer while reading a card.** If Abduction or Panic appears in a full game, leave the real clock running while opening the reader or changing focus, then let the deadline expire. Verify that the board concealment or mandatory prompt clears once, the correct side can act, and no stale target overlay survives. Continue that same game to its end. The current runner's frozen clock cannot provide this evidence.
3. **Late-game promotion after resize.** When a pawn reaches a promotion opportunity, resize the live Chrome window before selecting its destination; check the exterior coordinates against the piece square, cancel/reopen the role choice if cancellation is offered, and choose an underpromotion. Verify exactly one pawn is replaced on the intended square and the next turn remains playable, then finish the game. This combines an endgame choice with the previously observed coordinate-scaling risk without treating a short fixture as a complete game.

These are recommendations, not checks executed by this reviewer. No app/test code was edited, no Chrome session was operated, and no engine audit was run.
