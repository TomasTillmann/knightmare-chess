import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Chess } from 'chessops/chess';
import { makeBoardFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Each entry was reviewed sequentially against rules.md, cards.md and catalog timing.
const rationales = [
  '1. h2-h3 is an empty forward Pawn step; both Kings remain sheltered.',
  '2. White finishes h3; Black receives a fresh turn without changing the board.',
  '3. e7-e5 crosses empty e6; the physical e7 Pawn becomes vulnerable on e6.',
  '4. Black ends; preserve the immediate e6 en-passant opportunity for White.',
  '5. b2-b3 is clear and expires the unused e6 opportunity.',
  '6. White ends b3 with no card or hand change.',
  '7. g7-g6 is an empty forward step; Black King e8 remains safe.',
  '8. Black ends g6 and resets the independent card allowances.',
  '9. h3-h4 advances the same h2 Pawn one empty square.',
  '10. After h4, Man-Trap marks the occupied friendly f2 square; retain the card and draw Onslaught.',
  '11. End White turn; the square-bound f2 trap persists.',
  '12. c7-c6 advances into an empty square; f2 trap is unrelated.',
  '13. End Black turn without triggering the trap or drawing.',
  '14. f2-f4 crosses empty f3; leaving its own trapped square neither captures the Pawn nor moves the trap.',
  '15. End White turn preserving the f3 en-passant opportunity.',
  '16. d7-d5 crosses empty d6; replace the expired f3 opportunity with d6.',
  '17. End Black turn preserving d6 for White.',
  '18. c2-c3 is clear and expires d6; White King remains safe.',
  '19. Siege after c3 exchanges the physical g1 Knight and a1 Rook without capture or move-clock advancement.',
  '20. End White turn retaining the swapped identities and the fixed f2 trap.',
  '21. Bf8-c5 traverses empty e7,d6; White King e1 is off both Bishop diagonals.',
  '22. End Black turn; the Bishop on c5 does not attack King e1.',
  '23. e2-e3 is clear and leaves King e1 safe behind its pieces.',
  '24. End White turn without spending a card.',
  '25. Bc5-f8 returns through empty d6,e7 and does not capture.',
  '26. End Black turn with its Bishop identity restored to f8.',
  '27. Bf1-e2 enters the square vacated by the e2 Pawn.',
  '28. End White turn; King e1 remains safe.',
  '29. Bombard replaces the move: Ra8-a5 jumps exactly the a7 Pawn over empty a6; a7 is unchanged and Black loses queenside castling.',
  '30. End Black replacement move; no second ordinary move is granted.',
  '31. Be2-b5 traverses empty d3,c4; the c6 Pawn blocks the diagonal toward King e8.',
  '32. End White turn with no check against Black.',
  '33. Bc8-e6 crosses empty d7 and leaves Black King safe.',
  '34. White Chaos reacts immediately, restoring Bc8 and clocks; Black must choose a different move, while White spends and draws.',
  '35. g6-g5 is a different legal Black move; White reaction allowance stays spent.',
  '36. End Black turn and reset both allowances for White.',
  '37. d2-d3 is an empty forward Pawn step.',
  '38. End White turn, preserving all cards and the trap.',
  '39. g5xh4 captures the physical White h2 Pawn diagonally; the Black g7 Pawn occupies h4.',
  '40. End Black capturing turn with the White h2 Pawn captured, not dead.',
  '41. Ke1-f2 is safe; its own trap does not fire, and moving the King revokes both White castling rights.',
  '42. End White turn with King f2 safe.',
  '43. Bc8-h3 crosses empty d7,e6,f5,g4; g2 still blocks its diagonal toward f1.',
  '44. End Black turn; Bishop h3 does not attack King f2.',
  '45. Onslaught replaces the move with simultaneous b3-b4,c3-c4,d3-d4,g2-g3, all initially empty; no capture or en passant.',
  '46. End the completed White replacement; King f2 is not on the h3-f1 Bishop diagonal.',
  '47. d5xc4 captures the physical White c2 Pawn; Black d7 Pawn arrives c4.',
  '48. Black Siege after capture swaps Ng8/Rh8 identities, preserving the capture and clocks.',
  '49. End Black turn with Knight h8 and Rook g8.',
  '50. Bb5-a4 is a one-square diagonal into empty a4.',
  '51. End White turn; the attacked Bishop may remain on a4.',
  '52. Bf8-h6 crosses vacant g7; Black King remains safe.',
  '53. End Black turn without using an available reaction.',
  '54. Ba4-c2 crosses empty b3 into the captured c2 Pawn original square.',
  '55. End White turn with Bishop c2 shielding its own lines as before.',
  '56. Bh6-g5 is a clear diagonal step; the White f4 Pawn may capture it next.',
  '57. End Black turn; no compulsory capture rule is active.',
  '58. f4xg5 captures the physical Black f8 Bishop and resets the halfmove clock.',
  '59. End White turn; Black elects not to play Riposte.',
  '60. Rg8-f8 enters the captured Bishop vacant square; the moved h8 Rook loses its castling right.',
  '61. End Black turn with all castling rights now absent.',
  '62. Before moving, Betrayal returns the captured White h2 Pawn to h4 and makes the opposing g7 Pawn dead; h4 lies on White half.',
  '63. Rg1-f1 moves the Siege-swapped a1 Rook into empty f1; Betrayal did not consume this move.',
  '64. End White turn with the returned Pawn alive and Black replacement victim dead.',
  '65. c6-c5 advances the original c7 Pawn into empty c5.',
  '66. End Black turn without card expenditure.',
  '67. Bc1-d2 enters a square vacated by the d2 Pawn.',
  '68. End White turn; King f2 is safe from the h3 Bishop.',
  '69. Qd8-e7 is an empty one-square diagonal.',
  '70. End Black turn with its Queen on e7.',
  '71. Rh1xh3 crosses empty h2 and captures the original c8 Bishop, leaving h4 Pawn unmoved.',
  '72. End White capture; the two original Black Bishops are now captured.',
  '73. Masquerade replaces Black move: King e8-d8 uses permitted Queen geometry without capture; d8 is safe.',
  '74. End Black replacement turn; King remains royal and no extra move follows.',
  '75. Qd1-f3 crosses empty e2; the Queen now shields King f2 along the f-file.',
  '76. End White turn with Queen f3 in place.',
  '77. Rf8-e8 enters the King vacated square; Queen e7 blocks the e-file.',
  '78. End Black turn with King d8 safe.',
  '79. Rh3-h1 returns through empty h2 and does not restore castling rights.',
  '80. End White turn with the h4 Pawn and Queen f3 unchanged.',
  '81. Qe7-f6 enters empty f6; White Queen f3 blocks its line to King f2.',
  '82. End Black turn; White is not yet checked.',
  '83. Qf3-c6 follows clear e4,d5 but exposes f6-f2; rules 11.6 allow only a pending card rescue, not turn completion.',
  '84. Rebirth h7-c7 is a valid enemy starting-rank relocation but cannot cure the f-file check; spend it and restore both the Pawn and unsafe Queen move, including clocks.',
  '85. Bc2-a4 through empty b3 is a safe replacement ordinary move with Queen f3 restored; White card allowance stays used.',
  '86. End White turn after the legal replacement.',
  '87. Evil Eye replaces Black move: Ra5 could capture Ba4 legally; remove only the Bishop, leaving Ra5 stationary and resetting capture clock.',
  '88. White Vulture reacts to Evil Eye; transfer that physical card, discard top Fireball, draw Irresistible Force, and retain six cards.',
  '89. End Black turn; Vulture used only White opponent-turn allowance.',
  '90. Na1-b3 is an ordinary Knight jump by the original g1 Knight; no capture.',
  '91. End White turn with Knight b3 and Queen f3 unchanged.',
  '92. e5-e4 advances Black e7 Pawn; White e3 Pawn stops a further forward step.',
  '93. End Black turn; e4 attacks f3 Queen rather than f2 King.',
  '94. Kf2-e1 is safe: e4/e3 block the e-file, and f3 still blocks Black Queen.',
  '95. End White turn; returning King e1 does not restore castling rights.',
  '96. Ra5-a3 crosses vacant a4 after Evil Eye removed its Bishop.',
  '97. End Black turn; White Knight b1 can capture that Rook.',
  '98. Dubbing replaces White move: Qf3-h2 makes an empty Knight jump while keeping Queen identity; King e1 stays safe.',
  '99. End White replacement turn; White still has six cards after one-for-one draw.',
  '100. a7-a5 crosses vacant a6, creating a6 en passant for the original a7 Pawn.',
  '101. End Black turn preserving the a6 opportunity.',
  '102. Nb1xa3 captures the Bombard Rook and expires a6 en passant.',
  '103. End White capture with distinct Knights a3 and b3.',
  '104. Qf6-e7 is an empty diagonal; e4 Pawn still blocks Black e-file pressure.',
  '105. End Black turn with Queen e7.',
  '106. d4xc5 captures the original Black c7 Pawn and preserves the White d2 Pawn identity.',
  '107. End White turn; c5 Pawn attacks b6/d6, not King d8.',
  '108. Kd8-c7 enters a safe square: White c5 Pawn attacks rank six and neither Knight reaches c7.',
  '109. Neutrality after Kc7 marks opposing nonroyal Pawn b4; retain White original owner, location, clocks, and the continuing card.',
  '110. End Black turn; neutral b4 threatens a5/c5 but neither King under 15.1.',
  '111. Returned h4-h5 Pawn advances one square; neutral b4 remains fixed and both Kings remain safe.',
  '112. End White turn without spending another card.',
  '113. Kc7-d7 is safe from c5 Pawn, both Knights and Queen h2; neutral b4 attacks only a5/c5.',
  '114. End Black turn with King d7 safe.',
  '115. Na3-c2 is a legal empty Knight jump by original b1 Knight; neither royal is exposed to neutral b4.',
  '116. End White turn: Black to act, no pending rescue or outcome, 50 move commands including the two subsequently rewound commands.',
];

function chess(state: GameState, color = state.turn.color) {
  const parts = state.fen.split(' ');
  parts[1] = color === 'white' ? 'w' : 'b';
  // This trace never castles; the swap-preserved castling metadata is checked by replay.
  parts[2] = '-';
  return Chess.fromSetup(parseFen(parts.join(' ')).unwrap()).unwrap();
}

test('iteration 027: 116 reasoned actions, card semantics and 50 move commands', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/027.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860027);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.length, 116);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 13);
  let state = createGameState(trace.initial);
  const states = [state];
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1;
    const why = rationales[index]!;
    assert.ok(why.startsWith(`${step}. `));
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, why);
    state = result.state;
    states.push(state);
    assert.equal(state.orientation, 0, why);
    assert.equal(state.outcome, null, why);
    assert.equal(!!state.pendingRescue, step === 83, why);
    assert.equal(chess(state, before.turn.color).isCheck(), step === 83, why);
    assert.deepEqual(state.effects, [
      ...(step >= 10 ? [{ type: 'man-trap', owner: 'white', card: { id: 'white-hand-3-man-trap', cardId: 'man-trap' }, square: 'f2' }] : []),
      ...(step >= 109 ? [{ type: 'neutrality', owner: 'black', card: { id: 'black-deck-3-neutrality', cardId: 'neutrality' }, pieceId: 'white-pawn-b2' }] : []),
    ], why);
    if (action.type === 'move') {
      const oracle = chess(before);
      const from = parseSquare(action.from as string)!;
      const to = parseSquare(action.to as string)!;
      assert.equal(oracle.isLegal({ from, to }), step !== 83, why);
      oracle.play({ from, to });
      assert.equal(makeBoardFen(oracle.board), state.fen.split(' ')[0], why);
      const mover = before.pieces.find(p => p.square === action.from)!;
      const victim = before.pieces.find(p => p.square === action.to);
      assert.equal(state.pieces.find(p => p.id === mover.id)?.square, action.to, why);
      assert.equal(state.pieces.filter(p => p.zone === 'captured').length,
        before.pieces.filter(p => p.zone === 'captured').length + Number(!!victim), why);
      if (victim) assert.equal(state.pieces.find(p => p.id === victim.id)?.zone, 'captured', why);
      assert.deepEqual(state.players, before.players, why);
      assert.deepEqual(state.turn, { ...before.turn, phase: 'afterMove', moveMade: true }, why);
      const doubleStep = mover.role === 'pawn' && Math.abs(Number(action.to?.toString()[1]) - Number(action.from?.toString()[1])) === 2;
      assert.deepEqual(state.enPassant, doubleStep ? [{ pawnId: mover.id,
        target: `${String(action.from)[0]}${(Number(String(action.from)[1]) + Number(String(action.to)[1])) / 2}` }] : [], why);
      assert.equal(Number(state.fen.split(' ')[4]), mover.role === 'pawn' || victim ? 0 : Number(before.fen.split(' ')[4]) + 1, why);
      assert.equal(Number(state.fen.split(' ')[5]), Number(before.fen.split(' ')[5]) + Number(before.turn.color === 'black'), why);
    } else if (action.type === 'endTurn') {
      for (const key of ['fen', 'pieces', 'players', 'effects', 'enPassant'] as const) assert.deepEqual(state[key], before[key], why);
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }, why);
    } else if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black';
      const card = before.players[owner].hand.find(c => c.id === action.cardInstanceId)!;
      const prior = before.players[owner];
      const vulture = action.cardId === 'vulture';
      const transferred = before.players.black.discard.at(-1)!;
      const draw = prior.deck[vulture ? 1 : 0]!;
      assert.deepEqual(state.players[owner].hand, [...prior.hand.filter(c => c.id !== card.id), draw, ...(vulture ? [transferred] : [])], why);
      assert.deepEqual(state.players[owner].deck, prior.deck.slice(vulture ? 2 : 1), why);
      assert.deepEqual(state.players[owner].discard, [...prior.discard, ...(vulture ? [prior.deck[0]!] : []), ...(['man-trap', 'neutrality'].includes(action.cardId) ? [] : [card])], why);
      assert.equal(state.turn.cardPlays[owner], 1, why);
      if (vulture) assert.deepEqual(state.players.black.discard, before.players.black.discard.slice(0, -1), why);
      else assert.deepEqual(state.players[owner === 'white' ? 'black' : 'white'], before.players[owner === 'white' ? 'black' : 'white'], why);
    }
  }
  const square = (step: number, id: string) => states[step]!.pieces.find(p => p.id === id)?.square;
  assert.equal(square(19, 'white-rook-a1'), 'g1');
  assert.equal(square(19, 'white-knight-g1'), 'a1');
  assert.equal(square(29, 'black-rook-a8'), 'a5');
  assert.equal(square(29, 'black-pawn-a7'), 'a7');
  assert.deepEqual(states[34]!.pieces, states[32]!.pieces);
  assert.equal(states[34]!.fen, states[32]!.fen);
  assert.deepEqual(states[34]!.chaosForbidden, { player: 'black', movement: 'black-bishop-c8:c8:e6' });
  assert.equal(applyAction(states[34]!, { type: 'move', from: 'c8', to: 'e6' }).ok, false);
  assert.deepEqual(['b2', 'c2', 'd2', 'g2'].map(s => square(45, `white-pawn-${s}`)), ['b4', 'c4', 'd4', 'g3']);
  assert.equal(states[45]!.turn.moveMade, true);
  assert.equal(square(48, 'black-rook-h8'), 'g8');
  assert.equal(square(48, 'black-knight-g8'), 'h8');
  assert.equal(states[62]!.pieces.find(p => p.id === 'black-pawn-g7')?.zone, 'dead');
  assert.equal(square(62, 'white-pawn-h2'), 'h4');
  assert.equal(states[62]!.turn.moveMade, false);
  assert.equal(states[62]!.fen.split(' ').slice(1).join(' '), states[61]!.fen.split(' ').slice(1).join(' '));
  assert.equal(square(73, 'black-king-e8'), 'd8');
  assert.equal(applyAction(states[83]!, { type: 'endTurn' }).ok, false);
  assert.deepEqual(states[84]!.pieces, states[82]!.pieces);
  assert.equal(states[84]!.fen, states[82]!.fen);
  assert.equal(states[84]!.history.at(-1)?.reason, 'SELF_CHECK');
  assert.equal(states[84]!.turn.moveMade, false);
  assert.equal(square(87, 'black-rook-a8'), 'a5');
  assert.equal(states[87]!.pieces.find(p => p.id === 'white-bishop-f1')?.zone, 'captured');
  assert.equal(square(98, 'white-queen-d1'), 'h2');
  assert.equal(states[98]!.pieces.find(p => p.id === 'white-queen-d1')?.role, 'queen');
  assert.deepEqual(states[109]!.pieces.find(p => p.id === 'white-pawn-b2'), {
    ...states[108]!.pieces.find(p => p.id === 'white-pawn-b2'), neutral: true, neutralBeforeEffects: false,
  });
  assert.equal(states[109]!.fen, states[108]!.fen);
  assert.deepEqual(state.pieces.filter(p => p.neutral).map(p => [p.id, p.square, p.owner]), [['white-pawn-b2', 'b4', 'white']]);
  assert.equal(chess(state, 'white').isCheck(), false);
  assert.equal(chess(state, 'black').isCheck(), false);
  assert.equal(state.fen, '1n2r2n/1p1kqp1p/8/p1P3PP/1Pp1p3/1N2P1P1/P1NB3Q/4KR1R b - - 2 27');
  assert.deepEqual(state, replayTrace(trace));
});
