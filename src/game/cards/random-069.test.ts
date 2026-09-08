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
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/069.json', import.meta.url), 'utf8')) as RandomTrace;
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

test('iteration 069 must reach 50 regular move commands; sampler currently omits pending Abduction rescue', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/069.json', import.meta.url), 'utf8')) as RandomTrace;
  replayTrace(trace);
});
