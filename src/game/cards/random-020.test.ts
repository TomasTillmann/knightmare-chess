import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

// Reviewed sequentially against rules §§8–13, 14.3, 15.1, 15.5, 20,
// cards.md, and the six played cards' printed catalog timing/continuing metadata.
// Every unmentioned hand/effect/identity is unchanged. No promotion occurs.
// Each completed move leaves the actor's King safe; endTurn changes only the
// active turn and resets card allowances, never spending cards or advancing clocks.
const rationale = [
  '1. f2-f4 crosses empty f3 to empty f4; the pawn resets the clock and creates f3 en passant, with e1 safe.',
  '2. White ends its completed turn; Black starts at move 1, retaining the f3 opportunity and all cards.',
  '3. g7-g6 is one Black forward step into an empty square; f3 expires, clock resets, fullmove becomes 2.',
  '4. Black ends safely; White receives move 2 with no card or board change.',
  '5. d2-d3 advances one square into empty d3; no capture or en passant is created, and e1 remains shielded.',
  '6. White ends; Black starts move 2 with unchanged hands and no effects.',
  '7. b7-b6 advances one Black square to empty b6; fullmove becomes 3 and the pawn clock stays zero.',
  '8. Black ends; White starts move 3, with both Kings safe and all cards retained.',
  '9. c2-c4 crosses vacant c3 to vacant c4, creates c3 en passant, and does not expose e1.',
  '10. White ends; c3 en passant persists for Black, with unchanged board and hands.',
  '11. h7-h5 crosses clear h6; replaces c3 with h6 en passant, resets the clock, and advances fullmove to 4.',
  '12. Black ends; White receives the h6 opportunity with all cards unchanged.',
  '13. a2-a3 is an empty forward step; h6 expires, no promotion, e1 remains safe.',
  '14. White ends safely; Black starts move 4 without drawing or discarding.',
  '15. e7-e5 crosses empty e6; e6 en passant is created and Black advances fullmove to 5.',
  '16. Black ends; White starts move 5 with e6 en passant retained.',
  '17. h2-h4 crosses empty h3 and ends below h5 without capture; h3 replaces e6 en passant.',
  '18. After its move White marks empty b4 with Forbidden City; the continuing card stays beside the board, draws Bog once (75 to 74), preserves h3 and clocks, and spends only White allowance.',
  '19. White ends; b4 stays forbidden, Black starts move 5, and both allowances reset.',
  '20. Black replaces its move with Evangelists: its c8 Bishop and White f1 Bishop exchange identities and squares without capture; e8 stays safe, e1 is not checked by f1, h3 expires, clock is 1/fullmove 6, and Resurrection replaces the discarded card.',
  '21. Black ends the completed replacement move; White starts move 6 with both exchanged Bishops intact.',
  '22. White Bishop c8xd7 captures the original black d7 Pawn one diagonal square away and checks e8; e1 stays safe and the clock resets.',
  '23. White ends its checking move; Black gets its response turn with the d7 Bishop still on board.',
  '24. Black Queen d8xd7 captures that checking Bishop in one vertical step, restores e8 safety, resets the clock, and advances fullmove to 7.',
  '25. Black ends after resolving check; White starts move 7 and neither hand changes.',
  '26. White Rook h1-h2 reaches the vacated pawn square, loses only White kingside rights, and increments the noncapture clock to 1.',
  '27. White ends; Black receives move 7 with queenside White castling still retained.',
  '28. g6-g5 is one empty Black pawn step; no b4 interaction, fullmove 8 and clock zero.',
  '29. Black ends; White starts move 8 without card changes.',
  '30. Nb1-d2 is a legal (2,1) jump to the vacated pawn square, leaving e1 safe; clock becomes 1.',
  '31. White ends; Black starts move 8 with b4 still blocked.',
  '32. Qd7-h3 slides through empty e6, f5, g4; it does not cross b4 or expose e8, and clock/fullmove become 2/9.',
  '33. White immediately plays Bog on the four-square Queen move: it stops one diagonal step from d7 at e6, with no capture; the completed Black move and 2/9 clocks remain, Bog is discarded, Evil Eye drawn (74 to 73), and White reaction allowance is spent.',
  '34. Black ends after Bog; White starts move 9 with its own allowance reset and Queen still e6.',
  '35. e2-e3 advances to vacant e3; the e5 pawn blocks the enemy Queen file and e1 remains safe, clock zero.',
  '36. White ends; Black starts move 9 with both persistent card and hands unchanged.',
  '37. Qe6xc4 follows clear d5 to the white c2-origin Pawn, captures it, and leaves e8 safe; clock zero/fullmove 10.',
  '38. Black ends; White starts move 10, retaining its captured pawn in the captured zone.',
  '39. Qd1-a4 slides through empty c2 and b3; it neither enters nor crosses forbidden b4, and e1 remains safe.',
  '40. White ends with Queen a4; Black starts move 10 with clock 1 unchanged.',
  '41. Nb8-d7 jumps to the vacated Queen square, with e8 safe and clock/fullmove 2/11.',
  '42. Black ends; White starts move 11 without piece, marker, or card changes.',
  '43. Ng1-e2 jumps to the vacated pawn square, does not expose e1, and increments clock to 3.',
  '44. White ends; Black starts move 11 with b4 still forbidden.',
  '45. b6-b5 advances to empty b5, stopping before forbidden b4; clock zero/fullmove 12.',
  '46. Black ends; White starts move 12 while the pawn remains b5.',
  '47. Ne2-g3 jumps to an empty square; e1 remains safe behind d2/e3 and the clock becomes 1.',
  '48. White ends; Black starts move 12 with the new Knight square retained.',
  '49. Qc4-c2 slides through clear c3 to empty c2; d2 blocks its line toward e2, so e1 stays safe; clock/fullmove 2/13.',
  '50. Black ends; White receives move 13, with no reaction played.',
  '51. Nd2xf1 makes a (2,1) jump and captures the swapped black c8 Bishop; removing d2 does not expose e1 to Qc2, and the clock resets.',
  '52. White ends; Black starts move 13 with its c8 Bishop captured and castling rights still kq.',
  '53. Black castles e8-c8 with Ra8-d8: d8/c8/b8 are empty, e8/d8/c8 are unattacked (Qa4 diagonal is stopped by Nd7), both identities move, both Black rights disappear, clock/fullmove 1/14.',
  '54. Black ends castling; White starts move 14 with its sole queenside right still available.',
  '55. e3-e4 advances to empty e4 below e5, creates no en passant, and resets the clock.',
  '56. White ends; Black starts move 14 with e1 safe and cards unchanged.',
  '57. Ng8-h6 jumps to empty h6, without exposing c8; clock/fullmove become 1/15.',
  '58. Black ends; White starts move 15 with the Knight at h6.',
  '59. Ng3xh5 jumps onto and captures the black h7-origin Pawn; e1 stays safe and clock zero.',
  '60. White ends; Black starts move 15 with h7 vacant and its original Pawn captured.',
  '61. Resurrection replaces Black move: the captured original d7 Pawn returns on vacant starting-rank h7, retaining physical identity, while the h7-origin Pawn stays captured; it neither captures nor checks, spends/discards once and draws Vulture (74 to 73), clock zero/fullmove 16.',
  '62. Black ends the resurrection replacement turn; White starts move 16 and all returned identity fields persist.',
  '63. Qa4xc2 follows clear b3 to the Black Queen, captures it without passing b4, and resets the clock.',
  '64. White ends; Black starts move 16 with its Queen captured and no Hostage response chosen.',
  '65. g5-g4 advances the black pawn to empty g4, does not capture h4 or f4, and advances fullmove to 17.',
  '66. Black ends; White starts move 17 with g4 retained and no cards spent.',
  '67. b2-b3 advances one square to empty b3; no attempt to enter b4, clock zero and e1 safe.',
  '68. White ends; Black starts move 17 with both Kings safe.',
  '69. Kc8-b8 is one safe horizontal step: White Queen c2 is blocked upward by c7 and no White Knight attacks b8; clock/fullmove 1/18.',
  '70. Black ends; White starts move 18, with castling rights unchanged after prior loss.',
  '71. g2-g3 reaches empty g3 below black g4, without capture or en passant; clock resets.',
  '72. White ends; Black starts move 18 and neither King is in check.',
  '73. Nd7-b6 jumps to empty b6 without exposing Kb8; clock/fullmove become 1/19.',
  '74. Black afterMove Neutrality legally marks opposing unpromoted d3 Pawn: ownership/role/square remain White/pawn/d3, both players gain control, marker persists, Siege is drawn (73 to 72), allowance spent without changing clocks or the completed Knight move.',
  '75. Black ends; White starts move 19 and the neutral Pawn remains d3 with its marker.',
  '76. Ke1-f2 moves one diagonal square to safety: the neutral d3 Pawn attacks c4/e4, g4 pawn attacks f3/h3, and neither attacks f2; White queenside rights are revoked and clock becomes 2.',
  '77. White ends; Black starts move 19 with no castling rights on either side.',
  '78. Nb6-d5 jumps to empty d5; the neutral d3 Pawn attacks c4/e4, so Kb8 remains safe; clock/fullmove 3/20.',
  '79. Black ends; White starts move 20 with neutral identity and both effects unchanged.',
  '80. Rh2-h1 returns one empty vertical square without restoring castling; f2 stays safe and clock becomes 4.',
  '81. White ends; Black starts move 20 with h2 empty.',
  '82. Black controls the neutral white d2-origin Pawn on d3 and captures White e2-origin Pawn at e4: original White forward diagonal governs, White ownership and neutral marker follow to e4, victim is captured, Kb8 safe, clock zero/fullmove 21.',
  '83. Black ends; White starts move 21 with the neutral e4 Pawn retained and victim still captured.',
  '84. Rh1-h2 returns to vacant h2; rights remain absent, Kf2 safe, clock 1.',
  '85. White ends; Black starts move 21 with both continuing effects intact.',
  '86. Bf8-e7 moves one clear diagonal square, makes no capture, leaves Kb8 safe, clock/fullmove 2/22.',
  '87. Black ends; White starts move 22 with Bishop e7 and unchanged cards.',
  '88. Nh5-g7 jumps to empty g7, with Kf2 safe and clock 3.',
  '89. White ends; Black starts move 22 with the Knight g7 retained.',
  '90. a7-a5 crosses empty a6 to empty a5, creates a6 en passant, resets clock and advances fullmove to 23.',
  '91. Black ends; White receives the a6 en-passant window and no card changes.',
  '92. Qc2-c5 slides through empty c3/c4 to empty c5; does not cross b4, expires a6 en passant and increments clock to 1.',
  '93. White ends; Black starts move 23 with no check against Kb8.',
  '94. Be7-f6 moves one clear diagonal step, preserves Kb8 safety, and sets clock/fullmove 2/24.',
  '95. Black ends; White starts move 24 with Bishop f6 unchanged.',
  '96. Ng7-e6 jumps to empty e6; it attacks d8/f8/c7/g7/c5/g5/d4/f4, not Kb8, and leaves Kf2 safe; clock 3.',
  '97. White ends; Black starts move 24 without changing effects or cards.',
  '98. c7-c6 advances to empty c6 above Qc5, no capture or en passant; clock zero/fullmove 25.',
  '99. Black ends; White starts move 25 with c6 occupied by the original black c7 Pawn.',
  '100. Ne6-g5 jumps to vacant g5, no longer occupies e6, and leaves Kf2 safe; clock 1.',
  '101. White afterMove Rebirth relocates enemy King b8 to its vacant original e8 square: no intervening path requirement, no capture, neither King checked or mated, no lost castling restored; clocks remain 1/25, card discarded and Anathema drawn (73 to 72).',
  '102. White ends; Black starts move 25 with its original royal identity at e8 and allowances reset.',
  '103. Bf6-g7 moves one diagonal square to the vacated Knight square; Ke8 safe, clock/fullmove 2/26.',
  '104. Black ends; White starts move 26 with Bishop g7 and all card zones unchanged.',
  '105. Ng5-f3 jumps to empty f3, does not expose Kf2, clock becomes 3.',
  '106. White ends; Black starts move 26 with Knight f3 and both continuing markers retained.',
  '107. f7-f6 moves one Black forward step to empty f6, makes no capture, leaves e8 safe and sets clock zero/fullmove 27.',
  '108. Black ends the fiftieth Regular Move; White starts move 27, no pending response/rescue, no en passant, no castling, two continuing effects and both five-card hands remain.',
];

test('iteration 020 independently reviewed random campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/020.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860020);
  assert.equal(trace.failure, undefined);
  assert.equal(trace.steps.length, 108);
  assert.equal(rationale.length, trace.steps.length);
  rationale.forEach((entry, index) => assert.ok(entry.startsWith(`${index + 1}. `)));
  assert.equal(trace.moves, 50);
  assert.deepEqual(trace.steps.flatMap(({ action }) => action.type === 'playCard' ? [action.cardId] : []),
    ['forbidden-city', 'evangelists', 'bog', 'resurrection', 'neutrality', 'rebirth']);
  const city = { type: 'forbidden-city', owner: 'white',
    card: { id: 'white-hand-3-forbidden-city', cardId: 'forbidden-city' }, square: 'b4' };
  const neutral = { type: 'neutrality', owner: 'black',
    card: { id: 'black-hand-4-neutrality', cardId: 'neutrality' }, pieceId: 'white-pawn-d2' };
  let checkpoint = createGameState(trace.initial);
  for (const [index, { action }] of trace.steps.entries()) {
    const result = applyAction(checkpoint, action);
    assert.ok(result.ok);
    checkpoint = result.state;
    const square = (id: string) => checkpoint.pieces.find(piece => piece.id === id)?.square;
    if (index === 17) assert.deepEqual(checkpoint.effects, [city]);
    if (index === 19) {
      assert.equal(square('white-bishop-f1'), 'c8');
      assert.equal(square('black-bishop-c8'), 'f1');
      assert.deepEqual(checkpoint.enPassant, []);
      assert.equal(checkpoint.fen.split(' ').slice(4).join(' '), '1 6');
    }
    if (index === 32) {
      assert.equal(square('black-queen-d8'), 'e6');
      assert.equal(checkpoint.fen.split(' ').slice(4).join(' '), '2 9');
      assert.deepEqual(checkpoint.turn, { color: 'black', phase: 'afterMove', moveMade: true,
        cardPlays: { white: 1, black: 0 } });
    }
    if (index === 52) {
      assert.equal(square('black-king-e8'), 'c8');
      assert.equal(square('black-rook-a8'), 'd8');
      assert.equal(checkpoint.fen.split(' ')[2], 'Q');
    }
    if (index === 60) {
      assert.equal(square('black-pawn-d7'), 'h7');
      assert.equal(checkpoint.pieces.find(piece => piece.id === 'black-pawn-h7')?.zone, 'captured');
    }
    if (index === 73) {
      assert.deepEqual(checkpoint.effects, [city, neutral]);
      assert.equal(square('white-pawn-d2'), 'd3');
    }
    if (index === 81) {
      assert.equal(square('white-pawn-d2'), 'e4');
      assert.equal(checkpoint.pieces.find(piece => piece.id === 'white-pawn-e2')?.zone, 'captured');
      assert.deepEqual(checkpoint.effects, [city, neutral]);
    }
    if (index === 100) {
      assert.equal(square('black-king-e8'), 'e8');
      assert.equal(checkpoint.fen.split(' ').slice(2).join(' '), '- - 1 25');
    }
  }
  const state = replayTrace(trace);
  assert.equal(state.fen, '3rk2r/6bp/2p2p1n/ppQnp3/4PPpP/PP3NP1/5K1R/R1B2N2 w - - 0 27');
  assert.deepEqual(state.turn, { color: 'white', phase: 'beforeMove', moveMade: false,
    cardPlays: { white: 0, black: 0 } });
  assert.deepEqual(state.effects, [city, neutral]);
  assert.deepEqual(state.pieces.find(piece => piece.id === 'white-pawn-d2'), {
    id: 'white-pawn-d2', owner: 'white', role: 'pawn', originalRole: 'pawn', square: 'e4',
    zone: 'board', promoted: false, royal: false, neutral: true, neutralBeforeEffects: false,
  });
  assert.deepEqual(state.pieces.filter(piece => piece.zone === 'captured').map(piece => piece.id).sort(),
    ['white-bishop-f1', 'white-pawn-c2', 'white-pawn-e2', 'black-bishop-c8', 'black-pawn-h7', 'black-queen-d8'].sort());
  assert.equal(state.pieces.filter(piece => piece.zone === 'board').length, 26);
  assert.equal(state.pieces.filter(piece => piece.zone === 'dead' || piece.zone === 'away' || piece.promoted).length, 0);
  assert.deepEqual(state.pieces.filter(piece => piece.royal).map(piece => [piece.id, piece.square]),
    [['white-king-e1', 'f2'], ['black-king-e8', 'e8']]);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), ['man-of-straw', 'knightmare', 'man-trap', 'evil-eye', 'anathema']);
  assert.deepEqual(state.players.black.hand.map(card => card.cardId), ['hostage', 'split-knight', 'betrayal', 'vulture', 'siege']);
  assert.deepEqual(state.players.white.discard.map(card => card.cardId), ['bog', 'rebirth']);
  assert.deepEqual(state.players.black.discard.map(card => card.cardId), ['evangelists', 'resurrection']);
  assert.equal(state.players.white.deck.length, 72);
  assert.equal(state.players.black.deck.length, 72);
  assert.deepEqual(state.enPassant, []);
  assert.equal(state.orientation, 0);
  assert.equal(state.outcome, null);
  assert.ok(!state.pendingRescue && !state.pendingAbduction && !state.pendingDoomsayer);
});
