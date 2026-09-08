import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Chess } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Independently reviewed in order against rules §§8–11, cards.md and all seven
// played cards' artwork. End-turn rows neither draw nor advance the FEN clock.
const rationales = `
1. h2-h4 crosses vacant h3; initial pawn double step, h3 en-passant opportunity.
2. White ends; Black acts, h3 opportunity survives, no card or board change.
3. a7-a6 single forward pawn step; h3 opportunity expires, pawn clock resets.
4. Black ends; White acts without a draw or board change.
5. Ng1-h3 is a noncapturing knight jump, e1 remains shielded.
6. White ends; Black acts, no card allowance was spent.
7. Ng8-h6 jumps to an empty square; neither King is exposed.
8. Black ends; White acts, board and hands fixed.
9. f2-f3 is a single forward pawn step, no promotion or capture.
10. White ends; Black acts, no replacement draw is due.
11. Nh6-g4 jumps to empty g4; it attacks e3/f2/e5/f6/h2/h6, not e1.
12. Black ends; White acts with e1 safe.
13. c2-c4 crosses vacant c3, creates c3 en-passant opportunity.
14. White ends; Black acts retaining c3 opportunity.
15. Long Jump replaces Black move: b8 light to vacant e4 dark; knight identity preserved, no capture; spend/discard/draw Crusade.
16. Black ends after replacement move, reset card allowances, White acts.
17. f3-f4 advances one into vacancy; adjacent black knights do not prevent a pawn advance.
18. White ends with King safe, Black acts.
19. h7-h5 crosses vacant h6; h6 en-passant opportunity, no promotion.
20. Black ends; White acts retaining h6 opportunity.
21. d2-d4 crosses vacant d3; replace h6 opportunity with d3.
22. White ends; Black acts retaining d3 opportunity.
23. Ng4-e3 jumps into vacancy; d3 opportunity expires, no check on e1.
24. Black ends; White acts with e1 safe.
25. Nh3-g1 returns to empty starting square; no castling right change.
26. White ends; Black acts, no hand change.
27. Ra8-a7 moves one into vacancy; Black queenside castling right is lost.
28. Black ends; White acts, kingside black right remains.
29. Qd1-b3 passes vacant c2 and lands empty; c1/e2 still block attacks on e1.
30. White ends; Black acts, board fixed.
31. c7-c5 passes vacant c6; c6 en-passant opportunity is recorded.
32. Black ends; White acts retaining c6 opportunity.
33. Qb3-b4 advances one along clear file; c6 opportunity expires.
34. White ends; Black acts, board and hands fixed.
35. g7-g5 crosses vacant g6; g6 en-passant opportunity replaces none.
36. Black ends; White acts retaining g6 opportunity.
37. Qb4-b3 returns one into vacancy; g6 opportunity expires.
38. White ends; Black acts, no draw.
39. f7-f6 advances one; queen b3 cannot attack e8 through other pieces.
40. Black ends; White acts, board unchanged.
41. g2-g4 crosses vacant g3; create g3 opportunity, e1 remains safe.
42. White ends; Black acts retaining g3 opportunity.
43. Rh8-g8 slides one into vacancy; last black castling right lost, g3 expires.
44. Black ends; White acts, no card played.
45. Nb1-c3 jumps into vacancy; identity and both White rights survive.
46. Crab after White move marks own pawn g4 without relocation; continuing card stays active, draw Fatal Attraction.
47. White ends; Black acts with Crab still attached to original g2 pawn.
48. g5xf4 captures original f2 pawn diagonally; g4 Crab remains and gives no royal check.
49. Black ends; White acts, captured pawn stays captured.
50. Rh1-h2 enters vacant h2; White kingside right lost, queenside remains.
51. White ends; Black acts, Crab unchanged.
52. Qd8-a5 crosses vacant c7/b6; c3 knight blocks the a5-e1 diagonal.
53. Black ends; White acts safely behind c3 blocker.
54. Rh2-f2 crosses vacant g2; no capture, Crab remains g4.
55. White ends; Black acts with both Kings safe.
56. Ne3xg4 captures Crab pawn; remove marker and discard Crab, preserve captured pawn identity.
57. Black ends; White acts with no active Crab.
58. Qb3-b5 passes vacant b4; noncapture, own King stays safe.
59. White ends; Black acts; attacked queen need not escape.
60. a6xb5 captures White queen diagonally; pawn identity a7 survives.
61. Black ends; White acts, queen remains captured.
62. Bc1-d2 enters empty adjacent diagonal; c3 still blocks black queen line.
63. White ends; Black acts, no card change.
64. Ne4xf2 captures White h1 rook by knight jump; e1 is not attacked by f2 knight.
65. Black ends; White acts with King safe.
66. d4xc5 captures black c7 pawn diagonally; original d2 pawn now c5.
67. White ends; Black acts, captured pawn remains unavailable.
68. Ke8-f7 steps diagonally into vacancy outside White attacks, no castling rights remain for Black.
69. Black ends; White acts safely.
70. Nc3xb5 captures original a7 pawn; bishop d2 still blocks Qa5-e1 diagonal.
71. White ends; Black acts, king e1 remains shielded by bishop d2.
72. Qa5-a6 slides one into vacancy, no capture.
73. Curse after Black move legally marks opposing rook a1; continuing effect, draw Guardian, no board change.
74. Black ends; White acts with a1 rook limited to two squares.
75. Bf1-g2 enters vacant diagonal square, e1 remains safe.
76. White ends; Black acts, Curse persists.
77. Guardian replaces Black move: d7-d6 single pawn advance; d8 empty means no follower, no en-passant; discard/draw Winged Victory.
78. Black ends after replacement move; White acts, Curse remains.
79. Hidden Passage replaces White move: King e1-f3 to empty safe square; f4 pawn attacks e3/g3, not f3; lose remaining castling right, draw Fortification.
80. White ends; Black acts with f3 safe and no castling rights.
81. Kf7-g7 steps into empty square; g2 bishop diagonal meets own King f3, and no White unit attacks g7.
82. Black ends; White acts, king f3 remains safe.
83. Nb5xa7 captures Black a8 rook by knight jump; King f3 unaffected.
84. White ends; Black acts, captured rook remains captured.
85. b7-b5 crosses b6; white pawn c5 can capture en-passant on b6, so FEN includes b6.
86. Black ends; White acts retaining actual b6 en-passant chance.
87. Bd2-e1 returns diagonally to vacancy; declining en-passant expires b6.
88. White ends; Black acts, hands fixed.
89. Nf2-d1 jumps into vacancy; no attack on f3 by d1 knight.
90. Black ends; White acts, no draw.
91. Na7-c6 jumps into vacancy; f3 safe, c6 attacks e7/d8/b8/a7/a5/b4/d4/e5.
92. White ends; Black acts safely on g7.
93. Qa6xa2 crosses vacant a5/a4/a3 and captures White a2 pawn; f3 not on queen line.
94. Black ends; White acts, captured a2 pawn stays captured.
95. Be1-b4 crosses empty d2/c3; own King f3 remains safe.
96. White ends; Black acts, no card change.
97. Bc8-d7 moves one diagonal into vacancy; g7 King is safe.
98. Black ends; White acts, board unchanged.
99. Ra1xa2 captures Black queen with one-square rook move, within Curse limit; marker follows identity.
100. Abduction after White move conceals opposing nonroyal b5 pawn in away zone; spend/discard/draw Annexation, no clock advance.
101. Reveal opens recall phase only; b5 pawn stays away, no turn or hand change.
102. Black correctly recalls black pawn b5 and identity b7; restore same pawn on b5, no capture or clock advance.
103. White ends only after recall resolved; Black acts, board restored.
104. Kg7-g6 steps into vacancy; bishop b4 is blocked by own c5 pawn, knight c6 does not attack g6.
105. Black ends; White acts, board and Curse fixed.
106. Kf3-g3 steps into f4 pawn attack provisionally (§11.6); Fatal Attraction in hand supplies same-turn rescue, endTurn is forbidden now.
107. Fatal Attraction marks own King g3 after move; freezes adjacent f4 pawn and g4 knight plus own g2 bishop/h4 pawn, suppressing f4-g3 check (§11.7); draw Onslaught.
108. White ends after rescue; Black acts, magnet persists and frozen units cannot move.
109. Kg6-h6 steps into vacancy; Kings are exempt from magnet, no White unit attacks h6.
110. Black ends; White acts, magnet remains on g3 and turn allowances reset.
111. Kg3xf4 captures pawn in adjacent square; moving magnet ends Fatal Attraction, g4 knight does not attack f4 and all black bishop lines are blocked; discard effect.
112. White ends with f4 safe; Black acts, Curse is sole effect and no draw is due.
`.trim().split('\n');

test('iteration 052 deterministic trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/052.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860052);
  assert.equal(trace.steps.length, 112);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 7);
  assert.ok(replayTrace(trace));

  let state = createGameState(trace.initial);
  for (const [i, { action }] of trace.steps.entries()) {
    const n = i + 1;
    assert.ok(rationales[i]!.startsWith(`${n}. `));
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationales[i]);
    state = result.state;
    const cardMoveFens: Record<number, string> = {
      15: 'r1bqkb1r/1ppppppp/p7/8/2P1n1nP/5P1N/PP1PP1P1/RNBQKB1R w KQkq - 1 5',
      77: '2b2br1/rp2pk2/q2p1p2/1NP4p/2P2pnP/8/PP1BPnB1/R3K1N1 w Q - 0 20',
      79: '2b2br1/rp2pk2/q2p1p2/1NP4p/2P2pnP/5K2/PP1BPnB1/R5N1 b - - 1 20',
      100: '5br1/3bp1k1/2Np1p2/2P4p/1BP2pnP/5K2/RP2P1B1/3n2N1 b - - 0 25',
      102: '5br1/3bp1k1/2Np1p2/1pP4p/1BP2pnP/5K2/RP2P1B1/3n2N1 b - - 0 25',
      106: '5br1/3bp3/2Np1pk1/1pP4p/1BP2pnP/6K1/RP2P1B1/3n2N1 b - - 2 26',
      109: '5br1/3bp3/2Np1p1k/1pP4p/1BP2pnP/6K1/RP2P1B1/3n2N1 w - - 3 27',
    };
    if (cardMoveFens[n]) assert.equal(state.fen, cardMoveFens[n], rationales[i]);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const mover = before.pieces.find(p => p.square === action.from)!;
      const victim = before.pieces.find(p => p.square === action.to);
      assert.deepEqual(state.pieces, before.pieces.map(p => p.id === mover.id
        ? { ...p, square: action.to }
        : p.id === victim?.id ? { ...p, square: null, zone: 'captured', capturedBy: before.turn.color } : p), rationales[i]);
      assert.deepEqual(state.players.white.hand, before.players.white.hand);
      assert.deepEqual(state.players.black.hand, before.players.black.hand);
      if (n < 106) {
        // Crab never moves; its forward capture geometry is unchanged. Curse
        // affects only a1 rook, whose sole move is the one-square capture at 99.
        const chess = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap();
        const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! };
        assert.ok(chess.isLegal(move), rationales[i]);
        chess.play(move);
        assert.equal(state.fen, makeFen(chess.toSetup()), rationales[i]);
      } else {
        assert.equal(mover.role, 'king');
        assert.equal(Math.max(Math.abs(action.from.charCodeAt(0) - action.to.charCodeAt(0)),
          Math.abs(Number(action.from[1]) - Number(action.to[1]))), 1);
      }
    } else if (action.type === 'endTurn') {
      assert.equal(state.fen, before.fen);
      assert.deepEqual(state.pieces, before.pieces);
      assert.deepEqual(state.players, before.players);
      assert.deepEqual(state.effects, before.effects);
      assert.deepEqual(state.enPassant, before.enPassant);
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white',
        phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
    } else if (action.type === 'playCard') {
      const player = before.turn.color;
      const card = before.players[player].hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(card);
      assert.equal(before.turn.cardPlays[player], 0);
      assert.equal(state.turn.cardPlays[player], 1);
      assert.deepEqual(state.players[player].hand, [...before.players[player].hand.filter(c => c.id !== card.id), before.players[player].deck[0]]);
      assert.deepEqual(state.players[player].deck, before.players[player].deck.slice(1));
      assert.equal(state.turn.phase, 'afterMove');
      assert.equal(state.turn.moveMade, true);
      const effectTargets: Record<string, string> = { crab: 'white-pawn-g2', curse: 'white-rook-a1', 'fatal-attraction': 'white-king-e1' };
      if (effectTargets[card.cardId]) {
        assert.equal(before.turn.phase, 'afterMove');
        assert.equal(state.fen, before.fen);
        assert.deepEqual(state.pieces, before.pieces);
        assert.deepEqual(state.effects, [...before.effects, { type: card.cardId, owner: player, card, pieceId: effectTargets[card.cardId] }]);
        assert.deepEqual(state.players[player].discard, before.players[player].discard);
      } else {
        assert.deepEqual(state.players[player].discard, [...before.players[player].discard, card]);
        const relocation: Record<number, [string, string | null]> = { 15: ['black-knight-b8', 'e4'], 77: ['black-pawn-d7', 'd6'], 79: ['white-king-e1', 'f3'], 100: ['black-pawn-b7', null] };
        const [id, square] = relocation[n]!;
        assert.deepEqual(state.pieces, before.pieces.map(p => p.id === id ? { ...p, square, zone: square ? 'board' : 'away' } : p));
        assert.equal(before.turn.phase, n === 100 ? 'afterMove' : 'beforeMove');
        assert.deepEqual(state.effects, before.effects);
        assert.deepEqual(state.enPassant, []);
      }
    }
    if (n === 56) {
      assert.deepEqual(state.effects, []);
      assert.deepEqual(state.players.white.discard.map(c => c.cardId), ['crab']);
    }
    if (n === 99) assert.equal(state.pieces.find(p => p.id === 'white-rook-a1')!.square, 'a2');
    if (n === 100 || n === 101) {
      assert.equal(state.pendingAbduction?.phase, n === 100 ? 'concealment' : 'recall');
      assert.equal(state.pieces.find(p => p.id === 'black-pawn-b7')!.zone, 'away');
    }
    if (n === 101) { assert.equal(state.fen, before.fen); assert.deepEqual(state.players, before.players); }
    if (n === 102) {
      assert.equal(state.pendingAbduction, null);
      assert.deepEqual(state.pieces, before.pieces.map(p => p.id === 'black-pawn-b7' ? { ...p, square: 'b5', zone: 'board' } : p));
      assert.deepEqual(state.players, before.players);
      assert.deepEqual(state.turn, before.turn);
    }
    assert.equal(!!state.pendingRescue, n === 106);
    if (n === 106) assert.equal(applyAction(state, { type: 'endTurn' }).ok, false);
    if (n === 108) {
      const moves = legalDests(state);
      assert.deepEqual(moves.get('f4') ?? [], []);
      assert.deepEqual(moves.get('g4') ?? [], []);
      assert.ok(moves.get('g6')?.includes('h6'));
    }
    if (n === 111) {
      assert.deepEqual(state.effects, [{ type: 'curse', owner: 'black', card: { id: 'black-hand-2-curse', cardId: 'curse' }, pieceId: 'white-rook-a1' }]);
      assert.deepEqual(state.players.white.discard.map(c => c.cardId), ['crab', 'hidden-passage', 'abduction', 'fatal-attraction']);
    }
  }
  assert.equal(state.fen, '5br1/3bp3/2Np1p1k/1pP4p/1BP2KnP/8/RP2P1B1/3n2N1 b - - 0 27');
});
