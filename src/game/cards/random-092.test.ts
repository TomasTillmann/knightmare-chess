import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { checkState, digest, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';
import type { GameState, PieceState, Color, SquareName } from '../types.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/092.json', import.meta.url), 'utf8')) as RandomTrace;
// One manually reviewed rationale for every numbered generated action. Royal safety
// below is a separate geometry oracle; generated hashes are only change detectors.
const rationales = [
  '1. f2-f4: initial double advance through empty f3; f3 en passant opportunity.',
  '2. White completes the move; Black starts with fresh card allowances.',
  '3. g7-g5: initial double advance through empty g6; replaces the f3 opportunity.',
  '4. Black completes its move; White starts.',
  '5. Nb1-a3 is an empty-square knight jump; prior en passant expires.',
  '6. White ends the completed turn.',
  '7. h7-h5 traverses empty h6 and creates the h6 opportunity.',
  '8. Black ends; the h6 opportunity survives for White.',
  '9. h2-h3 is an empty forward pawn step.',
  '10. White ends; no cards or pieces change.',
  '11. Bf8-h6 follows the clear g7 diagonal.',
  '12. Black ends the completed turn.',
  '13. Ke1-f2 steps diagonally to a safe empty square and loses White castling rights.',
  '14. White ends the completed turn.',
  '15. c7-c6 is an empty forward pawn step.',
  '16. Black ends the completed turn.',
  '17. Rh1-h2 moves one square to the vacated pawn square.',
  '18. White ends the completed turn.',
  '19. c6-c5 is an empty forward pawn step.',
  '20. Black ends the completed turn.',
  '21. g2-g4 traverses empty g3; creates a g3 opportunity.',
  '22. White ends; g3 opportunity survives for Black.',
  '23. d7-d5 traverses empty d6; replaces the g3 opportunity.',
  '24. Black ends; d6 opportunity survives for White.',
  '25. d2-d3 advances one square without capture.',
  '26. White ends the completed turn.',
  '27. Ng8-f6 is an empty-square knight jump.',
  '28. Black ends the completed turn.',
  '29. e2-e4 traverses empty e3; creates an e3 opportunity.',
  '30. White ends; e3 opportunity survives for Black.',
  '31. Qd8-d6 follows the clear d7 file.',
  '32. Black ends the completed turn.',
  '33. Kf2-g3 steps diagonally to a safe empty square.',
  '34. White ends the completed turn.',
  '35. Nf6-h7 is an empty-square knight jump.',
  '36. Black ends the completed turn.',
  '37. Bc1-e3 traverses empty d2.',
  '38. After-move Crab marks White physical pawn g2 at g4; retain card, draw Siege, preserve clocks.',
  '39. White ends; Crab stays attached.',
  '40. Nb8-a6 is an empty-square knight jump.',
  '41. Black ends the completed turn.',
  '42. Rh2-d2 traverses empty g2, f2, e2.',
  '43. White ends the completed turn.',
  '44. b7-b6 advances one square without capture.',
  '45. Black ends the completed turn.',
  '46. Qd1-b1 traverses empty c1.',
  '47. White ends the completed turn.',
  '48. f7-f5 traverses empty f6; creates an f6 opportunity.',
  '49. Black ends; f6 opportunity survives for White.',
  '50. b2-b3 advances one square without capture.',
  '51. Fortification retains its card at adjacent c6/d6 boundary; occupancy is allowed, draw Lost Castle.',
  '52. White ends; both continuing effects persist.',
  '53. Bc8-e6 traverses d7, without crossing c6/d6 wall.',
  '54. Black ends the completed turn.',
  '55. Be3-d4 is a one-square empty diagonal.',
  '56. White ends the completed turn.',
  '57. h5-h4 advances and checks Kg3 by the pawn capture on g3.',
  '58. Black may end while checking the opponent.',
  '59. c2-c3 leaves Kg3 checked by h4; only a temporary rescue window under 11.6, not a completed legal turn.',
  '60. Siege g1/a1 cannot remove h4 check: spend/discard/draw Challenge, undo c2-c3 and restore its clocks.',
  '61. Kg3-g2 supplies the replacement legal move, escaping the h4 pawn.',
  '62. White ends with Siege still spent.',
  '63. Black queenside castles: e8/a8 command puts King c8 and Rook d8; b8/c8/d8 empty, royal path safe.',
  '64. Black ends; both castling rights are gone.',
  '65. Rd2-e2 is an empty horizontal step.',
  '66. White ends the completed turn.',
  '67. Nh7-f8 is an empty-square knight jump.',
  '68. Black ends the completed turn.',
  '69. Kg2-f3 steps to a safe empty square.',
  '70. Abduction conceals opposing nonroyal Bh6 in away zone; spend once and draw No Quarter, no capture clock yet.',
  '71. Reveal opens the ten-second recall window without changing board or cards.',
  '72. Recall timeout captures physical black Bishop f8, clears pending choice and resets halfmove only.',
  '73. White ends after resolved Abduction.',
  '74. f5xe4 captures physical White pawn e2 and gives pawn check to Kf3.',
  '75. Black ends while checking the opponent.',
  '76. d3xe4 captures physical Black pawn f7 and removes that check.',
  '77. White ends the completed turn.',
  '78. Before-move Pacifism marks own g5 pawn, retains its card and draws Long Jump.',
  '79. Be6xg4 traverses f5 and captures the Crab; artwork expires Crab upon capture, bishop now checks Kf3.',
  '80. Black ends while checking the opponent.',
  '81. Qb1-e1 traverses c1/d1 but leaves Kf3 checked: provisional rescue only.',
  '82. Challenge names mobile Pe7; forced next mover suppresses Bg4 capture of Kf3 under 11.7, rescuing the move.',
  '83. White ends with Black constrained to Pe7.',
  '84. e7-e5 obeys Challenge through empty e6, expires it and creates e6 opportunity; bishop check resumes.',
  '85. Black ends while checking the opponent.',
  '86. Kf3-f2 steps out of the bishop diagonal.',
  '87. White ends the completed turn.',
  '88. c5xd4 captures White physical bishop c1.',
  '89. Black ends the completed turn.',
  '90. Resurrection returns captured original White pawn e2 to vacant d2 starting rank; replaces move, draws Crusade.',
  '91. White ends its Resurrection replacement move.',
  '92. Qd6-b8 traverses c7 without crossing the c6/d6 wall.',
  '93. Black ends the completed turn.',
  '94. e4xd5 captures physical Black pawn d7.',
  '95. White ends the completed turn.',
  '96. Rh8-h7 moves to an empty adjacent square.',
  '97. Heresy moves Bg4-g3 to opposite color; White Bf1 has e1/g1/f2 occupied, so no eligible relocation; draw Betrayal.',
  '98. Black ends with bishop check on Kf2.',
  '99. Kf2-g2 leaves the bishop diagonal for a safe square.',
  '100. White ends the completed turn.',
  '101. Bg3xe1 traverses now-empty f2 and captures White physical queen d1.',
  '102. Black ends the completed turn.',
  '103. Lost Castle swaps White Ra1 and Black Rd8 as replacement move; preserves identities, checks Kc8 with c7 escape; draw Breakthrough.',
  '104. White ends its Lost Castle replacement move.',
  '105. Kc8-c7 escapes the Rd8 rank attack.',
  '106. Black ends the completed turn.',
  '107. Re2xe1 captures physical Black bishop c8.',
  '108. White ends the completed turn.',
  '109. Pacifist g5-g4 is a permitted noncapturing pawn advance; marker follows identity.',
  '110. Black ends the completed turn.',
  '111. c2-c3 is a legal forward step with Kg2 safe, unlike provisional step59.',
  '112. White ends the fiftieth sampled regular move command.',
];

const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const at = (state: GameState, square: string) => state.pieces.find(p => p.zone === 'board' && p.square === square);
type Effect = { type: string; pieceId?: string; player?: Color; from?: string; to?: string };
function clearPath(state: GameState, from: string, to: string): boolean {
  const [x, y] = xy(from), [tx, ty] = xy(to);
  const dx = Math.sign(tx - x), dy = Math.sign(ty - y), length = Math.max(Math.abs(tx - x), Math.abs(ty - y));
  let previous = from;
  for (let n = 1; n <= length; n++) {
    const next = String.fromCharCode(97 + x + n * dx) + (1 + y + n * dy);
    if ((state.effects as Effect[]).some(e => e.type === 'fortification' &&
      (e.from === previous && e.to === next || e.to === previous && e.from === next))) return false;
    if (n < length && at(state, next)) return false;
    previous = next;
  }
  return true;
}
function geometry(state: GameState, piece: PieceState, to: string, capture: boolean): boolean {
  assert.ok(piece.square);
  const [x, y] = xy(piece.square), [tx, ty] = xy(to), dx = Math.abs(tx - x), dy = Math.abs(ty - y);
  const effects = state.effects as Effect[];
  if (capture && effects.some(e => e.type === 'pacifism' && e.pieceId === piece.id)) return false;
  if (capture && effects.some(e => e.type === 'challenge' && e.player === piece.owner && e.pieceId !== piece.id)) return false;
  if (piece.role === 'knight') return dx * dy === 2;
  if (!dx && !dy) return false;
  const forward = piece.owner === 'white' ? 1 : -1;
  const crab = effects.some(e => e.type === 'crab' && e.pieceId === piece.id);
  const aligned = piece.role === 'king' ? Math.max(dx, dy) === 1
    : piece.role === 'pawn' ? (capture || crab ? dx === 1 && ty - y === forward
      : dx === 0 && (ty - y === forward || ty - y === 2 * forward && (piece.owner === 'white' ? y <= 1 : y >= 6)))
    : piece.role === 'bishop' ? dx === dy : piece.role === 'rook' ? dx === 0 || dy === 0
    : dx === dy || dx === 0 || dy === 0;
  return aligned && clearPath(state, piece.square, to);
}
function checked(state: GameState, color: Color): boolean {
  const king = state.pieces.find(p => p.owner === color && p.royal)!;
  assert.ok(king.square);
  return state.pieces.some(p => p.zone === 'board' && p.owner !== color && geometry(state, p, king.square!, true));
}

test('iteration 092: 112 independently reviewed actions and 50 regular commands', () => {
  assert.equal(rationales.length, 112);
  assert.equal(trace.steps.length, rationales.length);
  assert.equal(trace.moves, 50);
  let state = createGameState(trace.initial);
  const states = [state];
  let expectedEffects: unknown[] = [];
  for (const [index, step] of trace.steps.entries()) {
    const number = index + 1, action = step.action, label = rationales[index]!;
    assert.ok(label.startsWith(`${number}.`));
    const before = state, expectedPieces = structuredClone(before.pieces), expectedPlayers = structuredClone(before.players);
    const relocate = (id: string, square: SquareName | null, zone: PieceState['zone'] = 'board') => {
      const p = expectedPieces.find(p => p.id === id)!; p.square = square; p.zone = zone;
      if (zone === 'captured') p.capturedBy = before.turn.color;
      if (zone === 'board') delete p.capturedBy;
    };
    let halfmove = Number(before.fen.split(' ')[4]), fullmove = Number(before.fen.split(' ')[5]);
    let expectedEp = before.enPassant;
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const piece = at(before, action.from)!;
      assert.ok(piece); assert.equal(piece.owner, before.turn.color, label);
      if (number === 63) {
        assert.equal(before.fen.split(' ')[2], 'kq');
        for (const square of ['b8', 'c8', 'd8']) assert.equal(at(before, square), undefined);
        for (const square of ['e8', 'd8', 'c8'] as const) {
          const probe = structuredClone(before); probe.pieces.find(p => p.royal && p.owner === 'black')!.square = square;
          assert.equal(checked(probe, 'black'), false, `castling ${square}`);
        }
        relocate('black-king-e8', 'c8'); relocate('black-rook-a8', 'd8');
      } else {
        const victim = at(before, action.to);
        assert.ok(geometry(before, piece, action.to, !!victim), label);
        if (victim) {
          assert.notEqual(victim.owner, piece.owner); assert.equal(victim.royal, false);
          assert.ok(!(before.effects as Effect[]).some(e => e.type === 'pacifism' && e.pieceId === victim.id));
          relocate(victim.id, null, 'captured');
        }
        assert.match(action.to, /^[a-h][1-8]$/); relocate(piece.id, action.to as SquareName);
        if (victim || piece.role === 'pawn') halfmove = -1;
      }
      halfmove++; if (piece.owner === 'black') fullmove++;
      expectedEp = piece.role === 'pawn' && Math.abs(xy(action.to)[1] - xy(action.from)[1]) === 2
        ? [{ target: (action.from[0]! + ((Number(action.from[1]) + Number(action.to[1])) / 2)) as SquareName, pawnId: piece.id }] : [];
    }
    if (action.type === 'playCard') {
      const player = before.turn.color, card = expectedPlayers[player].hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(card); assert.equal(card.cardId, action.cardId);
      assert.ok(CARD_CATALOG[action.cardId]!.timing.includes(before.turn.phase));
      assert.equal(before.turn.cardPlays[player], 0);
      expectedPlayers[player].hand = expectedPlayers[player].hand.filter(c => c.id !== card.id);
      expectedPlayers[player].hand.push(expectedPlayers[player].deck.shift()!);
      if (!CARD_CATALOG[action.cardId]!.continuing) expectedPlayers[player].discard.push(card);
      if (number === 38) expectedEffects.push({ type: 'crab', owner: 'white', card, pieceId: 'white-pawn-g2' });
      if (number === 51) expectedEffects.push({ type: 'fortification', owner: 'white', card, from: 'c6', to: 'd6' });
      if (number === 60) {
        expectedPieces.splice(0, expectedPieces.length, ...structuredClone(states[58]!.pieces));
        halfmove = Number(states[58]!.fen.split(' ')[4]); fullmove = Number(states[58]!.fen.split(' ')[5]);
      }
      if (number === 70) relocate('black-bishop-f8', null, 'away');
      if (number === 78) expectedEffects.push({ type: 'pacifism', owner: 'black', card, pieceId: 'black-pawn-g7' });
      if (number === 82) expectedEffects.push({ type: 'challenge', owner: 'white', player: 'black', pieceId: 'black-pawn-e7' });
      if (number === 90) { relocate('white-pawn-e2', 'd2'); halfmove = 0; expectedEp = []; }
      if (number === 97) {
        for (const sq of ['e1', 'g1', 'f2']) assert.ok(at(before, sq), 'White bishop has no empty opposite-color neighbor');
        relocate('black-bishop-c8', 'g3');
      }
      if (number === 103) { relocate('white-rook-a1', 'd8'); relocate('black-rook-a8', 'a1'); halfmove++; expectedEp = []; }
    }
    if (number === 72) { relocate('black-bishop-f8', null, 'captured'); halfmove = 0; }
    if (number === 79) {
      // KC7_card1 artwork explicitly expires Crab when captured or promoted.
      expectedEffects = expectedEffects.filter(e => (e as Effect).type !== 'crab');
      expectedPlayers.white.discard.push({ id: 'white-hand-3-crab', cardId: 'crab' });
    }
    if (number === 84) expectedEffects = expectedEffects.filter(e => (e as Effect).type !== 'challenge');
    const result = applyAction(before, action); assert.ok(result.ok, label); state = result.state;
    assert.deepEqual(state.pieces, expectedPieces, `${label}: physical identities/board`);
    assert.deepEqual(state.players, expectedPlayers, `${label}: card identities and all three zones`);
    assert.deepEqual(state.effects, expectedEffects, `${label}: independent effect records`);
    assert.deepEqual(state.enPassant, expectedEp, `${label}: en passant`);
    assert.equal(Number(state.fen.split(' ')[4]), halfmove, `${label}: halfmove`);
    assert.equal(Number(state.fen.split(' ')[5]), fullmove, `${label}: fullmove`);
    assert.equal(state.orientation, 0);
    assert.equal(state.outcome, null);
    assert.equal(!!state.pendingRescue, number === 59 || number === 81);
    if (number === 70 || number === 71) {
      assert.equal(state.pendingAbduction?.pieceId, 'black-bishop-f8');
      assert.equal(state.pendingAbduction?.durationMs, 10000);
      assert.equal(state.pendingAbduction?.player, 'black');
      assert.equal(state.pendingAbduction?.phase, number === 70 ? 'concealment' : 'recall');
    } else assert.equal(!!state.pendingAbduction, false);
    if (action.type === 'endTurn') {
      assert.equal(checked(before, before.turn.color), false, `${label}: outgoing King safe`);
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
      assert.equal(state.fen, before.fen);
    } else if (number !== 60 && number !== 70 && number !== 71) {
      assert.equal(checked(state, before.turn.color), number === 59 || number === 81, `${label}: independent royal safety`);
    }
    if (number === 60) {
      assert.equal(state.fen, states[58]!.fen);
      assert.deepEqual(state.turn, { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 1, black: 0 } });
      assert.equal(state.history.at(-1)?.reason, 'SELF_CHECK');
    }
    if (number === 103) assert.equal(checked(state, 'black'), true);
    checkState(state);
    assert.equal(digest(state), step.expected, `${label}: stored trace changed; review production changes`);
    states.push(state);
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 9);
  assert.equal(state.fen, '1q1R1n2/p1k4r/np6/3Pp3/3p1Ppp/NPP4P/P2P2K1/r3RBN1 b - - 0 26');
  assert.equal(state.fen, trace.finalFen);
});
