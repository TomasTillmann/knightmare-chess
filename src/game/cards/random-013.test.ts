import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { checkState, digest, type RandomTrace } from './random-campaign.js';

const trace: RandomTrace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/013.json', import.meta.url), 'utf8'));

// Review stops at the first invalid transition; generated actions 19–119 are unreviewed.
// Authority: rules §§8–11, 17.3, 22.7; cards.md; KC11_card3/4, KC5_card1, KC16_card3 artwork.
const rationale = [
  '1. White f2-f3 advances one square into vacancy; no capture, promotion or self-check; pawn clock resets and the board side becomes Black.',
  '2. White ends its completed safe move; Black receives beforeMove, both card allowances reset, with no board or hand change.',
  '3. Black e7-e5 crosses empty e6 to empty e5; e6 is the immediate en-passant target, pawn clock resets and fullmove becomes 2.',
  '4. Black plays Man-Trap after moving, targeting its occupied e8. The continuing marker stays beside the board and draws Haunting Memories; no discard, movement or en-passant expiry.',
  '5. Black ends its completed turn; White receives beforeMove with the e8 trap and e6 opportunity retained until its move.',
  '6. White a2-a3 advances one into vacancy, leaves its King safe and expires the unused e6 opportunity; no trap arrival or capture.',
  '7. White ends the safe completed turn; Black receives beforeMove, unchanged pieces, effects and hands.',
  '8. Black h7-h5 crosses vacant h6 to h5; its King is safe, h6 becomes the immediate en-passant target and fullmove becomes 3.',
  '9. Black Haunting Memories copies the latest non-unique Man-Trap in its afterMove timing; occupied own a8 is eligible. Its physical copy supplies a second continuing marker and draws Charge without discarding the copy.',
  '10. Black ends the completed turn; White starts with both traps retained and h6 opportunity available until its move.',
  '11. White Dubbing replaces its move: original d2 Pawn jumps two files and one rank to vacant b3 without capture. Identity stays Pawn, no promotion, both Kings safe; discard Dubbing, draw Haunting Memories, expire h6.',
  '12. White ends the replacement move; Black starts with no extra White move or retained card allowance.',
  '13. Black Nb8-a6 is a normal Knight jump to vacancy; no trap triggers, King remains safe, halfmove becomes 1 and fullmove becomes 4.',
  '14. Black ends the safe Knight move; White starts with all physical resources unchanged.',
  '15. White Qd1xd7 follows clear d2,d3,d4,d5,d6 after Dubbing vacated d2. It captures the original Black d7 Pawn and checks Ke8 diagonally; White Ke1 remains safe and capture resets the clock.',
  '16. White ends the legal checking move; Black gets its escape turn, with Qd7 uncaptured and both Black traps still present.',
  '17. Black g7-g6 is geometrically clear but does not answer Qd7 check. This is only a provisional move under §11.6: pendingRescue must remain set, and the turn cannot finish in this position.',
  '18. FINDING: White explicitly submits its own Plots physical card during the provisional Black move. Whatever the permitted response/fizzle resolution, it cannot spend Black Charge, draw from Black deck or consume Black allowance. Observed output does all three and leaves White Plots in hand. Rules §§8.5,9,17.3 require expenditure to follow the player and physical card actually played.',
];

function reviewedPrefix() {
  let state = createGameState(trace.initial);
  for (const [index, step] of trace.steps.slice(0, 17).entries()) {
    const before = digest(state);
    const result = applyAction(state, step.action);
    assert.equal(digest(state), before, `action ${index + 1}: immutable input`);
    assert.ok(result.ok, rationale[index]);
    state = result.state;
    checkState(state);
    assert.equal(digest(state, 1), step.expected, `reviewed action ${index + 1}`);
  }
  return state;
}

test('iteration 013: seventeen reviewed actions reach a provisional checked Black turn', () => {
  assert.equal(rationale.length, 18);
  assert.equal(trace.steps.slice(0, 18).filter(step => step.action.type === 'move').length, 7);
  assert.equal(trace.steps.slice(0, 18).filter(step => step.action.type === 'playCard').length, 4);
  const state = reviewedPrefix();
  assert.equal(state.fen, 'r1bqkbnr/pppQ1p2/n5p1/4p2p/8/PP3P2/1PP1P1PP/RNB1KBNR w KQkq - 0 5');
  assert.deepEqual(state.turn, { color: 'black', phase: 'afterMove', moveMade: true, cardPlays: { white: 0, black: 0 } });
  assert.ok(state.pendingRescue);
  assert.equal(state.outcome, null);
  assert.deepEqual(state.enPassant, []);
  assert.deepEqual(state.pieces.filter(piece => piece.zone !== 'board').map(piece => [piece.id, piece.zone]), [['black-pawn-d7', 'captured']]);
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-d2')?.square, 'b3');
  assert.equal(state.pieces.find(piece => piece.id === 'white-queen-d1')?.square, 'd7');
  assert.equal(state.pieces.find(piece => piece.id === 'black-king-e8')?.square, 'e8');
  assert.deepEqual(state.effects, [
    { type: 'man-trap', owner: 'black', card: { id: 'black-hand-2-man-trap', cardId: 'man-trap' }, square: 'e8' },
    { type: 'man-trap', owner: 'black', card: { id: 'black-deck-0-haunting-memories', cardId: 'haunting-memories' }, square: 'a8' },
  ]);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), ['plots-within-plots', 'abduction', 'hostage', 'knightmare', 'haunting-memories']);
  assert.deepEqual(state.players.black.hand.map(card => card.cardId), ['vendetta', 'mystic-shield', 'crab', 'rebirth', 'charge']);
  assert.deepEqual([state.players.white.deck.length, state.players.black.deck.length], [74, 73]);
  assert.deepEqual(state.players.white.discard.map(card => card.cardId), ['dubbing']);
  assert.deepEqual(state.players.black.discard, []);
});

test('iteration 013 finding: White Plots cannot spend Black Charge during pending rescue', () => {
  const before = reviewedPrefix();
  const action = trace.steps[17]!.action;
  assert.deepEqual(action, { type: 'playCard', cardId: 'plots-within-plots', cardInstanceId: 'white-hand-0-plots-within-plots', target: { player: 'white' } });
  const result = applyAction(before, action);
  // Independent of whether a mandatory rescue rejects this reaction, the opponent never pays for it.
  assert.deepEqual(result.state.players.black, before.players.black, rationale[17]);
  assert.equal(result.state.turn.cardPlays.black, 0);
  if (!result.ok) assert.deepEqual(result.state, before, 'rejection is atomic');
  else {
    assert.ok(result.state.players.white.discard.some(card => card.id === 'white-hand-0-plots-within-plots'));
    assert.equal(result.state.players.white.deck.length, 73);
    assert.equal(result.state.turn.cardPlays.white, 1);
  }
});
