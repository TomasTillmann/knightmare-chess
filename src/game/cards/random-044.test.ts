import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Chess } from 'chessops/chess';
import { makeBoardFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Reviewed against rules §§8–13 and the seven played card artworks/catalog entries.
// Each quiet move leaves both Kings safe; no promotion, neutral, transformed, or
// composite piece occurs. The assertions below independently check ordinary chess.
const rationales = [
  '1. c2-c4 crosses empty c3; double-step offers c3 en passant and resets clock.',
  '2. White closes c4 turn; Black receives the c3 opportunity without another clock tick.',
  '3. b7-b6 advances to empty b6, expires c3, and advances Black fullmove.',
  '4. Black closes b6 turn; White starts with fresh card allowances.',
  '5. a2-a4 crosses empty a3, creating only the a3 opportunity.',
  '6. White closes a4 turn and preserves a3 for Black.',
  '7. e7-e6 is one empty forward step and expires a3.',
  '8. Black closes e6 turn with both Kings screened by their pieces.',
  '9. Ra1-a2 enters the vacated pawn square and permanently loses White queenside castling.',
  '10. White closes Ra2 turn without drawing or changing the board.',
  '11. Black Bombard replaces the move: Ra8-a5 jumps only a7, crosses empty a6, preserves that pawn, loses queenside castling, spends/draws once.',
  '12. Black closes Bombard turn; allowances reset and no extra regular move occurs.',
  '13. Nb1-c3 is an unobstructed knight landing on an empty square.',
  '14. White closes Nc3 turn; the Black rook cannot check through the a4 pawn.',
  '15. f7-f6 advances onto empty f6; Black King e8 remains safe.',
  '16. Black places Forbidden City after the move on empty d6; the continuing card stays in play and draws Vendetta.',
  '17. Black closes f6/City turn; d6 remains blocked for both players.',
  '18. Nc3-b1 returns by knight geometry; d6 has no bearing on this jump.',
  '19. White closes Nb1 turn, preserving the City and all card zones.',
  '20. Bc8-a6 crosses vacated b7; its line toward White stops at c4.',
  '21. Black closes Ba6 turn with no unresolved check or card obligation.',
  '22. e2-e4 crosses empty e3 and offers e3 en passant.',
  '23. Cathedral after e4 swaps owned Ra2 and Bc1, preserving identities and e3 rights; no move or clock tick; draw Knightmare.',
  '24. White closes Cathedral turn, preserving e3 and the swapped identities.',
  '25. Ke8-e7 is adjacent and safe: e4 pawn does not attack it, and a2 bishop is blocked by b3/c4; revoke remaining Black castling.',
  '26. Black closes Ke7 turn; e3 opportunity has expired.',
  '27. Long Jump replaces White move: Nb1-e5 changes square color, lands empty, avoids d6, gives no check on e7, and draws Vendetta.',
  '28. White closes Long Jump; Black starts with a fresh allowance.',
  '29. c7-c6 is one empty forward step; Black King remains safe.',
  '30. White Knightmare immediately rewinds c7-c6 and both clocks; Black must choose another move; spend/draw only White reaction card.',
  '31. Nb8-c6 is a different Black move onto the newly vacated square; White reaction allowance remains spent.',
  '32. Black closes replacement Nc6 turn, resetting both card allowances.',
  '33. Ne5-f3 is an empty knight landing; it does not expose White King.',
  '34. White closes Nf3 turn, preserving Forbidden City.',
  '35. Qd8-b8 crosses empty c8 and lands on the knight-vacated b8.',
  '36. Black closes Qb8 turn with no check.',
  '37. b2-b3 is an empty forward step and resets the clock.',
  '38. White closes b3 turn without an optional discard.',
  '39. Ra5-c5 crosses empty b5; no d6 crossing or capture.',
  '40. Black closes Rc5 turn; White receives its regular move.',
  '41. b3-b4 advances to empty b4 and resets the clock.',
  '42. White Panic is legal after b4; impose 15000ms on Black next move, preserve board/clocks, discard and draw Legacy.',
  '43. White closes Panic turn; Black starts with the timer obligation.',
  '44. Qb8-c8 enters empty c8 before any timeout input; consumes and removes Panic.',
  '45. Black closes Qc8 turn with no remaining timer obligation.',
  '46. Bf1-e2 enters the pawn-vacated e2; White King stays safe.',
  '47. White closes Be2 turn, keeping both card hands unchanged.',
  '48. Qc8-d8 is a one-square horizontal move onto empty d8.',
  '49. Black closes Qd8 turn and advances no additional clock.',
  '50. e4-e5 advances onto empty e5; no capture or promotion.',
  '51. White closes e5 turn with no check on Ke7.',
  '52. Rc5-b5 slides one square onto empty b5.',
  '53. Black closes Rb5 turn; White is free to capture or choose another move.',
  '54. Ke1-f1 enters the vacated safe f1 and loses White remaining castling rights.',
  '55. White closes Kf1 turn; neither side now has castling rights.',
  '56. Ba6-c8 crosses empty b7 and enters empty c8.',
  '57. Black closes Bc8 turn, keeping the rook on b5 capturable.',
  '58. a4xb5 is a forward diagonal pawn capture of physical black-rook-a8; no other piece removed.',
  '59. White closes axb5 turn; Black declines its immediate Hostage window.',
  '60. Qd8-e8 enters the King-vacated e8 and does not expose Ke7.',
  '61. Black Vendetta after Qe8 starts a continuing forced-capture effect; White can capture f6 or c6; draw Abduction.',
  '62. Black closes Vendetta turn; White has captures, so the effect persists.',
  '63. e5xf6 captures original f7 pawn, satisfying Vendetta; f6 pawn attacks e7 King.',
  '64. White closes checking exf6; Black must answer the check.',
  '65. g7xf6 captures the checking original e2 pawn, satisfies Vendetta, and rescues Ke7.',
  '66. Black closes gxf6; White can still capture Nc6 with b5 pawn.',
  '67. b5xc6 captures physical black-knight-b8 and satisfies Vendetta.',
  '68. White closes bxc6; Black can capture that pawn with d7.',
  '69. d7xc6 captures original a2 pawn and satisfies Vendetta, without entering blocked d6.',
  '70. Black closes dxc6; White has no ordinary capture: pawn diagonals empty, bishops/rook/queen screened, Nf3 reaches no enemy. Discard Vendetta.',
  '71. Qd1-e1 is now permitted without capture, as Vendetta expired.',
  '72. White closes Qe1 turn; only Forbidden City remains active.',
  '73. Ng8-h6 jumps to empty h6.',
  '74. Black closes Nh6 turn with safe King e7.',
  '75. d2-d4 crosses empty d3; offer d3 en passant, not blocked d6.',
  '76. White closes d4 turn and preserves d3 for Black.',
  '77. Nh6-f5 jumps to empty f5 and expires d3 availability.',
  '78. Black closes Nf5 turn without captures or draws.',
  '79. d4-d5 advances onto empty d5; it does not enter forbidden d6.',
  '80. White closes d5 turn; Black remains safe.',
  '81. Nf5-d4 enters the newly vacated d4 by knight geometry.',
  '82. Black closes Nd4 turn; the knight attacks e2/f3 but not Kf1.',
  '83. Nf3-h4 evades the attack via an empty knight destination.',
  '84. White closes Nh4 turn without moving or spending another piece/card.',
  '85. a7-a6 is one empty forward step; Bombard never removed this pawn.',
  '86. Black closes a6 turn with no en-passant opportunity.',
  '87. Rc1-c3 crosses empty c2; c4 pawn still blocks its upward file.',
  '88. White closes Rc3 turn, preserving the rook identity swapped by Cathedral.',
  '89. Bf8-h6 crosses g7 vacated by the capture; h6 knight has left.',
  '90. Black closes Bh6 turn; bishop does not attack Kf1.',
  '91. h2-h3 is one empty forward step, with h4 occupied by its own knight.',
  '92. White closes h3 turn and resets no extra clocks.',
  '93. Ke7-f7 is adjacent and safe: Ba2 is blocked by c4, Be2 does not reach f7, and Nh4 does not attack it.',
  '94. Black closes Kf7 turn; castling remains absent.',
  '95. Rc3-f3 crosses empty d3 and e3; f6 pawn blocks any rook check on f7.',
  '96. White closes Rf3 turn with no capture or card play.',
  '97. b6-b5 enters empty b5 and resets halfmove clock.',
  '98. Black closes b5 turn with its King safe behind f6 pawn.',
  '99. g2-g3 enters empty g3 and leaves Kf1 safe.',
  '100. White closes g3 turn with no immediate check.',
  '101. c6xd5 captures physical white-pawn-d2 by Black forward diagonal; other captured identities remain captured.',
  '102. Black closes cxd5 turn, preserving d6 City.',
  '103. White Bombard replaces move with Rf3-e3: optional jump unused, empty destination, no capture/check, spend/draw Fireball once.',
  '104. White closes Bombard turn, giving Black the next regular move.',
  '105. Kf7-e7 enters safe e7: own e6 pawn blocks Re3, and no White minor piece attacks e7.',
  '106. Black closes Ke7 turn; no castling rights return.',
  '107. Qe1-c1 crosses empty d1; c1 rook is now e3 and destination is empty.',
  '108. White closes Qc1 turn; c4 pawn screens its c-file.',
  '109. Bh6-f8 crosses empty g7 and returns to empty f8.',
  '110. Black closes Bf8 turn at fullmove 27; White starts safe with only d6 City active.',
];

test('iteration 044 deterministic trace is replayable', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/044.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860044);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.length, 110);
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 8);
  const city = { type: 'forbidden-city', owner: 'black', card: { id: 'black-deck-0-forbidden-city', cardId: 'forbidden-city' }, square: 'd6' };
  const vendetta = { type: 'vendetta', owner: 'black', card: { id: 'black-deck-1-vendetta', cardId: 'vendetta' } };
  let state = createGameState(trace.initial);
  const snapshots = [state];
  for (const [index, { action }] of trace.steps.entries()) {
    const number = index + 1;
    const reason = rationales[index]!;
    assert.ok(reason.startsWith(`${number}. `));
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, reason);
    state = result.state;
    snapshots.push(state);
    assert.equal(state.pendingRescue ?? false, false, reason);
    assert.equal(state.orientation, 0, reason);
    assert.ok(state.pieces.every(piece => !piece.neutral && !piece.promoted && piece.role === piece.originalRole), reason);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const oracle = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap();
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! };
      assert.ok(oracle.isLegal(move), reason);
      const mover = before.pieces.find(piece => piece.square === action.from)!;
      const victim = before.pieces.find(piece => piece.square === action.to);
      oracle.play(move);
      assert.equal(makeBoardFen(oracle.board), state.fen.split(' ')[0], reason);
      assert.deepEqual(state.pieces, before.pieces.map(piece => piece.id === mover.id
        ? { ...piece, square: action.to } : piece.id === victim?.id
          ? { ...piece, square: null, zone: 'captured', capturedBy: before.turn.color } : piece), reason);
      assert.equal(parseFen(state.fen).unwrap().halfmoves, oracle.halfmoves, reason);
      assert.equal(parseFen(state.fen).unwrap().fullmoves, oracle.fullmoves, reason);
      assert.deepEqual(state.players, before.players, reason);
      if (number >= 63 && number <= 69) assert.ok(victim, 'Vendetta requires these four captures');
      if (number >= 18 && mover.role !== 'knight') {
        const from = parseSquare(action.from)!;
        const to = parseSquare(action.to)!;
        const dx = Math.sign((to % 8) - (from % 8));
        const dy = Math.sign(Math.floor(to / 8) - Math.floor(from / 8));
        for (let square = from + dx + 8 * dy; ; square += dx + 8 * dy) {
          assert.notEqual(square, parseSquare('d6'), reason);
          if (square === to) break;
        }
      }
    } else if (action.type === 'endTurn') {
      assert.equal(state.fen, before.fen, reason);
      assert.deepEqual(state.pieces, before.pieces, reason);
      assert.equal(state.turn.color, before.turn.color === 'white' ? 'black' : 'white', reason);
      assert.equal(state.turn.phase, 'beforeMove', reason);
      assert.equal(state.turn.moveMade, false, reason);
      assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 }, reason);
      assert.deepEqual(state.enPassant, before.enPassant, reason);
      if (number !== 70) assert.deepEqual(state.players, before.players, reason);
    } else if (action.type === 'playCard') {
      const owner = number === 30 ? 'white' : before.turn.color;
      const other = owner === 'white' ? 'black' : 'white';
      assert.ok(before.players[owner].hand.some(card => card.id === action.cardInstanceId), reason);
      assert.deepEqual(state.players[owner].deck, before.players[owner].deck.slice(1), reason);
      assert.deepEqual(state.players[owner].hand, [...before.players[owner].hand.filter(card => card.id !== action.cardInstanceId), before.players[owner].deck[0]], reason);
      assert.deepEqual(state.players[other], before.players[other], reason);
      assert.equal(state.turn.cardPlays[owner], 1, reason);
      assert.deepEqual(state.players[owner].discard, [16, 61].includes(number) ? before.players[owner].discard
        : [...before.players[owner].discard, { id: action.cardInstanceId, cardId: action.cardId }], reason);
    }
    assert.deepEqual(state.effects, [
      ...(number >= 16 ? [city] : []),
      ...(number >= 42 && number < 44 ? [{ type: 'panic', owner: 'white', player: 'black', durationMs: 15000 }] : []),
      ...(number >= 61 && number < 70 ? [vendetta] : []),
    ], reason);
  }
  assert.equal(snapshots[11]!.pieces.find(piece => piece.id === 'black-pawn-a7')!.square, 'a7');
  assert.equal(snapshots[11]!.pieces.find(piece => piece.id === 'black-rook-a8')!.square, 'a5');
  assert.equal(snapshots[23]!.pieces.find(piece => piece.id === 'white-rook-a1')!.square, 'c1');
  assert.equal(snapshots[23]!.pieces.find(piece => piece.id === 'white-bishop-c1')!.square, 'a2');
  assert.deepEqual(snapshots[23]!.enPassant, [{ target: 'e3', pawnId: 'white-pawn-e2' }]);
  assert.equal(snapshots[27]!.pieces.find(piece => piece.id === 'white-knight-b1')!.square, 'e5');
  assert.deepEqual(snapshots[30]!.pieces, snapshots[28]!.pieces);
  assert.equal(snapshots[30]!.fen, snapshots[28]!.fen);
  assert.equal(snapshots[30]!.turn.moveMade, false);
  const noCaptures = Chess.fromSetup(parseFen(snapshots[70]!.fen).unwrap()).unwrap();
  for (const [from, destinations] of noCaptures.allDests()) {
    for (const to of destinations) assert.ok(!noCaptures.board.get(to) || noCaptures.board.get(to)!.color === noCaptures.board.get(from)!.color, 'White has no ordinary capture when Vendetta expires');
  }
  assert.deepEqual(snapshots[70]!.players.black.discard.map(card => card.cardId), ['bombard', 'vendetta']);
  assert.equal(state.fen, '2b1qb1r/2p1k2p/p3pp2/1p1p4/1PPn3N/4R1PP/B3BP2/2Q2KNR w - - 4 27');
  assert.deepEqual(state, replayTrace(trace));
});
