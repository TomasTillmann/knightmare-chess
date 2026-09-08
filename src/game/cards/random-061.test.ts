import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, PieceState } from '../types.js';

// Independently reviewed in order against rules §§8–14, 16.2, 19.2, 22 and cards.md.
// All ordinary moves below are non-captures. End-turn rows retain board/clocks/cards,
// reset both allowances, and change the actor; the numbered entries identify each window.
const rationales = [
  '1. Nb1-c3 jumps to an empty square; e1 stays protected and the quiet clock becomes 1.',
  '2. White ends its completed Nc3 turn; Black receives the move without drawing.',
  '3. Blessing moves the d7 Pawn diagonally to empty e6; no capture or promotion, Black spends/draws once and consumes its move.',
  '4. Black ends Blessing; White starts with fresh allowances.',
  '5. Under Elf Hill removes the e1 royal to away, revokes white castling, consumes one move and card, and keeps the identity alive.',
  '6. White ends the replacement turn; its King stays away during Black’s turn.',
  '7. Bc8-d7 uses the vacated adjacent diagonal; the absent white King gives no check.',
  '8. Black ends Bd7; White’s start marks its absent King as due to return.',
  '9. White returns its same King to empty safe edge e1; clocks do not advance and that identity cannot move this turn.',
  '10. Nc3-e4 is an empty knight jump by another piece, so the returned-King restriction is respected.',
  '11. White ends Ne4; the returned-King restriction expires.',
  '12. Black g7-g5 crosses empty g6 to empty g5; reset pawn clock and record g6 en passant.',
  '13. Black ends g5; g6 availability survives into White’s reply.',
  '14. Ng1-h3 is an empty knight jump; the unclaimed g6 opportunity expires.',
  '15. White ends Nh3 with neither card allowance spent.',
  '16. Dubbing grants Bd7-b6 a noncapturing knight jump; the bishop retains its identity and ordinary powers afterward.',
  '17. Black ends Dubbing; White receives its ordinary move.',
  '18. White a2-a4 has empty a3/a4, resets the clock and opens a3 en passant.',
  '19. White ends a4; Black receives that immediate en-passant window.',
  '20. Qd8-c8 moves one file into the bishop’s vacated square; a3 expires and both Kings remain safe.',
  '21. Fireball after noncapture Qc8 captures c8 Queen, b8 Knight and b7/c7 Pawns only; d7/d8 are empty and e8 is outside the blast.',
  '22. Black ends Fireball; four physical pieces remain captured, the card stays spent, and no further move occurs.',
  '23. White d2-d4 crosses clear d3, resets the clock and records d3 en passant.',
  '24. White ends d4; Black receives the d3 window.',
  '25. Black a7-a6 enters empty a6, resets the clock and expires d3.',
  '26. Black ends a6; no capture or card replenishment occurs.',
  '27. White f2-f3 enters empty f3; e1 remains safe because the b6 bishop ray meets d4.',
  '28. Abduction after f3 selects opposing nonroyal f7 Pawn; concealment places it away, spends/draws once, and preserves clocks.',
  '29. Reveal ends concealment and opens recall without changing pieces, clocks or cards.',
  '30. Black correctly names its f7 Pawn and identity; restore the same Pawn to f7 with no capture and clear the challenge.',
  '31. White ends resolved Abduction; Black gets a normal turn, with Abduction still spent.',
  '32. Ra8-b8 enters the Fireball-vacated square, revokes black queenside castling and increments the quiet clock.',
  '33. Black ends Rb8; White has its regular move.',
  '34. Bc1-d2 is an empty adjacent diagonal opened by d4.',
  '35. White ends Bd2 without drawing.',
  '36. The original d7 Pawn moves e6-e5 forward into an empty square; original identity remains d7.',
  '37. Black ends e5; no en-passant right is created by a single advance.',
  '38. Ra1-a3 crosses empty a2 and stops before own a4 Pawn.',
  '39. White ends Ra3; a1 is now empty for a later card landing.',
  '40. Madman jumps e5-c3 over d4 and c3-a1 over b2; both landings empty, jumped Pawns survive, and a1 Pawn does not promote under §13.2.',
  '41. Black ends Madman; the same unpromoted original d7 Pawn remains at a1.',
  '42. Ra3-b3 slides one file into an empty square, with no capture.',
  '43. White plays continuing Truce after Rb3; neither King is checked, so retain the card beside the board and draw Legacy.',
  '44. White ends Truce; Black’s next move is subject to its capture ban.',
  '45. Black g5-g4 enters empty g4; Truce permits this quiet Pawn move and survives.',
  '46. Black ends g4; Truce continues and neither player draws.',
  '47. Bd2-e3 is an empty one-square diagonal; no King becomes checked, so Truce remains.',
  '48. White ends Be3; Truce persists into Black’s turn.',
  '49. Rb8-a8 is a quiet horizontal move; returning the rook does not restore castling.',
  '50. Black ends Ra8; Truce continues.',
  '51. Ne4-g3 is an empty knight jump; captures remain forbidden and Truce continues.',
  '52. White ends Ng3 with unchanged hands and effects.',
  '53. The correctly recalled f7 Pawn moves to f5 through empty f6; record f6 availability, though Truce prevents capture.',
  '54. Black ends f5; the f6 opportunity remains until White’s reply.',
  '55. Be3-f2 returns to empty f2 and expires the unclaimed f6 right.',
  '56. White ends Bf2; the Truce capture ban persists.',
  '57. Ng8-h6 jumps to empty h6; no wall exists yet and no check ends Truce.',
  '58. Black ends Nh6; no card is spent.',
  '59. White e2-e4 crosses vacated e3 and enters vacated e4; reset clock and record e3 en passant.',
  '60. White ends e4; Black receives the next turn and the e3 window.',
  '61. Bb6-c7 enters the Fireball-vacated square; e3 expires.',
  '62. Black ends Bc7; Truce and board persist.',
  '63. Qd1-d2 enters the bishop-vacated square without capture.',
  '64. White ends Qd2 with unchanged card zones.',
  '65. Bc7-e5 passes through empty d6 into e5 vacated by Madman.',
  '66. Black ends Be5; no check or stalemate ends Truce.',
  '67. Qd2-b4 passes through empty c3 into empty b4; b3 rook is not on its diagonal.',
  '68. White ends Qb4; Truce persists.',
  '69. Ra8-d8 crosses empty b8/c8 and lands on empty d8; no wall has yet been placed.',
  '70. Black ends Rd8; no castling rights are regained.',
  '71. White a4-a5 enters empty a5 and stops before opposing a6 Pawn; reset the Pawn clock.',
  '72. White ends a5; no double-step en passant is created.',
  '73. Rd8-d5 crosses empty d7/d6 and stops before white d4 Pawn without capturing it.',
  '74. Black ends Rd5; Truce continues to forbid the nearby captures.',
  '75. Qb4-d2 returns through empty c3 into empty d2.',
  '76. White ends Qd2; Black’s King remains safe.',
  '77. Ke8-d8 moves to an empty safe neighbor; black’s remaining castling right is revoked.',
  '78. Black ends Kd8; all castling rights are now absent.',
  '79. Rb3-b7 crosses clear b4/b5/b6 into empty b7; Truce survives because d8 is not on its attack line.',
  '80. White ends Rb7; no capture or card change occurs.',
  '81. Be5-f4 enters empty f4; the d2 Queen blocks the bishop’s southwest ray before the white King.',
  '82. Black plays Fortification after Bf4, creating the adjacent c8–d8 boundary even though d8 is occupied; retain card and draw Mystic Shield.',
  '83. Black ends Fortification; wall and Truce remain active with unchanged clocks.',
  '84. Rb7-b5 passes clear b6; its path does not cross c8–d8.',
  '85. White ends Rb5; both continuing cards remain outside discard.',
  '86. Rd5-e5 enters the vacated neighboring square; no wall crossing or capture.',
  '87. Black ends Re5; Truce and wall persist.',
  '88. Rb5-b8 crosses clear b6/b7; its prospective ray toward Kd8 is stopped by c8–d8, so Truce correctly survives.',
  '89. White ends Rb8; wall prevents the apparent rank check.',
  '90. Nh6-g8 jumps to empty g8; wall has no bearing on the knight and Black is not in check.',
  '91. Black ends Ng8; Truce survives the blocked rook ray.',
  '92. Rb8-b7 is a quiet retreat; no wall is crossed.',
  '93. White ends Rb7; card zones remain unchanged.',
  '94. Bf8-h6 passes through clear g7 into empty h6; no capture or wall crossing.',
  '95. Black ends Bh6; Truce persists.',
  '96. Bf1-d3 crosses empty e2 into empty d3, freeing f1 for the King.',
  '97. White ends Bd3; no extra move or card draw occurs.',
  '98. Irresistible Force pushes white a5 Pawn to empty a4 and black a6 Pawn to a5; on-board displacement is allowed during Truce, neither Pawn promotes or is captured.',
  '99. Black ends the replacement push; White receives its move and the Truce/wall remain.',
  '100. Rb7-d7 crosses empty c7 and gives Kd8 an unblocked vertical check; Truce expires to White’s discard without a replacement draw.',
  '101. White ends Rd7+; Black must now answer the check with ordinary capture rules restored.',
  '102. Kd8-e8 escapes the rook file to safe empty e8; it does not cross c8–d8.',
  '103. Black ends Ke8; both Kings are safe and Truce stays discarded.',
  '104. Ke1-f1 moves to the square freed by Bd3; no enemy ray reaches f1.',
  '105. White ends Kf1; no castling rights return.',
  '106. Ke8-f8 enters a safe empty neighbor; white Rd7 does not attack f8.',
  '107. Black ends Kf8; the wall remains fixed at c8–d8.',
  '108. Bf2-e3 enters an empty adjacent diagonal; its move does not expose Kf1.',
  '109. White ends Be3; no effects expire.',
  '110. Bh6-g5 enters empty g5; the bishop remains blocked toward Kf1 and black Kf8 stays safe.',
  '111. Black ends Bg5; ordinary captures remain available.',
  '112. Rd7-b7 crosses empty c7; e7 Pawn still blocks the rook’s eastward ray.',
  '113. White ends Rb7; no board or clock change occurs.',
  '114. Bg5-h6 returns to empty h6; neither King is checked.',
  '115. Black ends Bh6; White starts its fiftieth sampled regular move.',
  '116. Bd3-a6 crosses empty c4/b5 into a6 vacated by Irresistible Force; no capture, wall crossing or check.',
  '117. White ends Ba6; Black starts turn 28 with halfmove clock 9 and the c8–d8 wall as the sole active effect.',
];

// Only the ordinary roles present in this trace are needed; evaluate paths directly.
function reaches(state: GameState, piece: PieceState, to: string, capture: boolean): boolean {
  if (!piece.square) return false;
  const from = piece.square;
  const dx = to.charCodeAt(0) - from.charCodeAt(0), dy = Number(to[1]) - Number(from[1]);
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    if (capture) return ax === 1 && dy === forward;
    if (dx !== 0 || !(dy === forward || dy === 2 * forward && from[1] === (piece.owner === 'white' ? '2' : '7'))) return false;
  } else if (!(piece.role === 'king' ? Math.max(ax, ay) === 1
    : piece.role === 'bishop' ? ax === ay && ax > 0
    : piece.role === 'rook' ? (dx === 0) !== (dy === 0)
    : ax === ay && ax > 0 || (dx === 0) !== (dy === 0))) return false;
  const distance = Math.max(ax, ay);
  let previous: string = from;
  for (let n = 1; n <= distance; n++) {
    const square = String.fromCharCode(from.charCodeAt(0) + n * Math.sign(dx)) + (Number(from[1]) + n * Math.sign(dy));
    if (state.effects.some(effect => {
      if (!effect || typeof effect !== 'object' || !('type' in effect) || effect.type !== 'fortification' || !('from' in effect) || !('to' in effect)) return false;
      return effect.from === previous && effect.to === square || effect.to === previous && effect.from === square;
    })) return false;
    if (n < distance && state.pieces.some(p => p.zone === 'board' && p.square === square)) return false;
    previous = square;
  }
  return true;
}

function attacked(state: GameState, color: 'white' | 'black'): boolean {
  const king = state.pieces.find(p => p.owner === color && p.royal && p.zone === 'board');
  return !!king?.square && state.pieces.some(p => p.zone === 'board' && p.owner !== color
    && !state.underElfHill?.some(lock => lock.pieceId === p.id && lock.returned)
    && reaches(state, p, king.square!, true));
}

test('iteration 061 independently reviewed campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/061.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860061);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.length, 117);
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 9);
  const truce = { type: 'truce', owner: 'white', card: { id: 'white-hand-4-truce', cardId: 'truce' } };
  const wall = { type: 'fortification', owner: 'black', card: { id: 'black-hand-1-fortification', cardId: 'fortification' }, from: 'c8', to: 'd8' };
  let state = createGameState(trace.initial);
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, why = rationales[index]!;
    assert.ok(why.startsWith(`${n}. `));
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, why);
    state = result.state;
    assert.equal(state.orientation, 0, why);
    assert.equal(state.pieces.filter(p => p.zone === 'captured').length, n >= 21 ? 4 : 0, why);
    assert.equal(state.pieces.filter(p => p.zone === 'dead').length, 0, why);
    assert.deepEqual(state.effects, [...(n >= 43 && n < 100 ? [truce] : []), ...(n >= 82 ? [wall] : [])], why);
    assert.equal(attacked(state, before.turn.color), false, why);
    if (n >= 43 && n < 100) assert.equal(attacked(state, before.turn.color === 'white' ? 'black' : 'white'), false, why);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const mover = before.pieces.find(p => p.zone === 'board' && p.square === action.from)!;
      assert.equal(mover.owner, before.turn.color, why);
      assert.ok(reaches(before, mover, action.to, false), why);
      assert.ok(!before.pieces.some(p => p.zone === 'board' && p.square === action.to), why);
      assert.deepEqual(state.pieces, before.pieces.map(p => p.id === mover.id ? { ...p, square: action.to } : p), why);
      assert.equal(state.turn.moveMade, true, why);
      assert.equal(state.turn.phase, 'afterMove', why);
      const pre = before.fen.split(' '), post = state.fen.split(' ');
      assert.equal(Number(post[4]), mover.role === 'pawn' ? 0 : Number(pre[4]) + 1, why);
      assert.equal(Number(post[5]), Number(pre[5]) + (mover.owner === 'black' ? 1 : 0), why);
      assert.equal(post[1], mover.owner === 'white' ? 'b' : 'w', why);
      assert.deepEqual(state.enPassant, mover.role === 'pawn' && Math.abs(Number(action.to[1]) - Number(action.from[1])) === 2
        ? [{ target: action.from[0] + String((Number(action.from[1]) + Number(action.to[1])) / 2), pawnId: mover.id }] : [], why);
    }
    if (action.type === 'endTurn') {
      assert.deepEqual(state.pieces, before.pieces, why);
      assert.equal(state.fen, before.fen, why);
      assert.deepEqual(state.players, before.players, why);
      assert.equal(state.turn.color, before.turn.color === 'white' ? 'black' : 'white', why);
      assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 }, why);
      assert.equal(state.turn.moveMade, false, why);
    }
    if (action.type === 'playCard') {
      const owner = before.turn.color, player = before.players[owner];
      const card = player.hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(card, why);
      assert.equal(before.turn.cardPlays[owner], 0, why);
      assert.equal(state.turn.cardPlays[owner], 1, why);
      assert.deepEqual(state.players[owner].hand, [...player.hand.filter(c => c.id !== card.id), player.deck[0]], why);
      assert.deepEqual(state.players[owner].deck, player.deck.slice(1), why);
      assert.deepEqual(state.players[owner].discard, ['truce', 'fortification'].includes(card.cardId) ? player.discard : [...player.discard, card], why);
      assert.deepEqual(state.players[owner === 'white' ? 'black' : 'white'], before.players[owner === 'white' ? 'black' : 'white'], why);
    }
    if (n === 3) assert.equal(state.pieces.find(p => p.id === 'black-pawn-d7')?.square, 'e6', why);
    if (n === 5) {
      assert.equal(state.pieces.find(p => p.id === 'white-king-e1')?.zone, 'away', why);
      assert.equal(state.fen, 'rnbqkbnr/ppp1pppp/4p3/8/8/2N5/PPPPPPPP/R1BQ1BNR b kq - 1 2', why);
    }
    if (n === 9) {
      assert.equal(state.pieces.find(p => p.id === 'white-king-e1')?.square, 'e1', why);
      assert.deepEqual(state.underElfHill, [{ pieceId: 'white-king-e1', player: 'white', returning: true, returned: true }], why);
    }
    if (n === 16) assert.equal(state.pieces.find(p => p.id === 'black-bishop-c8')?.square, 'b6', why);
    if (n === 21) assert.deepEqual(state.pieces.filter(p => p.zone === 'captured').map(p => p.id).sort(), ['black-knight-b8', 'black-pawn-b7', 'black-pawn-c7', 'black-queen-d8'], why);
    if (n === 28 || n === 29) {
      assert.equal(state.pieces.find(p => p.id === 'black-pawn-f7')?.zone, 'away', why);
      assert.equal(state.pendingAbduction?.phase, n === 28 ? 'concealment' : 'recall', why);
      assert.deepEqual(state.fen.split(' ').slice(1), before.fen.split(' ').slice(1), why);
    }
    if (n === 30) {
      assert.equal(state.pieces.find(p => p.id === 'black-pawn-f7')?.square, 'f7', why);
      assert.equal(state.pendingAbduction, null, why);
    }
    if (n >= 40) {
      const pawn = state.pieces.find(p => p.id === 'black-pawn-d7')!;
      assert.deepEqual([pawn.square, pawn.role, pawn.originalRole, pawn.promoted], ['a1', 'pawn', 'pawn', false], why);
      assert.equal(state.pieces.find(p => p.id === 'white-pawn-b2')?.square, 'b2', why);
      assert.equal(state.pieces.find(p => p.id === 'white-pawn-d2')?.square, 'd4', why);
    }
    if (n === 98) {
      assert.equal(state.pieces.find(p => p.id === 'white-pawn-a2')?.square, 'a4', why);
      assert.equal(state.pieces.find(p => p.id === 'black-pawn-a7')?.square, 'a5', why);
      assert.deepEqual(state.enPassant, [], why);
      assert.equal(state.fen, '3k2nr/1R2p2p/7b/p3rp2/P2PPbp1/3B1PNN/1PPQ1BPP/p3K2R w - - 0 24', why);
    }
    if (n === 100) {
      assert.equal(attacked(state, 'black'), true, why);
      assert.deepEqual(state.players.white.discard, [...before.players.white.discard, truce.card], why);
      assert.deepEqual(state.players.white.hand, before.players.white.hand, why);
      assert.deepEqual(state.players.white.deck, before.players.white.deck, why);
    }
  }
  assert.equal(state.fen, '5knr/1R2p2p/B6b/p3rp2/P2PPbp1/4BPNN/1PPQ2PP/p4K1R b - - 9 28');
  assert.deepEqual(replayTrace(trace), state);
});
