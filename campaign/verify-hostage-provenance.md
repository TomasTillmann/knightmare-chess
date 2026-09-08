# Hostage capture provenance verification

Confirmed from `cards.md` Hostage and `rules.md` §22.11: the Pawn is captured instead of the originally captured piece. The original opponent remains the captor; the reactor only plays the substitution card.

Production trace: `applyAction` dispatches through `playCardUnchecked` to `playHostage`; `cardPlayTargets` also calls `playHostage`. Hostage already validates the original event's opponent `captor`, but supplied `reactor` to the shared `losePiece` helper. The call now supplies `captor`. The card history still correctly records the reactor as card player. `capturedBy`, used by Winged Victory, now interprets a metadata-absent Hostage history event's player as the opposite of the captor, including the `copiedCardId` representation.

Public API probes used `createGameState`, `applyAction`, and `cardPlayTargets`. Two completed pre-fix sequences (one per color) reproduced incorrect substitute provenance and Winged Victory rejection in 9.6 ms. An initial fixture was discarded because placing the returned Bishop checked the active King and prevented endTurn; both validated fixtures use Kings on g1/g8.

Six post-fix sequences passed in 20.0 ms: both colors, each with current provenance, absent provenance, and absent provenance plus the saved copied-Hostage event representation. Each sequence checked original capture attribution, advertised Hostage target, substitute capture attribution, original piece placement/provenance cleanup, unchanged card-player attribution, endTurn, advertised Winged Victory target, successful Winged Victory restoration, and provenance cleanup. Zero findings remained. The copied-history cases model the public saved-state representation; they do not claim to execute Haunting Memories.

Black-box `node --import tsx --test src/game/cards/random-024.test.ts`: 1 passed, 0 failed, 790.305292 ms. `npm run typecheck`: passed. No test sources, test commits, campaign iteration/fixture sources, full engine suite, or UI tests were inspected or run. No temporary harness files were created. Production changes are limited to two lines in `src/game/reducer.ts`; existing capture-provenance work was preserved.

HOSTAGE_PROVENANCE_VERIFIED — 2 completed red sequences; 6 green sequences; 0 remaining findings; measured probe wall time 29.6 ms total.
