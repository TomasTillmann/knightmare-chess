import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets, isKingInCheck, legalDests, underElfHillReturnSquares } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { Color, GameState, GameEvent, PieceState, SquareName, CardMove, CardInstance } from '../types.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/193.json', import.meta.url), 'utf8')) as RandomTrace;
test('iteration 193 deterministic replay', () => {
  assert.ok(replayTrace(trace));
});

// Individually reviewed in order against rules §§8–11, 13, 15, 17–20, 22.
const rationales = `
1. b2-b4: initial Pawn double step; b3/b4 empty, no opposing EP captor.
2. Close White's b4 turn; preserve b3 opportunity, reset both allowances.
3. b7-b6: Black Pawn advances one, expiring b3.
4. Close Black's b6 turn without changing the board or clocks.
5. b1-a3: Knight jumps to the vacant edge square.
6. Close White's Na3 turn.
7. g8-f6: Black Knight jumps to empty f6.
8. Close Black's Nf6 turn.
9. e2-e4: clear e3 intermediate; double-step opportunity has no Black captor.
10. Close White's e4 turn, preserving the opportunity.
11. f6-d5: Knight jump to empty d5 expires e3.
12. Close Black's Nd5 turn.
13. h2-h3: quiet Pawn step, subsequently canceled.
14. Black Knightmare rewinds h3, clocks and history; h2-h3 is forbidden for the replacement.
15. f1-d3: Bishop crosses vacated e2; this differs from the canceled Pawn move.
16. White Anathema swaps Black Bf8/Ra8, without movement, capture or lost castling entitlement.
17. Close the replacement White turn; both card allowances reset.
18. d7-d6: quiet Black Pawn step.
19. Close Black's d6 turn.
20. g1-f3: White Knight jumps to vacant f3.
21. Close White's Nf3 turn.
22. a8-b7: relocated Black Bishop makes a quiet diagonal move.
23. Black Holy War exchanges Nb8/Bb7; both identities survive and the previous move remains.
24. Close Black's Bishop/swap turn.
25. a3-b5: quiet White Knight jump, subsequently canceled.
26. Black Chaos restores Na3 and pre-move counters; a3-b5 becomes forbidden.
27. White Onslaught advances b4-b5 and h2-h3 simultaneously into empty squares, replacing the move.
28. Close White's two-Pawn replacement turn.
29. d5-f4: Black Knight jumps to vacant f4.
30. Close Black's Nf4 turn.
31. d1-e2: Queen moves one diagonal into empty e2.
32. Close White's Qe2 turn.
33. d6-d5: Black Pawn advances into empty d5.
34. Close Black's d5 turn.
35. e4-e5: White Pawn advances into empty e5.
36. Close White's e5 turn.
37. Black Split Knight attacks both e2 and d3 from f4; capture Queen, Bishop and the Knight itself.
38. Close Black's replacement turn; no moved physical identities were created by removal.
39. a3-b1: White Knight returns by a legal jump.
40. Close White's Nb1 turn.
41. c7-c5: clear c6 double step; White b5 can legally capture en passant on c6.
42. Close Black's c5 turn, retaining c6 until White chooses its move.
43. a2-a4: White declines c6, advances through empty a3, creates uncapturable a3 opportunity.
44. Close White's a4 turn.
45. f7-f5: Black double step; White e5 can capture en passant on f6.
46. Close Black's f5 turn, retaining f6 opportunity.
47. d2-d4: White declines f6 and double-steps through d3; no Black Pawn can capture on d3.
48. Close White's d4 turn.
49. f8-g8: relocated Black Rook makes an actual move, losing its retained queenside right.
50. Close Black's Rg8 turn.
51. c2-c3: White Pawn advances one square.
52. Close White's c3 turn.
53. Black Under Elf Hill takes the same royal identity away instead of moving; Black castling rights expire.
54. Close Black's absence turn, leaving the return due on Black's next turn.
55. a1-a3: White Rook crosses empty a2, losing queenside castling rights.
56. White Cowardice retreats Black e7-e8 into the empty back rank without promotion or clock changes.
57. Close White's turn; Black's mandatory King return is now due.
58. Return Black King on vacant edge a5; White Ra3 is blocked by a4, and b5 attacks a6, not a5.
59. b8-e5: Black Bishop crosses c7/d6 and captures White's e-Pawn; returned King remains stationary.
60. Close Black's turn, releasing the returned King's one-turn restriction.
61. e1-d2: White royal steps safely to d2, losing its remaining castling right.
62. Close White's Kd2 turn.
63. g8-f8: Black Rook moves one file into empty f8.
64. Close Black's Rf8 turn.
65. d2-e2: White King moves one file safely.
66. Close White's Ke2 turn.
67. e5-f6: Black Bishop retreats one diagonal.
68. Close Black's Bf6 turn.
69. c1-e3: White Bishop crosses vacant d2.
70. Close White's Be3 turn.
71. Black Breakthrough allows d5xd4 straight forward, replacing the move and capturing White's d-Pawn.
72. Close Black's forward-capture turn.
73. e3-g5: White Bishop crosses empty f4.
74. Close White's Bg5 turn.
75. f6-e5: Black Bishop returns one diagonal.
76. Close Black's Be5 turn.
77. White Haunting Memories copies last card Breakthrough, allowing b5xb6 and spending its own instance.
78. Close White's copied forward-capture turn.
79. c8-e6: Black Bishop crosses vacated d7.
80. Close Black's Be6 turn.
81. f3-d2: White Knight jumps to empty d2.
82. Close White's Nd2 turn.
83. b7-d6: Black Knight jumps to vacant d6.
84. Close Black's Nd6 turn.
85. d2-f1: White Knight retreats by a legal jump.
86. Close White's Nf1 turn.
87. Black Dark Mirror allows c5xb6 diagonally backward, capturing White's b-Pawn as the move.
88. Close Black's backward-capture turn.
89. f2-f3: White Pawn steps into vacant f3.
90. Close White's f3 turn.
91. e5-g3: Black Bishop crosses empty f4.
92. Black Fatal Attraction marks its Pawn d4; nearby White c3 is frozen, magnet itself remains movable.
93. Close Black's turn, retaining the physical Fatal Attraction card.
94. g5-c1: White Bishop crosses f4/e3/d2; passing through magnet-adjacent e3 is allowed.
95. Close White's Bc1 turn.
96. d8-h4: Black Queen crosses empty e7/f6/g5.
97. Close Black's Qh4 turn.
98. f1-h2: White Knight jumps without capturing, enabling Charge.
99. White Charge moves that same Knight h2-f1 once more; first move was quiet and clocks do not advance again.
100. Close White's extra-Knight-move turn.
101. d4xc3: Black magnet Pawn captures diagonally; its actual move discards Fatal Attraction and releases neighbors.
102. Black Coup marks a7 as royal while a5 becomes a capturable Prince; preserve both physical roles.
103. Close Black's Coup turn.
104. b1xc3: White Knight captures the former magnet Pawn.
105. Close White's Nxc3 turn.
106. h4-g5: Black Queen makes a quiet diagonal step.
107. Close Black's Qg5 turn.
108. h1-h2: White Rook makes a quiet file step.
109. Close White's Rh2 turn.
110. e6-d5: Black Bishop makes a quiet diagonal step.
111. Black Vendetta requires captures whenever available; White Bc1 can capture Qg5 next.
112. Close Black's turn; White's legal capture keeps Vendetta active.
113. c1xg5: White Bishop crosses d2/e3/f4 and takes Black's Queen, satisfying Vendetta.
114. Close White's capture turn; Black Prince can capture a4.
115. a5xa4: Black Prince takes the Pawn; its exposed square is allowed because a7 is the royal piece.
116. Close Black's capture turn; White Knight has a legal capture on a4.
117. c3xa4: White Knight captures the non-royal Prince, satisfying Vendetta without capturing a King.
118. Close White's capture turn; Black Bishop can take Rh2.
119. g3xh2: Black Bishop takes White's Rook, satisfying Vendetta.
120. Close Black's turn; White still has legal captures, so Vendetta remains.
`.trim().split('\n');

const other = (c: Color): Color => c === 'white' ? 'black' : 'white';
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const square = (s: string): SquareName => { assert.match(s, /^[a-h][1-8]$/); return s as SquareName; };
const at = (m: GameState, s: string) => m.pieces.find(p => p.zone === 'board' && p.square === s);
const norm = <T>(x: T): T => JSON.parse(JSON.stringify(x));

function frozen(m: GameState, p: PieceState): boolean {
  if (m.underElfHill?.some(e => e.pieceId === p.id && e.returned)) return true;
  if (p.royal || !p.square) return false;
  return m.effects.some(raw => {
    const e = raw as { type: string; pieceId?: string };
    if (e.type !== 'fatal-attraction' || e.pieceId === p.id) return false;
    const magnet = m.pieces.find(q => q.id === e.pieceId && q.zone === 'board');
    if (!magnet?.square) return false;
    const [x, y] = xy(p.square!), [a, b] = xy(magnet.square);
    return Math.max(Math.abs(x - a), Math.abs(y - b)) === 1;
  });
}

function geometry(m: GameState, p: PieceState, to: string, capture: boolean): boolean {
  if (!p.square || frozen(m, p)) return false;
  const [x, y] = xy(p.square), [a, b] = xy(to), dx = a - x, dy = b - y;
  if (!dx && !dy) return false;
  if (p.role === 'knight') return Math.abs(dx * dy) === 2;
  if (p.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  if (p.role === 'pawn') {
    const d = p.owner === 'white' ? 1 : -1;
    return capture ? Math.abs(dx) === 1 && dy === d : dx === 0 && (dy === d || dy === 2 * d
      && (p.owner === 'white' ? y <= 1 : y >= 6) && !at(m, `${p.square[0]}${y + d + 1}`));
  }
  if (!(p.role !== 'bishop' && (dx === 0 || dy === 0) || p.role !== 'rook' && Math.abs(dx) === Math.abs(dy))) return false;
  for (let i = 1; i < Math.max(Math.abs(dx), Math.abs(dy)); i++) {
    if (at(m, `${String.fromCharCode(97 + x + Math.sign(dx) * i)}${y + Math.sign(dy) * i + 1}`)) return false;
  }
  return true;
}

function checked(m: GameState, color: Color): boolean {
  const king = m.pieces.find(p => p.owner === color && p.royal && p.zone === 'board');
  return !!king?.square && m.pieces.some(p => p.owner !== color && p.zone === 'board' && geometry(m, p, king.square!, true));
}

function epCaptures(m: GameState, color: Color): CardMove[] {
  return m.enPassant.flatMap(ep => {
    const victim = m.pieces.find(p => p.id === ep.pawnId && p.zone === 'board' && p.owner !== color);
    if (!victim || at(m, ep.target)) return [];
    return m.pieces.flatMap(p => {
      if (p.owner !== color || p.role !== 'pawn' || p.zone !== 'board' || !geometry(m, p, ep.target, true)) return [];
      const trial = structuredClone(m);
      const moved = trial.pieces.find(q => q.id === p.id)!;
      const taken = trial.pieces.find(q => q.id === victim.id)!;
      taken.square = null; taken.zone = 'captured'; moved.square = ep.target;
      return checked(trial, color) ? [] : [{ from: p.square!, to: ep.target }];
    });
  });
}

function captures(m: GameState, color: Color): CardMove[] {
  return m.pieces.filter(p => p.owner === color && p.zone === 'board').flatMap(p =>
    m.pieces.filter(v => v.owner !== color && !v.royal && v.zone === 'board' && geometry(m, p, v.square!, true)).flatMap(v => {
      const trial = structuredClone(m), mover = trial.pieces.find(q => q.id === p.id)!, victim = trial.pieces.find(q => q.id === v.id)!;
      mover.square = victim.square; victim.zone = 'captured'; victim.square = null;
      return checked(trial, color) ? [] : [{ from: p.square!, to: v.square! }];
    }));
}

function board(m: GameState): string {
  return Array.from({ length: 8 }, (_, row) => {
    let result = '', empty = 0;
    for (const f of 'abcdefgh') {
      const p = at(m, `${f}${8 - row}`);
      if (!p) { empty++; continue; }
      if (empty) { result += empty; empty = 0; }
      const role = ({ pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' })[p.role];
      result += p.owner === 'white' ? role.toUpperCase() : role;
    }
    return result + (empty || '');
  }).join('/');
}

test('iteration 193 independent physical, rule, resource and temporal oracle', () => {
  assert.equal(rationales.length, 120);
  assert.equal(trace.steps.length, rationales.length);
  assert.equal(trace.moves, 50);
  let actual = createGameState(trace.initial), model = createGameState(trace.initial);
  let side = 'w', rights = 'KQkq', half = 0, full = 1, fenEp = '-';
  let canceled: { state: GameState; side: string; rights: string; half: number; full: number; fenEp: string } | undefined;
  const cards: Record<number, [string, string, unknown?]> = {
    14: ['knightmare', 'black-hand-3-knightmare'],
    16: ['anathema', 'white-hand-0-anathema', { bishop: 'f8', rook: 'a8' }],
    23: ['holy-war', 'black-hand-2-holy-war', { knight: 'b8', bishop: 'b7' }],
    26: ['chaos', 'black-hand-4-chaos'],
    27: ['onslaught', 'white-deck-0-onslaught', [{ from: 'b4', to: 'b5' }, { from: 'h2', to: 'h3' }]],
    37: ['split-knight', 'black-hand-0-split-knight', { knight: 'f4', targets: ['e2', 'd3'] }],
    53: ['under-elf-hill', 'black-deck-2-under-elf-hill'],
    56: ['cowardice', 'white-hand-4-cowardice', [{ from: 'e7', to: 'e8' }]],
    71: ['breakthrough', 'black-hand-1-breakthrough', [{ from: 'd5', to: 'd4' }]],
    77: ['haunting-memories', 'white-hand-3-haunting-memories', [{ from: 'b5', to: 'b6' }]],
    87: ['dark-mirror', 'black-deck-5-dark-mirror', [{ from: 'c5', to: 'b6' }]],
    92: ['fatal-attraction', 'black-deck-1-fatal-attraction', 'd4'],
    99: ['charge', 'white-deck-1-charge', [{ from: 'h2', to: 'f1' }]],
    102: ['coup', 'black-deck-4-coup', 'a7'],
    111: ['vendetta', 'black-deck-7-vendetta'],
  };
  let moveCount = 0, cardCount = 0;
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, reason = rationales[index]!;
    assert.ok(reason.startsWith(`${n}. `));
    const prior = structuredClone(actual), actionBefore = structuredClone(action), original = structuredClone(model), actor = model.turn.color;
    const capture = (p: PieceState, owner: Color) => { assert.equal(p.royal, false, reason); p.zone = 'captured'; p.square = null; p.capturedBy = owner; };
    const advance = (pawnOrCapture: boolean) => {
      half = pawnOrCapture ? 0 : half + 1; full += actor === 'black' ? 1 : 0;
      side = actor === 'white' ? 'b' : 'w'; fenEp = '-'; model.enPassant = [];
      model.turn.moveMade = true; model.turn.phase = 'afterMove'; delete model.chaosForbidden;
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.equal(action.promotion, undefined);
      assert.equal(model.turn.moveMade, false, reason);
      const p = at(model, from)!, victim = at(model, to);
      assert.ok(p, reason); assert.equal(p.owner, actor, reason);
      assert.ok(!victim || victim.owner !== actor, reason);
      assert.ok(geometry(model, p, to, !!victim), reason);
      if (model.effects.some(e => (e as { type: string }).type === 'vendetta')) assert.ok(victim, reason);
      assert.ok(legalDests(actual).get(square(from))?.includes(square(to)), reason);
      canceled = { state: structuredClone(model), side, rights, half, full, fenEp };
      const id = p.id, role = p.role, victimId = victim?.id;
      if (victim) capture(victim, actor);
      p.square = square(to);
      const event: GameEvent = { type: 'move', from: square(from), to: square(to), ...(victimId ? { capturedId: victimId } : {}) };
      if (actor === 'white') { event.movedPieceId = id; event.movedRoles = [role]; }
      model.history.push(event);
      model.shieldMove = { player: actor, pieceIds: [id], capturedOpponent: !!victim };
      if (p.royal) rights = rights.replace(actor === 'white' ? /[KQ]/g : /[kqa]/g, '');
      if (id === 'black-rook-a8') rights = rights.replace(/[qa]/g, '');
      if (id === 'white-rook-a1') rights = rights.replace('Q', '');
      if (id === 'white-rook-h1') rights = rights.replace('K', '');
      advance(role === 'pawn' || !!victim);
      if (role === 'pawn' && Math.abs(Number(to[1]) - Number(from[1])) === 2) {
        model.enPassant = [{ target: square(`${from[0]}${(Number(from[1]) + Number(to[1])) / 2}`), pawnId: id }];
        fenEp = epCaptures(model, other(actor))[0]?.to ?? '-';
      }
      if (n === 101) {
        const effect = model.effects.pop() as { card: CardInstance };
        assert.equal(effect.card.cardId, 'fatal-attraction'); model.players.black.discard.push(effect.card);
      }
      moveCount++;
    } else if (action.type === 'endTurn') {
      assert.equal(model.turn.moveMade, true, reason);
      assert.equal(checked(model, actor), false, reason);
      model.turn = { color: other(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      delete model.shieldMove; delete model.chaosForbidden;
      if (n === 57) model.underElfHill = [{ pieceId: 'black-king-e8', player: 'black', returning: true }];
      if (n === 60) model.underElfHill = [];
      if (model.effects.some(e => (e as { type: string }).type === 'vendetta')) {
        assert.ok(captures(model, model.turn.color).length > 0, `${reason} independent capture keeps Vendetta active`);
        if (n === 120) assert.ok(captures(model, 'white').some(move => move.from === 'a4' && move.to === 'b6'),
          '120. Na4xb6 removes the Black Pawn in the independent physical simulation and leaves White royal e2 safe');
      }
    } else if (action.type === 'returnKing') {
      assert.equal(n, 58); assert.equal(action.to, 'a5'); assert.equal(at(model, 'a5'), undefined);
      assert.deepEqual(model.underElfHill, [{ pieceId: 'black-king-e8', player: 'black', returning: true }]);
      const p = model.pieces.find(p => p.id === 'black-king-e8')!;
      assert.equal(p.zone, 'away'); p.square = 'a5'; p.zone = 'board'; delete p.capturedBy;
      model.underElfHill![0]!.returned = true;
      assert.ok(underElfHillReturnSquares(actual).includes('a5'));
    } else {
      assert.equal(action.type, 'playCard', reason);
      if (action.type !== 'playCard') throw new Error(reason);
      cardCount++;
      assert.deepEqual([action.cardId, action.cardInstanceId, action.target], [...cards[n]!, ...Array(3 - cards[n]!.length).fill(undefined)], reason);
      const owner: Color = n === 14 || n === 26 ? 'black' : actor;
      const card = model.players[owner].hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(card, reason); assert.equal(card.cardId, action.cardId); assert.equal(model.turn.cardPlays[owner], 0);
      const timing = n === 14 || n === 26 ? 'afterOpponentMove' : model.turn.phase;
      assert.ok(CARD_CATALOG[action.cardId]!.timing.includes(timing));
      assert.ok(cardPlayTargets(actual, action.cardId).some(t => JSON.stringify(t) === JSON.stringify(action.target)), reason);
      let movement: CardMove[] = [], preservePreviousMove = true;
      let event: GameEvent = { type: 'cardPlayed', cardId: card.cardId, ...(action.target === undefined ? {} : { target: action.target as GameEvent['target'] }) };
      if (n === 14 || n === 26) {
        assert.ok(canceled);
        const from: SquareName = n === 14 ? 'h2' : 'a3', to: SquareName = n === 14 ? 'h3' : 'b5';
        const p = at(model, to)!;
        const forbid = `${p.id}:${from}:${to}`;
        ({ side, rights, half, full, fenEp } = canceled);
        model = structuredClone(canceled.state);
        model.chaosForbidden = { player: actor, movement: forbid };
        movement = [{ from: to, to: from }]; event.player = 'black';
      } else if (n === 16 || n === 23) {
        const a = at(model, n === 16 ? 'a8' : 'b8')!, b = at(model, n === 16 ? 'f8' : 'b7')!;
        assert.equal(a.role, n === 16 ? 'rook' : 'knight'); assert.equal(b.role, 'bishop');
        assert.equal(a.owner, 'black'); assert.equal(b.owner, 'black');
        movement = [{ from: a.square!, to: b.square! }, { from: b.square!, to: a.square! }];
        [a.square, b.square] = [b.square, a.square];
        if (n === 16) rights = rights.replace('q', 'a');
      } else if ([27, 56, 71, 77, 87, 99].includes(n)) {
        movement = action.target as CardMove[];
        const moved: string[] = [], captured: string[] = [];
        for (const { from, to } of movement) {
          const p = at(model, from)!, victim = at(model, to);
          assert.ok(p); assert.equal(p.owner, n === 56 ? other(actor) : actor);
          assert.equal(p.role, n === 99 ? 'knight' : 'pawn');
          assert.equal(frozen(model, p), false);
          const [x, y] = xy(from), [a, b] = xy(to), direction = p.owner === 'white' ? 1 : -1;
          if (n === 99) {
            assert.ok(geometry(model, p, to, !!victim));
            assert.deepEqual(original.shieldMove, { player: 'white', pieceIds: [p.id], capturedOpponent: false });
          } else {
            assert.equal(b - y, n === 56 || n === 87 ? -direction : direction);
            assert.equal(Math.abs(a - x), n === 87 ? 1 : 0);
            assert.equal(!!victim, [71, 77, 87].includes(n));
          }
          if (victim) { assert.equal(victim.owner, other(actor)); captured.push(victim.id); capture(victim, actor); }
          moved.push(p.id); p.square = to;
        }
        if (n === 77) {
          assert.equal([...model.history].reverse().find(e => e.type === 'cardPlayed')!.cardId, 'breakthrough');
          event.copiedCardId = 'breakthrough'; event.player = 'white';
        }
        if (captured[0]) event.capturedId = captured[0];
        if (n !== 56) {
          preservePreviousMove = false;
          model.shieldMove = { player: actor, pieceIds: moved, capturedOpponent: captured.length > 0 };
          if (n !== 99) advance(true);
          else { event.from = 'h2'; event.to = 'f1'; event.movedPieceId = moved[0]; event.movedRoles = ['knight']; }
        }
      } else if (n === 37) {
        const knight = at(model, 'f4')!;
        assert.equal(knight.role, 'knight'); assert.equal(knight.owner, actor);
        const victims = ['e2', 'd3'].map(s => at(model, s)!);
        for (const p of victims) { assert.equal(p.owner, other(actor)); assert.ok(geometry(model, knight, p.square!, true)); }
        event.capturedIds = [...victims, knight].map(p => p.id);
        for (const p of [...victims, knight]) capture(p, actor);
        preservePreviousMove = false; advance(true);
        model.shieldMove = { player: actor, pieceIds: [], capturedOpponent: true };
      } else if (n === 53) {
        const p = at(model, 'e8')!; assert.equal(p.royal, true); assert.equal(p.owner, actor);
        p.zone = 'away'; p.square = null;
        rights = rights.replace(/[kqa]/g, ''); preservePreviousMove = false; advance(false);
        model.shieldMove = { player: actor, pieceIds: [], capturedOpponent: false };
        model.underElfHill = [{ pieceId: p.id, player: actor, returning: false }];
      } else if (n === 92) {
        assert.equal(at(model, 'd4')!.owner, actor);
        model.effects.push({ type: 'fatal-attraction', owner, card, pieceId: 'black-pawn-d7' });
      } else if (n === 102) {
        const prince = at(model, 'a5')!, king = at(model, 'a7')!;
        assert.equal(prince.royal, true); assert.equal(king.role, 'pawn'); assert.equal(king.owner, actor);
        prince.royal = false; king.royal = true;
        model.effects.push({ type: 'coup', owner, card, princeId: prince.id, kingId: king.id, princeRole: 'king' });
      } else if (n === 111) model.effects.push({ type: 'vendetta', owner, card });
      else throw new Error(`Unreviewed card ${n}`);
      event.movement = movement; event.preservePreviousMove = preservePreviousMove;
      model.history.push(event);
      model.players[owner].hand = model.players[owner].hand.filter(c => c.id !== card.id);
      if (!CARD_CATALOG[card.cardId]!.continuing) model.players[owner].discard.push(card);
      const replacement = model.players[owner].deck.shift(); assert.ok(replacement); model.players[owner].hand.push(replacement);
      model.turn.cardPlays[owner]++;
    }
    model.fen = `${board(model)} ${side} ${rights || '-'} ${fenEp} ${half} ${full}`;
    const result = applyAction(actual, action);
    assert.deepEqual(actual, prior, `${reason} action/query immutability`);
    assert.deepEqual(action, actionBefore, `${reason} action payload immutability`);
    assert.ok(result.ok, reason); actual = result.state;
    assert.deepEqual(actual.pieces, model.pieces, `${reason} all physical identities/capture actors`);
    assert.deepEqual(actual.players, model.players, `${reason} all physical cards/decks/discards`);
    assert.equal(actual.fen, model.fen, `${reason} all six FEN fields`);
    assert.deepEqual(actual.turn, model.turn, `${reason} turn and card allowances`);
    assert.deepEqual(norm(actual.history), norm(model.history), `${reason} complete history including cancellation`);
    assert.deepEqual(actual.effects, model.effects, `${reason} retained effect records`);
    assert.deepEqual(actual.enPassant, model.enPassant, reason);
    assert.deepEqual(actual.underElfHill ?? [], model.underElfHill ?? [], reason);
    assert.deepEqual(actual.shieldMove, model.shieldMove, reason);
    assert.deepEqual(actual.chaosForbidden, model.chaosForbidden, reason);
    for (const key of ['plotsExecution', 'riposteSkipped', 'riposteCheckDeferred'] as const) assert.equal(actual[key], undefined, `${reason} ${key}`);
    for (const key of ['plotsAllowances', 'fogLocked', 'riposteLostMoves'] as const) assert.deepEqual(actual[key] ?? [], [], `${reason} ${key}`);
    for (const key of ['pendingRescue', 'pendingAbduction', 'pendingDoomsayer', 'outcome'] as const) assert.equal(actual[key] ?? null, null, `${reason} ${key}`);
    assert.equal(actual.orientation, 0, reason);
    const queryBefore = structuredClone(actual);
    for (const color of ['white', 'black'] as const) {
      assert.equal(checked(model, color), false, `${reason} independently safe ${color} royal`);
      assert.equal(isKingInCheck(actual, color), checked(model, color), reason);
      if (!model.enPassant.some(ep => model.pieces.some(p => p.owner === color && p.role === 'pawn'
        && p.zone === 'board' && geometry(model, p, ep.target, true)))) continue;
      const prospective = structuredClone(actual);
      prospective.turn = { color, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      prospective.fen = prospective.fen.replace(/ [wb] /, color === 'white' ? ' w ' : ' b ');
      const snapshot = structuredClone(prospective), dests = legalDests(prospective);
      const eps = epCaptures(model, color);
      for (const ep of model.enPassant) for (const p of model.pieces.filter(p => p.role === 'pawn' && p.owner === color && p.zone === 'board')) {
        if (geometry(model, p, ep.target, true) && !at(model, ep.target)) {
          assert.equal(dests.get(p.square!)?.includes(ep.target) ?? false, eps.some(e => e.from === p.square && e.to === ep.target), `${reason} EP legality`);
        }
      }
      assert.deepEqual(prospective, snapshot, `${reason} prospective query immutability`);
    }
    if (actual.chaosForbidden) {
      const forbidden = n === 14 ? { from: 'h2', to: 'h3' } : { from: 'a3', to: 'b5' };
      assert.equal(legalDests(actual).get(square(forbidden.from))?.includes(square(forbidden.to)) ?? false, false);
      const repeated = applyAction(actual, { type: 'move', ...forbidden });
      assert.equal(repeated.ok, false); assert.deepEqual(repeated.state, actual);
    }
    assert.deepEqual(actual, queryBefore, `${reason} check/EP/rejection query immutability`);
  }
  assert.equal(moveCount, 50); assert.equal(cardCount, 15);
  assert.equal(model.fen, '4pr1r/p5pp/1p1n4/3b1pB1/N7/R4P1P/4K1Pb/5N2 w - - 0 28');
});
