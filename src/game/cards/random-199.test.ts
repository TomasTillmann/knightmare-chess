import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';

// Independently reviewed in order against rules §§8–14, 16.3, 17.3, 20, 21.3,
// cards.md and the nine physical card images named by catalog.ts.
const rationales = `
1. g2-g4: White Pawn crosses empty g3; g4 empty; temporary g3 EP has no Black captor.
2. Close White move; preserve g3 opportunity and reset both card allowances.
3. b7-b6: Black Pawn advances one; expires g3 EP.
4. Close Black turn after b6; no card or mandatory choice remains.
5. b1-c3: White Knight jumps to empty c3.
6. Close White turn after Nc3.
7. g8-f6: Black Knight jumps to empty f6.
8. Close Black turn after Nf6.
9. e2-e4: White Pawn crosses empty e3; no adjacent Black EP captor.
10. Close White turn preserving the physical e3 opportunity.
11. h8-g8: Black Rook enters the Knight-vacated square; loses kingside castling.
12. Close Black turn after Rg8.
13. g4-g5: White Pawn advances one to empty g5.
14. Close White turn after g5.
15. g8-h8: Black Rook moves one square quietly; qualifies for Merciless.
16. Black hand-2 Merciless moves that same h8 Rook back to g8; no extra clock increment.
17. Close Black turn; Merciless spent and replaced once.
18. d1-h5: Queen diagonal e2-f3-g4 is empty.
19. Close White turn after Qh5.
20. d7-d6: Black Pawn advances one.
21. Close Black turn after d6.
22. e1-d1: King enters vacated Queen square; loses both White castling rights.
23. Close White turn after Kd1.
24. d6-d5: Black Pawn advances to empty d5.
25. Close Black turn after d5.
26. f1-b5: Bishop crosses e2-d3-c4, all empty; checks Black King e8 along c6-d7.
27. White hand-4 Earthquake rotates forward to east/west; opponent a7 Pawn promotes Knight first, h2 Pawn Rook second; fixed squares persist.
28. Close White turn retaining Earthquake and both promoted physical Pawns; Black must answer Bb5 check.
29. c8-d7: Black Bishop enters vacated Pawn square and blocks Bb5-e8 check.
30. Close Black turn after Bd7.
31. g1-f3: White Knight jumps to empty f3.
32. Black hand-3 Plots is legal at any time; none of Fog, No Quarter, Crusade, Resurrection is currently eligible; draw cannot qualify retroactively.
33. White hand-2 Curse marks opposing Queen d8 after White move; independent White card allowance remains available.
34. End White turn closes unused Black Plots allowance; retains Curse and Earthquake.
35. b8-a6: Black Knight jumps to empty a6.
36. Close Black turn after Na6.
37. h5-h7: Queen crosses empty h6 and captures physical Black h7 Pawn.
38. Close White turn; h7 Pawn stays captured by White.
39. f6-h7: Black Knight captures the White Queen.
40. Close Black turn; Queen stays captured by Black.
41. White deck-1 Madman replaces move: d2 Pawn jumps over occupied c3 Knight to empty b4; Knight survives.
42. Close White replacement move; Madman spent and replaced.
43. d7-b5: Black Bishop crosses c6 and captures original White f1 Bishop.
44. Close Black turn; Bishop stays captured by Black.
45. c1-f4: White Bishop crosses empty d2-e3.
46. Close White turn after Bf4.
47. d5-c5: Earthquake Black Pawn moves west one square.
48. Close Black turn after c5.
49. h1-e1: Rook crosses empty g1-f1.
50. White deck-2 Holy Quest swaps opposing a6 Knight and b5 Bishop; no capture or move-clock change.
51. Close White turn retaining swapped physical identities.
52. c7-b7: Black Pawn advances west to empty b7.
53. Close Black turn after b7.
54. f4-g3: White Bishop steps diagonally to empty g3.
55. Close White turn after Bg3.
56. b5-c7: Black Knight jumps to the vacated c7 square.
57. Close Black turn after Nc7.
58. f3-d2: White Knight jumps to the Madman-vacated square.
59. Close White turn after Nd2.
60. a8-b8: Black Rook moves quietly; removes last castling right.
61. Black deck-1 Mystic Shield selects just-moved physical a8 Rook at b8; protection applies on next White turn.
62. Close Black turn; Shield remains for White turn.
63. g3-h4: White Bishop moves diagonally; protected Rook untouched.
64. Close White turn and expire Black Rook Shield.
65. a6-b5: Black Bishop steps diagonally to empty b5.
66. Close Black turn after Bb5.
67. a1-c1: White Rook crosses empty b1.
68. Close White turn after Rc1.
69. a7-c6: Earthquake-promoted physical Pawn moves as Knight.
70. Close Black turn after Nc6; promoted identity persists.
71. e1-e2: White Rook enters vacated Pawn square.
72. Close White turn after Re2.
73. b5-a6: Black Bishop returns diagonally.
74. Close Black turn after Ba6.
75. c3-a4: White Knight jumps to empty a4.
76. Close White turn after Na4.
77. g8-h8: Black Rook moves quietly; castling rights stay absent.
78. Close Black turn after Rh8.
79. d2-f1: White Knight jumps to empty f1.
80. Close White turn after Nf1.
81. h7-f6: Black Knight jumps to empty f6.
82. Close Black turn after Nf6.
83. a4-c3: White Knight returns to empty c3.
84. Close White turn after Nc3.
85. b8-a8: Black Rook returns; rights do not regenerate.
86. Close Black turn after Ra8.
87. c1-b1: White Rook slides one square.
88. White hand-1 Holy War swaps own f1 Knight and h4 Bishop; Rook remains latest moved identity.
89. Close White turn with swapped identities, no capture.
90. f6-h7: Black Knight jumps to empty h7.
91. Close Black turn after Nh7.
92. c3-d5: White Knight jumps to empty d5.
93. Close White turn after Nd5.
94. c5-b5: Black Pawn advances west under Earthquake.
95. Close Black turn after b5.
96. b1-c1: White Rook slides one square.
97. White hand-0 Anathema swaps opposing a6 Bishop and h8 Rook; nonmove swap preserves Rook c1 movement trigger.
98. Close White turn preserving exchanged Black identities.
99. h7-g5: Black Knight captures physical White g2 Pawn.
100. Close Black turn; Pawn remains captured by Black.
101. d5-e3: White Knight jumps to empty e3.
102. Close White turn after Ne3.
103. d8-b8: Cursed Queen crosses empty c8, moves exactly two squares within Curse ceiling.
104. Close Black turn; Curse stays attached to Queen now b8.
105. c1-a1: White Rook crosses empty b1.
106. Close White turn after Ra1.
107. g5-h7: Black Knight jumps to empty h7.
108. Close Black turn after Nh7.
109. e3-g2: White Knight jumps to captured Pawn original square.
110. Close White turn; 50 Regular Move commands and nine card plays reviewed.
`.trim().split('\n');

const cardActions: Record<number, GameAction> = {
  16: { type: 'playCard', cardId: 'merciless', cardInstanceId: 'black-hand-2-merciless', target: [{ from: 'h8', to: 'g8' }] },
  27: { type: 'playCard', cardId: 'earthquake', cardInstanceId: 'white-hand-4-earthquake', target: { direction: 'counterclockwise', promotions: [{ square: 'a7', role: 'knight' }, { square: 'h2', role: 'rook' }] } },
  32: { type: 'playCard', cardId: 'plots-within-plots', cardInstanceId: 'black-hand-3-plots-within-plots', target: { player: 'black' } },
  33: { type: 'playCard', cardId: 'curse', cardInstanceId: 'white-hand-2-curse', target: 'd8' },
  41: { type: 'playCard', cardId: 'madman', cardInstanceId: 'white-deck-1-madman', target: [{ from: 'd2', to: 'b4' }] },
  50: { type: 'playCard', cardId: 'holy-quest', cardInstanceId: 'white-deck-2-holy-quest', target: { bishop: 'b5', knight: 'a6' } },
  61: { type: 'playCard', cardId: 'mystic-shield', cardInstanceId: 'black-deck-1-mystic-shield', target: 'b8' },
  88: { type: 'playCard', cardId: 'holy-war', cardInstanceId: 'white-hand-1-holy-war', target: { knight: 'f1', bishop: 'h4' } },
  97: { type: 'playCard', cardId: 'anathema', cardInstanceId: 'white-hand-0-anathema', target: { bishop: 'a6', rook: 'h8' } },
};
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const sq = (x: number, y: number) => `${String.fromCharCode(97 + x)}${y + 1}` as SquareName;
const other = (c: Color): Color => c === 'white' ? 'black' : 'white';
const at = (pieces: PieceState[], s: string) => pieces.find(p => p.zone === 'board' && p.square === s);

function geometry(pieces: PieceState[], p: PieceState, to: string, orientation: number, cursed: boolean, capture: boolean): boolean {
  const [x, y] = xy(p.square!); const [a, b] = xy(to);
  const dx = a - x, dy = b - y, ax = Math.abs(dx), ay = Math.abs(dy);
  if (!ax && !ay || cursed && p.id === 'black-queen-d8' && Math.max(ax, ay) > 2) return false;
  if (p.role === 'knight') return ax * ay === 2;
  if (p.role === 'king') return Math.max(ax, ay) === 1;
  if (p.role === 'pawn') {
    const sign = p.owner === 'white' ? 1 : -1;
    const fwd = orientation === 90 ? dx * sign : dy * sign;
    const side = orientation === 90 ? ay : ax;
    if (capture) return fwd === 1 && side === 1;
    const start = orientation === 90 ? (p.owner === 'white' ? x : 7 - x) : (p.owner === 'white' ? y : 7 - y);
    return side === 0 && (fwd === 1 || fwd === 2 && start <= 1
      && !at(pieces, sq(x + (orientation === 90 ? sign : 0), y + (orientation === 90 ? 0 : sign))));
  }
  if (!(p.role === 'queen' && (ax === ay || !dx || !dy) || p.role === 'bishop' && ax === ay || p.role === 'rook' && (!dx || !dy))) return false;
  for (let k = 1; k < Math.max(ax, ay); k++) if (at(pieces, sq(x + Math.sign(dx) * k, y + Math.sign(dy) * k))) return false;
  return true;
}

function threatened(pieces: PieceState[], color: Color, orientation: number, cursed: boolean): boolean {
  const king = pieces.find(p => p.royal && p.owner === color)!;
  // Shield only protects a nonroyal Black Rook in this trace, so never suppresses a royal capture.
  return pieces.some(p => p.zone === 'board' && p.owner !== color && geometry(pieces, p, king.square!, orientation, cursed, true));
}

function placement(pieces: PieceState[]): string {
  const letters = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, rank) => {
    let line = '', empty = 0;
    for (let x = 0; x < 8; x++) {
      const p = at(pieces, sq(x, 7 - rank));
      if (!p) { empty++; continue; }
      if (empty) { line += empty; empty = 0; }
      line += p.owner === 'white' ? letters[p.role].toUpperCase() : letters[p.role];
    }
    return line + (empty || '');
  }).join('/');
}

test('iteration 199: independent 110-action physical, card, royal, FEN and obligation oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/199.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.steps.length, rationales.length);
  let state = createGameState(trace.initial);
  const pieces = structuredClone(state.pieces), players = structuredClone(state.players);
  const history: GameEvent[] = [], played: NonNullable<GameState['playedCards']> = [];
  let effects: unknown[] = [], orientation = 0, rights = 'KQkq', half = 0, full = 1;
  let turn: GameState['turn'] = { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
  let fenColor: Color = 'white', ep: GameState['enPassant'] = [], shield: GameState['shieldMove'];
  let plots: GameState['plotsAllowances'], response: GameState['cardResponse'];
  let moves = 0, cards = 0;
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, reason = rationales[index]!;
    assert.ok(reason.startsWith(`${n}. `));
    const before = structuredClone(state), payload = structuredClone(action);
    const cursed = n >= 33;
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.match(from, /^[a-h][1-8]$/); assert.match(to, /^[a-h][1-8]$/);
      assert.ok(reason.includes(`${from}-${to}`));
      const p = at(pieces, from)!; assert.ok(p, reason);
      const victim = at(pieces, to);
      assert.equal(p.owner, turn.color, reason); assert.equal(turn.moveMade, false);
      assert.ok(!victim || victim.owner !== turn.color && !victim.royal, reason);
      assert.ok(geometry(pieces, p, to, orientation, cursed, !!victim), reason);
      const event: GameEvent = { type: 'move', from: from as SquareName, to: to as SquareName };
      if (victim) {
        event.capturedId = victim.id; victim.zone = 'captured'; victim.square = null; victim.capturedBy = turn.color;
      }
      if (turn.color === 'black') { event.movedPieceId = p.id; event.movedRoles = [p.role]; }
      history.push(event);
      half = victim || p.role === 'pawn' ? 0 : half + 1;
      if (p.role === 'king') rights = rights.replace(p.owner === 'white' ? /[KQ]/g : /[kq]/g, '');
      const lost: Record<string, string> = { 'black-rook-h8': 'k', 'black-rook-a8': 'q', 'white-rook-a1': 'Q', 'white-rook-h1': 'K' };
      if (lost[p.id]) rights = rights.replace(lost[p.id]!, '');
      const [x, y] = xy(from), [a, b] = xy(to);
      ep = p.role === 'pawn' && Math.max(Math.abs(a - x), Math.abs(b - y)) === 2
        ? [{ target: sq((x + a) / 2, (y + b) / 2), pawnId: p.id }] : [];
      p.square = to as SquareName;
      shield = { player: turn.color, pieceIds: [p.id], capturedOpponent: !!victim };
      if (turn.color === 'black') full++;
      fenColor = other(turn.color); turn.phase = 'afterMove'; turn.moveMade = true;
      response = undefined; plots = undefined; moves++;
    } else if (action.type === 'playCard') {
      assert.deepEqual(action, cardActions[n], reason); cards++;
      const owner: Color = [16, 32, 61].includes(n) ? 'black' : 'white';
      assert.equal(turn.cardPlays[owner], 0, reason);
      assert.equal(turn.phase, n === 41 ? 'beforeMove' : 'afterMove', reason);
      assert.ok(n === 32 || owner === turn.color, reason);
      const zone = players[owner]; const cardIndex = zone.hand.findIndex(c => c.id === action.cardInstanceId);
      assert.ok(cardIndex >= 0, reason); const [card] = zone.hand.splice(cardIndex, 1); assert.ok(card);
      assert.equal(card.cardId, action.cardId);
      if (![27, 33].includes(n)) zone.discard.push(card);
      const draw = zone.deck.shift(); assert.ok(draw); zone.hand.push(draw);
      turn.cardPlays[owner]++; played.push({ player: owner, cardInstanceId: card.id });
      const event: GameEvent = { type: 'cardPlayed', cardId: action.cardId, target: action.target as GameEvent['target'], movement: [], preservePreviousMove: true };
      if (n === 16) {
        const p = at(pieces, 'h8')!; assert.equal(p.id, 'black-rook-h8');
        assert.deepEqual(shield, { player: 'black', pieceIds: [p.id], capturedOpponent: false });
        assert.ok(!at(pieces, 'g8')); p.square = 'g8';
        Object.assign(event, { from: 'h8', to: 'g8', movedPieceId: p.id, movedRoles: ['rook'], movement: [{ from: 'h8', to: 'g8' }], preservePreviousMove: false });
      } else if (n === 27) {
        orientation = 90;
        Object.assign(at(pieces, 'a7')!, { role: 'knight', promoted: true });
        Object.assign(at(pieces, 'h2')!, { role: 'rook', promoted: true });
        effects.push({ type: 'earthquake', owner, card, direction: 'counterclockwise', target: action.target });
      } else if (n === 32) {
        delete event.target; event.player = owner;
        plots = [{ player: owner, remaining: 2, eligibleCards: [], window: {
          phase: 'afterMove', moveMade: true, shieldMove: structuredClone(shield), reaction: { type: 'move', from: 'g1', to: 'f3' },
          capture: undefined, cardResponse: undefined, fogCheckpoint: undefined, legacyCapture: undefined,
        } }];
      } else if (n === 33) effects.push({ type: 'curse', owner, card, pieceId: 'black-queen-d8' });
      else if (n === 41) {
        const p = at(pieces, 'd2')!; assert.equal(p.id, 'white-pawn-d2');
        assert.equal(at(pieces, 'c3')!.id, 'white-knight-b1'); assert.ok(!at(pieces, 'b4'));
        p.square = 'b4'; half = 0; ep = []; fenColor = 'black'; turn.phase = 'afterMove'; turn.moveMade = true;
        shield = { player: owner, pieceIds: [p.id], capturedOpponent: false };
        event.movement = [{ from: 'd2', to: 'b4' }]; event.preservePreviousMove = false;
      } else if (n === 61) {
        assert.deepEqual(shield, { player: owner, pieceIds: ['black-rook-a8'], capturedOpponent: false });
        effects.push({ type: 'mystic-shield', owner, player: owner, pieceId: 'black-rook-a8' }); event.player = owner;
      } else {
        const [a, b] = n === 50 ? ['a6', 'b5'] : n === 88 ? ['h4', 'f1'] : ['a6', 'h8'];
        const first = at(pieces, a!)!, second = at(pieces, b!)!;
        const expectedOwner = n === 88 ? 'white' : 'black';
        assert.equal(first.owner, expectedOwner); assert.equal(second.owner, expectedOwner);
        assert.deepEqual([first.role, second.role], n === 50 ? ['knight', 'bishop'] : n === 88 ? ['bishop', 'knight'] : ['bishop', 'rook']);
        first.square = b as SquareName; second.square = a as SquareName;
        event.movement = [{ from: a as SquareName, to: b as SquareName }, { from: b as SquareName, to: a as SquareName }];
      }
      history.push(event); response = { player: owner, historyLength: history.length };
    } else {
      assert.equal(action.type, 'endTurn'); assert.equal(turn.moveMade, true);
      if (n === 64) effects = effects.filter(e => (e as { type: string }).type !== 'mystic-shield');
      turn = { color: other(turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      shield = undefined; plots = undefined; response = undefined;
    }
    // No EP candidate exists for the prospective capturing player in either recorded double advance.
    for (const opportunity of ep) {
      const pawn = pieces.find(p => p.id === opportunity.pawnId)!;
      assert.equal(pawn.role, 'pawn');
      assert.equal(pieces.filter(p => p.owner !== pawn.owner && p.zone === 'board' && p.role === 'pawn'
        && geometry(pieces, p, opportunity.target, orientation, cursed, true)).length, 0);
    }
    const expectedFen: string = `${placement(pieces)} ${fenColor[0]} ${rights || '-'} - ${half} ${full}`;
    const result = applyAction(state, action);
    assert.deepEqual(state, before, `${reason}: immutable state`);
    assert.deepEqual(action, payload, `${reason}: immutable action payload`);
    assert.ok(result.ok, reason); state = result.state;
    assert.deepEqual(state.pieces, pieces, `${reason}: complete physical identities and capture actors`);
    assert.deepEqual(state.players, players, `${reason}: exact card zones/order`);
    assert.deepEqual(state.effects, effects, reason); assert.deepEqual(state.history, history, reason);
    assert.deepEqual(state.turn, turn, reason); assert.equal(state.orientation, orientation, reason);
    assert.equal(state.fen, expectedFen, `${reason}: all six FEN fields`); assert.deepEqual(state.enPassant, ep, reason);
    assert.deepEqual(state.shieldMove, shield, reason); assert.deepEqual(state.plotsAllowances ?? [], plots ?? [], reason);
    assert.deepEqual(state.playedCards ?? [], played, reason); assert.deepEqual(state.cardResponse, response, reason);
    for (const key of ['chaosForbidden', 'plotsExecution', 'riposteSkipped', 'riposteCheckDeferred'] as const) assert.equal(state[key], undefined, `${reason}: ${key}`);
    for (const key of ['fogLocked', 'riposteLostMoves', 'underElfHill'] as const) assert.deepEqual(state[key] ?? [], [], `${reason}: ${key}`);
    assert.equal(state.pendingRescue ?? null, null, reason); assert.equal(state.pendingAbduction ?? null, null, reason);
    assert.equal(state.pendingDoomsayer ?? null, null, reason); assert.equal(state.outcome, null, reason);
    const queried = structuredClone(state);
    for (const color of ['white', 'black'] as const) {
      const independentCheck = threatened(pieces, color, orientation, cursed);
      assert.equal(independentCheck, color === 'black' && n >= 26 && n <= 28, `${reason}: independent royal safety`);
      assert.equal(isKingInCheck(state, color), independentCheck, `${reason}: public royal query`);
    }
    const prospective = structuredClone(state);
    prospective.turn = { color: fenColor, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    const prospectiveBefore = structuredClone(prospective);
    const dests = ep.length ? legalDests(prospective) : new Map<SquareName, SquareName[]>();
    for (const opportunity of ep) for (const p of pieces.filter(p => p.zone === 'board' && p.role === 'pawn' && p.owner === fenColor)) {
      assert.ok(!dests.get(p.square!)?.includes(opportunity.target), `${reason}: no legal EP captor`);
    }
    assert.deepEqual(prospective, prospectiveBefore, `${reason}: immutable EP query`);
    assert.deepEqual(state, queried, `${reason}: immutable royal queries`);
  }
  assert.equal(moves, 50); assert.equal(cards, 9); assert.equal(history.length, 59);
  assert.equal(state.fen, 'rq2kb1b/1pn1pppn/rpn5/1p6/1P2P2N/8/PPP1RPNR/R2K1B2 b - - 5 26');
  assert.equal(replayTrace(trace).fen, state.fen);
});
