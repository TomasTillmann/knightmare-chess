import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Each numbered entry was reviewed in sequence against rules.md and cards.md.
const rationales = `
1. Ng1-f3 jumps to an empty square; e1 remains shielded.
2. White ends its completed move; Black receives fresh allowances.
3. g7-g5 crosses empty g6; record g6 en passant and reset the Pawn clock.
4. Panic follows Black's move, draws No Quarter, and limits White's next move to 15 seconds.
5. Black ends; Panic and g6 opportunity persist into White's turn.
6. d2-d4 crosses empty d3, replaces g6 with d3 en passant, and satisfies Panic.
7. White ends with no further card or draw.
8. e7-e6 moves into an empty square and expires d3 en passant.
9. Black ends; board and hands stay fixed.
10. g2-g4 crosses empty g3; g5 blocks further progress but not this move.
11. White ends, preserving g3 opportunity for Black.
12. b7-b5 crosses empty b6 and replaces the old opportunity with b6.
13. Black ends with b6 still available for the immediate reply.
14. Qd1-d3 passes empty d2; b6 opportunity expires.
15. White ends after the quiet Queen move.
16. f7-f6 advances a Pawn into empty f6, resetting the clock.
17. Black ends without changing the board.
18. Qd3xh7 follows empty e4,f5,g6 and captures the h7 Pawn, not a King.
19. White ends; h7 Pawn remains captured.
20. c7-c6 is a quiet Pawn step; g8 Knight still blocks Qh7's route to e8.
21. Black ends with no draw because no card or discard occurred.
22. Nf3-d2 jumps to the vacated Pawn square without exposing e1.
23. White ends; Black may choose a replacement card next.
24. Assassin moves Black's f6 Pawn diagonally to capture its own g5 Pawn; replacement move resets clock and draws Evangelists.
25. Black ends after the Assassin replacement move.
26. Qh7xh8 captures Black's original Rook and removes its kingside castling right.
27. White ends; g8 Knight blocks the Queen's horizontal attack on e8.
28. Nb8-a6 is an empty-square Knight jump.
29. Black ends after the Knight move.
30. c2-c3 advances into empty c3; no double-step opportunity.
31. White ends after the Pawn move.
32. Na6-b4 jumps to empty b4; the White King remains protected.
33. Heresy moves all four Bishops to empty orthogonally adjacent squares, White first: c1-d1,f1-g1,c8-b8,f8-f7; draws Truce.
34. Black ends; the relocated Bishops retain identities and new square colors.
35. Nd2-b3 jumps to an empty square.
36. White ends after the Knight move.
37. c6-c5 advances Black's Pawn one square into empty c5.
38. Black ends after the Pawn move.
39. Nb3-a5 is a legal Knight jump; no check reaches e1.
40. White ends after the Knight move.
41. Under Elf Hill removes e8 royal to away, consumes Black's move, revokes remaining Black castling, and draws Curse.
42. Black ends while its King remains absent until the next Black turn.
43. Nb1-a3 jumps normally while Black's King is away.
44. White ends and makes Black's mandatory King return due.
45. Return c8 is vacant and on an edge; Qh8 is blocked by g8, Na5 does not attack c8; return consumes no move or draw.
46. Bf7-h5 passes empty g6; returned King remains still and unable to threaten.
47. Siege swaps Black Nb4 and Ra8 after the move, preserving identities and clocks; draws Masquerade.
48. Black ends, clearing the returned King's movement restriction.
49. Onslaught simultaneously advances c3-c4 and h2-h3 into initially empty squares; no captures, promotions or en passant; draws Earthquake.
50. White ends its replacement Pawn move.
51. Na8-c7 jumps to empty c7 without exposing c8.
52. Black ends the Knight move.
53. Bd1-b3 passes empty c2 and remains the same physical Bishop.
54. Clockwise Earthquake changes forward to White east/Black west; Black a7 promotes Rook before White h3 promotes Queen; coordinates and clocks stay fixed.
55. White ends; continuing Earthquake and its promotions remain active.
56. Promoted Ra7-b7 makes a quiet horizontal Rook move.
57. Black ends; promotion remains permanent.
58. Qh8-g7 moves diagonally one empty square.
59. White ends; Black has no check to escape.
60. Ng8-e7 is a legal empty-square Knight jump.
61. Black ends with Earthquake unchanged.
62. Ra1-b1 moves horizontally one square and loses White's queenside castling right.
63. White ends after its original Rook move.
64. Promoted Rb7-b6 moves vertically one empty square.
65. Black ends; Doppelganger may copy this Rook next turn.
66. Doppelganger moves promoted Qh3-g3 with the last mover's Rook geometry, no capture, consuming White's move; draws Breakthrough.
67. White ends after the replacement move; the mover remains a Queen.
68. Ne7-d5 jumps to empty d5 without exposing c8.
69. Black ends the Knight move.
70. Masquerade moves Qg7-f6 quietly with Queen geometry; d8 blocks its diagonal toward c8; draws Resurrection.
71. White ends after the replacement move.
72. Nd5xf6 captures White's original Queen and resets the clock.
73. Black ends; original Queen remains captured.
74. Eastbound g4 Pawn captures Bishop h5 and promotes Rook on the rotated last rank.
75. White ends after capture and promotion.
76. Nf6-e8 jumps to an empty square.
77. Black ends with neither royal in check.
78. Ke1-d1 enters a safe adjacent square; d7 Pawn blocks the d-file Queen; all White castling ends.
79. White ends; clocks retain the completed King move.
80. Promoted Rb6-a6 moves to empty a6.
81. Curse legally marks opposing original Rh1 after Black's move, draws Blessing, and retains the continuing card.
82. Black ends; Curse remains bound to Rh1, not White's promoted Rook.
83. Promoted Rh5-h7 crosses empty h6; it is not the cursed physical Rook.
84. White ends the Rook move.
85. Promoted Ra6-a8 crosses vacant a7.
86. Black ends after its two-square Rook move.
87. Promoted Rh7-g7 moves horizontally into empty g7.
88. White ends the quiet move.
89. Qd8-f6 crosses empty e7; Black c8 remains safe.
90. Black ends after the diagonal Queen move.
91. Promoted Qg3-g4 moves one empty square vertically.
92. White ends; Black's Bishop swap is available before its next move.
93. Evangelists swaps Black Bb8 with White Bg1, preserving colors and identities without capture; neither King is checked; draws Hidden Passage.
94. Black ends after the replacement swap.
95. Na3-c2 jumps to an empty square and does not uncover an attack on d1.
96. White ends the Knight move.
97. Promoted Ra8-a6 crosses empty a7.
98. Black ends after the Rook move.
99. Promoted Qg4-h3 moves diagonally into empty h3.
100. White ends; no continuing effect changes.
101. Hidden Passage relocates Kc8-d6 to an empty safe square; Na5 attacks c6, not d6, and White's Queen is blocked on its diagonal; draws Anathema.
102. Black ends after the King replacement move.
103. Qh3-f3 passes empty g3; d6 is not on its open attack lines.
104. White ends the Queen move.
105. Qf6xg7 captures White's promoted Rook, keeping the captured Pawn identity and promotion.
106. Black ends; the captured promoted Rook stays captured.
107. Qf3-e4 moves diagonally into empty e4; d6 is not attacked.
108. White ends; no card played or drawn.
109. Qg7-f6 retreats diagonally to empty f6.
110. Black ends after the Queen move.
111. Qe4-e3 moves vertically into empty e3; d4 Pawn blocks its northwest diagonal.
112. White ends after the Queen move.
113. Masquerade moves Kd6-e7 with quiet Queen geometry; e6 Black Pawn blocks Qe3's file and White Bishop b3 is blocked by c4; draws Earthquake.
114. Black ends; King retains royal status and normal future movement.
115. Cursed Rh1xg1 captures Black Bishop with a permitted one-square move; Curse follows the Rook.
116. White ends after the capture.
117. Black g5-f5 Pawn advances west under Earthquake into empty f5, resetting the clock.
118. Anathema swaps opposing Bb8 and Rb1 after Black's move; neither is cursed; e8 Knight blocks Rb8 from reaching the King; draws Squaring the Circle.
119. Black ends after the swap; both pieces retain White ownership.
120. Nc2-e1 jumps to empty e1; d1 King remains protected.
121. White ends after its final reviewed move.
122. Promoted Ra6-a7 moves vertically to empty a7, completing regular move 50.
123. Black ends; White receives a fresh turn, Earthquake and Curse persist, and no further cards draw.
`.trim().split('\n');

const cardMoves: Record<number, [string, string | null][]> = {
  24: [['f6', 'g5']], 33: [['c1', 'd1'], ['f1', 'g1'], ['c8', 'b8'], ['f8', 'f7']],
  41: [['e8', null]], 47: [['b4', 'a8'], ['a8', 'b4']],
  49: [['c3', 'c4'], ['h2', 'h3']], 66: [['h3', 'g3']], 70: [['g7', 'f6']],
  93: [['b8', 'g1'], ['g1', 'b8']], 101: [['c8', 'd6']],
  113: [['d6', 'e7']], 118: [['b8', 'b1'], ['b1', 'b8']],
};

const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1];
function reaches(state: GameState, piece: PieceState, to: string, capture: boolean): boolean {
  assert.ok(piece.square);
  const [x, y] = xy(piece.square), [tx, ty] = xy(to);
  const dx = tx! - x!, dy = ty! - y!, ax = Math.abs(dx), ay = Math.abs(dy);
  if (!ax && !ay) return false;
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'king') return Math.max(ax, ay) === 1;
  const board = state.pieces.filter(p => p.zone === 'board');
  if (piece.role === 'pawn') {
    const sign = piece.owner === 'white' ? 1 : -1;
    const forward = state.orientation === 0 ? dy * sign : dx * sign;
    const side = state.orientation === 0 ? ax : ay;
    if (capture) return forward === 1 && side === 1;
    if (side || ![1, 2].includes(forward)) return false;
    const rank = state.orientation === 0 ? y! : x!;
    if (forward === 2 && !(piece.owner === 'white' ? rank <= 1 : rank >= 6)) return false;
  } else if (!(piece.role === 'queen' && (ax === ay || dx === 0 || dy === 0)
    || piece.role === 'rook' && (dx === 0 || dy === 0)
    || piece.role === 'bishop' && ax === ay)) return false;
  for (let n = 1; n < Math.max(ax, ay); n++) {
    const square = String.fromCharCode(97 + x! + Math.sign(dx) * n) + (y! + Math.sign(dy) * n + 1);
    if (board.some(p => p.square === square)) return false;
  }
  return true;
}

test('iteration 059 deterministic trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/059.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860059);
  assert.equal(rationales.length, 123);
  assert.equal(trace.steps.length, rationales.length);
  let state = createGameState(trace.initial);
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1, why = rationales[index]!;
    assert.ok(why.startsWith(`${step}. `));
    const before = state, expected = structuredClone(before.pieces);
    let moves = cardMoves[step] ?? [];
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const mover = before.pieces.find(p => p.square === action.from)!;
      const victim = before.pieces.find(p => p.square === action.to);
      assert.equal(mover.owner, before.turn.color, why);
      assert.ok(!victim || victim.owner !== mover.owner && !victim.royal, why);
      assert.ok(reaches(before, mover, action.to, !!victim), why);
      if (mover.id === 'white-rook-h1' && step > 81) {
        const [x, y] = xy(action.from), [tx, ty] = xy(action.to);
        assert.ok(Math.max(Math.abs(tx! - x!), Math.abs(ty! - y!)) <= 2, why);
      }
      moves = [[action.from, action.to]];
    }
    const movingIds = moves.map(([from]) => before.pieces.find(p => p.square === from)!.id);
    for (const [[, to], id] of moves.map((move, i) => [move, movingIds[i]!] as const)) {
      const mover = expected.find(p => p.id === id)!;
      const victim = expected.find(p => to && p.square === to && !movingIds.includes(p.id));
      if (victim) { victim.square = null; victim.zone = 'captured'; }
      mover.square = to as SquareName | null;
      mover.zone = to ? 'board' : 'away';
    }
    if (step === 45) {
      const king = expected.find(p => p.id === 'black-king-e8')!;
      king.square = 'c8'; king.zone = 'board';
    }
    for (const [id, role] of step === 54 ? [['black-pawn-a7', 'rook'], ['white-pawn-h2', 'queen']] as const
      : step === 74 ? [['white-pawn-g2', 'rook']] as const : []) {
      const piece = expected.find(p => p.id === id)!;
      piece.role = role; piece.promoted = true;
    }
    const result = applyAction(before, action);
    assert.ok(result.ok, why);
    state = result.state;
    const identities = (pieces: PieceState[]) => pieces.map(({ capturedAtPly: _, ...piece }) => piece);
    assert.deepEqual(identities(state.pieces), identities(expected), why);
    assert.equal(state.orientation, step >= 54 ? 90 : 0, why);
    const ep = step >= 3 && step <= 5 ? { target: 'g6', pawnId: 'black-pawn-g7' }
      : step >= 6 && step <= 7 ? { target: 'd3', pawnId: 'white-pawn-d2' }
      : step >= 10 && step <= 11 ? { target: 'g3', pawnId: 'white-pawn-g2' }
      : step >= 12 && step <= 13 ? { target: 'b6', pawnId: 'black-pawn-b7' } : undefined;
    assert.deepEqual(state.enPassant, ep ? [ep] : [], why);
    const clockBefore = before.fen.split(' '), clockAfter = state.fen.split(' ');
    const consumesMove = action.type === 'move' || action.type === 'playCard' && before.turn.phase === 'beforeMove';
    if (consumesMove) {
      const pawnMove = movingIds.some(id => before.pieces.find(p => p.id === id)!.role === 'pawn');
      const capture = expected.some(p => p.zone === 'captured' && before.pieces.find(old => old.id === p.id)!.zone === 'board');
      assert.equal(Number(clockAfter[4]), pawnMove || capture ? 0 : Number(clockBefore[4]) + 1, why);
      assert.equal(Number(clockAfter[5]), Number(clockBefore[5]) + Number(before.turn.color === 'black'), why);
      assert.equal(state.turn.phase, 'afterMove', why);
      assert.equal(state.turn.moveMade, true, why);
      assert.equal(clockAfter[1], before.turn.color === 'white' ? 'b' : 'w', why);
    } else assert.deepEqual(clockAfter.slice(4), clockBefore.slice(4), why);
    for (const color of ['white', 'black'] as const) {
      const king = state.pieces.find(p => p.owner === color && p.royal && p.zone === 'board');
      if (king) assert.ok(!state.pieces.some(p => p.owner !== color && p.zone === 'board'
        && reaches(state, p, king.square!, true)), `${why}: both Kings remain safe`);
      const old = before.players[color], next = state.players[color];
      if (action.type === 'playCard' && color === before.turn.color) {
        const card = old.hand.find(c => c.id === action.cardInstanceId)!;
        assert.ok(card, why);
        assert.ok(CARD_CATALOG[card.cardId]!.timing.includes(before.turn.phase), why);
        assert.deepEqual(next.hand, [...old.hand.filter(c => c.id !== card.id), old.deck[0]], why);
        assert.deepEqual(next.deck, old.deck.slice(1), why);
        assert.deepEqual(next.discard, CARD_CATALOG[card.cardId]!.continuing ? old.discard : [...old.discard, card], why);
        assert.equal(state.turn.cardPlays[color], 1, why);
      } else assert.deepEqual(next, old, why);
    }
    if (action.type === 'endTurn') {
      assert.equal(state.fen, before.fen, why);
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }, why);
    }
    if (step === 4 || step === 5) assert.deepEqual(state.effects, [{ type: 'panic', owner: 'black', player: 'white', durationMs: 15000 }], why);
    if (step === 6) assert.deepEqual(state.effects, [], why);
    if (step >= 54) assert.deepEqual(state.effects[0], {
      type: 'earthquake', owner: 'white', card: { id: 'white-deck-0-earthquake', cardId: 'earthquake' },
      direction: 'clockwise', target: { direction: 'clockwise', promotions: [{ square: 'a7', role: 'rook' }, { square: 'h3', role: 'queen' }] },
    }, why);
    assert.equal(state.effects.length, step === 4 || step === 5 ? 1 : step >= 81 ? 2 : step >= 54 ? 1 : 0, why);
    if (step >= 81) assert.deepEqual(state.effects[1], { type: 'curse', owner: 'black', card: { id: 'black-deck-3-curse', cardId: 'curse' }, pieceId: 'white-rook-h1' }, why);
    if (step === 45) assert.deepEqual(state.underElfHill, [{ pieceId: 'black-king-e8', player: 'black', returning: true, returned: true }], why);
    if (step === 48) assert.deepEqual(state.underElfHill, [], why);
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 14);
  assert.equal(state.fen, '1R2n3/r1npk3/4pq2/Npp2p2/1rPP4/1B2Q3/PP2PP2/1B1KN1R1 w - - 2 30');
  assert.equal(replayTrace(trace).fen, state.fen);
});
