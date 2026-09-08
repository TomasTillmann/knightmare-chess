import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { attacks } from 'chessops/attacks';
import { parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/082.json', import.meta.url), 'utf8')) as RandomTrace;
// Independently reviewed in order against rules §§8–13, 18.5, 19.2, 20–22 and card metadata.
// Non-capture moves increment the halfmove clock; Pawns/captures reset it. Black moves
// advance fullmove. EndTurn preserves both clocks and resets both card allowances.
// No transformations, neutral pieces, promotions, or continuing capture restrictions occur.
const rationale = [
  '1. b2-b4 crosses empty b3; e1/e8 Kings sheltered, b3 en-passant opportunity opens.',
  '2. White ends safely; b4 and b3 opportunity persist into Black turn.',
  '3. f7-f5 crosses empty f6; neither King exposed; replaces b3 opportunity with f6.',
  '4. Black ends safely at fullmove 2; White receives f6 opportunity.',
  '5. h2-h3 advances into empty h3, expires f6; e1 remains sheltered.',
  '6. White ends with h3 Pawn and unchanged board.',
  '7. c7-c6 is one empty forward square; e8 safe, fullmove 3.',
  '8. Black ends; no capture, card, or pending effect.',
  '9. h1-h2 moves Rook to Pawn-vacated square; permanently loses White kingside castling.',
  '10. White ends safely with Rook h2 and only queenside right.',
  '11. b7-b6 advances into empty b6; no e8 attack.',
  '12. Black ends at fullmove 4; no other state change.',
  '13. h2-h1 returns same Rook; kingside castling is not restored.',
  '14. White ends with h1 Rook and safe e1.',
  '15. e7-e5 crosses empty e6; e8 remains safe; e6 opportunity opens.',
  '16. Black ends at fullmove 5, preserving e6 opportunity.',
  '17. e2-e3 moves Pawn one step; e6 opportunity expires, e1 safe.',
  '18. White ends safely with e3 Pawn.',
  '19. a7-a5 crosses a6; e8 safe, a6 opportunity opens.',
  '20. Black ends; White receives a6 opportunity at fullmove 6.',
  '21. Qd1-e2 is adjacent diagonal into vacated e2; e1 safe; expires a6.',
  '22. White ends with Queen e2; all hands unchanged.',
  '23. h7-h5 crosses h6; no e8 threat; h6 opportunity opens.',
  '24. Black ends at fullmove 7 preserving h6 opportunity.',
  '25. Qe2-d1 returns on clear diagonal; expires h6, e1 safe.',
  '26. White ends; e1/e8 remain sheltered.',
  '27. Bf8xb4 crosses e7,d6,c5 empty; captures original b2 Pawn. d2 still blocks b4-c3-d2-e1 ray.',
  '28. Black ends safely; captured b2 Pawn available for return.',
  '29. Winged Victory returns exactly captured b2 Pawn to empty central d4 instead of move; no check or promotion; spends/draws Dubbing.',
  '30. White ends after replacement; d4 Pawn remains, card allowance resets.',
  '31. Madman jumps original d7 Pawn over occupied c6 to empty b5; c6 Pawn survives, no check; spends/draws Blessing.',
  '32. Black ends after Pawn replacement, fullmove 9.',
  '33. Ghostwalk c2-c4 uses normal double-step with empty c3,c4; d2 still shields e1; c3 en-passant opens; draws Squaring the Circle.',
  '34. White ends; c3 opportunity retained for Black.',
  '35. Qd8-f6 crosses empty e7; no capture, expires c3; black e8 safe.',
  '36. Fireball eligible after quiet Qf6; captures center Queen plus e5,f5,g7 Pawns only, King e8 outside blast; neither King checked; draws Fanatic.',
  '37. Black ends after blast, fullmove remains 10; no extra move.',
  '38. g2-g4 crosses g3; d2 shields e1 from Bb4; opens g3 opportunity.',
  '39. White ends with safe e1 and g3 opportunity.',
  '40. Long Jump relocates g8 Knight to empty opposite-color c7; e8 safe, no check to e1; clears g3, draws Abduction.',
  '41. Black ends after Knight replacement at fullmove 11.',
  '42. Bc1-b2 is one empty diagonal; no e1 exposure.',
  '43. White ends with original c1 Bishop b2.',
  '44. Bc8-e6 crosses empty d7; neither King checked.',
  '45. Black ends with distinct Bishops e6 and b4.',
  '46. g4-g5 advances into empty g5; no capture or King exposure.',
  '47. White ends, halfmove clock remains zero.',
  '48. Blessing moves original c8 Bishop e6-f7 diagonally to empty square; no capture or check; draws Legacy.',
  '49. Black ends at fullmove 13; Bishop f7 retains identity.',
  '50. a2-a3 advances into empty a3; e1 still protected by d2.',
  '51. White ends with a3 Pawn and safe e1.',
  '52. Original b8 Knight jumps to empty a6; separate g8 Knight stays c7.',
  '53. Black ends at fullmove 14, e8 safe.',
  '54. Ra1-a2 enters vacated a2; loses White final castling right, e1 safe.',
  '55. White ends with Rook a2, no White castling rights.',
  '56. Original d7 Pawn b5xc4 captures original c2 Pawn diagonally forward; e8 safe.',
  '57. Black ends after capture with zero halfmove clock.',
  '58. Nb1-c3 jumps to empty square; c3 Knight and d2 Pawn shield e1 from Bb4.',
  '59. White ends with restored b2 Pawn d4 and Knight c3.',
  '60. Original c8 Bishop f7-g8 moves one diagonal to empty g8; e8 safe.',
  '61. Black ends at fullmove 16; Bishops g8/b4 remain distinct.',
  '62. Qd1xh5 crosses e2,f3,g4 empty; captures h7 Pawn. Qh5 checks e8 along empty g6,f7; e1 safe.',
  '63. White may end while checking Black; Black receives escape turn.',
  '64. Bb4-f8 crosses empty c5,d6,e7 but does not answer Qh5-g6-f7-e8 check; only provisional move with Abduction rescue available.',
  '65. Abduction hides opposing nonroyal Nc3 after provisional move, draws Panic; concealment alone cannot settle King safety.',
  '66. Reveal moves concealment to recall only; Knight remains away, no second spend or clock advance.',
  '67. Timeout capture of Nc3 cannot cure Qh5 check on e8; failed rescue restores Nc3 and Bb4 plus pre-move clocks, retains spent Abduction/drawn Panic.',
  '68. Ke8-f8 escapes Qh5 diagonal; f8 is empty and unattacked, loses Black castling; no second card permitted.',
  '69. Black ends safely on f8 with Abduction allowance consumed until reset.',
  '70. Qh5-f3 crosses empty g4; checks f8 on clear f4,f5,f6,f7 file, e1 remains safe.',
  '71. White ends giving file check; Black gets escape turn.',
  '72. Guardian c6-c5 cannot remove Qf3-f8 check, so replacement fizzles; original c6 Pawn and c7 Knight stay, card spent/draws Hidden Passage, Regular Move retained.',
  '73. Kf8-e7 leaves Queen f-file and is not on Qf3 diagonal; e7 unattacked, legal check escape.',
  '74. Black ends safely at fullmove 18; spent Guardian cannot be replayed.',
  '75. Nc3-a4 jumps to empty a4; vacating c3 still leaves d2 on Bb4-c3-d2-e1 ray.',
  '76. White ends with safe e1 and Knight a4.',
  '77. Forced March original c7 Pawn c6-d6 slides sideways into empty d6; e7 safe, no direct check, draws Cathedral.',
  '78. Black ends replacement with zero halfmove clock and fullmove 19.',
  '79. Returned original b2 Pawn d4-d5 advances into empty d5; cannot capture forward d6 Pawn; e1 safe.',
  '80. White ends with adjacent opposed Pawns d5/d6.',
  '81. Original f8 Bishop b4xa3 captures a2 Pawn on adjacent diagonal; e7 safe.',
  '82. Black ends, a3 Bishop distinct from g8 Bishop.',
  '83. g5-g6 advances one empty square; no promotion, e1 safe.',
  '84. White ends with g6 Pawn attacking f7/h7, neither King.',
  '85. Rh8-h7 enters empty square attacked by g6 Pawn; nonroyal Rook may be en prise, e7 safe.',
  '86. Black ends at fullmove 21 with Rook h7.',
  '87. Qf3-f4 advances one empty file square; e1 remains safe.',
  '88. White ends with Queen f4, no check on e7.',
  '89. Fanatic original d7 Pawn c4-c1 crosses empty c3,c2,c1 exactly three forward; stays Pawn on back rank, no en-passant; draws Curse.',
  '90. Black ends at fullmove 22; unpromoted c1 Pawn remains valid by Fanatic rule.',
  '91. Original d2 Pawn d2-d4 crosses empty d3; separate returned b2 Pawn stays d5; e1 safe, d3 opportunity opens.',
  '92. White ends preserving d3 opportunity.',
  '93. Ba3-b4 moves one diagonal; now checks e1 along empty c3,d2; expires d3.',
  '94. Black ends giving check; White receives escape turn.',
  '95. Ke1-d1 sidesteps b4-c3-d2-e1 diagonal; c1 black Pawn attacks offboard, d1 safe.',
  '96. White ends safely on d1, no castling rights.',
  '97. Bb4-d2 crosses empty c3; Bishop d2 does not attack adjacent vertical d1 King; e7 safe.',
  '98. Panic is legal after Black move; board/clocks unchanged, White next legal move timed 15000ms; spends/draws Dungeon.',
  '99. Black ends; Panic persists into White beforeMove, allowances reset.',
  '100. Bf1-d3 crosses empty e2; legal timely move clears Panic, d1 remains safe.',
  '101. White ends; timed obligation already fulfilled, no forfeiture.',
  '102. Original c8 Bishop g8-f7 moves diagonal into empty f7, even though g6 Pawn attacks it; Black e7 safe.',
  '103. Black ends at fullmove 25; no King attacked.',
  '104. Qf4-e5 one diagonal gives e7 check through empty e6; White d1 safe.',
  '105. White ends giving file check, Black receives escape turn.',
  '106. Original g8 Knight c7xd5 captures returned b2 Pawn but leaves Qe5-e6-e7 check; provisional rescue only.',
  '107. Cathedral Ra8/Bd2 swap cannot cure e-file check; restore both and rewind Knight capture, reviving d5 Pawn; spent Cathedral draws Breakthrough.',
  '108. White Vulture reacts immediately to spent Black Cathedral even after rewind; takes that physical card, discards top Panic, draws Irresistible Force, board/clocks unchanged.',
  '109. Original c7 Pawn d6xe5 captures checking Queen diagonally forward and cures e7 check; both card allowances already consumed.',
  '110. Black ends safely after actual capture, resets both allowances.',
  '111. g6-g7 advances into empty g7; attacks f8/h8 only, no promotion yet.',
  '112. White ends with g7 Pawn and safe d1.',
  '113. Original f8 Bishop d2-e1 moves adjacent diagonal; e1 Bishop does not attack d1 horizontally; e7 safe.',
  '114. Black ends safely with Bishop e1.',
  '115. Original f1 Bishop d3-f5 crosses empty e4; no d1 exposure or check on e7.',
  '116. White plays Vulture-acquired Cathedral after move, swaps original Ra1 at a2 with original Bc1 at b2; neither King checked, unchanged clocks, draws Legacy.',
  '117. White ends with Ra1 identity b2 and Bc1 identity a2.',
  '118. Hidden Passage moves Black royal e7-b7 ignoring intervening c7 Knight; b7 empty and safe, b6 Pawn blocks White Rb2 file; draws Vulture.',
  '119. Black ends replacement at fullmove 28; no new castling or en-passant.',
  '120. White Rb2-e2 crosses empty c2,d2; e2 Rook safe to move, d1 remains unattacked.',
  '121. White ends with Rook e2, unchanged hands.',
  '122. Original g8 Knight c7-e6 jumps empty; b7 safe, White f5 Bishop ray toward b9 never reaches b7.',
  '123. Black ends safely, both Kings remain d1/b7; 50 regular move commands reviewed including two subsequently rewound.',
];

test('iteration 082 reviewed deterministic campaign', () => {
  assert.equal(trace.seed, 860082);
  assert.equal(rationale.length, trace.steps.length);
  rationale.forEach((line, index) => assert.ok(line.startsWith(`${index + 1}. `)));
  replayTrace(trace);
});

test('iteration 082 independently checked geometry, safety, clocks, and card outcomes', () => {
  let state = createGameState(trace.initial);
  const states = [state];
  const checked = (fen: string, color: 'white' | 'black') => {
    const board = parseFen(fen).unwrap().board;
    const king = board.pieces(color, 'king').singleSquare()!;
    return [...board[color === 'white' ? 'black' : 'white']].some(square =>
      attacks(board.get(square)!, square, board.occupied).has(king));
  };
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1;
    const before = state;
    const result = applyAction(before, step.action);
    assert.ok(result.ok, rationale[index]);
    state = result.state;
    states.push(state);
    const action = step.action;
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const board = parseFen(before.fen).unwrap().board;
      const from = parseSquare(action.from)!;
      const to = parseSquare(action.to)!;
      const piece = board.get(from)!;
      assert.equal(piece.color, before.turn.color);
      const captured = board.get(to);
      assert.notEqual(captured?.color, piece.color);
      assert.notEqual(captured?.role, 'king');
      if (piece.role === 'pawn') {
        const direction = piece.color === 'white' ? 8 : -8;
        if (captured) assert.ok(to - from === direction - 1 || to - from === direction + 1);
        else {
          assert.ok(to - from === direction || to - from === 2 * direction);
          if (to - from === 2 * direction) {
            assert.equal(Math.floor(from / 8), piece.color === 'white' ? 1 : 6);
            assert.equal(board.get(from + direction), undefined);
          }
        }
      } else assert.ok(attacks(piece, from, board.occupied).has(to), rationale[index]);
      assert.equal(checked(state.fen, before.turn.color), n === 64 || n === 106, rationale[index]);
      assert.equal(Boolean(state.pendingRescue), n === 64 || n === 106);
      const oldFen = parseFen(before.fen).unwrap();
      const newFen = parseFen(state.fen).unwrap();
      assert.equal(newFen.halfmoves, piece.role === 'pawn' || captured ? 0 : oldFen.halfmoves + 1);
      assert.equal(newFen.fullmoves, oldFen.fullmoves + Number(piece.color === 'black'));
    }
    if (action.type === 'endTurn') {
      assert.equal(checked(before.fen, before.turn.color), false, rationale[index]);
      assert.equal(state.fen, before.fen);
      assert.deepEqual(state.pieces, before.pieces);
      assert.deepEqual(state.players, before.players);
      assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 });
      assert.equal(state.turn.phase, 'beforeMove');
      assert.equal(state.turn.color, before.turn.color === 'white' ? 'black' : 'white');
    }
    if (action.type === 'playCard') {
      const actor = (['white', 'black'] as const).find(color => before.players[color].hand.some(card => card.id === action.cardInstanceId))!;
      assert.ok(actor);
      assert.equal(state.turn.cardPlays[actor], before.turn.cardPlays[actor] + 1);
      assert.equal(state.players[actor].deck.length, before.players[actor].deck.length - (action.cardId === 'vulture' ? 2 : 1));
      assert.equal(state.players[actor].hand.length, before.players[actor].hand.length + Number(action.cardId === 'vulture'));
      assert.ok(state.players[actor].discard.some(card => card.id === action.cardInstanceId));
    }
  }
  const piece = (n: number, id: string) => states[n]!.pieces.find(p => p.id === id)!;
  assert.equal(piece(29, 'white-pawn-b2').square, 'd4');
  assert.equal(piece(31, 'black-pawn-d7').square, 'b5');
  assert.equal(piece(31, 'black-pawn-c7').square, 'c6');
  assert.deepEqual(states[33]!.enPassant, [{ target: 'c3', pawnId: 'white-pawn-c2' }]);
  assert.deepEqual(states[36]!.pieces.filter(p => p.zone === 'captured').map(p => p.id).sort(),
    ['black-pawn-e7', 'black-pawn-f7', 'black-pawn-g7', 'black-queen-d8'].sort());
  assert.equal(piece(40, 'black-knight-g8').square, 'c7');
  assert.equal(piece(48, 'black-bishop-c8').square, 'f7');
  assert.equal(piece(65, 'white-knight-b1').zone, 'away');
  assert.equal(states[65]!.pendingAbduction?.phase, 'concealment');
  assert.equal(states[66]!.pendingAbduction?.phase, 'recall');
  assert.equal(states[67]!.fen, states[63]!.fen);
  assert.deepEqual(states[67]!.pieces, states[63]!.pieces);
  assert.equal(states[67]!.pendingAbduction, null);
  assert.equal(states[67]!.turn.cardPlays.black, 1);
  assert.equal(states[72]!.fen, states[71]!.fen);
  assert.deepEqual(states[72]!.pieces, states[71]!.pieces);
  assert.equal(states[72]!.turn.moveMade, false);
  assert.equal(piece(77, 'black-pawn-c7').square, 'd6');
  assert.equal(piece(89, 'black-pawn-d7').square, 'c1');
  assert.equal(piece(89, 'black-pawn-d7').role, 'pawn');
  assert.equal(piece(89, 'black-pawn-d7').promoted, false);
  assert.deepEqual(states[89]!.enPassant, []);
  assert.deepEqual(states[98]!.effects, [{ type: 'panic', owner: 'black', player: 'white', durationMs: 15000 }]);
  assert.deepEqual(states[99]!.effects, states[98]!.effects);
  assert.deepEqual(states[100]!.effects, []);
  assert.equal(states[107]!.fen, states[105]!.fen);
  assert.deepEqual(states[107]!.pieces, states[105]!.pieces);
  assert.equal(states[107]!.turn.cardPlays.black, 1);
  assert.ok(states[108]!.players.white.hand.some(card => card.id === 'black-deck-6-cathedral'));
  assert.ok(!states[108]!.players.black.discard.some(card => card.id === 'black-deck-6-cathedral'));
  assert.deepEqual(states[108]!.players.white.discard.map(card => card.cardId), ['winged-victory', 'ghostwalk', 'panic', 'vulture']);
  assert.equal(piece(109, 'white-queen-d1').zone, 'captured');
  assert.equal(piece(109, 'black-pawn-c7').square, 'e5');
  assert.equal(piece(116, 'white-rook-a1').square, 'b2');
  assert.equal(piece(116, 'white-bishop-c1').square, 'a2');
  assert.equal(states[116]!.fen.split(' ').slice(1).join(' '), states[115]!.fen.split(' ').slice(1).join(' '));
  assert.equal(piece(118, 'black-king-e8').square, 'b7');
  assert.equal(checked(states[118]!.fen, 'black'), false);
  assert.equal(state.fen, 'r7/1k3bPr/np2n3/p2PpB2/N2P4/4P2P/B3RP2/2pKb1NR w - - 5 29');
});
