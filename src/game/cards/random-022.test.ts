import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyAction, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import { checkState, digest, type RandomTrace } from './random-campaign.js';

// Rules §§8–11 govern every turn boundary, draw and temporary self-check below.
// Unmentioned piece identities, hands, effects and clocks stay unchanged.
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
  '98. Neutrality legally rescues Kd3: a hypothetical neutral Rc3xd3 attacks Black Kd8 on the empty d4-d7 file, making that capture illegal under §§11.7/15.1. Retain Neutrality, draw Holy Quest, preserve Kd3 and clear pending rescue.',
  '99. Close White turn with both Kings safe under legal neutral-capture threats; Neutrality persists.',
  '100. Black Ra3-a5 crosses empty a4; neither King is exposed and the open d-file still prevents neutral Rc3xd3.',
  '101. Close Black turn with neutral rook c3 and both card allowances reset.',
  '102. Passing in the Night swaps White b2/e6 Black and White f4/e5 Black pairs simultaneously, preserving all four pawn identities; consume White move, reset pawn clock and draw Guardian.',
  '103. Close White replacement turn with pawns e6/e5 now White and b2/f4 Black; no capture or en passant was created.',
  '104. Black moves neutral Rc3xc1 through empty c2, capturing White original c1 Bishop; both Kings remain safe and the neutral marker follows the rook.',
  '105. Black Curse marks opposing Rb1 after moving; retain the card, draw Irresistible Force and preserve clocks and Neutrality.',
  '106. Close Black turn with Curse tied to White original a1 rook and Neutrality tied to Black original h8 rook.',
  '107. White controls neutral Rc1-c3 through clear c2; the hypothetical c3-d3 capture would still attack Black Kd8, so both Kings remain safe.',
  '108. Close White turn without changing the neutral rook ownership or either retained effect.',
  '109. Black controls that same neutral Rc3-c1 through clear c2 without capturing; both Kings remain safe and quiet clock becomes 2.',
  '110. Close Black turn with the neutral physical rook on c1.',
  '111. Guardian advances White e6-e7 with the immediately trailing e5 pawn following to e6; no capture/en passant, draw Squaring the Circle, and Pe7 checks Kd8 without mating because Bf8 can capture it.',
  '112. Close White replacement turn with Black in answerable Pe7 check.',
  '113. Black Bf8xe7 captures White original b2 pawn, answering its check; reset capture clock and increment fullmove to 26.',
  '114. Close Black turn with Bishop e7, White original f2 pawn e6, and both effects retained.',
  '115. White Rf2-f1 moves one square to empty f1; this is the unmarked rook and King d3 stays safe.',
  '116. Close White turn without spending cards or changing the Curse target.',
  '117. Black neutral Rc1xf1 crosses empty d1/e1 and captures White original h1 rook; marker persists because the neutral rook itself was not captured.',
  '118. Close Black turn with neutral rook f1 and White marked rook b1 still present.',
  '119. White cursed Rb1-d1 crosses empty c1; exactly two squares satisfies Curse and preserves its marker.',
  '120. Close White turn with Curse following the same physical rook to d1.',
  '121. Black Ra5-c5 crosses empty b5 without capture; this ordinary rook has no Curse restriction.',
  '122. Close Black turn with rook c5 and no changes to card zones.',
  '123. White g5-g6 advances to an empty square, retains pawn identity and resets the halfmove clock.',
  '124. Close White turn without creating en passant from the one-square advance.',
  '125. Black neutral Rf1-e1 moves to empty e1; neither King lies on its attack file/rank and fullmove becomes 29.',
  '126. Cathedral swaps Black Rc5 and Be7 after the move without capture/path traversal; retain identities and effects, preserve clocks and draw Onslaught.',
  '127. Close Black turn with original a8 rook e7 and original f8 Bishop c5.',
  '128. White Nc4-d2 makes its ordinary Knight jump to empty d2; both Kings remain safe and quiet clock becomes 2.',
  '129. Close the fiftieth regular-move command: Black receives a fresh turn, no unresolved choices remain, and Neutrality/Curse persist.',
];

test('iteration 022: fifty moves preserve neutral threat legality and card identities', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/022.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860022);
  assert.equal(rationale.length, 129);
  assert.equal(rationale.length, trace.steps.length);
  assert.equal(trace.moves, 50);
  assert.equal(trace.steps.filter(step => step.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 18);
  assert.ok(!trace.failure);
  let state = createGameState(trace.initial);
  for (const [index, step] of trace.steps.entries()) {
    const before = digest(state);
    const result = applyAction(state, step.action);
    assert.equal(digest(state), before, `action ${index + 1}: input state must not mutate`);
    assert.ok(result.ok, rationale[index]);
    checkState(result.state);
    assert.equal(digest(result.state), step.expected, rationale[index]);
    state = result.state;
    if (index === 96) {
      assert.ok(state.pendingRescue);
      assert.equal(isKingInCheck(state, 'white'), true);
    }
    if (index === 97) {
      assert.equal(state.players.white.deck.length, 68);
      assert.deepEqual(state.players.white.hand.map(card => card.cardId),
        ['passing-in-the-night', 'under-elf-hill', 'man-trap', 'vendetta', 'holy-quest']);
      assert.deepEqual(state.effects, [{ type: 'neutrality', owner: 'white',
        card: { id: 'white-deck-5-neutrality', cardId: 'neutrality' }, pieceId: 'black-rook-h8' }]);
      assert.equal(state.pieces.find(piece => piece.id === 'white-king-e1')?.square, 'd3');
      assert.equal(state.pieces.find(piece => piece.id === 'black-rook-h8')?.neutral, true);
      assert.equal(state.players.white.discard.some(card => card.cardId === 'neutrality'), false);
      assert.equal(isKingInCheck(state, 'white'), false, 'neutral Rc3xd3 would illegally check its controller King d8');
      assert.equal(isKingInCheck(state, 'black'), false);
      assert.ok(!state.pendingRescue);
      assert.deepEqual(state.turn, { color: 'white', phase: 'afterMove', moveMade: true, cardPlays: { white: 1, black: 0 } });
    }
  }
  assert.equal(state.fen, '1nbk2n1/1pp1rpp1/4P1P1/2b4p/5p1P/3K4/1p1N4/3Rr3 b - - 2 29');
  assert.equal(state.fen, trace.finalFen);
  assert.deepEqual(state.turn, { color: 'black', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
  assert.deepEqual(state.effects, [
    { type: 'neutrality', owner: 'white', card: { id: 'white-deck-5-neutrality', cardId: 'neutrality' }, pieceId: 'black-rook-h8' },
    { type: 'curse', owner: 'black', card: { id: 'black-deck-6-curse', cardId: 'curse' }, pieceId: 'white-rook-a1' },
  ]);
  for (const [id, square] of Object.entries({ 'black-rook-h8': 'e1', 'white-rook-a1': 'd1',
    'black-rook-a8': 'e7', 'black-bishop-f8': 'c5', 'white-pawn-f2': 'e6', 'black-pawn-a7': 'f7',
    'black-pawn-f7': 'b2', 'black-pawn-e7': 'f4', 'white-knight-g1': 'd2' })) {
    assert.equal(state.pieces.find(piece => piece.id === id)?.square, square, id);
  }
  assert.equal(state.pieces.find(piece => piece.id === 'black-rook-h8')?.neutral, true);
  assert.equal(state.pieces.filter(piece => piece.zone === 'board').length, 20);
  assert.equal(state.pieces.filter(piece => piece.zone === 'captured').length, 12);
  assert.equal(state.pieces.filter(piece => piece.zone === 'dead' || piece.promoted).length, 0);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId),
    ['under-elf-hill', 'man-trap', 'vendetta', 'holy-quest', 'squaring-the-circle']);
  assert.deepEqual(state.players.black.hand.map(card => card.cardId),
    ['charge', 'heresy', 'peace-talks', 'irresistible-force', 'onslaught']);
  for (const color of ['white', 'black'] as const) {
    assert.equal(state.players[color].deck.length, 66);
    assert.equal(state.players[color].discard.length, 8);
    assert.equal(isKingInCheck(state, color), false);
  }
  assert.deepEqual(state.enPassant, []);
  assert.ok(!state.pendingRescue);
  assert.ok(!state.pendingAbduction && !state.pendingDoomsayer && !state.outcome);
});
