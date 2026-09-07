import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Manual sequential review against rules §§8–13, 14.3, 18.2–3, 20–21 and cards.md.
// Every quiet move preserves identities, resets no capture zone, and leaves its King safe.
// Pawn moves/captures reset the halfmove clock; other moves increment it. EndTurn
// changes the actor/allowances only, without a second clock increment or automatic draw.
const reasons = [
  '1. c2-c4 crosses empty c3 to empty c4; creates only the c3 en-passant opportunity.',
  '2. White ends its completed pawn turn; c3 opportunity remains for Black.',
  '3. e7-e6 advances Black one empty square; unused c3 en-passant expires.',
  '4. Black ends with both Kings sheltered and no card or draw.',
  '5. Nb1-c3 is a two-by-one jump to an empty square, leaving e1 protected.',
  '6. White ends after the knight move; Black receives its move.',
  '7. d7-d5 crosses empty d6; d6 becomes the sole en-passant target.',
  '8. Black ends; d6 remains available during the following turn.',
  '9. Ng1-h3 jumps to an empty square; the d6 opportunity expires.',
  '10. White ends after Nh3 without changing its hand.',
  '11. d5-d4 advances to empty d4 without capturing the neighboring c4 pawn.',
  '12. Black ends after d4; no check or forced action is pending.',
  '13. Qd1-c2 slides one diagonal step into the square vacated by the c-pawn.',
  '14. White ends with the queen at c2 and e1 safe.',
  '15. b7-b6 is one forward step to an empty square.',
  '16. Black ends after b6; clocks do not advance again.',
  '17. Nh3-g5 is a legal knight jump, with no capture or exposed e1 line.',
  '18. White ends after Ng5; neither player spends a card.',
  '19. c7-c6 is an empty forward step, keeping e8 sheltered.',
  '20. Black ends after c6 with no continuing effects.',
  '21. f2-f4 crosses empty f3 and creates its single en-passant opportunity.',
  '22. White ends; f3 remains the pending target for Black.',
  '23. Nb8-a6 jumps into empty a6; the f3 opportunity expires.',
  '24. Black ends after Na6 with the five-card hands unchanged.',
  '25. Qc2-b3 is one unobstructed diagonal step.',
  '26. White ends after Qb3; no capture or card replacement occurs.',
  '27. f7-f5 crosses empty f6 to empty f5 and creates the f6 opportunity.',
  '28. Black ends after f5, preserving that opportunity for White.',
  '29. Qb3-a4 slides one diagonal step; unused en-passant expires.',
  '30. White ends after Qa4 with no pending rescue.',
  '31. b6-b5 advances Black into empty b5 without capturing Qa4.',
  '32. AfterMove Forbidden City marks empty d3, remains active, draws Heresy (75 to 74), and changes no board or clocks.',
  '33. Black ends after its one card; the d3 marker persists and allowances reset.',
  '34. e2-e3 advances outside d3; the e1 King remains shielded.',
  '35. White ends after e3; Forbidden City remains at d3.',
  '36. Ng8-f6 jumps into empty f6, unaffected by d3.',
  '37. Black ends after Nf6 without another card play.',
  '38. Qa4-a5 moves one empty file step, avoiding the d3 obstruction.',
  '39. AfterMove Rebirth returns enemy Nf6 to vacant original knight square b8, preserving its g8 identity; discard once and draw Man of Straw (75 to 74). Neither King is checked.',
  '40. White ends after Rebirth; no extra Regular Move is granted.',
  '41. Qd8-f6 traverses empty e7 to f6, without approaching d3.',
  '42. Black ends after Qf6; the queen is blocked from e1 by other pieces.',
  '43. Nc3-a4 is an empty knight jump; White remains safe.',
  '44. White ends after Na4 with the d3 marker intact.',
  '45. g7-g6 advances one empty square and resets the pawn clock.',
  '46. AfterMove Heresy moves White bishops c1-d1 and f1-f2 first, then Black c8-c7 and f8-f7; all destinations are empty orthogonal neighbors of opposite color. No check results; discard and draw Passing in the Night (74 to 73).',
  '47. Black ends after Heresy; four bishops keep their identities and changed colors.',
  '48. h2-h3 advances into empty h3 without crossing d3.',
  '49. White ends after h3; no card is spent.',
  '50. Rh8-f8 crosses empty g8; the moved rook loses Black kingside castling rights.',
  '51. Black ends after Rf8; remaining castling rights are not newly granted.',
  '52. Na4-c5 jumps to empty c5; Black e8 is not attacked by this knight.',
  '53. AfterMove Anathema swaps enemy Bf7 and Ra8 without capture or move under §20; identities and non-move rights remain, with a8 right serialized as a while no rook is there. Neither King is attacked. Discard and draw Dubbing (74 to 73).',
  '54. White ends after the swap, retaining its completed Nc5 move.',
  '55. Ke8-e7 enters empty e7: Nc5 attacks e6/e4/d7/b7, Ng5 attacks e6/e4/f7/h7, and Qa5 is blocked by b5. Black loses all remaining castling rights.',
  '56. AfterMove Challenge selects White pawn g2, which can legally advance to g3; records its identity, discards once, and draws Tournament (73 to 72).',
  '57. Black ends; Challenge persists into White next turn.',
  '58. g2-g3 uses exactly the challenged pawn, reaches an empty square, and satisfies/removes Challenge.',
  '59. White ends after satisfying Challenge; only Forbidden City remains.',
  '60. Ba8-b7 moves one diagonal step into empty b7.',
  '61. Black ends after Bb7; neither King is checked.',
  '62. Nc5-a4 jumps back to an empty square without crossing the forbidden destination.',
  '63. White ends after Na4; no identities or hands change.',
  '64. Rf8-d8 crosses empty e8 to empty d8; Black already has no castling rights.',
  '65. Black ends after Rd8; White retains its original king and h1 rook rights.',
  '66. White castles e1-g1 with Rh1-f1: f1/g1 are empty and e1/f1/g1 are unattacked; the c7 bishop reaches only as far as the f4 pawn along d6/e5. Both White rights expire.',
  '67. White ends after castling; both relocated physical pieces persist.',
  '68. Qf6-g7 moves one empty diagonal step; no d3 crossing.',
  '69. Black ends after Qg7; neither King requires a rescue.',
  '70. Qa5xb5 captures exactly the black b7 pawn currently on b5, resetting the clock.',
  '71. White ends after the capture; the pawn stays captured, not dead.',
  '72. Qg7-f6 returns on a clear diagonal; Black King remains protected.',
  '73. Black ends after Qf6; captured-pawn identity is unchanged.',
  '74. Ng5-e4 jumps to empty e4, without entering forbidden d3.',
  '75. White ends after Ne4; no capture or replacement draw.',
  '76. Bb7-c8 moves one diagonal step into the empty old bishop square.',
  '77. Black ends after Bc8; its bishop retains the original f8 identity.',
  '78. Ne4-g5 jumps back to empty g5 with White King safe.',
  '79. White ends after Ng5; d3 remains forbidden.',
  '80. Rf7-f8 advances one file step into empty f8.',
  '81. Black ends after Rf8, without restoring any castling rights.',
  '82. e3xd4 captures the black d7 pawn diagonally forward; the move ends on d4, not forbidden d3.',
  '83. White ends after the capture; both removed black pawns are captured and recoverable.',
  '84. Na6-c5 jumps into empty c5 and leaves Black King safe.',
  '85. AfterMove Dungeon relocates enemy b2 pawn to empty corner a8, preserving its pawn identity without promotion (§18.3); bans its next turn movement, discards, draws Masquerade (72 to 71), and preserves clocks.',
  '86. Black ends; the a8 pawn remains restricted during White turn.',
  '87. BeforeMove Dubbing gives Kg1 the noncapturing knight jump to empty f3; f5 blocks Black queen/rook file attacks, Nc5 does not attack f3, and d3 is not its destination. Spends White move/card and draws Annexation (73 to 72).',
  '88. White ends its replacement move; Dungeon expires after that full turn while its pawn stays unpromoted on a8.',
  '89. Rf8-f7 moves to empty f7; f5 still blocks attacks toward White f3.',
  '90. Black ends after Rf7 without any pending choice.',
  '91. Bf2-g1 moves one diagonal step into the square vacated by White King.',
  '92. White ends after Bg1; the King remains safe on f3.',
  '93. Ke7-e8 returns one rank to empty e8; White queen/knights do not attack it, and rights stay absent.',
  '94. Black ends after Ke8; no castling restoration occurs.',
  '95. Qb5-b4 moves one file step to empty b4, preserving King safety.',
  '96. White ends after Qb4 with no change to hands or continuing effects.',
  '97. Qf6-h8 crosses empty g7 to empty h8; no capture or forbidden square.',
  '98. Black ends after Qh8; g7/f6 are empty but e5 remains empty and d4 blocks its diagonal beyond.',
  '99. Qb4-b1 traverses b3 and b2, now empty because Dungeon relocated the b-pawn.',
  '100. White ends after Qb1; d3 remains untouched.',
  '101. e6-e5 advances to an empty square and resets the clock without attacking Kf3.',
  '102. Black ends after e5; its pawn now also blocks the h8 queen diagonal.',
  '103. Qb1-c2 slides one diagonal step into empty c2.',
  '104. White ends after Qc2; no extra draw or move occurs.',
  '105. Rd8-d6 traverses empty d7; d4 pawn blocks the rook further down the file.',
  '106. Black ends after Rd6; White receives its normal move.',
  '107. Kf3-e3 steps into empty e3: Nc5 attacks d3/e4/e6/d7/b7/a6/a4/b3, neither pawn e5/f5 attacks e3, and bishop c7 is blocked by Rd6. The King is safe.',
  '108. White ends the fiftieth Regular Move; Black beforeMove has no unresolved rescue or pending card, with only d3 Forbidden City active.',
];

test('random iteration 008 replays its independently reviewed trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/008.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(reasons.length, 108);
  assert.equal(trace.steps.length, reasons.length);
  reasons.forEach((reason, index) => assert.ok(reason.startsWith(`${index + 1}. `)));
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 7);
  const state = replayTrace(trace);
  assert.equal(state.fen, 'Pnb1k2q/p1b2r1p/2pr2p1/2n1ppN1/N1PP1P2/4K1PP/P1QP4/R2B1RB1 b - - 3 26');
  assert.deepEqual(state.pieces.filter(piece => piece.zone === 'captured').map(piece => piece.id).sort(), ['black-pawn-b7', 'black-pawn-d7']);
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-b2')?.square, 'a8');
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-b2')?.promoted, false);
  assert.deepEqual(state.effects, [{ type: 'forbidden-city', owner: 'black',
    card: { id: 'black-hand-1-forbidden-city', cardId: 'forbidden-city' }, square: 'd3' }]);
  assert.equal(state.turn.color, 'black');
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.turn.moveMade, false);
  assert.ok(!state.pendingRescue && !state.pendingAbduction && !state.pendingDoomsayer);
  assert.deepEqual([state.players.white.deck.length, state.players.black.deck.length], [72, 71]);
  assert.deepEqual([state.players.white.hand.length, state.players.black.hand.length], [5, 5]);
});
