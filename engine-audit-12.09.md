# Engine bug audit — 12.09.2026

Status: audit and authorized fix follow-up complete. All 11 bug families still open at `b101581bcd3e4ab478057565702daf84256b253e` are fixed and independently audited at engine revision `c5ed7f6a9d7d83b8b38583ad4bbd225e7cfc9c60`. All 39 original reproduction groups pass; the full engine suite passes 6,438 tests, and typecheck passes. The report preserves 27 historical confirmed families and two uncounted ruling questions. See the dated fix record at the end for commits and verification. No UI tests were run.

Requested audit window: 12 September 2026, 00:55–10:55 Europe/Prague (11 September 22:55–12 September 08:55 UTC), ten hours. The session was interrupted; the last original campaign record is 07:48:35 UTC. Directed auditing resumed at 14:11 UTC and completed at 15:18 UTC (17:18 Europe/Prague), making up the remaining window. These timestamps do not imply uninterrupted execution during the gap.

Baseline commit: `9ecdd9857582c261d64f6b37ad35fd941c0ee343`; working tree initially clean.

## Findings open at the pre-fix revision `b101581`

| Finding | Priority | Reproducible consequence |
| --- | --- | --- |
| 11 | P1 | A royal inside a composite loses valid card escapes; the engine can declare false checkmate. |
| 6 | P2 | A legal Earthquake target query after Plots blocks for approximately eight seconds. |
| 19 | P2 | Copied Toll refusal either rejects or spends an unrelated physical card. |
| 20 | P2 | Haunting Memories cannot copy Hostage in a valid ordinary-capture response. |
| 21 | P2 | Toll cancels a turn when the player has no Pawns, contrary to the publisher FAQ. |
| 22 | P2 | Copying Panic closes a Toll response that literal Panic preserves. |
| 23 | P2 | Challenge applies the wrong player's restriction to neutral-piece attacks and moves. |
| 24 | P2 | A forbidden en-passant capture is incorrectly treated as a threat to a royal Pawn. |
| 25 | P2 | The legal-move list omits a quiet Prince move that explicit submission accepts. |
| 26 | P2 | Doppelganger loses the opposing move trigger or copies the acting player's piece. |
| 27 | P2 | A late Plots resurrection retains Crab powers after their rescue window expires. |

This table records the pre-fix snapshot. The detailed numbered findings retain historical evidence and follow-ups. The other 16 families' documented regressions passed at that snapshot; this is a result for those probes, not a claim that their entire interaction space is correct.

## Original audit authority and method

Read the complete `rules.md` (965 lines), all 80 effects in `cards.md`, and the locally preserved publisher rulebook before starting probes. Use the local publisher FAQ and card artwork to resolve specific questions. Distinguish explicit rules from documented local rulings. Missing optional variants and ambiguous interpretations are not automatically bugs.

Use only engine APIs and temporary directed, seeded randomized, and multi-card scripts. Fresh audit agents receive a parent-validated bounded scaffold, add one independent adversarial group, and report measured results. Reproduce findings independently before inclusion. Never fix findings or change production/test sources; delete temporary harnesses when their audit phase ends. This Markdown file is the sole deliverable.

## Verified findings

The numbered findings below preserve the discovery record. Unless a subsection explicitly names the then-current revision, its observed behavior and source line numbers refer to the baseline above. Within these historical findings, “current revision” means the pre-fix revision `b101581`, and “No fix applied” describes the audit-only phase. The subsequently authorized fixes are recorded separately at the end.

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

### 6. Earthquake promotion enumeration causes excessive allocation and query latency

**Severity:** P2. **Status:** reproduced by parent and a fresh audit agent. **Area:** engine time and memory consumption.

**Reproduction:** create `4k3/8/P6p/P6p/P6p/P6p/P6p/3K4 w - - 0 1`, with White holding `['plots-within-plots', 'earthquake']`, in the default before-move phase. Call `applyAction(state, { type: 'playCard', cardId: 'plots-within-plots' })`. Repeat in a fresh process with only Plots in hand as a control. Measure the action with `performance.now()` and `process.memoryUsage().heapUsed`.

**Expected:** Earthquake is an after-move card and cannot be eligible here. Determining that should not expand its possible promotion choices.

**Actual:** the result correctly has an empty eligible-card list, but the engine first materializes every Earthquake promotion combination. The ten edge Pawns yield `4^10` combinations for one rotation. The parent measured 836 ms and 431 MiB heap with a 512 MiB V8 heap cap, versus 2 ms and 11 MiB without Earthquake. The independent agent measured 558 ms and 537 MiB without an explicit heap cap, versus 0 ms and 16 MiB for its control. Measurements are individual runs on this host, not portable timing guarantees.

**Bounded scaling probe:** two, four, six, and eight edge Pawns took 3, 3, 6, and 31–32 ms, respectively; eight used approximately 61 MiB. Ten Pawns exhausted an explicitly imposed 128 MiB V8 heap limit, and twelve exhausted a 256 MiB limit. These capped aborts demonstrate memory pressure; they are not claims of an uncapped default-process crash.

**Implementation evidence:** `src/game/reducer.ts:6450` calls `cardPlayTargetsUnchecked` before checking whether each target can be played. Earthquake's generator (`src/game/reducer.ts:4269`, dispatched at `:6941`) eagerly builds the Cartesian product of promotion choices, even though timing alone excludes the card. No fix applied.

**Current-revision follow-up:** the ineligible-card case above is fixed at `b101581bcd3e4ab478057565702daf84256b253e`, but a legal after-move Earthquake query still blocks synchronously for approximately 8.3 seconds after Plots. Create `4k3/8/P6p/P6p/P6p/P6p/8/3K4 w - - 0 1` with White holding Earthquake and Plots Within Plots. Play Kd1–d2, then Plots, then call `cardPlayTargets(state, 'earthquake')`. This ten-piece position has four Pawns per side on the edge files. The generator returns 65,537 targets: `4^8` promotion combinations for clockwise rotation and one for counterclockwise rotation. The parent measured 8,274 ms including the roughly 21 ms Plots action; the fresh agent measured the query alone at 8,291 ms. Its complete 41-probe audit took 8,685 ms. A four-Pawn query after Plots took 23–29 ms; an eight-Pawn query without Plots took 70 ms. The marked difference comes from simulating every promotion tuple for the saved Plots allowance at current `src/game/reducer.ts:6090`; eager tuples are constructed at `:3966` and dispatched at `:6456`.

The target count is mathematically correct. The finding is excessive synchronous work for a bounded engine query, grouped with the same Earthquake enumeration family rather than counted twice. Regression case 29 uses a five-second audit budget; it is a measured host-specific performance assertion, not a rule of the game or a guarantee about every machine.

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

### 11. A restored royal inside a composite is not consistently treated as King

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

**Current-revision follow-up — still open at `b101581bcd3e4ab478057565702daf84256b253e`:** ordinary capture protection and check detection now recognize the royal component. However, Hidden Passage, Under Elf Hill, and Man of Straw still require the board carrier itself to have `royal: true`. They reject the same explicitly royal composite and can cause false checkmate. This is grouped with the existing physical-component identity defect rather than counted again. The accepted Prince-merge interpretation caveat above still applies.

For the short rejection case, use the original fixture in this finding, add `hidden-passage` to White's starting hand, and stop after step 4. White is now in check. Hidden Passage `[{ from: 'g1', to: 'f1' }]` rejects with `WRONG_ROLE: Choose your royal piece.`, although moving the composite to safe f1 is legal under §22.5. Ordinary g1–e2 succeeds as a control. Replacing the extra card with Under Elf Hill also rejects (`Your King cannot leave the board.`), and Man of Straw `{ king: 'g1', pawn: 'b3' }` rejects with `WRONG_ROLE`. The parent reproduced all three; a fresh audit agent independently reproduced Hidden Passage.

**False-checkmate reproduction on the current revision:** create `k5rr/8/8/8/8/5P2/PP2PP2/5RNK w - - 0 1`, White hand `['coup', 'confabulation', 'hidden-passage']`, Black hand `['plots-within-plots', 'mystic-shield', 'earthquake']`.

1. White b2–b3, Coup on a2, endTurn. Coup legally supplies the escape from the initial h-file check.
2. Black Ka8–b8, endTurn.
3. White Confabulation `[{ from: 'h1', to: 'g1' }]`, endTurn.
4. Black Rh8–h1; Plots Within Plots; Mystic Shield on h1; Earthquake `{ direction: 'clockwise', promotions: [{ square: 'a2', role: 'rook' }] }`.
5. Black endTurn.

Every declared card resolves. Earthquake restores the King inside g1. Its ordinary destinations are occupied or attacked, and the h1 Rook is shielded. Hidden Passage g1–c4 would safely relocate the complete royal composite without giving mate, so §11.5 requires an escape turn. Instead, endTurn declares Black checkmate immediately. Substituting Under Elf Hill or Man of Straw in White's hand produces the same false outcome; Man of Straw could swap g1 with the Pawn on f3. Failing assertions for these cases are included in the regression appendix.

Current source evidence: `playUnderElfHill` (`src/game/reducer.ts:2954`) searches only royal records in the board zone; `playHiddenPassage` (`:3289`) and `playManOfStraw` (`:4526`) check only the selected carrier's flag. Hidden Passage target generation repeats the board-record restriction (`:6174`). By comparison, the corrected check predicate resolves the royal record through `boardCarrier` (`:2194`). No fix applied by this audit.

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

### 19. Haunting Memories copying Toll mishandles declined payment

**Severity:** P2. **Status:** open on `b101581bcd3e4ab478057565702daf84256b253e`; both consequences reproduced by the parent and separate fresh audit agents. **Area:** copied reaction eligibility and physical-card expenditure.

**Rules:** Haunting Memories copies the last played card's text and classification (§22.7). Toll is non-unique and permits the moving player either to lose a Pawn or decline payment, canceling the entire turn. Copying Toll must preserve both choices and spend the selected Haunting Memories card, not an unrelated physical card. See Toll's printed text in `cards.md` and `src/game/cards/catalog.ts`, and the publisher's turn-cancellation clarification cited in `rules.md` §6.

**Reproduction:** create `1r5k/6p1/8/8/8/8/7P/R6K w - - 0 1`, White hand `['haunting-memories']`, Black hand `['toll']`.

1. White Ra1–a5, crossing the frontier.
2. Black plays Toll with target `'h2'`; White pays that Pawn. End White's turn.
3. Black Rb8–b4, crossing toward White.
4. White plays Haunting Memories with no target, copying the last Toll and selecting declined payment.

**Expected:** cancel Black's turn, return its Rook to b8, and spend White's Haunting Memories. The copied card has the same refusal option as Toll.

**Actual:** rejection with `INVALID_TIMING: The canceled turn cannot be reconstructed.` The identical Haunting Memories action with target `'g7'` succeeds, pays Black's Pawn, and correctly spends the copy. Thus the preceding card, actor, timing, frontier crossing, and copy permission are valid.

**Second consequence:** change White's initial hand to `['haunting-memories', 'toll']`, preserving that order, and repeat the same declined-payment action. It now succeeds, but discards `white-hand-1-toll` and leaves `white-hand-0-haunting-memories` in hand. The history calls it Haunting Memories despite expenditure of the unplayed physical Toll. A direct play of the actual Toll and a copied Toll with Pawn payment are correct controls. Hand order matters because the failed lookup below falls through to the last card.

**Implementation evidence on the current revision:** `rememberTurnStart` (`src/game/reducer.ts:7698`) records a cancellation checkpoint only when the opponent holds a literal Toll. A hand containing only a valid Haunting Memories copy does not qualify. `playToll` (`:1969`) requires that missing checkpoint for refusal. When a real Toll supplies the checkpoint, `hauntingCopy` (`:5441`) substitutes the copied type only in the current hand, while `playToll` restores the old hand and calls `spendCard` with the copied type and Haunting Memories ID (`:1980`). That pair does not exist in the restored hand; `findIndex` returns −1 and `splice(-1, 1)` spends its last card (`:1446`). These two consequences share the unsupported copied-Toll rollback path and are counted together. No fix applied.

### 20. Haunting Memories cannot copy Hostage after an ordinary capture

**Severity:** P2. **Status:** open on `b101581bcd3e4ab478057565702daf84256b253e`; reproduced by the parent and a fresh audit agent. **Area:** reacting-player selection for copied cards.

**Rules:** Haunting Memories copies the last card's effect and timing (§22.7). Hostage may immediately answer an ordinary capture by returning the captured owned piece in exchange for another controlled Pawn (§22.11). Copying it does not transfer its reaction to the player who made the capture.

**Reproduction:** create `r6k/6p1/8/8/8/2p5/P6P/1N5K w - - 0 1`, White hand `['haunting-memories', 'hostage']`, Black hand `['hostage']`.

1. White Nb1×c3.
2. Black Hostage `{ pieceId: 'black-pawn-c3', pawn: 'g7' }`; end White's turn.
3. Black Ra8×a2.
4. White Haunting Memories `{ pieceId: 'white-pawn-a2', pawn: 'h2' }`.

**Expected:** copy the last Hostage, return White's captured a2 Pawn to h2, sacrifice the original h2 Pawn, and spend Haunting Memories.

**Actual:** `INVALID_TARGET: There is no eligible last card to copy.` Playing White's actual Hostage with the identical target succeeds from the same position, confirming the rescue and response window are legal. The last played card is still Black's Hostage.

**Implementation evidence:** `hauntingCopy` includes Hostage in its reacting-player branch only when `state.cardResponse` exists (`src/game/reducer.ts:5430`). Ordinary captures do not supply that card-response record. Hostage is also missing from the fallback list that selects the opponent of `state.turn.color`; the function instead searches the capturing player's hand for Haunting Memories. No fix applied.

### 21. Toll cancels a turn even when the moving player has no Pawns

**Severity:** P2. **Status:** open on `b101581bcd3e4ab478057565702daf84256b253e`; reproduced by the parent and a fresh audit agent. **Area:** publisher-specific card exception.

**Authority:** the local publisher FAQ explicitly asks what happens when the tolled player has no Pawns and answers, “The TOLL is lost without effect.” (`audit/ten-hour-2026-09-08/official-faq.txt:2645–2647`.) The general printed refusal rule is therefore insufficient for this case; `rules.md` contains no contrary house ruling.

**Reproduction:** create `7k/8/8/8/8/8/8/R6K w - - 0 1`, Black hand `['toll']`. White Ra1–a5, then Black plays Toll with no target.

**Expected:** spend Toll without changing the completed move. White's Rook stays on a5.

**Actual:** Toll resolves and returns the Rook to a1, canceling White's turn. White has only a King and Rook, so no Pawn can be offered. Adding an unpromoted White Pawn on h2 is a correct control: in that position declining payment may cancel the turn.

**Implementation evidence:** `tollTargets` always includes the no-target refusal choice, even when its Pawn list is empty (`src/game/reducer.ts:1950`). `playToll` enters its unconditional cancellation branch at `:1968` without checking whether the moving player has any Pawns. No fix applied.

### 22. Copying Panic incorrectly closes the Toll response to the preceding move

**Severity:** P2. **Status:** open on `b101581bcd3e4ab478057565702daf84256b253e`; reproduced by the parent and a fresh audit agent. **Area:** copied-card identity in movement-trigger detection.

**Rules and scope:** Haunting Memories copies the preceding card's text and classification (§22.7). A legally copied Panic must preserve the same movement and response behavior as literal Panic. This finding establishes an inconsistent copy implementation; no separate publisher ruling about the exact Panic/Toll ordering is claimed.

**Reproduction:** create `1r5k/6p1/8/8/8/8/8/7K w - - 0 1`, White hand `['panic', 'toll']`, Black hand `['haunting-memories', 'panic']`.

1. White Kh1–g1, Panic, endTurn.
2. Black Rb8–b4, completing the timed move and crossing the frontier.
3. Black Haunting Memories with no target, copying Panic for White's next move.
4. White Toll with target `'g7'`.

**Expected:** the same Toll response as after Black's literal Panic: capture the g7 Pawn as payment. Copying the effect changes the spent card's identity, not the preceding Rook move.

**Actual:** `INVALID_TIMING: Toll must immediately follow an opponent's move across the frontier.` Replacing only step 3 with Black's actual Panic makes the same Toll succeed. Both Panic variants resolve and record an empty movement list with `preservePreviousMove: true`.

**Implementation evidence:** `tollMovement` special-cases `event.cardId === 'panic'` (`src/game/reducer.ts:1903`) to recover the preceding move. A copied event instead has `cardId: 'haunting-memories'` and `copiedCardId: 'panic'`, so it falls through to an empty movement list and loses the crossing. The same function already resolves `copiedCardId` for the double-move cards. No fix applied.

### 23. Challenge uses a neutral attacker's owner instead of its controller

**Severity:** P2. **Status:** open on `b101581bcd3e4ab478057565702daf84256b253e`; reproduced by the parent and a fresh audit agent. **Area:** neutral-piece threat calculation and saving-card move generation.

**Rules:** `rules.md` §§11.6, 11.7, 15.1, and 18.2. A player may temporarily leave their King in check if an after-move card removes that check. A challenged player must use the named piece, so captures by other pieces cannot give check. Either player controls a neutral piece; capture restrictions must be evaluated for the player attempting the capture.

**Reproduction:** create `r6k/8/8/8/8/8/1P6/3K4 w - - 0 1`, with White holding Neutrality and Black holding Challenge. White plays Kd1–e1, Neutrality on the black Rook at a8, and ends the turn. Black then attempts Kh8–g8, intending to play Challenge on White's movable Pawn at b2 before ending the turn.

**Expected:** accept the staged King move and then Challenge. White must use b2; White can no longer use the neutral Rook to capture Black's King, so Black is safe. White's King at e1 is outside the Rook's resulting line in the hypothetical capture. As a positive control, the corresponding position `R6k/8/8/8/8/8/1P6/4K3 b - - 0 1` with an ordinary White Rook accepts Kh8–g8, Challenge b2, and leaves Black out of check.

**Actual:** the neutral variant rejects Kh8–g8 with `ILLEGAL_MOVE: That is not a legal chess move.` The saving-card search cannot recognize Challenge as removing the attack. The fresh agent reproduced the rejection in a 41-probe run taking 370 ms; the failing move prevents reaching the proposed Challenge action. This is not a claim that the rejected card was played or spent.

**Implementation evidence:** current `src/game/reducer.ts:2055` calls `challengeAllows(state, [piece], piece.owner)` even though `pieceAttacksSquare` receives a separate `controller`. `legallyAttacksRoyal` at `:2148` passes White as the hostile controller of this black-owned neutral Rook, but the Challenge guard still checks Black's obligations. Regression case 30 records the public-action failure. No fix applied.

**Additional-move consequence:** create `r6k/8/8/2n5/8/8/8/3K4 w - - 0 1`, White hand `['neutrality', 'plots-within-plots', 'challenge', 'merciless']`. Play White Kd1–e1, Neutrality a8, endTurn; Black Kh8–g7, endTurn; White's controlled neutral Rook a8–a6, Plots, Challenge c5. Merciless `[{ from: 'a6', to: 'a5' }]` now incorrectly rejects with `ILLEGAL_MOVE`, although Challenge binds Black and White controls the Rook for this action. The same Plots/Merciless sequence without Challenge succeeds. All setup cards resolve without fizzling, and Merciless was eligible when Plots opened. The neutral-move branch at current `src/game/reducer.ts:7194` uses the same attack helper with its default owner-based controller. A separate fresh agent confirmed this in 41 probes / 388 ms; regression case 33 preserves it.

### 24. En-passant check detection ignores restrictions on the capturing Pawn

**Severity:** P2. **Status:** open on `b101581bcd3e4ab478057565702daf84256b253e`; primary case reproduced by the parent and a fresh audit agent. **Area:** royal-Pawn threat calculation and move generation.

**Rules:** `rules.md` §§11.7, 13.1, 15.3, and 18.6. A Coup Pawn has royal protection but retains Pawn movement. A legal en-passant capture can threaten that royal Pawn, but an immobilized Pawn cannot move or capture and therefore cannot give check. The royal Pawn itself is exempt from Fatal Attraction's immobilization.

**Reproduction:** create `7k/8/8/2n5/2p5/8/1P6/7K w - - 0 1`, with White holding Coup and Black holding Fatal Attraction. White plays Kh1–g1, Coup b2, endTurn. Black plays Kh8–g8, Fatal Attraction c5, endTurn. White attempts b2–b4.

**Expected:** accept b2–b4. Black's Pawn on c4 is adjacent to the c5 magnet and cannot capture en passant on b3. The Knight on c5 does not attack b4, and the moving royal Pawn has the royal exemption from the magnet.

**Actual:** `ILLEGAL_MOVE: That is not a legal chess move.` With an ordinary White Pawn instead of a Coup King, the same setup accepts b2–b4 and then correctly rejects Black's c4×b3 en-passant attempt because that Pawn is immobilized. Without Fatal Attraction, rejecting the royal double-step is correct because the enemy Pawn really can capture en passant. The fresh agent confirmed the frozen royal case in 41 probes / 361 ms.

**Related directed case:** omit Fatal Attraction and give White Challenge in addition to Coup. After the same King moves and Coup setup, b2–b4 should be permitted with Challenge on the movable Knight c5 as the saving after-move card: Black must move that Knight and cannot use c4 for en passant. The engine again rejects the initial Pawn move. This is the same omitted capture-restriction guard, not the neutral-owner mismatch in finding 23.

**Implementation evidence:** current `src/game/reducer.ts:2287` calls `enPassantCapture` to assess a royal en-passant threat. That helper validates geometry and capture protection (`:2220–2258`) but does not apply `dungeonAllowsMove`/Fatal Attraction or Challenge. Ordinary `movePiece` checks those restrictions, so actual capture legality and check detection disagree. Regression cases 31–32 retain both public-action failures. No fix applied.

### 25. An illegal en-passant choice hides a legal quiet Prince move

**Severity:** P2. **Status:** open on `b101581bcd3e4ab478057565702daf84256b253e`; reproduced by the parent and a fresh audit agent. **Area:** disagreement between legal-move enumeration and accepted move actions.

**Reproduction:** create `7k/3p4/8/rPP3P1/8/8/8/7K w - - 0 1`, White hand `['coup', 'coup']`. Play White Kh1–g1, Coup c5, endTurn; Black Ra5×b5, endTurn; White's original Prince g1–f1, Coup g5, endTurn; Black d7–d5, endTurn. Both Coups resolve: the original Pawn on c5 is now a capturable Prince with King movement, and g5 is White's royal Pawn.

**Expected:** c5–d6 must appear in `legalDests(state).get('c5')` because `{ type: 'move', from: 'c5', to: 'd6', enPassant: false }` is legal and accepted by the engine. This quiet Prince move leaves the black Pawn on d5 shielding White's royal g5 Pawn from the Rook on b5.

**Actual:** the explicit quiet action succeeds, while the move list is `['b4', 'c4', 'd4', 'b5', 'd5', 'b6', 'c6']`, omitting d6. The default/explicit en-passant capture correctly fails because removing d5 would expose the King on g5. The fresh agent verified the discrepancy in 41 probes / 369 ms. This finding is an engine API consistency failure in a position reached through accepted public actions; it does not require a UI test or infer a UI symptom.

**Implementation evidence:** current `src/game/reducer.ts:697–700` retries a destination with `enPassant: false` only for a Confabulated piece. An original Pawn transformed into a Prince by successive Coups is not Confabulated, so its rejected default capture masks the legal quiet alternative. `movePiece` already supports that alternative at `:7024`. Regression case 34 first verifies the explicit quiet action and then asserts the destination is listed. No fix applied.

### 26. Doppelganger loses or replaces the opposing move it should copy

**Severity:** P2. **Status:** open on `b101581bcd3e4ab478057565702daf84256b253e`; primary Plots case reproduced by the parent and a fresh audit agent. **Area:** movement-copy trigger identity.

**Rules:** `cards.md`, Doppelganger; `rules.md` §21 and §17.3. Doppelganger copies the kind of the opponent's just-moved piece, without copying temporary movement powers. Plots preserves the original eligibility window while allowing current-position target choices. It cannot turn the acting player's own preceding move into the required opposing move.

**Reproduction:** create `1n5k/8/8/8/8/8/8/R2B3K b - - 0 1`, White hand `['plots-within-plots', 'dubbing', 'doppelganger']`. Black plays Nb8–c6 and ends. White plays Plots, then Dubbing `[{ from: 'a1', to: 'b3' }]` on White's Rook. Try each Doppelganger target independently from that state:

- `[{ from: 'd1', to: 'f2' }]` should succeed with the opposing Knight's geometry. It instead rejects with `ILLEGAL_MOVE: Copy the last moved piece to an empty square.`
- `[{ from: 'd1', to: 'd4' }]` should reject. It succeeds, copying White's Rook instead of the opponent's Knight.

Before the Dubbing extra, the same Plots position correctly accepts d1–f2 and rejects d1–d4. All setup cards resolve; no change to the opponent's Knight occurred. The fresh agent independently confirmed the illegal acceptance in 41 probes / 358 ms.

**Passive-extra consequence:** replace Dubbing in the hand with Pacifism, then play Pacifism on a1 as the first Plots extra. Doppelganger d1–f2 now rejects with `INVALID_TIMING: There is no single previous move to copy.` The opponent's Knight trigger and the selected Bishop are unchanged; this was reproduced by the parent.

**Skipped-turn consequence:** from the same starting FEN, give White Panic and Doppelganger. Play Black Nb8–c6, endTurn; White Ra1–a2, Panic, endTurn; Black `panicTimeout`. On White's next turn Doppelganger d1–d4 incorrectly succeeds by copying White's Rook. Black has just forfeited its move, and its last actual mover was a Knight; neither reading permits copying White's Rook. A control where Black actually plays Nc6–b4 instead of timing out rejects the Rook geometry and accepts d1–f2. A separate fresh agent confirmed the failure in 41 probes / 357 ms.

**Implementation evidence:** current `src/game/reducer.ts:1268–1290` scans the current history backward for any movement without verifying the mover belongs to the required opposing turn or consulting the saved Plots trigger. It therefore selects the acting player's new Rook move, or stops at a passive before-move card with `preservePreviousMove: false`. Regression cases 35–38 retain the four consequences. No fix applied.

### 27. A later Plots resurrection keeps a Crab transformation beyond its rescue window

**Severity:** P2. **Status:** open on `b101581bcd3e4ab478057565702daf84256b253e`; reproduced by the parent and a fresh audit agent. **Area:** transformation expiry across multiple moves within one turn.

**Rules:** the publisher rulebook's Transformed Pieces section (`audit/ten-hour-2026-09-08/official-rulebook.txt:70–74`) and `rules.md` §10 retain a transformation when the piece is rescued during the capture move or the immediately following move; later returns restore its original type. Sections 6 and 17.3 distinguish moves from turns and explicitly treat two Plotted replacement cards as separate moves. Resurrection replaces the Regular Move under §15.5.

**Reproduction:** create `7k/8/8/3p4/8/8/8/3R3K b - - 0 1`, Black hand `['crab', 'plots-within-plots', 'dubbing', 'resurrection']`. Black plays Kh8–g8, Crab d5, endTurn. White plays Rd1×d5, endTurn. Black plays Plots, Dubbing `[{ from: 'g8', to: 'e7' }]`, then Resurrection `{ pieceId: 'black-pawn-d5', to: 'd7' }`.

**Expected:** the returned piece is an ordinary Pawn. Dubbing was already the move immediately following the capture; Resurrection is the next separate replacement move. An immediate Resurrection without the intervening Dubbing correctly keeps Crab and is the positive control.

**Actual:** both extras resolve, but the returned d7 Pawn still has the active Crab effect and its retained physical card. The fresh agent confirmed this in 41 probes / 367 ms. To observe its resulting movement, end Black's turn, move White's Rook d5–a5, and end White's turn. The engine lists only c6 and e6 for the d7 Pawn, accepts the empty-square diagonal d7–c6, and rejects the ordinary forward d7–d6. A second fresh agent confirmed the illegal diagonal acceptance in 41 probes / 365 ms; the parent verified both movement results.

**Implementation evidence:** `recentlyCaptured` at current `src/game/reducer.ts:305` uses a turn/ply-derived timestamp. After the first Black replacement move, `currentPly` still treats the state as the immediately following ply, so `expirePieceEffects` at `:7466` preserves the captured Crab marker. The second Plots view changes the move phase, but `restoreCapturedPawn` at `:4301` changes only the piece's role and does not expire that marker before putting the Pawn on board. Once on board, the marker is retained. Regression case 39 records the late-rescue failure. No fix applied.

## Rule-sensitive observations, not counted as confirmed bugs

**Coup Prince can be confabulated.** From `7k/8/8/8/8/8/PP6/6NK w - - 0 1`, White with Coup and Confabulation plays b2–b3, Coup on a2, endTurn; Black plays Kh8–g8 and endTurn. Confabulation h1–g1 succeeds, merging the original King (now Prince) with the Knight. Parent and fresh agent both reproduced this. Confabulation excludes Kings, and the general transformation rule/FAQ says Princes remain affected by King cards. That suggests rejection, but the sources do not expressly distinguish target-type exclusions from royal protections in this pairing; the local rules also make some explicit Prince exceptions for other cards. Keep this as a ruling question rather than inflate the confirmed count. Relevant implementation: `hasRole` at `src/game/reducer.ts:260` treats the King role as royalty only, and Confabulation uses it at `:2388`.

**Fatal Attraction and an off-board push need an explicit ruling.** Create `k4nn1/6P1/8/8/8/8/1P6/7K w - - 0 1`, White hand `['coup', 'irresistible-force']`, Black hand `['fatal-attraction']`. White b2–b3, Coup on g7, endTurn; Black Ka8–a7, Fatal Attraction on f8, endTurn; White Irresistible Force `[{ from: 'g7', to: 'g8' }]`. The royal Pawn is exempt from immobilization; the g8 Knight is frozen. The engine accepts the push and captures that Knight off-board. The parent and a fresh agent reproduced this with a Knight magnet; an initial agent's Rook-magnet variant instead fizzled from self-check and was discarded as an invalid reproduction. Fatal Attraction forbids card movement, suggesting the forced displacement must fail, but §22.2 calls the off-board result capture and no explicit publisher pairing settles whether the terminal piece is treated as moving before capture. Keep this separate from confirmed findings. The implementation's general movement guard (`src/game/reducer.ts:6504`) skips pieces whose resulting carrier is absent, allowing a captured terminal piece to bypass the immobilization check.

## Coverage

- The original randomized campaigns stopped at 07:48:35 UTC with 10,870 cumulative runs / 10,867 unique seeds and 1,785,543 moves, including partial budget-limited runs. These are execution counts, not unique positions or exhaustive coverage. There were 246 probe-budget flags and 21 process-timeout flags; a budget flag alone is not a confirmed bug. All 80 card types appeared in accepted card actions, including fizzles, which does not establish that all 80 resolved successfully in the campaigns.
- Separate move-list comparisons completed 813 runs covering 4,922 sampled states and 11,629,488 attempted move actions, with no discrepancy under that helper's sampled action model; three runs reached a budget. The directed en-passant-choice discrepancy in finding 25 uses an explicit alternative that those comparisons did not cover. Effect-rotation checks completed 526 runs / 3,154 states / 9,462 comparisons without a discrepancy, with three budget flags. Color-symmetry checks completed 103 runs / 621 states without a flag. Long elapsed times spanning the interruption are not treated as CPU latency measurements.
- The resumed phase uses directed cases and bounded performance probes; no randomized campaign was restarted. It rechecked the original findings against the externally updated engine, tested copying and cancellation, royal-composite escapes, controller-specific Challenge restrictions, and en-passant threat/choice behavior.
- Rules and card-effect reading completed.
- Engine API inventory: `createGameState`, `applyAction`, `legalDests`, `cardPlayTargets`, `isKingInCheck`, and pending-choice APIs.
- Existing engine-only random campaign helper inspected for reuse; its assertions are treated as candidate detectors, not authoritative rules.
- First malformed-action audit: 20 adversarial rejection/immutability cases passed, in addition to the shared 22 directed, 16 seeded ordinary, and one multi-card baseline.
- Cancellation: three ordinary-cancel cases and six corrected optional-Fatal-Attraction cases passed across Chaos, Knightmare!, and Think Again!, with return/refusal accounting and repeat restrictions.
- Current copied Chaos, Knightmare!, and Think Again! followed by Fog of War preserve the original move and the physical cards/draws with nonempty decks. The parent and a fresh sibling-card audit found no discrepancy (41 probes / 356 ms). Under Elf Hill's return restriction also remained attached to the same physical Pawn after Peace Talks canceled its Coup while it was away.
- Fortification correctly blocks an en-passant threat to a royal Pawn: with Black c4, White royal b2, and a wall across c4–b3, b2–b4 succeeds; removing the wall makes that move reject. The ordinary-Pawn control also rejects the blocked c4×b3 capture. The parent and a fresh agent confirmed these controls (41 probes / 365 ms, zero findings), limiting the scope of finding 24. Neutrality on a component also correctly suspends when it merges with a Queen in the current revision; the corresponding Bishop merge retains neutral control.
- A final directed immutability check in finding 26's Plots/Dubbing state confirmed that both `legalDests` and the 36-result Doppelganger `cardPlayTargets` query preserve the input state (approximately 16 ms combined). The documented discrepancy concerns copied movement, not query mutation.
- Charge followed by Chaos correctly restores only the extra move, prohibits repeating it, permits a different replacement, and preserves move clocks. A random-campaign FEN/actor mismatch in this temporary replacement phase is an oracle limitation, not a confirmed engine bug.
- First-rank Pawn double moves passed at all four board orientations, including en-passant metadata.
- 10,560 malformed-target probes across 80 cards and four action windows produced no exceptions, input mutations, or changed rejected states. Sparse JavaScript arrays were tested separately (finding 7).
- 3,000 quarter-rotation comparisons across 1,000 synthetic positions preserved ordinary move legality with correspondingly rotated Pawn direction; these are property probes, not claims that every synthetic position arose in a legal game.
- The third random campaign additionally checks physical-card conservation across hands, decks, discards, and retained effects, excluding documented Vulture proxies. Reviewed helper limitations for legal surrender, variant en passant, and pending-rescue replacement continuations are excluded from engine findings.
- Seeds 12092026, 12092027, 12092029, and 12092030 completed 30, 40, 50, and 50 ordinary moves respectively. Seed 12092028 stopped on an audit-oracle false positive: castling through an attacked square is permitted by `rules.md` §11.6. This is not counted as an engine bug.
- Harness mistakes (wrong card timing, omitted target, wrong en-passant array access, and selecting a magnet-frozen alternative move) were corrected or rejected rather than reported as engine findings.
- Agents that missed their first-patch checkpoint were interrupted. Subsequent assignments use smaller, isolated context and explicit validated fixtures.

## Executable regression examples

The following single script supplies a failing assertion for every confirmed finding, plus important secondary consequences. Save the code block as `/tmp/engine-audit-regressions.mts` and run from the repository root:

```sh
node --import tsx /tmp/engine-audit-regressions.mts
```

An optional numeric argument selects one case, for example `node --import tsx /tmp/engine-audit-regressions.mts 21`. The script imports only engine APIs and Node's assertion library. It does not run UI tests or modify production/test files. `AUDIT_ENGINE_ROOT` can select a separate checkout of the baseline revision. The audit verified the baseline using exact copies of its four required engine files in a temporary directory, with the already-installed dependencies.

**Verified results:** the final serial run executed all 39 case groups on both revisions. All 39 fail on baseline `9ecdd9857582c261d64f6b37ad35fd941c0ee343` (23.732 seconds total). On `b101581bcd3e4ab478057565702daf84256b253e`, 21 pass and 18 still fail (10.144 seconds total): cases 19–20 (finding 11's escape follow-up), 21–22 (finding 19), 26–28 (findings 20–22), 29 (finding 6's latency follow-up), 30 and 33 (finding 23), 31–32 (finding 24), 34 (finding 25), 35–38 (finding 26), and 39 (finding 27). These remaining failures cover 11 bug families. Cases 1–18 correspond to the original numbered findings; 23–25 cover Heresy's released magnet and the two restored-Panic consequences. A failing group stops at its first failed assertion; the separate directed probes above establish additional sibling cases. Neither run emitted stderr.

The three performance assertions are host-level regression budgets, not chess rules or universal runtime guarantees. A serial recheck measured the original Doomsayer case at 14.882 seconds and the current case at 1.344 seconds. Plots' ineligible-Earthquake case dropped from approximately 505 MiB additional heap / 426 ms to 0.60 MiB / 1.52 ms. The remaining 1.34-second adjudication is still perceptible; passing the five-second regression budget does not establish a lag-free engine. Run performance cases in fresh processes when comparing revisions.

```ts
// Save as .mts so Node/tsx supports the dynamic engine-root imports.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = process.env.AUDIT_ENGINE_ROOT ?? process.cwd();
const { createGameState } = await import(pathToFileURL(resolve(root, 'src/game/state.ts')).href);
const { applyAction, isKingInCheck, cardPlayTargets, legalDests } = await import(pathToFileURL(resolve(root, 'src/game/reducer.ts')).href);
const tests: {id:number,name:string,run:()=>void}[] = [];
const test = (id:number,name:string,run:()=>void) => tests.push({id,name,run});
const move = (from:string,to:string,extra={}) => ({type:'move',from,to,...extra});
const card = (cardId:string,target?:unknown) => ({type:'playCard',cardId,...(target===undefined?{}:{target})});
const end = {type:'endTurn'};
const at = (s:any,square:string) => s.pieces.find((p:any)=>p.zone==='board'&&p.square===square);
function step(s:any,a:any) {
 const before=JSON.stringify(s),r=applyAction(s,a);
 assert.equal(JSON.stringify(s),before,'input mutated');
 assert.equal(r.ok,true,JSON.stringify({action:a,error:r.error}));
 return r.state;
}
const run = (options:any,actions:any[]) => actions.reduce(step,createGameState(options));
function resolved(s:any,a:any) {
 const next=step(s,a);assert.equal(next.history.at(-1)?.type,'cardPlayed','unexpected card fizzle');return next;
}

test(1,'Vendetta accepts an off-board Irresistible Force capture',()=>{
 const s=run({fen:'k5nb/6P1/8/8/8/8/8/7K b - - 0 1',hands:{black:['vendetta'],white:['irresistible-force']}},[move('a8','a7'),card('vendetta'),end]);
 const n=resolved(s,card('irresistible-force',[{from:'g7',to:'g8'}]));
 assert.equal(n.pieces.find((p:any)=>p.id==='black-knight-g8').zone,'captured');
});
test(2,'Arriving Confabulation component springs Man-Trap',()=>{
 const s=run({fen:'7k/8/8/8/8/8/n7/R1N4K b - - 0 1',hands:{black:['man-trap'],white:['tournament','confabulation']}},[
 move('h8','g8'),card('man-trap','a2'),end,card('tournament',{own:'c1',opponent:'a2'}),end,move('g8','h8'),end]);
 const n=resolved(s,card('confabulation',[{from:'a1',to:'a2'}]));
 assert.equal(at(n,'a2'),undefined);
 for(const id of ['white-rook-a1','white-knight-c1'])assert.equal(n.pieces.find((p:any)=>p.id===id).zone,'captured');
});
test(3,'Heresy skips a Bishop immobilized by Fatal Attraction',()=>{
 const s=run({fen:'7k/8/8/3b4/3r4/8/1B6/7K b - - 0 1',hands:{black:['fatal-attraction'],white:['heresy']}},[
 move('h8','g8'),card('fatal-attraction','d4'),end,move('h1','g1')]);
 const n=resolved(s,card('heresy',[{from:'b2',to:'b3'}]));assert.equal(at(n,'b3')?.owner,'white');assert.equal(at(n,'d5')?.owner,'black');
});
test(4,'Madman may stop when only further landing is Forbidden City',()=>{
 const s=run({fen:'7k/8/8/3p4/8/1p6/P7/7K b - - 0 1',hands:{black:['forbidden-city'],white:['madman']}},[
 move('h8','g8'),card('forbidden-city','e6'),end]);
 const n=resolved(s,card('madman',[{from:'a2',to:'c4'}]));assert.equal(at(n,'c4')?.originalRole,'pawn');
});
test(5,'Rebirth uses a promoted Knight home square',()=>{
 const s=run({fen:'7k/8/8/8/8/8/1p6/7K b - - 0 1',hands:{white:['rebirth']}},[
 move('b2','b1',{promotion:'knight'}),end,move('h1','g1')]);
 const n=resolved(s,card('rebirth',[{from:'b1',to:'g8'}]));assert.equal(at(n,'g8')?.role,'knight');
 assert.equal(applyAction(s,card('rebirth',[{from:'b1',to:'b7'}])).ok,false);
});
test(6,'Ineligible Earthquake does not allocate hundreds of MiB for Plots',()=>{
 const s=createGameState({fen:'4k3/8/P6p/P6p/P6p/P6p/P6p/3K4 w - - 0 1',hands:{white:['plots-within-plots','earthquake']}});
 const heap=process.memoryUsage().heapUsed,start=performance.now();resolved(s,card('plots-within-plots'));
 const ms=performance.now()-start,delta=process.memoryUsage().heapUsed-heap;console.log(JSON.stringify({id:6,ms,heapDeltaMiB:delta/1048576}));
 assert.ok(delta<128*1048576,'ineligible card target allocation exceeded 128 MiB');
});
test(7,'Sparse Heresy target returns a rejection without throwing',()=>{
 const s=createGameState({fen:'7k/8/8/8/8/8/1B6/7K w - - 0 1',phase:'afterMove',moveMade:true,hands:{white:['heresy']}});
 const target=Array(2);target[1]={from:'b2',to:'b3'};let result:any;
 assert.doesNotThrow(()=>{result=applyAction(s,card('heresy',target));});assert.equal(result.ok,false);assert.equal(result.error.code,'INVALID_TARGET');
});
test(8,'Reduced Doomsayer mate adjudicates within a five-second audit budget',()=>{
 const s=run({fen:'r3r1k1/P1n5/1p6/1n1PQP2/pP1p4/2P3PR/BB1N4/R5NK w - - 0 1',hands:{white:['coup','doomsayer','merciless','abduction','man-trap']},decks:{white:['masquerade','doppelganger']}},[
 move('e5','d6'),card('coup','f5'),end,move('g8','g7'),end,move('d6','d7'),card('doomsayer'),{type:'declineDoomsayer',player:'black'},end,move('g7','f6')]);
 const start=performance.now(),n=step(s,end),ms=performance.now()-start;console.log(JSON.stringify({id:8,ms}));
 assert.deepEqual(n.outcome,{winner:'black',reason:'checkmate'});assert.ok(ms<5000,`adjudication took ${ms} ms`);
});
test(9,'Peace Talks cannot suspend the sole surviving royal indirectly',()=>{
 const s=run({fen:'k6P/8/8/8/7B/8/6P1/6rK w - - 0 1',hands:{white:['coup','earthquake'],black:['peace-talks']}},[
 move('g2','g3'),card('coup','h8'),end,move('g1','h1'),end,move('g3','g4'),card('earthquake',{direction:'clockwise',promotions:[]}),end,move('a8','b7')]);
 const r=applyAction(s,card('peace-talks',{effectId:'white-hand-1-earthquake',promotions:[{square:'h8',role:'rook'}]}));
 assert.ok(r.state.pieces.some((p:any)=>p.owner==='white'&&p.royal&&p.zone!=='captured'&&p.zone!=='dead'));
});
test(10,'Riposte forfeiture plus expiring Shield declares checkmate',()=>{
 const s=run({fen:'6k1/8/8/8/8/2p5/8/KN5R b - - 0 1',hands:{black:['mystic-shield','riposte']}},[
 move('g8','h8'),card('mystic-shield','h8'),end,move('b1','c3'),card('riposte'),end]);
 assert.deepEqual(s.outcome,{winner:'white',reason:'checkmate'});
});
test(11,'Check detection sees a restored royal inside a composite',()=>{
 const s=run({fen:'k5r1/8/8/8/8/8/PP6/6NK w - - 0 1',hands:{white:['coup','confabulation'],black:['earthquake']}},[
 move('b2','b3'),card('coup','a2'),end,move('a8','b8'),end,card('confabulation',[{from:'h1',to:'g1'}]),end,move('b8','c8'),card('earthquake',{direction:'clockwise',promotions:[{square:'a2',role:'rook'}]})]);
 assert.equal(isKingInCheck(s,'white'),true);
});
test(12,'A second Coup does not neutralize the previous Prince',()=>{
 const s=run({fen:'7k/8/8/8/8/8/PPP5/7K b - - 0 1',hands:{black:['neutrality'],white:['coup','coup']}},[
 move('h8','g8'),card('neutrality','a2'),end,move('b2','b3'),card('coup','a2'),end,move('g8','h8'),end,move('b3','b4'),card('coup','c2'),end]);
 assert.equal(at(s,'a2')?.neutral,false);assert.equal(applyAction(s,move('a2','a3')).ok,false);
});
test(13,'Last card expenditure resolves stalemate',()=>{
 const s=run({fen:'k7/8/p7/P1Q5/2K5/8/8/8 w - - 0 1',hands:{black:['pacifism','passing-in-the-night']}},[
 move('c5','b6'),end,card('pacifism','a6')]);assert.equal(s.outcome?.reason,'stalemate');
});
test(14,'Riposte cannot restore fulfilled Challenge to conceal self-check',()=>{
 const s=run({fen:'1R6/8/1k6/5p2/3N4/8/8/7K b - - 0 1',hands:{black:['challenge','riposte']}},[
 move('b6','b7'),card('challenge','d4'),end,move('d4','f5')]);
 assert.equal(isKingInCheck(s,'black'),true);const n=step(s,card('riposte'));
 assert.equal(n.history.at(-1)?.type,'cardFizzled');assert.equal(isKingInCheck(n,'black'),true);
});
test(15,'Plots retains its second escape after Fanatic fizzles',()=>{
 const s=run({fen:'7k/p7/5KQ1/8/8/8/8/8 w - - 0 1',hands:{black:['plots-within-plots','fanatic','under-elf-hill']}},[
 move('g6','g7'),end,card('plots-within-plots'),card('fanatic','a7')]);
 assert.equal(s.outcome,null);const n=resolved(s,card('under-elf-hill'));assert.equal(n.pieces.find((p:any)=>p.owner==='black'&&p.royal).zone,'away');
});
test(16,'Pre-merge Curse limits either movement component',()=>{
 const s=run({fen:'7k/8/8/8/8/2B5/1R6/7K b - - 0 1',hands:{black:['curse'],white:['confabulation']}},[
 move('h8','g8'),card('curse','c3'),end,card('confabulation',[{from:'c3',to:'b2'}]),end,move('g8','f8'),end]);
 assert.equal(applyAction(s,move('b2','b6')).ok,false);assert.equal(applyAction(s,move('b2','b4')).ok,true);
});
test(17,'Replacement cards may preserve an already-existing mate',()=>{
 for(const [id,target,to] of [
 ['fanatic','b2','b5'],['onslaught',[{from:'b2',to:'b3'}],'b3'],['guardian',[{from:'b2',to:'b3'}],'b3'],['forced-march',[{from:'b2',to:'c2'}],'c2']
 ] as const){
 const s=run({fen:'6k1/8/5K1R/5N2/8/B7/1P6/8 w - - 0 1',hands:{white:['plots-within-plots','confabulation',id],black:['under-elf-hill']}},[
 card('plots-within-plots'),card('confabulation',[{from:'f5',to:'h6'}])]);
 const n=resolved(s,card(id,target));assert.equal(at(n,to)?.originalRole,'pawn');
 }
});
test(18,'Heresy resolves first-phase trap before second-phase occupancy',()=>{
 const s=run({fen:'8/8/7k/8/8/1PB5/1b6/7K w - - 0 1',hands:{white:['man-trap','heresy']}},[
 move('h1','g1'),card('man-trap','b3'),end,move('h6','g6'),end,move('b3','b4')]);
 const n=resolved(s,card('heresy',[{from:'b2',to:'b3'},{from:'c3',to:'b3'}]));
 assert.equal(at(n,'b3')?.owner,'white');assert.equal(n.pieces.find((p:any)=>p.id==='black-bishop-b2').zone,'captured');
});
test(19,'Finding 11 follow-up: royal escape cards recognize a hidden component',()=>{
 for(const [id,target] of [['hidden-passage',[{from:'g1',to:'f1'}]],['under-elf-hill',undefined],['man-of-straw',{king:'g1',pawn:'b3'}]] as const){
 const s=run({fen:'k5r1/8/8/8/8/8/PP6/6NK w - - 0 1',hands:{white:['coup','confabulation',id],black:['earthquake']}},[
 move('b2','b3'),card('coup','a2'),end,move('a8','b8'),end,card('confabulation',[{from:'h1',to:'g1'}]),end,move('b8','c8'),card('earthquake',{direction:'clockwise',promotions:[{square:'a2',role:'rook'}]}),end]);
 resolved(s,card(id,target));
 }
});
test(20,'Finding 11 follow-up: composite Hidden Passage prevents false checkmate',()=>{
 const s=run({fen:'k5rr/8/8/8/8/5P2/PP2PP2/5RNK w - - 0 1',hands:{white:['coup','confabulation','hidden-passage'],black:['plots-within-plots','mystic-shield','earthquake']}},[
 move('b2','b3'),card('coup','a2'),end,move('a8','b8'),end,card('confabulation',[{from:'h1',to:'g1'}]),end,
 move('h8','h1'),card('plots-within-plots'),card('mystic-shield','h1'),card('earthquake',{direction:'clockwise',promotions:[{square:'a2',role:'rook'}]}),end]);
 assert.equal(s.outcome,null);resolved(s,card('hidden-passage',[{from:'g1',to:'c4'}]));
});
function copiedToll(withActual=false){return run({fen:'1r5k/6p1/8/8/8/8/7P/R6K w - - 0 1',hands:{white:withActual?['haunting-memories','toll']:['haunting-memories'],black:['toll']}},[
 move('a1','a5'),card('toll','h2'),end,move('b8','b4')]);}
test(21,'Finding 19: copied Toll permits declining payment without an actual Toll',()=>{
 const n=resolved(copiedToll(),card('haunting-memories'));assert.equal(at(n,'b8')?.role,'rook');assert.equal(at(n,'b4'),undefined);
});
test(22,'Finding 19: copied Toll spends the selected Haunting Memories',()=>{
 const n=resolved(copiedToll(true),card('haunting-memories'));
 assert.ok(n.players.white.hand.some((c:any)=>c.id==='white-hand-1-toll'));
 assert.ok(!n.players.white.hand.some((c:any)=>c.id==='white-hand-0-haunting-memories'));
 assert.ok(n.players.white.discard.some((c:any)=>c.id==='white-hand-0-haunting-memories'));
});
test(23,'Finding 3 follow-up: first-phase magnet movement frees the second Bishop',()=>{
 const s=run({fen:'7k/8/8/2bB4/8/8/8/7K b - - 0 1',hands:{black:['fatal-attraction'],white:['heresy']}},[
 move('h8','h7'),card('fatal-attraction','c5'),end,move('h1','h2')]);
 const n=resolved(s,card('heresy',[{from:'c5',to:'b5'},{from:'d5',to:'d4'}]));assert.equal(at(n,'d4')?.owner,'white');
});
test(24,'Finding 14 follow-up: Riposte does not restore completed Panic',()=>{
 const s=run({fen:'7k/8/8/8/8/2p5/8/KN6 b - - 0 1',hands:{black:['panic','riposte']}},[
 move('h8','g8'),card('panic'),end,move('b1','c3'),card('riposte'),end,end]);
 assert.equal(s.effects.some((e:any)=>e.type==='panic'),false);assert.equal(applyAction(s,{type:'panicTimeout'}).ok,false);
});
test(25,'Finding 14 follow-up: Bog does not restore completed Panic',()=>{
 const s=run({fen:'7k/8/8/p7/8/8/8/R6K b - - 0 1',hands:{black:['panic','bog']}},[
 move('h8','g8'),card('panic'),end,move('a1','a5'),card('bog'),end,move('g8','h8'),end]);
 assert.equal(s.effects.some((e:any)=>e.type==='panic'),false);assert.equal(applyAction(s,{type:'panicTimeout'}).ok,false);
});
test(26,'Finding 20: Haunting Memories reacts as Hostage after an ordinary capture',()=>{
 const s=run({fen:'r6k/6p1/8/8/8/2p5/P6P/1N5K w - - 0 1',hands:{white:['haunting-memories','hostage'],black:['hostage']}},[
 move('b1','c3'),card('hostage',{pieceId:'black-pawn-c3',pawn:'g7'}),end,move('a8','a2')]);
 const n=resolved(s,card('haunting-memories',{pieceId:'white-pawn-a2',pawn:'h2'}));assert.equal(n.pieces.find((p:any)=>p.id==='white-pawn-a2').square,'h2');
});
test(27,'Finding 21: Toll has no effect against a player without Pawns',()=>{
 const s=run({fen:'7k/8/8/8/8/8/8/R6K w - - 0 1',hands:{black:['toll']}},[move('a1','a5')]);
 const n=step(s,card('toll'));assert.equal(at(n,'a5')?.role,'rook');assert.equal(n.players.black.hand.length,0);
});
test(28,'Finding 22: copied Panic preserves the same Toll response as literal Panic',()=>{
 const s=run({fen:'1r5k/6p1/8/8/8/8/8/7K w - - 0 1',hands:{white:['panic','toll'],black:['haunting-memories','panic']}},[
 move('h1','g1'),card('panic'),end,move('b8','b4'),card('haunting-memories')]);
 const n=resolved(s,card('toll','g7'));assert.equal(n.pieces.find((p:any)=>p.id==='black-pawn-g7').zone,'captured');
});
test(29,'Finding 6: Earthquake target query after Plots stays within five seconds',()=>{
 const s=run({fen:'4k3/8/P6p/P6p/P6p/P6p/8/3K4 w - - 0 1',hands:{white:['earthquake','plots-within-plots']}},[move('d1','d2'),card('plots-within-plots')]);
 const start=performance.now(),targets=cardPlayTargets(s,'earthquake'),ms=performance.now()-start;
 assert.equal(targets.length,65537);assert.ok(ms<5000,`Earthquake query took ${ms} ms`);
});
test(30,'Finding 23: Challenge suppresses the neutral attacker for its controller',()=>{
 let s=run({fen:'r6k/8/8/8/8/8/1P6/3K4 w - - 0 1',hands:{white:['neutrality'],black:['challenge']}},[move('d1','e1'),card('neutrality','a8'),end]);
 s=step(s,move('h8','g8'));s=resolved(s,card('challenge','b2'));
 assert.equal(isKingInCheck(s,'black'),false);assert.equal(step(s,end).turn.color,'white');
});
test(31,'Finding 24: a frozen en-passant attacker cannot check a royal Pawn',()=>{
 const s=run({fen:'7k/8/8/2n5/2p5/8/1P6/7K w - - 0 1',hands:{white:['coup'],black:['fatal-attraction']}},[
 move('h1','g1'),card('coup','b2'),end,move('h8','g8'),card('fatal-attraction','c5'),end]);
 const n=step(s,move('b2','b4'));assert.equal(isKingInCheck(n,'white'),false);
});
test(32,'Finding 24: Challenge can remove an en-passant threat to the royal Pawn',()=>{
 let s=run({fen:'7k/8/8/2n5/2p5/8/1P6/7K w - - 0 1',hands:{white:['coup','challenge']}},[
 move('h1','g1'),card('coup','b2'),end,move('h8','g8'),end]);
 s=step(s,move('b2','b4'));s=resolved(s,card('challenge','c5'));assert.equal(isKingInCheck(s,'white'),false);
});
test(33,'Finding 23: the opponent Challenge cannot block our neutral Rook Merciless',()=>{
 const s=run({fen:'r6k/8/8/2n5/8/8/8/3K4 w - - 0 1',hands:{white:['neutrality','plots-within-plots','challenge','merciless']}},[
 move('d1','e1'),card('neutrality','a8'),end,move('h8','g7'),end,move('a8','a6'),card('plots-within-plots'),card('challenge','c5')]);
 const n=resolved(s,card('merciless',[{from:'a6',to:'a5'}]));assert.equal(at(n,'a5')?.id,'black-rook-a8');
});
test(34,'Finding 25: list the Prince quiet alternative when en passant is unsafe',()=>{
 const s=run({fen:'7k/3p4/8/rPP3P1/8/8/8/7K w - - 0 1',hands:{white:['coup','coup']}},[
 move('h1','g1'),card('coup','c5'),end,move('a5','b5'),end,move('g1','f1'),card('coup','g5'),end,move('d7','d5'),end]);
 assert.equal(applyAction(s,move('c5','d6',{enPassant:true})).ok,false);
 const n=step(s,move('c5','d6',{enPassant:false}));assert.equal(at(n,'d5')?.id,'black-pawn-d7');
 assert.ok(legalDests(s).get('c5')?.includes('d6'),'legal quiet destination omitted');
});
for(const [id,to,allowed] of [[35,'d4',false],[36,'f2',true]] as const)test(id,`Finding 26: Doppelganger uses saved opposing Knight for ${to}`,()=>{
 const s=run({fen:'1n5k/8/8/8/8/8/8/R2B3K b - - 0 1',hands:{white:['plots-within-plots','dubbing','doppelganger']}},[
 move('b8','c6'),end,card('plots-within-plots'),card('dubbing',[{from:'a1',to:'b3'}])]);
 const r=applyAction(s,card('doppelganger',[{from:'d1',to}]));assert.equal(r.ok,allowed);
 if(allowed)assert.equal(r.state.history.at(-1)?.type,'cardPlayed');
});
test(37,'Finding 26: passive Plots extra preserves Doppelganger opponent trigger',()=>{
 const s=run({fen:'1n5k/8/8/8/8/8/8/R2B3K b - - 0 1',hands:{white:['plots-within-plots','pacifism','doppelganger']}},[
 move('b8','c6'),end,card('plots-within-plots'),card('pacifism','a1')]);
 resolved(s,card('doppelganger',[{from:'d1',to:'f2'}]));
});
test(38,'Finding 26: opposing Panic timeout cannot make Doppelganger copy our Rook',()=>{
 const s=run({fen:'1n5k/8/8/8/8/8/8/R2B3K b - - 0 1',hands:{white:['panic','doppelganger']}},[
 move('b8','c6'),end,move('a1','a2'),card('panic'),end,{type:'panicTimeout'}]);
 assert.equal(applyAction(s,card('doppelganger',[{from:'d1',to:'d4'}])).ok,false);
});
test(39,'Finding 27: a later Plots resurrection returns an ordinary Pawn',()=>{
 const s=run({fen:'7k/8/8/3p4/8/8/8/3R3K b - - 0 1',hands:{black:['crab','plots-within-plots','dubbing','resurrection']}},[
 move('h8','g8'),card('crab','d5'),end,move('d1','d5'),end,card('plots-within-plots'),card('dubbing',[{from:'g8',to:'e7'}])]);
 const n=resolved(s,card('resurrection',{pieceId:'black-pawn-d5',to:'d7'}));
 assert.equal(n.effects.some((e:any)=>e.type==='crab'&&e.pieceId==='black-pawn-d5'),false,'late rescue retains Crab powers');
});
const selected=Number(process.argv[2]??0);let failed=0;
for(const t of tests.filter(t=>!selected||t.id===selected)){
 const start=performance.now();try{t.run();console.log(JSON.stringify({id:t.id,name:t.name,status:'PASS',ms:performance.now()-start}));}
 catch(e){failed++;console.log(JSON.stringify({id:t.id,name:t.name,status:'FAIL',error:String(e),ms:performance.now()-start}));}
}
process.exitCode=failed?1:0;
```


## Original audit completion record

Completed on 12 September 2026 at 15:18 UTC / 17:18 Europe/Prague. The original recorded window from 11 September 22:55:24 UTC through 12 September 07:48:35 UTC, plus the resumed window from 14:11:11 through 15:18:00 UTC, totals ten hours; the interruption between those windows is excluded. This is elapsed audit-session time, not ten hours of uninterrupted CPU execution.

The final verification ran all 39 executable groups on both recorded revisions. All audit agents finished, and 228 task-owned temporary entries, including harnesses, traces, ledgers, and the isolated baseline copy, were removed after their evidence was preserved here. A final repository check showed only this Markdown file modified and the current engine revision unchanged. No production or test source was edited by this audit, no bugs were fixed, and no UI tests were run. The two rule-sensitive observations remain uncounted. This report is the sole deliverable.

## Authorized fix follow-up — 12.09.2026

After the audit, the user authorized agents to fix the bugs, one bug per agent. The 16 families already resolved before this phase were left intact. All 11 remaining families were handled separately, with fresh regression-test, test-blind implementation, and engine-only audit agents. The parent verified each red regression gate and committed tests alone, then verified targeted tests, the full engine suite, and typecheck before committing production alone. No UI tests were run.

Final engine revision: `c5ed7f6a9d7d83b8b38583ad4bbd225e7cfc9c60`. Fix verification completed on 12 September 2026 at 17:24 UTC / 19:24 Europe/Prague. Historical failures above are retained as evidence, rather than rewritten as present behavior.

| Finding | Corrected behavior | Regression/test commits | Production commit | Full engine tests passed | Final independent audit |
| --- | --- | --- | --- | ---: | --- |
| 26 | Doppelganger retains the actual opposing mover through Plots and forfeited turns, including neutral control. | `15b4a50`, `247c3c6`, `6877ad5`, `a66add0` | `1f3dcd5` | 6,338 | 13 probes, 0 findings, 140 ms |
| 6 | Plots avoids repeatedly validating Earthquake targets already present in the result. The 65,537-target query fell from approximately 8.35 s to 0.17 s on this host. | `0a241fb` | `6a6ac2a` | 6,348 | 13 probes, 0 findings, 284 ms |
| 21 | Toll spends the card without canceling the move when the mover has no Pawns. | `a684ec0` | `f54a4a2` | 6,358 | 13 probes, 0 findings, 131 ms |
| 27 | A late Plots rescue expires the captured Crab marker before returning an ordinary Pawn. | `092562e` | `c97d692` | 6,368 | 13 probes, 0 findings, 146 ms |
| 23 | Challenge uses the neutral piece's actual controller for attacks and moves. | `0a7cca6` | `88cbe93` | 6,378 | 13 probes, 0 findings, 151 ms |
| 25 | The legal-move query lists a safe quiet Prince move even when the en-passant alternative is unsafe. | `0c394fb` | `3aa8f97` | 6,388 | 13 probes, 0 findings, 145 ms |
| 19 | Copied Toll restores the canceled turn and spends the selected physical Haunting Memories card. | `61d766e`, `6bb66ad` | `cfb07ca` | 6,398 | 13 probes, 0 findings, 141 ms |
| 20 | Haunting Memories can copy Hostage during an ordinary-capture response. | `1c22cdd` | `1e01930` | 6,408 | 13 probes, 0 findings, 144 ms |
| 22 | Copied Panic preserves Toll's preceding frontier-crossing response, including payment and refusal. | `0d46fd5` | `07844db` | 6,418 | 13 probes, 0 findings, 145 ms |
| 11 | Hidden Passage, Under Elf Hill, and Man of Straw recognize a royal component inside a composite; valid escapes prevent premature checkmate. | `6f2794b` | `00bc61b` | 6,428 | 13 probes, 0 findings, 153 ms |
| 24 | A movement restriction or Challenge suppresses a forbidden en-passant threat to a royal Pawn. | `c56e851` | `c5ed7f6` | 6,438 | 13 probes, 0 findings, 144 ms |

Each final fresh audit ran 6 directed probes, 4 seeded randomized probes, 1 multi-card probe, and 2 adversarial groups: 143 probes across the 11 fixes, with zero findings. The parent supplied and ran a nonempty validated scaffold, checked execution and file changes at the phase checkpoints, verified the final sentinel and counts, and verified deletion of the audit agent's harness. Invalid harness attempts were discarded and replaced; they were neither counted as engine bugs nor accepted as passing audits. The composite-King audit also verified Under Elf Hill's complete departure/return cycle and the return-turn movement restriction.

Doppelganger's new optional replay metadata uses digest version 3; versions 1 and 2 retain compatibility by excluding only the new metadata keys. Copied Toll also adds a needed turn checkpoint. Campaign iteration 174 therefore required six expected snapshot hashes to change. A separate 120-state comparison against the pre-fix engine verified that only `turnCheckpoint` differed, and all 120 independent replay oracles passed before a fresh test agent updated those six hashes. These test changes were committed separately from production.

Final validation: all 6,438 engine tests passed in 114.911 s, with no failures, skips, or cancellations; `npm run typecheck` passed. All 39 executable reproduction groups embedded above passed against the final engine, including the 16 previously resolved families. The final Earthquake follow-up measured 184 ms during that run. Performance figures are measurements on this host, not universal runtime guarantees.

Re-run the persistent engine checks from the repository root:

```sh
node --import tsx --test --test-concurrency=4 src/game/cards/*.test.ts
npm run typecheck
```

The confirmed reproductions are resolved; this bounded verification does not claim exhaustive correctness across every possible card interaction. The two rule-sensitive observations remain uncounted and unchanged. After preserving the results here, the parent removed the fix phase's 25 remaining task-owned temporary entries, including the isolated baseline and verification ledger. This file remains the single audit report; code and regression tests are the separately authorized fix deliverables.
