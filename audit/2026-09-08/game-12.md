# Game 12 audit

Seed: `9081201`. One game only; up to 160 regular moves and 35 seconds.

Before execution, I expect ordinary moves to preserve legal geometry and king safety, state identities and royal zones to remain valid, and rejected actions not to mutate inputs. I will independently flag positions where the player who just moved remains in check, then compare special-card exceptions against the rules. Card events will be reviewed against the written rules.

## Result: inconclusive budget timeout

The supplied engine-only scaffold executed successfully (`SCAFFOLD_OK`): its fixture passed `checkState`, an invalid `z9` to `a1` move was rejected, and the input digest was unchanged.

The one permitted game was started with `generateTrace(9081201, 160, observer)`. The observer threw `Error: budget` after its 35,000 ms threshold was exceeded. The terminal returned exit code 1, with the throw originating from the observer called by `generateTrace`. The command did not reach its summary or `GAME_12_DONE` sentinel.

Confirmed engine bugs: **0**. This is not a clean audit: completed move/action counts, initial/final FEN, card events, and accumulated king-safety observations were not returned because the command prints them only after `generateTrace` completes. Elapsed game time is known only to exceed 35 seconds; an exact measurement was not emitted. Six actual card events therefore could not be reviewed. `cards.md` was read, but no expected-versus-actual card behavior is claimed without event evidence.

No second game was started. No production code, tests, or harness files were edited. Reproduction identifier: seed `9081201`, maximum 160 regular moves; the original observer budget was 35 seconds.

GAME_12_INCONCLUSIVE — scaffold passed; one game attempted; confirmed findings 0; completion counts unavailable; elapsed >35 seconds.
