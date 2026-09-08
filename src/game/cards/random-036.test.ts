import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Chess } from 'chessops/chess';
import { makeBoardFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Independently reviewed in action order against rules §§8–13, 15.4, 17.1,
// 21.1, 22.7 and the printed catalog timing. No action is approved by its hash.
const rationales = `
1. a2-a3 is a clear one-square Pawn advance; both Kings remain screened.
2. White closes its completed move; Black receives the turn without drawing.
3. g8-f6 is an ordinary Knight jump into an empty square.
4. Black closes; White receives fresh allowances, board and clocks retained.
5. b1-c3 is an ordinary Knight jump with no capture or royal exposure.
6. White closes; Black receives the turn without any card-zone change.
7. d7-d5 crosses empty d6, resets the Pawn clock and opens d6 en passant.
8. Black closes; the d6 opportunity persists into White's turn.
9. g1-h3 is a Knight jump; the unused d6 opportunity expires.
10. White closes; no new draw or movement is due.
11. f6-d7 is a Knight jump into the Pawn's vacated square.
12. Black closes safely; both card allowances reset.
13. h3-g1 returns the same Knight; no royal or castling identity changes.
14. White closes with its King still screened on e1.
15. h7-h5 passes empty h6 and creates h6 en passant.
16. Black closes, retaining that opportunity for White's next move.
17. Hidden Passage replaces the move: e1-h3 is empty and safe, loses White castling rights, expires en passant, and draws Legacy.
18. White closes its replacement move; Black receives the turn.
19. c7-c5 has clear c6 and c5; c6 becomes the en-passant square.
20. Black closes; c6 stays available for the immediate reply.
21. e2-e4 passes empty e3; replaces c6 with e3 en passant and resets the clock.
22. White closes with the e3 opportunity retained.
23. h5-h4 is a clear Pawn advance; h4 attacks g3, not White's King h3.
24. Black closes safely and expires the unused e3 opportunity.
25. g2-g3 advances into an empty attacked square, which a nonroyal Pawn may occupy.
26. White closes; h3 remains safe behind its neighboring pieces.
27. e7-e6 is a clear one-step Pawn move, opening f8-e7.
28. Black closes; no card or pending movement is due.
29. e4xd5 captures the black d-Pawn diagonally, preserving the white e-Pawn identity.
30. White closes the capture window; no reaction was selected.
31. f8-e7 is an empty adjacent Bishop diagonal.
32. Black closes safely with the Bishop now on e7.
33. b2-b3 advances one square into empty b3.
34. White closes, preserving its five-card hand.
35. d8-a5 follows empty c7 and b6; a5 is empty and Black's King stays safe.
36. Black closes the Queen move without a card.
37. f1-g2 is a Bishop diagonal into the g-Pawn's vacated square.
38. White closes with no change to piece identity or card zones.
39. e8-d8 moves the King to an unattacked adjacent square and revokes Black castling rights.
40. Black closes; neither side retains castling rights.
41. d5-d6 is a clear forward Pawn advance, without promotion.
42. White closes; Black is not checked by the Pawn on d6.
43. e6-e5 advances one square and resets the halfmove clock.
44. Black closes; no continuing effect exists yet.
45. d1-f1 crosses the vacated e1 to empty f1 with the Queen.
46. White closes safely, preserving the prior Hidden Passage discard.
47. Long Jump replaces Black's move: b8-g6 changes square color, ignores distance and pieces, captures nothing, and draws Split Knight.
48. Black closes its replacement move; White's allowance is fresh.
49. Haunting Memories copies the latest opposing Long Jump: g1-e8 changes color into empty e8, keeps Knight identity, and draws Dungeon.
50. White closes the copied replacement move, leaving the Knight capturable on e8.
51. h8xe8 passes empty g8 and f8, capturing the white g-Knight and resetting the clock.
52. Black closes; White declines its available Legacy reaction.
53. f1-d1 crosses empty e1 with the Queen, without capture.
54. White closes; the captured Knight remains captured.
55. e7-f6 is an empty Bishop diagonal; no King is exposed.
56. Black closes the Bishop move with no card spending.
57. d1-f3 crosses empty e2 on a Queen diagonal.
58. White closes safely; no en-passant right exists.
59. a5-c7 follows empty b6 on the Queen diagonal.
60. Black closes with Queen identity unchanged.
61. f3-e2 is an empty one-step Queen diagonal.
62. White closes its completed move with unchanged hands.
63. a7-a5 crosses empty a6 and opens a6 en passant.
64. Black closes; White can use or decline that immediate opportunity.
65. g2xb7 follows f3-e4-d5-c6, all empty, and captures the black b-Pawn; a6 expires.
66. White closes the Bishop capture without another card.
67. g6-h8 is an ordinary Knight jump into the Rook's vacated square.
68. Black closes; no right is restored by returning to h8.
69. a1-b1 moves the Rook one square into the Knight's vacated square.
70. White closes; a1 becomes a valid empty Dungeon corner.
71. e5-e4 is a clear one-square Pawn advance.
72. Black closes with White's King h3 still safe.
73. e2-h5 follows empty f3 and g4 with the Queen.
74. White closes; the Queen on h5 does not attack the screened King d8.
75. e4-e3 advances the black Pawn; it threatens d2 and f2, not h3.
76. Black closes safely, with no promotion or en passant.
77. c3-a2 is an ordinary Knight jump into the white a-Pawn's vacated square.
78. White closes; the unchanged h3 King is safe.
79. Sanctuary jumps King d8 over its already adjacent Rook e8 to safe f8; the Rook stays e8 and Betrayal is drawn.
80. Black closes its replacement move with all original identities preserved.
81. b7-e4 follows empty c6 and d5 with the Bishop.
82. White closes; the Bishop's ray toward f5 does not check f8.
83. Bombard replaces Black's move with e8-e7; its optional jump need not be used, and Disintegration is drawn.
84. Black closes, retaining a safe King f8.
85. h5-d5 crosses empty g5-f5-e5 with the Queen.
86. After-move Dungeon relocates enemy Bishop f6 to empty corner a1, forbids its next-turn movement, preserves clocks, and draws Knightmare.
87. White closes; the Dungeon prohibition remains for Black's coming turn.
88. e7-e8 moves Black's unrestricted Rook; the Dungeon Bishop remains a1.
89. Black closes its affected turn and the one-turn Dungeon restriction expires.
90. c1-b2 is an empty Bishop diagonal, with the original b-Pawn now on b3.
91. White closes; the released enemy Bishop may act on a later turn.
92. e8-e5 follows empty e7-e6 with Black's Rook.
93. Black closes; the Rook does not check h3.
94. d5-c4 is an empty Queen diagonal.
95. White closes; the Bishop remains on e4 and the King on h3.
96. h8-g6 is an ordinary Knight jump, without capture.
97. Black closes; both card allowances reset.
98. Confabulation moves Bishop e4 through empty d3 onto friendly Pawn c2; one composite occupancy gains both powers, keeps both identities, and its card remains active; Think Again is drawn.
99. White closes the merging replacement move; the composite persists at c2.
100. e5-g5 crosses empty f5 with the Rook; c2's Bishop ray is blocked on g6, so Black remains safe.
101. Black closes; the composite marker and component identities persist.
102. c4xf7 follows empty d5-e6, captures the black f-Pawn and checks King f8; Kxf7 is a legal reply, so this is not mate.
103. Revenge reacts after the opposing move and removes White's b3 Pawn as captured; Black may remain checked until its own turn, and draws Vulture.
104. White closes its legal checking turn; Black's fresh own-turn allowance is independent of Revenge.
105. f8xf7 captures the checking Queen; f7 is defended by neither the c2 composite nor b2 Bishop, so the King is safe.
106. Black closes; White declines its immediate Legacy option.
107. b1xa1 captures the formerly imprisoned Bishop with the Rook.
108. White closes; Black declines Riposte and the Bishop remains captured.
109. f7-e8 is an empty safe King diagonal, with the clock advancing once.
110. Think Again immediately cancels that move: restore King f7 and clocks 0/27, require a different move, keep Black active, spend White's reaction, and draw Betrayal.
111. f7-e6 is a different safe replacement: d6 Pawn attacks e7, not e6, and the composite c2 is not aligned with e6.
112. Black closes; the movement prohibition and reaction allowance expire.
113. Composite c2-d3 uses its Bishop component for a noncapturing diagonal; Pawn identity remains, cannot promote, and resets its Pawn halfmove clock.
114. White closes the fiftieth move command; Black starts safely with the composite on d3 and no pending action.
`.trim().split('\n');

const dungeon = { type: 'dungeon', owner: 'white', player: 'black', pieceId: 'black-bishop-f8' };
const composite = { type: 'confabulation', owner: 'white', card: { id: 'white-hand-1-confabulation', cardId: 'confabulation' }, pieceIds: ['white-pawn-c2', 'white-bishop-f1'] };

test('iteration 036 deterministic engine replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/036.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860036);
  assert.equal(trace.steps.length, 114);
  assert.equal(rationales.length, trace.steps.length);
  const states: GameState[] = [createGameState(trace.initial)];
  const cardMoves: Record<number, [string, string]> = { 17: ['e1', 'h3'], 47: ['b8', 'g6'], 49: ['g1', 'e8'], 79: ['d8', 'f8'], 83: ['e8', 'e7'], 86: ['f6', 'a1'], 110: ['e8', 'f7'] };
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1;
    assert.ok(rationales[index]!.startsWith(`${step}. `));
    const before = states.at(-1)!;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationales[index]);
    const after = result.state;
    states.push(after);
    assert.deepEqual(after.effects, step >= 98 ? [composite] : step >= 86 && step <= 88 ? [dungeon] : []);
    const ep = step === 7 || step === 8 ? { target: 'd6', pawnId: 'black-pawn-d7' }
      : step === 15 || step === 16 ? { target: 'h6', pawnId: 'black-pawn-h7' }
      : step === 19 || step === 20 ? { target: 'c6', pawnId: 'black-pawn-c7' }
      : step === 21 || step === 22 ? { target: 'e3', pawnId: 'white-pawn-e2' }
      : step === 63 || step === 64 ? { target: 'a6', pawnId: 'black-pawn-a7' } : null;
    assert.deepEqual(after.enPassant, ep ? [ep] : []);
    assert.equal(after.orientation, 0);
    assert.ok(!after.pendingRescue && !after.pendingAbduction && !after.pendingDoomsayer && !after.outcome);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = parseSquare(action.from)!;
      const to = parseSquare(action.to)!;
      const setup = parseFen(before.fen).unwrap();
      // For this reviewed suffix the c2 composite's Pawn capture squares are
      // contained in its Bishop attacks; no Pawn-only move is selected.
      if (step >= 100) setup.board.set(parseSquare('c2')!, { color: 'white', role: 'bishop' });
      const chess = Chess.fromSetup(setup).unwrap();
      assert.ok(chess.isLegal({ from, to }), rationales[index]);
      chess.play({ from, to });
      if (step >= 100) chess.board.set(step === 113 ? to : parseSquare('c2')!, { color: 'white', role: 'pawn' });
      assert.equal(makeBoardFen(chess.board), after.fen.split(' ')[0], rationales[index]);
      assert.equal(parseFen(after.fen).unwrap().fullmoves, chess.fullmoves);
      assert.equal(parseFen(after.fen).unwrap().halfmoves, step === 113 ? 0 : chess.halfmoves);
      const moved = before.pieces.find(piece => piece.square === action.from)!;
      assert.equal(after.pieces.find(piece => piece.id === moved.id)!.square, action.to);
      assert.deepEqual(after.players, before.players);
      assert.equal(after.turn.moveMade, true);
    } else if (action.type === 'endTurn') {
      assert.equal(after.fen, before.fen);
      assert.deepEqual(after.pieces, before.pieces);
      assert.deepEqual(after.players, before.players);
      assert.deepEqual(after.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
    } else if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(card => card.id === action.cardInstanceId) ? 'white' : 'black';
      const other = owner === 'white' ? 'black' : 'white';
      const player = before.players[owner];
      const played = player.hand.find(card => card.id === action.cardInstanceId)!;
      assert.deepEqual(after.players[owner].hand, [...player.hand.filter(card => card.id !== played.id), player.deck[0]]);
      assert.deepEqual(after.players[owner].deck, player.deck.slice(1));
      assert.deepEqual(after.players[owner].discard, step === 98 ? player.discard : [...player.discard, played]);
      assert.deepEqual(after.players[other], before.players[other]);
      assert.equal(after.turn.cardPlays[owner], 1);
      const board = parseFen(before.fen).unwrap().board;
      const movement = cardMoves[step];
      if (movement) {
        const from = parseSquare(movement[0])!;
        const to = parseSquare(movement[1])!;
        assert.equal(board.get(to), undefined);
        board.set(to, board.take(from)!);
      } else board.take(parseSquare(step === 98 ? 'e4' : 'b3')!);
      assert.equal(makeBoardFen(board), after.fen.split(' ')[0], rationales[index]);
      if (step === 86 || step === 103) assert.deepEqual(after.fen.split(' ').slice(1), before.fen.split(' ').slice(1));
      if (step === 110) {
        assert.equal(after.fen, states[108]!.fen);
        assert.deepEqual(after.pieces, states[108]!.pieces);
        assert.equal(after.turn.color, 'black');
        assert.equal(after.turn.moveMade, false);
        assert.equal(applyAction(after, { type: 'move', from: 'f7', to: 'e8' }).ok, false, 'canceled transition cannot repeat');
      }
      if (step === 47 || step === 49) {
        const [from, to] = movement!;
        assert.notEqual((from.charCodeAt(0) + Number(from[1])) % 2, (to.charCodeAt(0) + Number(to[1])) % 2);
      }
    }
  }
  const final = states.at(-1)!;
  assert.equal(final.fen, 'r1b5/2qn2p1/3Pk1n1/p1p3r1/7p/P2Pp1PK/NB1P1P1P/R6R b - - 0 28');
  assert.deepEqual(final.enPassant, []);
  assert.equal(final.pieces.filter(piece => piece.zone === 'board').length, 24);
  assert.equal(final.pieces.filter(piece => piece.zone === 'captured').length, 7);
  assert.equal(final.pieces.find(piece => piece.id === 'white-pawn-c2')!.square, 'd3');
  assert.equal(final.pieces.find(piece => piece.id === 'white-bishop-f1')!.zone, 'away');
  assert.deepEqual([final.players.white.deck.length, final.players.black.deck.length], [70, 71]);
  assert.deepEqual(replayTrace(trace), final);
});
