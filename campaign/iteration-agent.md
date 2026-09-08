# Fresh iteration agent instructions

Own only your assigned `src/game/cards/random-NNN.test.ts` and generated
`campaign/iterations/NNN.json` / `.txt` artifacts. No production or runner edits,
commits, UI tests, or full engine suite. Parent records the initial target hash.

1. Within 30 seconds apply a real `*** Update File` to the assigned placeholder:
   add a runnable `node:test` using `readFileSync(new URL('../../../campaign/iterations/NNN.json', import.meta.url))`
   and `replayTrace` / `RandomTrace` from `./random-campaign.js`. Before this patch,
   inspect only this instruction, assigned target, narrowly relevant public APIs/rules.
2. Run `node --import tsx campaign/run.ts generate N`. Artifact writes are user
   authorized; use `require_escalated` if necessary. Preserve all generated files.
3. Read EVERY generated `.txt` action row in manageable batches. Independently
   reason in order against `rules.md`, `cards.md`, and printed catalog metadata:
   actual movement paths, captures, identity, promotion, King safety, card timing,
   targets, spending/drawing/discard, effects/rewinds, turn/clock/en-passant state.
   Reducer acceptance and state hashes are not independent semantic proof.
   Assert regular-move geometry and both royal threat states using the expected
   physical board and the applicable variant rules, rather than relying solely
   on reducer destination/check helpers. Retain exact cancellation restrictions,
   mandatory choices, card allowances, and all six FEN fields in the oracle.
   A raw FEN en-passant target may survive a non-move card even when uncapturable;
   independently distinguish that serialization from legal capture availability.
4. Preserve one explicit numbered rationale per action in the test, and assert
   rationale count equals the reviewed action count. Do not auto-label passes.
   Stop at the FIRST suspicious invalid state, document precise expected state
   and rule, and write a targeted failing expectation. Later generated actions
   remain unreviewed and must not be counted as passed. A runner stall may be
   missed legal input or a legitimate terminal position; investigate that distinction.
5. Run only `node --import tsx --test src/game/cards/random-NNN.test.ts` and
   `npm run typecheck`. Report a PASS only for 50 move commands plus every
   intervening action reviewed. A confirmed defect may yield an earlier prefix,
   which goes to a new verifier/fixer. Never approve the engine's wrong state.
   Public `effects` entries are `unknown`: compare complete expected records or
   narrow them explicitly before field access. For `GameAction` unions, narrow
   `action.type` before reading card-only fields (a `flatMap` or loop is enough).
   Movement payload fields remain `unknown` even inside `action.type === 'move'`:
   start that branch with `assert.ok(typeof action.from === 'string' && typeof action.to === 'string')`
   before `parseSquare`, indexing, or string operations. This is a recurring
   compile failure; use this exact narrowing before adding movement assertions.
   Immediately copy those narrowed properties into local constants if a callback
   uses them (`const from = action.from, to = action.to`); TypeScript does not
   retain mutable property narrowing inside callbacks.
   A narrowed string is still not the `SquareName` union: when assigning a
   validated board square to a typed piece or en-passant record, import
   `SquareName` and cast only after confirming canonical square syntax. Give
   computed intermediate square strings an explicit `string` annotation.
   Verify actual rank/file/diagonal alignment before saying a piece blocks a
   King attack; an unaligned Queen or Bishop has no such ray to block.
   Before naming a blocker, inspect that step's actual board and verify the
   occupied square lies strictly between the attacker and target. Do not add
   speculative blocker explanations to quiet moves: a concise movement reason
   plus the independent royal-safety assertion is sufficient.
   Apply §11.7 legal-capture restrictions when assessing check: a neutral piece's
   hypothetical capture must also preserve its controller's King safety (§15.1).
   If shared typecheck flags another active agent's file, report its path to the
   parent and leave that file untouched; this is not a finding in your iteration.
   Captured pieces now have optional `capturedBy`: independently assert the actual
   captor, including reaction/effect owners and Hostage's original attacker.
   Returning a piece or making it dead clears this field. Replay digests omit
   only this additive field to preserve historical traces; hashes do not test it.
   For every row assert the exact active value or absence of `chaosForbidden`,
   `plotsExecution`, `plotsAllowances`, `fogLocked`, `riposteLostMoves`,
   `riposteSkipped`, and `riposteCheckDeferred`. Nullish empty-list normalization
   is fine where those representations have identical semantics. A cancellation
   assertion includes its full movement token; a pending rescue assertion includes
   its pre-move board, FEN, en-passant, history position, and moved identities.
6. Return `ITERATION_NNN_PASS` or `ITERATION_NNN_FINDING`, action/move/card counts,
   final FEN, exact gate results, and elapsed time. Parent verifies and commits.

The user requests one fresh agent for every iteration. The 50-move review is the
bounded responsibility; the earlier 45-second audit shape does not replace it.
