import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, PieceState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Independently reviewed in order from the printed trace, rules.md and card metadata.
const rationales = [
  '1. e2-e3 advances a white pawn into an empty square; resets the clock and leaves e1 safe.',
  '2. White ends its completed move; Black begins with unchanged board and hands.',
  '3. e7-e5 crosses empty e6; e6 en passant is available for this reply only.',
  '4. Black ends; White inherits the e6 en-passant opportunity.',
  '5. Ng1-f3 is an unobstructed L jump; e6 en passant expires.',
  '6. White ends after Nf3, without a card or board change.',
  '7. Ng8-h6 is an L jump to an empty square and exposes no king.',
  '8. Black ends after Nh6 and gives White a fresh allowance.',
  '9. Nf3-g5 is an L jump; e1 remains screened by its pawns.',
  '10. White ends after Ng5 without changing material.',
  '11. Before-move Disintegration kills own f7 pawn permanently, draws Holy War, and leaves the move available.',
  '12. Rh8-g8 moves one square into the vacated knight square and revokes black kingside castling.',
  '13. Black ends after Rg8; its spent card allowance resets.',
  '14. Ng5-f3 is an L jump back to an empty square.',
  '15. After-move Dungeon sends opposing e5 pawn to vacant h8, without promotion; its next black turn is frozen.',
  '16. White ends; Dungeon remains for the coming Black turn.',
  '17. Qd8-h4 crosses e7,f6,g5, all empty; Dungeon does not prevent moving the queen.',
  '18. Black ends its affected turn, so Dungeon expires.',
  '19. g2-g3 advances one into an empty square without exposing e1.',
  '20. White ends after g3, with no replacement draw required.',
  '21. Bf8-c5 crosses empty e7,d6; no capture or check against e8.',
  '22. Black ends after Bc5.',
  '23. Rh1-g1 uses the vacated knight square and revokes white kingside castling.',
  '24. After-move Man-Trap marks own pawn square a2; card stays active and Treason is drawn.',
  '25. White ends; a2 remains trapped without affecting its present friendly occupant.',
  '26. Qh4-f4 crosses empty g4 and ends on empty f4, not the trapped square.',
  '27. Black ends after Qf4; the trap persists.',
  '28. d2-d3 advances into empty d3 and resets the clock.',
  '29. White ends after d3; a2 trap remains armed.',
  '30. b7-b5 crosses empty b6 and creates the b6 en-passant opportunity.',
  '31. Black ends; b6 en passant survives into White reply.',
  '32. Nf3-d2 jumps to the pawn-vacated square; b6 opportunity expires.',
  '33. White ends after Nd2, without disturbing the trap.',
  '34. Bc8-a6 crosses vacated b7 and leaves e8 safe.',
  '35. After-move Holy War swaps own Nb8 and Bc5 with identities preserved, no capture, and no clock advance.',
  '36. Black ends the Holy War turn; both allowances reset.',
  '37. d3-d4 advances one into an empty square, e1 safe.',
  '38. White ends after d4.',
  '39. Dubbing replaces Black move: pawn h8-f7 jumps in knight geometry, remains a pawn, and resets clock.',
  '40. Black ends its replacement move; the f7 pawn may subsequently move normally.',
  '41. h2-h4 crosses empty h3 and creates h3 en passant.',
  '42. White ends; h3 opportunity is available to Black.',
  '43. Tournament replaces Black move, swapping own Nc5 with white Nd2; clears en passant and consumes move.',
  '44. Immediate Fog cancels Tournament: restores knights, h3 en passant, clocks and Black move; both cards remain spent.',
  '45. Qf4xd4 crosses empty e4 and captures white d-pawn; both card allowances remain consumed.',
  '46. Black ends its legal replacement after Fog; allowances reset.',
  '47. c2-c4 crosses empty c3; creates c3 en passant, e1 remains safe.',
  '48. White ends after c4; c3 opportunity survives.',
  '49. Qd4-g4 crosses empty e4,f4; c3 en passant expires.',
  '50. After-move Panic gives White 15000 ms for its next move; no board or clock change.',
  '51. Black ends; White begins under Panic.',
  '52. White times out while safe, forfeits its turn, removes Panic, and passes to Black without moving a piece.',
  '53. Ke8-d8 steps to a safe empty square and revokes remaining black castling.',
  '54. Black ends after Kd8.',
  '55. Bf1-g2 uses the square vacated by the g-pawn; e1 remains safe.',
  '56. White ends after Bg2.',
  '57. Qg4xh4 captures the white h-pawn and resets the clock.',
  '58. Black ends after Qxh4; captured pawn stays captured.',
  '59. Qd1-a4 crosses empty c2,b3; e1 remains safe.',
  '60. White ends after Qa4.',
  '61. Nc5-e4 is a noncapturing L jump, enabling Charge on this same knight.',
  '62. Charge adds Ne4xd2, capturing the white knight; first move was noncapturing and Black king stays safe.',
  '63. Black ends its two-move turn without an additional regular move.',
  '64. Before-move Disintegration kills own f2 pawn; white king is still safe and keeps its move.',
  '65. Ke1-e2 is safe: queen h4 diagonal ends at f2, Nd2 does not attack e2; white castling expires.',
  '66. White ends after Ke2.',
  '67. Rg8-f8 moves one square to empty f8, without exposing Kd8.',
  '68. Black ends after Rf8.',
  '69. Bg2-b7 crosses empty f3,e4,d5,c6; black king d8 is not on its diagonals.',
  '70. White ends after Bb7.',
  '71. Qh4-h2 crosses empty h3 and checks Ke2 along empty g2,f2.',
  '72. Black ends; White receives its checked turn.',
  '73. Ke2-e1 escapes the h2 rank attack; e1 is not attacked by Nd2.',
  '74. Clockwise Earthquake makes White advance east and Black west; black a7 pawn promotes to bishop, trap stays a2.',
  '75. White ends with orientation 90 and promoted bishop identity retained.',
  '76. Qh2xg3 captures white g-pawn diagonally; promotion elsewhere remains unchanged.',
  '77. Black ends after Qxg3.',
  '78. Ke1-e2 is safe: Qg3 attacks f2,e1 rather than e2, and Nd2 does not attack e2.',
  '79. White ends after Ke2.',
  '80. Qg3-h3 slides one square to empty h3; Kd8 remains safe.',
  '81. Black ends after Qh3.',
  '82. Assassin replaces White move: Bc1xb2 captures its own pawn by ordinary bishop geometry; no king is harmed.',
  '83. White ends the Assassin replacement turn.',
  '84. Dark Mirror replaces Black move: west-forward pawn b5 captures backward diagonally on c4; white pawn is captured.',
  '85. Black ends after Dark Mirror; rotated direction persists.',
  '86. Ke2-e1 steps to a safe square; Qh3 is blocked toward f1 only by distance, and e1 is off its line.',
  '87. White ends after Ke1.',
  '88. Qh3-f1 crosses empty g2 and checks adjacent Ke1.',
  '89. Black ends; White must answer Qf1 check.',
  '90. Ke1xd2 captures the undefended black knight and escapes Qf1 check; rotated c4 pawn attacks b3,b5.',
  '91. White ends its legal king capture; Nd2 stays captured.',
  '92. Rf8-g8 moves one square, leaving Kd8 safe.',
  '93. Black ends after Rg8.',
  '94. e3-f3 is the white pawn one-square forward move under clockwise orientation; no capture.',
  '95. White ends after f3, orientation unchanged.',
  '96. Guardian replaces Black move: c4-b4 advances west one square; no follower occupies d4 and no en passant arises.',
  '97. Black ends its Guardian move.',
  '98. Bb2-a3 moves one diagonal to an empty square and keeps Kd2 safe.',
  '99. After-move Treason swaps opposing Rg8 and Nh6, preserving identities and move clocks.',
  '100. White ends after Treason.',
  '101. Promoted a7 bishop moves to b6 as a bishop; original pawn identity persists.',
  '102. Black ends after Bb6.',
  '103. Qa4xd7 crosses empty b5,c6, captures black d-pawn, and checks adjacent Kd8.',
  '104. White ends; Black starts in queen check.',
  '105. Ba6-b5 does not resolve Qd7 check: legal only as a pending same-turn rescue under 11.6, not an ended turn.',
  '106. Crusade adds Bb5xd7 through empty c6, captures the checking queen, and clears Black pending rescue.',
  '107. Black may now end safely after Crusade.',
  '108. Rg1-g3 crosses empty g2 and remains clear of own f3 pawn.',
  '109. White ends after Rg3.',
  '110. Rh6-c6 crosses empty g6,f6,e6,d6 and stops before own Bb6.',
  '111. Black ends after Rc6.',
  '112. Rg3-g6 crosses empty g4,g5, leaving Kd2 safe.',
  '113. White ends after Rg6.',
  '114. Ra8-a4 crosses empty a7,a6,a5 and stops before white Ba3; it has not sprung a2 trap.',
  '115. Black ends after Ra4.',
  '116. Rg6-e6 crosses empty f6; ordinary noncapturing move subject to immediate cancellation.',
  '117. Knightmare cancels that move, restores rook g6 and clocks, consumes Black reaction card, and forbids repeating g6-e6.',
  '118. Rg6-d6 crosses empty f6,e6 and is a different permitted move; black bishop d7 shields Kd8.',
  '119. White ends its replacement move, clearing cancellation restriction and allowances.',
  '120. Rc6-c3 crosses empty c5,c4; Kd8 remains shielded by Bd7.',
  '121. Black ends: White begins safe, trap a2 and clockwise Earthquake remain active; 50 regular move commands reviewed.',
];

const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
function attacks(piece: PieceState, square: string, state: GameState): boolean {
  if (!piece.square || piece.square === square) return false;
  const [x, y] = xy(piece.square), [tx, ty] = xy(square);
  const dx = tx - x, dy = ty - y;
  if (piece.role === 'knight') return Math.abs(dx * dy) === 2;
  if (piece.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    return state.orientation === 0 ? dy === forward && Math.abs(dx) === 1 : dx === forward && Math.abs(dy) === 1;
  }
  const diagonal = Math.abs(dx) === Math.abs(dy);
  const straight = dx === 0 || dy === 0;
  if (!(piece.role === 'bishop' ? diagonal : piece.role === 'rook' ? straight : diagonal || straight)) return false;
  for (let distance = 1; distance < Math.max(Math.abs(dx), Math.abs(dy)); distance++) {
    if (state.pieces.some(p => p.square && xy(p.square)[0] === x + Math.sign(dx) * distance
      && xy(p.square)[1] === y + Math.sign(dy) * distance)) return false;
  }
  return true;
}

test('iteration 057 independently reviews its deterministic campaign trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/057.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860057);
  assert.equal(trace.failure, undefined);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.length, 121);
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 17);
  const states = [createGameState(trace.initial)];
  const relocations: Record<number, Array<[string, string]>> = {
    15: [['e5', 'h8']], 35: [['b8', 'c5'], ['c5', 'b8']], 39: [['h8', 'f7']],
    43: [['c5', 'd2'], ['d2', 'c5']], 62: [['e4', 'd2']], 82: [['c1', 'b2']],
    84: [['b5', 'c4']], 96: [['c4', 'b4']], 99: [['g8', 'h6'], ['h6', 'g8']],
    106: [['b5', 'd7']],
  };
  const replacementSteps = new Set([39, 43, 82, 84, 96]);
  for (const [index, step] of trace.steps.entries()) {
    const number = index + 1, before = states[index]!;
    assert.ok(rationales[index]!.startsWith(`${number}. `));
    const result = applyAction(before, step.action);
    assert.ok(result.ok, rationales[index]);
    const after = result.state, action = step.action;
    states.push(after);
    const expectedPieces = before.pieces.map(p => ({ ...p }));
    const movingIds = new Set((relocations[number] ?? []).map(([from]) => before.pieces.find(p => p.square === from)!.id));
    for (const [from, to] of relocations[number] ?? []) {
      const original = before.pieces.find(p => p.square === from)!;
      const mover = expectedPieces.find(p => p.id === original.id)!;
      const victim = expectedPieces.find(p => p.square === to && !movingIds.has(p.id));
      if (victim) { victim.square = null; victim.zone = 'captured'; }
      mover.square = to as PieceState['square'];
    }
    let halfmove = Number(before.fen.split(' ')[4]), fullmove = Number(before.fen.split(' ')[5]);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const mover = before.pieces.find(p => p.square === action.from)!;
      const victim = before.pieces.find(p => p.square === action.to);
      assert.equal(mover.owner, before.turn.color);
      if (mover.role === 'pawn' && !victim) {
        const [x, y] = xy(action.from), [tx, ty] = xy(action.to);
        const forward = mover.owner === 'white' ? 1 : -1;
        const distance = before.orientation === 0 ? (ty - y) * forward : (tx - x) * forward;
        assert.equal(before.orientation === 0 ? tx - x : ty - y, 0);
        assert.ok(distance === 1 || distance === 2);
        if (distance === 2) {
          assert.equal(before.orientation, 0);
          assert.equal(y, mover.owner === 'white' ? 1 : 6);
          assert.ok(!before.pieces.some(p => p.square && xy(p.square)[0] === x && xy(p.square)[1] === y + forward));
        }
      } else assert.ok(attacks(mover, action.to, before), rationales[index]);
      if (victim) {
        assert.notEqual(victim.owner, mover.owner);
        assert.equal(victim.royal, false);
        const expectedVictim = expectedPieces.find(p => p.id === victim.id)!;
        expectedVictim.square = null; expectedVictim.zone = 'captured';
      }
      expectedPieces.find(p => p.id === mover.id)!.square = action.to as PieceState['square'];
      halfmove = mover.role === 'pawn' || victim ? 0 : halfmove + 1;
      fullmove += before.turn.color === 'black' ? 1 : 0;
      assert.equal(after.turn.phase, 'afterMove');
      assert.equal(after.turn.moveMade, true);
      assert.deepEqual(after.turn.cardPlays, before.turn.cardPlays);
      assert.deepEqual(after.players, before.players);
    } else if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black';
      const player = before.players[owner], played = player.hand.find(c => c.id === action.cardInstanceId)!;
      const catalog = CARD_CATALOG[action.cardId]!;
      const timing = number === 44 ? 'afterOpponentCard' : number === 117 ? 'afterOpponentMove' : before.turn.phase;
      assert.ok(catalog.timing.includes(timing));
      assert.equal(before.turn.cardPlays[owner], 0);
      assert.equal(played.cardId, action.cardId);
      assert.deepEqual(after.players[owner].hand, [...player.hand.filter(c => c.id !== played.id), player.deck[0]]);
      assert.deepEqual(after.players[owner].deck, player.deck.slice(1));
      assert.deepEqual(after.players[owner].discard, catalog.continuing ? player.discard : [...player.discard, played]);
      assert.deepEqual(after.players[owner === 'white' ? 'black' : 'white'], before.players[owner === 'white' ? 'black' : 'white']);
      assert.equal(after.turn.cardPlays[owner], 1);
      if (number === 11 || number === 64) {
        const victim = expectedPieces.find(p => p.square === (number === 11 ? 'f7' : 'f2'))!;
        victim.zone = 'dead'; victim.square = null;
      }
      if (number === 74) {
        const promoted = expectedPieces.find(p => p.id === 'black-pawn-a7')!;
        promoted.role = 'bishop'; promoted.promoted = true;
      }
      if (replacementSteps.has(number)) {
        halfmove = number === 43 ? halfmove + 1 : 0;
        fullmove += owner === 'black' ? 1 : 0;
        assert.equal(after.turn.moveMade, true);
        assert.equal(after.turn.phase, 'afterMove');
      } else if (number === 62 || number === 106) halfmove = 0;
      else if (number !== 44 && number !== 117) {
        assert.equal(after.turn.moveMade, before.turn.moveMade);
        assert.equal(after.turn.phase, before.turn.phase);
      }
    } else if (action.type === 'endTurn') {
      assert.equal(before.turn.moveMade, true);
      assert.equal(after.turn.color, before.turn.color === 'white' ? 'black' : 'white');
      assert.deepEqual(after.turn.cardPlays, { white: 0, black: 0 });
      assert.equal(after.turn.moveMade, false);
      assert.equal(after.turn.phase, 'beforeMove');
      assert.deepEqual(after.players, before.players);
    } else {
      assert.equal(number, 52);
      assert.equal(action.type, 'panicTimeout');
      assert.equal(after.turn.color, 'black');
      assert.equal(after.turn.moveMade, false);
      assert.deepEqual(after.players, before.players);
      halfmove++;
    }
    const physical = (pieces: PieceState[]) => pieces.map(({ capturedAtPly: _capture, capturedBy: _actor, ...piece }) => piece);
    if (number === 44 || number === 117) {
      const checkpoint = states[number === 44 ? 42 : 115]!;
      assert.deepEqual(after.pieces, checkpoint.pieces);
      assert.equal(after.fen, checkpoint.fen);
      assert.deepEqual(after.enPassant, checkpoint.enPassant);
      assert.equal(after.turn.moveMade, false);
      assert.equal(after.turn.phase, 'beforeMove');
      if (number === 44) assert.deepEqual(after.turn.cardPlays, { white: 1, black: 1 });
      else assert.ok(after.chaosForbidden);
    } else {
      assert.deepEqual(physical(after.pieces), physical(expectedPieces), rationales[index]);
      assert.equal(Number(after.fen.split(' ')[4]), halfmove, `step ${number} halfmove`);
      assert.equal(Number(after.fen.split(' ')[5]), fullmove, `step ${number} fullmove`);
    }
    assert.equal(after.orientation, number < 74 ? 0 : 90);
    const expectedEffects: unknown[] = [];
    if (number >= 15 && number < 18) expectedEffects.push({ type: 'dungeon', owner: 'white', player: 'black', pieceId: 'black-pawn-e7' });
    if (number >= 24) expectedEffects.push({ type: 'man-trap', owner: 'white', card: { id: 'white-hand-1-man-trap', cardId: 'man-trap' }, square: 'a2' });
    if (number >= 50 && number < 52) expectedEffects.push({ type: 'panic', owner: 'black', player: 'white', durationMs: 15000 });
    if (number >= 74) expectedEffects.push({ type: 'earthquake', owner: 'white', card: { id: 'white-hand-2-earthquake', cardId: 'earthquake' }, direction: 'clockwise', target: { direction: 'clockwise', promotions: [{ square: 'a7', role: 'bishop' }] } });
    assert.deepEqual(after.effects, expectedEffects);
    const ep = number >= 3 && number <= 4 ? [{ target: 'e6', pawnId: 'black-pawn-e7' }]
      : number >= 30 && number <= 31 ? [{ target: 'b6', pawnId: 'black-pawn-b7' }]
      : number === 41 || number === 42 || number === 44 ? [{ target: 'h3', pawnId: 'white-pawn-h2' }]
      : number === 47 || number === 48 ? [{ target: 'c3', pawnId: 'white-pawn-c2' }] : [];
    assert.deepEqual(after.enPassant, ep);
    assert.equal(!!after.pendingRescue, number === 105);
    assert.equal(after.outcome, null);
    if (action.type !== 'endTurn' && number !== 52 && number !== 44 && number !== 117) {
      const king = after.pieces.find(p => p.royal && p.owner === before.turn.color)!;
      const threats = after.pieces.filter(p => p.zone === 'board' && p.owner !== king.owner && attacks(p, king.square!, after));
      assert.equal(threats.length > 0, number === 105, `step ${number} independent king safety`);
      if (number === 105) assert.deepEqual(threats.map(p => p.id), ['white-queen-d1']);
    }
  }
  const final = replayTrace(trace);
  assert.equal(final.fen, '1b1k2n1/1Bpb1ppp/1b1R4/8/rp6/B1r2P2/P2K4/RN3q2 w - - 6 28');
  assert.equal(final.players.white.deck.length, 68);
  assert.equal(final.players.black.deck.length, 65);
});
