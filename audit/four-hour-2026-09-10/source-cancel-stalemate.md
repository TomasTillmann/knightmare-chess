# Cancellation of the sole legal move: source ruling

Scope: source-only review of a safe player whose completed sole legal move is canceled by Chaos, Knightmare!, or Think Again!, with no legally playable card or other continuation. No engine or test sources were inspected or executed.

## Result

The local contract implies stalemate/draw after cancellation if the replacement prohibition leaves no legal continuation and the player is not in check. This exact cancellation composition is **derived**, not an explicit publisher example found in the reviewed passages. The Checkmate Rule's fizzle condition does not apply merely because a safe player has no move.

## Authority and qualifications

- `rules.md:536` restores the pre-move state and keeps the canceled mover active with a replacement opportunity.
- `rules.md:538` forbids repeating the canceled movement during that opportunity and requires legal-move/card-target enumeration to respect that prohibition. Its fizzle clause applies when cancellation including the prohibition directly creates **board checkmate**.
- `rules.md:540-542` applies the same contract to Knightmare! and Think Again!.
- `rules.md:834` defines stalemate when the active player is safe and has no legal continuation, considering cards legally playable at that time. `rules.md:24` retains ordinary draw conditions unless a card says otherwise.
- Publisher official FAQ, printed page 6, text lines 207-210: lack of legal moves may be escaped through a card at the moving player's option. Printed page 5, lines 192-195: Under Elf Hill with no legal King return square is stalemate because the King is safe but the game cannot continue.
- Publisher official FAQ, printed pages 16-17, text lines 654-657 and 671-697: these three cards act after the entire turn including optional card play; changing only an unrelated card play or a route does not satisfy the requirement for a different move/board result.
- The Under Elf Hill exception, printed page 62, text lines 2687-2697, allows a turn without a Regular Move **after a legal King return**. It is a card-specific ruling and does not establish that a canceled sole move may simply be skipped.
- `rules.md:836` requires removing Truce and re-evaluating if it caused stalemate. The stated scenario assumes no such continuing-effect escape or mandatory unresolved choice.

Bugfix guidance: do not grant repetition of the prohibited move and do not generalize the Under Elf Hill skip-turn exception. First verify that all otherwise legal continuations, including usable cards and specific mandatory choices, are exhausted. If they are and the active King is safe, adjudicate the resulting stalemate according to the local contract. Any claim that the publisher explicitly describes this exact cancellation case would overstate the evidence.

Source files: `/Users/tomastillmann/Random/knightmare-chess/rules.md` and `/Users/tomastillmann/Random/knightmare-chess/audit/ten-hour-2026-09-08/official-faq.txt`.
