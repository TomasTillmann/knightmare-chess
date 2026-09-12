import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, PieceState, SquareName } from '../types.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/055.json', import.meta.url), 'utf8')) as RandomTrace;

// Independently reviewed in order against rules §§8–13, 19.3, 20, 21, 22.4;
// cards.md and the catalog's printed timing/Continuing Effect metadata.
const rationales = `
1. a2-a3 advances White's pawn one empty square; e1 remains screened.
2. White ends its completed pawn move; Black receives its own allowances.
3. Passing in the Night simultaneously swaps b7/h2 and e7/g2 pawns; neither King is attacked, no promotion, Black's move consumed.
4. Black closes the replacement turn; White now owns the next move.
5. Nb1-c3 is an unobstructed knight jump to an empty square.
6. White closes the knight turn without spending or drawing a card.
7. a7-a6 advances Black's pawn one empty square.
8. Black ends its completed pawn move without changing its hand.
9. Ng1-f3 jumps to an empty square without exposing e1.
10. White ends its completed knight move.
11. h7-h5 crosses empty h6 and creates the h6 en-passant opportunity.
12. Black ends its turn, retaining that opportunity for White's next move.
13. The swapped white h-pawn captures Bc8 from b7 and promotes to Queen; d8 blocks its line to e8.
14. White closes the capture/promotion turn; Black's bishop remains captured.
15. g7-g6 is a one-square pawn move, with Black's King still sheltered.
16. After moving, Black's Anathema swaps opposing Bf1/Rh1 without capture or a path requirement; e1 stays safe.
17. Black ends its move-plus-card turn and resets allowances for White.
18. b2-b4 traverses empty b3, creates b3 en passant, and resets the pawn clock.
19. White closes its pawn turn, preserving b3 for the reply.
20. Ng8-f6 is a legal jump and expires the unused b3 opportunity.
21. Black hands the turn to White after its knight move.
22. Nc3-e4 jumps to an empty square with e1 still protected.
23. Holy Quest swaps opposing Bf8/Nf6 after White's move; Bf6 cannot attack e1 and Black is not mated.
24. White ends the knight-plus-swap turn with exactly one card spent.
25. c7-c5 crosses empty c6, creates c6 en passant, and leaves e8 safe.
26. Black ends the c-pawn turn with no additional draw.
27. Ne4-g3 jumps legally and expires c6 en passant.
28. White closes the completed knight move.
29. d7-d5 crosses empty d6 and creates the d6 opportunity; Qd8 still screens the King.
30. Black ends its d-pawn turn, retaining d6 for White's reply.
31. Ng3-e4 returns by a legal knight jump and expires d6.
32. White closes the completed knight turn.
33. Nf8-e6 jumps legally; moving the swapped knight does not change its identity.
34. Black closes its knight turn, with White next.
35. c2-c4 crosses empty c3, creates c3 en passant, and does not expose e1.
36. White ends its double-step turn with c3 available.
37. d5xc4 is an ordinary diagonal capture of the white c-pawn, not en passant; c3 expires.
38. Black closes its capture turn with the white c-pawn in the captured zone.
39. The swapped white g-pawn captures Qd8 from e7, promotes to Queen, and checks e8 along the rank.
40. White ends the checking move; Black receives its required escape turn.
41. Bf6xd8 crosses empty e7, captures the new Queen, and blocks Qc8's line to e8.
42. Black closes its successful check escape.
43. Qc8xb8 captures Black's knight; Bd8 still blocks the line to e8.
44. White ends its Queen capture turn.
45. Ke8-f8 enters an unattacked adjacent square behind Bd8 and loses Black's castling rights.
46. Black ends its King move with White next.
47. Annexation advances a3-a5 through empty a4, consumes White's move, and grants no en passant because a3 was not the starting square.
48. White closes Annexation's replacement turn without an extra ordinary move.
49. Black's swapped e-pawn captures Rf1 from g2 and promotes to Queen, checking Ke1; the captured rook's right disappears.
50. Black ends the checking promotion; White receives its escape turn.
51. e2-e3 cannot answer Qf1's check, so it is provisional under §11.6: after-move Fortification could wall e1-f1 and rescue the King.
52. Rebirth c5-d7 cannot cure Qf1-e1 check; spend/draw it, restore c5, rewind e3-e2, and restore White's move while keeping its card spent.
53. Ke1xf1 captures the undefended promoted Queen, escapes check, and revokes White's remaining castling right.
54. White closes its replacement escape move with Rebirth still spent.
55. Kf8-e7 enters an unattacked adjacent square; White's Queen on b8 does not attack e7.
56. Black ends its King move without restoring any castling right.
57. Ne4-g3 is a legal empty-square jump; Kf1 stays safe.
58. White ends its knight turn.
59. Bd8-c7 moves diagonally one square; opening the eighth rank does not attack Ke7.
60. Black ends its bishop move with White next.
61. Bh1-g2 moves one empty diagonal square, retaining the original f1 bishop's identity.
62. White closes its bishop turn without a draw.
63. Bc7xb8 captures the other promoted white Queen; Ke7 remains safe.
64. Black closes its bishop capture turn.
65. Bc1-b2 enters the square vacated by the b-pawn; Kf1 remains safe.
66. White closes its bishop turn with Black next.
67. Ne6-g7 jumps to an empty square without uncovering an attack on Ke7.
68. Black ends its knight move.
69. Nf3xh2 captures the swapped black b-pawn by a knight jump.
70. White plays continuing Doomsayer after the move; its physical card stays active and one replacement is drawn.
71. Black declines the immediate naming option; the effect remains and no piece is lost.
72. White ends its turn with Doomsayer still active.
73. Black uses Under Elf Hill instead of moving: Ke7 goes away, not captured, clock advances once, no en passant.
74. Black names Queen but has neither original nor promoted Queen on board; Doomsayer remains unresolved.
75. Black ends the replacement turn; its absent King is not yet due back on White's turn.
76. b4xc5 captures the black c-pawn normally while Black's King is away; Kf1 remains safe.
77. White ends its turn; Black's mandatory King return is now due before optional actions.
78. Black returns the same King on empty edge h4, unattacked by Ng3/Nh2/Bg2/Bb2; placement costs no move or card.
79. Rh8-h6 crosses empty h7; returned Kh4 stays stationary and restricted this turn.
80. Black names Pawn and loses its chosen c4 pawn to Doomsayer; capture resets the clock and consumes the active effect without another draw.
81. Black ends its turn; the returned King's movement restriction expires.
82. Bg2-h3 is a one-square diagonal move; being adjacent to Kh4 does not make a bishop move illegal.
83. White closes its bishop move.
84. Bb8xg3 crosses c7,d6,e5,f4, all empty, and captures White's knight; Kh4 stays safe.
85. Black ends the bishop capture turn.
86. Bb2-e5 crosses empty c3,d4; the diagonal toward g7 stops at Black's knight, not its King.
87. White ends its bishop move without spending a card.
88. Bg3xf2 captures White's f-pawn diagonally; it does not check the vertically adjacent Kf1.
89. Black closes the bishop capture turn.
90. Bh3-g4 moves one diagonal square; its rank adjacency to Kh4 does not give check.
91. White closes the bishop turn.
92. f7-f6 advances Black's pawn into an empty square and resets the clock.
93. Black ends its pawn move.
94. Qd1-c1 moves one empty rank square; Kf1 stays safe behind no newly opened attack.
95. White closes its Queen move.
96. Bf2-g1 is a legal empty diagonal move; adjacency on the first rank does not check Kf1.
97. Black closes its bishop move.
98. Qc1-e1 crosses empty d1 and stops before Kf1.
99. White ends its Queen move.
100. Bg1-f2 returns diagonally to an empty square without checking Kf1.
101. Black ends its bishop move, establishing Bishop as the latest opposing mover.
102. Doppelganger moves White's non-Pawn Bg4-f5 as the just-moved Bishop, without capture, consuming the replacement move.
103. White ends Doppelganger's replacement turn without an extra Regular Move.
104. Rh6-h8 crosses empty h7 and preserves Kh4's safety.
105. Black closes its rook move.
106. Qe1-b1 crosses empty d1,c1 and cannot expose Kf1 to a bishop on f2.
107. White closes its Queen move.
108. Ra8-g8 crosses empty b8,c8,d8,e8,f8, stopping before its own Rh8.
109. Black ends its rook move.
110. Ra1-a3 crosses empty a2 and stops below its own a5 pawn.
111. White ends its rook move.
112. Rg8-a8 traverses the same clear rank in reverse.
113. Black ends its rook move.
114. Ra3-a1 crosses empty a2; this is the fiftieth submitted Regular Move.
115. White closes the final move; Black has the next turn, no effects or pending choices remain.
`.trim().split('\n');

const physical = (pieces: PieceState[]) => pieces.map(({ capturedAtPly: _ply, capturedBy: _actor, ...piece }) => piece);
const at = (state: GameState, square: string) => state.pieces.find(p => p.zone === 'board' && p.square === square);

test('iteration 055: 115 independently reasoned actions and 50 move commands', () => {
  assert.equal(trace.seed, 860055);
  assert.equal(trace.steps.length, 115);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 8);
  let state = createGameState(trace.initial);
  const states = [state];
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1;
    const why = rationales[index]!;
    assert.ok(why.startsWith(`${step}. `));
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, why);
    state = result.state;
    const expected = structuredClone(before.pieces);
    const relocate = (from: string, to: SquareName) => {
      const piece = expected.find(p => p.square === from && p.zone === 'board');
      assert.ok(piece, why);
      piece.square = to;
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const mover = at(before, action.from)!;
      assert.ok(mover, why);
      assert.equal(mover.owner, before.turn.color, why);
      const victim = at(before, action.to);
      if (victim) {
        assert.notEqual(victim.owner, mover.owner, why);
        assert.equal(victim.royal, false, why);
        Object.assign(expected.find(p => p.id === victim.id)!, { square: null, zone: 'captured' });
      }
      const dx = action.to.charCodeAt(0) - action.from.charCodeAt(0);
      const dy = Number(action.to[1]) - Number(action.from[1]);
      const x = Math.abs(dx), y = Math.abs(dy);
      if (mover.role === 'knight') assert.equal(x * y, 2, why);
      else if (mover.role === 'king') assert.equal(Math.max(x, y), 1, why);
      else {
        if (mover.role === 'pawn') {
          const forward = mover.owner === 'white' ? 1 : -1;
          assert.ok(victim ? x === 1 && dy === forward : x === 0 && (dy === forward || dy === 2 * forward && ['2', '7'].includes(action.from[1]!)), why);
        } else assert.ok(mover.role === 'bishop' ? x === y : mover.role === 'rook' ? x === 0 || y === 0 : x === y || x === 0 || y === 0, why);
        for (let n = 1; n < Math.max(x, y); n++) {
          const square: string = String.fromCharCode(action.from.charCodeAt(0) + n * Math.sign(dx)) + (Number(action.from[1]) + n * Math.sign(dy));
          assert.equal(at(before, square), undefined, `${why} path ${square}`);
        }
      }
      const moved = expected.find(p => p.id === mover.id)!;
      moved.square = action.to as SquareName;
      if (action.promotion) {
        assert.equal(mover.role, 'pawn', why);
        assert.ok(action.to[1] === '1' || action.to[1] === '8', why);
        assert.equal(action.promotion, 'queen', why);
        moved.role = 'queen';
        moved.promoted = true;
      }
      const oldFen = before.fen.split(' '), fen = state.fen.split(' ');
      assert.equal(Number(fen[4]), mover.role === 'pawn' || victim ? 0 : Number(oldFen[4]) + 1, why);
      assert.equal(Number(fen[5]), Number(oldFen[5]) + (mover.owner === 'black' ? 1 : 0), why);
      assert.deepEqual(state.enPassant, mover.role === 'pawn' && y === 2 ? [{ target: action.from[0]! + (Number(action.from[1]) + dy / 2), pawnId: mover.id }] : [], why);
      assert.equal(state.turn.phase, 'afterMove', why);
      assert.equal(state.turn.moveMade, true, why);
      assert.equal(Boolean(state.pendingRescue), step === 51, why);
      if (step === 51) {
        const rescue = applyAction(state, { type: 'playCard', cardId: 'fortification', target: { from: 'e1', to: 'f1' } });
        assert.ok(rescue.ok, why);
        assert.equal(rescue.state.pendingRescue, null, why);
        assert.equal(isKingInCheck(rescue.state, 'white'), false, why);
        assert.equal(at(rescue.state, 'e3')?.id, mover.id, why);
        assert.ok(applyAction(rescue.state, { type: 'endTurn' }).ok, why);
      }
    } else if (action.type === 'playCard') {
      const owner = before.turn.color;
      const player = before.players[owner];
      const spent = player.hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(spent, why);
      assert.equal(before.turn.cardPlays[owner], 0, why);
      assert.equal(state.turn.cardPlays[owner], 1, why);
      assert.deepEqual(state.players[owner].hand, [...player.hand.filter(c => c.id !== spent.id), player.deck[0]], why);
      assert.deepEqual(state.players[owner].deck, player.deck.slice(1), why);
      assert.deepEqual(state.players[owner].discard, action.cardId === 'doomsayer' ? player.discard : [...player.discard, spent], why);
      const other = owner === 'white' ? 'black' : 'white';
      assert.deepEqual(state.players[other], before.players[other], why);
      if (step === 3) {
        for (const [id, square] of [['white-pawn-g2', 'e7'], ['white-pawn-h2', 'b7'], ['black-pawn-b7', 'h2'], ['black-pawn-e7', 'g2']] as const) expected.find(p => p.id === id)!.square = square;
        assert.equal(state.turn.moveMade, true, why);
      } else if (step === 16 || step === 23) {
        const [a, b] = step === 16 ? ['f1', 'h1'] : ['f8', 'f6'];
        expected.find(p => p.square === a)!.square = b as SquareName;
        expected.find(p => p.id === at(before, b!)!.id)!.square = a as SquareName;
        assert.deepEqual(state.fen.split(' ').slice(3), before.fen.split(' ').slice(3), why);
      } else if (step === 47) {
        assert.equal(at(before, 'a4'), undefined, why);
        assert.equal(at(before, 'a5'), undefined, why);
        relocate('a3', 'a5');
        assert.deepEqual(state.enPassant, [], why);
        assert.equal(state.turn.moveMade, true, why);
      } else if (step === 52) {
        expected.splice(0, expected.length, ...structuredClone(states[50]!.pieces));
        assert.equal(state.fen, states[50]!.fen, why);
        assert.equal(state.turn.moveMade, false, why);
        assert.equal(state.turn.phase, 'beforeMove', why);
        assert.equal(Boolean(state.pendingRescue), false, why);
      } else if (step === 70) {
        assert.equal(state.fen, before.fen, why);
        assert.deepEqual(state.effects, [{ type: 'doomsayer', owner: 'white', card: spent }], why);
      } else if (step === 73) {
        Object.assign(expected.find(p => p.id === 'black-king-e8')!, { square: null, zone: 'away' });
        assert.deepEqual(state.underElfHill, [{ pieceId: 'black-king-e8', player: 'black', returning: false }], why);
        assert.equal(state.turn.moveMade, true, why);
        assert.deepEqual(state.fen.split(' ').slice(4), ['1', '18'], why);
      } else if (step === 102) {
        assert.equal(at(before, 'f2')!.role, 'bishop', why);
        assert.equal(at(before, 'f5'), undefined, why);
        relocate('g4', 'f5');
        assert.equal(state.turn.moveMade, true, why);
        assert.deepEqual(state.fen.split(' ').slice(4), ['5', '24'], why);
      } else assert.fail(`Unreviewed card: ${why}`);
    } else if (action.type === 'endTurn') {
      assert.equal(before.turn.moveMade, true, why);
      assert.equal(state.fen, before.fen, why);
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }, why);
      assert.deepEqual(state.players, before.players, why);
      assert.deepEqual(state.enPassant, before.enPassant, why);
    } else if (step === 78) {
      assert.equal(at(before, 'h4'), undefined, why);
      Object.assign(expected.find(p => p.id === 'black-king-e8')!, { square: 'h4', zone: 'board' });
      assert.deepEqual(state.turn, before.turn, why);
      assert.deepEqual(state.players, before.players, why);
      assert.deepEqual(state.fen.split(' ').slice(1), before.fen.split(' ').slice(1), why);
      assert.deepEqual(state.underElfHill, [{ pieceId: 'black-king-e8', player: 'black', returning: true, returned: true }], why);
    } else if (step === 80) {
      Object.assign(expected.find(p => p.id === 'black-pawn-d7')!, { square: null, zone: 'captured' });
      assert.deepEqual(state.effects, [], why);
      assert.deepEqual(state.players.white.discard, [...before.players.white.discard, { id: 'white-deck-2-doomsayer', cardId: 'doomsayer' }], why);
      assert.deepEqual(state.players.white.hand, before.players.white.hand, why);
      assert.equal(state.fen.split(' ')[4], '0', why);
    } else {
      assert.ok(step === 71 || step === 74, why);
      assert.equal(state.fen, before.fen, why);
      assert.deepEqual(state.effects, before.effects, why);
      assert.deepEqual(state.players, before.players, why);
    }
    assert.deepEqual(physical(state.pieces), physical(expected), why);
    if (action.type === 'move') assert.deepEqual(state.players, before.players, why);
    if (step !== 70 && step !== 80) assert.deepEqual(state.effects, before.effects, why);
    states.push(state);
  }
  assert.equal(state.fen, 'r6r/6n1/p4pp1/P1P1BB1p/7k/8/3PPb1N/RQ3K2 b - - 11 27');
  assert.deepEqual(state.effects, []);
  assert.deepEqual(state.underElfHill, []);
  assert.equal(state.turn.color, 'black');
  assert.deepEqual(replayTrace(trace), state);
});
