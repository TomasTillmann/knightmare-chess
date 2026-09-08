// Iteration 069: awaiting fresh deterministic review.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { Chess } from 'chessops/chess';
import { parseFen, makeBoardFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';

const rationales = [
  '1. Long Jump replaces White move: Nb1 goes to empty opposite-color h6, jumping the army; Ke1 stays screened; halfmove 1; draw Vulture, discard Long Jump.',
  '2. End White replacement move; Black begins with fresh allowances; FEN remains b at move 1.',
  '3. d7-d6 is one unobstructed Black pawn step; Ke8 safe; halfmove resets and fullmove becomes 2.',
  '4. End Black turn; White begins; no additional clock, piece, or card change.',
  '5. h2-h4 crosses empty h3 to empty h4; Ke1 safe; record h3 en-passant for that pawn and reset halfmove.',
  '6. End White turn; preserve h3 opportunity for Black and reset both card allowances.',
  '7. e7-e6 is an empty forward pawn step; Ke8 safe; h3 opportunity expires; fullmove 3.',
  '8. Black after-move Man-Trap selects its pawn on e6; no arrival now; keep physical card active and draw Irresistible Force.',
  '9. End Black turn; e6 trap persists without board or clock change.',
  '10. c2-c3 is a clear pawn step; Ke1 remains protected; no trap arrival; halfmove resets.',
  '11. Figure Dance rotates a1-h1-h8-a8-a1 simultaneously; four Rook identities swap corners, no capture or promotion; all castling rights lost; c1/f8 still screen Kings; draw Mystic Shield.',
  '12. End White turn after Figure Dance; Black begins, all four rooks remain at rotated corners.',
  '13. a7-a6 is one clear pawn step; Black King remains screened by Bf8; fullmove 4.',
  '14. End Black turn; White receives allowance with no further board or clock change.',
  '15. Original Ra1 now moves h1-h2 into the square vacated by the h-pawn; Ke1 safe; halfmove 1.',
  '16. End White turn; Black begins; trap e6 stays square-bound.',
  '17. Qd8-f6 follows empty e7 diagonal to empty f6; Ke8 stays safe; halfmove 2 and fullmove 5.',
  '18. End Black turn; White begins with unchanged cards and pieces.',
  '19. h4-h5 is a clear White pawn step, stopping before own Nh6; Ke1 safe; halfmove resets.',
  '20. White after-move Man-Trap chooses occupied friendly Ng1 square; keep card active, draw Abduction; neither King changes safety.',
  '21. End White turn; both e6 and g1 traps persist and Black allowance resets.',
  '22. Qf6-g6 is one horizontal step into empty g6; Ke8 safe behind Bf8; halfmove 1, fullmove 6.',
  '23. End Black turn; White begins; no en-passant remains.',
  '24. b2-b3 is an empty forward pawn step; Bc1 still blocks black Ra1 from Ke1; halfmove resets.',
  '25. End White turn; Black begins with fresh card allowance.',
  '26. Original Rh8 moves a8-a7 into its pawn-vacated square; Ke8 safe; halfmove 1, fullmove 7.',
  '27. End Black turn; White begins without changing the e6/g1 trap records.',
  '28. Original Rh1 captures Ng8 from h8, one horizontal step; Bf8 still blocks check on Ke8; capture resets clock and preserves physical captured Knight.',
  '29. End White capture turn; Black begins with no automatic card draw.',
  '30. Bc8-d7 is one empty diagonal step; Bf8 still shields Ke8; halfmove 1, fullmove 8.',
  '31. End Black turn; White begins with board and clocks unchanged.',
  '32. Rg8-h8 returns horizontally to empty h8; Ke1 safe; halfmove 2.',
  '33. Haunting Memories copies last declared nonunique Man-Trap, at its after-move timing, targeting own Pe2; its physical card remains active; draw Toll.',
  '34. End White turn; all three independently identified traps persist.',
  '35. Qg6-f6 moves one empty horizontal square; neither royal line opens; halfmove 3, fullmove 9.',
  '36. End Black turn; White begins with unchanged three traps.',
  '37. Rh2-h1 returns along one empty square; Ke1 stays safe; halfmove 4.',
  '38. End White turn; Black begins; no piece, card, or clock effect.',
  '39. b7-b6 is one empty forward Black pawn step; Ke8 safe; halfmove reset, fullmove 10.',
  '40. Black plays after-move Vendetta, kept active; White can capture Bf8 with Rh8, so effect persists; draw Cathedral.',
  '41. End Black turn; White must capture under Vendetta, with Rh8xf8 available.',
  '42. Rh8xf8 crosses empty g8 and takes Bf8; satisfies Vendetta and checks Ke8; Kxf8 is an escape, not mate; clock reset.',
  '43. End White turn in legal checking position; Black receives its response turn and must capture if legal.',
  '44. Ke8xf8 captures checking rook adjacent; Nh6 attacks f7/f5/g8/g4, not f8; safe Vendetta capture; fullmove 11.',
  '45. Cathedral after move swaps own Ra7 and Bd7 simultaneously; Bishop a7 is blocked by Pb6; neither King exposed; discard card and draw Fanatic.',
  '46. End Black turn; White has Nh6xf7 and must capture; Cathedral did not consume another move.',
  '47. Nh6xf7 is a legal 2-by-1 capture of Black f-pawn; Kf8 is not attacked by Nf7; Vendetta satisfied; clock reset.',
  '48. End White turn; Black has legal Ra1xc1 so Vendetta stays active.',
  '49. Ra1xc1 crosses empty b1 and captures Bc1; Qd1 still blocks Ke1; legal Vendetta capture; fullmove 12.',
  '50. End Black turn; White has legal Nf7xd6 and must capture.',
  '51. Nf7xd6 captures the d-pawn by a 2-by-1 jump; Qd1 continues screening Ke1; Vendetta fulfilled; clock reset.',
  '52. End White turn; Black has Rc1xd1 and Rd7xd6 captures available.',
  '53. Rc1xd1 captures White queen one square horizontally, giving check to adjacent Ke1; Kxd1 can escape; clock reset, fullmove 13.',
  '54. End Black turn; White has a checked King but safe capturing response Kxd1.',
  '55. Ke1xd1 captures checking Rook; own Nd6 blocks Rd7 down the d-file; Kd1 is safe and Vendetta fulfilled.',
  '56. End White turn; Black Qf6xc3 follows a clear diagonal and keeps Vendetta applicable.',
  '57. Qf6xc3 crosses empty e5/d4 and captures Pc3; Kd1 is not on its line; physical pawn captured, clock reset, fullmove 14.',
  '58. End Black turn; White can capture queen on c3 with Pd2, so Vendetta persists.',
  '59. Pd2xc3 captures diagonally forward; Nd6 still blocks Black rook from Kd1; capture resets halfmove.',
  '60. End White turn; Black Rd7xd6 is available and obligatory capture under Vendetta.',
  '61. Rd7xd6 captures White knight adjacent and opens d5-d4-d3-d2-d1 to check Kd1; White has escape Kc2; clock reset/fullmove 15.',
  '62. End Black turn; White has no legal capture, so Vendetta expires into Black discard; three Man-Traps remain.',
  '63. a2-a4 crosses empty a3 but leaves Kd1 checked by Rd6; legal only as pending rescue under 11.6, with Abduction available; record a3 temporarily.',
  '64. Mystic Shield on moved Pa4 cannot remove Rd6 check: card fizzles/spends/draws Ghostwalk; unsuccessful rescue rolls Pa4 back to a2, restores pre-move FEN and opens replacement move.',
  '65. Kd1-c2 is one diagonal step out of Rd6 line; Ba7 blocked by Pb6 and no other attack reaches c2; halfmove 1, White allowance stays spent.',
  '66. End rescued White turn; Black starts; no lingering shield and all traps preserved.',
  '67. Guardian moves Ph7-h6 into empty square, no follower behind at h8; replaces Black move, grants no en-passant, resets clock/fullmove16; draw Madman.',
  '68. End Black Guardian turn; White begins with no additional clock increment.',
  '69. Ghostwalk uses otherwise legal noncapturing Pf2-f3 into empty f3; passing through own pieces is optional; Kc2 safe; move and card consumed, draw Knightmare.',
  '70. End White Ghostwalk turn; Black starts with unchanged three traps.',
  '71. Kf8-f7 is an empty adjacent step; Bf1 is blocked by Pg2, Nh3 is not yet there, remaining pieces do not attack f7; fullmove17, halfmove1.',
  '72. End Black turn; White begins with same pieces and cards.',
  '73. Ng1-h3 jumps legally to empty h3; Kc2 remains safe; vacating own trap g1 neither triggers nor cancels it; halfmove2.',
  '74. End White turn; Black begins; empty g1 remains trapped.',
  '75. Irresistible Force Ph6-h5 pushes White Ph5 to empty h4; neither Pawn captured or promoted, no King in chain; Kf7 and Kc2 safe; reset clock/fullmove18; draw Evil Eye.',
  '76. End Black replacement move; White begins; no en-passant from the push and traps remain.',
  '77. Kc2-d3 is adjacent but exposed to Rd6 through empty d5/d4; pending rescue is valid because Abduction d6 followed by failed recall removes rook; runner incorrectly rejects this pending intermediate action.',
];

test('iteration 069: independently reviewed prefix and omitted Abduction continuation', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/069.stalled.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.moves, 32);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 11);
  let state = createGameState(trace.initial);
  const specialMoves = new Set([63, 77]);
  for (const [index, step] of trace.steps.entries()) {
    assert.ok(rationales[index]!.startsWith(`${index + 1}. `));
    const before = state;
    const result = applyAction(before, step.action);
    assert.ok(result.ok, rationales[index]);
    state = result.state;
    if (step.action.type === 'move') {
      const action = step.action;
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const chess = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap();
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! };
      assert.equal(chess.isLegal(move), !specialMoves.has(index + 1), rationales[index]);
      if (!specialMoves.has(index + 1)) {
        chess.play(move);
        assert.equal(state.fen.split(' ')[0], makeBoardFen(chess.board));
        assert.equal(state.fen.split(' ').slice(4).join(' '), `${chess.halfmoves} ${chess.fullmoves}`);
      }
      assert.equal(!!state.pendingRescue, specialMoves.has(index + 1));
    }
    if (step.action.type === 'endTurn') {
      assert.equal(state.fen, before.fen);
      assert.deepEqual(state.pieces, before.pieces);
      assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 });
    }
    if (step.action.type === 'playCard') {
      const action = step.action;
      const owner = before.turn.color;
      assert.equal(state.players[owner].deck.length, before.players[owner].deck.length - 1);
      assert.deepEqual(state.players[owner].hand, [...before.players[owner].hand.filter(c => c.id !== action.cardInstanceId), before.players[owner].deck[0]]);
      assert.equal(state.turn.cardPlays[owner], 1);
    }
    if (index + 1 === 11) {
      assert.deepEqual(['white-rook-a1', 'white-rook-h1', 'black-rook-a8', 'black-rook-h8'].map(id => state.pieces.find(p => p.id === id)!.square), ['h1', 'h8', 'a1', 'a8']);
      assert.equal(state.fen.split(' ')[2], '-');
    }
    if (index + 1 === 33) assert.deepEqual(state.effects, [
      { type: 'man-trap', owner: 'black', card: { id: 'black-hand-4-man-trap', cardId: 'man-trap' }, square: 'e6' },
      { type: 'man-trap', owner: 'white', card: { id: 'white-hand-3-man-trap', cardId: 'man-trap' }, square: 'g1' },
      { type: 'man-trap', owner: 'white', card: { id: 'white-hand-2-haunting-memories', cardId: 'haunting-memories' }, square: 'e2' },
    ]);
    if (index + 1 === 62) {
      assert.equal(state.effects.length, 3);
      assert.equal(state.players.black.discard.at(-1)!.cardId, 'vendetta');
    }
    if (index + 1 === 64) {
      assert.equal(state.fen, '1n3k2/b1p3pp/pp1rp3/7P/8/1PP5/P3PPP1/3K1BNR w - - 0 15');
      assert.equal(state.turn.moveMade, false);
      assert.equal(state.effects.length, 3);
    }
    if (index + 1 === 75) {
      assert.equal(state.pieces.find(p => p.id === 'white-pawn-h2')!.square, 'h4');
      assert.equal(state.pieces.find(p => p.id === 'black-pawn-h7')!.square, 'h5');
      assert.deepEqual(state.enPassant, []);
    }
  }
  assert.equal(state.fen, '1n6/b1p2kp1/pp1rp3/7p/7P/1PPK1P1N/P3P1P1/5B1R b - - 1 18');
  // Rules 11.6 and 19.2 permit a pending memory challenge as a rescue intermediate.
  const abduction = state.players.white.hand.find(c => c.cardId === 'abduction')!;
  assert.ok(cardPlayTargets(state, 'abduction').includes('d6'));
  for (const action of [
    { type: 'playCard', cardId: 'abduction', cardInstanceId: abduction.id, target: 'd6' },
    { type: 'revealAbduction' },
    { type: 'abductionTimeout' },
    { type: 'endTurn' },
  ] as const) {
    const result = applyAction(state, action);
    assert.ok(result.ok);
    state = result.state;
  }
  assert.equal(state.pendingRescue, null);
  assert.equal(state.pieces.find(p => p.id === 'black-rook-h8')!.zone, 'captured');
  assert.equal(state.pieces.find(p => p.royal && p.owner === 'white')!.square, 'd3');
  assert.equal(state.fen, '1n6/b1p2kp1/pp2p3/7p/7P/1PPK1P1N/P3P1P1/5B1R b - - 0 18');
});

const continuedRationales = [...rationales.slice(0, 63),
  '64. Abduction after staged a2-a4 selects unprotected enemy Pa6; conceal the same pawn away without capture, preserving a3 and clocks; draw Ghostwalk; rescue remains pending until recall resolves.',
  '65. Reveal ends concealment and opens recall only; Pa6 remains away and no piece, card, clock, or move changes.',
  '66. Black correctly recalls physical Pa6; return it, but Rd6 still checks Kd1, so failed rescue also rolls a4 back to a2 and restores pre-move clocks/en-passant; Abduction remains spent.',
  '67. Kd1-c1 steps to adjacent empty c1 away from Rd6 file; Ba7 is blocked by Pb6, no enemy attack reaches c1; halfmove1, allowance remains spent.',
  '68. End White replacement move; Black starts with fresh allowances and unchanged three traps.',
  '69. Kf8-g8 is adjacent and empty; White h-pawn attacks g6 and Bf1 remains blocked, so g8 is safe; halfmove2/fullmove16.',
  '70. End Black turn, hand off to White without board or clock changes.',
  '71. Ghostwalk moves Rh1-h4 over empty h2/h3 to empty h4, a legal noncapturing rook move; Kc1 safe; consumes move/card, halfmove3; draw Knightmare.',
  '72. End White Ghostwalk turn; Black begins, no extra move or clock advance.',
  '73. Rd6-d4 crosses empty d5 and ends empty d4; Kg8 safe; no trap destination; halfmove4/fullmove17.',
  '74. End Black turn; White begins with same three traps.',
  '75. Rh4-h1 passes empty h3/h2 and returns to empty h1; Kc1 safe; halfmove5.',
  '76. End White turn; Black begins, no optional discard chosen.',
  '77. Rd4-d7 crosses empty d5/d6 into empty d7; Kg8 safe; halfmove6/fullmove18.',
  '78. End Black turn; White begins with board, effects, and clocks unchanged.',
  '79. Rh1-h4 follows clear h2/h3 again; no check on Kc1; halfmove7.',
  '80. Mystic Shield after Rh4 targets the just-moved nonroyal rook, protecting its physical identity during next Black turn; no checkmate created; discard and draw Holy Quest, clocks unchanged.',
  '81. End White turn; the shield now protects Rh4 during Black turn and remains active.',
  '82. Pe6-e5 is one clear forward step, leaving its own square-bound e6 trap intact; no shield capture or king exposure; clock reset/fullmove19.',
  '83. End Black protected turn; Mystic Shield expires, three traps persist, no second card draw.',
  '84. Pe2-e3 moves one empty forward square; own copied trap e2 remains despite being vacated; Kc1 safe; clock reset.',
  '85. End White turn; Black begins with no further board or clock change.',
  '86. Guardian Pc7-c5 advances two from starting rank through empty c6 to empty c5; c8 has no follower; no capture or en-passant; Kg8 safe; reset clock/fullmove20, draw Madman.',
  '87. End Black Guardian move; White begins and c5 still grants no en-passant capture.',
  '88. Pa2-a3 is one empty pawn step, legal now that King sits c1 instead of checked d1; clock reset.',
  '89. End White turn; Black begins with the unchanged captured-piece and card zones.',
  '90. Nb8-c6 is an unobstructed knight jump to empty c6; Kg8 safe; halfmove1/fullmove21.',
  '91. End Black turn; White begins without clock or effect changes.',
  '92. Pf2-f4 crosses empty f3 to empty f4; Kc1 safe; create f3 en-passant opportunity for physical f-pawn and reset clock.',
  '93. End White turn; preserve f3 opportunity for Black next move.',
  '94. Pg7-g5 crosses empty g6 to empty g5; Kg8 safe; old f3 expires and g6 becomes available to adjacent White Ph5; reset/fullmove22.',
  '95. End Black turn; preserve g6 en-passant opportunity and current clocks.',
  '96. Pg2-g3 advances to empty g3 instead of taking en-passant; Kc1 safe; expire g6 and reset clock.',
  '97. End White turn; Black begins with empty en-passant list.',
  '98. Rd7-d6 moves one empty vertical square; Kg8 safe; halfmove1/fullmove23.',
  '99. White Knightmare immediately cancels that opponent move: restore rook d7, Black beforeMove, clock0/fullmove22, prohibit same physical d7-d6; spend only White allowance and draw Doppelganger.',
  '100. Black uses still-available card allowance for Madman Pb6-d4-f6: jumps own Pc5 then own Pe5, both landing squares empty; captures neither; differs from canceled rook move, Kg8 safe; reset/fullmove23 and draw Evil Eye.',
  '101. End Black replacement move; both allowances reset and cancellation restriction expires; jump-over pawns stay on c5/e5.',
  '102. Bf1-d3 passes empty e2 (friendly trap, traversed only) to empty d3; Kc1 safe; halfmove1.',
  '103. End White turn; Black begins with no trap trigger or card draw.',
  '104. Nc6-d8 jumps to empty d8, not exposing Kg8; halfmove2/fullmove24.',
  '105. End Black turn; White begins with unchanged state apart from turn allowances.',
  '106. Rh4-h3 moves one empty vertical square; Kc1 remains screened by Pc3 on Ba7 diagonal; halfmove3.',
  '107. End White turn; Black begins with three traps unchanged.',
  '108. Rd7-e7 moves one empty horizontal square; Kg8 safe, Pe5 blocks file below e7; halfmove4/fullmove25.',
  '109. End Black turn; White begins without board or clock changes.',
  '110. Ph5-h6 advances into empty h6, not the last rank; does not promote, attacks g7 not Kg8; Kc1 safe and clock reset.',
  '111. End White turn; Black begins with no en-passant from a single pawn step.',
  '112. Pc5-c4 is a clear forward Black pawn step, stopping before White Pc3; Kg8 safe; clock reset/fullmove26.',
  '113. End Black turn; White begins; Pc4 does not check Kc1.',
  '114. Bd3-f5 crosses empty e4 and lands empty f5; no trap arrival; Kc1 remains safe and Kg8 is off bishop diagonal; halfmove1.',
  '115. End White turn; Black begins with fresh allowances and unchanged effects.',
  '116. Re7-c7 crosses empty d7 into empty c7; Pc4 blocks rook line toward White Kc1; Kg8 safe; halfmove2/fullmove27; fiftieth move command.',
  '117. End Black turn completes all pending resolution; White starts move27 with safe Kc1, no pending rescue/challenge, and three intact traps.',
];

test('iteration 069: full 50-move review with corrected sampler', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/069.json', import.meta.url), 'utf8')) as RandomTrace;
  const stalled = JSON.parse(readFileSync(new URL('../../../campaign/iterations/069.stalled.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.deepEqual(trace.steps.slice(0, 63), stalled.steps.slice(0, 63), 'only identical actions reuse earlier rationales');
  assert.equal(continuedRationales.length, trace.steps.length);
  assert.equal(trace.steps.length, 117);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 13);
  assert.equal(trace.failure, undefined);
  let state = createGameState(trace.initial);
  let beforeCancelledMove = state;
  for (const [index, step] of trace.steps.entries()) {
    const number = index + 1;
    assert.ok(continuedRationales[index]!.startsWith(`${number}. `));
    const before = state;
    const result = applyAction(before, step.action);
    assert.ok(result.ok, continuedRationales[index]);
    state = result.state;
    if (number <= 63) continue; // The separately retained test verifies the identical prefix.
    const action = step.action;
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const chess = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap();
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! };
      assert.ok(chess.isLegal(move), continuedRationales[index]);
      chess.play(move);
      assert.equal(state.fen.split(' ')[0], makeBoardFen(chess.board));
      assert.equal(state.fen.split(' ').slice(4).join(' '), `${chess.halfmoves} ${chess.fullmoves}`);
      assert.equal(!!state.pendingRescue, false);
    }
    if (action.type === 'endTurn') {
      assert.equal(state.fen, before.fen);
      assert.deepEqual(state.pieces, before.pieces);
      assert.deepEqual(state.players, before.players);
      assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 });
    }
    if (action.type === 'playCard') {
      const owner = number === 99 ? 'white' : before.turn.color;
      assert.equal(state.players[owner].deck.length, before.players[owner].deck.length - 1);
      assert.deepEqual(state.players[owner].hand, [...before.players[owner].hand.filter(c => c.id !== action.cardInstanceId), before.players[owner].deck[0]]);
      assert.equal(state.players[owner].discard.at(-1)!.id, action.cardInstanceId);
      assert.equal(state.turn.cardPlays[owner], 1);
    }
    if (number === 64) {
      assert.equal(state.pieces.find(p => p.id === 'black-pawn-a7')!.zone, 'away');
      assert.equal(state.pendingAbduction?.phase, 'concealment');
      assert.ok(state.pendingRescue);
      assert.deepEqual(state.enPassant, [{ target: 'a3', pawnId: 'white-pawn-a2' }]);
    }
    if (number === 65) {
      assert.equal(state.pendingAbduction?.phase, 'recall');
      assert.deepEqual(state.pieces, before.pieces);
      assert.deepEqual(state.players, before.players);
      assert.equal(state.fen, before.fen);
    }
    if (number === 66) {
      assert.equal(state.fen, '1n3k2/b1p3pp/pp1rp3/7P/8/1PP5/P3PPP1/3K1BNR w - - 0 15');
      assert.deepEqual(state.players, before.players);
      assert.equal(state.pendingAbduction, null);
      assert.equal(state.pendingRescue, null);
      assert.equal(state.turn.moveMade, false);
      assert.equal(state.turn.cardPlays.white, 1);
    }
    if (number === 71) assert.equal(state.fen, '1n4k1/b1p3pp/pp1rp3/7P/7R/1PP5/P3PPP1/2K2BN1 b - - 3 16');
    if (number === 80) {
      assert.deepEqual(state.effects.at(-1), { type: 'mystic-shield', owner: 'white', player: 'white', pieceId: 'white-rook-a1' });
      assert.equal(state.fen, before.fen);
    }
    if (number === 81 || number === 82) assert.equal(state.effects.length, 4);
    if (number >= 83) assert.equal(state.effects.length, 3);
    if (number === 86) {
      assert.equal(state.fen, '1n4k1/b2r2pp/pp6/2p1p2P/7R/1PP1P3/P4PP1/2K2BN1 w - - 0 20');
      assert.deepEqual(state.enPassant, []);
    }
    if (number === 92 || number === 93) assert.deepEqual(state.enPassant, [{ target: 'f3', pawnId: 'white-pawn-f2' }]);
    if (number === 94 || number === 95) assert.deepEqual(state.enPassant, [{ target: 'g6', pawnId: 'black-pawn-g7' }]);
    if (number === 96) assert.deepEqual(state.enPassant, []);
    if (number === 98) beforeCancelledMove = before;
    if (number === 99) {
      assert.equal(state.fen, beforeCancelledMove.fen);
      assert.deepEqual(state.pieces, beforeCancelledMove.pieces);
      assert.deepEqual(state.effects, beforeCancelledMove.effects);
      assert.equal(state.turn.moveMade, false);
      assert.equal(applyAction(state, { type: 'move', from: 'd7', to: 'd6' }).ok, false);
    }
    if (number === 100) {
      assert.equal(state.fen, '6k1/b2r3p/p1n2p2/2p1p1pP/5P1R/PPP1P1P1/8/2K2BN1 w - - 0 23');
      assert.equal(state.pieces.find(p => p.id === 'black-pawn-b7')!.square, 'f6');
      assert.equal(state.pieces.find(p => p.id === 'black-pawn-c7')!.square, 'c5');
      assert.equal(state.pieces.find(p => p.id === 'black-pawn-e7')!.square, 'e5');
      assert.deepEqual(state.pieces.filter(p => p.zone === 'captured'), before.pieces.filter(p => p.zone === 'captured'));
    }
  }
  assert.equal(state.fen, '3n2k1/b1r4p/p4p1P/4pBp1/2p2P2/PPP1P1PR/8/2K3N1 w - - 2 27');
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.pendingRescue, null);
  assert.equal(state.pendingAbduction, null);
  assert.deepEqual(replayTrace(trace), state);
});
