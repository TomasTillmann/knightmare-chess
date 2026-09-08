import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, PieceState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Independently reviewed in order against rules §§8–14, 16, 18–22 and cards.md.
// Coordinates remain fixed after Earthquake: White advances right, Black left.
const rationales = `
1. e2-e3 is a clear single Pawn advance; e1 remains screened.
2. After-move Fortification retains its card at adjacent d7/e7; occupied endpoints are allowed.
3. White ends safely; Black receives a fresh allowance, with the wall retained.
4. h7-h6 is a clear Black Pawn advance, nowhere near the wall.
5. Fireball follows that noncapture: h6 and adjacent g7 are the only blast victims; both Kings survive.
6. Black ends with both blasted Pawns captured and White to act.
7. g1-f3 is an unobstructed Knight jump; the White King stays safe.
8. Clockwise Earthquake promotes Black a7 to Bishop first and White h2 to Knight; fixed wall stays d7/e7.
9. Black begins with leftward Pawn advance and the two permanent promotions retained.
10. Promoted a7 Bishop reaches d4 through empty b6/c5; e3 blocks its line toward White.
11. Black ends with its King screened and the Bishop on d4.
12. e1-e2 is a safe adjacent King move; d4 Bishop attacks e3, not e2; White castling expires.
13. White ends safely at e2; no additional draw is due.
14. h8-h2 traverses empty h7/h6/h5/h4/h3 and captures the promoted Knight; g2 screens White King.
15. Black ends; its moved h8 Rook loses its castling right.
16. f3-d4 Knight captures the promoted Black Bishop while e3 still shields e2.
17. White ends with the captured promoted identity retained off board.
18. a8-a3 slides through vacant a7/a6/a5/a4; Black loses its remaining Rook castling right.
19. Black ends; a3 Rook attacks e3 through b3/c3/d3, not the King at e2.
20. d1-e1 Queen moves one square into the King's vacated square, keeping e2 safe.
21. White ends and leaves all hands unchanged.
22. Black b7-a7 is a leftward ordinary Pawn move onto its rotated last rank; Bishop promotion is mandatory.
23. Black ends with the new Bishop on a7 and Pawn clock reset.
24. d4-f3 is a quiet Knight jump; no blocking wall or new King attack occurs.
25. White ends with f3 Knight screening the h-file Rook's horizontal approach.
26. h2-h3 Rook moves one empty square; White f3 Knight blocks its rank-three ray.
27. Black ends with both Kings safe.
28. b1-a3 Knight captures Black's a8 Rook; a3 is outside the wall.
29. White ends with that physical Black Rook captured.
30. b8-a6 is a legal quiet Knight jump.
31. Black ends; a6 Knight attacks b4/c5/c7/b8, not e2.
32. h1-h2 is a clear quiet Rook move, with the King still shielded on e2.
33. White ends with no capture, draw, or effect expiry.
34. g8-f6 is a quiet Knight jump.
35. Black plays Panic after moving: White owes its next move within 15000ms; card is discarded and replaced.
36. White begins the timed turn with Panic still pending.
37. e2-d1 is a safe adjacent King move satisfying Panic; d1 is not attacked by either Knight or Bishop.
38. White ends after satisfying Panic; the temporary restriction has expired.
39. f6-h5 is a quiet Knight jump; d1 remains safe.
40. Black ends with no card accounting change.
41. h2-h1 Rook retreats into an empty square; no line to d1 opens.
42. White ends with its Rook on h1.
43. a6-b4 is a quiet Knight jump; c2 shields against later lines toward the King.
44. Black ends; b4 Knight does not attack d1.
45. f1-c4 Bishop slides through empty e2/d3; d1 remains protected.
46. White ends with its Bishop on c4 and unchanged hands.
47. f8-g7 Bishop moves to the square cleared by Fireball.
48. Black ends; g7 Bishop is blocked toward d1 by its h5-side surroundings and diagonal geometry.
49. c4-d5 Bishop makes a quiet diagonal step; d1 remains safe.
50. White ends and preserves the persistent wall and rotated orientation.
51. h3-f3 Rook crosses empty g3 and captures White's g1 Knight; e3 prevents a rank-three continuation.
52. After-move Man-Trap marks occupied friendly h5 under Black's Knight; its card stays active.
53. Black ends; the trap waits for an opposing arrival at fixed h5.
54. d5-e4 Bishop moves diagonally to an empty square.
55. Cathedral swaps owned Rook a1 and Bishop e4 without capture; e7 blocks the new Rook from Black's King.
56. White ends with Rook e4 and Bishop a1; the regular swap card is already discarded.
57. c8-a6 Bishop crosses empty b7 and reaches an empty square.
58. Mystic Shield selects the just-moved a6 Bishop and protects that physical identity for White's next turn.
59. Black ends; the Shield persists into the protected White turn.
60. h1-g1 Rook makes a quiet move, without attempting to capture the shielded Bishop.
61. White ends: Mystic Shield expires now, with board and clocks unchanged.
62. d8-a8 Queen slides through vacant c8/b8.
63. Black ends with its Queen on a8.
64. e4-d4 Rook shifts one empty square and leaves the King at d1 safe.
65. White ends; Man-Trap remains untouched on h5.
66. b4-d3 Knight jumps to an empty square; d3 attacks c1/e1/b2/f2, not d1.
67. After-move Truce forbids captures; neither King is in check, so its physical card remains active.
68. Black ends with Truce still active and White to act.
69. d4-d6 Rook crosses empty d5 without capture or wall crossing.
70. White ends with no King in check to terminate Truce.
71. Dubbing moves Pawn d7-f8 by a noncapturing Knight jump, consuming Black's move; no promotion or lasting Knight role.
72. Black ends with d7 Pawn still a Pawn on f8 and Truce retained.
73. d2-e2 is a single rotated White Pawn advance into an empty square.
74. White ends with no capture or new check, preserving Truce.
75. f3-f4 Rook quietly moves one square; Truce remains applicable.
76. Black ends with the Rook on f4 and White to act.
77. Masquerade lets non-Pawn Rook d6-b4 move Queen-style through empty c5 without capture; its move is consumed.
78. White ends; the Rook keeps its Rook identity and no temporary Queen power remains.
79. g7-h6 Bishop moves diagonally without capture.
80. Black ends; neither King is checked and Truce remains.
81. b4-d4 Rook crosses empty c4 and stops on an empty square.
82. White ends, still with no check ending Truce.
83. a8-c6 Queen crosses empty b7; c6-d5-e4-f3-g2 is blocked at g2 and does not check d1.
84. Black ends with Queen c6; Truce remains active.
85. d4-d8 Rook crosses empty d5/d6/d7; the d7/e7 wall is not crossed. Check against e8 ends Truce.
86. White ends with Black in check and a legal King capture available.
87. Forced March's sideways c7-c8/e7-e6 relocations cannot cure adjacent Rook check: restore both Pawns, spend card, retain move under §11.6.
88. e8-d8 King captures the checking Rook on a safe square; the failed card did not consume this needed answer.
89. White immediately plays Legacy on its captured non-Pawn, returning the physical Cathedral plus normal replacement Bog; board unchanged.
90. Black ends; White gets a fresh allowance despite its Legacy reaction and retains six cards.
91. a3-b1 Knight retreats by a legal jump without exposing d1.
92. White ends with both Kings safe and six White cards retained.
93. c6-c4 Queen crosses empty c5; c2 blocks its vertical line, so White King is safe.
94. Black ends; no reaction was played and no extra draw is due.
95. g1-h1 Rook shifts into an empty square.
96. White ends with the Rook on h1, still outside the h5 trap.
97. h6-g5 Bishop steps diagonally; its f4 ray is blocked by Black's own Rook.
98. Black ends with White to act safely.
99. c2-d2 is a rightward ordinary Pawn move; c4 Queen's opened file meets Bishop c1, not King d1.
100. White ends with d2 Pawn screening d1 vertically.
101. Onslaught selects Pawn f8-e8, one empty leftward square; no capture or promotion, and Black's move is consumed.
102. Black ends after the replacement move with all other Pawns unmoved.
103. h1-h5 Rook crosses h2/h3/h4 and captures the Knight, then Man-Trap captures the arriving Rook; both victims remain captured.
104. White ends; the triggered trap is discarded, with no resurrection or extra move.
105. c4-b4 Queen shifts one empty square; b2 blocks its downward ray.
106. Black ends without checking d1.
107. e1-g1 Queen crosses empty f1; d1 remains screened by d2.
108. White ends with its Queen on g1.
109. f4-f2 Rook crosses empty f3 and captures the physical f2 Pawn; e2 blocks its horizontal ray to the King.
110. Black ends after the capture with White to act.
111. e3-f3 is a clear rotated White Pawn advance, resetting the halfmove clock.
112. White ends with f3 Pawn and no en-passant right from a single step.
113. c7-b7 is a clear Black Pawn advance leftward; b-file is not yet its promotion rank.
114. Black ends with the unpromoted Pawn on b7.
115. b1-c3 Knight jumps quietly; it may be attacked by Queen b4 but leaves King d1 safe.
116. White ends the fiftieth regular move; Black starts move 27 with only Fortification and Earthquake retained.
`.trim().split('\n');

const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
function reaches(state: GameState, piece: PieceState, to: string, capture: boolean): boolean {
  assert.ok(piece.square);
  const [x, y] = xy(piece.square), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    return state.orientation === 0 ? dy === forward && ax === (capture ? 1 : 0)
      : dx === forward && ay === (capture ? 1 : 0);
  }
  if (piece.role === 'king') return Math.max(ax, ay) === 1;
  if (!(piece.role === 'bishop' ? ax === ay : piece.role === 'rook' ? dx === 0 || dy === 0 : ax === ay || dx === 0 || dy === 0)) return false;
  for (let i = 1; i <= Math.max(ax, ay); i++) {
    const next = String.fromCharCode(97 + x + Math.sign(dx) * i) + (y + Math.sign(dy) * i + 1);
    const previous = String.fromCharCode(97 + x + Math.sign(dx) * (i - 1)) + (y + Math.sign(dy) * (i - 1) + 1);
    if (new Set([previous, next]).has('d7') && new Set([previous, next]).has('e7')) return false;
    if (i < Math.max(ax, ay) && state.pieces.some(p => p.square === next)) return false;
  }
  return true;
}

test('iteration 062 independently reviewed deterministic trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/062.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860062);
  assert.equal(rationales.length, 116);
  assert.equal(trace.steps.length, rationales.length);
  rationales.forEach((r, i) => assert.ok(r.startsWith(`${i + 1}. `)));
  let state = createGameState(trace.initial);
  const has = (s: GameState, type: string) => s.effects.some(e => typeof e === 'object' && e !== null && 'type' in e && e.type === type);
  const at = (s: GameState, id: string) => s.pieces.find(p => p.id === id)!;
  for (const [i, { action }] of trace.steps.entries()) {
    const before = state, result = applyAction(before, action), n = i + 1;
    assert.ok(result.ok, rationales[i]);
    state = result.state;
    assert.equal(state.orientation, n < 8 ? 0 : 90);
    assert.deepEqual(state.enPassant, []);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const mover = before.pieces.find(p => p.square === action.from)!;
      const victim = before.pieces.find(p => p.square === action.to);
      assert.equal(mover.owner, before.turn.color);
      assert.ok(reaches(before, mover, action.to, !!victim), rationales[i]);
      if (victim) {
        assert.notEqual(victim.owner, mover.owner);
        assert.equal(at(state, victim.id).zone, 'captured');
        assert.ok(!has(before, 'truce'));
      }
      assert.equal(at(state, mover.id).square, n === 103 ? null : action.to);
      assert.equal(at(state, mover.id).role, action.promotion ?? mover.role);
      for (const p of before.pieces) if (p.id !== mover.id && p.id !== victim?.id) assert.deepEqual(at(state, p.id), p);
      const oldFen = before.fen.split(' '), newFen = state.fen.split(' ');
      assert.equal(Number(newFen[4]), mover.role === 'pawn' || victim ? 0 : Number(oldFen[4]) + 1);
      assert.equal(Number(newFen[5]), Number(oldFen[5]) + (mover.owner === 'black' ? 1 : 0));
      for (const color of ['white', 'black'] as const) {
        assert.deepEqual(state.players[color].hand, before.players[color].hand, 'ordinary moves do not draw');
        assert.deepEqual(state.players[color].deck, before.players[color].deck);
        const expired = color === 'black' && (n === 85 || n === 103)
          ? [{ id: n === 85 ? 'black-deck-1-truce' : 'black-hand-4-man-trap', cardId: n === 85 ? 'truce' : 'man-trap' }] : [];
        assert.deepEqual(state.players[color].discard, [...before.players[color].discard, ...expired]);
      }
    }
    if (action.type === 'endTurn') {
      assert.deepEqual(state.pieces, before.pieces);
      assert.equal(state.fen, before.fen);
      assert.deepEqual(state.players, before.players);
      assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 });
      assert.equal(state.turn.color, before.turn.color === 'white' ? 'black' : 'white');
    }
    if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black';
      const prior = before.players[owner], next = state.players[owner];
      assert.equal(before.turn.cardPlays[owner], 0);
      assert.equal(state.turn.cardPlays[owner], 1);
      assert.equal(next.deck.length, prior.deck.length - 1);
      assert.equal(next.hand.length, prior.hand.length + (n === 89 ? 1 : 0));
      assert.ok(next.hand.some(c => c.id === prior.deck[0]!.id));
      assert.ok(!next.hand.some(c => c.id === action.cardInstanceId));
      if (!CARD_CATALOG[action.cardId]!.continuing) assert.ok(next.discard.some(c => c.id === action.cardInstanceId));
      if ([2, 35, 52, 58, 67, 87, 89].includes(n)) assert.deepEqual(state.pieces, before.pieces);
    }
    assert.equal(has(state, 'panic'), n >= 35 && n < 37);
    assert.equal(has(state, 'mystic-shield'), n >= 58 && n < 61);
    assert.equal(has(state, 'truce'), n >= 67 && n < 85);
    assert.equal(has(state, 'man-trap'), n >= 52 && n < 103);
    if (!has(state, 'truce') && n !== 87) {
      const king = state.pieces.find(p => p.royal && p.owner === before.turn.color)!;
      assert.ok(king.square);
      for (const attacker of state.pieces.filter(p => p.square && p.owner !== king.owner)) {
        assert.ok(!reaches(state, attacker, king.square, true), `${n}: acting King safety versus ${attacker.id}`);
      }
    }
    if (n === 5) for (const id of ['black-pawn-g7', 'black-pawn-h7']) assert.equal(at(state, id).zone, 'captured');
    if (n === 8) {
      assert.equal(at(state, 'black-pawn-a7').role, 'bishop');
      assert.equal(at(state, 'white-pawn-h2').role, 'knight');
      assert.ok(at(state, 'black-pawn-a7').promoted && at(state, 'white-pawn-h2').promoted);
    }
    if (n === 55) {
      assert.equal(at(state, 'white-rook-a1').square, 'e4');
      assert.equal(at(state, 'white-bishop-f1').square, 'a1');
    }
    if (n === 71) assert.deepEqual([at(state, 'black-pawn-d7').square, at(state, 'black-pawn-d7').role, state.turn.moveMade], ['f8', 'pawn', true]);
    if (n === 77) assert.deepEqual([at(state, 'white-rook-a1').square, at(state, 'white-rook-a1').role, state.turn.moveMade], ['b4', 'rook', true]);
    if (n === 87) {
      assert.equal(state.fen, before.fen);
      assert.equal(state.turn.moveMade, false);
      assert.equal(state.turn.phase, 'beforeMove');
    }
    if (n === 89) {
      assert.ok(state.players.white.hand.some(c => c.id === 'white-hand-4-cathedral'));
      assert.ok(!state.players.white.discard.some(c => c.cardId === 'cathedral'));
    }
    if (n === 101) assert.deepEqual([at(state, 'black-pawn-d7').square, at(state, 'black-pawn-d7').role, state.turn.moveMade], ['e8', 'pawn', true]);
    if (n === 103) {
      assert.equal(at(state, 'white-rook-h1').zone, 'captured');
      assert.equal(at(state, 'black-knight-g8').zone, 'captured');
      assert.ok(state.players.black.discard.some(c => c.cardId === 'man-trap'));
    }
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 13);
  assert.equal(state.fen, '3kp3/bp2pp2/b7/6b1/1q6/2Nn1P2/PP1PPrP1/B1BK2Q1 b - - 1 27');
  assert.equal(replayTrace(trace).fen, state.fen);
});
