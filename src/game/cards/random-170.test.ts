import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { createGameState } from '../state.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { CardInstance, Color, GameEvent, GameState, PieceState, Role, SquareName } from '../types.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/170.json', import.meta.url), 'utf8')) as RandomTrace;
test('iteration 170: deterministic trace replay', () => {
  assert.ok(replayTrace(trace));
});

// Ordered review against rules §§8–13 and the seven printed card images.
const rationales = `
1. Nb1-c3 is an unobstructed knight jump before the magnet exists.
2. White marks its b2 pawn after moving; adjacent non-Kings become immobile; draw Cathedral.
3. White finishes with both Kings safe; Black gets fresh allowances.
4. g7-g6 advances the black pawn one square into an empty square.
5. Black finishes its pawn move; White acts next.
6. h2-h3 advances White's pawn one square, outside the b2 magnet neighborhood.
7. White finishes; Black acts next with no compulsory choice.
8. f7-f6 advances Black's pawn one square.
9. Black finishes; White acts next.
10. g2-g4 passes empty g3; g3 EP record exists but Black has no adjacent captor.
11. White finishes; the g3 EP opportunity survives until Black moves.
12. h7-h5 passes empty h6; White has no pawn on g5 to capture en passant.
13. Black finishes; h6 EP record survives the handoff.
14. f2-f4 passes empty f3; Black has no adjacent fourth-rank captor.
15. White finishes with f3 EP recorded, though no legal captor exists.
16. a7-a6 is a one-square black pawn move and expires the old EP opportunity.
17. Black finishes; White acts next.
18. g4xh5 captures the black h-pawn diagonally; White is its captor.
19. White finishes the capture; Black gets its turn.
20. Black spends Dubbing instead of moving: its c7 pawn jumps as a knight to empty b5; draw Legacy.
21. Black finishes the replacement move; White gets the next turn.
22. e2-e4 passes empty e3; no black pawn can capture en passant.
23. White finishes with the e3 EP record retained.
24. e7-e6 advances Black's pawn and expires e3 EP.
25. Black finishes; White acts next.
26. Qd1-e2 moves one diagonal square into the pawn's vacated square.
27. White finishes; Black acts next.
28. Qd8-e7 moves one diagonal square into its pawn's vacated square.
29. Black finishes; White acts next.
30. Qe2-e3 moves one file square into empty e3.
31. White finishes; Black acts next.
32. Ra8-a7 moves one file square and permanently removes Black's queenside castling right.
33. Black finishes; White acts next.
34. Qe3-b6 follows the clear d4-c5 diagonal to empty b6.
35. White finishes; Black acts next.
36. Qe7-d8 moves one diagonal square to the vacated home square.
37. Black finishes; White acts next.
38. h3-h4 advances the h-pawn one square, with h5 occupied by the other white pawn.
39. White spends Anathema after moving: swap Black's c8 bishop and a7 rook without capture; draw Truce.
40. White finishes; Black acts next; the swapped identities persist.
41. Nb8-c6 is an unobstructed knight jump.
42. Black finishes; White acts next.
43. Ke1-d1 steps into empty d1 and loses both white castling rights.
44. White finishes with its King safe on d1.
45. Rh8-h6 passes empty h7 and loses Black's remaining castling right.
46. Black finishes; White acts next with no castling rights remaining.
47. Qb6-d4 follows clear c5 to empty d4.
48. White finishes; Black acts next.
49. Nc6-b8 jumps back to its empty home square.
50. Black finishes; White acts next.
51. Qd4-e3 moves one diagonal square.
52. White finishes; Black acts next.
53. Ke8-f7 steps diagonally into the vacated pawn square, outside every white attack.
54. Black finishes safely on f7.
55. Qe3-d4 returns along one diagonal square.
56. White finishes; Black acts next.
57. Bf8-c5 follows the empty e7-d6 diagonal.
58. Black finishes; White acts next.
59. e4-e5 advances White's e-pawn one square.
60. White finishes; Black acts next.
61. Ba7-b6 moves one diagonal square.
62. Black finishes; White acts next.
63. Qd4-d5 moves one file square into empty d5.
64. White finishes; Black acts next.
65. Bc5xg1 follows empty d4-e3-f2 and captures White's g1 knight; Black is captor.
66. Black finishes the capture; White acts next.
67. Qd5-d4 moves one file square into empty d4.
68. White finishes; Black acts next.
69. Rh6-h7 moves one file square into empty h7.
70. Black places Forbidden City on empty d6 after its move; draw Truce; subsequent rays cannot cross d6.
71. Black finishes; White acts next.
72. Qd4-d3 moves one file square, away from the forbidden square.
73. White finishes; Black acts next.
74. Rh7-h6 returns one file square to empty h6.
75. Black finishes; White acts next.
76. Kd1-e2 steps diagonally into empty e2 and is safe.
77. White spends Cathedral after moving: swap its f1 bishop and h1 rook; no path requirement or capture; draw Fog of War.
78. White finishes; Black acts next; the King move remains the shield movement.
79. Bb6-a5 moves one diagonal square.
80. Black finishes; White acts next.
81. Rf1-f3 passes empty f2 to empty f3.
82. White plays Truce after moving with neither King under a raw attack; draw Assassin; captures become forbidden.
83. White finishes; Black acts next; Truce persists because raw attacks remain absent.
84. Bg1-a7 follows empty f2-e3-d4-c5-b6, avoiding forbidden d6 and making no capture.
85. Black spends Rebirth after moving: enemy pawn d2 relocates to empty h2, an allowed white starting pawn square; draw Neutrality.
86. Black finishes; White acts next; Rebirth made no capture under Truce.
87. Rf3-h3 follows empty g3 to empty h3.
88. White finishes; Black acts next; raw royal attacks remain absent.
89. Rh6-h8 passes empty h7; castling rights do not return.
90. Black finishes; White acts next.
91. Rh3-g3 moves one rank square.
92. White finishes; Black acts next.
93. Ba7-b6 moves one diagonal square.
94. Black finishes; White acts next.
95. Rg3-e3 passes empty f3 to empty e3.
96. White finishes; Black acts next.
97. Qd8-e8 moves one rank square to the vacated royal home square.
98. Black finishes; White acts next.
99. Re3-f3 moves one rank square.
100. White finishes; Black acts next.
101. Rc8-c7 moves one file square to the square vacated by Dubbing's pawn.
102. Black finishes; White acts next.
103. Qd3-f5 follows empty e4 to empty f5; f6 still blocks its line toward Black's King.
104. White finishes; Black acts next with Truce still active.
105. Bb6-d4 follows empty c5; this does not cross forbidden d6.
106. Black finishes; White acts next.
107. h5-h6 advances the original g-pawn one square and resets the halfmove clock.
108. White finishes the fiftieth regular move; Black is next and both Kings remain safe.
`.trim().split('\n');

const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white';
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const square = (s: string): SquareName => { assert.match(s, /^[a-h][1-8]$/); return s as SquareName; };
const roles: Role[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
const symbol: Record<Role, string> = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };

test('iteration 170: independent ordered physical-board and rules oracle', () => {
  assert.equal(rationales.length, 108);
  assert.equal(trace.steps.length, rationales.length);
  const pieces: PieceState[] = [];
  for (const [rank, owner] of [[1, 'white'], [2, 'white'], [7, 'black'], [8, 'black']] as const) {
    for (let file = 0; file < 8; file++) {
      const role = rank === 2 || rank === 7 ? 'pawn' : roles[file]!;
      const s = square(`${String.fromCharCode(97 + file)}${rank}`);
      pieces.push({ id: `${owner}-${role}-${s}`, owner, role, originalRole: role, square: s, zone: 'board', promoted: false, royal: role === 'king', neutral: false });
    }
  }
  const at = (s: string, board = pieces) => board.find(p => p.zone === 'board' && p.square === s);
  let magnet = false, city = false, truce = false;
  const frozen = (p: PieceState) => {
    if (!magnet || p.royal || !p.square || p.square === 'b2') return false;
    const [x, y] = xy(p.square);
    return Math.max(Math.abs(x - 1), Math.abs(y - 1)) <= 1;
  };
  const geometry = (p: PieceState, to: string, capture: boolean, board = pieces, knight = false): boolean => {
    if (!p.square || frozen(p) || city && to === 'd6') return false;
    const [x, y] = xy(p.square), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
    if (!dx && !dy) return false;
    const role = knight ? 'knight' : p.role;
    if (role === 'knight') return Math.abs(dx) * Math.abs(dy) === 2;
    if (role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
    if (role === 'pawn') {
      const forward = p.owner === 'white' ? 1 : -1;
      if (capture) return Math.abs(dx) === 1 && dy === forward;
      if (dx || at(to, board)) return false;
      if (dy === forward) return true;
      const mid = `${p.square[0]}${y + forward + 1}`;
      return dy === 2 * forward && (p.owner === 'white' ? y <= 1 : y >= 6)
        && !at(mid, board) && !(city && mid === 'd6');
    }
    const diagonal = Math.abs(dx) === Math.abs(dy), straight = dx === 0 || dy === 0;
    if (!(role === 'bishop' ? diagonal : role === 'rook' ? straight : diagonal || straight)) return false;
    const length = Math.max(Math.abs(dx), Math.abs(dy));
    for (let d = 1; d < length; d++) {
      const mid: string = `${String.fromCharCode(97 + x + Math.sign(dx) * d)}${y + Math.sign(dy) * d + 1}`;
      if (at(mid, board) || city && mid === 'd6') return false;
    }
    return true;
  };
  // Deliberately excludes Truce suppression: a raw legal royal attack ends Truce.
  const attackers = (owner: Color, board = pieces) => {
    const king = board.find(p => p.owner === owner && p.royal)!;
    assert.ok(king.square);
    return board.filter(p => p.zone === 'board' && p.owner !== owner && geometry(p, king.square!, true, board)).map(p => p.id);
  };
  const players = Object.fromEntries((['white', 'black'] as const).map(owner => [owner, {
    hand: (trace.initial.hands![owner]!).map((cardId, i) => ({ id: `${owner}-hand-${i}-${cardId}`, cardId })),
    deck: (trace.initial.decks![owner]!).map((cardId, i) => ({ id: `${owner}-deck-${i}-${cardId}`, cardId })),
    discard: [] as CardInstance[],
  }])) as GameState['players'];
  let color: Color = 'white', fenColor: Color = 'white', made = false, half = 0, full = 1;
  let rights = 'KQkq';
  let ep: GameState['enPassant'] = [], shield: GameState['shieldMove'];
  let plays = { white: 0, black: 0 };
  const effects: unknown[] = [], history: GameEvent[] = [];
  const playedCards: NonNullable<GameState['playedCards']> = [];
  let state = createGameState(trace.initial), moves = 0, cards = 0;
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, reason = rationales[index]!;
    assert.ok(reason.startsWith(`${n}. `));
    const before = structuredClone(state);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      const p = at(from)!; assert.ok(p, reason);
      assert.equal(p.owner, color, reason); assert.equal(made, false, reason);
      const victim = at(to);
      assert.ok(!victim || victim.owner !== color && !victim.royal, reason);
      assert.ok(geometry(p, to, !!victim), reason);
      assert.ok(!truce || !victim, reason);
      assert.equal(action.promotion, undefined, 'no pawn reaches promotion rank');
      if (victim) { victim.zone = 'captured'; victim.square = null; victim.capturedBy = color; }
      ep = p.role === 'pawn' && Math.abs(xy(from)[1] - xy(to)[1]) === 2
        ? [{ target: square(`${from[0]}${(Number(from[1]) + Number(to[1])) / 2}`), pawnId: p.id }] : [];
      p.square = square(to);
      if (p.royal) rights = rights.replace(color === 'white' ? /[KQ]/g : /[kq]/g, '');
      if (p.originalRole === 'rook') {
        const right = ({ 'white-rook-a1': 'Q', 'white-rook-h1': 'K', 'black-rook-a8': 'q', 'black-rook-h8': 'k' } as Record<string, string>)[p.id];
        if (right) rights = rights.replace(right, '');
      }
      half = p.role === 'pawn' || victim ? 0 : half + 1;
      if (color === 'black') full++;
      fenColor = opposite(color); made = true; moves++;
      shield = { player: color, pieceIds: [p.id], capturedOpponent: !!victim };
      history.push({ type: 'move', from: square(from), to: square(to), ...(victim ? { capturedId: victim.id } : {}) });
    } else if (action.type === 'endTurn') {
      assert.ok(made, reason); color = opposite(color); made = false; plays = { white: 0, black: 0 }; shield = undefined;
    } else {
      assert.equal(action.type, 'playCard');
      if (action.type !== 'playCard') throw new Error('unreviewed action');
      const player: GameState['players'][Color] = players[color];
      const card: CardInstance = player.hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(card, reason); assert.equal(card.cardId, action.cardId, reason);
      assert.equal(plays[color], 0, reason);
      const metadata = CARD_CATALOG[card.cardId]!;
      const continuing = ['fatal-attraction', 'forbidden-city', 'truce'].includes(card.cardId);
      assert.equal(metadata.continuing, continuing);
      assert.deepEqual(metadata.timing, [card.cardId === 'dubbing' ? 'beforeMove' : 'afterMove']);
      assert.equal(made, card.cardId !== 'dubbing', reason);
      const event: GameEvent = { type: 'cardPlayed', cardId: card.cardId, ...(action.target === undefined ? {} : { target: action.target as GameEvent['target'] }) };
      if (card.cardId !== 'forbidden-city') Object.assign(event, { movement: [], preservePreviousMove: true });
      switch (card.cardId) {
        case 'fatal-attraction':
          assert.equal(n, 2); assert.equal(action.target, 'b2'); assert.equal(at('b2')!.owner, color);
          magnet = true; effects.push({ type: card.cardId, owner: color, card, pieceId: 'white-pawn-b2' }); break;
        case 'dubbing': {
          assert.equal(n, 20); assert.deepEqual(action.target, [{ from: 'c7', to: 'b5' }]);
          const p = at('c7')!; assert.equal(p.owner, color); assert.equal(at('b5'), undefined);
          assert.ok(geometry(p, 'b5', false, pieces, true)); p.square = 'b5';
          half = 0; full++; fenColor = 'white'; made = true; ep = [];
          shield = { player: color, pieceIds: [p.id], capturedOpponent: false };
          event.movement = [{ from: 'c7', to: 'b5' }]; event.preservePreviousMove = false; break;
        }
        case 'anathema':
          assert.equal(n, 39); assert.deepEqual(action.target, { bishop: 'c8', rook: 'a7' });
          assert.equal(at('c8')!.role, 'bishop'); assert.equal(at('a7')!.role, 'rook');
          assert.equal(at('c8')!.owner, opposite(color)); assert.equal(at('a7')!.owner, opposite(color));
          { const bishop = at('c8')!, rook = at('a7')!; bishop.square = 'a7'; rook.square = 'c8'; }
          event.movement = [{ from: 'a7', to: 'c8' }, { from: 'c8', to: 'a7' }]; break;
        case 'forbidden-city':
          assert.equal(n, 70); assert.equal(action.target, 'd6'); assert.equal(at('d6'), undefined);
          city = true; effects.push({ type: card.cardId, owner: color, card, square: 'd6' }); break;
        case 'cathedral':
          assert.equal(n, 77); assert.deepEqual(action.target, { rook: 'h1', bishop: 'f1' });
          { const bishop = at('f1')!, rook = at('h1')!;
            assert.equal(bishop.role, 'bishop'); assert.equal(rook.role, 'rook');
            assert.equal(bishop.owner, color); assert.equal(rook.owner, color);
            bishop.square = 'h1'; rook.square = 'f1'; }
          event.movement = [{ from: 'f1', to: 'h1' }, { from: 'h1', to: 'f1' }]; break;
        case 'truce':
          assert.equal(n, 82); assert.equal(action.target, undefined);
          truce = true; effects.push({ type: card.cardId, owner: color, card }); break;
        case 'rebirth':
          assert.equal(n, 85); assert.deepEqual(action.target, [{ from: 'd2', to: 'h2' }]);
          assert.equal(at('d2')!.owner, opposite(color)); assert.equal(at('d2')!.role, 'pawn'); assert.equal(at('h2'), undefined);
          at('d2')!.square = 'h2'; event.movement = [{ from: 'd2', to: 'h2' }]; break;
        default: throw new Error('unreviewed card');
      }
      player.hand.splice(player.hand.indexOf(card), 1); player.hand.push(player.deck.shift()!);
      if (!continuing) player.discard.push(card);
      playedCards.push({ player: color, cardInstanceId: card.id }); plays[color]++; cards++; history.push(event);
    }
    // Every board is checked independently, including after non-move cards and under Truce.
    for (const owner of ['white', 'black'] as const) assert.deepEqual(attackers(owner), [], `${reason}: raw ${owner} royal safety`);
    const result = applyAction(state, action);
    assert.deepEqual(state, before, `${reason}: input immutability, including captor metadata`);
    assert.ok(result.ok, reason); state = result.state;
    assert.deepEqual(state.pieces, pieces, `${reason}: physical identities, capture actors, roles and zones`);
    assert.deepEqual(state.players, players, `${reason}: exact instance spending/drawing/discard`);
    assert.deepEqual(state.history, history, `${reason}: complete chronological events; no cancellations/fizzles`);
    assert.deepEqual(state.effects, effects, reason);
    assert.deepEqual(state.playedCards ?? [], playedCards, reason);
    assert.deepEqual(state.turn, { color, phase: made ? 'afterMove' : 'beforeMove', moveMade: made, cardPlays: plays }, reason);
    assert.deepEqual(state.shieldMove, shield, reason);
    assert.deepEqual(state.enPassant, ep, reason);
    for (const field of ['chaosForbidden', 'plotsExecution', 'riposteSkipped', 'riposteCheckDeferred'] as const) assert.equal(state[field], undefined, `${reason}: ${field}`);
    for (const field of ['plotsAllowances', 'fogLocked', 'riposteLostMoves', 'underElfHill'] as const) assert.deepEqual(state[field] ?? [], [], `${reason}: ${field}`);
    for (const field of ['pendingRescue', 'pendingAbduction', 'pendingDoomsayer', 'outcome'] as const) assert.equal(state[field] ?? null, null, `${reason}: ${field}`);
    assert.equal(state.orientation, 0);
    if (action.type === 'playCard') assert.deepEqual(state.cardResponse, { player: color, historyLength: history.length });
    else assert.equal(state.cardResponse, undefined);
    let boardFen = '';
    for (let rank = 8; rank >= 1; rank--) {
      let empty = 0;
      for (const file of 'abcdefgh') {
        const p = at(`${file}${rank}`);
        if (!p) { empty++; continue; }
        if (empty) { boardFen += empty; empty = 0; }
        const char = symbol[p.role]; boardFen += p.owner === 'white' ? char.toUpperCase() : char;
      }
      if (empty) boardFen += empty;
      if (rank > 1) boardFen += '/';
    }
    // EP captures are evaluated for the prospective capturing player in before-move context.
    // All four double advances in this trace have no geometrically eligible adjacent Pawn.
    const candidates: string[] = [];
    for (const opportunity of ep) {
      for (const p of pieces.filter(p => p.zone === 'board' && p.owner === fenColor && p.role === 'pawn')) {
        if (!geometry(p, opportunity.target, true)) continue;
        const simulation = structuredClone(pieces);
        const mover = simulation.find(q => q.id === p.id)!;
        const victim = simulation.find(q => q.id === opportunity.pawnId)!;
        mover.square = opportunity.target; victim.square = null; victim.zone = 'captured';
        if (!truce && attackers(fenColor, simulation).length === 0) candidates.push(`${p.square}-${opportunity.target}`);
      }
    }
    assert.deepEqual(candidates, [], `${reason}: EP legal availability is empty`);
    if (ep.length) {
      const context = structuredClone(state); context.turn = { color: fenColor, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      const contextBefore = structuredClone(context);
      const destinations = legalDests(context);
      for (const opportunity of ep) for (const p of pieces.filter(p => p.owner === fenColor && p.role === 'pawn' && p.square)) {
        if (p.square![0] !== opportunity.target[0]) assert.ok(!destinations.get(p.square!)?.includes(opportunity.target));
      }
      assert.deepEqual(context, contextBefore, 'EP public query input immutability');
    }
    assert.equal(state.fen, `${boardFen} ${fenColor[0]} ${rights || '-'} - ${half} ${full}`, `${reason}: all six FEN fields`);
    assert.equal(isKingInCheck(state, 'white'), false); assert.equal(isKingInCheck(state, 'black'), false);
  }
  assert.equal(moves, 50); assert.equal(cards, 7);
  assert.equal(state.fen, '1n2q1nr/1prp1k2/p3pppP/bp2PQ2/3b1P1P/2N2R2/PPP1K2P/R1B4B b - - 0 26');
});
