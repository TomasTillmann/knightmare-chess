import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { checkState, digest, type RandomTrace } from './random-campaign.js';

// Rules §§8–11 govern every turn boundary, draw and temporary self-check below.
// Unmentioned piece identities, hands, effects and clocks stay unchanged.
// Review stops at the first invalid transition; generated actions 99–129 are unreviewed.
const rationale = [
  '1. White h2-h3 advances to an empty square; pawn clock resets and King e1 stays screened.',
  '2. Close White turn; Black receives its move and both card allowances reset.',
  '3. Black h7-h5 crosses empty h6; h6 en-passant opportunity is recorded and fullmove becomes 2.',
  '4. Close Black turn, preserving the new h6 en-passant opportunity for White.',
  '5. White h3-h4 advances without capture; h6 en-passant expires and h5 blocks further forward movement.',
  '6. Close White turn without changing board, cards or clocks.',
  '7. Black d7-d5 crosses empty d6; records d6 en passant and increments fullmove to 3.',
  '8. Close Black turn, retaining d6 en passant for the reply.',
  '9. White Rh1-h3 crosses vacated h2, loses kingside castling, clears en passant and increments quiet clock.',
  '10. Close White turn with only queenside White castling retained.',
  '11. Black a7-a6 advances one square without capture; resets clock and advances fullmove.',
  '12. Close Black turn with the a-pawn identity on a6.',
  '13. White c2-c3 advances to an empty square and resets the clock.',
  '14. Close White turn; hands and board remain fixed.',
  '15. Black e7-e5 crosses empty e6; records e6 en passant and advances fullmove to 5.',
  '16. Close Black turn, retaining e6 opportunity for White.',
  '17. White g2-g3 advances without capture and expires e6 en passant.',
  '18. Close White turn without a card play or draw.',
  '19. Black Qd8-e7 moves one clear diagonal step; quiet clock becomes 1.',
  '20. Close Black turn with Queen e7 and all pieces preserved.',
  '21. White f2-f4 crosses empty f3, records f3 en passant and resets the clock.',
  '22. Close White turn; Black may answer the double pawn step.',
  '23. Black Qe7-b4 crosses empty d6/c5; clears en passant, with c3 blocking its diagonal to e1.',
  '24. Close Black turn; White is safe behind c3.',
  '25. White Qd1-a4 crosses vacated c2 and empty b3; gives check along b5/c6/d7 to King e8.',
  '26. Close White turn; Black must answer the a4-e8 diagonal check.',
  '27. Black f7-f5 does not answer Qa4 check; it is only provisional pending an after-move rescue.',
  '28. Fatal Attraction h8 cannot freeze Qa4; failed rescue spends/discards it, draws Cathedral and rewinds f5 to f7.',
  '29. Black Qb4-b5 interposes on Qa4-e8, curing check with the still-available replacement move.',
  '30. Close Black turn with Fatal Attraction spent and neither pending rescue nor active magnet.',
  '31. Assassin replaces White move: Ra1 captures own Nb1, preserves rook identity, clears White castling and draws Masquerade.',
  '32. Close the Assassin replacement turn; there is no additional ordinary White move.',
  '33. Black Qb5xa4 captures White Queen; queen identity enters captured zone and the capture clock resets.',
  '34. Close Black turn with Black Queen a4.',
  '35. White Ke1-d1 enters Qa4-b3-c2-d1 check and requires an after-move rescue.',
  '36. Challenge selects movable black f7 pawn; its move obligation suppresses Qa4 capture/check, spends card and draws Fortification.',
  '37. Close White turn safely under Challenge; the obligation survives into Black turn.',
  '38. Black f7-f5 satisfies Challenge, expires its restriction and restores Qa4 check against White for the coming turn.',
  '39. Black plays Doomsayer after moving; retain the card as effect, draw Evil Eye and offer White the immediate naming choice.',
  '40. White declines the immediate naming opportunity; Doomsayer remains and no piece/card is spent.',
  '41. Close Black turn with Doomsayer retained and f6 en passant available to White.',
  '42. White c3-c4 leaves Kd1 in Qa4 check; retain a pending rescue rather than finalize that move.',
  '43. Fortification b2-c1 misses the a4-b3-c2-d1 attack; discard failed card, draw Onslaught and rewind c4 to c3 and f6 en passant.',
  '44. White names Queen but has no Queen on board; no loss is possible and Doomsayer remains.',
  '45. Repeating Queen again loses nothing and leaves the retained Doomsayer unchanged.',
  '46. White Kd1-e1 leaves the checking diagonal, expiring en passant and consuming the replacement move.',
  '47. Close White turn; Fortification allowance resets without restoring the spent card.',
  '48. Black names Queen and loses its own Qa4; capture resets clock and resolves/discards its retained Doomsayer.',
  '49. Black Ng8-e7 is an unobstructed knight jump to empty e7; fullmove becomes 11.',
  '50. Close Black turn with Doomsayer gone and both Queens captured.',
  '51. White g3-g4 advances into an empty square without capture.',
  '52. Close White turn with all remaining card zones fixed.',
  '53. Black Rh8-h6 crosses vacated h7, loses kingside castling and increments the quiet clock.',
  '54. Close Black turn; only black queenside castling remains.',
  '55. White e2-e4 crosses empty e3; creates e3 en passant and resets clock.',
  '56. Close White turn preserving e3 opportunity for Black.',
  '57. Black Ke8-d7 moves to a safe empty neighbor, loses remaining castling and clears en passant.',
  '58. Close Black turn with both royal identities preserved and no castling rights.',
  '59. White Bf1xa6 crosses empty e2/d3/c4/b5, capturing the black a-pawn.',
  '60. Close White turn; a6 contains the original f1 Bishop and the a-pawn is captured.',
  '61. Black Rh6-b6 crosses clear g6/f6/e6/d6/c6; a6 Bishop is adjacent but not captured.',
  '62. Close Black turn, preserving the last-moved Rook role for Doppelganger.',
  '63. Doppelganger moves White Ke1-e2 with Rook geometry to empty safe e2; consumes move and draws Man-Trap.',
  '64. Close the Doppelganger replacement turn without granting another White move.',
  '65. Resurrection returns captured black a-pawn identity to vacant starting-rank f7, consumes Black move and draws Charge.',
  '66. Close Black replacement turn with fullmove 15 and the restored pawn still unpromoted.',
  '67. White e4xd5 captures black d-pawn diagonally forward and resets clock.',
  '68. Black Revenge responds by capturing White pawn d5; no movement, new turn or second clock increment; draw Blessing.',
  '69. Close White turn and reset the opponent-turn card allowance for Black own turn.',
  '70. Evil Eye uses Rb6 threat to capture Ba6 without moving the rook; consumes Black move, draws Heresy and increments fullmove.',
  '71. Close Black replacement turn with Rb6 unmoved and White f1 Bishop captured.',
  '72. Onslaught simultaneously advances a2-a3, d2-d3 and g4-g5 into empty squares; consumes White move and draws Vendetta.',
  '73. Close White replacement turn; no en passant arises from one-square Onslaught moves.',
  '74. Black Rb6-d6 crosses empty c6 without capture, enabling Merciless.',
  '75. Merciless adds Rd6xd3 through empty d5/d4; captures White d-pawn, resets halfmove only and draws Peace Talks.',
  '76. Close Black turn after its granted rook move; no third move is available.',
  '77. White Rh3-f3 crosses empty g3; King e2 remains outside Rd3 lines.',
  '78. Close White turn without changing cards or effects.',
  '79. Blessing moves Black f5-e6 one diagonal step backward without capture; pawn clock resets and Black replacement move draws Curse.',
  '80. Close Black replacement turn with the physical f-pawn now at e6.',
  '81. Masquerade moves White Ng1-d1 like a Queen through vacant f1/e1 without capture; draw Neutrality and consume move.',
  '82. Close White replacement turn; the knight remains a Knight, with no persistent Queen powers.',
  '83. Black Kd7-d8 moves to an empty safe neighboring square and advances fullmove to 19.',
  '84. Close Black turn with King d8 and no castling rights restored.',
  '85. White Nd1-e3 uses ordinary Knight geometry after Masquerade ends; quiet clock becomes 3.',
  '86. Close White turn with the knight identity on e3.',
  '87. Black Rd3xc3 captures White c-pawn by one horizontal step; resets clock.',
  '88. Close Black turn with rook c3 and White c-pawn captured.',
  '89. White Rf3-f2 moves one square down into empty f2 without exposing King e2.',
  '90. Close White turn with both White rooks preserved.',
  '91. Black Ne7-g8 jumps to empty g8, preserving its original knight identity.',
  '92. Close Black turn; no card is drawn merely for ending the turn.',
  '93. White Ne3-c4 jumps to empty c4; King e2 remains safe from Rc3.',
  '94. Close White turn, preserving the c4 Knight and Black King d8.',
  '95. Black Ra8xa3 traverses empty a7/a6/a5/a4 and captures the White a-pawn; fullmove becomes 22.',
  '96. Close Black turn; White King e2 is safe and both black rooks remain on a3/c3.',
  '97. White Ke2-d3 enters the adjacent Rc3 attack; the move is provisional and requires a legal saving card.',
  '98. FINDING: Neutrality c3 cannot remove Rc3-d3 check because neutral pieces check either King (§15.1). It must fizzle/spend/draw and rewind Ke2-d3 (§11.6); engine instead keeps Kd3 and the neutral rook with no pending rescue.',
];

test('iteration 022: Neutrality cannot rescue a King from the selected rook', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/022.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860022);
  assert.equal(rationale.length, 98);
  assert.equal(trace.steps.slice(0, 98).filter(step => step.action.type === 'move').length, 38);
  assert.equal(trace.steps.slice(0, 98).filter(step => step.action.type === 'playCard').length, 14);
  let state = createGameState(trace.initial);
  for (const [index, step] of trace.steps.slice(0, 98).entries()) {
    const before = digest(state);
    const result = applyAction(state, step.action);
    assert.equal(digest(state), before, `action ${index + 1}: input state must not mutate`);
    assert.ok(result.ok, rationale[index]);
    checkState(result.state);
    // Historical hashes reproduce the finding; only the reviewed valid prefix is approved.
    if (index < 97) assert.equal(digest(result.state), step.expected, rationale[index]);
    state = result.state;
  }
  assert.equal(state.players.white.deck.length, 68, 'Neutrality draws one replacement even when ineffective');
  assert.deepEqual(state.players.white.hand.map(card => card.cardId),
    ['passing-in-the-night', 'under-elf-hill', 'man-trap', 'vendetta', 'holy-quest']);
  assert.deepEqual(state.effects, [], '§15.1: neutral Rc3 still checks Kd3, so the attempted rescue must not retain Neutrality');
  assert.equal(state.pieces.find(piece => piece.id === 'white-king-e1')?.square, 'e2');
  assert.equal(state.pieces.find(piece => piece.id === 'black-rook-h8')?.neutral, false);
  assert.equal(state.players.white.discard.at(-1)?.cardId, 'neutrality');
  assert.equal(state.fen, '1nbk1bn1/1pp2pp1/4p3/4p1Pp/2N2P1P/r1r5/1P2KR2/1RB5 w - - 0 22');
  assert.deepEqual(state.turn, { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 1, black: 0 } });
  assert.ok(!state.pendingRescue);
});
