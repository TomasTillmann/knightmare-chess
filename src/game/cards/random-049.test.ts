import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Chess } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Rules §§8–11, 14.2, 15.2, 17.3, 19.2 and artwork KC12/3,
// KC14/3, KC16/3, KC15/4, KC13/1, KC5/3 independently reviewed.
const rationales = [
  '1. e2-e3: one empty forward Pawn square; e1 remains screened.',
  '2. White ends after e3; Black receives its move, no draw or clock change.',
  '3. b7-b6: one empty Black-forward square; e8 remains safe.',
  '4. Black ends after b6; White receives its move.',
  '5. g2-g4: g3 and g4 empty; create g3 en-passant opportunity and reset clock.',
  '6. White ends; g3 opportunity remains for Black.',
  '7. Tournament instead of move swaps Black g8/White b1 Knights; neither attacks a King, no capture; expire g3 and draw Disintegration.',
  '8. Black ends its replacement move; White card allowance resets.',
  '9. b2-b4: b3/b4 empty; b1 Knight does not check e1; create b3 opportunity.',
  '10. White ends, retaining b3 opportunity for Black.',
  '11. b6-b5: empty forward destination; expire b3 opportunity.',
  '12. White Plots during opponent response consumes only White card allowance; no eligible held response cards, draw Forbidden City.',
  '13. Black ends; unused White Plots allowance expires, no extra draw.',
  '14. Bf1-g2: one empty diagonal; no capture or exposed King.',
  '15. Black Plots during White response has no eligible held response cards; draw Figure Dance but it is not retroactively eligible.',
  '16. White ends; unused Black Plots allowance expires.',
  '17. Black Nb1-c3 is an ordinary Knight jump onto empty c3; e8 safe.',
  '18. Black ends after Nc3; no card or board change.',
  '19. Lost Castle instead of move swaps White a1/Black h8 Rooks; c1 Bishop screens e1, g8 Knight screens e8; lose Q/k rights, draw Crusade.',
  '20. White ends replacement move; only K/q castling rights survive.',
  '21. h7-h5 through empty h6; create h6 opportunity, e8 remains screened.',
  '22. Black ends; h6 en-passant opportunity persists.',
  '23. Bg2-f3: empty diagonal, no capture; h6 opportunity expires.',
  '24. White ends after Bf3; no bonus Bishop move requested.',
  '25. e7-e6: empty forward square; Black King safe behind its pieces.',
  '26. Black ends after e6; no card draw.',
  '27. White Rh8-h6 through empty h7; quiet rook slide, e1 screened.',
  '28. White ends after Rh6; rook retains its original a1 identity.',
  '29. c7-c5 through empty c6; create c6 opportunity, reset clock.',
  '30. Black ends retaining c6 opportunity.',
  '31. Ng1-h3: legal empty Knight landing; expire c6.',
  '32. White ends after Nh3, allowances reset.',
  '33. Nb8-c6: ordinary Knight jump, no capture or King exposure.',
  '34. Black ends after Nc6; clocks do not advance twice.',
  '35. e3-e4: one empty Pawn step; e1 remains safe.',
  '36. White ends after e4 with no optional discard.',
  '37. Nc6-a5: legal Knight jump into empty a5.',
  '38. Black ends after Na5 with no board change.',
  '39. e4-e5: one empty forward square; stops short of Black e6 Pawn.',
  '40. White ends after e5; clock remains zero.',
  '41. Nc3-d5: ordinary empty Knight jump; e8 safe.',
  '42. Black ends after Nd5; White gets its move.',
  '43. Rh6-f6 crosses empty g6; e6 Pawn blocks rook ray toward e8.',
  '44. White ends after Rf6; no capture/draw.',
  '45. Ra8-b8: empty adjacent square; Black loses its last q right.',
  '46. Black ends after Rb8; only White K right remains.',
  '47. Rf6xf7 captures Black original f7 Pawn; clock resets, e8 is not on rook ray.',
  '48. White ends capture turn; captured Pawn stays captured.',
  '49. Nd5-e3: empty Knight jump; attacks d1/f1, not e1.',
  '50. Black ends after Ne3; threatened Queen does not prevent ending.',
  '51. b4xc5 is forward diagonal capture of original c7 Pawn; no en passant.',
  '52. White ends after c5 capture; clock remains zero.',
  '53. g7-g6: empty Black-forward destination; no King exposure.',
  '54. Black ends after g6; no card activity.',
  '55. g4xh5 captures original h7 Pawn diagonally; White Pawn keeps g2 identity.',
  '56. White ends after h5 capture; h7 victim remains captured.',
  '57. Ne3-f5: empty Knight landing, no effect restrictions.',
  '58. Black ends after Nf5; White receives move.',
  '59. Nh3-g1: legal reverse Knight jump; h1 Rook still blocks nothing relevant to e1.',
  '60. White ends after Ng1; no card draw.',
  '61. Rb8-b6 crosses vacant b7 and stops before own b5 Pawn.',
  '62. Black Abduction after Rb6 selects nonroyal White f2 Pawn; temporarily away, conceal identity in history, preserve clocks; draw Doppelganger.',
  '63. Reveal ends ten-second concealment and opens recall; no board/card change.',
  '64. Correct White Pawn/f2/physical-ID answer restores the same f2 Pawn exactly; Abduction remains spent, no second draw.',
  '65. Black ends resolved Abduction turn; White gets normal move.',
  '66. h2-h3: one empty Pawn step, no capture or King exposure.',
  '67. White ends after h3, no discard.',
  '68. Na5-b7: legal empty Knight jump; e8 remains safe.',
  '69. Black ends after Nb7, clocks preserved.',
  '70. Bf3-e4: one empty diagonal; no capture; Crusade not played.',
  '71. White ends after Be4 with no extra move.',
  '72. Nf5-e3: legal empty Knight landing, does not attack e1.',
  '73. Black ends after Ne3; no card activity.',
  '74. d2xe3: forward diagonal capture of original g8 Black Knight; original d2 Pawn survives.',
  '75. White ends after capture; Black Knight remains captured.',
  '76. Bf8xc5: e7 and d6 clear, captures White original b2 Pawn on c5.',
  '77. Figure Dance after capture moves occupied corners simultaneously: h1 White Rook to h8, a1 Black Rook to h1; no capture/promotion, last K right lost, draw Holy War.',
  '78. Black ends Figure Dance turn; g1 Knight screens rook h1 from King e1.',
  '79. Ke1-e2: empty adjacent square; c5 Bishop ray toward f2 is blocked by e3 Pawn, e2 safe.',
  '80. White ends after Ke2 with no remaining castling rights.',
  '81. Rh1xh3 crosses empty h2, captures original White h2 Pawn; Black King safe.',
  '82. Black ends after Rh3 capture; White King e2 is not on rook ray.',
  '83. a2-a3: empty one-square Pawn advance; does not expose e2.',
  '84. White ends after a3; no draw.',
  '85. Betrayal before move replaces enemy e5 Pawn on Black half with captured original h7 Pawn; e2 Pawn becomes dead, clocks/Regular Move preserved; draw Cathedral.',
  '86. Bc5-f8: d6/e7 clear, empty f8; Black uses preserved Regular Move.',
  '87. Black ends after Bf8; Betrayal is already spent.',
  '88. Ng1xh3: Knight captures Black original h8 Rook; e2 safe and clock reset.',
  '89. White ends after Nxh3, no card draw.',
  '90. Nb7-d6: empty Knight jump, Black King safe.',
  '91. Black ends after Nd6; White receives move.',
  '92. Qd1-d3 through empty d2; e3 Pawn still screens e2 from Bishop.',
  '93. White ends after Qd3; no capture.',
  '94. a7-a6: empty Pawn step; reset clock.',
  '95. Black ends after a6; no card activity.',
  '96. Rf7-f5 through empty f6; g6/e6 Pawns do not obstruct vertical path.',
  '97. White ends after Rf5; no direct King attack.',
  '98. Nd6-b7: legal Knight jump to empty b7.',
  '99. Black ends after Nb7, no draw or additional move.',
  '100. Be4-h1 through empty f3/g2; h1 empty after earlier capture sequence.',
  '101. White ends after Bh1, no Crusade played.',
  '102. Bf8-h6 through empty g7; h6 empty, g5/f4/e3 ray blocked before e2.',
  '103. Black ends after Bh6; clocks unchanged by endTurn.',
  '104. Qd3-e4: one empty diagonal; e5 Pawn blocks file toward e8.',
  '105. White ends after Qe4; no card draw.',
  '106. Nb7-d6: legal empty Knight jump, e8 safe.',
  '107. Black ends after Nd6; no automatic repetition claim with hands available.',
  '108. Qe4-d5: one empty diagonal; d6 Knight blocks Queen file toward d8.',
  '109. White ends after Qd5; e6 Pawn blocks Queen diagonal toward e8.',
  '110. Nd6-b7: legal empty Knight jump; d7 Pawn still blocks Queen d5-d8 line.',
  '111. Black ends fiftieth Regular Move; White beforeMove, no unresolved choice or effect.',
];

test('iteration 049: independently reviewed 111 actions and 50 Regular Moves', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/049.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860049);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 7);
  let state = createGameState(trace.initial);
  const project = (s: GameState) => s.pieces.map(({ capturedAtPly: _ply, ...p }) => p);
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1;
    assert.ok(rationales[index]!.startsWith(`${n}. `));
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationales[index]);
    state = result.state;
    assert.deepEqual(state.effects, [], `step ${n}: no Continuing Effects played`);
    assert.equal(state.orientation, 0);
    assert.ok(!state.pendingRescue);
    const expectedPieces = project(before);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const chess = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap();
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! };
      assert.ok(chess.isLegal(move), rationales[index]);
      chess.play(move);
      assert.equal(state.fen, makeFen(chess.toSetup()), rationales[index]);
      const mover = expectedPieces.find(p => p.square === action.from)!;
      const victim = expectedPieces.find(p => p.square === action.to);
      if (victim) { victim.square = null; victim.zone = 'captured'; }
      mover.square = action.to as typeof mover.square;
      const double = mover.role === 'pawn' && Math.abs(Number(action.from[1]) - Number(action.to[1])) === 2;
      assert.deepEqual(state.enPassant, double ? [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}`, pawnId: mover.id }] : []);
      assert.deepEqual(state.turn, { ...before.turn, phase: 'afterMove', moveMade: true });
    } else if (action.type === 'endTurn') {
      assert.equal(state.fen, before.fen);
      assert.deepEqual(state.enPassant, before.enPassant);
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
      assert.equal(state.plotsAllowances?.length ?? 0, 0);
    } else if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black';
      const replacement = before.players[owner].deck[0]!;
      assert.deepEqual(state.players[owner], { ...before.players[owner],
        hand: [...before.players[owner].hand.filter(c => c.id !== action.cardInstanceId), replacement],
        deck: before.players[owner].deck.slice(1),
        discard: [...before.players[owner].discard, before.players[owner].hand.find(c => c.id === action.cardInstanceId)!],
      });
      assert.deepEqual(state.players[owner === 'white' ? 'black' : 'white'], before.players[owner === 'white' ? 'black' : 'white']);
      assert.deepEqual(state.turn, { ...before.turn,
        ...(n === 7 || n === 19 ? { phase: 'afterMove', moveMade: true } : {}),
        cardPlays: { ...before.turn.cardPlays, [owner]: 1 } });
      const shifts: Record<number, Record<string, string>> = {
        7: { 'white-knight-b1': 'g8', 'black-knight-g8': 'b1' },
        19: { 'white-rook-a1': 'h8', 'black-rook-h8': 'a1' },
        77: { 'white-rook-h1': 'h8', 'black-rook-h8': 'h1' },
      };
      for (const [id, square] of Object.entries(shifts[n] ?? {})) expectedPieces.find(p => p.id === id)!.square = square as 'a1';
      if (n === 62) {
        const p = expectedPieces.find(p => p.id === 'white-pawn-f2')!;
        p.square = null; p.zone = 'away';
        assert.equal(state.pendingAbduction?.phase, 'concealment');
        assert.equal(state.pendingAbduction?.pieceId, p.id);
        assert.equal(state.pendingAbduction?.durationMs, 10000);
        assert.equal(state.history.at(-1)?.target, undefined);
      }
      if (n === 85) {
        const dead = expectedPieces.find(p => p.id === 'white-pawn-e2')!;
        dead.square = null; dead.zone = 'dead';
        const returned = expectedPieces.find(p => p.id === 'black-pawn-h7')!;
        assert.equal(returned.zone, 'captured');
        returned.square = 'e5'; returned.zone = 'board';
      }
      if (n === 12 || n === 15) {
        assert.equal(state.fen, before.fen);
        assert.equal(state.plotsAllowances?.[0]?.remaining, 2);
        assert.deepEqual(state.plotsAllowances?.[0]?.eligibleCards, []);
      }
      const tails: Record<number, string> = { 7: 'w KQkq - 1 3', 19: 'b Kq - 3 5', 77: 'w - - 0 19' };
      assert.equal(state.fen.split(' ').slice(1).join(' '), tails[n] ?? before.fen.split(' ').slice(1).join(' '));
      assert.deepEqual(state.enPassant, n === 7 || n === 19 ? [] : before.enPassant);
    } else if (action.type === 'revealAbduction') {
      assert.equal(n, 63);
      assert.equal(state.pendingAbduction?.phase, 'recall');
      assert.equal(state.fen, before.fen);
      assert.deepEqual(state.turn, before.turn);
    } else if (action.type === 'answerAbduction') {
      assert.equal(n, 64);
      const restored = expectedPieces.find(p => p.id === 'white-pawn-f2')!;
      restored.square = 'f2'; restored.zone = 'board';
      assert.equal(state.pendingAbduction, null);
      assert.equal(state.fen, before.pendingAbduction!.before.fen);
      assert.deepEqual(state.turn, before.turn);
    } else assert.fail(`unreviewed action ${n}`);
    assert.deepEqual(project(state), expectedPieces, rationales[index]);
    if (action.type !== 'playCard') assert.deepEqual(state.players, before.players);
  }
  assert.equal(state.fen, '2bqk1NR/1n1p4/pr2p1pb/1p1QpR1P/8/P3P2N/2P1KP2/2B4B w - - 8 27');
  assert.deepEqual(replayTrace(trace), state);
});
