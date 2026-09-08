# Interrupted work

The user stopped the campaign on 2026-09-08. These files preserve unfinished work
at their original source paths without adding unverified tests to the engine suite.

- `random-209.test.ts.txt`: agent reported 122 reviewed actions, 50 moves, 17 cards,
  and two targeted tests passing. Typecheck preceded its last fixture adjustment.
  Parent source review and final verification were not completed.
- `random-210.test.ts.txt`: initial replay test only. Generated trace has 120 actions
  and 50 moves; independent oracle and test gates were not completed.

Corresponding JSON and text traces remain in `../iterations/`. The drafts' imports
assume their original location under `src/game/cards/`. Neither iteration counts
as accepted coverage. No further generation or review is authorized by the stopped
campaign; resume only if the user requests it.
