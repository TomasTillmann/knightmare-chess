import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Chess } from 'chessops/chess';
import { makeBoardFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Reviewed in order from rules §§8–13, 17.1/17.3 and 20 and the printed catalog.
const rationales = [
  '1. c2-c4 crosses empty c3; initial pawn double step creates c3 en passant, King e1 stays shielded.',
  '2. White ends its completed move; Black receives the c3 en-passant window and fresh allowances.',
  '3. f7-f5 crosses empty f6; Black pawn double step replaces c3 with f6 en passant.',
  '4. Black ends; White receives f6 opportunity without a board or clock change.',
  '5. Queen d1-c2 uses the now-empty diagonal destination; no capture and en passant expires.',
  '6. White ends; Black starts with both card allowances reset.',
  '7. Black Plots before moving spends and draws Sanctuary; zero additional plays are permitted.',
  '8. b7-b5 crosses empty b6; ordinary movement closes unused Plots and creates b6 opportunity.',
  '9. Black ends; White receives b6 opportunity and fresh allowances.',
  '10. b2-b4 crosses empty b3 and stops before b5; replaces en passant with b3.',
  '11. White ends without any mandatory choice; board and b3 window persist.',
  '12. c7-c5 crosses empty c6 and stops before c4; creates c6 opportunity.',
  '13. White plays Plots in the opponent-move window, spends its reaction and draws Cathedral.',
  '14. End turn closes unused White Plots, resets allowances, and retains the c6 opportunity.',
  '15. Queen c2-e4 traverses empty d3; no check on e8 because e7 blocks its file.',
  '16. White ends with e1 safe; Black starts, no en passant remains.',
  '17. Black f5-f4 advances to empty f4, resetting the pawn clock.',
  '18. Black ends; e8 remains screened by e7 and other home pieces.',
  '19. Queen e4xh7 traverses f5 and g6, captures the h7 pawn; g7 blocks its line toward e7.',
  '20. White ends; the captured h7 identity stays captured and Black may act.',
  '21. Queen d8-c7 is a one-square diagonal into the pawn-vacated square.',
  '22. Black ends; neither queen has an open line to the enemy King.',
  '23. Knight g1-f3 is a two-by-one leap into an empty square.',
  '24. White ends with all physical pieces and card zones preserved.',
  '25. e7-e5 crosses empty e6 and creates e6 en passant; Queen h7 is blocked by g7.',
  '26. After moving, Black Treason swaps enemy rook a1 and knight b1, without capture or move geometry; draw Toll.',
  '27. Black ends; swapped identities persist, while original castling entitlement is retained for this non-move swap.',
  '28. g2-g3 is one forward empty square and expires e6 en passant.',
  '29. White ends; g3 continues to screen Black pawn f4 from the King.',
  '30. d7-d5 crosses empty d6 and creates d6 en passant.',
  '31. Black ends, passing the d6 en-passant opportunity to White.',
  '32. e2-e4 crosses empty e3; Black f4 could capture en passant, so e3 is live.',
  '33. White Cathedral swaps own rook b1 with bishop f1 after moving; no captures, clocks and e3 persist; draw Hostage.',
  '34. White ends; Black receives its move with the Cathedral positions and e3 window intact.',
  '35. Knight b8-d7 leaps to the vacated pawn square and declines en passant.',
  '36. Black ends with d7 knight and e8 King safe.',
  '37. h2-h4 crosses empty h3 and creates h3 en passant.',
  '38. White ends; h3 opportunity persists only until the next move.',
  '39. Bishop c8-a6 traverses empty b7 and ends on empty a6; h3 expires.',
  '40. Black ends; Bishop a6 is blocked toward e2 by White pawn c4.',
  '41. c4xd5 captures Black d-pawn one diagonal forward, preserving White pawn identity.',
  '42. White ends; Black d-pawn remains captured and clocks remain reset.',
  '43. Bishop a6-c8 traverses empty b7, returning without capture.',
  '44. Black ends; Queen h7 still cannot check through g7.',
  '45. g3xf4 captures Black f-pawn diagonally forward and clears g3.',
  '46. White ends; the moved g-pawn stays on f4 with no promotion.',
  '47. Black c5xb4 captures White b-pawn diagonally forward, with no en passant.',
  '48. Black ends; captured White pawn is not returned or discarded as a card.',
  '49. Bishop c1-b2 uses the square vacated by White b-pawn.',
  '50. White ends; Bishop b2 is blocked on its northeast ray by e5 pawn.',
  '51. Queen c7-d6 moves diagonally to empty d6; White e1 is not on its open rays.',
  '52. Black ends with both kings safe and no outstanding choice.',
  '53. Original f1 bishop b1-c2 moves one diagonal square after Cathedral relocation.',
  '54. White ends without changing the relocated bishop identity.',
  '55. Knight g8-h6 leaps to empty h6 and leaves e8 safe.',
  '56. Black ends; no capture or card draw occurs.',
  '57. Bishop c2-b1 returns along the same clear diagonal.',
  '58. White ends; halfmove clock and card hands remain unchanged.',
  '59. Bishop c8-b7 moves one clear diagonal square.',
  '60. Black ends; its bishop ray to e4 is blocked by White d5.',
  '61. Bishop b1-d3 traverses empty c2 and ends on empty d3.',
  '62. White ends with the bishop on d3 and no new check.',
  '63. King e8-e7 steps to a safe square; Queen h7 is screened by g7; both Black castling rights end.',
  '64. Black ends; ordinary King movement does not regain castling rights.',
  '65. Bishop d3-c4 steps diagonally; White d5 blocks its northeast ray toward f7.',
  '66. White ends without exposing its King or directly checking Black.',
  '67. King e7-f7 is safe: Queen h7 is blocked by g7 and Bishop c4 by d5.',
  '68. Black ends; its moved King remains on f7.',
  '69. Knight f3-g1 leaps back to empty g1; neither King is exposed.',
  '70. White ends; no original castling rights are restored by returning a knight.',
  '71. Bishop f8-e7 moves one diagonal onto the King-vacated square.',
  '72. Black ends; Bishop e7 does not attack White e1.',
  '73. d2-d3 advances into the bishop-vacated square and resets the pawn clock.',
  '74. White ends; no en-passant right follows a one-square pawn move.',
  '75. Bishop e7xh4 crosses empty f6 and g5, captures White h-pawn; f2 blocks its ray to e1.',
  '76. Black ends; White King remains safe behind f2.',
  '77. a2-a4 crosses empty a3; Black b4 has the a3 en-passant option.',
  '78. White ends and passes the a3 opportunity to Black.',
  '79. Black Tournament replaces its move: swap own knight d7 with enemy knight a1, no capture; expire a3 and draw Abduction.',
  '80. Black ends its replacement move; White knight now d7 does not check f7.',
  '81. Rook h1-h3 crosses empty h2; actual rook movement revokes h1 castling entitlement.',
  '82. White ends; original a1 entitlement survives only as latent A after the earlier swap.',
  '83. a7-a6 advances one square into the bishop-vacated destination.',
  '84. Black Crab after moving marks its a6 pawn identity permanently; retain card as effect and draw Cowardice.',
  '85. Black ends; Crab persists on original a7 pawn, which stays physically a pawn.',
  '86. Queen h7-g6 gives diagonal check to Black f7; White King e1 remains safe.',
  '87. White ends; Black starts checked and may answer with movement or a legal card.',
  '88. King f7-e8 remains on Queen g6-f7-e8 ray: only provisional under §11.6, pending rescue prevents turn completion.',
  '89. White Think Again cancels that latest move, restores f7 and clocks, spends reaction/draws Fog of War; replacement must differ.',
  '90. Rook a8-b8 does not cure Queen g6 check on f7: provisional pending rescue, not a completed legal turn.',
  '91. Black Cowardice d3-d1 has empty d2 path but fails to cure check; spend/draw Doppelganger and undo unsafe rook move.',
  '92. King f7-g8 escapes: g7 blocks Queen g6 file and knight d7 does not attack g8.',
  '93. Black ends only after this safe replacement; both turn allowances reset.',
  '94. Queen g6-f5 moves diagonally; g8 remains safe behind g7 on the f5-g6-h7 ray.',
  '95. White ends; Crab on a6 changes no relevant King attack.',
  '96. Rook a8-f8 traverses b8,c8,d8,e8 now empty; Black King g8 stays safe.',
  '97. Black ends; no additional movement or cards are granted.',
  '98. f2-f3 exposes Bishop h4-g3-f2-e1: only a provisional move pending an after-move rescue.',
  '99. Anathema b7/f8 swaps unrelated enemy bishop/rook and cannot stop h4 check: fizzle, spend/draw Doomsayer, restore f2 and clocks.',
  '100. Bishop b2xe5 traverses c3,d4 and captures Black e-pawn; f2 still shields White King.',
  '101. White ends its safe replacement, keeping Anathema spent.',
  '102. Rook f8-f7 moves one file square; King g8 stays safe.',
  '103. Black ends without disturbing the permanent Crab or any piece identity.',
  '104. Rook h3-e3 traverses empty g3 and f3, restored by failed rescue; no capture.',
  '105. White ends; its King is still protected by f2 and final card allowances reset.',
  '106. Queen d6-e7 is one diagonal empty square, no capture or check on e1 through e5/e4.',
  '107. Black ends; White begins safe, no pending rescue, 50 move commands including three later undone attempts.',
];

test('iteration 034 sequential semantic review', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/034.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860034);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.length, 107);
  const states = [createGameState(trace.initial)];
  const crab = { type: 'crab', owner: 'black', card: { id: 'black-hand-1-crab', cardId: 'crab' }, pieceId: 'black-pawn-a7' };
  const unsafe = new Set([88, 90, 98]);
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1;
    assert.ok(rationales[index]!.startsWith(`${step}. `));
    const before = states.at(-1)!;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationales[index]);
    const after = result.state;
    states.push(after);
    assert.equal(after.orientation, 0);
    assert.equal(after.outcome, null);
    assert.equal(!!after.pendingRescue, unsafe.has(step), rationales[index]);
    assert.deepEqual(after.effects, step >= 84 ? [crab] : []);
    assert.ok(!after.pendingAbduction && !after.pendingDoomsayer && !after.underElfHill?.length);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = parseSquare(action.from)!;
      const to = parseSquare(action.to)!;
      const setup = parseFen(before.fen).unwrap();
      const position = Chess.fromSetup(setup).unwrap();
      const move = { from, to };
      // Crab stays on a6 throughout and has the same b5 attack as an ordinary pawn.
      assert.equal(position.isLegal(move), !unsafe.has(step), rationales[index]);
      const moving = before.pieces.find(piece => piece.square === action.from)!;
      const victim = before.pieces.find(piece => piece.square === action.to);
      assert.equal(moving.owner, before.turn.color);
      const dx = Math.abs(from % 8 - to % 8), dy = Math.abs(Math.floor(from / 8) - Math.floor(to / 8));
      if (moving.role === 'king') assert.equal(Math.max(dx, dy), 1);
      if (moving.role === 'rook') assert.ok(dx === 0 || dy === 0);
      if (moving.role === 'bishop') assert.equal(dx, dy);
      if (moving.role === 'knight') assert.equal(dx * dy, 2);
      if (moving.role === 'queen') assert.ok(dx === dy || dx === 0 || dy === 0);
      if (moving.role === 'pawn') {
        assert.equal(dx, victim ? 1 : 0);
        assert.ok(dy === 1 || dy === 2);
        assert.equal(Math.sign(to - from), moving.owner === 'white' ? 1 : -1);
      }
      position.play(move);
      assert.equal(makeBoardFen(position.board), after.fen.split(' ')[0]);
      for (const piece of before.pieces) {
        const actual = after.pieces.find(item => item.id === piece.id)!;
        assert.deepEqual([actual.owner, actual.role, actual.originalRole, actual.neutral, actual.royal, actual.promoted],
          [piece.owner, piece.role, piece.originalRole, piece.neutral, piece.royal, piece.promoted]);
        assert.equal(actual.square, piece.id === moving.id ? action.to : piece.id === victim?.id ? null : piece.square);
        assert.equal(actual.zone, piece.id === victim?.id ? 'captured' : piece.zone);
      }
      assert.deepEqual(after.players, before.players);
      const fields = after.fen.split(' '), prior = before.fen.split(' ');
      assert.equal(Number(fields[4]), moving.role === 'pawn' || victim ? 0 : Number(prior[4]) + 1);
      assert.equal(Number(fields[5]), Number(prior[5]) + (moving.owner === 'black' ? 1 : 0));
      assert.deepEqual(after.enPassant, moving.role === 'pawn' && dy === 2
        ? [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}`, pawnId: moving.id }] : []);
      assert.deepEqual(after.turn, { ...before.turn, phase: 'afterMove', moveMade: true });
    } else if (action.type === 'endTurn') {
      assert.equal(before.turn.moveMade, true);
      assert.ok(!before.pendingRescue);
      assert.deepEqual(after.pieces, before.pieces);
      assert.deepEqual(after.players, before.players);
      assert.equal(after.fen, before.fen);
      assert.deepEqual(after.enPassant, before.enPassant);
      assert.deepEqual(after.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
      assert.ok(!after.plotsAllowances?.length);
    } else if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(card => card.id === action.cardInstanceId) ? 'white' : 'black';
      const other = owner === 'white' ? 'black' : 'white';
      const player = before.players[owner];
      const card = player.hand.find(item => item.id === action.cardInstanceId)!;
      assert.ok(CARD_CATALOG[card.cardId]!.timing.includes(owner === before.turn.color ? before.turn.phase : 'afterOpponentMove'));
      assert.equal(before.turn.cardPlays[owner], 0);
      assert.deepEqual(after.players[owner].hand, [...player.hand.filter(item => item.id !== card.id), player.deck[0]!]);
      assert.deepEqual(after.players[owner].deck, player.deck.slice(1));
      assert.deepEqual(after.players[owner].discard, action.cardId === 'crab' ? player.discard : [...player.discard, card]);
      assert.deepEqual(after.players[other], before.players[other]);
      assert.equal(after.turn.cardPlays[owner], 1);
      assert.equal(after.turn.cardPlays[other], before.turn.cardPlays[other]);
      if ([7, 13, 84].includes(step)) {
        assert.deepEqual(after.pieces, before.pieces);
        assert.equal(after.fen, before.fen);
      }
      const swaps: Record<number, [string, string]> = { 26: ['a1', 'b1'], 33: ['b1', 'f1'], 79: ['d7', 'a1'] };
      const swap = swaps[step];
      if (swap) {
        assert.deepEqual(after.pieces, before.pieces.map(piece => ({ ...piece, square: piece.square === swap[0] ? swap[1] : piece.square === swap[1] ? swap[0] : piece.square })));
        assert.equal(after.turn.moveMade, true);
        assert.deepEqual(after.enPassant, step === 79 ? [] : before.enPassant);
      }
      if ([89, 91, 99].includes(step)) {
        const checkpoint = states[step === 99 ? 97 : 87]!;
        assert.deepEqual(after.pieces, checkpoint.pieces);
        assert.equal(after.fen, checkpoint.fen);
        assert.deepEqual(after.enPassant, checkpoint.enPassant);
        assert.equal(after.turn.moveMade, false);
        assert.equal(after.turn.phase, 'beforeMove');
        if (step !== 89) assert.equal(after.history.at(-1)?.reason, 'SELF_CHECK');
      }
    }
  }
  const final = states.at(-1)!;
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 9);
  assert.equal(final.pieces.filter(piece => piece.zone === 'captured').length, 6);
  assert.equal(final.fen, '6kr/1b1Nqrp1/p6n/1p1PBQ2/PpB1PP1b/3PR3/5P2/n3KRN1 w A - 3 25');
  assert.deepEqual(replayTrace(trace), final);
});
