# Round 3 UI/public-contract audit summary

## Confirmed breakages

1. [`01-rotated-promotion-is-inaccessible.md`](./01-rotated-promotion-is-inaccessible.md) — horizontal promotion is listed as legal but neither UI move path supplies the required promotion role.
2. [`02-no-quarter-neutral-capture-ui-gate.md`](./02-no-quarter-neutral-capture-ui-gate.md) — stored-owner UI checks keep No Quarter unavailable after a reducer-legal neutral en-passant capture.
3. [`03-opponent-owned-neutral-piece-cannot-move-on-board.md`](./03-opponent-owned-neutral-piece-cannot-move-on-board.md) — the keyboard and reducer can move an opponent-owned neutral piece, while the board cannot select it.
4. [`04-coup-check-highlights-the-prince.md`](./04-coup-check-highlights-the-prince.md) — Coup check is shown on the old role-King/Prince rather than the marked replacement royal.
5. [`05-position-for-returns-an-internally-inconsistent-chess-object.md`](./05-position-for-returns-an-internally-inconsistent-chess-object.md) — the exported `positionFor` object has incompatible `isCheck`, context, mate, legality, mutation, and clone semantics.
6. [`06-pending-rescue-ui-offers-an-illegal-end-turn.md`](./06-pending-rescue-ui-offers-an-illegal-end-turn.md) — the UI calls a conditionally staged self-check move complete and offers an End-turn action the reducer must reject.

## Scenarios exercised

- Read `rules.md`, `cards.md`, all React/UI production, reducer/state/types/catalog production, the complete prior audit set, and the relevant unit, interaction, audit-regression, and Playwright tests.
- Ran the complete Node suite: `818` tests passed, `0` failed.
- Ran the complete Playwright suite: `65` tests passed, `0` failed.
- Ran `npm run typecheck`: passed.
- Exercised local self-play board targeting, drag movement, keyboard movement/card targeting, hand enablement, card preview, status/alert text, turn phase, check squares, reset, and outcome/End-turn controls.
- Exercised all 19 implemented cards' catalog names, descriptions, point metadata, artwork paths, printed timing, displayed timing, target selection shape, hand/discard/draw lifecycle, and both-color availability. All 19 descriptions exactly match `cards.md`; all 19 mapped artwork files exist and OCR/Playwright inspection confirmed their effect/timing mapping. No catalog text/art/timing mismatch was found.
- Exercised ordinary and neutral checks, pinned neutral attacks, defender-owned neutral moves, neutral card targets, Coup Prince/replacement-royal identity, and check highlighting.
- Exercised Regular Pawn moves for White and Black at rotated orientation, rotated captures, first/second-line double steps, all four promotion roles including underpromotion, and rotated en passant. Reducer behavior passed; the horizontal-promotion UI boundary is finding 01.
- Exercised safe and checked replacement cards, direct-mate fizzles and rollback, already-delivered mate controls, pending-rescue success, non-rescue rollback, capture restoration, history truncation, card spend/draw/discard, card allowance, and continued legal play. Reducer lifecycle passed; pending-rescue presentation is finding 06.
- Exercised `boardFen`, `legalDests`, every exported card-destination helper, `isKingInCheck`, and the mutable methods returned by `positionFor`. The first helpers agreed with accepted reducer actions in the controls; `positionFor` is finding 05.

No source, test, rules, configuration, package, or pre-existing audit file was changed.
