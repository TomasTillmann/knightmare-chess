import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { checkState, digest, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

// Independently reviewed against rules §§8–14, 15.3, 16.2, 18–21 and card metadata.
// Every regular move below preserves royal safety unless explicitly marked pending rescue.
// Quiet moves retain captures/identity; endTurn retains board/clocks/cards and resets allowances.
// Finding43: preserve the archive, but its branch after the forbidden action 52 is unreachable.
const reasons = [
  '1. b2-b3: White pawn advances one onto empty b3; pawn clock resets.',
  '2. White ends; Black receives its first move and no draw occurs.',
  '3. Ng8-h6: unobstructed knight jump; Black fullmove advances to 2.',
  '4. Black ends with both Kings shielded by their initial pawns.',
  '5. f2-f4: f3/f4 empty; double pawn step establishes f3 en passant.',
  '6. White ends; f3 opportunity remains for Black.',
  '7. f7-f5: f6/f5 empty; replace old en passant with f6.',
  '8. After-move Earthquake rotates forward east/west; h2 White promotes Queen first, a7 Black Knight; retain card, draw Breakthrough, clear en passant.',
  '9. End Black; rotated geometry persists without further promotion.',
  '10. b3-d3: pawn now on owner-relative second rank; c3/d3 empty permits double step despite earlier move (§13.1); en passant c3.',
  '11. End White; retain rotated c3 opportunity.',
  '12. Rh8-g8: adjacent empty file square; revoke Black kingside castling and clear en passant.',
  '13. End Black; only its queenside right remains.',
  '14. Nb1-c3: ordinary knight jump remains unchanged by rotation.',
  '15. End White; pieces and promoted identities unchanged.',
  '16. Na7-b5: Earthquake-promoted pawn uses Knight geometry permanently.',
  '17. End Black; White royal e1 remains screened.',
  '18. f4-g4: rotated White forward is east; empty destination, no capture.',
  '19. Peace Talks after move cancels retained Earthquake to Black discard; orientation resets, existing promotions persist; White draws Crab.',
  '20. End White; ordinary north/south Pawn direction restored.',
  '21. g7-g5: clear double step in restored direction, en passant g6.',
  '22. End Black; preserve g6 opportunity.',
  '23. a2-a4: empty a3/a4; replace en passant with a3.',
  '24. End White; no automatic draw without discard.',
  '25. d7-d6: ordinary one-step pawn advance; expire en passant.',
  '26. Coup after move selects own Pawn b7 (neither Rook nor Queen); b7 becomes royal, e8 becomes capturable Prince; retain card/draw Siege, no relocation.',
  '27. End Black; royal safety now concerns b7, not the e8 Prince.',
  '28. Ra1-b1: b1 vacated by Knight; revoke White queenside castling.',
  '29. End White; Black royal b7 remains protected.',
  '30. Nb8-a6: clear knight jump; no capture or royal exposure.',
  '31. End Black; Coup marker remains on b7.',
  '32. Qh2-h4: promoted Queen slides through empty h3.',
  '33. End White; Queen h4 does not attack royal b7.',
  '34. Bf8-g7: single diagonal onto square vacated by pawn.',
  '35. End Black; e1 remains shielded.',
  '36. Nc3-e4: knight jump onto empty e4.',
  '37. End White; e4 Knight does not threaten b7.',
  '38. e7-e5: e6/e5 empty; double-step en passant e6.',
  '39. Fatal Attraction marks controlled Prince e8 after move; adjacent nonroyals freeze, royal b7 exempt by distance; retain card/draw Dungeon.',
  '40. End Black; magnet and e6 en passant persist.',
  '41. c2-c4: c3/c4 clear; pawn far from e8 magnet; en passant c3.',
  '42. Panic after move spends White card/draws Treason and gives Black 15000ms obligation; board unchanged.',
  '43. End White; Black may satisfy Panic with legal next move.',
  '44. Nh6xg4: Knight captures physical White f-pawn; timely move removes Panic; magnet does not cover h6.',
  '45. Figure Dance simultaneously moves only occupied corners h1-h8 and a8-a1; no capture; revoke remaining moved-rook rights; discard/draw Truce.',
  '46. End Black; rook a1 line to e1 blocked by White b1/c1/d1.',
  '47. Tournament replaces White move: swap own Ne4 with enemy Ng4; no captures; clock +1, spend/draw Bog.',
  '48. End White; Knight e4 does not attack royal e1.',
  '49. Bg7-f8: enter magnet-adjacent f8 legally, then become immobilized.',
  '50. End Black; magnet still at e8.',
  '51. Qh4-h3: one empty rank step; no capture.',
  '52. FAQ40 and Fatal Attraction forbid Holy Quest: Bf8 is frozen by magnet e8; reject without spending or drawing. Later rows describe the obsolete archived branch.',
  '53. End White; swap does not move magnet or release it.',
  '54. c7-c6: source c7 outside e8 adjacency, destination empty.',
  '55. Siege swaps controlled Ne4/Ra1 after move; no capture, no clock advance; draw Bombard.',
  '56. End Black; rook e4 blocked from e1 by White e2 Pawn.',
  '57. c4xb5: White pawn diagonally captures the promoted Black a-pawn Knight; it remains captured with promoted identity.',
  '58. End White; royal b7 is not attacked by White pawn b5.',
  '59. Bc8-d7: source outside magnet; arrival adjacent e8 is legal then frozen.',
  '60. End Black; frozen d7 Bishop cannot attack.',
  '61. Qh3xh7: h4/h5/h6 clear; capture Black h-pawn, reset clock.',
  '62. End White; rank attack from h7 stops at frozen Black Bishop d7 before b7 royal.',
  '63. Prince e8-e7: one-step move allowed even into Queen h7 line because Prince is nonroyal; actual movement ends Fatal Attraction and releases neighbors.',
  '64. End Black; b7 royal still screened by Bishop d7.',
  '65. Qh7-g6: one diagonal quiet move; Prince e7 is capturable, not a royal check constraint.',
  '66. Crab after move marks own original Pawn d2; it stays d2 and gains one-step forward diagonals; retain/draw Masquerade.',
  '67. End White; Crab not moved or promoted.',
  '68. Re4-e3: one empty square; White e2 still blocks rook attack on e1.',
  '69. Truce after move retains card/draws Evangelists; no existing royal check, so capture prohibition persists.',
  '70. End Black; Truce permits quiet moves and suppresses captures.',
  '71. Rh8-h5: h7/h6/h5 empty; quiet rook move allowed during Truce.',
  '72. End White; no ordinary attack reaches either royal, Truce remains.',
  '73. Qd8-e8: adjacent empty square; quiet move leaves Truce active.',
  '74. Dungeon moves enemy nonroyal e2 Pawn to empty h8 without promotion/capture; vacating e2 exposes Re3-e1 check, ending Truce; Pawn frozen for next White turn; draw Panic.',
  '75. End Black; checked White receives its escape move.',
  '76. Ke1-f2: adjacent f2 is outside rook e3 rank/file, Bishop a6 diagonal stops at White d3; escapes check, leaves trapped h8 Pawn untouched.',
  '77. Man-Trap after move selects occupied friendly g6 Queen square; retains card/draws Sanctuary; no movement.',
  '78. End White expires Dungeon following-turn prohibition; trap remains fixed g6.',
  '79. Bombard replaces Black move with Rg8xh8; optional zero jumps legal; capture unpromoted displaced Pawn, reset clock/draw Squaring the Circle.',
  '80. End Black; rook h8 blocked from White King f2 by geometry.',
  '81. Kf2-e2 is provisional self-check by Re3; pending rescue is valid because Treason could swap e3 Rook with a1 or f8 Knight and remove that line.',
  '82. Chosen Treason h8/f8 fails to remove Re3 check: spend/draw Blessing, undo failed rescue and provisional King move to f2, restore pre-move clock and White move availability.',
  '83. Rh5-h6 replaces the rolled-back move; no capture; White card allowance stays spent.',
  '84. End White with King f2 safe; failed Treason cannot be replayed.',
  '85. Breakthrough replaces move g5xg4 forward, capturing White Knight; ordinary pawn could not capture forward without card; draw Charge, reset clock.',
  '86. End Black; Black g4 Pawn threatens f3/h3, not f2.',
  '87. Qg6-e6 through empty f6; leaves fixed g6 trap behind.',
  '88. End White; e6 Queen attacks only nonroyal e7 Prince, royal b7 remains safe.',
  '89. Re3-e4: clear adjacent square; no longer on third rank.',
  '90. End Black; no movement onto trap g6.',
  '91. Rh6-h3: h5/h4/h3 empty; enters Black pawn g4 capture diagonal legally as nonroyal.',
  '92. End White; rook may be threatened without invalidating King f2.',
  '93. Nf8xe6: knight jump captures promoted White h-pawn Queen; trap g6 persists because square-bound.',
  '94. End Black; captured promoted Queen stays off-board.',
  '95. Rb1-b3: b2 clear, empty b3; no capture.',
  '96. End White; White pawn b5 blocks rook b3 toward royal b7.',
  '97. Qe8-h5: f7/g6 clear; passing through g6 does not spring trap, which requires ending there.',
  '98. End Black; Queen h5-f3 diagonal ends beyond royal f2, no check.',
  '99. Rh3-e3: g3/f3 clear; rook safely enters empty e3.',
  '100. End White; e3 rook blocks e4 rook further south.',
  '101. Bd7-c8: ordinary single diagonal, magnet already expired.',
  '102. End Black; royal b7 still not attacked.',
  '103. g2-g3: one forward empty square, pawn clock resets.',
  '104. End White; pawn g3 blocks Queen h5 diagonal beyond g4 already occupied by Black pawn.',
  '105. Rh8-e8: g8/f8 empty; rook slide, no castling rights restored.',
  '106. End Black; Prince e7 blocks own rook e8 southward.',
  '107. b5-b6: one forward square; b7 royal occupancy blocks further advance but is not attacked straight ahead.',
  '108. End White; royal pawn b7 remains safe from b6 Pawn.',
  '109. d6-d5: one forward empty square; no promotion or en passant.',
  '110. End Black; Black d5 Pawn threatens c4/e4, not White King.',
  '111. Ng1-h3: knight jump onto vacated h3, no capture.',
  '112. End White; latest opponent mover is a Knight for Doppelganger.',
  '113. Doppelganger replaces Black move: non-Pawn Ne6-c5 copies preceding White Knight geometry, quiet destination; spend/draw Hostage.',
  '114. End Black; no permanent transformation from copied movement.',
  '115. Nh3-g5: legal knight jump; no card-specific movement persists.',
  '116. End White; Knight g5 attacks e6/e4/f7/h7/f3/h3, not royal b7.',
  '117. Nc5-d7: empty legal knight destination; Black fullmove becomes 27.',
  '118. End Black; White King f2 safe from d7 Knight.',
  '119. Qd1-e2: adjacent diagonal empty square; ends with King f2 safe and royal Black b7 safe; no trap arrival or card expiry.',
  '120. End White: Qe2 leaves both royals safe; pass to Black beforeMove, reset move allowance, retain permanent Coup/Crab/Man-Trap and all pieces/cards.',
];

test('random campaign iteration 003: unchanged prefix and forbidden Fatal Attraction swap', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/003.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(reasons.length, trace.steps.length, 'every action has an independent sequential rule review');
  assert.equal(trace.seed, 860003);
  let state = createGameState(trace.initial);
  for (const [index, step] of trace.steps.slice(0, 51).entries()) {
    const before = structuredClone(state);
    const result = applyAction(state, step.action);
    assert.deepEqual(state, before);
    assert.equal(result.ok, true, reasons[index]);
    checkState(result.state);
    assert.equal(digest(result.state, trace.digestVersion ?? 1), step.expected, `unchanged action ${index + 1}`);
    state = result.state;
  }
  const before = structuredClone(state);
  assert.equal(state.pieces.find(piece => piece.id === 'black-bishop-f8')?.square, 'f8');
  assert.ok(state.effects.some(effect => (effect as { pieceId?: string }).pieceId === 'black-king-e8'));
  assert.deepEqual(trace.steps[51].action, { type: 'playCard', cardId: 'holy-quest',
    cardInstanceId: 'white-hand-0-holy-quest', target: { bishop: 'f8', knight: 'a6' } });
  const rejected = applyAction(state, trace.steps[51].action);
  assert.equal(rejected.ok, false, reasons[51]);
  assert.deepEqual(rejected.state, before);
  assert.deepEqual(state, before);
  assert.equal(applyAction(state, { type: 'endTurn' }).ok, true);
});
