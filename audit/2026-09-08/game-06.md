# Game 06: Peace Talks direct mate

Prediction before play: removing Pacifism from a white rook on h8 should be rejected or fizzle when that removal directly checkmates a black king on a8 blocked by its own a7/b7 pawns. Rules 11.1, 11.2, and 22.6 prohibit a regular card from directly delivering mate.

## Result: inconclusive, no engine bug established

Exactly one directed game was initialized with `{ "fen": "k5n1/pp6/8/8/8/8/8/4K1NR w - - 0 1", "hands": { "white": ["pacifism", "peace-talks"] } }`.

1. Prediction: white knight moves to f3; neither King is checked. Action `{ "type": "move", "from": "g1", "to": "f3" }` succeeded. Observed both Kings safe, effects empty, outcome null. Input digest unchanged; resulting state passed `checkState`.
2. Prediction: Pacifism attaches to h1 rook. Action `{ "type": "playCard", "cardId": "pacifism", "target": "h1" }` was rejected. Both Kings remained safe, effects empty, outcome null; input digest unchanged.

The group stopped at that rejection. Peace Talks was never attempted. No replay or second initialization was performed. The failed sequence is a probe setup problem, not evidence of a rules violation. Error detail was not captured because the probe used the wrong failure-property name.

The parent scaffold was executed successfully: `checkState` passed for the existing `campaign/fixtures/plots-rescue.json.state`; malformed z9-a1 was rejected without changing the input digest. Native Node initially failed resolving TypeScript imports; the installed `node --import tsx --input-type=module` runner succeeded.

Counts: 1 accepted directed action, 1 rejected directed action, 1 scaffold rejection. Directed process wall time: under 0.5 seconds. The process subsequently failed to append full states because its filesystem was read-only; this report was persisted with `apply_patch` instead. Full snapshots were therefore not retained.

GAME_06_DONE
