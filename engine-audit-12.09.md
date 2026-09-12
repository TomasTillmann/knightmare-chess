# Engine bug audit — 12.09.2026

Status: in progress, with 18 confirmed findings. Engine only; production and test sources are unchanged. No UI tests are run.

Audit window: 12 September 2026, 00:55–10:55 Europe/Prague (11 September 22:55–12 September 08:55 UTC). Requested duration: ten hours.

Baseline commit: `9ecdd9857582c261d64f6b37ad35fd941c0ee343`; working tree initially clean.

## Authority and method

Read the complete `rules.md` (965 lines), all 80 effects in `cards.md`, and the locally preserved publisher rulebook before starting probes. Use the local publisher FAQ and card artwork to resolve specific questions. Distinguish explicit rules from documented local rulings. Missing optional variants and ambiguous interpretations are not automatically bugs.

Use only engine APIs and temporary directed, seeded randomized, and multi-card scripts. Fresh audit agents receive a parent-validated bounded scaffold, add one independent adversarial group, and report measured results. Reproduce findings independently before inclusion. Never fix findings or change production/test sources; delete temporary harnesses when their audit phase ends. This Markdown file is the sole deliverable.

## Verified findings

### 1. Vendetta rejects a legal Irresistible Force capture

**Severity:** P2. **Status:** reproduced by parent and a fresh audit agent. **Area:** replacement-move capture validation.

**Rules:** `rules.md` §§6, 18.1, 22.2 and the two card effects. Vendetta requires a capture when one is available; Irresistible Force captures a piece pushed off the last rank. A card is not required to manufacture a capture, but an otherwise legal capture made by a replacement card satisfies the obligation. Publisher FAQ pp. 62–63 explains that the availability of an ordinary capture keeps Vendetta active.

**Reproduction through public actions:**

```ts
import { createGameState } from './src/game/state.ts';
import { applyAction } from './src/game/reducer.ts';
let s = createGameState({
  fen: 'k5nb/6P1/8/8/8/8/8/7K b - - 0 1',
  hands: { black: ['vendetta'], white: ['irresistible-force'] },
});
for (const action of [
  { type: 'move', from: 'a8', to: 'a7' },
  { type: 'playCard', cardId: 'vendetta' },
  { type: 'endTurn' },
] as const) {
  const r = applyAction(s, action);
  if (!r.ok) throw new Error(r.error.message);
  s = r.state;
}
const result = applyAction(s, {
  type: 'playCard', cardId: 'irresistible-force',
  target: [{ from: 'g7', to: 'g8' }],
});
console.log(result.ok, !result.ok && result.error);
```

**Expected:** the Pawn moves to g8, the black Knight on g8 is pushed off-board into the captured zone, and White's replacement move completes. White also has the legal ordinary capture g7×h8, so Vendetta remains applicable.

**Actual:** rejection with `ILLEGAL_MOVE`, message `Vendetta requires an available capture of an opponent piece.` Removing Vendetta from an otherwise identical control accepts the action and captures `black-knight-g8`.

**Implementation evidence:** `src/game/reducer.ts:6556` validates Vendetta using a short list of card IDs. It recognizes captures from Split Knight, Evil Eye, Dark Mirror, Breakthrough, and Bombard, but omits the `capturedId` emitted by Irresistible Force (`src/game/reducer.ts:5852`). No fix applied.

### 2. Confabulation's arriving component bypasses Man-Trap

**Severity:** P2. **Status:** reproduced by parent and a fresh audit agent. **Area:** arrival effects on composite formation.

**Rules:** `rules.md` §§15.4 and 19.1. Confabulation moves a piece onto a friendly piece's square; the resulting composite is captured as one board piece. Man-Trap captures the next unprotected opposing piece ending a move on its square. Tournament is explicitly a non-move swap, so it can put a friendly merge target on an armed trap without triggering it.

**Reproduction:** create `7k/8/8/8/8/8/n7/R1N4K b - - 0 1`, with Black holding `man-trap` and White holding `tournament`, `confabulation`. Execute these public actions in order, checking `ok` at every step:

```ts
{ type: 'move', from: 'h8', to: 'g8' }
{ type: 'playCard', cardId: 'man-trap', target: 'a2' }
{ type: 'endTurn' }
{ type: 'playCard', cardId: 'tournament', target: { own: 'c1', opponent: 'a2' } }
{ type: 'endTurn' }
{ type: 'move', from: 'g8', to: 'h8' }
{ type: 'endTurn' }
{ type: 'playCard', cardId: 'confabulation', target: [{ from: 'a1', to: 'a2' }] }
```

**Expected:** the arriving Rook springs Black's trap; both physical components become captured, a2 becomes empty, and the trap and terminated Confabulation cards are discarded.

**Actual:** all actions succeed, but `white-knight-c1` remains on a2, `white-rook-a1` is in the composite's away zone, and both Man-Trap and Confabulation remain active. Resulting FEN: `7k/8/8/8/8/8/N7/2n4K b - - 4 3`.

**Implementation evidence:** `src/game/reducer.ts:343` detects trap arrivals only when the same physical record is on the board before and after with different squares. Confabulation (`src/game/reducer.ts:2400`) puts the moving component away and retains the stationary component as carrier, so neither record matches that arrival filter. No fix applied.

### 3. Heresy misclassifies Bishop mobility under Fatal Attraction

**Severity:** P2. **Status:** reproduced by parent and a fresh audit agent. **Area:** mandatory-target eligibility.

**Rules:** Heresy in `cards.md` requires each Bishop **that can do so** to move. `rules.md` §§12, 18.6, and 20 make the continuing immobilization from Fatal Attraction override a regular movement card. The immobilized Bishop must therefore be skipped while eligible Bishops still move.

**Reproduction:** create `7k/8/8/3b4/3r4/8/1B6/7K b - - 0 1`, Black hand `['fatal-attraction']`, White hand `['heresy']`. Execute Black Kh8–g8, Fatal Attraction on d4, endTurn, then White Kh1–g1. Play:

```ts
{ type: 'playCard', cardId: 'heresy', target: [{ from: 'b2', to: 'b3' }] }
```

**Expected:** White's Bishop moves b2–b3 and Black's frozen Bishop remains on d5.

**Actual:** `INVALID_TARGET`: `Every eligible Bishop must move exactly once.` The frozen Bishop is incorrectly mandatory, preventing an otherwise legal Heresy play.

**Related sequential case, also independently verified:** create `7k/8/8/2bB4/8/8/8/7K b - - 0 1`, Black hand `['fatal-attraction']`, White hand `['heresy']`. Black Kh8–h7, Fatal Attraction on c5, endTurn; White Kh1–h2. Heresy `[{ from: 'c5', to: 'b5' }, { from: 'd5', to: 'd4' }]` must first move Black's magnet, ending Fatal Attraction, and then move the now-free White Bishop. Instead it rejects with `ILLEGAL_MOVE: Dungeon prevents moving that piece this turn.` The common movement guard checks White's Bishop against the original frozen position (`src/game/reducer.ts:6504`), ignoring Heresy's ordered phases. The same moves succeed without Fatal Attraction.

**Implementation evidence:** `src/game/reducer.ts:1343` computes Heresy destinations from board edges and occupancy only. `src/game/reducer.ts:4024` uses those geometric destinations to decide which Bishops must move, without excluding the magnet-frozen Bishop. No fix applied.

### 4. Madman requires continuing onto a Forbidden City square

**Severity:** P2. **Status:** reproduced by parent and a fresh audit agent. **Area:** multi-jump termination.

**Rules:** Madman's artwork (`final_cards/KC3_card2.png`) permits jumps over pieces in either direction. `rules.md` §§12 and 14.3 prohibit entering Forbidden City. Whether an otherwise available jump must be taken does not change this case: the only further jump is illegal.

**Reproduction:** create `7k/8/8/3p4/8/1p6/P7/7K b - - 0 1`, Black hand `['forbidden-city']`, White hand `['madman']`. Black plays Kh8–g8, Forbidden City on e6, then endTurn. White plays:

```ts
{ type: 'playCard', cardId: 'madman', target: [{ from: 'a2', to: 'c4' }] }
```

**Expected:** White's Pawn jumps over b3 and stops on c4. Its only further unused jump would land on forbidden e6, so it cannot continue.

**Actual:** `ILLEGAL_MOVE`: `The Pawn must continue while another jump is available.` Declaring the extra c4–e6 jump is also illegal because it enters Forbidden City. A legal shortened route is therefore unavailable.

**Implementation evidence:** `src/game/reducer.ts:1152` computes jump options without board effects. `src/game/reducer.ts:2608` requires continuing whenever that geometric helper returns an option, including an illegal forbidden landing. No fix applied.

### 5. Rebirth uses Pawn starting squares for a permanently promoted piece

**Severity:** P2. **Status:** reproduced by parent and a fresh audit agent. **Area:** promotion identity in placement eligibility.

**Rules:** promotion permanently changes the piece's type (`rules.md` §§13.2 and 15.5). The publisher's Rebirth ruling says any starting square of the relevant kind is eligible (local FAQ text lines 2344–2350). Applying that rule to a promoted Knight means the Knight's starting squares. This application follows the general promotion/type rules; the FAQ does not give this exact promoted-Knight example.

**Reproduction:** create `7k/8/8/8/8/8/1p6/7K b - - 0 1`, with White holding `rebirth`. Black plays b2–b1 with `promotion: 'knight'`, endTurn, then White plays Kh1–g1. From that state, independently try:

```ts
{ type: 'playCard', cardId: 'rebirth', target: [{ from: 'b1', to: 'g8' }] }
{ type: 'playCard', cardId: 'rebirth', target: [{ from: 'b1', to: 'b7' }] }
```

**Expected:** g8 is an eligible black Knight starting square; b7 is not.

**Actual:** b1–g8 is rejected with `ILLEGAL_MOVE`, `Choose a legal unoccupied or friendly starting square.` The independent b1–b7 attempt succeeds, leaving the promoted Knight on a Pawn starting square.

**Implementation evidence:** `src/game/reducer.ts:1038` derives Rebirth destinations from every component's `originalRole` without considering permanent promotion. No fix applied.

### 6. Plots eagerly expands an ineligible Earthquake into over a million targets

**Severity:** P2. **Status:** reproduced by parent and a fresh audit agent. **Area:** engine time and memory consumption.

**Reproduction:** create `4k3/8/P6p/P6p/P6p/P6p/P6p/3K4 w - - 0 1`, with White holding `['plots-within-plots', 'earthquake']`, in the default before-move phase. Call `applyAction(state, { type: 'playCard', cardId: 'plots-within-plots' })`. Repeat in a fresh process with only Plots in hand as a control. Measure the action with `performance.now()` and `process.memoryUsage().heapUsed`.

**Expected:** Earthquake is an after-move card and cannot be eligible here. Determining that should not expand its possible promotion choices.

**Actual:** the result correctly has an empty eligible-card list, but the engine first materializes every Earthquake promotion combination. The ten edge Pawns yield `4^10` combinations for one rotation. The parent measured 836 ms and 431 MiB heap with a 512 MiB V8 heap cap, versus 2 ms and 11 MiB without Earthquake. The independent agent measured 558 ms and 537 MiB without an explicit heap cap, versus 0 ms and 16 MiB for its control. Measurements are individual runs on this host, not portable timing guarantees.

**Bounded scaling probe:** two, four, six, and eight edge Pawns took 3, 3, 6, and 31–32 ms, respectively; eight used approximately 61 MiB. Ten Pawns exhausted an explicitly imposed 128 MiB V8 heap limit, and twelve exhausted a 256 MiB limit. These capped aborts demonstrate memory pressure; they are not claims of an uncapped default-process crash.

**Implementation evidence:** `src/game/reducer.ts:6450` calls `cardPlayTargetsUnchecked` before checking whether each target can be played. Earthquake's generator (`src/game/reducer.ts:4269`, dispatched at `:6941`) eagerly builds the Cartesian product of promotion choices, even though timing alone excludes the card. No fix applied.

### 7. A sparse Heresy target throws instead of returning an engine rejection

**Severity:** P3. **Status:** reproduced by parent and a fresh audit agent. **Area:** public API input validation; JavaScript callers.

**Reproduction:**

```ts
const s = createGameState({
  fen: '7k/8/8/8/8/8/1B6/7K w - - 0 1',
  phase: 'afterMove', moveMade: true,
  hands: { white: ['heresy'] },
});
const target = Array(2);
target[1] = { from: 'b2', to: 'b3' };
applyAction(s, { type: 'playCard', cardId: 'heresy', target });
```

**Expected:** an `ok: false` / `INVALID_TARGET` result, as with the equivalent explicit-null malformed target.

**Actual:** uncaught `TypeError: Cannot read properties of undefined (reading 'from')` at `src/game/reducer.ts:4041`. Input validation uses array methods that skip holes, while the later iteration visits the missing element. The valid dense one-move target succeeds. Sparse targets for Annexation, Forced March, Guardian, Madman, and Onslaught were rejected normally.

**Scope:** this requires an in-process JavaScript sparse array. JSON serializes its hole as `null`, and that form is correctly rejected; no network-input exploit is claimed. No fix applied.

### 8. Checkmate adjudication blocks a single engine action for 15–34 seconds

**Severity:** P2. **Status:** reproduced by parent and a fresh audit agent. **Area:** synchronous escape search.

**Discovery:** the unchanged seeded campaign helper, seed `12092162` with a 100-move bound, reached a legal position where the final `endTurn` alone took 33,532 ms. The entire campaign took approximately 35.9 seconds for 45 ordinary moves. The final result was correctly Black checkmate; the defect is excessive synchronous work.

**Reduced public-action reproduction:**

```ts
let s = createGameState({
  fen: 'r3r1k1/P1n5/1p6/1n1PQP2/pP1p4/2P3PR/BB1N4/R5NK w - - 0 1',
  hands: { white: ['coup', 'doomsayer', 'merciless', 'abduction', 'man-trap'] },
  decks: { white: ['masquerade', 'doppelganger'] },
});
const actions = [
  { type: 'move', from: 'e5', to: 'd6' },
  { type: 'playCard', cardId: 'coup', target: 'f5' },
  { type: 'endTurn' },
  { type: 'move', from: 'g8', to: 'g7' },
  { type: 'endTurn' },
  { type: 'move', from: 'd6', to: 'd7' },
  { type: 'playCard', cardId: 'doomsayer' },
  { type: 'declineDoomsayer', player: 'black' },
  { type: 'endTurn' },
  { type: 'move', from: 'g7', to: 'f6' },
];
for (const action of actions) {
  const r = applyAction(s, action);
  if (!r.ok) throw new Error(r.error.message);
  s = r.state;
}
const started = performance.now();
const result = applyAction(s, { type: 'endTurn' });
console.log(performance.now() - started, result);
```

**Expected:** bounded, practical adjudication of this 22-piece position. There is no escape: White's royal Pawn on f5 cannot move past or capture the black King on f6, and none of the available cards changes that fact.

**Actual:** the reduced final action took 14,695 ms for the parent and 14,838 ms for the independent agent. Omitting the Doomsayer play and decline from the reduced sequence took 915–930 ms. An ablation of the original saved state with White's hand empty took 418 ms; removing only the active Doomsayer took 3,409 ms. These are individual host measurements. No UI was involved or tested.

**Implementation evidence:** `src/game/reducer.ts:8042` calls the full escape search from `adjudicateTurn`; `hasDoomsayerEscape` at `:7994` repeatedly invokes `hasBoardOrCardEscape` for possible losses. That search tests board moves and card continuations, including `hasAfterMoveRescue` (`:7286`). The repeated searches magnify the cost of an obviously trapped royal Pawn. This is separate from finding 6: neither Earthquake nor Plots is in White's hand in the reduced reproduction. No fix applied.

### 9. Peace Talks can remove the only surviving King and leave the game running

**Severity:** P1. **Status:** reproduced by parent and a fresh audit agent. **Area:** royal identity and indirect Coup suspension.

**Rules:** `rules.md` §§11.1, 14.1, 15.3: regular cards cannot eliminate a King; undoing Earthquake applies promotion rules; promoting Coup's royal Pawn to Rook or Queen suspends Coup. The publisher FAQ p. 5 expressly prohibits canceling Coup with Peace Talks after the Prince has been lost, because that leaves no King. The same final-state prohibition applies when Peace Talks suspends Coup indirectly through promotion.

**Reproduction:** create `k6P/8/8/8/7B/8/6P1/6rK w - - 0 1`, White hand `['coup', 'earthquake']`, Black hand `['peace-talks']`. The unpromoted Pawn on h8 represents a variant position; movement cards can reach a last rank without promotion (§21). All subsequent steps use public actions:

1. White g2–g3; Coup on h8; endTurn. Coup supplies the saving continuation for the initial check.
2. Black Rg1×h1 captures the now-nonroyal Prince; endTurn.
3. White g3–g4; Earthquake `{ direction: 'clockwise', promotions: [] }`; endTurn.
4. Black Ka8–b7.
5. Black Peace Talks `{ effectId: 'white-hand-1-earthquake', promotions: [{ square: 'h8', role: 'rook' }] }`.

**Expected:** reject or fizzle the regular Peace Talks play while retaining White's royal identity. Knight promotion is a valid control and retains the royal.

**Actual:** Peace Talks succeeds, h8 becomes a nonroyal Rook, the captured Prince stays captured, and no White physical piece is royal. `outcome` remains `null`. Final FEN: `7R/1k6/8/8/6PB/8/8/7r w - - 1 3`. Queen promotion has the same defect.

**Implementation evidence:** `restoreCoupPieces` (`src/game/reducer.ts:4411`) suspends Coup and removes the promoted Pawn's royalty, but cannot restore a captured Prince. Peace Talks' cancellation eligibility guards direct Coup cancellation; canceling Earthquake takes the promotion path without enforcing that the opponent retains a King. The ordinary checkmate predicate does not detect a missing royal. Seed `12093210` independently reached this through normal play from the standard initial position; seeds `12093924` and `12094541` also reached kingless positions through Earthquake promotion. No fix applied.

### 10. Riposte plus expiring Mystic Shield leaves a checked player permanently stuck

**Severity:** P1. **Status:** reproduced by parent and a fresh audit agent. **Area:** adjudication after forfeiting a move.

**Rules:** `rules.md` §§18.4, 16.3, 11.5. Riposte consumes the responding player's next Regular Move. Mystic Shield expires when that protected opposing turn ends. A checked player who has neither a legal move nor an available card escape has lost.

**Reproduction:** create `6k1/8/8/8/8/2p5/8/KN5R b - - 0 1`, Black hand `['mystic-shield', 'riposte']`, empty White hand/decks. Execute:

```ts
{ type: 'move', from: 'g8', to: 'h8' }
{ type: 'playCard', cardId: 'mystic-shield', target: 'h8' }
{ type: 'endTurn' }
{ type: 'move', from: 'b1', to: 'c3' }
{ type: 'playCard', cardId: 'riposte' }
{ type: 'endTurn' }
```

Mystic Shield is the saving card for Black's initial move into the Rook's line. Riposte reverses White's Knight capture of the c3 Pawn, then costs Black its next move.

**Expected:** after White ends the turn, the Shield expires and Black cannot escape the h-file check because its move is forfeited and it has no cards. Declare White's checkmate victory.

**Actual:** Black is in `afterMove`, `moveMade: true`, `riposteSkipped: 'black'`, and in check; both hands are empty, `legalDests` is empty, but `outcome` is `null`. Every move is rejected as already made, and `endTurn` returns `KING_IN_CHECK`. The game cannot continue or finish. Final FEN: `7k/8/8/8/8/2p5/8/K6R w - - 1 3`.

**Control:** omit Riposte and end White's capture turn normally; Black correctly receives a move and can escape Kh8–g8.

**Implementation evidence:** `consumeRiposteMove` (`src/game/reducer.ts:8058`) consumes the move before `adjudicateTurn`. The latter still requires `isOrdinaryCheckmate`, whose `hasLegalMove` constructs a fresh move-available `turnView`; the hypothetical King escape prevents mate even though the actual turn forbids it. Similar deadlocks arose in seeds `12092929`, `12099244`, and `12100774`. No fix applied.

### 11. A restored royal inside a composite can be captured

**Severity:** P1. **Status:** reproduced by parent and a fresh audit agent. **Area:** royal component protection after Coup suspension.

**Rules:** Kings are never captured (§2); a composite is affected as either component (§15.4). Coup suspension restores the preceding royal identity (§15.3). This sequence uses the engine's accepted Prince merge described under rule-sensitive observations below; regardless of that earlier interpretation, the later action captures an explicitly royal King.

**Reproduction:** create `k5r1/8/8/8/8/8/PP6/6NK w - - 0 1`, White hand `['coup', 'confabulation']`, Black hand `['earthquake']`.

1. White b2–b3; Coup on a2; endTurn.
2. Black Ka8–b8; endTurn.
3. White Confabulation `[{ from: 'h1', to: 'g1' }]`; endTurn.
4. Black Kb8–c8; Earthquake `{ direction: 'clockwise', promotions: [{ square: 'a2', role: 'rook' }] }`; endTurn.
5. White Ra2–b2; endTurn.
6. Black Rg8×g1.

**Expected:** the final capture is illegal because the Knight carrier contains White's restored royal King. The engine must preserve royal protection for the whole composite.

**Actual:** every action succeeds. The final event contains `capturedIds: ['white-knight-g1', 'white-king-h1']`. The King remains `royal: true` but is moved from the composite's `away` zone into `captured`; the game still has `outcome: null`. Final FEN: `2k5/8/8/8/8/1P6/1R6/6r1 w - - 0 4`.

**Other affected APIs:** before the final capture, `isKingInCheck(state, 'white')` incorrectly returns `false` despite Black's Rook attacking the royal composite on g1. For a second independently verified capture path, give Black `['earthquake', 'doomsayer']` initially and replace step 6 with Kc8–d8, Doomsayer, then `{ type: 'namePiece', speaker: 'white', name: 'knight', losses: [{ effectId: 'black-hand-1-doomsayer', pieceId: 'white-knight-g1' }] }`. The name action also succeeds and captures the royal King. `doomsayerTargets` checks only the carrier's royalty (`src/game/reducer.ts:589`); check detection searches only royal records physically on the board (`:2195`).

**Implementation evidence:** Coup restoration marks the physical Prince royal while it remains inside the composite, but leaves the board carrier nonroyal. The ordinary capture guard (`src/game/reducer.ts:7726`) checks the carrier's `royal` flag rather than every physical component; `losePiece` then captures both components. The same loss appeared in seeds `12098886` (ordinary capture) and `12094411` (Charge capture). No fix applied.

### 12. A second Coup incorrectly restores Neutrality on a Prince

**Severity:** P2. **Status:** reproduced by parent and a fresh audit agent. **Area:** suspended effect eligibility.

**Rules:** `rules.md` §§15.1, 15.3, 10. Neutrality excludes Kings by current or applicable original type, as well as royal pieces. A Coup replacement suspends Neutrality while royal; the marker may resume only when the piece is otherwise eligible. After a second Coup, the preceding replacement is a capturable Prince with current type King, so it is still ineligible.

**Reproduction:** create `7k/8/8/8/8/8/PPP5/7K b - - 0 1`, Black hand `['neutrality']`, White hand `['coup', 'coup']`.

1. Black Kh8–g8; Neutrality on a2; endTurn.
2. White b2–b3; Coup on a2; endTurn.
3. Black Kg8–h8; endTurn.
4. White b3–b4; Coup on c2; endTurn.
5. Black attempts a2–a3.

**Expected:** a2 remains White's nonneutral Prince; Black cannot move it.

**Actual:** a2 has `owner: 'white'`, `role: 'king'`, `originalRole: 'pawn'`, `royal: false`, but `neutral: true`. Black's a2–a3 move succeeds. After the first Coup, the control correctly has `royal: true` and `neutral: false`; the second Coup causes the erroneous reactivation.

**Implementation evidence:** initial `playNeutrality` validation (`src/game/reducer.ts:5155`) excludes the King type, but `refreshNeutrality` (`:267–286`) checks only Queen type and royalty when restoring the effect. A Prince produced from a Pawn falls through those checks. No fix applied.

### 13. Spending the last card allowance can leave stalemate unresolved

**Severity:** P1. **Status:** reproduced by parent and a fresh audit agent. **Area:** adjudication after before-move cards.

**Rules:** ordinary stalemate applies (`rules.md` §2). The regular card allowance is one card per turn (§9). Once an unchecked player has neither a legal move nor an available card escape, the game must end in stalemate.

**Reproduction:** create `k7/8/p7/P1Q5/2K5/8/8/8 w - - 0 1`, Black hand `['pacifism', 'passing-in-the-night']`, empty White hand/decks. White plays Qc5–b6 and endTurn. Black then plays Pacifism on a6.

**Expected:** Black's allowance is consumed. With no legal move or remaining card escape, record `{ reason: 'stalemate' }`.

**Actual:** `outcome` stays `null`. Black is not in check, `legalDests` is empty, `endTurn` rejects with `INVALID_TIMING` / `Make the regular move before ending the turn.`, and Passing in the Night rejects because the card allowance is used. The game is stuck. Final FEN: `k7/8/pQ6/P7/2K5/8/8/8 b - - 1 1`.

**Control:** before Pacifism, Passing in the Night `[{ from: 'a6', to: 'a5' }]` succeeds and permits ending the turn. Its availability correctly prevents premature stalemate at the start of Black's turn.

**Implementation evidence:** the exhausted-resource check at the end of `applyAction` (`src/game/reducer.ts:8267`) requires the acting King to be in check, so it adjudicates only checkmate. The separate stalemate check there applies only to a Chaos replacement window. Ordinary before-move cards can exhaust the final escape without either path handling stalemate. Found initially by seed `12098257`; Vulture and the other effects in that trace are unnecessary. No fix applied.

### 14. Capture rollback restores fulfilled Challenge and Panic obligations

**Severity:** P2. **Status:** reproduced by parent and a fresh audit agent. **Area:** reaction effect restoration.

**Rules:** Challenge applies to the opponent's next move and is fulfilled when the challenged piece moves (`rules.md` §18.2). Riposte reverses the capture, restores the defender's capture-expired effects, and captures the attacker; it preserves the completed move (§18.4). It must not reinstate an unrelated fulfilled movement obligation or resolve while its player's King remains in check.

**Reproduction:** create `1R6/8/1k6/5p2/3N4/8/8/7K b - - 0 1`, Black hand `['challenge', 'riposte']`.

1. Black Kb6–b7; Challenge on d4; endTurn. Challenge provides the saving effect for Black's move into the Rook's line.
2. White Nd4×f5. Challenge is fulfilled and removed; Black is now checked by Rb8.
3. Black plays Riposte.

**Expected:** Riposte fizzles with self-check. Capturing the White Knight instead does not remove the Rook's check, and the fulfilled Challenge cannot suppress the Rook anymore.

**Actual:** Riposte succeeds, restores the Challenge targeting the now-captured Knight, and makes `isKingInCheck(state, 'black')` return `false`. White's endTurn removes that restored Challenge and exposes the check again. This can then reach the forfeited-move deadlock in finding 10, but the erroneous reaction acceptance and effect restoration are a separate defect.

**Control:** with Black's King on a6 moving to a7 and no Challenge, the same Knight capture and Riposte resolve normally and Black is safe.

**Second consequence, independently reproduced:** start `7k/8/8/8/8/2p5/8/KN6 b - - 0 1`, Black hand `['panic', 'riposte']`. Black Kh8–g8, Panic, endTurn; White Nb1×c3 completes the timed move and removes Panic. Black Riposte succeeds; end White's turn and Black's forfeited turn. On White's following turn the old Panic is active again, and `{ type: 'panicTimeout' }` incorrectly succeeds and forfeits that turn. Panic applies only to the next move (§18.5), which was already completed. The parent and a fresh agent verified this consequence; it is grouped here because the rollback defect is shared.

**Bog has the same Panic consequence:** start `7k/8/8/p7/8/8/8/R6K b - - 0 1`, Black hand `['panic', 'bog']`. Black Kh8–g8, Panic, endTurn; White Ra1×a5; Black Bog, shortening the move to a2 and restoring the captured Pawn. End White's turn; Black Kg8–h8, endTurn. The old Panic is active on White's following turn and `panicTimeout` again wrongly succeeds. Parent and fresh-agent probes confirmed this case. Bog's capture rollback also restores the entire pre-capture effect list (`src/game/reducer.ts:1740`), while the completed-move cleanup does not clear the reintroduced timer.

**Implementation evidence:** `playRiposte` (`src/game/reducer.ts:1548`) replaces the entire current effect list with `checkpoint.before.effects`, restoring fulfilled Challenge along with genuinely capture-expired effects. Its later self-check validation consequently observes the wrong threats. No fix applied.

### 15. A fizzled Plots extra declares checkmate despite a remaining escape

**Severity:** P1. **Status:** reproduced by parent and a fresh audit agent. **Area:** premature game outcome during additional card plays.

**Rules:** `rules.md` §17.3 grants up to two additional plays through Plots Within Plots. A valid card that fizzles consumes one additional play; it does not cancel the unused allowance. Checkmate is not final while an available card can escape it.

**Reproduction:** create `7k/p7/5KQ1/8/8/8/8/8 w - - 0 1`, Black hand `['plots-within-plots', 'fanatic', 'under-elf-hill']`, empty White hand/decks.

1. White Qg6–g7; endTurn. Black has ordinary board mate but can escape with Under Elf Hill, so the engine correctly keeps `outcome: null`.
2. Black plays Plots Within Plots. Both Fanatic and Under Elf Hill appear in its eligible physical cards.
3. Black plays Fanatic with target string `'a7'`. The attempted Pawn move does not resolve check, so Fanatic correctly fizzles with `SELF_CHECK`.
4. Black attempts Under Elf Hill.

**Expected:** after Fanatic fizzles, one additional play remains and Under Elf Hill can remove the King to escape. Keep the game open.

**Actual:** the Fanatic result declares `{ winner: 'white', reason: 'checkmate' }`, despite `plotsAllowances[0].remaining === 1` and Under Elf Hill still in `eligibleCards`. The escape then rejects with `GAME_OVER`.

**Control:** immediately playing Under Elf Hill after Plots succeeds and allows Black to end the turn.

**Implementation evidence:** `fizzleCard` calls `settleBlockedBeforeMove` (`src/game/reducer.ts:2043`) after expenditure. That helper checks ordinary board mate/stalemate without considering any remaining card allowance or other escape resource. Its final outcome prevents the outer resource-aware adjudication from correcting the result. An initial agent probe with a wrong target object was discarded; a fresh agent using the correct string independently reproduced the defect. No fix applied.

### 16. A pre-merge Curse fails to constrain the whole composite

**Severity:** P2. **Status:** reproduced by parent and a fresh audit agent. **Area:** continuing effect scope across Confabulation.

**Rules:** Curse limits the marked Queen, Bishop, or Rook to moves of one or two squares (`cards.md`, Curse). The publisher FAQ's Confabulation ruling says a pre-existing Continuing Effect applies to the entire composite; only a transformation into a differently named piece, such as Crab, is component-specific (local FAQ text lines 744–751). Curse is a distance restriction, not a named transformation.

**Reproduction:** create `7k/8/8/8/8/2B5/1R6/7K b - - 0 1`, Black hand `['curse']`, White hand `['confabulation']`.

1. Black Kh8–g8; Curse on c3; endTurn.
2. White Confabulation `[{ from: 'c3', to: 'b2' }]`; endTurn.
3. Black Kg8–f8; endTurn.
4. White attempts b2–b6 using the composite's Rook movement.

**Expected:** reject the four-square move. The composite inherits the Bishop's Curse and is restricted to one or two squares with either component's movement.

**Actual:** b2–b6 succeeds. The Bishop's three-square diagonal b2–e5 correctly rejects, and the two-square Rook move b2–b4 succeeds: the engine applies the older Curse to just its original component.

**Controls:** applying Curse to b2 after the merge correctly rejects the same four-square Rook move. Without Curse, that move correctly succeeds.

**Implementation evidence:** `curseAllowsMove` (`src/game/reducer.ts:456–468`) compares the Curse and Confabulation effect indexes. For an older Curse, it restricts only the component whose ID matches the marker; the other component's movement bypasses it. The same helper governs attacks, so this also affects check detection. No fix applied.

### 17. Four replacement cards mistake an existing mate for a newly created mate

**Severity:** P2. **Status:** Fanatic reproduced by parent and a fresh audit agent; three sibling handlers reproduced by parent. **Area:** regular-card checkmate restriction.

**Rules:** `rules.md` §§11.2, 11.4–11.5 distinguish a regular card directly creating mate from a Continuing Effect creating mate. Plots Within Plots preserves two initially eligible replacement cards (§17.3). A later harmless move does not retroactively become the source of an existing mate.

**Reproduction:** create `6k1/8/5K1R/5N2/8/B7/1P6/8 w - - 0 1`, White hand `['plots-within-plots', 'confabulation', 'fanatic']`, Black hand `['under-elf-hill']`.

1. White plays Plots Within Plots. Confabulation and Fanatic are both initially eligible.
2. White plays Confabulation `[{ from: 'f5', to: 'h6' }]`. The Rook–Knight on h6 legally creates ordinary board mate against Kg8 as a Continuing Effect. Black can still use Under Elf Hill on its ensuing escape turn.
3. White plays Fanatic with target string `'b2'`.

**Expected:** Fanatic moves b2–b5. This does not create or change the existing mate.

**Actual:** Fanatic fizzles with `DIRECT_MATE`, spends the card, and leaves the Pawn on b2.

**Sibling reproductions:** substitute Onslaught `[{ from: 'b2', to: 'b3' }]`, Guardian with the same target, or Forced March `[{ from: 'b2', to: 'c2' }]` for Fanatic in the initial hand and final action. Each initially succeeds before Confabulation, but each incorrectly fizzles after the existing mate. These share one validation defect and count as one finding.

**Controls:** the same Fanatic play succeeds immediately after Plots, before Confabulation. Dubbing b2–d3 correctly succeeds after Confabulation while the existing mate remains. Annexation b2–b4 also succeeds, correctly opening f8 by blocking the Bishop's diagonal and thus removing the mate.

**Implementation evidence:** Fanatic (`src/game/reducer.ts:2535`), Forced March (`:2697`), Guardian (`:2911`), and Onslaught (`:2976`) reject any resulting ordinary checkmate without comparing the preceding position. Other handlers check that the mate is newly created. No fix applied.

### 18. Heresy delays first-phase Man-Trap captures until after the second phase

**Severity:** P2. **Status:** reproduced by parent and a fresh audit agent. **Area:** ordered multi-piece movement and arrival effects.

**Rules:** Heresy explicitly moves the opponent's Bishops first, then evaluates the acting player's Bishops against the updated board (`rules.md` §20). Man-Trap captures the next vulnerable opposing piece that ends a move on its square (§19.1). The first phase's capture therefore vacates that square before the second phase.

**Reproduction:** create `8/8/7k/8/8/1PB5/1b6/7K w - - 0 1`, White hand `['man-trap', 'heresy']`.

1. White Kh1–g1; Man-Trap on b3; endTurn.
2. Black Kh6–g6; endTurn.
3. White b3–b4, vacating the marked square.
4. White plays Heresy with `[{ from: 'b2', to: 'b3' }, { from: 'c3', to: 'b3' }]`.

**Expected:** Black's Bishop moves to b3 and is captured by Man-Trap. White's Bishop then moves from c3 to the now-empty b3. The card resolves.

**Actual:** the engine rejects the second Bishop's move with `ILLEGAL_MOVE`, treating b3 as still occupied. Changing only White's destination to d3 succeeds, captures Black's Bishop, and leaves b3 empty, confirming the trap and first-phase move are valid.

**Implementation evidence:** `playHeresy` updates piece squares inside its owner-phase loop (`src/game/reducer.ts:4023` and `:4069`) but does not resolve arrival effects between phases. `playCardCore` calls `springManTraps` only after the entire handler returns (`src/game/reducer.ts:6526`). No fix applied.

## Rule-sensitive observations, not counted as confirmed bugs

**Coup Prince can be confabulated.** From `7k/8/8/8/8/8/PP6/6NK w - - 0 1`, White with Coup and Confabulation plays b2–b3, Coup on a2, endTurn; Black plays Kh8–g8 and endTurn. Confabulation h1–g1 succeeds, merging the original King (now Prince) with the Knight. Parent and fresh agent both reproduced this. Confabulation excludes Kings, and the general transformation rule/FAQ says Princes remain affected by King cards. That suggests rejection, but the sources do not expressly distinguish target-type exclusions from royal protections in this pairing; the local rules also make some explicit Prince exceptions for other cards. Keep this as a ruling question rather than inflate the confirmed count. Relevant implementation: `hasRole` at `src/game/reducer.ts:260` treats the King role as royalty only, and Confabulation uses it at `:2388`.

**Fatal Attraction and an off-board push need an explicit ruling.** Create `k4nn1/6P1/8/8/8/8/1P6/7K w - - 0 1`, White hand `['coup', 'irresistible-force']`, Black hand `['fatal-attraction']`. White b2–b3, Coup on g7, endTurn; Black Ka8–a7, Fatal Attraction on f8, endTurn; White Irresistible Force `[{ from: 'g7', to: 'g8' }]`. The royal Pawn is exempt from immobilization; the g8 Knight is frozen. The engine accepts the push and captures that Knight off-board. The parent and a fresh agent reproduced this with a Knight magnet; an initial agent's Rook-magnet variant instead fizzled from self-check and was discarded as an invalid reproduction. Fatal Attraction forbids card movement, suggesting the forced displacement must fail, but §22.2 calls the off-board result capture and no explicit publisher pairing settles whether the terminal piece is treated as moving before capture. Keep this separate from confirmed findings. The implementation's general movement guard (`src/game/reducer.ts:6504`) skips pieces whose resulting carrier is absent, allowing a captured terminal piece to bypass the immobilization check.

## Coverage and progress

- Progress snapshot at 08:42 Europe/Prague: 9,735 random campaign runs covering 1,608,241 moves, including partial budget-limited runs; these are cumulative execution counts, not unique positions. Separate move-list comparisons checked 3,105 sampled states with 7,360,871 attempted move actions and found no legality discrepancy; one run reached its time budget. Card-effect rotation checks completed 4,254 comparisons without a discrepancy. Campaigns continue until the audit deadline.
- Rules and card-effect reading completed.
- Engine API inventory: `createGameState`, `applyAction`, `legalDests`, `cardPlayTargets`, `isKingInCheck`, and pending-choice APIs.
- Existing engine-only random campaign helper inspected for reuse; its assertions are treated as candidate detectors, not authoritative rules.
- First malformed-action audit: 20 adversarial rejection/immutability cases passed, in addition to the shared 22 directed, 16 seeded ordinary, and one multi-card baseline.
- Cancellation: three ordinary-cancel cases and six corrected optional-Fatal-Attraction cases passed across Chaos, Knightmare!, and Think Again!, with return/refusal accounting and repeat restrictions.
- Charge followed by Chaos correctly restores only the extra move, prohibits repeating it, permits a different replacement, and preserves move clocks. A random-campaign FEN/actor mismatch in this temporary replacement phase is an oracle limitation, not a confirmed engine bug.
- First-rank Pawn double moves passed at all four board orientations, including en-passant metadata.
- 10,560 malformed-target probes across 80 cards and four action windows produced no exceptions, input mutations, or changed rejected states. Sparse JavaScript arrays were tested separately (finding 7).
- 3,000 quarter-rotation comparisons across 1,000 synthetic positions preserved ordinary move legality with correspondingly rotated Pawn direction; these are property probes, not claims that every synthetic position arose in a legal game.
- The third random campaign additionally checks physical-card conservation across hands, decks, discards, and retained effects, excluding documented Vulture proxies. Reviewed helper limitations for legal surrender, variant en passant, and pending-rescue replacement continuations are excluded from engine findings.
- Seeds 12092026, 12092027, 12092029, and 12092030 completed 30, 40, 50, and 50 ordinary moves respectively. Seed 12092028 stopped on an audit-oracle false positive: castling through an attacked square is permitted by `rules.md` §11.6. This is not counted as an engine bug.
- Harness mistakes (wrong card timing, omitted target, wrong en-passant array access, and selecting a magnet-frozen alternative move) were corrected or rejected rather than reported as engine findings.
- Agents that missed their first-patch checkpoint were interrupted. Subsequent assignments use smaller, isolated context and explicit validated fixtures.

## Continuation record

Keep auditing until the full ten-hour window has elapsed. Deadline Unix timestamp: `1789203324`. Do not mark the goal complete before that deadline. Maintain reproducible cases, deduplicate shared root causes, and preserve only this report as new repository content.
