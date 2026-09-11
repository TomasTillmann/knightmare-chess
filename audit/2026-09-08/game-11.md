# Game 11 — Vulture and an active continuing effect

Status: complete. One distinct game, two directed card actions, replayed identically once to recover compact output after the initial full-state trace was truncated. One confirmed official-rule discrepancy.

Prediction recorded before execution: White plays Pacifism on g1. Black may use Vulture to take that Pacifism into hand while its continuing effect remains active through a proxy. Black should discard the top of its deck and spend/replace Vulture.

Authority: [official Knightmare Chess FAQ, page 50](https://www.sjgames.com/knightmare/KnightmareChess_FAQ.pdf) explicitly permits Vulture to retrieve a continuing-effect card while a proxy preserves the effect in play. Local rules defer to explicit official exceptions.

No production or test code is changed.

## G11-1 — Vulture incorrectly rejects an active continuing-effect card

Severity: P2. This blocks an explicitly legal card interaction; no structural state invariant failed.

Reproduction uses the normal initial chess position:

```js
createGameState({
  hands: { white: ['pacifism'], black: ['vulture'] },
  decks: { black: ['fanatic', 'dubbing'] },
})
// applyAction sequentially:
{ type: 'playCard', cardId: 'pacifism', target: 'g1' }
{ type: 'playCard', cardId: 'vulture' }
```

Observed trace:

1. Pacifism succeeds. White's hand becomes empty. An active `pacifism` effect references `white-knight-g1` and card instance `white-hand-0-pacifism`.
2. Vulture fails with `INVALID_TARGET`: `There is no eligible played card to take.` The public `cardPlayTargets(state, 'vulture')` returns `[]`.
3. Black still holds only Vulture, its deck still contains Fanatic followed by Dubbing, and its discard remains empty. Pacifism remains active.

Expected: Vulture succeeds, puts Pacifism in Black's hand, and preserves the Pacifism effect on White's g1 knight via a proxy. Apply Vulture's normal discard/replacement cost. The official FAQ specifically addresses this continuing-effect exception, so absence from the discard pile cannot alone make this card ineligible.

Validation: parent-supplied scaffold loaded `campaign/fixtures/plots-rescue.json`, passed `checkState`, rejected `z9` to `a1`, and preserved the input digest. Both directed action results passed `checkState`; both calls preserved their input digest. This is a legality/rules discrepancy, not evidence of corrupted state. No test sources were read and no temporary harness files were created.

Executed counts: 1 scaffold rejection, 2 directed action attempts (1 accepted, 1 rejected); identical diagnostic replay added 2 attempts. Random probes: 0. Initial timed game execution: 3.442042 ms. Sentinel: `GAME_11_DONE`.
