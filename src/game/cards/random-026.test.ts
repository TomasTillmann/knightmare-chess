import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { Chess } from 'chessops/chess';
import { makeBoardFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState } from '../types.js';

// Each numbered entry is a sequential review against rules §§8–13, 14.4,
// 19.1, 20, 21 and 22.6 and the printed catalog timing and cards.md text.
// No move traverses the d1/e1 wall or lands on d8 after Man-Trap is set.
const rationales = [
  '1. Ng1-h3 jumps to an empty square; e1 remains sheltered.',
  '2. White closes the completed quiet move; no draw or board change.',
  '3. f7-f5 crosses empty f6; creates f6 en passant, resets clock.',
  '4. Black closes; f6 opportunity remains for White.',
  '5. a2-a4 crosses empty a3; replaces f6 with a3 en passant.',
  '6. Black Think Again reacts to a4: restore a2, f6 and clocks; draw Charge, require a different move.',
  '7. b2-b3 is a different pawn move; expires f6 and preserves Black reaction expenditure.',
  '8. White Siege after b3 swaps own b1 Knight/h1 Rook without capture or path requirements; draw Long Jump.',
  '9. Close White turn and reset both separate card allowances.',
  '10. e7-e6 moves into an empty square and opens f8 Bishop diagonal.',
  '11. Black Anathema swaps enemy c1 Bishop/a1 Rook without moving geometry; draw Crusade.',
  '12. Close Black turn; both swaps retain their physical identities.',
  '13. Long Jump replaces White move: h1 and e3 have opposite colors, e3 is empty; draw Disintegration.',
  '14. Close the completed Long Jump replacement turn.',
  '15. h7-h5 crosses empty h6; creates h6 en passant.',
  '16. Close Black turn while preserving h6 opportunity.',
  '17. c2-c3 is an empty forward step; expires h6 opportunity.',
  '18. Close White turn with both Kings safe.',
  '19. a7-a6 is an empty forward step.',
  '20. Close Black turn; no card or board mutation.',
  '21. Nh3-g5 is a legal jump; neither King is exposed.',
  '22. Close White turn after the quiet Knight move.',
  '23. Rh8-h6 crosses empty h7; revoke that Rook castling right.',
  '24. Close Black turn; no new en passant.',
  '25. d2-d3 is an empty forward step.',
  '26. Close White turn after the pawn move.',
  '27. h5-h4 is an empty forward step.',
  '28. Close Black turn after h4.',
  '29. Blessing moves g2 Pawn through empty f3/e4/d5 to empty c6 as a Bishop, without capture/promotion; draw Squaring the Circle.',
  '30. Close Blessing replacement move; Pawn remains its physical identity.',
  '31. Bf8-e7 follows the newly empty adjacent diagonal.',
  '32. Close Black turn after the Bishop move.',
  '33. Ne3-g4 jumps to empty g4.',
  '34. Close White turn; no capture or draw.',
  '35. e6-e5 is an empty pawn advance.',
  '36. Close Black turn after e5.',
  '37. e2-e4 crosses empty e3 and creates e3 en passant.',
  '38. Close White turn preserving e3 opportunity.',
  '39. Rh6-h8 crosses empty h7; returning does not restore castling.',
  '40. Close Black turn; e3 opportunity has expired.',
  '41. e4xf5 captures the black f7 Pawn diagonally; clock resets.',
  '42. Close White turn; captured identity stays captured.',
  '43. Ke8-f8 reaches an unattacked adjacent empty square; revoke remaining Black castling.',
  '44. Close Black turn with King safely on f8.',
  '45. Ke1-e2 reaches an empty unattacked square; revoke White castling.',
  '46. Close White turn; both castling rights are now absent.',
  '47. Rh8-h6 crosses empty h7 once again.',
  '48. Black Man-Trap after the move names own Queen square d8; retain card and draw Fortification without moving Queen.',
  '49. Close Black turn; secret d8 trap remains armed.',
  '50. a2-a4 may now repeat because Think Again prohibition ended with b3; create a3 opportunity.',
  '51. Close White turn; trap has not been entered.',
  '52. d7xc6 captures the Blessing-displaced g2 Pawn diagonally.',
  '53. Fortification marks adjacent d1/e1 boundary after capture; retain card, preserve clocks, draw Treason.',
  '54. Close Black turn with trap and wall retained.',
  '55. Bf1-h3 crosses empty g2; does not cross the d1/e1 wall.',
  '56. Close White turn after the quiet Bishop move.',
  '57. Rh6-f6 crosses empty g6; Black King remains safe.',
  '58. Black Treason swaps enemy c1 Rook/g5 Knight without capture; no direct mate; draw Fog of War.',
  '59. Close Black turn preserving both piece identities and continuing effects.',
  '60. Ba1-b2 is a clear adjacent diagonal, now vacated by b-pawn.',
  '61. Close White turn after the Bishop move.',
  '62. b7-b5 crosses empty b6 and creates b6 en passant.',
  '63. Close Black turn preserving b6 opportunity.',
  '64. f2-f4 crosses empty f3; replaces b6 with f3 opportunity.',
  '65. Close White turn preserving f3 opportunity.',
  '66. Ng8-h6 jumps into empty h6; expires f3 opportunity.',
  '67. Holy War swaps own h6 Knight/c8 Bishop, preserving identities; no mate or self-check; draw Hostage.',
  '68. Close Black turn with Bishop now on h6.',
  '69. Assassin Ke2xd3 would enter the Queen attack along clear d8/d7/d6/d5/d4/d3; restore both own pieces, spend move/card, draw Evil Eye.',
  '70. Close the failed replacement attempt; White was initially safe so move was consumed.',
  '71. b5xa4 captures the White original a2 Pawn diagonally.',
  '72. Close Black turn after capture.',
  '73. Ke2-f2 is empty and unattacked; f5 Pawn blocks the f6 Rook.',
  '74. Close White turn with King safe on f2.',
  '75. Nc8-b6 is a legal empty Knight jump.',
  '76. Close Black turn after the Knight move.',
  '77. b3xa4 captures Black original b7 Pawn diagonally.',
  '78. Close White turn after recapture.',
  '79. Nb6-c8 is a legal return jump.',
  '80. Close Black turn after the Knight move.',
  '81. Ng4xe5 captures Black original e7 Pawn; no king exposure.',
  '82. Close White turn after the Knight capture.',
  '83. Qd8-d4 crosses empty d7/d6/d5; departing its own trap does not spring it.',
  '84. Close Black turn; d8 trap remains at its square.',
  '85. Kf2-e2 is adjacent and safe: d3 Pawn blocks Queen diagonal toward e2.',
  '86. Close White turn with King on e2.',
  '87. Qd4-f2 crosses empty e3 and checks adjacent Ke2 along the rank.',
  '88. Close Black checking turn; White receives an escape turn.',
  '89. Rg5-g2 crosses empty g4/g3 but does not cure Qf2 check: only provisional pending rescue, never a completed legal turn.',
  '90. Peace Talks cannot cure Qf2-e2 check by removing d1/e1 wall; spend/draw Toll, restore wall and provisional Rook move including clocks, leave White to answer check.',
  '91. Ke2xf2 captures the checking Queen on an unattacked square; f5 still blocks Black Rook.',
  '92. Close White turn after legal rescue by capture; Peace Talks allowance remains spent until closure.',
  '93. Be7-a3 crosses empty d6/c5/b4; stops before occupied b2.',
  '94. Close Black turn after the Bishop move.',
  '95. Ne5-f7 is a legal empty jump and does not check Kf8.',
  '96. Close White turn after the Knight move.',
  '97. Nc8-e7 is a quiet legal jump, supplying Charge trigger.',
  '98. Charge grants that Knight second move e7xf5 capturing White e2 Pawn; no extra fullmove, reset capture clock, draw Earthquake.',
  '99. Close Black turn after the two Knight moves.',
  '100. Kf2-f3 is empty and safe; own f4 Pawn and Black f5 Knight block the Rook file.',
  '101. Close White turn with King safe on f3.',
  '102. Ba3xb2 captures White original c1 Bishop diagonally.',
  '103. Close Black turn after the Bishop capture.',
  '104. Bh3xf5 crosses empty g4 and captures Black original g8 Knight.',
  '105. Close White turn after the Bishop capture.',
  '106. c6-c5 is an empty Black pawn step.',
  '107. Close Black turn after c5.',
  '108. Bf5-d7 crosses empty e6; d7 is empty and no trap is entered.',
  '109. Close White turn after the Bishop move.',
  '110. Bb2xc3 captures White original c2 Pawn diagonally.',
  '111. Close Black turn after capture.',
  '112. Rg5-g2 crosses empty g4/g3; Queen is now gone so King remains safe.',
  '113. Close White turn; fifty move commands reviewed, both continuing effects remain.',
];

test('iteration 026 deterministic reviewed campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/026.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860026);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(rationales.length, 113);
  rationales.forEach((reason, i) => assert.ok(reason.startsWith(`${i + 1}. `)));
  let state = createGameState(trace.initial);
  const states: GameState[] = [state];
  const swaps: Record<number, [string, string]> = { 8: ['b1', 'h1'], 11: ['c1', 'a1'], 58: ['c1', 'g5'], 67: ['c8', 'h6'] };
  const relocations: Record<number, [string, string]> = { 13: ['h1', 'e3'], 29: ['g2', 'c6'] };
  const drawn: Record<number, string> = { 6: 'charge', 8: 'long-jump', 11: 'crusade', 13: 'disintegration', 29: 'squaring-the-circle', 48: 'fortification', 53: 'treason', 58: 'fog-of-war', 67: 'hostage', 69: 'evil-eye', 90: 'toll', 98: 'earthquake' };
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1;
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationales[index]);
    state = result.state;
    assert.equal(state.orientation, 0);
    assert.equal(Boolean(state.pendingRescue), step === 89, rationales[index]);
    assert.ok(!state.outcome);
    if (step === 89) assert.equal(applyAction(state, { type: 'endTurn' }).ok, false, 'unresolved self-check cannot finish a turn');
    else {
      // No neutral, transformed or capture-suppressed pieces occur here. The
      // d1/e1 wall affects none of the King attack lines in this trace.
      const position = Chess.fromSetup(parseFen(state.fen).unwrap()).unwrap();
      if (state.turn.phase === 'afterMove') {
        const king = position.board.kingOf(state.turn.color)!;
        const enemy = state.turn.color === 'white' ? 'black' : 'white';
        assert.equal(position.kingAttackers(king, enemy, position.board.occupied).size(), 0, rationales[index]);
      }
      if (action.type === 'playCard') assert.equal(position.isCheckmate(), false, 'regular cards do not directly mate');
    }
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const position = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap();
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! };
      assert.equal(position.isLegal(move), step !== 89, rationales[index]);
      position.play(move);
      assert.equal(makeBoardFen(position.board), state.fen.split(' ')[0], rationales[index]);
      const fen = parseFen(state.fen).unwrap();
      assert.equal(fen.halfmoves, position.halfmoves);
      assert.equal(fen.fullmoves, position.fullmoves);
      const mover = before.pieces.find(p => p.square === action.from)!;
      assert.equal(state.pieces.find(p => p.id === mover.id)!.square, action.to);
      for (const p of before.pieces) {
        const after = state.pieces.find(next => next.id === p.id)!;
        if (p.id === mover.id) assert.deepEqual(after, { ...p, square: action.to });
        else if (p.square === action.to) {
          assert.equal(after.zone, 'captured');
          assert.equal(after.square, null);
          assert.equal(after.owner, p.owner);
          assert.equal(after.role, p.role);
        } else assert.deepEqual(after, p);
      }
      const double = mover.role === 'pawn' && Math.abs(Number(action.from[1]) - Number(action.to[1])) === 2;
      assert.deepEqual(state.enPassant, double ? [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}`, pawnId: mover.id }] : []);
      assert.deepEqual(state.effects, before.effects);
      assert.deepEqual(state.players, before.players);
      assert.equal(state.turn.color, before.turn.color);
      assert.equal(state.turn.phase, 'afterMove');
      assert.equal(state.turn.moveMade, true);
    } else if (action.type === 'endTurn') {
      assert.deepEqual(state.pieces, before.pieces);
      assert.deepEqual(state.effects, before.effects);
      assert.deepEqual(state.players, before.players);
      assert.deepEqual(state.enPassant, before.enPassant);
      assert.equal(state.fen, before.fen);
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
    } else if (action.type === 'playCard') {
      const owner = step === 6 ? 'black' : before.turn.color;
      const opponent = owner === 'white' ? 'black' : 'white';
      const card = before.players[owner].hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(card);
      assert.deepEqual(state.players[owner].hand, [...before.players[owner].hand.filter(c => c.id !== card.id), before.players[owner].deck[0]]);
      assert.equal(state.players[owner].hand.at(-1)!.cardId, drawn[step]);
      assert.deepEqual(state.players[owner].deck, before.players[owner].deck.slice(1));
      assert.deepEqual(state.players[owner].discard, [48, 53].includes(step) ? before.players[owner].discard : [...before.players[owner].discard, card]);
      assert.deepEqual(state.players[opponent], before.players[opponent]);
      assert.equal(state.turn.cardPlays[owner], before.turn.cardPlays[owner] + 1);
      if (swaps[step]) {
        const [a, b] = swaps[step]!;
        assert.deepEqual(state.pieces, before.pieces.map(p => ({ ...p, square: p.square === a ? b : p.square === b ? a : p.square })));
        assert.deepEqual(state.effects, before.effects);
      } else if (relocations[step]) {
        const [from, to] = relocations[step]!;
        assert.deepEqual(state.pieces, before.pieces.map(p => p.square === from ? { ...p, square: to } : p));
        assert.equal(state.turn.moveMade, true);
        assert.deepEqual(state.effects, before.effects);
      } else if (step === 6 || step === 90) {
        const restored = states[step === 6 ? 4 : 88]!;
        assert.deepEqual(state.pieces, restored.pieces);
        assert.deepEqual(state.effects, restored.effects);
        assert.deepEqual(state.enPassant, restored.enPassant);
        assert.equal(state.fen, restored.fen);
        assert.equal(state.turn.moveMade, false);
        assert.equal(state.turn.phase, 'beforeMove');
      } else if (step === 48 || step === 53) {
        assert.deepEqual(state.pieces, before.pieces);
        assert.equal(state.fen, before.fen);
        assert.deepEqual(state.effects, [...before.effects, step === 48
          ? { type: 'man-trap', owner: 'black', card, square: 'd8' }
          : { type: 'fortification', owner: 'black', card, from: 'd1', to: 'e1' }]);
      } else if (step === 69) {
        assert.deepEqual(state.pieces, before.pieces, 'Assassin cannot put King on Queen-attacked d3');
        assert.deepEqual(state.effects, before.effects);
        assert.equal(state.turn.moveMade, true);
        assert.equal(state.fen, 'rnnq1k2/2p1b1p1/p1p2r1b/1p2pPR1/P4PNp/1PPP3B/1B2K2P/1RNQ4 b - - 2 16');
      } else if (step === 98) {
        assert.equal(state.pieces.find(p => p.id === 'black-knight-g8')!.square, 'f5');
        assert.equal(state.pieces.find(p => p.id === 'white-pawn-e2')!.zone, 'captured');
        assert.equal(parseFen(state.fen).unwrap().fullmoves, parseFen(before.fen).unwrap().fullmoves);
        assert.equal(parseFen(state.fen).unwrap().halfmoves, 0);
        assert.deepEqual(state.effects, before.effects);
      } else assert.fail(`Unreviewed card step ${step}`);
    } else assert.fail(`Unreviewed action at ${step}`);
    states.push(state);
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 12);
  assert.equal(state.fen, 'rn3k2/2pB1Np1/p4r1b/2p5/P4P1p/2bP1K2/6RP/1RNQ4 b - - 1 26');
  assert.deepEqual(replayTrace(trace), state);
});
