# Optional discard is not exposed by the engine

Local rules §9 explicitly allow a player who did not play a card on their own turn to discard one card after the turn and draw a replacement. The independent source-only report `source-contract-deck-exhaustion.md` confirms this separate-deck rule.

The complete public `GameAction` union at `src/game/types.ts:314` contains ten actions, including move, playCard, endTurn and pending-obligation responses. It has no discard/exchange action. The reducer's `endTurn` at line7741 advances the turn without accepting a card selection. A bounded production-only search under `src/game` found no exported discard operation, discardCard, discard-card, or exchangeCard alternative. The reducer dispatch at line7876 handles endTurn; other unrecognized action types are rejected.

This is a missing documented engine capability, not a claim that ending a turn should automatically discard a card or that an invented action name must work. Existing card effects such as Legacy/Vulture are not the ordinary optional-discard operation. No UI or UI tests were inspected or run to establish the engine API gap.
