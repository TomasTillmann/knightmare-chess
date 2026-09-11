import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, rejectPendingCancellation, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Independent chronological review: board geometry, royal identity, §11.6 rescue,
// §11.7 capture restrictions, and printed timing. No later action is skipped.
const rationale = [
  '1. Ng1-f3 is an empty L-jump; e1/e8 remain safe; quiet clock 1.',
  '2. White ends: Black receives its first move; board, cards and clocks stay fixed.',
  '3. Nb8-a6 is an empty L-jump; no King attack; Black advances fullmove to 2.',
  '4. Black ends; White starts with both card allowances reset.',
  '5. Nf3-h4 is an empty L-jump; neither King is attacked.',
  '6. White ends; no card expenditure or board changes.',
  '7. Na6-b4 jumps to an empty square; it attacks c2/d3/d5/c6/a6/a2, not e1.',
  '8. Black ends with e1 safe; no draws without a played card.',
  '9. Pg2-g4 crosses empty g3, reaches empty g4; g3 en passant is recorded, clock resets.',
  '10. White ends; the g3 opportunity persists into the opposing turn.',
  '11. Nb4-a6 jumps clear; unused g3 en passant expires; quiet clock 1.',
  '12. Black Coup after move makes safe h7 Pawn royal and e8 a capturable Prince; retained card draws Rebirth.',
  '13. Black ends; Coup persists and White gets a fresh allowance.',
  '14. Pc2-c4 crosses clear c3; own e1 remains safe; c3 en passant and clock zero.',
  '15. White ends without changing c3 en passant or either royal identity.',
  '16. Pb7-b6 advances to empty b6; h7 is safe; c3 en passant expires.',
  '17. Black ends; White may act and no cards change zones.',
  '18. Nh4-g2 returns to the vacated Pawn square; legal L-jump and safe e1.',
  '19. White ends; h7 remains the Black royal Pawn.',
  '20. Pf7-f5 crosses empty f6; h7 remains safe; create f6 en passant and reset clock.',
  '21. Black ends preserving f6 opportunity; no card is spent.',
  '22. Pg4xf5 captures the actual f7 Pawn diagonally; capture zone, no death, clock zero.',
  '23. White ends; captured f7 identity stays captured and en passant is empty.',
  '24. Royal Ph7-h6 retains Pawn movement; h6 is not attacked by Pf5; both Black castling rights vanish.',
  '25. Black ends with safe h6 royal Pawn; e8 Prince remains nonroyal.',
  '26. Qd1-c2 is a single empty diagonal; own e1 remains safe.',
  '27. White ends preserving the h6 royal identity and quiet clock.',
  '28. Pg7-g6 advances one empty square; h6 is safe because Pf5 attacks e6/g6, not h6.',
  '29. Black ends; the attacked g6 Pawn is not royal.',
  '30. Pf2-f3 advances to empty f3; e1 has no exposed enemy ray; clock resets.',
  '31. Holy War after move swaps own Nb1/Bf1, preserving identities; neither royal is checked; draw Breakthrough.',
  '32. White ends; swapped Knight f1/Bishop b1 persist; allowance resets.',
  '33. Pg6-g5 advances to empty g5; h6 remains safe, clock zero.',
  '34. Rebirth moves enemy Nf1 to empty g1, a standard Knight starting square; no capture, draw Hidden Passage.',
  '35. Black ends; Rebirth adds no clock increment and g1 remains the b1 Knight identity.',
  '36. Ng1-h3 is an empty L-jump; h6 is not a Knight target from h3.',
  '37. Neutrality targets opposing nonroyal Pa7 after move; retains Black direction and ownership; draw Guardian.',
  '38. White ends; neutral a7 can be controlled by either player and attacks b6, not either King.',
  '39. Na6-b4 jumps clear; h6 remains safe; neutral a7 stays fixed.',
  '40. Black ends with quiet clock 2 and no card changes.',
  '41. Rh1-f1 crosses vacated g1 to empty f1; revoke White kingside castling, e1 safe.',
  '42. White ends; remaining castling right is White queenside.',
  '43. Ra8-b8 is one empty horizontal square; h6 remains safe.',
  '44. Black ends; neutral a7 is still on board with its marker.',
  '45. Pe2-e4 crosses empty e3; no enemy attack opens on e1; record e3 en passant.',
  '46. White ends, retaining e3 opportunity and clock zero.',
  '47. Masquerade replaces Black move: Ng8-d5 follows clear f7/e6 diagonal, no capture or role change; draw Anathema.',
  '48. Black ends the replacement move; fullmove 12 and expired e3 en passant are correct.',
  '49. Pd2-d3 enters empty d3; Nd5 does not attack e1; clock resets.',
  '50. White ends with no spending and safe e1.',
  '51. Black controls neutral Pa7xb6, capturing its own b7 Pawn legally; neutral direction remains downward; h6 safe.',
  '52. Black ends; a7 identity now b6 remains neutral and the b7 identity is captured.',
  '53. Qc2-b3 moves one empty diagonal; neither Nb4 nor Nd5 attacks e1.',
  '54. White ends; the Queen is nonroyal and may be attacked.',
  '55. Pc7-c5 crosses empty c6; h6 remains safe; c6 en passant and zero clock.',
  '56. Black ends retaining c6 opportunity until White moves.',
  '57. Bc1-d2 enters vacated d2 diagonally; e1 safe; c6 en passant expires.',
  '58. White ends; no card or capture changes.',
  '59. Prince Ke8-f7 uses its retained one-square movement; royal Pawn h6 stays safe.',
  '60. Dungeon relocates enemy Qb3 to empty h1; h2 blocks its h-file ray to h6; freeze through White turn, draw Doomsayer.',
  '61. Black ends; White begins with the h1 Queen forbidden to move.',
  '62. Nh3-f2 jumps to empty f2 instead of moving the frozen Queen; e1 safe.',
  '63. White ends; Dungeon expires now, with Queen h1 unchanged.',
  '64. Nd5-e3 jumps to empty e3; it attacks f1/d1/c2/c4/d5/f5/g2/g4, not e1.',
  '65. Doomsayer after Black move retains its card, opens White naming choice, and draws Curse once.',
  '66. White names Bishop and chooses own Bd2 to lose; capture resets clock, discards resolved Doomsayer; neither royal attacked.',
  '67. Black ends; White card allowance is fresh despite speaking and losing a Bishop.',
  '68. Pa2-a3 advances one empty square; e1 safe and no en passant created.',
  '69. White ends; the captured Bishop remains captured.',
  '70. Ne3xf1 captures White h1 Rook by L-jump; f1 Knight does not attack e1; clock zero.',
  '71. Black ends; Queen h1 remains on board and both physical captures persist.',
  '72. Ke1-d2 enters Nf1 attack; permitted only as pending same-turn card rescue (§11.6), rights revoked.',
  '73. Challenge selects movable Rb8 (b7/a8 available); forces Black Rook use, suppressing Nf1 capture of d2 (§11.7), rescuing White.',
  '74. White ends legally under Challenge suppression; Black must use the a8 Rook identity.',
  '75. Challenged Rb8-b7 moves to empty b7, satisfies obligation; Nf1 check on White d2 resumes; Black h6 remains safe.',
  '76. Black ends giving White its escape turn from Nf1 check, not capturing the King.',
  '77. Kd2-e3 remains attacked by Nf1; temporary move requires a same-turn rescue.',
  '78. Black Chaos immediately cancels that King move, restoring d2 and clock 2/fullmove 18; Black draws Challenge and prohibits the canceled move.',
  '79. Qh1-g1 is empty and differs from canceled Kd2-e3, but leaves d2 checked: still pending rescue.',
  '80. Heresy proposes c8-c7, f8-g8, then b1-c1, all empty adjacent opposite-color squares; none removes Nf1 check, so card fizzles and illegal Q move rewinds; draw Confabulation.',
  '81. Kd2-c3 now escapes: Nb4 attacks a2/c2/d3/d5/a6/c6, Nf1 attacks d2/e3/g3/h2; neither hits c3; c5 blocks Rc7 future ray.',
  '82. White ends safe on c3; Heresy and Chaos stay spent, both allowances reset.',
  '83. Rb7-c7 is an empty horizontal step; c5 and c4 block the c-file toward King c3.',
  '84. Black ends; White c3 is safe and Black royal remains h6.',
  '85. Madman replaces White move: Pf3 jumps Pe4 to d5, then Pc4 to b3; landing squares empty, jumped Pawns survive; draw Resurrection.',
  '86. White ends; b3 Pawn is the original f2 identity and clock remains zero.',
  '87. Rh8-h7 enters the square vacated by royal Pawn; h6 remains safe.',
  '88. Curse after move marks enemy Bb1, limiting this same f1 Bishop identity to two squares; draw Bombard.',
  '89. Black ends retaining Curse, Coup, Neutrality and board positions.',
  '90. Kc3-c2 enters Nb4 attack; a same-turn rescue is required before ending.',
  '91. White Coup makes safe Pb2 royal, while c2 becomes capturable Prince; Nb4 does not attack b2; draw Figure Dance.',
  '92. White ends with royal b2 and Black royal h6; neither Prince needs royal safety.',
  '93. Nf1-e3 is an empty L-jump; it does not attack royal b2 and Black h6 remains safe.',
  '94. Black ends with both Coup markers and Curse unchanged.',
  '95. White moves neutral Pb6-b5 downward into empty b5; its a4/c4 attacks hit neither royal b2/h6; clock resets.',
  '96. White ends preserving neutral Black ownership and Pawn movement direction.',
  '97. Ne3-f1 jumps into the now-empty capture square; royal b2 remains safe.',
  '98. Black ends; no card movement or effect expiry.',
  '99. White Prince Kc2-c3 steps to empty c3; royal b2 remains fixed and safe.',
  '100. White ends; Prince c3 does not replace royal b2.',
  '101. Bf8-g7 enters empty g7; its diagonal toward b2 is blocked by White Pf6 after the next move, and currently f6/e5/d4/c3 Prince blocks further travel.',
  '102. Black ends; the c3 Prince blocks the g7-f6-e5-d4-c3-b2 diagonal to the White royal.',
  '103. Pf5-f6 advances empty, now itself blocks Bg7 diagonal to b2; attacks e7/g7, not royal h6.',
  '104. Figure Dance simultaneously rotates Ra1-h1 and Qh1-h8; h7 Rook blocks Queen from royal h6, so no check or mate; draw Pacifism.',
  '105. White ends; both corner identities persist, no capture and no extra clock.',
  '106. Black Prince Kf7-g6 moves one diagonal to empty g6; royal h6 remains shielded by Rh7 from Qh8.',
  '107. Black ends with safe royal h6 and capturable Prince g6.',
  '108. White Pacifism before move targets neutral Pb5 as a controllable friendly piece; retains neutrality and disables captures both ways; draw Blessing.',
  '109. Ng2-f4 jumps to empty f4; b2 stays safe, Pacifism consumes no extra move.',
  '110. White ends; Pacifism/Neutrality remain on the same b5 identity.',
  '111. Qd8-f8 crosses empty e8 to empty f8; royal h6 is safe, White Pf6 blocks Qf8 file below f6.',
  '112. Black ends; Queen f8 attacks nonroyal Qh8 but neither royal.',
  '113. Nf2-h3 jumps to empty h3; White royal b2 remains safe; the other White Knight already on f4 still attacks h5.',
  '114. White ends with both royal Pawns unchanged and quiet clock 4.',
  '115. Black royal Ph6-h5 enters White Nf4 attack; pending same-turn rescue and zero Pawn clock.',
  '116. Crab targets Pe7 but cannot suppress Nf4-h5 attack; failed rescue spends/discards Crab, draws Cathedral, restores royal h6 and clock 4/fullmove 25; Black retains replacement move.',
];

// F4 / FAQ p.16: only actions 1–77 are a legal prefix. Later artifact actions
// depend on the rejected cancellation at action 78; original artifact hashes remain unchanged.
test('iteration 079 independently reviewed deterministic campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/079.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationale.length, 116);
  assert.equal(trace.steps.length, rationale.length);
  assert.equal(trace.moves, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 16);
  const states: GameState[] = [createGameState(trace.initial)];
  for (const [i, { action }] of trace.steps.slice(0, 77).entries()) {
    const before = states[i]!;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationale[i]);
    const after = result.state;
    states.push(after);
    assert.ok(rationale[i]!.startsWith(`${i + 1}. `));
    assert.equal(!!after.pendingRescue, [72, 77, 79, 90, 115].includes(i + 1), rationale[i]);
    if (action.type === 'endTurn') {
      assert.equal(after.fen, before.fen, rationale[i]);
      assert.deepEqual(after.pieces, before.pieces, rationale[i]);
      assert.deepEqual(after.players, before.players, rationale[i]);
      assert.deepEqual(after.enPassant, before.enPassant, rationale[i]);
      assert.equal(after.turn.color, before.turn.color === 'white' ? 'black' : 'white');
      assert.equal(after.turn.phase, 'beforeMove');
      assert.deepEqual(after.turn.cardPlays, { white: 0, black: 0 });
    }
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const mover = before.pieces.find(p => p.square === action.from)!;
      assert.ok(mover.owner === before.turn.color || mover.neutral, rationale[i]);
      const victim = before.pieces.find(p => p.square === action.to);
      assert.ok(!victim || !victim.royal && (victim.owner !== mover.owner || mover.neutral), rationale[i]);
      assert.equal(after.pieces.find(p => p.id === mover.id)!.square, action.to);
      if (victim) assert.equal(after.pieces.find(p => p.id === victim.id)!.zone, 'captured');
      const dx = action.to.charCodeAt(0) - action.from.charCodeAt(0);
      const dy = Number(action.to[1]) - Number(action.from[1]);
      if (mover.role === 'knight') assert.equal(Math.abs(dx * dy), 2, rationale[i]);
      if (mover.role === 'king') assert.equal(Math.max(Math.abs(dx), Math.abs(dy)), 1, rationale[i]);
      if (mover.role === 'pawn') {
        assert.equal(Math.sign(dy), mover.owner === 'white' ? 1 : -1);
        assert.equal(Math.abs(dx), victim ? 1 : 0);
        assert.ok(Math.abs(dy) === 1 || !victim && Math.abs(dy) === 2);
      }
      if (mover.role === 'rook') assert.ok(dx === 0 || dy === 0);
      if (mover.role === 'bishop') assert.equal(Math.abs(dx), Math.abs(dy));
      if (mover.role === 'queen') assert.ok(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy));
      if (mover.role !== 'knight') {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        for (let n = 1; n < distance; n++) {
          const middle: string = String.fromCharCode(action.from.charCodeAt(0) + n * Math.sign(dx)) + (Number(action.from[1]) + n * Math.sign(dy));
          assert.ok(!before.pieces.some(p => p.square === middle), rationale[i]);
        }
      }
      const expectedEp = mover.role === 'pawn' && Math.abs(dy) === 2
        ? [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}`, pawnId: mover.id }] : [];
      assert.deepEqual(after.enPassant, expectedEp, rationale[i]);
      assert.equal(Number(after.fen.split(' ')[4]), mover.role === 'pawn' || victim ? 0 : Number(before.fen.split(' ')[4]) + 1);
      assert.equal(Number(after.fen.split(' ')[5]), Number(before.fen.split(' ')[5]) + (before.turn.color === 'black' ? 1 : 0));
      assert.deepEqual(after.players, before.players);
    }
    if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black';
      const old = before.players[owner];
      const next = after.players[owner];
      const timing = CARD_CATALOG[action.cardId]!.timing;
      assert.ok(owner === before.turn.color ? timing.includes(before.turn.phase) : timing.includes('afterOpponentMove'));
      assert.deepEqual(next.hand, [...old.hand.filter(c => c.id !== action.cardInstanceId), old.deck[0]!]);
      assert.deepEqual(next.deck, old.deck.slice(1));
      assert.equal(after.turn.cardPlays[owner], 1);
      const retained = CARD_CATALOG[action.cardId]!.continuing && action.cardId !== 'crab';
      assert.equal(next.discard.some(c => c.id === action.cardInstanceId), !retained);
    }
  }
  const piece = (step: number, id: string) => states[step]!.pieces.find(p => p.id === id)!;
  assert.equal(piece(12, 'black-pawn-h7').royal, true);
  assert.equal(piece(12, 'black-king-e8').royal, false);
  assert.deepEqual(states[12]!.effects, [{ type: 'coup', owner: 'black', card: { id: 'black-hand-3-coup', cardId: 'coup' }, princeId: 'black-king-e8', kingId: 'black-pawn-h7', princeRole: 'king' }]);
  assert.equal(piece(31, 'white-knight-b1').square, 'f1');
  assert.equal(piece(31, 'white-bishop-f1').square, 'b1');
  assert.equal(piece(34, 'white-knight-b1').square, 'g1');
  assert.equal(piece(37, 'black-pawn-a7').neutral, true);
  assert.equal(piece(37, 'black-pawn-a7').owner, 'black');
  assert.equal(piece(47, 'black-knight-g8').square, 'd5');
  assert.equal(piece(47, 'black-knight-g8').role, 'knight');
  assert.equal(piece(51, 'black-pawn-b7').zone, 'captured');
  assert.equal(piece(60, 'white-queen-d1').square, 'h1');
  const dungeon = { type: 'dungeon', owner: 'black', player: 'white', pieceId: 'white-queen-d1' };
  assert.deepEqual(states[60]!.effects.at(-1), dungeon);
  assert.deepEqual(states[62]!.effects.at(-1), dungeon);
  assert.equal(states[63]!.effects.length, 2);
  assert.equal(piece(66, 'white-bishop-c1').zone, 'captured');
  assert.equal(states[66]!.players.black.discard.at(-1)!.cardId, 'doomsayer');
  assert.equal(states[66]!.fen.split(' ')[4], '0');
  assert.deepEqual(states[73]!.effects.at(-1), { type: 'challenge', owner: 'white', player: 'black', pieceId: 'black-rook-a8' });
  assert.equal(states[75]!.effects.length, 2);
  const final = states.at(-1)!;
  assert.deepEqual(replayTrace(trace, 78), final);
  rejectPendingCancellation(final, trace.steps[77]!.action, [{"type":"playCard","cardId":"coup","cardInstanceId":"white-hand-2-coup","target":"f2"}]);
});
