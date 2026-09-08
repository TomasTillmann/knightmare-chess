import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { checkState, digest, type RandomTrace } from './random-campaign.js';

// Sequential semantic review against rules.md §§8–11,13.9–10,16.2,19.1,21,22.5
// and cards.md/catalog printed timing. Rows 1–25 are approved; row 26 is the
// first defect. Later rationale strings retain the historical, unapproved review.
// Truce suppresses capture threats, so later geometric attacks are not check.
const rationale = [
  '1. White a2-a4 crosses empty a3 to empty a4; pawn clock resets, a3 EP opportunity begins; e1 stays screened.',
  '2. White completes its move; Black begins with fresh allowances, a3 EP survives until the reply.',
  '3. Black h7-h6 is one forward empty square; old a3 EP expires, clock resets and fullmove becomes 2.',
  '4. Black completes h6; White begins, board and both five-card hands unchanged.',
  '5. Assassin replaces White move: c1 bishop legally takes friendly d2 pawn diagonally, preserving bishop identity; pawn captured, not dead. King safe, no mate; spend Assassin/draw Man-Trap.',
  '6. Assassin consumed the move; Black begins without another White move or draw.',
  '7. Black c7-c5 crosses empty c6; new c6 EP, pawn clock zero/fullmove 3; neither king exposed.',
  '8. Black finishes c5; White receives c6 EP window and fresh card allowance.',
  '9. White b2-b3 advances to empty b3, declining c6 EP; White king remains screened.',
  '10. White finishes b3; Black begins with no piece, hand or clock change.',
  '11. Black b7-b5 crosses empty b6; b6 EP appears, fullmove 4 and halfmove zero.',
  '12. Black finishes b5; White begins while b6 EP remains available.',
  '13. White bishop d2-f4 follows clear e3; destination empty, no king exposure; b6 EP expires and halfmove 1.',
  '14. White finishes Bf4; Black begins with unchanged board/resources.',
  '15. Black d7-d5 crosses empty d6; d6 EP established, halfmove zero/fullmove 5.',
  '16. Black finishes d5; White begins with the new EP window.',
  '17. White pawn a4xb5 captures the physical black b7 pawn diagonally forward; d6 EP expires, no royal capture or exposure.',
  '18. After move Holy War swaps own g1 knight and f1 bishop simultaneously; no capture or clocks change, king remains safe. Discard card/draw Squaring the Circle.',
  '19. White finishes capture plus Holy War; Black begins, both card counts reset.',
  '20. Black queen d8-b6 follows clear c7, lands empty b6; no line to e1 or exposure of e8, halfmove 1/fullmove 6.',
  '21. Black finishes Qb6; White begins, all resources unchanged.',
  '22. White queen d1-c1 moves one empty horizontal square vacated by bishop; e1 remains safe, halfmove 2.',
  '23. White finishes Qc1; Black begins with unchanged physical position.',
  '24. Hidden Passage replaces Black move: e8 king relocates to empty e6, ignoring e7 obstruction. White f4 bishop attacks e5/g5, not e6; pawns/queen do not attack e6. Black castling lost, clocks 3/7; discard/draw Hostage.',
  '25. Black finishes Hidden Passage; White begins without an extra Black move.',
  '26. Winged Victory returns captured original white d2 pawn to empty central e4 under local §21 eligibility. Same identity, no promotion/capture or direct mate; clock zero and move consumed. Discard/draw No Quarter.',
  '27. White finishes return; Black begins with pawn on e4 and unchanged five-card hands.',
  '28. Black queen b6-c7 moves one diagonal empty square, leaves e6 king safe; halfmove 1/fullmove 8.',
  '29. Black plays after-move Truce with its unused allowance; no capture occurs. Persistent Truce suppresses captures/check threats; draw Betrayal, card stays active rather than discarded.',
  '30. Black finishes Truce turn; White begins, Truce persists and neither side is stalemated.',
  '31. White bishop f4-d2 retraces clear e3 to empty d2; no capture under Truce, halfmove 2.',
  '32. White finishes Bd2; Black begins, active Truce and resources unchanged.',
  '33. Black b8 knight jumps to empty a6 in L geometry; no capture, halfmove 3/fullmove 9.',
  '34. Black finishes Na6; White begins with continuing Truce.',
  '35. White c2-c3 advances one empty square, halfmove zero; no capture or EP creation.',
  '36. After-move Man-Trap selects friendly occupied c3 and stores fixed square privately; no immediate capture, so Truce permits setup. Card active, draw Disintegration; board/clocks unchanged.',
  '37. White finishes trap setup; Black begins with Truce and fixed c3 trap retained.',
  '38. Black queen c7-f4 travels clear d6/e5 to empty f4; no c3 arrival and no capture, halfmove 1/fullmove 10.',
  '39. Black finishes Qf4; White begins, trap untriggered and hands unchanged.',
  '40. White b3-b4 advances one to empty b4 below friendly b5; clock zero, no capture.',
  '41. White finishes b4; Black begins with both continuing effects unchanged.',
  '42. Black queen f4-c7 retraces empty e5/d6; destination empty, halfmove 1/fullmove 11.',
  '43. Black finishes Qc7; White begins with unchanged resources.',
  '44. White queen c1-d1 returns to empty home square; halfmove 2, no capture under Truce.',
  '45. White finishes Qd1; Black begins and continuing effects stay active.',
  '46. Black queen c7-d6 moves to adjacent empty diagonal square; halfmove 3/fullmove 12.',
  '47. Black finishes Qd6; White begins with no new resource changes.',
  '48. Before-move Dubbing replaces White move: original e2 pawn jumps in L geometry to empty f4. It remains pawn, no promotion/capture or mate under Truce; clock zero, discard/draw Dark Mirror.',
  '49. White finishes Dubbing; Black begins, no extra White move and pawn powers remain ordinary.',
  '50. Black f7-f6 advances one empty forward square; clock zero/fullmove 13.',
  '51. Black finishes f6; White begins with unchanged hands/effects.',
  '52. White bishop d2-e3 moves one empty diagonal square; halfmove 1, no capture.',
  '53. White after-move Holy Quest swaps enemy f8 bishop/g8 knight, retaining roles/owners; no capture or clock change, legal under Truce. Discard/draw Bog.',
  '54. White finishes Holy Quest; Black begins, swapped identities and both continuing effects persist.',
  '55. Black king e6-d7 steps one diagonal onto empty d7; no capture/check under Truce; halfmove 2/fullmove 14.',
  '56. Black finishes Kd7; White begins with unchanged clock and materials.',
  '57. White c3-c4 advances into empty c4; fixed trap remains at c3 rather than following pawn, halfmove zero.',
  '58. White finishes c4; Black begins, c3 stays trapped but vacant.',
  '59. Black queen d6-b6 crosses empty c6 to empty b6; no c3 arrival, halfmove 1/fullmove 15. Bog response is optional and not played.',
  '60. Black finishes Qb6, closing optional Bog response; White begins without spending a card.',
  '61. White original g1 knight f1-d2 jumps to empty d2; identity from Holy War retained, halfmove 2.',
  '62. White finishes Nd2; Black begins, Truce/c3 trap remain.',
  '63. Black king d7-d6 steps to vacant d6 under Truce; halfmove 3/fullmove 16, castling remains absent.',
  '64. Black finishes Kd6; White begins with unchanged card holdings.',
  '65. White b1 knight jumps to empty c3; friendly arrival does not spring White trap. No capture, halfmove 4.',
  '66. White finishes Nc3; Black begins while c3 trap and knight coexist.',
  '67. Black original g8 knight f8-h7 makes L jump to empty h7; retains Knight role after Holy Quest, halfmove 5/fullmove 17.',
  '68. Black finishes Nh7; White begins with resources unchanged.',
  '69. White b1 knight c3-e2 jumps to empty e2 vacated by Dubbing; trap remains c3, halfmove 6.',
  '70. White finishes Ne2; Black begins, no trap trigger or new card draw.',
  '71. Black bishop c8-g4 traverses empty d7/e6/f5 to empty g4; no capture, halfmove 7/fullmove 18. Optional Bog not played.',
  '72. Black finishes Bg4, closing Bog opportunity; White begins with both effects unchanged.',
  '73. White g1 knight d2-f3 jumps to empty f3; halfmove 8, no capture.',
  '74. White finishes Nf3; Black begins with unchanged board and resources.',
  '75. Black g7-g6 advances one to empty g6; halfmove zero/fullmove 19.',
  '76. Black finishes g6; White begins, no EP and no effect expiry.',
  '77. White a1 rook goes a3 through empty a2; a3 empty, queenside castling revoked; halfmove 1.',
  '78. White finishes Ra3; Black begins with three occupied corners and a1 empty.',
  '79. Black queen b6-c7 moves one diagonal to empty c7; halfmove 2/fullmove 20.',
  '80. Black finishes Qc7; White begins with a1 still the sole empty corner.',
  '81. Squaring the Circle replaces White move: occupied a8/h8/h1 allow original e2 pawn f4-a1. Empty destination, arbitrary path, no promotion; clock zero, spend/draw Challenge.',
  '82. White finishes corner relocation; Black begins without another White move, pawn remains unpromoted on a1.',
  '83. Black queen c7-b6 steps diagonally to empty b6; halfmove 1/fullmove 21.',
  '84. Black finishes Qb6; White begins with unchanged resources/effects.',
  '85. White h2-h4 crosses empty h3; h4 empty despite adjacent black bishop g4. Pawn clock zero, h3 EP recorded; Truce still forbids capture.',
  '86. White finishes h4; Black begins with h3 EP window but no legal Truce capture.',
  '87. Black g6-g5 advances to empty g5, expiring h3 EP; halfmove zero/fullmove 22.',
  '88. Black finishes g5; White begins, no card spent and effects persist.',
  '89. White rook a3-d3 crosses empty b3/c3, landing empty d3; passing own c3 trap does not trigger it. Halfmove 1.',
  '90. White finishes Rd3; Black begins with trap retained and unchanged hand counts.',
  '91. Black bishop g4-f5 moves diagonally to empty f5; halfmove 2/fullmove 23.',
  '92. Black finishes Bf5; White begins with no capture or effect expiry.',
  '93. White queen d1-c1 moves horizontally to empty c1; halfmove 3.',
  '94. White finishes Qc1; Black begins, both five-card hands unchanged.',
  '95. Black original f8 bishop g8-f7 moves diagonally into square vacated by f-pawn; halfmove 4/fullmove 24.',
  '96. Black finishes Bf7; White begins with Truce and fixed c3 trap.',
  '97. White g1 knight f3-e5 jumps to empty e5; no capture or c3 arrival, halfmove 5.',
  '98. White finishes Ne5; Black begins with unchanged board/resources.',
  '99. Black a8 rook-d8 crosses empty b8/c8; d8 vacated by queen. Halfmove 6/fullmove 25; Black castling already absent. Optional Bog not played.',
  '100. Black finishes Rd8, closing Bog response; White begins and no card is spent.',
  '101. White queen c1-a3 follows clear b2 to empty a3 vacated by rook; halfmove 7.',
  '102. White finishes Qa3; Black begins with no capture/effect changes.',
  '103. Black bishop f5-g6 moves onto empty g6 vacated by pawn; halfmove 8/fullmove 26.',
  '104. Black finishes Bg6; White begins, trap still untriggered.',
  '105. White queen a3-b3 moves one horizontal square to empty b3; halfmove 9.',
  '106. White finishes Qb3; Black begins without drawing or discarding.',
  '107. Black original f8 bishop f7-e8 steps diagonally to empty old king square; halfmove 10/fullmove 27.',
  '108. Black finishes Be8; White begins with unchanged resources/effects.',
  '109. White king e1-d1 steps onto empty d1; Truce suppresses captures and no adjacent enemy king. Last White castling right revoked; halfmove 11.',
  '110. White finishes Kd1; Black begins, all castling rights remain absent.',
  '111. Black g5-g4 advances onto empty g4 vacated by bishop; halfmove zero/fullmove 28.',
  '112. Black finishes g4; White begins with no EP, promotions or captured-piece changes.',
  '113. White king d1-d2 steps onto empty d2 vacated by knight; Truce protects it and kings remain apart. Halfmove 1/fullmove 28.',
  '114. White completes the fiftieth regular move; Black begins beforeMove with reset allowances, Truce/c3 trap retained and no pending response.',
];

test('iteration 017 validates 25 actions and rejects own-capture Winged Victory at 26', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/017.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860017);
  assert.equal(rationale.length, 114);
  assert.equal(rationale.length, trace.steps.length);
  rationale.forEach((reason, index) => assert.ok(reason.startsWith(`${index + 1}. `)));
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 9);
  assert.equal(trace.steps.filter(step => step.action.type === 'endTurn').length, 55);
  // First defect: step 5 Assassin captured White own pawn; step 26 Winged
  // Victory cannot return it. Original rationales 26 onward are historical,
  // unapproved actions retained for review, not accepted gameplay.
  let state = createGameState(trace.initial);
  checkState(state);
  for (const [index, step] of trace.steps.slice(0, 25).entries()) {
    const original = digest(state);
    const result = applyAction(state, step.action);
    assert.equal(digest(state), original, `step ${index + 1}: input mutation`);
    assert.ok(result.ok, rationale[index]);
    checkState(result.state);
    assert.equal(digest(result.state, 1), step.expected, rationale[index]);
    state = result.state;
  }
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-d2')?.capturedBy, 'white');
  const before = structuredClone(state);
  const result = applyAction(state, trace.steps[25]!.action);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before, 'Rejected return spends no card and changes no state');
  assert.deepEqual(state, before, 'Input remains unchanged');

  // Historical final assertions below describe the unapproved suffix.
  // const state = replayTrace(trace);
  // assert.equal(state.fen, '3rb2r/p3p2n/nq1k1pbp/1PppN3/1PP1P1pP/1Q1RB3/3KNPP1/P5BR b - - 1 28');
  // assert.deepEqual(state.turn, { color: 'black', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
  // assert.equal(state.orientation, 0);
  // assert.equal(state.pieces.filter(piece => piece.zone === 'board').length, 31);
  // assert.deepEqual(state.pieces.filter(piece => piece.zone !== 'board').map(piece => [piece.id, piece.zone]), [['black-pawn-b7', 'captured']]);
  // const piece = (id: string) => state.pieces.find(candidate => candidate.id === id)!;
  // assert.equal(piece('white-pawn-d2').square, 'e4', 'Assassin victim returned by Winged Victory');
  // assert.equal(piece('white-pawn-e2').square, 'a1', 'Dubbing pawn subsequently relocated to corner');
  // assert.equal(piece('white-pawn-e2').promoted, false);
  // assert.equal(piece('white-knight-g1').square, 'e5', 'Holy War preserves physical knight');
  // assert.equal(piece('white-bishop-f1').square, 'g1');
  // assert.equal(piece('black-bishop-f8').square, 'e8', 'Holy Quest preserves physical bishop');
  // assert.equal(piece('black-knight-g8').square, 'h7');
  // assert.deepEqual(state.pieces.filter(p => p.royal).map(p => [p.owner, p.square]).sort(), [['black', 'd6'], ['white', 'd2']]);
  // assert.deepEqual(state.effects, [
  // { type: 'truce', owner: 'black', card: { id: 'black-hand-3-truce', cardId: 'truce' } },
  // { type: 'man-trap', owner: 'white', card: { id: 'white-deck-0-man-trap', cardId: 'man-trap' }, square: 'c3' },
  // ]);
  // assert.deepEqual(state.enPassant, []);
  // assert.ok(!state.pendingRescue);
  // assert.deepEqual(state.players.white.hand.map(card => card.cardId), ['no-quarter', 'disintegration', 'dark-mirror', 'bog', 'challenge']);
  // assert.deepEqual(state.players.black.hand.map(card => card.cardId), ['anathema', 'riposte', 'toll', 'hostage', 'betrayal']);
  // assert.equal(state.players.white.deck.length, 68);
  // assert.equal(state.players.black.deck.length, 73);
  // assert.deepEqual(state.players.white.discard.map(card => card.cardId), ['assassin', 'holy-war', 'winged-victory', 'dubbing', 'holy-quest', 'squaring-the-circle']);
  // assert.deepEqual(state.players.black.discard.map(card => card.cardId), ['hidden-passage']);
});
