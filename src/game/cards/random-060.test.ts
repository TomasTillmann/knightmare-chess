import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { attacks } from 'chessops/attacks';
import { parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Independently reviewed against rules §§8–13,16,22 and the printed catalog.
// Legacy and Doppelganger artwork also confirms their capture/replacement timing.
const rationales = `
1. d2-d3 is one clear forward pawn step; neither King is exposed.
2. White ends its completed move; Black receives a fresh allowance.
3. b7-b6 is one clear black pawn step and resets the pawn clock.
4. Black ends; White starts without changing the board or hands.
5. Bc1-f4 traverses empty d2 and e3; the diagonal is clear.
6. White ends its bishop turn; Black starts.
7. h7-h5 crosses empty h6; the original pawn gains an h6 en-passant opportunity.
8. Black ends and retains that opportunity for White's reply.
9. Ke1-d2 enters an unattacked empty square; White loses both castling rights and h6 expires.
10. White ends with its King safe on d2.
11. Bc8-b7 enters the square vacated by the b-pawn.
12. Black ends; no capture, effect or card accounting occurs.
13. b2-b3 is an unobstructed forward step.
14. White ends; Black starts with a fresh move.
15. Nb8-a6 is a knight jump to an empty square.
16. Black ends after Na6; no cards are drawn without a play.
17. Ng1-f3 is a knight jump; it does not expose Kd2.
18. White ends after Nf3; Black starts.
19. Na6-c5 is a clear-destination knight jump.
20. Black ends after Nc5; White starts.
21. h2-h4 crosses empty h3 and stops before the black h5 pawn; h3 is the en-passant target.
22. White ends; h3 remains available for the immediate reply.
23. g7-g6 advances one; the unused h3 opportunity expires.
24. Black plays Fortification after moving, placing the persistent wall between adjacent d2/d3; draw Plots.
25. Black ends; the wall persists and allowances reset.
26. Bf4-g5 moves diagonally to empty g5 without crossing the wall.
27. White ends; no persistent effect expires.
28. Ra8-c8 crosses empty b8 and relinquishes Black's queenside castling right.
29. After Rc8, Black starts Truce with neither King geometrically checked; draw Cathedral.
30. Black ends; Truce and the wall remain active.
31. Doppelganger copies the last moved rook despite intervening Truce; Bg5-f5 is a noncapturing rook step replacing White's move.
32. Black may react with Plots; no extra card is obligatory and Fanatic is the replacement draw.
33. White ends, closing unused Plots permissions; Black gets its normal allowance.
34. Fanatic sends g6-g3 through empty g5/g4/g3 without capture, promotion or en-passant; it replaces Black's move.
35. Black ends its Fanatic turn; White starts.
36. Rh1-h3 crosses empty h2, stopping before h4; Truce allows this noncapture.
37. White ends after Rh3; both continuing effects persist.
38. Bf8-h6 crosses empty g7; its h6-g5-f4-e3-d2 line checks White and terminates Truce.
39. Black plays Cowardice after moving: White's g2 pawn retreats to vacant g1 without promotion; draw Knightmare.
40. Black ends; White begins in the bishop's check.
41. Bf5-g6 does not answer Bh6's check on Kd2; §11.6 permits only a pending same-turn card rescue.
42. Dungeon relocates enemy Bh6 to empty a8, breaking that check and freezing this bishop for Black's following turn; draw Assassin.
43. White ends only after Dungeon has restored King safety.
44. Nc5xb3 captures the white b-pawn and gives a knight check to Kd2; the imprisoned bishop stays a8.
45. Black ends its following turn, expiring Dungeon's movement restriction.
46. Kd2-e1 escapes Nb3's check to an unattacked adjacent square.
47. White ends with its royal safely on e1.
48. Ng8-f6 jumps to empty f6 without exposing Ke8.
49. Black ends after Nf6; White starts.
50. Qd1-d2 moves one orthogonal square and does not cross the d2/d3 wall.
51. Black's immediate Knightmare rewinds Qd2, clocks and side to move; Black spends its response and White must choose differently.
52. c2-c4 through empty c3 is a different move; c3 gains the immediate en-passant opportunity.
53. White ends its replacement move; Black's response allowance resets.
54. Nf6-e4 is a knight jump; the c3 opportunity expires unused.
55. Black ends after Ne4 with both Kings safe.
56. a2-a3 is a single clear forward pawn move.
57. White ends after a3; Black starts.
58. Nb3-d2 is a knight jump that does not cross the wall and does not check Ke1.
59. Black ends after Nd2; White starts.
60. Nf3-d4 jumps to empty d4; the e2 pawn still shields Ke1.
61. White ends after Nd4; no card accounting changes.
62. e7-e6 advances one onto an empty square without exposing Black's King.
63. Black ends; White starts with Evil Eye available.
64. Evil Eye uses Nb1's legal knight threat on enemy Nd2, capturing that knight without moving Nb1; it replaces the move and draws Masquerade.
65. White ends its completed Evil Eye replacement move.
66. Qd8-f6 passes through empty e7 diagonally.
67. Black ends after Qf6; White starts.
68. f2-f4 crosses vacant f3, establishes f3 en-passant and leaves Ke1 safe behind e2.
69. White ends; the f3 opportunity is retained for Black's reply.
70. Bb7-d5 passes through empty c6; the f3 opportunity expires.
71. Black ends after Bd5; White starts.
72. Qd1-d2 is legal again because Knightmare prohibited that move only during its canceled turn.
73. White ends; the queen is not forced across the d2/d3 wall.
74. Bd5xc4 captures the white c-pawn diagonally.
75. Cathedral swaps Black's Rc8 and Bc4 without capture after the move; both identities survive and Lost Castle is drawn.
76. Black ends with Rc4 and Bc8 in their swapped locations.
77. Assassin makes Nb1xa3 capture its own white a-pawn by ordinary knight geometry; consumes the move and draws Treason.
78. White ends the Assassin replacement move.
79. f7xg6 legally captures White's bishop on the forward diagonal; the original f-pawn now occupies g6.
80. Black ends after the capture; White starts.
81. White's g1 pawn advances to vacant g2; owner first-rank pawns retain normal forward movement.
82. White ends after g2; Black starts.
83. Qf6-g5 takes one diagonal step to an empty square.
84. Black ends after Qg5; White starts.
85. Ra1-c1 passes through empty b1 and stops on vacant c1.
86. Mystic Shield protects exactly the just-moved white rook identity on c1 for Black's next turn; draw Fog of War.
87. White ends; the shield must remain for the upcoming Black turn.
88. Ne4-d6 jumps to empty d6; it does not capture the protected rook.
89. Peace Talks removes Black's own active Fortification, discarding both cards and drawing Doomsayer; Mystic Shield remains.
90. Black ends; Mystic Shield expires after protecting the rook for the whole opposing turn.
91. h4xg5 captures Black's queen with a normal forward pawn diagonal.
92. White ends after the queen capture; Black starts.
93. a7-a6 is a clear one-square pawn move.
94. Black ends after a6; White starts.
95. Qd2-c2 moves horizontally to empty c2; Ke1 remains protected.
96. White ends after Qc2; Black starts.
97. c7-c6 advances into an empty square.
98. Black ends after c6; White starts.
99. Nd4xe6 captures the black e-pawn by knight jump; Ke8 is not checked by Ne6.
100. Revenge is Black's after-opponent-move reaction, capturing White's f4 pawn without moving any attacker; draw Coup.
101. White ends; Black's own-turn card allowance refreshes despite its Revenge reaction.
102. Rh8-h7 moves to vacant h7 and removes Black's remaining castling right.
103. Black ends after Rh7; no castling rights remain.
104. Na3xc4 captures Black's rook with knight geometry.
105. White ends after Nxc4; Black starts.
106. Nd6xc4 recaptures the white knight; this actual non-Pawn capture opens White's Legacy window.
107. Legacy retrieves the exact Dungeon discard identity and independently draws Forbidden City, making a six-card white hand; no board or clock change.
108. Black plays Coup after its move, making the safe g6 pawn royal and demoting Ke8 to Prince; draw Dubbing and retain Coup in play.
109. Black ends; the royal pawn stays g6 with normal pawn movement.
110. Rh3-h1 crosses vacant h2; neither White's King nor Black's g6 royal is attacked by that move.
111. White ends after Rh1; Black starts.
112. Dubbing lets Black's d7 pawn jump to empty c5 like a knight without capture, replacing the move; draw Crab.
113. Black ends its Dubbing move; the g6 royal stays safe.
114. Masquerade gives Bf1 a noncapturing queen move through empty f2 to f3; draw Dubbing and consume White's move.
115. White ends its Masquerade move; Black starts.
116. Bc8xe6 crosses empty d7 and captures White's remaining knight without exposing the g6 royal.
117. Black ends after Bxe6; White starts.
118. Rc1-d1 is a single clear orthogonal step with White's King safe on e1.
119. White ends after Rd1; Black starts.
120. Nc4-e3 jumps to empty e3; it threatens d1 and g2 but not Ke1.
121. Crab marks Black's h5 pawn after moving, preserving its identity and position; draw Dungeon and retain the continuing card.
122. Black ends; Coup and Crab both persist.
123. Qc2-a4 traverses empty b3; neither the e3 knight nor any black bishop attacks Ke1.
124. White ends its fiftieth regular move; Black begins with only Coup and Crab active.
`.trim().split('\n');

test('iteration 060: 124 independently reviewed actions, including 50 regular moves', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/060.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860060);
  assert.equal(rationales.length, 124);
  assert.equal(trace.steps.length, rationales.length);
  rationales.forEach((rationale, i) => assert.ok(rationale.startsWith(`${i + 1}. `)));
  let state = createGameState(trace.initial);
  const expected = state.pieces.map(p => ({ ...p }));
  const at = (square: string) => expected.find(p => p.square === square && p.zone === 'board');
  const move = (from: string, to: string) => {
    const piece = at(from);
    assert.ok(piece, from);
    const victim = at(to);
    if (victim) { victim.zone = 'captured'; victim.square = null; }
    piece.square = to as typeof piece.square;
  };
  const take = (square: string) => {
    const piece = at(square);
    assert.ok(piece);
    piece.square = null;
    piece.zone = 'captured';
  };
  const projection = (pieces: typeof expected) => pieces.map(({ id, owner, role, originalRole, square, zone, royal, promoted, neutral }) =>
    ({ id, owner, role, originalRole, square, zone, royal, promoted, neutral }));
  const fortification = { type: 'fortification', owner: 'black', card: { id: 'black-hand-2-fortification', cardId: 'fortification' }, from: 'd2', to: 'd3' };
  const coup = { type: 'coup', owner: 'black', card: { id: 'black-deck-8-coup', cardId: 'coup' }, princeId: 'black-king-e8', kingId: 'black-pawn-f7', princeRole: 'king' };
  let cards = 0;
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1;
    const note = rationales[index];
    const before = state;
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const mover = at(action.from);
      assert.ok(mover);
      assert.equal(mover.owner, before.turn.color, note);
      const from = parseSquare(action.from)!;
      const to = parseSquare(action.to)!;
      const board = parseFen(before.fen).unwrap().board;
      const victim = at(action.to);
      if (mover.role === 'pawn' && !victim) {
        const distance = (to - from) * (mover.owner === 'white' ? 1 : -1);
        assert.ok(distance === 8 || distance === 16 && [1, 6].includes(from >> 3), note);
        if (distance === 16) assert.ok(!board.has((from + to) / 2), note);
      } else assert.ok(attacks({ role: mover.role, color: mover.owner }, from, board.occupied).has(to), note);
      if (victim) assert.notEqual(victim.owner, mover.owner, note);
      move(action.from, action.to);
    }
    // These operations are the independently expected physical changes for each card.
    if (n === 31) move('g5', 'f5');
    if (n === 34) move('g6', 'g3');
    if (n === 39) move('g2', 'g1');
    if (n === 42) move('h6', 'a8');
    if (n === 51) move('d2', 'd1');
    if (n === 64) take('d2');
    if (n === 75) {
      const rook = at('c8')!;
      const bishop = at('c4')!;
      rook.square = 'c4'; bishop.square = 'c8';
    }
    if (n === 77) move('b1', 'a3');
    if (n === 100) take('f4');
    if (n === 108) { at('e8')!.royal = false; at('g6')!.royal = true; }
    if (n === 112) move('d7', 'c5');
    if (n === 114) move('f1', 'f3');
    const result = applyAction(before, action);
    assert.ok(result.ok, note);
    state = result.state;
    assert.deepEqual(projection(state.pieces), projection(expected), note);
    assert.equal(Boolean(state.pendingRescue), n === 41, note);
    assert.equal(state.orientation, 0, note);
    const effects = [
      ...(n >= 24 && n < 89 ? [fortification] : []),
      ...(n >= 29 && n < 38 ? [{ type: 'truce', owner: 'black', card: { id: 'black-hand-0-truce', cardId: 'truce' } }] : []),
      ...(n >= 42 && n < 45 ? [{ type: 'dungeon', owner: 'white', player: 'black', pieceId: 'black-bishop-f8' }] : []),
      ...(n >= 86 && n < 90 ? [{ type: 'mystic-shield', owner: 'white', player: 'white', pieceId: 'white-rook-a1' }] : []),
      ...(n >= 108 ? [coup] : []),
      ...(n >= 121 ? [{ type: 'crab', owner: 'black', card: { id: 'black-deck-10-crab', cardId: 'crab' }, pieceId: 'black-pawn-h7' }] : []),
    ];
    assert.deepEqual(state.effects, effects, note);
    const ep = n === 7 || n === 8 ? [{ target: 'h6', pawnId: 'black-pawn-h7' }]
      : n === 21 || n === 22 ? [{ target: 'h3', pawnId: 'white-pawn-h2' }]
      : n === 52 || n === 53 ? [{ target: 'c3', pawnId: 'white-pawn-c2' }]
      : n === 68 || n === 69 ? [{ target: 'f3', pawnId: 'white-pawn-f2' }] : [];
    assert.deepEqual(state.enPassant, ep, note);
    // Independent geometric King-safety check; none of this trace's checking lines is pinned.
    const board = parseFen(state.fen).unwrap().board;
    const royal = expected.find(p => p.royal && p.owner === before.turn.color)!;
    const kingSquare = parseSquare(royal.square!)!;
    const checked = expected.some(p => p.zone === 'board' && p.owner !== royal.owner
      && attacks({ role: p.role, color: p.owner }, parseSquare(p.square!)!, board.occupied).has(kingSquare));
    assert.equal(checked, n === 41, note);
    if (action.type === 'endTurn') {
      assert.equal(state.fen, before.fen, note);
      assert.equal(state.turn.color, before.turn.color === 'white' ? 'black' : 'white', note);
      assert.equal(state.turn.moveMade, false, note);
      assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 }, note);
    }
    if (action.type === 'playCard') {
      cards++;
      const player = before.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black';
      const old = before.players[player];
      const current = state.players[player];
      assert.equal(old.deck.length - current.deck.length, 1, note);
      const returned = n === 107 ? [old.discard.find(c => c.id === 'white-hand-1-dungeon')!] : [];
      assert.deepEqual(current.hand, [...old.hand.filter(c => c.id !== action.cardInstanceId), ...returned, old.deck[0]], note);
      assert.equal(state.turn.cardPlays[player], 1, note);
      assert.equal(current.discard.some(c => c.id === action.cardInstanceId), !CARD_CATALOG[action.cardId]!.continuing, note);
    } else if (n === 38) {
      assert.deepEqual(state.players, { ...before.players, black: { ...before.players.black,
        discard: [...before.players.black.discard, { id: 'black-hand-0-truce', cardId: 'truce' }] } }, note);
    } else assert.deepEqual(state.players, before.players, note);
  }
  assert.equal(cards, 19);
  assert.equal(state.fen, 'b3k3/7r/ppp1b1p1/2p3Pp/Q7/3PnBp1/4P1P1/3RK2R b - - 3 28');
  assert.equal(state.players.white.hand.length, 6);
  assert.equal(state.players.black.hand.length, 5);
  assert.equal(replayTrace(trace).fen, state.fen);
});
