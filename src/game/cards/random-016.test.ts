import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Reviewed sequentially against rules §§8–14, 18.2, 18.6, 21.1 and cards.md.
// Every ordinary move below preserves ownership/roles, leaves its own King safe,
// and clears prior en passant; pawn moves/captures reset the halfmove clock.
// Quiet non-pawn moves increment it; Black moves increment the fullmove number.
// EndTurn preserves board/clocks/hands and resets the next player's allowance,
// except explicitly noted effect expiry. Neither forbidden square is traversed.
const rationale = [
  '1. White Ng1-h3 is an unobstructed Knight jump to an empty square; clocks 1/1.',
  '2. White closes the completed Knight move; Black begins with both allowances clear.',
  '3. Black Bombard replaces its move: Ra8-a5 jumps the sole obstruction a7 over clear a6; q right lost, clocks 2/2, discard Bombard and draw Evil Eye.',
  '4. Black closes its replacement move; White begins without an extra Black move.',
  '5. White Nh3-f4 is a legal empty-square L jump, clocks 3/2.',
  '6. White ends the completed move, leaving the f4 Knight in place.',
  '7. Black f7-f5 crosses empty f6; pawn clock resets, fullmove 3, f6 en passant names the f7 pawn.',
  '8. Black ends; the f6 en-passant opportunity survives into White turn.',
  '9. White g2-g4 crosses empty g3; replaces f6 en passant with g3, clocks 0/3.',
  '10. White ends; g3 en passant remains until Black moves.',
  '11. Black Ng8-h6 lands empty; expires g3 en passant and clocks become 1/4.',
  '12. Black closes the h6 Knight move with no card expenditure.',
  '13. White Nf4-d3 lands empty by an L jump, clocks 2/4.',
  '14. White closes the d3 Knight move; Black may move.',
  '15. Black Ra5-b5 slides one square to empty b5, clocks 3/5.',
  '16. Black Forbidden City legally marks empty g5 after the move; card retained, Anathema drawn, board and clocks unchanged.',
  '17. Black ends; the g5 prohibition persists for both players.',
  '18. White Nb1-c3 jumps to empty c3, unaffected by g5, clocks 4/5.',
  '19. White ends; no board or card zones change.',
  '20. Black d7-d5 crosses clear d6, clocks 0/6; d6 en passant refers to the d7 pawn.',
  '21. Black ends; d6 en passant remains available for White.',
  '22. White e2-e3 advances into empty e3, clocks 0/6; old d6 en passant expires.',
  '23. White ends, preserving the e3 pawn and both safe Kings.',
  '24. Black Evil Eye replaces its move: Rb5 threatens Pb2 through empty b4,b3; only Pb2 is captured, rook stays, clocks 0/7, card discarded and Crab drawn.',
  '25. Black closes Evil Eye; no second move or replacement draw occurs.',
  '26. White h2-h4 crosses empty h3, clocks 0/7; h3 en passant records the h2 pawn.',
  '27. White ends; h3 en passant survives into Black turn.',
  '28. Black Rb5-b3 crosses empty b4 and ends empty, clocks 1/8; h3 en passant expires.',
  '29. Black ends the b3 rook move without changing cards.',
  '30. White a2-a3 moves forward into empty a3, clocks 0/8.',
  '31. White ends, retaining the a3 pawn and g5 marker.',
  '32. Black Rb3-b6 crosses empty b4,b5, clocks 1/9.',
  '33. Black ends the b6 rook move; board and clocks stay fixed.',
  '34. White Nc3-e2 jumps to the vacated e2 square, clocks 2/9.',
  '35. White ends; Black begins with a fresh card allowance.',
  '36. Black Forced March simultaneously shifts d5-c5 and e7-f7 into distinct initially empty squares; original pawn identities persist, clocks 0/10, no en passant; discard and draw Challenge.',
  '37. Black closes the two-pawn replacement move as one turn.',
  '38. White Nd3-e5 is a legal empty-square jump, clocks 1/10.',
  '39. White ends, keeping the Knight on e5.',
  '40. Black Rb6-b2 passes empty b5,b4,b3 and lands on the Evil Eye vacancy, clocks 2/11.',
  '41. Black ends the b2 rook move with no extra draw.',
  '42. White h4-h5 advances into empty h5 beside, without entering, forbidden g5; clocks 0/11.',
  '43. White ends; h5 pawn remains ordinary and unpromoted.',
  '44. Black Rb2xc2 captures the c2 pawn one square horizontally, clocks 0/12.',
  '45. Black ends; the c2 pawn remains captured, never dead.',
  '46. White Bf1-h3 crosses empty g2 to empty h3, clocks 1/12.',
  '47. White closes the h3 Bishop move; White King remains sheltered.',
  '48. Black Rc2-b2 returns to empty b2, clocks 2/13.',
  '49. Black closes the b2 rook move, retaining the captured c2 pawn.',
  '50. White Ne5-g6 jumps over the forbidden-city vicinity without entering g5, clocks 3/13.',
  '51. White ends; Black may capture the g6 Knight normally.',
  '52. Black f7xg6 is the original e7 pawn after Forced March; forward diagonal captures white g1 Knight, clocks 0/14.',
  '53. Black Challenge names White Ph5 after its move: h5xg6 is legal despite occupied h6; discard Challenge, draw Vendetta and bind the h2 pawn identity.',
  '54. Black ends; the Challenge obligation persists into White turn.',
  '55. White h5xg6 captures the original e7 pawn and satisfies Challenge with exactly the named physical pawn; obligation expires, clocks 0/14.',
  '56. White ends; there is no remaining Challenge or second loss of turn.',
  '57. Black a7-a5 crosses empty a6, clocks 0/15; a6 en passant names the a7 pawn.',
  '58. Black ends; a6 en passant remains for White.',
  '59. White Ne2-f4 jumps into empty f4, clocks 1/15; a6 en passant expires.',
  '60. White closes the f4 Knight move with unchanged hands.',
  '61. Black Nb8-a6 is a legal empty-square L jump, clocks 2/16.',
  '62. Black ends; the Knight remains a6 and Black King e8 is safe.',
  '63. White Ke1-f1 enters an unattacked adjacent square; both White castling rights disappear, clocks 3/16.',
  '64. White Forbidden City marks empty g8 after Ke1-f1; retains the second physical city and draws Fatal Attraction without changing clocks.',
  '65. White ends; g5 and g8 remain separate fixed prohibitions.',
  '66. Black Qd8-e7 moves one diagonal square into the Forced March vacancy, clocks 4/17.',
  '67. Black ends; Qe7 does not attack the White King f1.',
  '68. White g6xh7 captures Black original h7 pawn forward diagonally, clocks 0/17; no promotion on rank seven.',
  '69. White ends with the original h2 pawn still on h7.',
  '70. Black Bc8-d7 moves one diagonal step to empty d7, clocks 1/18.',
  '71. Black closes the d7 Bishop move and retains both cities.',
  '72. White f2-f3 advances one into empty f3, clocks 0/18.',
  '73. White ends without spending a card or refilling an already full hand.',
  '74. Black Bd7-c8 returns along its one-square diagonal, clocks 1/19.',
  '75. Black Vendetta is legal after the move, retained with no board/clock change; draws Breakthrough and requires later available captures.',
  '76. Black ends; White has Bc1xb2 available, so Vendetta remains active.',
  '77. White Bc1xb2 captures Black original a8 rook, satisfying Vendetta, clocks 0/19.',
  '78. White ends; Black can capture g4 with f5, so Vendetta persists.',
  '79. Black f5xg4 captures White original g2 pawn in its forward diagonal, satisfying Vendetta, clocks 0/20.',
  '80. Black ends; White has legal captures and Vendetta remains.',
  '81. White Bombard Ra1xa5 replaces its move, crossing empty a2, jumping its own a3 pawn and crossing empty a4; captures a7 pawn, satisfies Vendetta, clocks 0/20; discard and draw Cathedral.',
  '82. White ends its Bombard turn; Black has captures so Vendetta stays.',
  '83. Black g4xf3 captures White f2 pawn forward diagonally, satisfying Vendetta, clocks 0/21.',
  '84. Black ends; White Ra5xc5 is available, maintaining Vendetta.',
  '85. White Ra5xc5 crosses empty b5 and captures original d7 pawn, satisfying Vendetta, clocks 0/21.',
  '86. White Fatal Attraction marks its own Qd1 after the capture; freezes adjacent Pd2, not the magnet itself; retains card and draws Haunting Memories.',
  '87. White ends; Qd1 magnet stays and Black still has captures.',
  '88. Black Rh8xh7 captures White original h2 pawn, satisfying Vendetta and removing last Black castling right, clocks 0/22.',
  '89. Black ends; White has legal captures outside the magnet neighborhood.',
  '90. White Bb2xg7 crosses empty c3,d4,e5,f6 and captures g7 pawn; b2 is not adjacent to Qd1, neither city is crossed; clocks 0/22.',
  '91. White ends; Black Na6xc5 is available and Vendetta persists.',
  '92. Black Na6xc5 captures White original a1 rook by an L jump, satisfying Vendetta, clocks 0/23.',
  '93. Black ends; White magnet Queen can itself capture f3.',
  '94. White Qd1xf3 crosses empty e2 and captures original f7 pawn; the magnet may move, causing Fatal Attraction to expire into White discard before final safety; clocks 0/23.',
  '95. White ends; Pd2 is released and Vendetta persists through Black available captures.',
  '96. Black Bf8xg7 captures White original c1 Bishop, satisfying Vendetta, clocks 0/24.',
  '97. Black Crab marks its own unpromoted b7 pawn after the capture; same pawn identity/role stays on board, effect retained, Man of Straw drawn, clocks unchanged.',
  '98. Black ends; White Qf3xb7 is available and the Crab remains marked.',
  '99. White Qf3xb7 crosses empty e4,d5,c6 and captures the marked pawn; Crab expires into Black discard, victim captured rather than dead, clocks 0/24.',
  '100. White ends; Black Queen can capture e3 and Vendetta stays active.',
  '101. Black Qe7xe3 crosses empty e6,e5,e4 and captures White e2 pawn, satisfying Vendetta, clocks 0/25.',
  '102. Black ends; White Qb7xc7 is available and White King f1 is safe.',
  '103. White Qb7xc7 captures Black c7 pawn horizontally, clocks 0/25; Black King e8 is not on the attack line.',
  '104. White ends; Black has Qe3xd2 available under Vendetta.',
  '105. Black Qe3xd2 captures the released White d2 pawn diagonally, clocks 0/26; f1 is not attacked.',
  '106. Black ends; White can capture g7 with its Queen, retaining Vendetta.',
  '107. White Qc7xg7 crosses empty d7,e7,f7 and captures Black original f8 Bishop, clocks 0/26; g8 prohibition is not entered.',
  '108. White ends; Black still has a Bishop capture on h3.',
  '109. Black Bc8xh3 crosses empty d7,e6,f5,g4 and captures White f1 Bishop; gives check along h3-g2-f1, clocks 0/27.',
  '110. Black may end after giving check; White starts with an available legal capture of the checking Bishop.',
  '111. White Nf4xh3 captures Black original c8 Bishop, removing the check and satisfying Vendetta, clocks 0/27.',
  '112. White ends safely; Black Rh7xg7 remains a legal capture.',
  '113. Black Rh7xg7 captures White Queen horizontally, satisfying Vendetta, clocks 0/28; neither King is checked.',
  '114. Black ends; White King f1, Rh1, Nh3 and Pa3 have no captures, so Vendetta expires into Black discard; both cities persist and White has quiet moves.',
];

test('iteration 016 replays its independently reviewed action trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/016.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860016);
  assert.equal(trace.failure, undefined);
  assert.equal(rationale.length, 114);
  assert.equal(trace.steps.length, rationale.length);
  rationale.forEach((reason, index) => assert.ok(reason.startsWith(`${index + 1}. `)));
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 10);
  assert.equal(trace.steps.filter(step => step.action.type === 'endTurn').length, 54);
  const state = replayTrace(trace);
  assert.equal(state.fen, '4k3/6r1/7n/2n5/8/P6N/3q4/5K1R w - - 0 28');
  assert.deepEqual(state.pieces.filter(piece => piece.zone === 'board').map(piece => [piece.id, piece.square]).sort(), [
    ['black-king-e8', 'e8'], ['black-knight-b8', 'c5'], ['black-knight-g8', 'h6'],
    ['black-queen-d8', 'd2'], ['black-rook-h8', 'g7'], ['white-king-e1', 'f1'],
    ['white-knight-b1', 'h3'], ['white-pawn-a2', 'a3'], ['white-rook-h1', 'h1'],
  ]);
  assert.equal(state.pieces.filter(piece => piece.zone === 'captured').length, 23);
  assert.ok(state.pieces.every(piece => piece.zone === 'board' || piece.zone === 'captured'));
  assert.ok(state.pieces.every(piece => !piece.promoted && !piece.neutral && piece.role === piece.originalRole));
  assert.deepEqual(state.effects, [
    { type: 'forbidden-city', owner: 'black', card: { id: 'black-hand-4-forbidden-city', cardId: 'forbidden-city' }, square: 'g5' },
    { type: 'forbidden-city', owner: 'white', card: { id: 'white-hand-1-forbidden-city', cardId: 'forbidden-city' }, square: 'g8' },
  ]);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), ['resurrection', 'fanatic', 'irresistible-force', 'cathedral', 'haunting-memories']);
  assert.deepEqual(state.players.black.hand.map(card => card.cardId), ['evangelists', 'guardian', 'anathema', 'breakthrough', 'man-of-straw']);
  assert.deepEqual(state.players.white.discard.map(card => card.cardId), ['bombard', 'fatal-attraction']);
  assert.deepEqual(state.players.black.discard.map(card => card.cardId), ['bombard', 'evil-eye', 'forced-march', 'challenge', 'crab', 'vendetta']);
  assert.equal(state.players.white.deck.length, 72);
  assert.equal(state.players.black.deck.length, 68);
  assert.deepEqual(state.turn, { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
  assert.deepEqual(state.enPassant, []);
  assert.ok(!state.outcome && !state.pendingRescue && !state.pendingAbduction && !state.pendingDoomsayer);
});
