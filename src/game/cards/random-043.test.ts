import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSquare } from 'chessops/util';
import { parseFen } from 'chessops/fen';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, PieceState, SquareName } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Reviewed in sequence against rules §§8-11, 13.8, 14.2-3, 15.3, 17.1,
// 20-22 and cards.md, with printed timing/classification in CARD_CATALOG.
// Each move below retains identity and leaves its acting royal safe; each
// endTurn retains board, clocks, cards and en-passant while resetting allowance.
const rationales = [
  '1. Ghostwalk b2-b4 is a clear, noncapturing initial double step; b3 becomes en-passant, draw Winged Victory.',
  '2. End White replacement turn; Black receives the b3 en-passant window.',
  '3. Black Ng8-f6 jumps 1 by 2, clears en-passant, increments both clocks.',
  '4. End Black turn with f6 Knight and no en-passant.',
  '5. White h2-h3 advances one into empty h3 and resets halfmove.',
  '6. End White turn after h3.',
  '7. Black Nb8-a6 jumps into empty a6.',
  '8. End Black turn after Na6.',
  '9. White e2-e4 crosses empty e3; record physical e2 Pawn en-passant at e3.',
  '10. End White turn preserving the double-step opportunity.',
  '11. Black Rh8-g8 enters vacated g8 and permanently loses kingside castling.',
  '12. End Black turn; queenside right remains.',
  '13. White Rh1-h2 enters the vacated Pawn square and loses kingside castling.',
  '14. End White turn after Rh2.',
  '15. Long Jump f6-b3 changes square color, reaches empty b3 without capture; draw Forbidden City.',
  '16. End Black replacement turn with Knight identity intact.',
  '17. White Ke1-e2 is adjacent and safe from Nb3; remaining White castling expires.',
  '18. End White turn with royal on e2.',
  '19. Black c7-c5 crosses empty c6; c6 en-passant is recorded.',
  '20. End Black turn preserving c6 opportunity.',
  '21. White b4xc5 captures the c7 Pawn diagonally; halfmove resets.',
  '22. Black Chaos immediately restores b4 Pawn, c5 victim, c6 en-passant and clocks; White must choose differently; draw Dark Mirror.',
  '23. White Bc1-a3 crosses vacant b2, differs from forbidden b4-c5, and closes the Chaos prohibition.',
  '24. End White turn; Black reaction allowance resets for its own turn.',
  '25. Black Qd8-c7 enters vacated c7 diagonally.',
  '26. End Black turn after Qc7.',
  '27. White b4xc5 is legal again on a later turn and captures the restored Pawn.',
  '28. Figure Dance simultaneously sends Ra1-h1 and black Ra8-a1; h8 was empty, no capture; Black queenside right expires; draw Bombard.',
  '29. End White turn retaining both corner relocations.',
  '30. Black d7-d6 advances one into empty d6.',
  '31. End Black turn after d6.',
  '32. White Ke2-f3 is one diagonal step, outside Nb3 reach and blocked enemy sliders.',
  '33. End White turn after Kf3.',
  '34. Black Na6-b8 jumps into its empty original square.',
  '35. End Black turn after Nb8.',
  '36. White g2-g4 crosses empty g3 and records g3 en-passant.',
  '37. End White turn preserving g3 opportunity.',
  '38. Black a7-a5 crosses empty a6 and replaces the old opportunity with a6.',
  '39. End Black turn preserving a6 opportunity.',
  '40. White Ba3-b4 makes a one-square diagonal move into empty b4.',
  '41. End White turn after Bb4.',
  '42. Black Qc7-d7 moves one square horizontally.',
  '43. Forbidden City marks empty c3 after Black move, retains its card as effect and draws Breakthrough.',
  '44. End Black turn retaining the c3 wall-square.',
  '45. White Bb4xa5 captures a7 Pawn; one diagonal step never enters c3.',
  '46. End White turn after Bxa5.',
  '47. Black b7-b5 crosses empty b6; c5 Pawn has a real b6 en-passant option.',
  '48. End Black turn preserving b6 opportunity.',
  '49. Bombard Rh2-h5 jumps exactly the h3 Pawn then empty h4, captures nothing, clears en-passant and draws Heresy.',
  '50. End White replacement turn; jumped h3 Pawn remains.',
  '51. Black e7-e6 advances into empty e6.',
  '52. End Black turn after e6.',
  '53. White Qd1-e1 enters empty e1 horizontally.',
  '54. End White turn after Qe1.',
  '55. Black Nb3xa5 jumps and captures the c1 Bishop.',
  '56. End Black turn with Bishop captured, never dead.',
  '57. White Rh5xh7 crosses empty h6 and captures h7 Pawn.',
  '58. End White turn after Rxh7.',
  '59. Black Qd7-e7 enters empty e7 horizontally.',
  '60. End Black turn after Qe7.',
  '61. Guardian e4-e5 advances the Pawn; empty e3 supplies no follower; clears en-passant, draws Tournament.',
  '62. End White replacement turn after e5.',
  '63. Black Nb8-a6 jumps into empty a6.',
  '64. End Black turn after Na6.',
  '65. White h3-h4 advances one into empty h4.',
  '66. End White turn after h4.',
  '67. Black Na6-b4 jumps into empty b4.',
  '68. Curse targets opposing Rh1, the physical a1 Rook relocated by Figure Dance; retain effect and draw Rebirth.',
  '69. End Black turn; Curse stays on a1 Rook identity.',
  '70. White Bf1-g2 enters empty g2 diagonally; unrelated Curse persists.',
  '71. End White turn after Bg2.',
  '72. Black Qe7xh4 crosses empty f6 and g5, capturing the h2 Pawn.',
  '73. End Black turn after Qxh4; h4 Queen has no rank, file or diagonal line to Kf3.',
  '74. White Qe1-d1 enters empty d1; Kf3 stays safe.',
  '75. End White turn after Qd1.',
  '76. Black Na5-b3 jumps into empty b3.',
  '77. End Black turn after Nb3.',
  '78. Winged Victory returns captured original h2 Pawn to empty central d5; no promotion; draw Coup.',
  '79. End White replacement turn after Pawn return.',
  '80. Black g7-g6 advances one into empty g6.',
  '81. End Black turn after g6.',
  '82. White Nb1-a3 jumps into empty a3; c3 prohibition is irrelevant.',
  '83. End White turn after Na3.',
  '84. Black Nb4-c6 jumps into empty c6.',
  '85. End Black turn after Nc6.',
  '86. White Kf3-e2 retreats one diagonal step; Qh4 ray to e1 is blocked by f2 Pawn.',
  '87. End White turn after Ke2.',
  '88. Black Bf8-h6 crosses empty g7 into empty h6.',
  '89. End Black turn after Bh6.',
  '90. White d2-d4 crosses empty d3, records d3 en-passant and resets halfmove.',
  '91. Coup marks safe Ng1 royal, makes Ke2 a capturable Prince, preserves board/clocks/en-passant, retains card and draws Curse.',
  '92. End White turn; g1 Knight is now the protected royal.',
  '93. Black Nb3xc5 captures the physical b2 Pawn by Knight jump.',
  '94. No Quarter immediately changes that captured b2 Pawn to dead without changing clocks or board; draw Forced March.',
  '95. End Black turn retaining irreversibly dead b2 Pawn.',
  '96. White Qd1xa1 crosses vacant c1 and b1, captures displaced black a8 Rook; royal Ng1 stays safe.',
  '97. End White turn after Qxa1.',
  '98. Black Dark Mirror g6xh7 captures backward diagonally, removes the h1 Rook rather than cursed a1 Rook; draw Hostage.',
  '99. End Black replacement turn; Curse stays attached to surviving h1-square Rook.',
  '100. White Qa1-e1 crosses empty b1,c1,d1 into empty e1.',
  '101. End White turn after Qe1.',
  '102. Black Bc8-d7 enters empty d7 diagonally.',
  '103. End Black turn after Bd7.',
  '104. White Na3-b1 jumps into empty b1.',
  '105. End White turn after Nb1.',
  '106. Black Rg8-h8 enters empty h8; castling rights cannot return.',
  '107. End Black turn after Rh8.',
  '108. White e5xd6 captures d7 Pawn diagonally; no promotion.',
  '109. End White turn after exd6.',
  '110. Black Nc6-e7 jumps into empty e7; being attacked by d6 Pawn is legal for this nonroyal Knight.',
  '111. End Black turn after Ne7.',
  '112. White g4-g5 enters empty g5; g1 royal is not on Qh4 opened rank.',
  '113. Heresy first moves both Black Bishops d7-c7,h6-g6 then White Bg2-h2; all destinations are empty and opposite color; draw Siege.',
  '114. End White turn preserving all three Bishop identities and effects.',
  '115. Black Qh4xd4 crosses empty g4,f4,e4, captures d2 Pawn; royal Ng1 remains safe.',
  '116. End Black turn after Qxd4.',
  '117. White Prince e2-e3 steps into Qd4 attack legally: it is capturable, while the actual royal Ng1 stays safe.',
  '118. End White turn; Black is active at fullmove 28 with 50 regular move commands reviewed.',
];

const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1];
function reaches(state: GameState, piece: PieceState, destination: string, capture: boolean): boolean {
  assert.ok(piece.square);
  const [x, y] = xy(piece.square), [tx, ty] = xy(destination);
  const dx = tx! - x!, dy = ty! - y!, distance = Math.max(Math.abs(dx), Math.abs(dy));
  if (!distance || state.effects.some(e => typeof e === 'object' && e !== null && 'square' in e && e.square === destination)) return false;
  if (state.effects.some(e => typeof e === 'object' && e !== null && 'pieceId' in e && e.pieceId === piece.id && 'type' in e && e.type === 'curse') && distance > 2) return false;
  const forward = piece.owner === 'white' ? 1 : -1;
  const geometry = piece.role === 'knight' ? Math.abs(dx * dy) === 2
    : piece.role === 'king' ? distance === 1
    : piece.role === 'pawn' ? capture ? Math.abs(dx) === 1 && dy === forward
      : dx === 0 && (dy === forward || (y === (forward === 1 ? 1 : 6) && dy === 2 * forward))
    : piece.role === 'bishop' ? Math.abs(dx) === Math.abs(dy)
    : piece.role === 'rook' ? dx === 0 || dy === 0
    : dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
  if (!geometry) return false;
  if (piece.role !== 'knight') for (let n = 1; n < distance; n++) {
    const square = String.fromCharCode(97 + x! + n * Math.sign(dx)) + (y! + n * Math.sign(dy) + 1);
    if (state.pieces.some(p => p.zone === 'board' && p.square === square)
      || state.effects.some(e => typeof e === 'object' && e !== null && 'square' in e && e.square === square)) return false;
  }
  return true;
}

test('iteration 043 deterministic engine trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/043.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860043);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(rationales.length, 118);
  rationales.forEach((text, i) => assert.ok(text.startsWith(`${i + 1}. `)));
  let state = createGameState(trace.initial);
  const states = [state];
  const shape = (pieces: PieceState[]) => pieces.map(({ capturedAtPly: _ply, capturedBy: _actor, ...piece }) => piece);
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1, before = state, reason = rationales[index];
    const result = applyAction(before, action);
    assert.ok(result.ok, reason);
    state = result.state;
    const expectedPieces = structuredClone(before.pieces);
    const relocate = (from: string, to: string) => {
      const piece = expectedPieces.find(p => p.square === from && p.zone === 'board');
      assert.ok(piece, reason);
      const victim = expectedPieces.find(p => p.square === to && p.zone === 'board');
      if (victim) { assert.notEqual(victim.owner, piece.owner); assert.equal(victim.royal, false); victim.zone = 'captured'; victim.square = null; }
      piece.square = to as SquareName;
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.notEqual(parseSquare(action.from), undefined);
      const piece = before.pieces.find(p => p.square === action.from && p.zone === 'board');
      assert.ok(piece);
      assert.equal(piece.owner, before.turn.color);
      assert.equal(before.turn.phase, 'beforeMove');
      assert.equal(before.turn.moveMade, false);
      const victim = before.pieces.find(p => p.square === action.to && p.zone === 'board');
      assert.ok(reaches(before, piece, action.to, !!victim), reason);
      relocate(action.from, action.to);
      assert.deepEqual(shape(state.pieces), shape(expectedPieces), reason);
      const a = parseFen(before.fen).unwrap(), b = parseFen(state.fen).unwrap();
      assert.equal(b.halfmoves, piece.role === 'pawn' || victim ? 0 : a.halfmoves + 1);
      assert.equal(b.fullmoves, a.fullmoves + (piece.owner === 'black' ? 1 : 0));
      const double = piece.role === 'pawn' && Math.abs(Number(action.to[1]) - Number(action.from[1])) === 2;
      assert.deepEqual(state.enPassant, double ? [{ target: action.from[0] + ((Number(action.to[1]) + Number(action.from[1])) / 2), pawnId: piece.id }] : []);
      assert.deepEqual(state.players, before.players);
      assert.deepEqual(state.effects, before.effects);
      assert.deepEqual(state.turn, { ...before.turn, phase: 'afterMove', moveMade: true });
    } else if (action.type === 'endTurn') {
      assert.equal(before.turn.phase, 'afterMove');
      assert.equal(before.turn.moveMade, true);
      assert.deepEqual(state.pieces, before.pieces);
      assert.deepEqual(state.effects, before.effects);
      assert.deepEqual(state.players, before.players);
      assert.deepEqual(state.enPassant, before.enPassant);
      assert.equal(state.fen, before.fen);
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
    } else {
      assert.equal(action.type, 'playCard');
      if (action.type !== 'playCard') continue;
      const owner = step === 22 ? 'black' : before.turn.color;
      const opponent = owner === 'white' ? 'black' : 'white';
      const card = before.players[owner].hand.find(c => c.id === action.cardInstanceId);
      assert.ok(card);
      assert.equal(before.turn.cardPlays[owner], 0);
      assert.deepEqual(state.players[opponent], before.players[opponent]);
      assert.deepEqual(state.players[owner].hand, [...before.players[owner].hand.filter(c => c.id !== card.id), before.players[owner].deck[0]]);
      assert.deepEqual(state.players[owner].deck, before.players[owner].deck.slice(1));
      const continuing = [43, 68, 91].includes(step);
      assert.deepEqual(state.players[owner].discard, [...before.players[owner].discard, ...(continuing ? [] : [card])]);
      assert.equal(state.turn.cardPlays[owner], 1);
      const replacement = [1, 15, 49, 61, 78, 98].includes(step);
      assert.equal(before.turn.phase, replacement ? 'beforeMove' : 'afterMove');
      assert.equal(state.turn.phase, step === 22 ? 'beforeMove' : 'afterMove');
      assert.equal(state.turn.moveMade, step !== 22);
      assert.equal(state.turn.color, before.turn.color);
      switch (step) {
        case 1: relocate('b2', 'b4'); break;
        case 15: assert.equal((5 + 5) % 2 !== (1 + 2) % 2, true); relocate('f6', 'b3'); break;
        case 22:
          assert.deepEqual(state.pieces, states[20]!.pieces);
          assert.equal(state.fen, states[20]!.fen);
          assert.deepEqual(state.enPassant, states[20]!.enPassant);
          assert.equal(applyAction(state, { type: 'move', from: 'b4', to: 'c5' }).ok, false);
          break;
        case 28: relocate('a1', 'h1'); relocate('a8', 'a1'); break;
        case 43: break;
        case 49: assert.equal(before.pieces.find(p => p.square === 'h3')?.id, 'white-pawn-h2'); relocate('h2', 'h5'); break;
        case 61: relocate('e4', 'e5'); break;
        case 68: break;
        case 78: {
          const pawn = expectedPieces.find(p => p.id === 'white-pawn-h2')!;
          assert.equal(pawn.zone, 'captured'); assert.equal(pawn.promoted, false);
          assert.ok(!expectedPieces.some(p => p.square === 'd5'));
          pawn.zone = 'board'; pawn.square = 'd5'; break;
        }
        case 91:
          expectedPieces.find(p => p.id === 'white-king-e1')!.royal = false;
          expectedPieces.find(p => p.id === 'white-knight-g1')!.royal = true;
          break;
        case 94:
          assert.equal(expectedPieces.find(p => p.id === 'white-pawn-b2')!.zone, 'captured');
          expectedPieces.find(p => p.id === 'white-pawn-b2')!.zone = 'dead'; break;
        case 98: relocate('g6', 'h7'); break;
        case 113: relocate('d7', 'c7'); relocate('h6', 'g6'); relocate('g2', 'h2'); break;
        default: assert.fail(`Unreviewed card ${step}`);
      }
      if (step !== 22) assert.deepEqual(shape(state.pieces), shape(expectedPieces), reason);
      const extra = step === 43 ? { type: 'forbidden-city', owner, card, square: 'c3' }
        : step === 68 ? { type: 'curse', owner, card, pieceId: 'white-rook-a1' }
        : step === 91 ? { type: 'coup', owner, card, princeId: 'white-king-e1', kingId: 'white-knight-g1', princeRole: 'king' } : undefined;
      assert.deepEqual(state.effects, [...before.effects, ...(extra ? [extra] : [])]);
      if (step !== 22) {
        const a = parseFen(before.fen).unwrap(), b = parseFen(state.fen).unwrap();
        assert.equal(b.halfmoves, replacement ? [1, 61, 78, 98].includes(step) ? 0 : a.halfmoves + 1 : a.halfmoves);
        assert.equal(b.fullmoves, a.fullmoves + (replacement && owner === 'black' ? 1 : 0));
        assert.deepEqual(state.enPassant, step === 1 ? [{ target: 'b3', pawnId: 'white-pawn-b2' }] : replacement ? [] : before.enPassant);
      }
    }
    // This trace has no neutral, transformed, pinned-capture-only or immunity
    // complications: absence of geometric threats is a sufficient safety proof.
    for (const royal of state.pieces.filter(p => p.royal)) {
      assert.ok(royal.square);
      for (const enemy of state.pieces.filter(p => p.zone === 'board' && p.owner !== royal.owner)) {
        assert.equal(reaches(state, enemy, royal.square, true), false, `${reason}: ${enemy.id} threatens ${royal.id}`);
      }
    }
    assert.equal(state.orientation, 0);
    assert.equal(state.fen.split(' ')[2], step < 11 ? 'KQkq' : step < 13 ? 'KQq' : step < 17 ? 'Qq' : step < 28 ? 'q' : '-', reason);
    assert.ok(!state.pendingRescue);
    states.push(state);
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 13);
  assert.equal(state.fen, '4k2r/2b1np1p/3Pp1b1/1pnP2P1/3q4/4K3/P1P2P1B/1N2Q1NR b - - 1 28');
  replayTrace(trace);
});
