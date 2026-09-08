import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Reviewed in order against rules §§8–16,19.3 and the named printed catalog cards.
const rationale = `
1. h-pawn advances one square to empty h3.
2. White ends its completed safe move.
3. g-pawn doubles over empty g6; no white pawn can capture en passant.
4. Black retains Fortification at h6/h7 after its move; no board change.
5. End Black's turn; preserve the g6 opportunity.
6. b-pawn advances to b3, expiring g6.
7. End White's safe turn.
8. Black Bishop moves diagonally f8/g7.
9. End Black's safe turn.
10. White replaces its move with Under Elf Hill; e1 King goes away and loses rights.
11. Black begins while White's King is away.
12. b7/b5 doubles over empty b6; no opposing pawn is adjacent.
13. White begins with mandatory King return.
14. King returns to empty safe edge a3; b6 raw FEN survives without a legal captor.
15. g1 Knight merges onto own h3 Pawn using an L jump; both identities survive.
16. Returned King remains stationary through White's turn.
17. g7/h6 Bishop crosses no h6/h7 wall boundary.
18. End Black's safe turn.
19. e2/e4 Pawn double over empty e3.
20. End White's turn, retain uncapturable e3 opportunity.
21. c8/a6 Bishop crosses vacant b7.
22. End Black's safe turn.
23. Long Jump b1/a5 changes square color and captures nothing.
24. Toll responds to Knight crossing frontier; c2 Pawn paid to Black, Long Jump retained.
25. Both card allowances reset at turn handoff.
26. c7/c6 Pawn advances one square.
27. End Black's safe turn.
28. a5/c4 Knight L jump.
29. End White's safe turn.
30. d8/c8 Queen slides one file.
31. End Black's safe turn.
32. f2/f4 Pawn doubles over empty f3.
33. Retain uncapturable f3 opportunity until Black moves.
34. h6/f8 Bishop crosses empty g7, not the wall.
35. End Black's safe turn.
36. d1/c2 Queen enters square vacated by Toll.
37. End White's safe turn.
38. f8/g7 Bishop diagonal step.
39. End Black's safe turn.
40. c4/d6 Knight jumps and checks e8 King.
41. Black receives the checked turn.
42. e7/d6 Pawn captures that checking Knight; Black King becomes safe.
43. End Black's safe turn.
44. h3/g5 composite uses its Knight component to capture black g-pawn.
45. End White's safe turn.
46. g7/f6 Bishop diagonal step.
47. End Black's safe turn.
48. Dubbing moves whole composite g5/e6 without capture or transformation.
49. End White's replacement-move turn.
50. Black replaces move with Under Elf Hill, removing e8 King and its castling rights.
51. White begins while Black King is away.
52. e6/c7 composite Knight jump captures nothing.
53. Charge applies to the composite Knight; c7/b8 Pawn capture takes Knight without promotion.
54. Black begins with compulsory return.
55. King returns to empty d8, beyond the composite's Pawn and Knight attacks.
56. f6/h4 Bishop crosses vacant g5; returned King stays still.
57. End Black's safe turn.
58. f1/e2 Bishop diagonal step.
59. End White's safe turn.
60. a8/b8 Rook captures both composite components; Confabulation expires to discard.
61. End Black's safe turn.
62. Passing swaps a2/d7 and f4/d6 Pawn pairs atomically without capture or promotion.
63. End White's replacement move.
64. c8/b7 Queen diagonal step.
65. End Black's safe turn.
66. e4/e5 Pawn advances.
67. End White's safe turn.
68. h4/f2 Bishop crosses empty g3.
69. End Black's safe turn.
70. c2/e4 Queen crosses empty d3.
71. Neutrality marks enemy f4 Pawn after the move; identity and clocks unchanged.
72. End White's safe turn.
73. f2/e3 Bishop diagonal step.
74. End Black's safe turn.
75. d2/d4 Pawn doubles over empty d3; neutral f4 Pawn is not an en-passant captor.
76. Retain d3 opportunity until Black's move.
77. b8/c8 Rook moves one file.
78. Siege exchanges g8 Knight and c8 Rook; swap creates no new moved identities.
79. End Black's safe turn.
80. a3/a4 King is provisionally checked by b5 Pawn; held Doomsayer can remove b5.
81. Holy Quest e3/c8 swap cannot cure b5 check, so spend card and rewind King move.
82. e2/d3 Bishop is the legal replacement move; spent card allowance remains used.
83. End White's corrected turn.
84. Neutral f4 Pawn captures its own-color e3 Bishop for Black; physical captor is Black.
85. End Black's safe turn.
86. d3/e2 Bishop diagonal step.
87. End White's safe turn.
88. b5/b4 Pawn gives check against a3 King.
89. White receives checked turn.
90. e2/f1 Bishop leaves check provisionally; held Cowardice b4/b5 is a concrete cure.
91. Doomsayer opens mandatory Black naming window; b4 Pawn can be selected as cure.
92. Black names g8 Rook instead; check persists, so Doomsayer fizzles and Bishop move rewinds.
93. a3/a4 King is a safe replacement escape from b4 Pawn.
94. End White's corrected turn.
95. d8/e8 King enters d7 Pawn check; Haunting Memories copies Doomsayer to remove d7.
96. Vendetta cannot cure Pawn check, so it is spent and the King move rewinds.
97. c8/e7 Knight is Black's legal replacement move.
98. End Black's corrected turn.
99. e4/h4 Queen crosses empty f4 and g4.
100. End White's safe turn.
101. a6/d3 Bishop crosses vacant b5 and c4.
102. End Black's safe turn.
103. h4/h2 Queen crosses vacant h3.
104. End White's safe turn.
105. b7/d7 Queen crosses c7 and captures White's original a-pawn.
106. End Black's safe turn.
107. e2/g4 Bishop crosses empty f3.
108. End White's safe turn.
109. f7/f6 Pawn advances.
110. End Black's safe turn.
111. h2/h5 Queen crosses empty h3/h4; wall lies further up.
112. End White's safe turn.
113. f6/f5 Pawn advances.
114. End Black's safe turn.
115. a4/a3 King enters b4 Pawn check provisionally; Cowardice b4/b5 can cure it.
116. Cowardice c6/c8 does not cure b4 check; card spent, King move rewound.
117. h1/h4 Rook crosses empty h2/h3 as legal replacement move.
118. End White's corrected turn.
119. d7/c8 Queen diagonal step.
120. End Black's safe turn; 50 move commands reviewed.
`.trim().split('\n');

const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1];
const other = (color: Color): Color => color === 'white' ? 'black' : 'white';
const composite = (pieces: PieceState[]) => pieces.find(p => p.id === 'white-knight-g1')?.zone === 'away';

function geometry(pieces: PieceState[], piece: PieceState, to: string, capture: boolean): boolean {
  assert.ok(piece.square);
  const [x, y] = xy(piece.square), [u, v] = xy(to), dx = u! - x!, dy = v! - y!;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const roles = piece.id === 'white-pawn-h2' && composite(pieces) ? ['pawn', 'knight'] : [piece.role];
  return roles.some(role => {
    if (role === 'knight') return ax * ay === 2;
    const direction = piece.owner === 'white' ? 1 : -1;
    let aligned = role === 'king' ? Math.max(ax, ay) === 1
      : role === 'pawn' ? capture ? ax === 1 && dy === direction
        : dx === 0 && (dy === direction || dy === 2 * direction && (piece.owner === 'white' ? y! <= 1 : y! >= 6))
      : role === 'bishop' ? ax === ay && ax > 0
      : role === 'rook' ? (dx === 0) !== (dy === 0)
      : ax === ay && ax > 0 || (dx === 0) !== (dy === 0);
    if (!aligned) return false;
    let previous = piece.square as string;
    for (let distance = 1; distance <= Math.max(ax, ay); distance++) {
      const square = `${String.fromCharCode(97 + x! + Math.sign(dx) * distance)}${y! + Math.sign(dy) * distance + 1}`;
      if ([previous, square].sort().join('/') === 'h6/h7') return false;
      if (square !== to && pieces.some(p => p.square === square && p.zone === 'board')) return false;
      previous = square;
    }
    return true;
  });
}

function royalThreat(pieces: PieceState[], color: Color): boolean {
  const king = pieces.find(p => p.royal && p.owner === color && p.zone === 'board');
  if (!king?.square) return false;
  return pieces.some(p => p.zone === 'board' && p.id !== king.id && (p.owner !== color || p.neutral)
    && geometry(pieces, p, king.square!, true));
}

function boardFen(pieces: PieceState[]): string {
  const roles = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, r) => {
    let row = '', empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = pieces.find(p => p.zone === 'board' && p.square === `${String.fromCharCode(97 + f)}${8 - r}`);
      if (!p) empty++;
      else { if (empty) row += empty; empty = 0; const symbol = roles[p.role]; row += p.owner === 'white' ? symbol.toUpperCase() : symbol; }
    }
    return row + (empty || '');
  }).join('/');
}

function act(state: GameState, action: GameAction): GameState {
  const original = structuredClone(state), result = applyAction(state, action);
  assert.deepEqual(state, original, 'full input immutability, including capturedBy');
  assert.ok(result.ok, JSON.stringify(action));
  return result.state;
}

const rescueActions = (n: number): GameAction[] => {
  if (n === 90 || n === 115) return [{ type: 'playCard', cardId: 'cowardice', cardInstanceId: 'white-deck-7-cowardice', target: [{ from: 'b4', to: 'b5' }] }];
  const black = n === 95;
  const effectId = black ? 'black-deck-1-haunting-memories' : 'white-deck-6-doomsayer';
  return [
    ...(n === 91 ? [] : [{ type: 'playCard' as const, cardId: black ? 'haunting-memories' : 'doomsayer', cardInstanceId: effectId }]),
    { type: 'namePiece', speaker: black ? 'white' : 'black', name: 'pawn', losses: [{ effectId, pieceId: black ? 'white-pawn-a2' : 'black-pawn-b7' }] },
  ];
};

function rescueWithAccounting(state: GameState, action: GameAction): GameState {
  const players = structuredClone(state.players), effects = structuredClone(state.effects), turn = structuredClone(state.turn);
  let choice: GameState['pendingDoomsayer'] = null;
  if (action.type === 'playCard') {
    const owner = turn.color, player = players[owner];
    const index = player.hand.findIndex(card => card.id === action.cardInstanceId && card.cardId === action.cardId);
    assert.ok(index >= 0, 'rescue spends the exact held card');
    assert.equal(turn.cardPlays[owner], 0);
    const card = player.hand.splice(index, 1)[0]!;
    player.hand.push(player.deck.shift()!);
    turn.cardPlays[owner]++;
    if (action.cardId === 'cowardice') player.discard.push(card);
    else {
      assert.ok(action.cardId === 'doomsayer' || action.cardId === 'haunting-memories');
      effects.push({ type: 'doomsayer', owner, card });
      choice = { player: other(owner), cardInstanceId: card.id };
    }
  } else {
    assert.equal(action.type, 'namePiece');
    assert.ok(state.pendingDoomsayer);
    const index = effects.findIndex(effect => (effect as { card?: { id: string } }).card?.id === state.pendingDoomsayer!.cardInstanceId);
    assert.ok(index >= 0);
    const effect = effects.splice(index, 1)[0] as { type: string; owner: Color; card: { id: string; cardId: string } };
    assert.equal(effect.type, 'doomsayer');
    players[effect.owner].discard.push(effect.card);
  }
  const result = act(state, action);
  assert.deepEqual(result.players, players, 'rescue exact spending, replacement draw and discard');
  assert.deepEqual(result.effects, effects, 'rescue exact retained or resolved effect');
  assert.deepEqual(result.turn, turn, 'rescue preserves turn and changes only its card allowance');
  assert.deepEqual(result.pendingDoomsayer ?? null, choice, 'rescue naming obligation');
  return result;
}

test('iteration 174: all 120 actions have independent physical, timing, history and royal oracles', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/174.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationale.length, trace.steps.length);
  let state = createGameState(trace.initial), pieces = structuredClone(state.pieces);
  let players = structuredClone(state.players), turn = structuredClone(state.turn);
  let history: GameEvent[] = [], effects: unknown[] = [], ep: GameState['enPassant'] = [];
  let shield: GameState['shieldMove'], hill: NonNullable<GameState['underElfHill']> = [];
  let half = 0, full = 1, active = 'w', rights = 'KQkq', rawEp = '-';
  let pending: GameState | undefined;
  const at = (square: string) => { const p = pieces.find(p => p.square === square && p.zone === 'board'); assert.ok(p, square); return p; };
  const capture = (p: PieceState, color: Color) => { p.square = null; p.zone = 'captured'; p.capturedBy = color; };
  const relocate = (from: string, to: string) => { assert.match(to, /^[a-h][1-8]$/); at(from).square = to as SquareName; };
  for (const [i, step] of trace.steps.entries()) {
    const n = i + 1, action = step.action, before = state;
    assert.ok(rationale[i]!.startsWith(`${n}.`));
    let event: GameEvent | undefined;
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to, p = at(from), victim = pieces.find(p => p.zone === 'board' && p.square === to);
      assert.ok(p.owner === turn.color || p.neutral);
      assert.ok(!victim || (victim.owner !== turn.color || p.neutral) && !victim.royal);
      assert.ok(geometry(pieces, p, to, !!victim), `step ${n}: movement geometry`);
      assert.ok(!hill.some(h => h.returned && h.pieceId === p.id), 'returned King cannot move');
      const merged = p.id === 'white-pawn-h2' && composite(pieces);
      const victimMerged = victim?.id === 'white-pawn-h2' && composite(pieces);
      event = { type: 'move', from: from as SquareName, to: to as SquareName };
      // These windows retain movement identities for the held movement reactions.
      if ([28, 32, 36, 40, 44, 52, 56, 60].includes(n))
        Object.assign(event, { movedPieceId: p.id, movedRoles: merged ? ['pawn', 'knight'] : [p.role] });
      if (victim) {
        capture(victim, turn.color);
        Object.assign(event, { capturedId: victim.id });
        if (victimMerged) {
          capture(pieces.find(p => p.id === 'white-knight-g1')!, turn.color);
          event.capturedIds = ['white-pawn-h2', 'white-knight-g1'];
          effects = effects.filter(e => (e as { type: string }).type !== 'confabulation');
          players.white.discard.push({ id: 'white-deck-0-confabulation', cardId: 'confabulation' });
        }
      }
      ep = [];
      if (p.role === 'pawn' && from[0] === to[0] && Math.abs(Number(from[1]) - Number(to[1])) === 2)
        ep = [{ target: `${from[0]}${(Number(from[1]) + Number(to[1])) / 2}` as SquareName, pawnId: p.id }];
      relocate(from, to);
      half = p.role === 'pawn' || victim ? 0 : half + 1;
      if (turn.color === 'black') full++;
      active = turn.color === 'white' ? 'b' : 'w'; rawEp = '-';
      shield = { player: turn.color, pieceIds: merged ? ['white-pawn-h2', 'white-knight-g1'] : [p.id], capturedOpponent: !!victim && victim.owner !== turn.color };
      turn.phase = 'afterMove'; turn.moveMade = true;
      if ([80, 90, 95, 115].includes(n)) pending = before;
    } else if (action.type === 'endTurn') {
      assert.equal(royalThreat(pieces, turn.color), false, `step ${n}: cannot end in check`);
      turn = { color: other(turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      shield = undefined;
      hill = hill.filter(h => !h.returned).map(h => ({ ...h, ...(h.player === turn.color ? { returning: true } : {}) }));
    } else if (action.type === 'returnKing') {
      assert.ok(action.to === 'a3' && n === 14 || action.to === 'd8' && n === 55);
      const item = hill.find(h => h.player === turn.color)!;
      assert.equal(item.returning, true);
      const p = pieces.find(p => p.id === item.pieceId)!;
      assert.equal(p.zone, 'away'); assert.ok(!pieces.some(p => p.square === action.to));
      p.square = action.to as SquareName; p.zone = 'board'; item.returned = true;
      rawEp = ep[0]?.target ?? '-';
    } else if (action.type === 'playCard') {
      const owner: Color = n === 24 ? 'black' : turn.color, hand = players[owner].hand;
      const cardIndex = hand.findIndex(c => c.id === action.cardInstanceId && c.cardId === action.cardId);
      assert.ok(cardIndex >= 0, `step ${n}: exact held physical instance`);
      assert.equal(turn.cardPlays[owner], 0);
      assert.ok(CARD_CATALOG[action.cardId]!.timing.includes(n === 24 ? 'afterOpponentMove' : turn.phase));
      const card = hand.splice(cardIndex, 1)[0]!;
      hand.push(players[owner].deck.shift()!); turn.cardPlays[owner]++;
      const retain = [4, 15, 71, 91].includes(n);
      if (!retain) players[owner].discard.push(card);
      event = { type: 'cardPlayed', cardId: action.cardId, ...(action.target === undefined ? {} : { target: action.target as GameEvent['target'] }) };
      if (n === 4) effects.push({ type: 'fortification', owner, card, from: 'h6', to: 'h7' });
      else if (n === 10 || n === 50) {
        const p = pieces.find(p => p.royal && p.owner === owner)!; p.zone = 'away'; p.square = null;
        hill.push({ pieceId: p.id, player: owner, returning: false });
        rights = n === 10 ? 'kq' : '-'; half++; if (owner === 'black') full++;
        active = owner === 'white' ? 'b' : 'w'; ep = []; rawEp = '-'; turn.moveMade = true; turn.phase = 'afterMove';
        shield = { player: owner, capturedOpponent: false, pieceIds: [] };
        Object.assign(event, { movement: [], preservePreviousMove: false });
      } else if ([15, 23, 48].includes(n)) {
        const pair = n === 15 ? ['g1', 'h3'] : n === 23 ? ['b1', 'a5'] : ['g5', 'e6'];
        assert.deepEqual(action.target, [{ from: pair[0], to: pair[1] }]);
        const p = at(pair[0]!);
        if (n === 15) {
          assert.equal(at('h3').id, 'white-pawn-h2'); assert.ok(geometry(pieces, p, 'h3', false));
          p.square = null; p.zone = 'away';
          effects.push({ type: 'confabulation', owner, card, pieceIds: ['white-pawn-h2', 'white-knight-g1'] });
        } else relocate(pair[0]!, pair[1]!);
        half = n === 48 ? 0 : half + 1; active = 'b'; ep = []; rawEp = '-'; turn.moveMade = true; turn.phase = 'afterMove';
        shield = { player: owner, capturedOpponent: false, pieceIds: n === 48 ? ['white-pawn-h2', 'white-knight-g1'] : [p.id] };
        Object.assign(event, { movement: action.target, preservePreviousMove: false });
      } else if (n === 24) {
        assert.equal(action.target, 'c2'); assert.equal(history.at(-1)?.cardId, 'long-jump');
        capture(at('c2'), 'black'); half = 0;
        Object.assign(event, { player: 'black', capturedId: 'white-pawn-c2', movement: [], preservePreviousMove: true });
      } else if (n === 53) {
        assert.deepEqual(action.target, [{ from: 'c7', to: 'b8' }]);
        assert.equal(history.at(-1)?.from, 'e6'); assert.ok(composite(pieces));
        capture(at('b8'), 'white'); relocate('c7', 'b8'); half = 0;
        Object.assign(event, { from: 'c7', to: 'b8', capturedId: 'black-knight-b8', movedPieceId: 'white-pawn-h2', movedRoles: ['pawn', 'knight'], preservePreviousMove: false, movement: action.target });
        shield = { player: 'white', capturedOpponent: true, pieceIds: ['white-pawn-h2', 'white-knight-g1'] };
      } else if (n === 62) {
        assert.deepEqual(action.target, [{ from: 'a2', to: 'd7' }, { from: 'f4', to: 'd6' }]);
        for (const [a, b] of [['a2', 'd7'], ['f4', 'd6']]) { const p = at(a!), q = at(b!); assert.equal(p.role, 'pawn'); assert.equal(q.role, 'pawn'); [p.square, q.square] = [q.square, p.square]; }
        half = 0; active = 'b'; ep = []; rawEp = '-'; turn.moveMade = true; turn.phase = 'afterMove';
        shield = { player: owner, capturedOpponent: false, pieceIds: [] };
        Object.assign(event, { movement: [{ from: 'a2', to: 'd7' }, { from: 'f4', to: 'd6' }, { from: 'd7', to: 'a2' }, { from: 'd6', to: 'f4' }], preservePreviousMove: false });
      } else if (n === 71) {
        assert.equal(action.target, 'f4'); const p = at('f4'); assert.equal(p.owner, 'black');
        p.neutral = true; p.neutralBeforeEffects = false;
        effects.push({ type: 'neutrality', owner, card, pieceId: p.id });
        Object.assign(event, { movement: [], preservePreviousMove: true });
      } else if (n === 78) {
        assert.deepEqual(action.target, { knight: 'g8', rook: 'c8' });
        const p = at('g8'), q = at('c8'); assert.equal(p.role, 'knight'); assert.equal(q.role, 'rook');
        [p.square, q.square] = [q.square, p.square];
        Object.assign(event, { movement: [{ from: 'c8', to: 'g8' }, { from: 'g8', to: 'c8' }], preservePreviousMove: true });
      } else if (n === 91) {
        effects.push({ type: 'doomsayer', owner, card });
        Object.assign(event, { movement: [], preservePreviousMove: true });
      } else {
        assert.ok([81, 96, 116].includes(n)); assert.ok(pending);
        assert.deepEqual(action.target, n === 81 ? { bishop: 'e3', knight: 'c8' } : n === 116 ? [{ from: 'c6', to: 'c8' }] : undefined);
        const staged = structuredClone(pieces);
        if (n === 81) {
          const bishop = staged.find(p => p.square === 'e3')!, knight = staged.find(p => p.square === 'c8')!;
          assert.equal(bishop.role, 'bishop'); assert.equal(knight.role, 'knight');
          [bishop.square, knight.square] = [knight.square, bishop.square];
        } else if (n === 116) {
          assert.equal(at('c6').role, 'pawn');
          assert.ok(!pieces.some(p => p.square === 'c7' || p.square === 'c8'));
          staged.find(p => p.square === 'c6')!.square = 'c8';
        }
        assert.equal(royalThreat(staged, owner), true, `step ${n}: proposed effect cannot cure the existing check`);
        event = { type: 'cardFizzled', cardId: action.cardId, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false };
      }
    } else {
      assert.equal(n, 92); assert.deepEqual(action, { type: 'namePiece', speaker: 'black', name: 'rook', losses: [{ effectId: 'white-deck-6-doomsayer', pieceId: 'black-rook-a8' }] });
      const proposedLoss = structuredClone(pieces);
      capture(proposedLoss.find(p => p.id === 'black-rook-a8')!, 'white');
      assert.equal(royalThreat(proposedLoss, 'white'), true, 'losing g8 Rook does not cure b4 Pawn check');
      effects = effects.filter(e => (e as { type: string }).type !== 'doomsayer');
      players.white.discard.push({ id: 'white-deck-6-doomsayer', cardId: 'doomsayer' });
      event = { type: 'cardFizzled', cardId: 'doomsayer', reason: 'SELF_CHECK', movement: [], preservePreviousMove: false };
    }
    if ([81, 92, 96, 116].includes(n)) {
      assert.ok(pending);
      pieces = structuredClone(pending.pieces); ep = structuredClone(pending.enPassant);
      const fields = pending.fen.split(' '); active = fields[1]!; rights = fields[2]!; rawEp = fields[3]!; half = Number(fields[4]); full = Number(fields[5]);
      history = structuredClone(pending.history); turn.phase = 'beforeMove'; turn.moveMade = false; pending = undefined;
    }
    if (event) history.push(event);
    state = act(before, action);
    assert.deepEqual(state.pieces, pieces, `step ${n}: every physical identity and captor`);
    assert.deepEqual(state.players, players, `step ${n}: exact card instances, draws and discards`);
    assert.deepEqual(state.turn, turn, `step ${n}: turn and allowance`);
    assert.deepEqual(state.effects, effects, `step ${n}: exact effects`);
    assert.deepEqual(state.history, history, `step ${n}: complete history and rewind`);
    assert.equal(state.fen, `${boardFen(pieces)} ${active} ${rights} ${rawEp} ${half} ${full}`, `step ${n}: six FEN fields`);
    assert.deepEqual(state.enPassant, ep);
    assert.deepEqual(state.shieldMove, shield, `step ${n}: full movement token`);
    assert.deepEqual(state.underElfHill ?? [], hill);
    for (const key of ['chaosForbidden', 'plotsExecution', 'riposteSkipped', 'riposteCheckDeferred'] as const) assert.equal(state[key], undefined, `step ${n}: ${key}`);
    for (const key of ['plotsAllowances', 'fogLocked', 'riposteLostMoves'] as const) assert.deepEqual(state[key] ?? [], [], `step ${n}: ${key}`);
    assert.equal(state.orientation, 0); assert.equal(state.outcome, null);
    assert.deepEqual(state.pendingDoomsayer ?? null, n === 91 ? { player: 'black', cardInstanceId: 'white-deck-6-doomsayer' } : null);
    for (const color of ['white', 'black'] as const) {
      const threat = royalThreat(pieces, color);
      // Neutrality's controller-safety qualification cannot affect this trace's
      // threat result: the neutral Pawn never geometrically attacks either King.
      const royal = pieces.find(p => p.royal && p.owner === color && p.zone === 'board');
      if (royal?.square) for (const neutral of pieces.filter(p => p.neutral && p.zone === 'board'))
        assert.equal(geometry(pieces, neutral, royal.square, true), false);
      assert.equal(threat, color === 'white' ? [80, 88, 89, 90, 91, 92, 115].includes(n) : [40, 41, 95].includes(n), `step ${n}: independently reviewed royal geometry`);
      assert.equal(isKingInCheck(state, color), threat);
    }
    // No generated opportunity has a geometrically adjacent opposing Pawn; check
    // the prospective captor beforeMove, not the original mover's reaction phase.
    for (const opportunity of ep) {
      const pawn = pieces.find(p => p.id === opportunity.pawnId)!;
      const captor = other(pawn.owner), prospective = structuredClone(state);
      prospective.turn = { color: captor, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      const prospectiveBefore = structuredClone(prospective);
      const destinations = legalDests(prospective, false);
      assert.deepEqual(prospective, prospectiveBefore, 'en-passant destination probe preserves its entire input context');
      for (const p of pieces.filter(p => p.zone === 'board' && p.role === 'pawn' && (p.owner === captor || p.neutral))) {
        assert.equal(geometry(pieces, p, opportunity.target, true), false);
        assert.ok(!destinations.get(p.square!)?.includes(opportunity.target));
      }
    }
    if (pending) {
      assert.ok(state.pendingRescue);
      assert.equal(state.pendingRescue.fen, pending.fen);
      assert.deepEqual(state.pendingRescue.pieces, pending.pieces);
      assert.deepEqual(state.pendingRescue.enPassant, pending.enPassant);
      assert.equal(state.pendingRescue.historyLength, pending.history.length);
      assert.deepEqual(state.pendingRescue.movedPieceIds, [n === 90 || n === 91 ? 'white-bishop-f1' : n === 95 ? 'black-king-e8' : 'white-king-e1']);
      assert.deepEqual(state.pendingRescue.before, pending);
      let rescued = state;
      for (const rescue of rescueActions(n)) rescued = rescueWithAccounting(rescued, rescue);
      const rescuePieces = structuredClone(pieces);
      if (n === 90 || n === 115) rescuePieces.find(p => p.square === 'b4')!.square = 'b5';
      else capture(rescuePieces.find(p => p.id === (n === 95 ? 'white-pawn-a2' : 'black-pawn-b7'))!, state.turn.color);
      assert.deepEqual(rescued.pieces, rescuePieces, `step ${n}: exact rescue identities and capture actor`);
      assert.equal(rescued.pendingRescue ?? null, null);
      assert.equal(royalThreat(rescued.pieces, state.turn.color), false, `step ${n}: concrete held-card rescue`);
      assert.equal(rescued.turn.moveMade, true, 'cure retains provisional move');
      act(rescued, { type: 'endTurn' });
    } else assert.equal(state.pendingRescue ?? null, null);
    if ([81, 92, 96, 116].includes(n)) assert.deepEqual(cardPlayTargets(state, 'mystic-shield'), [], 'inert rollback token grants no after-move permission');
  }
  assert.equal(trace.moves, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 15);
  assert.equal(state.fen, '2qk2rr/p3n2p/2pP4/4Pp1Q/Kp1P2BR/1P1bp3/p5P1/R1B5 w - - 2 27');
  assert.deepEqual(replayTrace(trace), state);
});
