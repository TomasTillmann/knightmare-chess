import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Rules §§8-11: every endTurn below preserves the displayed board/clocks/cards,
// opens the other player's beforeMove phase, and resets both card allowances.
// Every regular move retains physical identity, clears old en-passant, increments
// the quiet clock or resets it on Pawn movement/capture, and increments the
// fullmove number only for Black. All destinations and King safety were reviewed.
const rationale = [
  '1. e2-e4 crosses empty e3; double Pawn push creates e3 opportunity, King remains screened.',
  '2. White ends after e4; Black receives e3 opportunity and both hands remain five.',
  '3. d7-d6 is one forward empty square; e3 opportunity expires and fullmove becomes 2.',
  '4. Black ends after d6; White starts with unchanged board and empty en-passant.',
  '5. b2-b3 is an empty forward Pawn step; neither King line opens.',
  '6. White ends after b3; Black starts, cards unchanged.',
  '7. e7-e6 is an empty forward Pawn step; e8 remains safe.',
  '8. Black ends after e6; White starts at fullmove 3.',
  '9. Qd1-f3 crosses vacated e2; f3 empty, e1 still screened by f2.',
  '10. Challenge after White move chooses movable enemy a7 Pawn; binds its ID, discards Challenge, draws Knightmare, white deck 74.',
  '11. White ends; Challenge survives to compel Black next move, allowances reset.',
  '12. a7-a6 is legal and satisfies Challenge with the selected physical Pawn; obligation clears.',
  '13. Black ends after a6; White starts with no effects.',
  '14. Qf3-h3 crosses empty g3 and arrives empty h3; no King exposure.',
  '15. White ends after Qh3; Black starts, no card expenditure.',
  '16. Nb8-c6 is an unoccupied Knight jump; e8 remains safe.',
  '17. Black ends after Nc6; White starts at quiet clock 2.',
  '18. Bc1-a3 crosses b2 vacated on step 5; a3 empty, no King exposure.',
  '19. White ends after Ba3; Black starts without further effect.',
  '20. Qd8-f6 crosses empty e7; f6 empty, White bishop ray blocked by d6.',
  '21. Black ends after Qf6; White starts, quiet clock 4.',
  '22. Qh3-g4 is one empty diagonal; f2 still shields e1 from Black queen.',
  '23. White ends after Qg4; Black starts.',
  '24. e6-e5 advances one empty square; e4 Pawn blocks further advance, no capture.',
  '25. Black ends after e5; White starts fullmove 7.',
  '26. Nb1-c3 is an empty Knight jump; e1 remains safe.',
  '27. White ends after Nc3; Black starts.',
  '28. Nc6-a7 is an empty Knight jump, a7 vacated by Challenge move.',
  '29. White reacts with Knightmare to that completed move; returns Knight to c6, restores clocks 1/7 and Black move, draws Chaos, deck 73.',
  '30. Bc8-f5 crosses vacated d7 and e6; different piece/movement satisfies cancellation prohibition, no check exposure.',
  '31. Black ends replacement Bf5; White reaction allowance resets for own turn.',
  '32. Qg4-d1 crosses empty f3/e2; d1 empty, safe return.',
  '33. White ends after Qd1; Black starts.',
  '34. b7-b6 is an empty forward Pawn step; no capture or promotion.',
  '35. Black ends after b6; White starts fullmove 9.',
  '36. Ng1-h3 is an empty Knight jump; f2 shields White King.',
  '37. White ends after Nh3; Black starts.',
  '38. Qf6-h4 crosses empty g5; White f2 blocks h4-g3-f2-e1 diagonal.',
  '39. Black ends after Qh4; White starts without check.',
  '40. Qd1-g4 crosses empty e2/f3; empty g4 does not expose e1.',
  '41. White ends after Qg4; Black starts.',
  '42. Ke8-e7 is adjacent empty and unattacked: Ba3 blocked by d6, Qg4 ray reaches d7 rather than e7; Black castling rights vanish.',
  '43. Black ends after Ke7; only White castling rights remain.',
  '44. Qg4-e2 crosses empty f3; e2 empty, King safe.',
  '45. White ends after Qe2; Black starts.',
  '46. Qh4-h5 is one empty file step; no opened attack against e7.',
  '47. Black ends after Qh5; White starts with queenside castling available.',
  '48. e1-a1 is public castling alias: clear b1/c1/d1, safe e1/d1/c1, King c1 and original a1 Rook d1; all rights now gone.',
  '49. White ends castled turn; Black starts, quiet clock 7.',
  '50. f7-f6 is an empty forward Pawn step; no line exposes e7.',
  '51. Black ends after f6; White starts fullmove 13.',
  '52. Ba3xd6 crosses empty b4/c5 and captures original black d7 Pawn; bishop checks e7, White c1 safe.',
  '53. White ends checking Bxd6; Black receives its escape turn.',
  '54. Ke7-f7 escapes Bd6 diagonal to unattacked f7; Qe2 ray blocked by e4, fullmove 14.',
  '55. Black ends after Kf7; both Kings safe.',
  '56. f2-f4 crosses empty f3 and lands empty f4; creates f3 opportunity, c1 unaffected.',
  '57. White ends after f4; Black receives f3 opportunity.',
  '58. Bf5-e6 is empty adjacent diagonal; Black King f7 not exposed.',
  '59. White Chaos immediately cancels Be6: bishop f5, f3 opportunity and clocks 0/14 restored; draw Cowardice, deck 72, Black chooses again.',
  '60. Nc6-b8 is an empty Knight jump distinct from canceled bishop move; clears restored f3 opportunity.',
  '61. Black ends replacement Nb8; White starts with reaction allowance reset.',
  '62. e4xf5 captures original black c8 Bishop diagonally forward; Pawn stays unpromoted and Black King f7 remains shielded by f6.',
  '63. White ends after exf5; Black starts; no Legacy selection was made.',
  '64. c7xd6 captures White original c1 Bishop diagonally forward; black d7 Pawn remains captured separately.',
  '65. Black ends after cxd6; White starts fullmove 16.',
  '66. Kc1-b1 is adjacent empty and unattacked; Black queen h5 is blocked by f5 Pawn on rank.',
  '67. White ends after Kb1; Black starts.',
  '68. b6-b5 is one empty forward Pawn step before transformation.',
  '69. Black Crab after its move binds original b7 Pawn at b5; physical card stays in effect, draw Ghostwalk, deck 74, no discard.',
  '70. Black ends; Crab persists, White starts, card allowances reset.',
  '71. Nh3-g1 is an empty Knight jump; Crab b5 attacks a4/c4 only, White b1 safe.',
  '72. White Dungeon relocates enemy h8 Rook to empty a1 after move; immobilization suppresses its b1 check, discards/draws Truce, deck 71.',
  '73. White ends; Dungeon remains for Black following turn and Crab remains on b5.',
  '74. Qh5-f3 crosses empty g4; Dungeon rook stays a1 and cannot move; Black f7 safe.',
  '75. Black ends; Dungeon expires and a1 Rook now checks White b1; White receives legal escape turn.',
  '76. Kb1xa1 removes original h8 Rook; a1 safe since black a8 Rook blocked by a6 Pawn and Qf3 ray not a1.',
  '77. White ends safe on a1; only Crab remains, no reaction card used.',
  '78. Qf3xe2 captures original White queen one diagonal away; Black f7 safe, White a1 not checked.',
  '79. Black ends after Qxe2; White starts fullmove 19.',
  '80. a2-a3 advances into empty a3; a6 still blocks enemy Rook a8 from a1.',
  '81. White ends after a3; Black starts.',
  '82. e5xf4 captures original White f2 Pawn forward diagonally; black e7 Pawn is distinct from b5 Crab.',
  '83. Black ends after exf4; White starts fullmove 20.',
  '84. g2-g4 crosses empty g3; en-passant g3 is genuinely available to black f4 Pawn, no self-check.',
  '85. White ends; g3 opportunity survives into Black turn.',
  '86. d6-d5 moves original black c7 Pawn forward; declining en-passant expires g3.',
  '87. Black ends after d5; White starts, no en-passant.',
  '88. d2-d4 crosses empty d3; d4 empty below blocked d5 Pawn, records d3 opportunity without legal adjacent captor.',
  '89. White ends; Black receives d3 opportunity, board unchanged.',
  '90. Nb8-c6 is empty Knight jump; opportunity d3 expires and King f7 stays safe.',
  '91. Black ends after Nc6; White starts.',
  '92. h2-h4 crosses empty h3; destination empty, records h3 opportunity without adjacent black captor.',
  '93. White ends; Black receives h3 opportunity.',
  '94. Qe2-f2 is one empty rank step; clears h3 opportunity, no Black King exposure.',
  '95. Black ends after Qf2; White starts fullmove 23.',
  '96. Rh1-h2 moves onto newly vacated h2; no capture, King a1 unaffected.',
  '97. White ends after Rh2; Black starts.',
  '98. Qf2xd4 crosses empty e3 and captures original White d2 Pawn; White Nc3 blocks diagonal toward b2/a1.',
  '99. Black ends after Qxd4; White starts safe behind Nc3.',
  '100. Ka1-a2 is empty adjacent and unattacked: a8 Rook blocked by a6/a3, Qd4 diagonal to a1 blocked at c3.',
  '101. White ends after Ka2; Black starts.',
  '102. Nc6-d8 is empty Knight jump; f7 safe, Crab never moved and remains b5.',
  '103. Final Black endTurn opens White beforeMove with no pending obligation, clocks 2/25, five cards each and only Crab active.',
];

test('iteration 012 independently reviewed random campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/012.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860012);
  assert.equal(trace.failure, undefined);
  assert.equal(rationale.length, 103);
  assert.equal(rationale.length, trace.steps.length);
  rationale.forEach((reason, index) => assert.ok(reason.startsWith(`${index + 1}. `)));
  assert.equal(trace.moves, 50);
  assert.deepEqual(trace.steps.flatMap(step => step.action.type === 'playCard' ? [step.action.cardId] : []),
    ['challenge', 'knightmare', 'chaos', 'crab', 'dungeon']);
  const state = replayTrace(trace);
  assert.equal(state.fen, 'r2n1bn1/5kpp/p4p2/1p1p1P2/3q1pPP/PPN5/K1P4R/3R1BN1 w - - 2 25');
  assert.deepEqual(state.turn, { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
  assert.equal(state.orientation, 0);
  assert.equal(state.outcome, null);
  assert.deepEqual(state.enPassant, []);
  assert.ok(!state.pendingRescue && !state.pendingAbduction && !state.pendingDoomsayer);
  assert.deepEqual(state.effects, [{ type: 'crab', owner: 'black', card: { id: 'black-hand-2-crab', cardId: 'crab' }, pieceId: 'black-pawn-b7' }]);
  assert.deepEqual(state.pieces.filter(piece => piece.zone !== 'board').map(piece => [piece.id, piece.zone, piece.square]), [
    ['white-bishop-c1', 'captured', null], ['white-queen-d1', 'captured', null],
    ['white-pawn-d2', 'captured', null], ['white-pawn-f2', 'captured', null],
    ['black-pawn-d7', 'captured', null], ['black-bishop-c8', 'captured', null], ['black-rook-h8', 'captured', null],
  ]);
  assert.ok(state.pieces.every(piece => !piece.promoted && !piece.neutral && piece.role === piece.originalRole));
  assert.deepEqual(state.pieces.filter(piece => piece.royal).map(piece => [piece.id, piece.square]),
    [['white-king-e1', 'a2'], ['black-king-e8', 'f7']]);
  assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-b7')?.square, 'b5');
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), ['hidden-passage', 'revenge', 'dark-mirror', 'cowardice', 'truce']);
  assert.deepEqual(state.players.black.hand.map(card => card.cardId), ['vendetta', 'evil-eye', 'truce', 'legacy', 'ghostwalk']);
  assert.deepEqual(state.players.white.discard.map(card => card.cardId), ['challenge', 'knightmare', 'chaos', 'dungeon']);
  assert.deepEqual(state.players.black.discard, []);
  assert.equal(state.players.white.deck.length, 71);
  assert.equal(state.players.black.deck.length, 74);
});
