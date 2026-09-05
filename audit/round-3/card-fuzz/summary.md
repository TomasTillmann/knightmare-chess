# Round 3 card/state-sequence fuzz summary

## Confirmed breakages

Four current breakages were reproduced against the frozen shared checkout:

1. [`01-rotated-pawn-attacks-use-unrotated-direction.md`](./01-rotated-pawn-attacks-use-unrotated-direction.md) — rotated non-neutral Pawn moves use the new orientation, but their attacks, King safety, check, and mate still use orientation 0.
2. [`02-coup-prince-still-controls-card-mate-probes.md`](./02-coup-prince-still-controls-card-mate-probes.md) — the direct-mate probe suppresses an actual royal's legal defense when the non-royal Coup Prince is in orthodox checkmate.
3. [`03-prince-move-erases-royal-castling-state.md`](./03-prince-move-erases-royal-castling-state.md) — a one-square ordinary Prince move clears the untouched replacement royal's castling bits.
4. [`04-legal-dests-omits-same-owner-neutral-pawn-capture.md`](./04-legal-dests-omits-same-owner-neutral-pawn-capture.md) — `legalDests` omits an orientation-0 neutral-target Pawn capture that `applyAction` and No Quarter accept.

## Coverage

- Read the authoritative rules, all 19 catalog entries, the complete reducer/state/type flow, UI consumers of the public reducer, existing test coverage, and every earlier audit title and summary; candidate findings were checked against the detailed prior reports for the same subsystems.
- Ran the complete existing Node suite: `818` tests passed, `0` failed. Ran `npm run typecheck`: passed.
- Ran `526,208` direct public `applyAction` calls over all 19 implemented cards, both acting colors, orientations `0`, `90`, `180`, and `270`, every canonical source/destination pair for move and swap card shapes, exact timing variants, and representative malformed typed inputs. Results: `1,041` successful reductions, `525,167` structured rejections, and `0` uncaught exceptions. Deep-frozen input states did not trigger mutation failures.
- Exercised ordinary moves and the public destination map alongside card actions; current/original/transformed/promoted/royal/neutral identity controls; simultaneous one/many targets; duplicate and malformed targets; exact card instances; draw/discard and history; replacement and after-move timing; direct-mate versus self-check behavior; pending-rescue rollback; castling identity; FEN clocks; single/multiple/stale en-passant state; and multi-turn/cross-card interaction coverage from the existing interaction suite plus focused reducer sequences.
- Re-ran all four findings in one assertion-based public-reducer script. All findings and their positive/negative controls passed without modifying production, tests, rules, configuration, packages, or pre-existing audit files.
