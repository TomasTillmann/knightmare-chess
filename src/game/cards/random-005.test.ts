import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { checkState, digest, type RandomTrace } from './random-campaign.js';

// Rules §§8.3, 11.6 and 17: taking back an illegal underlying move restores
// its reversible Continuing Effects and disposition, while the failed card stays spent.
// Review stops at the first discrepancy. Actions 48–107 are not approved.
const reviewed = [
  '1. Assassin moves Qd1-d2 one clear orthogonal square, captures its own d2 Pawn, consumes the replacement move, resets the capture clock, and draws Mystic Shield once; neither King is attacked.',
  '2. White closes the consumed Assassin move; Black receives a fresh card allowance, with board, clocks, and cards unchanged.',
  '3. Black f7-f6 is one forward empty square, resets the Pawn clock, advances fullmove to 2, and leaves e8 safe.',
  '4. Black ends its completed move; White begins with no extra draw or board change.',
  '5. White a2-a4 crosses empty a3, resets the Pawn clock and records a3 en passant for that physical Pawn; no King line opens.',
  '6. White ends its turn while retaining the immediately available a3 en-passant opportunity for Black.',
  '7. Black e7-e5 crosses empty e6, replaces the old en-passant opportunity with e6, and advances fullmove to 3.',
  '8. Black ends the move without altering the e6 en-passant opportunity, board, or hands.',
  '9. White e2-e3 is a quiet one-square Pawn advance; it clears the expired e6 opportunity and keeps e1 safe.',
  '10. White ends its completed move and gives Black the before-move window without spending or drawing cards.',
  '11. Black h7-h5 crosses empty h6; the Pawn move sets h6 en passant and advances fullmove to 4.',
  '12. Black closes the turn; the h6 en-passant opportunity persists through the turn boundary.',
  '13. White Qd2-d3 is a clear one-square file move; it expires en passant and increments the quiet clock to 1.',
  '14. White closes Qd3 with no additional move, card, or clock change.',
  '15. Black Bf8-d6 traverses empty e7 to empty d6; e8 stays safe and the quiet clock becomes 2/fullmove 5.',
  '16. Black closes Bd6; hands and board remain unchanged while White receives its move.',
  '17. White Ke1-d2 enters an empty unattacked adjacent square, revokes both White castling rights, and increments the quiet clock.',
  '18. Truce is legal after White moves; it is retained as a Continuing Effect, prevents capture, draws Earthquake once, and preserves the board and clocks.',
  '19. White ends the turn with Truce retained and both card allowances reset for Black.',
  '20. Black b7-b6 is a noncapture allowed by Truce, clears the Pawn clock, and leaves both Kings without a geometric check.',
  '21. Black closes b6 without changing Truce or drawing cards.',
  '22. White Qd3-e4 moves one empty diagonal square without capture; no King is checked and Truce remains active.',
  '23. White ends Qe4 with Truce, clocks, and hands unchanged.',
  '24. Black a7-a5 crosses empty a6 and makes no capture under Truce; a6 en passant is recorded, clock reset, fullmove becomes 7.',
  '25. Black ends a5 while preserving the a6 en-passant opportunity and Truce.',
  '26. White Ng1-f3 makes an ordinary Knight jump to an empty square under Truce; old en passant expires and the quiet clock becomes 1.',
  '27. White ends Nf3, keeping Truce and the physical Knight identity intact.',
  '28. Black Ra8-a7 moves to the vacated empty square; queenside castling is revoked and the quiet clock becomes 2/fullmove 8.',
  '29. Black closes Ra7 with only the existing kingside castling right retained.',
  '30. White Qe4-d4 moves one clear rank square without capture under Truce and increments the quiet clock to 3.',
  '31. White ends Qd4; Truce and all card zones remain unchanged.',
  '32. Black Bc8-a6 traverses empty b7 to empty a6 without capture; Truce remains and fullmove advances to 9.',
  '33. Black closes Ba6 and resets card allowances without changing any piece or clock.',
  '34. White Qd4-g4 traverses empty e4 and f4 to empty g4; Truce permits this quiet slide and the quiet clock becomes 5.',
  '35. White closes Qg4, retaining the Truce and unchanged hands.',
  '36. Masquerade legally selects the non-Pawn Black King, moves e8-f8 to an empty safe square with Queen geometry, consumes the move, revokes castling, and draws Merciless once.',
  '37. Black closes its Masquerade replacement; Truce persists and White gets the next move.',
  '38. White Qg4-e6 crosses empty f5 to empty e6 without capture; it does not attack f8, so Truce remains and the quiet clock becomes 7.',
  '39. White closes Qe6 without changing Truce, hands, or clocks.',
  '40. Black e5-e4 moves one forward empty square under Truce; it resets the Pawn clock and advances fullmove to 11.',
  '41. Black ends e4 with Truce still active; the Pawn does not yet geometrically attack White Kd2.',
  '42. White c2-c4 crosses empty c3 without capture; it records c3 en passant and resets the Pawn clock.',
  '43. White closes c4 and preserves its immediate en-passant opportunity through the turn boundary.',
  '44. Black Ba6-b5 moves one diagonal square to empty b5; White c4 blocks its diagonal toward d3, so Truce remains and en passant expires.',
  '45. Black closes Bb5 with Truce retained and White Kd2 safe; this is the complete pre-move rollback baseline.',
  '46. White Kd2-d3 provisionally enters the attack of Black Pe4; Truce ends on that geometric check and a same-turn card rescue remains mandatory, so the turn cannot yet end.',
  '47. Earthquake cannot rescue Kd3 because the rotated Black Pe4 still attacks d3; its failed effect must restore the underlying King move and its Truce expiry, while spending and replacing only Earthquake. Observed discrepancy: the King and clocks return, but Truce stays discarded.',
];

test('iteration 005: failed rescue restores Truce expired by the taken-back King move', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/005.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(reviewed.length, 47);
  reviewed.forEach((reason, index) => assert.ok(reason.startsWith(`${index + 1}. `)));
  let state = createGameState(trace.initial);
  for (const [index, step] of trace.steps.slice(0, 45).entries()) {
    const result = applyAction(state, step.action);
    assert.ok(result.ok, reviewed[index]);
    state = result.state;
    checkState(state);
    assert.equal(digest(state), step.expected, reviewed[index]);
  }
  const beforeMove = state;
  const moved = applyAction(beforeMove, trace.steps[45]!.action);
  assert.ok(moved.ok, reviewed[45]);
  assert.ok(moved.state.pendingRescue);
  assert.equal(digest(moved.state), trace.steps[45]!.expected);
  const attemptedRescue = applyAction(moved.state, trace.steps[46]!.action);
  assert.ok(attemptedRescue.ok, reviewed[46]);
  const after = attemptedRescue.state;
  checkState(after);
  assert.deepEqual(after.pieces, beforeMove.pieces, 'the illegal King move and rotation are undone');
  assert.equal(after.fen, beforeMove.fen, 'the canceled move must not advance clocks');
  assert.equal(after.turn.phase, 'beforeMove');
  assert.equal(after.turn.moveMade, false);
  assert.equal(after.turn.cardPlays.white, 1, 'Earthquake remains spent');
  assert.equal(after.players.white.deck.length, beforeMove.players.white.deck.length - 1);
  assert.deepEqual(after.effects, beforeMove.effects, reviewed[46]);
  assert.deepEqual(after.players.white.discard.map(card => card.cardId), ['assassin', 'earthquake']);
});
