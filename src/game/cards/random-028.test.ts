import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Chess } from 'chessops/chess';
import { makeBoardFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Sequential review of the generated rows against rules §§8–13 and card text.
const rationales = [
  '1. e2-e4 crosses empty e3; double pawn move creates e3 opportunity.',
  '2. White finishes; Black receives the e3 opportunity and fresh allowances.',
  '3. g7-g6 advances to empty g6 and expires e3.',
  '4. Black finishes; White starts with unchanged board and hands.',
  '5. Qd1-f3 crosses vacated e2; no capture or check exposure.',
  '6. White finishes; Black starts without a card expenditure.',
  '7. Ng8-f6 is an unobstructed knight jump to an empty square.',
  '8. Fortification after Black move creates diagonal a6/b5 boundary; continuing card stays out of discard and draws Bog.',
  '9. Black finishes; the wall persists and allowances reset.',
  '10. Qf3-a3 crosses empty e3,d3,c3,b3; wall is elsewhere.',
  '11. White finishes without changing wall, cards, or board.',
  '12. a7-a6 advances one square; it does not cross a6/b5 wall.',
  '13. Black finishes; White starts with wall retained.',
  '14. Qa3-d3 crosses empty b3,c3; neither King is exposed.',
  '15. White finishes; Black starts with fresh allowance.',
  '16. Masquerade moves Nf6-d4 diagonally through empty e5 as Queen; no capture, Black King safe, card replaces move and draws Annexation.',
  '17. Replacement move ends; White receives turn.',
  '18. Qd3-h3 crosses empty e3,f3,g3; no wall crossing.',
  '19. White finishes without card use.',
  '20. d7-d5 crosses empty d6; e4 pawn could capture d5 normally, and d6 EP is recorded.',
  '21. Black finishes; d6 EP remains available for White.',
  '22. Qh3xh7 crosses h4,h5,h6 and captures Black h-pawn; expires EP.',
  '23. White finishes; captured pawn remains captured.',
  '24. Nb8-d7 jumps to the square vacated by Black d-pawn.',
  '25. Black finishes; no effects expire.',
  '26. Ke1-d1 enters safe vacated Queen square; White castling rights are lost.',
  '27. White finishes; Black starts.',
  '28. d5xe4 captures White e-pawn diagonally; d1 King is not attacked.',
  '29. Black finishes; pawn capture and clock reset persist.',
  '30. Qh7-h3 returns along clear h6,h5,h4.',
  '31. White finishes; Queen remains exposed on h3.',
  '32. Rh8xh3 travels through empty h7,h6,h5,h4 and captures Queen; Black kingside right is lost.',
  '33. Black finishes with White Queen captured.',
  '34. f2-f4 crosses empty f3; adjacent e4 pawn can capture en passant on f3.',
  '35. White finishes; f3 EP persists for Black.',
  '36. Nd4-b5 jumps to empty b5; jump ignores walls and declines f3 EP.',
  '37. Black finishes; EP is expired.',
  '38. d2-d3 advances one square into empty d3.',
  '39. White finishes; Black starts.',
  '40. Nd7-e5 is a legal knight jump; no capture.',
  '41. Black finishes without card use.',
  '42. Nb1-a3 is a legal knight jump onto empty a3.',
  '43. After-move Anathema swaps opposing Bf8/Ra8 physically; no capture, no clock advance, neither King exposed; draw Blessing.',
  '44. White finishes; swapped identities remain on a8/f8.',
  '45. Ne5-g4 jumps to empty g4; White d1 King remains safe.',
  '46. Black finishes.',
  '47. Kd1-d2 enters vacated safe d2; Ng4 and Rh3 do not attack d2.',
  '48. White finishes.',
  '49. Rh3-e3 crosses empty g3,f3; d3 pawn blocks its left ray.',
  '50. Black finishes; d2 King is not in check.',
  '51. Blessing sends b2 pawn diagonally to empty c3 as Bishop; no capture, still a pawn, replacement move draws Peace Talks.',
  '52. White replacement move finishes.',
  '53. Annexation moves a6 pawn two forward across empty a5 to empty a4; no wall crossing, no starting-square EP, draws Bombard.',
  '54. Black replacement move finishes.',
  '55. Na3-c4 jumps to empty c4; no check exposure.',
  '56. White finishes.',
  '57. Assassin lets Ke8 capture own Qd8; d8 is safe, Queen is captured not dead, Black rights removed, draw Pacifism.',
  '58. Black replacement move finishes.',
  '59. d3xe4 captures Black original d-pawn; e3 Rook does not attack d2 King.',
  '60. White finishes.',
  '61. Re3-h3 crosses empty f3,g3; no capture.',
  '62. Black finishes.',
  '63. a2-a3 advances one square; a4 is occupied but irrelevant to single step.',
  '64. White finishes.',
  '65. Rh3-d3 crosses empty g3,f3,e3 and checks Kd2 down the d-file.',
  '66. Black finishes; White receives checked turn.',
  '67. Long Jump g1-h7 has opposite square colors but cannot answer Rd3 check; fizzle spends/draws Fatal Attraction, leaves Knight g1 and Regular Move available (§11.6).',
  '68. Kd2-e1 leaves Rd3 line and enters safe e1, curing check.',
  '69. White finishes; its spent card does not affect next-turn allowances.',
  '70. Rf8-e8 moves to vacated e8; e7 pawn blocks its file.',
  '71. Black finishes.',
  '72. Nc4-b6 jumps to empty b6; does not cross wall as sliding move.',
  '73. White finishes.',
  '74. Rd3-g3 crosses empty e3,f3; White King stays safe.',
  '75. Black finishes.',
  '76. Ng1-e2 jumps to empty e2, blocking the e-file in advance.',
  '77. White finishes.',
  '78. Before-move Pacifism marks own nonroyal e7 pawn; it cannot capture or be captured, move still available, draw Split Knight.',
  '79. Rg3-e3 crosses empty f3; Ne2 blocks check on Ke1.',
  '80. Black finishes; both continuing effects persist.',
  '81. c3-c4 advances the original b-pawn one square.',
  '82. White finishes.',
  '83. Nb5-d4 jumps clear to empty d4.',
  '84. Black finishes.',
  '85. Nb6xa4 captures Annexation pawn; ordinary knight capture is unaffected by the wall.',
  '86. Peace Talks after capture removes precisely Fortification and discards its Black card; Pacifism remains, White draws Revenge.',
  '87. White finishes; no wall remains.',
  '88. Nd4xe2 captures White Knight; Black Knight now itself blocks Re3 from Ke1.',
  '89. Black finishes.',
  '90. Rh1-g1 enters empty adjacent square; e2 blocker still protects King.',
  '91. White finishes.',
  '92. Bombard Re8xe4 jumps exactly e7 Pacifist pawn, crosses empty e6,e5, captures White d-pawn; shielded jumped pawn untouched, draw Truce.',
  '93. Black replacement move finishes.',
  '94. Na4-b2 jumps to empty b2; no King exposure.',
  '95. White finishes.',
  '96. Ne2-d4 uncovers Re3-e1 check against White King.',
  '97. Black finishes; White begins in check.',
  '98. Ra1-a2 does not cure Re3 check; staged only under §11.6 pending same-turn saving card, endTurn is forbidden.',
  '99. Fatal Attraction on g1 cannot freeze remote Re3; failed rescue rewinds Ra2-a1 and clock, spends/discards card, draws Chaos, grants replacement move with no further card.',
  '100. Bf1-e2 interposes on Re3/Ke1 file; e1 King is safe and the move can finish.',
  '101. White finishes; Bishop remains the e-file blocker.',
  '102. Nd4-c6 jumps empty c6, leaving both Kings safe.',
  '103. Black finishes.',
  '104. c2-c3 advances to empty c3; Be2 continues shielding King.',
  '105. White finishes.',
  '106. Kd8-d7 enters safe d7; White Be2 diagonal ends before d7 and Nb2 cannot attack it.',
  '107. Black finishes.',
  '108. Nb2-a4 jumps to empty a4.',
  '109. White finishes.',
  '110. Pacifist e7-e5 crosses empty e6; noncapture allowed, same marker follows identity; creates e6 EP although no adjacent White pawn can use it.',
  '111. Black finishes; e6 EP and Pacifism persist.',
  '112. h2-h4 crosses empty h3, declines e6 EP and creates h3 opportunity.',
  '113. White finishes; h3 opportunity remains.',
  '114. Re4xc4 crosses empty d4 and captures original White b-pawn; h3 EP expires, Be2 continues protecting King.',
  '115. Black finishes the fiftieth move command; White starts safe with only Pacifism active.',
];

test('iteration 028 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/028.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860028);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.length, 115);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 11);
  let state = createGameState(trace.initial);
  const snapshots = [state];
  const wall = { type: 'fortification', owner: 'black', card: { id: 'black-hand-3-fortification', cardId: 'fortification' }, from: 'a6', to: 'b5' };
  const pacifism = { type: 'pacifism', owner: 'black', card: { id: 'black-deck-3-pacifism', cardId: 'pacifism' }, pieceId: 'black-pawn-e7' };
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1;
    const why = rationales[index]!;
    assert.ok(why.startsWith(`${step}. `));
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, why);
    state = result.state;
    assert.deepEqual(state.effects, [...(step >= 8 && step < 86 ? [wall] : []), ...(step >= 78 ? [pacifism] : [])], why);
    assert.equal(!!state.pendingRescue, step === 98, why);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const position = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap();
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! };
      // The wall never intersects a reviewed sliding path. Pacifism only affects
      // the remote e7/e5 pawn, which makes no capture and never checks a King.
      assert.equal(position.isLegal(move), step !== 98, why);
      position.play(move);
      assert.equal(makeBoardFen(position.board), state.fen.split(' ')[0], why);
      const pawn = before.pieces.find(p => p.square === action.from)!;
      const expectedEP = pawn.role === 'pawn' && Math.abs(Number(action.to[1]) - Number(action.from[1])) === 2
        ? [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}`, pawnId: pawn.id }] : [];
      assert.deepEqual(state.enPassant, expectedEP, why);
      assert.deepEqual(state.players, before.players, why);
      assert.equal(state.turn.moveMade, true, why);
      assert.equal(state.turn.phase, 'afterMove', why);
      assert.equal(state.turn.color, before.turn.color, why);
      assert.equal(parseFen(state.fen).unwrap().halfmoves, position.halfmoves, why);
      assert.equal(parseFen(state.fen).unwrap().fullmoves, position.fullmoves, why);
    } else if (action.type === 'endTurn') {
      assert.deepEqual(state.pieces, before.pieces, why);
      assert.deepEqual(state.players, before.players, why);
      assert.equal(state.fen, before.fen, why);
      assert.deepEqual(state.enPassant, before.enPassant, why);
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }, why);
    } else if (action.type === 'playCard') {
      const actor = before.turn.color;
      const card = before.players[actor].hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(card, why);
      assert.ok(CARD_CATALOG[card.cardId]!.timing.includes(before.turn.phase), why);
      assert.equal(before.turn.cardPlays[actor], 0, why);
      assert.equal(state.turn.cardPlays[actor], 1, why);
      assert.deepEqual(state.players[actor].hand, [...before.players[actor].hand.filter(c => c.id !== card.id), before.players[actor].deck[0]], why);
      assert.deepEqual(state.players[actor].deck, before.players[actor].deck.slice(1), why);
      assert.deepEqual(state.players[actor].discard, [...before.players[actor].discard, ...([8, 78].includes(step) ? [] : [card])], why);
      const other = actor === 'white' ? 'black' : 'white';
      assert.deepEqual(state.players[other], step === 86 ? { ...before.players[other], discard: [...before.players[other].discard, wall.card] } : before.players[other], why);
      const shifts: Record<number, Record<string, string | null>> = {
        16: { 'black-knight-g8': 'd4' },
        43: { 'black-rook-a8': 'f8', 'black-bishop-f8': 'a8' },
        51: { 'white-pawn-b2': 'c3' }, 53: { 'black-pawn-a7': 'a4' },
        57: { 'black-king-e8': 'd8', 'black-queen-d8': null },
        92: { 'black-rook-a8': 'e4', 'white-pawn-d2': null },
        99: { 'white-rook-a1': 'a1' },
      };
      const expectedPieces = before.pieces.map(p => {
        const square = shifts[step]?.[p.id];
        return square === undefined ? p : { ...p, square, zone: square === null ? 'captured' : 'board', ...(square === null ? { capturedBy: actor } : {}) };
      });
      assert.deepEqual(state.pieces, expectedPieces, why);
      assert.deepEqual(state.enPassant, before.enPassant, why);
      assert.equal(state.turn.moveMade, ![67, 78, 99].includes(step), why);
      if ([8, 43, 78, 86, 67].includes(step)) {
        assert.equal(state.fen.split(' ').slice(4).join(' '), before.fen.split(' ').slice(4).join(' '), why);
      }
      if (step === 99) {
        assert.equal(state.fen, snapshots[97]!.fen, why);
        assert.deepEqual(state.history.at(-1), { type: 'cardFizzled', cardId: 'fatal-attraction', reason: 'SELF_CHECK', movement: [], preservePreviousMove: false }, why);
      }
    }
    if (step === 98) assert.equal(applyAction(state, { type: 'endTurn' }).ok, false, why);
    snapshots.push(state);
  }
  assert.equal(state.fen, 'b1b5/1ppk1p2/2n3p1/4p3/N1r2PnP/P1P1r3/4B1P1/R1B1K1R1 w - - 0 28');
  assert.deepEqual(replayTrace(trace), state);
});
