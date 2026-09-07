import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Reviewed in order against rules §§8–13, 15.2–3, 18.1, 20 and all nine played
// cards' catalog metadata/artwork. Each entry covers its row's complete delta;
// ordinary moves spend no cards, preserve identities/effects, reset the clock
// on pawn moves/captures, advance the fullmove after Black, and expire old EP.
// End-turn rows only hand over the safe completed position and reset allowances.
const rationales = [
  '1. d2-d4 crosses empty d3 to empty d4; initial double step records d3 EP and leaves e1 safe.',
  '2. White ends after d4; Black receives the unchanged board and d3 opportunity.',
  '3. c7-c6 is one forward to empty c6; d3 EP expires and e8 remains shielded.',
  '4. Black ends after c6; White begins without an outstanding response.',
  '5. g2-g3 advances to empty g3; no enemy line opens onto e1.',
  '6. White ends after g3; Black begins with both card allowances reset.',
  '7. Ng8-h6 is a two-by-one jump to empty h6; e8 remains safe.',
  '8. Black ends after Nh6; neither player draws without a card play.',
  '9. h2-h3 advances to empty h3 without exposing e1.',
  '10. White ends after h3; unchanged hands and board pass to Black.',
  '11. d7-d5 crosses empty d6; records d6 EP and leaves e8 protected.',
  '12. Black ends after d5; d6 EP survives into the response turn.',
  '13. b2-b4 crosses empty b3; replaces the old EP opportunity with b3.',
  '14. White ends after b4; Black receives the b3 opportunity.',
  '15. Bc8-g4 crosses vacant d7/e6/f5; e7 still blocks the White bishop line to e8.',
  '16. After-move Crab marks owned h7 pawn; retained effect and one Under Elf Hill draw, no board displacement.',
  '17. Black ends after Crab; h7 marker persists and no second refill occurs.',
  '18. Qd1-d2 enters the square vacated at action 1; e1 remains safe.',
  '19. White ends after Qd2; Crab remains attached to Black h7.',
  '20. b7-b6 advances one into empty b6 and leaves e8 safe.',
  '21. Black ends after b6; White has its regular move and card allowance.',
  '22. f2-f4 crosses empty f3 and records f3 EP; bishop g4 does not attack e1.',
  '23. White ends after f4; f3 opportunity persists until Black acts.',
  '24. Nh6-g8 returns by a knight jump to its empty origin; f3 EP expires.',
  '25. Black ends after Ng8; board and Crab are unchanged.',
  '26. Nb1-c3 jumps to empty c3 without uncovering a line onto e1.',
  '27. White ends after Nc3 with unchanged hands.',
  '28. Nb8-d7 jumps into the square vacated by the d-pawn; e8 remains safe.',
  '29. Black ends after Nd7; no promotion, capture, or pending obligation exists.',
  '30. Nc3xd5 captures the original Black d7 pawn by a knight jump; victim enters captured zone.',
  '31. White ends after Nxd5; captured d7 pawn stays available for future returns.',
  '32. Ra8-c8 traverses empty b8 and ends on vacated c8; Black queenside castling right is lost.',
  '33. Black ends after Rc8; only its kingside castling right remains.',
  '34. a2-a3 advances to empty a3 without disturbing King safety.',
  '35. White ends after a3; no card is played or replaced.',
  '36. Nd7-e5 is a knight jump to empty e5; Black King remains safe.',
  '37. Black ends after Ne5; White receives the unchanged position.',
  '38. Bf1-g2 enters the square vacated by the g-pawn; the diagonal move is clear.',
  '39. White ends after Bg2; no extra bishop move was granted.',
  '40. Bg4-h5 moves diagonally one to empty h5; e8 remains safe.',
  '41. Black ends after Bh5; White starts with a replacement move available.',
  '42. Guardian moves f4-f5 to empty f5 with no follower; consumes the move, resets pawn clock, discards Guardian and draws Sanctuary.',
  '43. White ends after the Guardian replacement; no additional regular move or draw occurs.',
  '44. g7-g5 crosses empty g6; White f5 pawn can capture EP on g6, reflected in FEN and EP records.',
  '45. Black ends after g5, preserving the valid g6 EP opportunity.',
  '46. Qd2-d3 moves one along the clear file; declining EP expires g6.',
  '47. White ends after Qd3 with its King still safe at e1.',
  '48. Ne5-g4 jumps to empty g4; Black remains safe.',
  '49. Black ends after Ng4; no capture obligation yet exists.',
  '50. Nd5xe7 captures the original Black e7 pawn; the Knight on e7 does not attack e8.',
  '51. After-move Holy War simultaneously swaps owned Ng1/Bc1; no capture or extra move, discard and draw Riposte.',
  '52. White ends after Holy War; both swapped physical identities retain their roles.',
  '53. Ng4-h2 jumps to empty h2, threatening f1 but not White King e1.',
  '54. Black ends after Nh2; White begins safe at e1.',
  '55. Ke1-f1 enters Nh2 attack; this is only a staged move under §11.6, pending Coup rescue, and loses White castling rights.',
  '56. After-move Coup makes f1 King a capturable Prince and safe g3 pawn royal; resolves rescue, retains Coup and draws Toll.',
  '57. White ends only after the royal g3 pawn is safe; the threatened Prince may remain on f1.',
  '58. b6-b5 advances into empty b5; attacks a4/c4, not royal g3.',
  '59. Black ends after b5; White royal identity stays on g3.',
  '60. Ne7-d5 is a knight jump to vacated d5; g3 remains safe.',
  '61. White ends after Nd5; Coup and Crab remain active.',
  '62. c6-c5 advances into empty c5; it threatens b4/d4 without attacking g3.',
  '63. Black ends after c5; no capture or marker changes.',
  '64. Prince f1-e1 moves one like a King while remaining nonroyal; g3 remains the protected identity.',
  '65. White ends after Prince e1; castling rights are not restored.',
  '66. a7-a5 crosses empty a6 and records a6 EP; no White pawn on b5 can use it.',
  '67. After-move Treason swaps opposing Ra1/Nc1 atomically; preserves a6 EP and clocks, spends Treason and draws Knightmare.',
  '68. Black ends after Treason; the a6 EP record remains available for the immediate turn only.',
  '69. Qd3-d2 returns down one empty square and expires a6 EP; royal g3 remains safe.',
  '70. White ends after Qd2; no further card effect occurs.',
  '71. Qd8-d7 enters empty d7; the Black King remains safe on e8.',
  '72. Black ends after Qd7; the active royal g3 pawn is not checked.',
  '73. f5-f6 advances one onto empty f6 without promotion.',
  '74. White ends after f6; the pawn retains original f2 identity.',
  '75. Qd7-f5 crosses empty e6 to the square vacated by f-pawn; its diagonal ends at h3, not royal g3.',
  '76. Black ends after Qf5; White has no pending rescue.',
  '77. e2-e4 crosses empty e3; creates e3 EP and does not expose royal g3.',
  '78. White ends after e4, preserving e3 EP for Black.',
  '79. Qf5-e6 moves diagonally one to empty e6; expires e3 EP.',
  '80. Black ends after Qe6; no direct attack reaches royal g3.',
  '81. c2-c4 crosses empty c3; creates c3 EP, which no adjacent Black pawn can use.',
  '82. White ends after c4; Black starts with c3 EP recorded.',
  '83. Before-move Betrayal kills enemy f6 pawn on Black half and returns captured original e7 pawn there; preserves move/EP, discards and draws Vendetta.',
  '84. Bh5-f3 crosses empty g4; e8 stays safe and old c3 EP expires after this regular move.',
  '85. Black ends after Bf3; g3 royal is not on that bishop diagonal.',
  '86. Rc1-b1 moves horizontally to empty b1; g3 royal remains safe.',
  '87. White ends after Rb1; no castling right is regained.',
  '88. Qe6-e5 moves one to empty e5, checking royal g3 along empty f4; Black King is safe.',
  '89. Black ends after Qe5 check; White receives its escape turn rather than an immediate loss.',
  '90. Qd2-f4 crosses empty e3 and blocks e5-f4-g3, curing the check on the royal pawn.',
  '91. White ends only after Qf4 has blocked the royal check.',
  '92. Bf3-e2 enters empty e2; no new attack reaches g3.',
  '93. Black ends after Be2; White remains protected by Qf4.',
  '94. Na1-b3 is a knight jump to empty b3; royal protection is unchanged.',
  '95. White ends after Nb3; both active transformations persist.',
  '96. Be2-f1 enters empty f1; White Prince on e1 is not the royal identity.',
  '97. After-move Vendetta is retained and draws Disintegration; White has legal captures such as Nb3xa5 and Qf4xe5.',
  '98. Black ends after Vendetta; the legal-capture obligation is active for White.',
  '99. Nb3xa5 captures original a7 pawn, satisfying Vendetta while Qf4 still shields royal g3.',
  '100. White ends after Nxa5; Black has captures, including Bf1xc4, so Vendetta persists.',
  '101. Bf1xc4 crosses empty e2/d3 and captures original White c2 pawn, satisfying Vendetta.',
  '102. After-move Disintegration makes owned b5 pawn dead without a capture; Black King safe, card discarded and Forced March drawn.',
  '103. Black ends after Disintegration; White still has Qf4xe5, so Vendetta persists.',
  '104. Qf4xe5 captures Black Queen and checks e8 along clear e6/e7; g3 is safe and Vendetta is satisfied.',
  '105. White ends with Black in check; Black has f6xe5 to capture the checking Queen.',
  '106. Forced March proposes g5-f5 and Crab h7-g7; both destinations empty but Qe5 still checks e8, so both restore; card spent/draw Merciless and regular move retained under §11.6.',
  '107. Returned original e7 pawn f6xe5 captures White Queen, cures check and satisfies Vendetta; card allowance stays spent.',
  '108. Black ends after f6xe5; White has d4xe5, preserving Vendetta.',
  '109. Original d2 pawn d4xe5 captures returned Black e7 pawn; g3 safe, no promotion and Vendetta satisfied.',
  '110. Mandatory final endTurn gives Black a fresh turn; Bc4xd5 remains available, so Vendetta persists with no pending resolution.',
];

test('random iteration 006: independently reviewed trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/006.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860006);
  assert.equal(trace.steps.length, rationales.length);
  rationales.forEach((reason, index) => assert.ok(reason.startsWith(`${index + 1}. `)));
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 9);
  const state = replayTrace(trace);
  assert.equal(state.fen, '2r1kbnr/5p1p/8/N1pNP1p1/1Pb1P3/P5PP/6Bn/1R2K1BR b k - 0 26');
  assert.deepEqual(state.turn, { color: 'black', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
  assert.deepEqual(state.effects.map(effect => (effect as { type: string }).type), ['crab', 'coup', 'vendetta']);
  assert.deepEqual(state.pieces.filter(piece => piece.royal).map(piece => [piece.id, piece.square]),
    [['white-pawn-g2', 'g3'], ['black-king-e8', 'e8']]);
  assert.deepEqual(state.pieces.filter(piece => piece.zone === 'dead').map(piece => piece.id), ['white-pawn-f2', 'black-pawn-b7']);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), ['fanatic', 'charge', 'sanctuary', 'riposte', 'toll']);
  assert.deepEqual(state.players.black.hand.map(card => card.cardId), ['fatal-attraction', 'curse', 'under-elf-hill', 'knightmare', 'merciless']);
  assert.deepEqual([state.players.white.deck.length, state.players.black.deck.length], [72, 69]);
  assert.deepEqual(state.players.white.discard.map(card => card.cardId), ['guardian', 'holy-war']);
  assert.deepEqual(state.players.black.discard.map(card => card.cardId), ['treason', 'betrayal', 'disintegration', 'forced-march']);
  assert.ok(!state.pendingRescue);
  assert.equal(state.outcome, null);
});
