import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Chess } from 'chessops/chess';
import { makeBoardFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Independently reviewed in order against rules §§6–9, 11, 13, 21.1, 22.2
// and the six printed card descriptions/timings in cards.md/catalog.ts.
const rationales = [
  '1. e2-e3 advances one empty square; e-file pawn retains identity and resets clock.',
  '2. White finishes; Black starts with unchanged board and hands.',
  '3. a7-a6 advances the black pawn one empty square.',
  '4. Black finishes; White starts, no card replacement owed.',
  '5. a2-a3 advances the white pawn one empty square.',
  '6. White hands over with no board change.',
  '7. a8-a7 uses the vacated square and loses Black queenside castling.',
  '8. Black hands over; lost castling remains lost.',
  '9. a1-a2 uses the vacated square and loses White queenside castling.',
  '10. White hands over with kingside rights intact.',
  '11. e7-e5 has clear e6/e5; e6 en-passant opportunity is recorded.',
  '12. Black ends; the e6 opportunity survives for White reply.',
  '13. c2-c4 has clear c3/c4 and replaces expired e6 opportunity by c3.',
  '14. White ends; c3 opportunity survives for Black reply.',
  '15. d7-d5 has clear d6/d5 and replaces c3 opportunity by d6.',
  '16. Black ends; d6 opportunity survives for White reply.',
  '17. g2-g4 has clear g3/g4 and replaces d6 opportunity by g3.',
  '18. White ends; g3 opportunity survives for Black reply.',
  '19. Qd8-h4 travels e7/f6/g5, all empty; f2 still shields White King.',
  '20. Black ends; unused en-passant opportunity has expired.',
  '21. Nb1-c3 is a knight jump to an empty square, King remains safe.',
  '22. White ends without card spending.',
  '23. b7-b6 is a single forward pawn step.',
  '24. Black ends without card spending.',
  '25. Ke1-e2 enters an unattacked empty square and loses White kingside rights.',
  '26. White ends with no castling rights remaining.',
  '27. h7-h6 advances one empty square; no capture or promotion.',
  '28. Black ends with unchanged hands.',
  '29. d2-d3 advances one empty square; e3 shields King from Qh4 diagonal.',
  '30. White ends with safe e2 King.',
  '31. Bf8-c5 crosses empty e7/d6; no capture.',
  '32. Black ends; bishop does not attack e2.',
  '33. b2-b4 crosses empty b3; new b3 en-passant opportunity.',
  '34. White ends; b3 opportunity remains until Black reply.',
  '35. Qh4-h3 is a one-square file move, expiring b3 opportunity.',
  '36. Black ends; no King is checked.',
  '37. Lost Castle before move swaps opposite rooks h1/h8 without capture, consumes move, revokes final castling right; draw Bombard.',
  '38. White ends after replacement move; no second regular move.',
  '39. Ke8-d8 enters unattacked d8; g8 knight still blocks Rh8.',
  '40. Black ends with both Kings safe.',
  '41. Breakthrough permits c4xc5 straight ahead, capturing the black bishop; consume move and draw Anathema.',
  '42. White ends; c5 pawn is not promoted.',
  '43. b6-b5 advances black pawn into empty b5.',
  '44. Black ends; no card allowance consumed.',
  '45. Rh8-h7 is an empty one-square file move.',
  '46. White ends; opposing g7 pawn blocks rook along rank.',
  '47. Bc8-b7 is an empty diagonal step.',
  '48. Black ends; c6 is empty but d5 pawn blocks bishop farther.',
  '49. Qd1-c2 is a single diagonal step into vacated c2.',
  '50. White ends; e2 King remains shielded by f2.',
  '51. Qh3-g2 is an empty diagonal step, f2 shields e2 King.',
  '52. Black ends with White allowed to act.',
  '53. Ke2-d2 moves into empty unattacked d2.',
  '54. White ends; King no longer occupies e2.',
  '55. Qg2xg1 captures White original g1 knight, retaining queen identity.',
  '56. Black ends; White bishop f1 blocks queen along first rank.',
  '57. Bombard Rh7-h5 jumps exactly h6 black pawn without removing it; draw Evil Eye and consume move.',
  '58. White ends after replacement move; pawn h6 remains on board.',
  '59. Ng8-f6 jumps into empty f6.',
  '60. Black ends; Knight f6 does not attack d2.',
  '61. g4-g5 advances white pawn into empty g5.',
  '62. White ends; no promotion or en-passant right.',
  '63. Nb8-c6 is a knight jump into empty c6.',
  '64. Black ends; no card expenditure.',
  '65. Qc2-b3 is an empty diagonal step.',
  '66. Treason after move swaps opposing rook a7 and knight f6; no capture or extra move, draw Evangelists.',
  '67. White ends; reset card allowance while preserving swapped identities.',
  '68. Kd8-e8 is an unattacked empty square.',
  '69. Black ends; castling rights stay revoked.',
  '70. g5xf6 captures the swapped black a8 rook by normal pawn diagonal.',
  '71. White ends; pawn at f6 threatens e7/g7, not e8 King.',
  '72. Black Bombard Rh1xf1 jumps own queen g1 and captures white bishop f1; draw Hostage, consume move.',
  '73. Black ends; jumped queen remains g1.',
  '74. Rh5xh6 captures black h7 pawn one square ahead.',
  '75. Anathema after move swaps opposing bishop b7 and rook f1 without capture; draw Siege and preserve clocks.',
  '76. White ends; black rook is b7 and bishop is f1.',
  '77. Nc6-e7 jumps into empty e7; White pawn f6 attacks it but not King e8.',
  '78. Black ends without spending a card.',
  '79. Rh6-h4 crosses empty h5; no capture.',
  '80. White ends without spending a card.',
  '81. Qg1-h1 moves into empty h1.',
  '82. Black ends; White h2 pawn blocks h-file attack.',
  '83. Nc3-e2 is a knight jump, exposing no attack on King d2.',
  '84. White ends; moved knight remains capturable.',
  '85. d5-d4 advances black pawn one empty square.',
  '86. Black ends; d4 pawn attacks c3/e3, not d2 King.',
  '87. Kd2-c2 enters empty unattacked c2.',
  '88. White ends with safe King c2.',
  '89. Irresistible Force f7-f6 pushes white pawn f6 to empty f5 without capture or promotion; draw Bog, consume move.',
  '90. Black ends; pushed pawn keeps White ownership and original g2 identity.',
  '91. Bc1-b2 enters empty b2 diagonally.',
  '92. White ends; King c2 remains safe.',
  '93. Qh1-g1 returns to empty g1.',
  '94. Black ends; f2 pawn still blocks queen diagonal toward King.',
  '95. Qb3-f7 traverses empty c4/d5/e6 and checks King e8.',
  '96. White ends; Black must answer the queen check.',
  '97. Ke8xf7 captures the checking queen on undefended f7, resolving check.',
  '98. Black ends; captured queen goes to captured zone, not dead.',
  '99. Bb2-c3 is a one-square empty diagonal move.',
  '100. White ends; d4 black pawn blocks bishop beyond c3.',
  '101. Bf1xe2 captures White original b1 knight by one-square diagonal.',
  '102. Black ends; bishop e2 does not check King c2.',
  '103. Rh4-h5 moves one empty square up the file.',
  '104. White ends; no card expenditure.',
  '105. e5-e4 moves black pawn into empty e4.',
  '106. Black ends; e4 pawn attacks d3/f3, not King c2.',
  '107. d3xe4 captures black original e7 pawn diagonally.',
  '108. White ends; pawn capture resets clock.',
  '109. Rb7-b6 uses empty b6; b5 pawn remains an obstruction farther down file.',
  '110. Black ends with no changes beyond turn handover.',
  '111. Rh5-h3 crosses empty h4, retaining original h1 rook identity.',
  '112. White ends; Black starts move 28, no pending response or terminal state.',
];

test('iteration 030 deterministic campaign replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/030.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860030);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.length, 112);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 7);
  const final = replayTrace(trace);
  let state = createGameState(trace.initial);
  const cardDeltas: Record<number, Record<string, string | null>> = {
    37: { 'white-rook-h1': 'h8', 'black-rook-h8': 'h1' },
    41: { 'white-pawn-c2': 'c5', 'black-bishop-f8': null },
    57: { 'white-rook-h1': 'h5' },
    66: { 'black-rook-a8': 'f6', 'black-knight-g8': 'a7' },
    72: { 'black-rook-h8': 'f1', 'white-bishop-f1': null },
    75: { 'black-bishop-c8': 'f1', 'black-rook-h8': 'b7' },
    89: { 'black-pawn-f7': 'f6', 'white-pawn-g2': 'f5' },
  };
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1;
    assert.ok(rationales[index]!.startsWith(`${n}. `));
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationales[index]);
    state = result.state;
    assert.deepEqual(state.effects, [], `step ${n}: no continuing card was played`);
    assert.ok(!state.pendingRescue && !state.pendingAbduction && !state.pendingDoomsayer);
    assert.equal(state.outcome, null);
    const afterFen = parseFen(state.fen).unwrap();
    const ownPosition = Chess.fromSetup(afterFen).unwrap();
    assert.equal(ownPosition.kingAttackers(ownPosition.board.kingOf(before.turn.color)!,
      before.turn.color === 'white' ? 'black' : 'white', ownPosition.board.occupied).nonEmpty(), false,
    `step ${n}: acting King remains safe`);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = parseSquare(action.from)!;
      const to = parseSquare(action.to)!;
      const oracle = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap();
      const mover = before.pieces.find(p => p.square === action.from)!;
      const victim = before.pieces.find(p => p.square === action.to);
      assert.ok(oracle.isLegal({ from, to }), rationales[index]);
      oracle.play({ from, to });
      assert.equal(makeBoardFen(oracle.board), state.fen.split(' ')[0]);
      assert.equal(afterFen.halfmoves, oracle.halfmoves);
      assert.equal(afterFen.fullmoves, oracle.fullmoves);
      assert.deepEqual(afterFen.castlingRights, oracle.castles.castlingRights);
      for (const prior of before.pieces) {
        const piece = state.pieces.find(p => p.id === prior.id)!;
        assert.deepEqual(piece, prior.id === mover.id ? { ...prior, square: action.to }
          : prior.id === victim?.id ? { ...prior, square: null, zone: 'captured', capturedBy: before.turn.color } : prior);
      }
      assert.deepEqual(state.players, before.players);
      const double = mover.role === 'pawn' && Math.abs(to - from) === 16;
      assert.deepEqual(state.enPassant, double ? [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}`, pawnId: mover.id }] : []);
      assert.deepEqual(state.turn, { ...before.turn, phase: 'afterMove', moveMade: true });
    } else if (action.type === 'playCard') {
      const actor = before.turn.color;
      const other = actor === 'white' ? 'black' : 'white';
      const player = before.players[actor];
      const card = player.hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(card);
      assert.equal(before.turn.cardPlays[actor], 0);
      assert.equal(before.turn.phase, [66, 75].includes(n) ? 'afterMove' : 'beforeMove');
      assert.deepEqual(state.players[actor], {
        hand: [...player.hand.filter(c => c.id !== card.id), player.deck[0]],
        deck: player.deck.slice(1), discard: [...player.discard, card],
      });
      assert.deepEqual(state.players[other], before.players[other]);
      assert.deepEqual(state.turn, { ...before.turn, phase: 'afterMove', moveMade: true,
        cardPlays: { ...before.turn.cardPlays, [actor]: 1 } });
      for (const prior of before.pieces) {
        const square = cardDeltas[n]![prior.id];
        const expected = square === undefined ? prior : { ...prior, square, zone: square === null ? 'captured' : 'board', ...(square === null ? { capturedBy: actor } : {}) };
        assert.deepEqual(state.pieces.find(p => p.id === prior.id), expected, `card ${n}: ${prior.id}`);
      }
      assert.deepEqual(state.enPassant, []);
      const oldFen = parseFen(before.fen).unwrap();
      assert.equal(afterFen.halfmoves, [41, 72, 89].includes(n) ? 0 : oldFen.halfmoves + ([66, 75].includes(n) ? 0 : 1));
      assert.equal(afterFen.fullmoves, oldFen.fullmoves + ([72, 89].includes(n) ? 1 : 0));
      assert.equal(Chess.fromSetup(afterFen).unwrap().isCheckmate(), false, 'regular cards may not directly mate');
    } else {
      assert.equal(action.type, 'endTurn');
      assert.equal(before.turn.moveMade, true);
      assert.deepEqual(state.pieces, before.pieces);
      assert.deepEqual(state.players, before.players);
      assert.deepEqual(state.enPassant, before.enPassant);
      assert.equal(state.fen, before.fen);
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white',
        phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
    }
  }
  assert.equal(final.fen, '8/n1p1nkp1/pr3p2/1pP2P2/1P1pP3/P1B1P2R/R1K1bP1P/6q1 b - - 2 28');
});
