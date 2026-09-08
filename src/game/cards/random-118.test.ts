import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, Role, SquareName } from '../types.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/118.json', import.meta.url), 'utf8')) as RandomTrace;

// Rules §§8–13, 16.2, 18.2–3, 22.8; cards.md and printed catalog timing.
// Earthquake, Vulture and Guardian artwork independently confirms their ordering/timing.
// Every row was reviewed in order. These notes are written, not inferred from acceptance.
const rationale = `
1. Ng1-f3 is a quiet Knight jump; both Kings remain safe.
2. White ends its completed move; allowances reset for Black.
3. h7-h5 crosses empty h6; preserve h6 en-passant opportunity.
4. Disintegration after Black's move makes its b7 Pawn dead, not captured; draw Crusade.
5. Black ends; h6 opportunity survives for White's next move.
6. Nb1-c3 is a quiet jump; unused h6 opportunity expires.
7. Charge follows that noncapturing Knight move; Nc3-b1 is its second move, without another clock tick; draw Earthquake.
8. White ends; Black receives one regular move.
9. Bc8-b7 enters the square vacated by the dead Pawn.
10. Black ends; cards and board persist.
11. d2-d3 is one forward Pawn step into an empty square.
12. White ends; no card was played this turn.
13. c7-c6 is one forward Black Pawn step.
14. Black ends; no extra draw is due.
15. Bc1-d2 moves diagonally to the vacated d2 square.
16. White ends; no capture or effect change occurred.
17. f7-f5 crosses empty f6 and creates the f6 opportunity.
18. Black ends; White may use the f6 opportunity on its next move.
19. a2-a3 advances one step; unused f6 opportunity expires.
20. White ends; Black receives its move.
21. g7-g5 crosses empty g6 and creates the g6 opportunity.
22. Black ends; g6 opportunity remains temporarily available.
23. Guardian replaces White's move with d3-d4; following Bd2 is optional and declined; no en passant, draw Resurrection.
24. White ends the replacement move; no regular move follows Guardian.
25. Rh8-h7 moves one square to an empty destination and loses Black's kingside right.
26. Black ends; the lost castling right stays lost.
27. a3-a4 is a one-square Pawn advance.
28. Truce is played after White's move and retained as a Continuing Effect; draw Ghostwalk.
29. White ends; Truce persists because neither King is checked and moves remain.
30. h5-h4 is a quiet Pawn move permitted during Truce.
31. Black ends; no captures occurred to account for.
32. Ghostwalk replaces White's move: Bf1-d3 passes through own Pe2 without capturing; draw Vulture.
33. White ends; Ghostwalk has been spent and grants no continuing power.
34. g5-g4 is a quiet forward Pawn move.
35. Black ends; Truce persists.
36. Nf3-e5 is a quiet Knight jump.
37. White ends; no Pawn move, capture, or effect expiry.
38. Bf8-h6 crosses empty g7 and makes no capture.
39. Black ends; the diagonal move did not check either King.
40. e2-e3 advances the Pawn one square.
41. Dungeon after White's move sends enemy Bb7 to vacant corner h8; that identity is frozen for Black's next turn; draw No Quarter.
42. White ends; Black begins its Dungeon-restricted turn.
43. e7-e6 uses a different piece from the jailed Bishop and is legal.
44. Black ends its following turn; Dungeon's temporary restriction expires.
45. Bd3-e2 takes one diagonal step to the empty square.
46. White ends; Truce remains.
47. Qd8-b6 follows diagonal c7-b6, both empty.
48. Black ends; no card or capture accounting changes.
49. Ne5-f3 makes its quiet return jump.
50. White ends; no obligation is pending.
51. a7-a5 crosses vacant a6, stopping before opposing Pa4; creates a6 opportunity.
52. Black ends; a6 opportunity survives until White moves.
53. Be2-b5 crosses empty d3 and c4; black Pc6 blocks its ray toward Ke8.
54. White ends; unused a6 opportunity has expired.
55. Ra8-a7 moves to a vacant square and loses Black's queenside right.
56. Black ends; neither Black castling right remains.
57. h2-h3 advances into empty h3, stopping before Black's h4 Pawn.
58. White ends; Pawn clock is zero.
59. Qb6-c5 moves diagonally one square without capture.
60. Curse after Black's move marks opposing Rh1 by identity; retained effect, draw Confabulation.
61. Black ends; Curse and Truce persist.
62. Bb5-f1 crosses c4,d3,e2, all empty; Curse applies to the Rook, not this Bishop.
63. White ends; no effect expires.
64. d7-d6 is a quiet forward Pawn move.
65. Black ends; neither King is checked.
66. Bd2-b4 crosses empty c3 and lands on empty b4.
67. White ends; the Bishop move makes no capture.
68. Bh8-e5 crosses g7,f6; Dungeon already expired after action 44.
69. Black ends; no new obligations exist.
70. Cursed Rh1-g1 moves only one square and loses White's kingside castling right.
71. White ends; the Curse follows the Rook to g1.
72. Bh6-f8 crosses empty g7 to an empty destination.
73. Black ends; the noncapture clock remains advanced.
74. g2-g3 advances one square and stops before enemy Pg4.
75. White ends; no draw or discard is due.
76. Rh7-b7 crosses g7,f7,e7,d7,c7, all empty.
77. Challenge after Black's move selects Bf1, which can move through e2 to d3; draw Earthquake.
78. White immediately plays Vulture on Black's Challenge, transfers that physical card, discards top Cathedral, spends Vulture and draws Blessing; Challenge obligation remains.
79. Black ends; White's new turn resets both card allowances and retains the Challenge obligation.
80. Bf1-d3 crosses empty e2 and satisfies Challenge with the selected identity; restriction expires.
81. White ends; the captured card is still in hand and its previous effect is resolved.
82. Ng8-e7 is a quiet Knight jump.
83. Black ends; no captures or pending choices.
84. Qd1-d2 moves one square forward to the vacated square.
85. White ends; no effect changes.
86. Qc5-c4 moves one square down without capture.
87. Black ends; the Queen does not attack either royal square.
88. Ra1-a3 crosses empty a2 and revokes White's remaining queenside castling right.
89. White ends; all castling rights are now absent.
90. Ne7-g8 returns by a quiet Knight jump.
91. Black ends; neither King is checked.
92. Blessing replaces White's move: Nf3-e4 uses its granted Bishop diagonal without capture; draw Crusade.
93. White ends; the Knight retains its original Knight role.
94. Nb8-a6 is a quiet Knight jump.
95. Black ends; no draw is due.
96. Bb4-c3 is one diagonal step to empty c3.
97. White ends; Truce and Curse persist.
98. Rb7-f7 crosses c7,d7,e7, all empty.
99. Black ends; no obligations are due at White's start.
100. b2-b4 crosses vacant b3 and creates the b3 opportunity.
101. Earthquake rotates orientation counterclockwise to 270: Black Ph4 promotes to Rook first, White Pa4 to Knight second; fixed squares stay put, EP clears, draw Dubbing.
102. White ends; both promotions and changed Pawn directions persist.
103. Na6-c7 is a quiet jump unaffected by orientation.
104. Black ends; no captures and no new promotions.
105. Ra3-a1 crosses empty a2; moving home never restores castling rights.
106. White ends; Curse still belongs to Rg1, not Ra1.
107. Promoted Rh4-h7 crosses empty h5,h6; it now uses Rook movement with non-Pawn clocks.
108. Black ends; promotion remains permanent.
109. Promoted Na4-b2 makes a legal Knight jump, not a Pawn move.
110. White ends; no promotion reverses on movement.
111. Promoted Rh7-h6 moves one square as a Rook.
112. Black's Earthquake rotates orientation to 180; no unpromoted Pawn occupies either new last rank, so no new promotions; draw Dungeon.
113. Black ends; both Earthquake cards remain active and earlier promotions remain.
114. Promoted Nb2-a4 returns by a legal Knight jump.
115. White ends the fiftieth regular move; both Kings safe, no pending rescue or choice.
`.trim().split('\n');

test('iteration 118: 115 independently reviewed actions and complete physical state', () => {
  assert.equal(rationale.length, 115);
  assert.equal(trace.steps.length, rationale.length);
  let state = createGameState(trace.initial);
  const colors: Color[] = ['white', 'black'];
  const roles: Role[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  const pieces: PieceState[] = [1, 2, 7, 8].flatMap(rank => [...'abcdefgh'].map((file, i) => {
    const owner: Color = rank < 3 ? 'white' : 'black';
    const role = rank === 2 || rank === 7 ? 'pawn' : roles[i]!;
    const square = `${file}${rank}` as SquareName;
    return { id: `${owner}-${role}-${square}`, owner, role, originalRole: role, square,
      zone: 'board' as const, promoted: false, royal: role === 'king', neutral: false };
  }));
  const initialPlayer = (color: Color): GameState['players'][Color] => ({
    hand: trace.initial.hands![color]!.map((cardId, i) => ({ id: `${color}-hand-${i}-${cardId}`, cardId })),
    deck: trace.initial.decks![color]!.map((cardId, i) => ({ id: `${color}-deck-${i}-${cardId}`, cardId })),
    discard: [],
  });
  const players = { white: initialPlayer('white'), black: initialPlayer('black') };
  const turn: GameState['turn'] = { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
  let effects: Array<Record<string, unknown>> = [];
  let ep: GameState['enPassant'] = [];
  let orientation = 0, halfmove = 0, fullmove = 1, fenColor = 'w', rights = 'KQkq', fenEp = '-';
  let moves = 0, cards = 0;
  const at = (square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
  const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
  const clear = (from: string, to: string, ownPass?: Color) => {
    const [x, y] = xy(from), [u, v] = xy(to);
    const n = Math.max(Math.abs(u - x), Math.abs(v - y));
    for (let i = 1; i < n; i++) {
      const blocker = at(`${String.fromCharCode(97 + x + Math.sign(u - x) * i)}${y + 1 + Math.sign(v - y) * i}`);
      assert.ok(!blocker || blocker.owner === ownPass, `blocked ${from}-${to}`);
    }
  };
  const relocate = (from: string, to: string, mode = 'regular') => {
    assert.match(from, /^[a-h][1-8]$/); assert.match(to, /^[a-h][1-8]$/);
    const p = at(from); assert.ok(p); assert.equal(at(to), undefined, 'every reviewed displacement is noncapturing');
    if (mode !== 'dungeon') assert.equal(p.owner, turn.color);
    const [x, y] = xy(from), [u, v] = xy(to), dx = Math.abs(u - x), dy = Math.abs(v - y);
    assert.ok(!effects.some(e => e.type === 'dungeon' && e.pieceId === p.id && e.player === turn.color));
    if (effects.some(e => e.type === 'curse' && e.pieceId === p.id)) assert.ok(Math.max(dx, dy) <= 2);
    if (mode !== 'dungeon') {
      const role = mode === 'blessing' ? 'bishop' : p.role;
      if (role === 'knight') assert.equal(dx * dy, 2);
      else if (role === 'pawn') {
        assert.equal(orientation, 0, 'all reviewed Pawn movements precede rotation');
        assert.equal(dx, 0); assert.ok(dy === 1 || dy === 2 && (y === 1 || y === 6));
        assert.equal(Math.sign(v - y), p.owner === 'white' ? 1 : -1); clear(from, to);
      } else {
        assert.ok(role === 'bishop' ? dx === dy : role === 'rook' ? dx === 0 || dy === 0 : dx === dy || dx === 0 || dy === 0);
        clear(from, to, mode === 'ghostwalk' ? p.owner : undefined);
      }
    }
    const right: Record<string, string> = { 'white-rook-a1': 'Q', 'white-rook-h1': 'K', 'black-rook-a8': 'q', 'black-rook-h8': 'k' };
    if (right[p.id]) rights = rights.replace(right[p.id]!, '');
    p.square = to as SquareName;
    return p;
  };
  const advance = (p: PieceState) => {
    halfmove = p.role === 'pawn' ? 0 : halfmove + 1;
    fullmove += turn.color === 'black' ? 1 : 0;
    fenColor = turn.color === 'white' ? 'b' : 'w';
    turn.phase = 'afterMove'; turn.moveMade = true; fenEp = '-'; ep = [];
  };
  const boardFen = () => Array.from({ length: 8 }, (_, row) => {
    let line = '', empty = 0;
    for (const file of 'abcdefgh') {
      const p = at(`${file}${8 - row}`);
      if (!p) { empty++; continue; }
      if (empty) line += empty; empty = 0;
      const symbol = ({ pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' })[p.role];
      line += p.owner === 'white' ? symbol.toUpperCase() : symbol;
    }
    return line + (empty || '');
  }).join('/');
  const assertRoyalSafety = () => {
    for (const color of colors) {
      const king = pieces.find(p => p.owner === color && p.royal)!;
      assert.equal(king.zone, 'board'); assert.equal(king.square, color === 'white' ? 'e1' : 'e8');
      const [u, v] = xy(king.square!);
      for (const p of pieces.filter(p => p.zone === 'board' && p.owner !== color)) {
        const [x, y] = xy(p.square!), dx = Math.abs(u - x), dy = Math.abs(v - y);
        let attack = false;
        if (p.role === 'knight') attack = dx * dy === 2;
        else if (p.role === 'king') attack = Math.max(dx, dy) === 1;
        else if (p.role === 'pawn') {
          const sign = p.owner === 'white' ? 1 : -1;
          attack = orientation === 0 ? v - y === sign && dx === 1
            : orientation === 270 ? u - x === -sign && dy === 1
              : v - y === -sign && dx === 1;
        } else if (p.role === 'bishop' ? dx === dy : p.role === 'rook' ? dx === 0 || dy === 0 : dx === dy || dx === 0 || dy === 0) {
          attack = true;
          for (let i = 1; i < Math.max(dx, dy); i++) {
            if (at(`${String.fromCharCode(97 + x + Math.sign(u - x) * i)}${y + 1 + Math.sign(v - y) * i}`)) attack = false;
          }
        }
        if (effects.some(e => e.type === 'curse' && e.pieceId === p.id) && Math.max(dx, dy) > 2) attack = false;
        if (effects.some(e => e.type === 'dungeon' && e.pieceId === p.id)) attack = false;
        // Even without Truce suppression neither King is attacked in this particular trace.
        assert.equal(attack, false, `${p.id} must not check ${color}`);
      }
    }
  };

  for (const [index, { action }] of trace.steps.entries()) {
    const label = rationale[index]!; assert.ok(label.startsWith(`${index + 1}. `));
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.equal(turn.moveMade, false); assert.equal(action.promotion, undefined);
      const challenge = effects.find(e => e.type === 'challenge' && e.player === turn.color);
      if (challenge) assert.equal(at(action.from)!.id, challenge.pieceId);
      const p = relocate(action.from, action.to); advance(p); moves++;
      if (p.role === 'pawn' && Math.abs(Number(action.from[1]) - Number(action.to[1])) === 2) {
        ep = [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}` as SquareName, pawnId: p.id }];
      }
      effects = effects.filter(e => e.type !== 'challenge' || e.player !== turn.color);
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true);
      effects = effects.filter(e => e.type !== 'dungeon' || e.player !== turn.color);
      turn.color = turn.color === 'white' ? 'black' : 'white';
      turn.phase = 'beforeMove'; turn.moveMade = false; turn.cardPlays = { white: 0, black: 0 };
    } else if (action.type === 'playCard') {
      cards++;
      const owner = colors.find(c => players[c].hand.some(card => card.id === action.cardInstanceId)); assert.ok(owner);
      const player = players[owner], cardIndex = player.hand.findIndex(card => card.id === action.cardInstanceId);
      const card = player.hand.splice(cardIndex, 1)[0]!; assert.equal(card.cardId, action.cardId);
      assert.equal(turn.cardPlays[owner], 0); turn.cardPlays[owner]++;
      const replacement = ['guardian', 'ghostwalk', 'blessing'].includes(card.cardId);
      assert.equal(turn.moveMade, !replacement);
      if (card.cardId !== 'vulture') assert.equal(owner, turn.color);
      if (['truce', 'curse', 'earthquake'].includes(card.cardId)) {
        const effect: Record<string, unknown> = { type: card.cardId, owner, card };
        if (card.cardId === 'curse') { assert.equal(action.target, 'h1'); effect.pieceId = 'white-rook-h1'; }
        if (card.cardId === 'earthquake') {
          const expectedTarget = index === 100
            ? { direction: 'counterclockwise', promotions: [{ square: 'h4', role: 'rook' }, { square: 'a4', role: 'knight' }] }
            : { direction: 'counterclockwise', promotions: [] };
          assert.deepEqual(action.target, expectedTarget);
          orientation = (orientation + 270) % 360; ep = []; fenEp = '-';
          for (const promotion of expectedTarget.promotions) {
            const p = at(promotion.square)!; assert.equal(p.role, 'pawn');
            p.role = promotion.role as Role; p.promoted = true;
          }
          effect.direction = 'counterclockwise'; effect.target = expectedTarget;
        }
        effects.push(effect);
      } else {
        if (card.cardId === 'disintegration') {
          assert.equal(action.target, 'b7'); const p = at('b7')!;
          p.zone = 'dead'; p.square = null; fenEp = 'h6'; halfmove = 0;
        } else if (['charge', 'guardian', 'ghostwalk', 'blessing', 'dungeon'].includes(card.cardId)) {
          const expected: Record<string, [string, string]> = { charge: ['c3', 'b1'], guardian: ['d3', 'd4'], ghostwalk: ['f1', 'd3'], blessing: ['f3', 'e4'], dungeon: ['b7', 'h8'] };
          const [from, to] = expected[card.cardId]!; assert.deepEqual(action.target, [{ from, to }]);
          const p = relocate(from, to, card.cardId);
          if (replacement) advance(p);
          if (card.cardId === 'charge') ep = [];
          if (card.cardId === 'dungeon') effects.push({ type: 'dungeon', owner, player: 'black', pieceId: p.id });
        } else if (card.cardId === 'challenge') {
          assert.equal(action.target, 'f1'); assert.equal(at('f1')!.id, 'white-bishop-f1');
          assert.equal(at('e2'), undefined); assert.equal(at('d3'), undefined);
          effects.push({ type: 'challenge', owner, player: 'white', pieceId: 'white-bishop-f1' });
        } else if (card.cardId === 'vulture') {
          assert.equal(index, 77); assert.equal(owner, 'white'); assert.equal(action.target, undefined);
          assert.deepEqual(trace.steps[index - 1]!.action, { type: 'playCard', cardId: 'challenge', cardInstanceId: 'black-hand-0-challenge', target: 'f1' });
          const cost = player.deck.shift()!; assert.equal(cost.cardId, 'cathedral'); player.discard.push(cost);
        } else assert.fail(`Unreviewed card ${card.cardId}`);
        player.discard.push(card);
      }
      player.hand.push(player.deck.shift()!);
      if (card.cardId === 'vulture') {
        const taken = players.black.discard.pop()!; assert.equal(taken.id, 'black-hand-0-challenge'); player.hand.push(taken);
      }
    } else assert.fail(`Unreviewed action ${action.type}`);

    assertRoyalSafety();
    const before = structuredClone(state);
    const result = applyAction(state, action);
    assert.deepEqual(state, before, `${label}: complete input immutability`);
    assert.ok(result.ok, label); state = result.state;
    assert.deepEqual(state.pieces, pieces, `${label}: all identities, squares, roles, zones and capturedBy`);
    assert.deepEqual(state.players, players, `${label}: complete physical card zones and draw order`);
    assert.deepEqual(state.effects, effects, `${label}: complete effects`);
    assert.deepEqual(state.turn, turn, `${label}: turn and both allowances`);
    assert.deepEqual(state.enPassant, ep, `${label}: en passant`);
    assert.equal(state.orientation, orientation, label);
    assert.equal(state.fen, `${boardFen()} ${fenColor} ${rights || '-'} ${fenEp} ${halfmove} ${fullmove}`, `${label}: independent FEN and clocks`);
    assert.equal(Boolean(state.pendingRescue), false, `${label}: rescue iff independently expected check`);
    assert.equal(Boolean(state.pendingDoomsayer), false); assert.equal(Boolean(state.pendingAbduction), false);
    assert.deepEqual(state.underElfHill ?? [], []); assert.equal(state.outcome, null);
  }
  assert.equal(moves, 50); assert.equal(cards, 12);
  assert.equal(state.fen, '4kbn1/r1n2r2/2ppp2r/p3bp2/NPqPN1p1/2BBP1PP/2PQ1P2/RN2K1R1 b - - 6 27');
  assert.equal(replayTrace(trace).fen, state.fen);
});
