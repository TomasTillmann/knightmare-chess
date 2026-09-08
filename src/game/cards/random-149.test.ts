import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Every numbered line was reviewed in order against rules.md and the printed catalog.
const rationales = `
1. g2-g3: one white Pawn step into an empty square.
2. White ends its completed move; Black receives its untouched allowance.
3. f7-f6: one black Pawn step; Black advances the fullmove counter.
4. Black Plots after f6 saves only Man-Trap eligibility: every corner is occupied for Dungeon, Crusade lacks a Bishop move, and Revenge requires an opponent move.
5. EndTurn closes both unused Plots plays.
6. g1-f3 is a Knight jump to an empty square.
7. EndTurn passes to Black without changing the board or clocks.
8. d7-d5 crosses empty d6; records d6 but no white Pawn can capture there.
9. EndTurn preserves the d6 physical opportunity.
10. d2-d4 crosses empty d3, replacing d6 with uncapturable d3.
11. EndTurn preserves d3 without inventing a capture.
12. a7-a5 crosses empty a6, replacing d3 with uncapturable a6.
13. EndTurn preserves a6.
14. b2-b4 crosses empty b3; black a5 cannot capture en passant from rank five.
15. EndTurn preserves uncapturable b3.
16. e7-e6 is a single Pawn step and expires b3.
17. EndTurn passes to White.
18. c1-f4 is a Bishop diagonal through empty d2 and e3.
19. White plays Vendetta after its move; retains the card as a Continuing Effect and draws Forbidden City.
20. Black has the legal a5xb4 capture, so Vendetta persists.
21. a5xb4 captures white-pawn-b2 for Black and satisfies Vendetta.
22. White has f4xc7, so Vendetta persists.
23. f4xc7 crosses empty e5 and d6; captures black-pawn-c7 for White.
24. Black has d8xc7, so Vendetta persists.
25. d8xc7 captures the Bishop for Black in one diagonal step.
26. White has no legal capture; independently enumerate them and discard Vendetta.
27. f3-e5 is an unobstructed Knight jump, now permitted without capture.
28. EndTurn passes to Black.
29. f6-f5 is a single black Pawn step.
30. EndTurn passes to White.
31. Lost Castle swaps the distinct opposing Rooks a1/a8, keeps their identities, removes Qq rights, and consumes White's move.
32. EndTurn passes to Black after the replacement move.
33. g8-f6 is a Knight jump into the vacated Pawn square.
34. EndTurn passes to White.
35. e5-c4 is a Knight jump into an empty square.
36. EndTurn passes to Black.
37. f5-f4 is a single black Pawn step.
38. EndTurn passes to White.
39. c4-e5 is a Knight jump into an empty square.
40. EndTurn passes to Black.
41. c7-d7 is one horizontal Queen step.
42. EndTurn passes to White.
43. e5-c4 is a Knight jump into an empty square.
44. EndTurn passes to Black.
45. f4xg3 captures white-pawn-g2 for Black and resets the clock.
46. White Chaos immediately restores the captured Pawn and f4 attacker, pre-move FEN and clocks; Black must choose a different physical movement.
47. g7-g6 differs from the forbidden f4xg3 capture and completes Black's replacement.
48. EndTurn resets both allowances.
49. a8-a4 moves White's exchanged Rook through empty a7, a6, a5.
50. White Abduction removes the opposing nonroyal Bishop c8 temporarily; saves the exact pre-card board and starts concealment.
51. Reveal changes only concealment to recall; no second draw or move.
52. Black correctly recalls black Bishop c8 with its exact identity; restore it without capture or clock change.
53. EndTurn closes the resolved Abduction response window.
54. b7-b6 is a single black Pawn step.
55. EndTurn passes to White.
56. c2-c3 is a single white Pawn step.
57. EndTurn passes to Black.
58. e8-d8 is one royal King step into a safe empty square; revoke k.
59. Black Dungeon relocates opposing Rook a4 to empty corner a8; bind White's next-turn immobility to white-rook-a1.
60. EndTurn starts the restricted White turn.
61. g3-g4 moves a different Pawn; the dungeon Rook remains at a8.
62. White finishes the restricted turn, expiring Dungeon.
63. h8-g8 is a single horizontal Rook step.
64. EndTurn passes to White.
65. a8-a5 crosses empty a7 and a6 after Dungeon has expired.
66. EndTurn passes to Black.
67. d7-e7 is one horizontal Queen step.
68. EndTurn passes to White.
69. d1-c1 is one horizontal Queen step into the vacated Bishop square.
70. EndTurn passes to Black.
71. Bombard a1xa5 jumps exactly one obstruction, White Pawn a2, then passes empty a3/a4 and captures White Rook a5; a2 is untouched.
72. EndTurn follows Black's completed replacement move.
73. Madman jumps White Pawn d4 over occupied c3 to empty b2; the c3 Pawn survives, no promotion or en passant.
74. EndTurn follows White's replacement move.
75. e7-g7 crosses empty f7 horizontally.
76. EndTurn passes to White.
77. c4-e3 is a Knight jump into an empty square.
78. EndTurn passes to Black.
79. g7-d7 crosses empty f7 and e7 horizontally.
80. EndTurn passes to White.
81. h1-g1 is a horizontal Rook step; revoke White's remaining K right.
82. EndTurn passes to Black.
83. a5-c5 crosses empty b5 horizontally.
84. EndTurn passes to White.
85. b2-b3 moves the physical d2 Pawn one step.
86. Coup marks the owned Knight b1 as royal, leaves its Knight powers, and turns e1 into a capturable Prince; retain the card and draw Mystic Shield.
87. EndTurn preserves the new royal identity b1.
88. d5-d4 is a single black Pawn step.
89. EndTurn passes to White.
90. g1-g2 moves the Rook vertically into an empty square.
91. EndTurn passes to Black.
92. d4xe3 captures the nonroyal g1 Knight for Black, leaving royal b1 untouched.
93. EndTurn passes to White.
94. Fanatic moves a2-a5 across empty a3 and a4 to empty a5, exactly three forward; no en passant is created.
95. EndTurn follows White's replacement move.
96. Dark Mirror b4xa5 captures diagonally backward for Black; capture white-pawn-a2, reset clock, complete replacement move.
97. EndTurn passes to White.
98. Prince e1-d2 may enter an attacked square; it is no longer royal and b1 remains safe.
99. EndTurn passes to Black.
100. d7-d6 is one vertical Queen step.
101. EndTurn passes to White.
102. g2-g3 is one vertical Rook step.
103. EndTurn passes to Black.
104. e6-e5 is a single black Pawn step.
105. EndTurn passes to White.
106. f2-f3 is a single white Pawn step.
107. EndTurn passes to Black.
108. f8-e7 is one Bishop diagonal step.
109. EndTurn passes to White.
110. g3-h3 is one horizontal Rook step.
111. EndTurn passes to Black.
112. d6-d7 is one vertical Queen step.
113. EndTurn passes to White.
114. f1-g2 is one Bishop diagonal step.
115. EndTurn passes to Black.
116. f6-d5 is a Knight jump into an empty square.
117. EndTurn finishes the 50th regular move with White to act.
`.trim().split('\n');

const cardTargets: Record<number, [string, unknown]> = {
  4: ['plots-within-plots', { player: 'black' }], 19: ['vendetta', undefined],
  31: ['lost-castle', { own: 'a1', opponent: 'a8' }], 46: ['chaos', undefined],
  50: ['abduction', 'c8'], 59: ['dungeon', [{ from: 'a4', to: 'a8' }]],
  71: ['bombard', [{ from: 'a1', to: 'a5' }]], 73: ['madman', [{ from: 'd4', to: 'b2' }]],
  86: ['coup', 'b1'], 94: ['fanatic', 'a2'], 96: ['dark-mirror', [{ from: 'b4', to: 'a5' }]],
};
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const other = (c: Color): Color => c === 'white' ? 'black' : 'white';
const occupant = (pieces: PieceState[], s: string) => pieces.find(p => p.zone === 'board' && p.square === s);
function ray(pieces: PieceState[], from: string, to: string): PieceState[] {
  const [x, y] = xy(from), [u, v] = xy(to), dx = u - x, dy = v - y;
  assert.ok(dx || dy);
  assert.ok(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy), `${from}-${to}: actual ray alignment`);
  const blocks: PieceState[] = [];
  for (let n = 1; n < Math.max(Math.abs(dx), Math.abs(dy)); n++) {
    const square = `${String.fromCharCode(97 + x + Math.sign(dx) * n)}${y + Math.sign(dy) * n + 1}`;
    const p = occupant(pieces, square); if (p) blocks.push(p);
  }
  return blocks;
}
function attacks(pieces: PieceState[], p: PieceState, to: string): boolean {
  if (!p.square || p.square === to) return false;
  const [x, y] = xy(p.square), [u, v] = xy(to), dx = Math.abs(u - x), dy = Math.abs(v - y);
  if (p.role === 'pawn') return dx === 1 && v - y === (p.owner === 'white' ? 1 : -1);
  if (p.role === 'knight') return dx * dy === 2;
  if (p.role === 'king') return Math.max(dx, dy) === 1;
  const aligned = p.role === 'bishop' ? dx === dy : p.role === 'rook' ? dx === 0 || dy === 0 : dx === dy || dx === 0 || dy === 0;
  return aligned && ray(pieces, p.square, to).length === 0;
}
function threats(pieces: PieceState[], color: Color): string[] {
  const king = pieces.find(p => p.royal && p.owner === color)!;
  return pieces.filter(p => p.zone === 'board' && p.owner !== color && attacks(pieces, p, king.square!)).map(p => p.id);
}
function boardFen(pieces: PieceState[]): string {
  const roles = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, rank) => {
    let row = '', empty = 0;
    for (let file = 0; file < 8; file++) {
      const p = occupant(pieces, `${String.fromCharCode(97 + file)}${8 - rank}`);
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += p.owner === 'white' ? roles[p.role].toUpperCase() : roles[p.role];
    }
    return row + (empty || '');
  }).join('/');
}

test('iteration 149 independent semantics for all 117 actions', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/149.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860149);
  assert.equal(trace.steps.length, rationales.length);
  assert.equal(trace.moves, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 11);
  let state = createGameState(trace.initial);
  let pieces = structuredClone(state.pieces), players = structuredClone(state.players), turn = structuredClone(state.turn);
  let ep: GameState['enPassant'] = [], effects: unknown[] = [], rights = 'KQkq', half = 0, full = 1, active = 'w';
  let rewind: { pieces: PieceState[]; ep: GameState['enPassant']; rights: string; half: number; full: number; active: string } | undefined;
  let abductionBefore: GameState | undefined;
  const shift = (from: string, to: string, captor?: Color) => {
    assert.match(to, /^[a-h][1-8]$/);
    const p = occupant(pieces, from); assert.ok(p, `piece at ${from}`);
    const victim = occupant(pieces, to);
    if (victim) {
      assert.equal(victim.royal, false); assert.equal(victim.owner, other(captor!));
      victim.square = null; victim.zone = 'captured'; victim.capturedBy = captor;
    }
    p.square = to as SquareName;
    return p;
  };
  const finishMove = (pawn: boolean, capture: boolean) => {
    ep = []; half = pawn || capture ? 0 : half + 1;
    if (turn.color === 'black') full++;
    active = turn.color === 'white' ? 'b' : 'w'; turn.phase = 'afterMove'; turn.moveMade = true;
  };
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, label = rationales[index]!;
    assert.ok(label.startsWith(`${n}. `));
    const original = structuredClone(state);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.equal(turn.phase, 'beforeMove'); assert.equal(turn.moveMade, false);
      const p = occupant(pieces, from); assert.ok(p); assert.equal(p.owner, turn.color);
      const victim = occupant(pieces, to);
      assert.ok(!victim || victim.owner !== p.owner);
      if (p.role === 'pawn' && !victim) {
        const [x, y] = xy(from), [u, v] = xy(to), d = p.owner === 'white' ? 1 : -1;
        assert.equal(u, x); assert.ok(v - y === d || v - y === 2 * d && y === (p.owner === 'white' ? 1 : 6));
        assert.equal(ray(pieces, from, to).length, 0);
      } else assert.ok(attacks(pieces, p, to), label);
      if (n === 45) rewind = { pieces: structuredClone(pieces), ep: structuredClone(ep), rights, half, full, active };
      if ([21, 23, 25].includes(n)) assert.ok(victim, 'Vendetta requires the selected legal capture');
      if (n === 61) assert.notEqual(p.id, 'white-rook-a1', 'Dungeon physical restriction');
      shift(from, to, p.owner); finishMove(p.role === 'pawn', !!victim);
      if (p.role === 'pawn' && Math.abs(Number(from[1]) - Number(to[1])) === 2)
        ep = [{ target: `${from[0]}${(Number(from[1]) + Number(to[1])) / 2}` as SquareName, pawnId: p.id }];
      if (n === 58) rights = rights.replace('k', '');
      if (n === 81) rights = rights.replace('K', '');
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true);
      turn = { color: other(turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      if (n === 26) {
        const captures = pieces.flatMap(p => p.zone !== 'board' || p.owner !== 'white' ? [] : pieces.filter(v => v.zone === 'board' && v.owner === 'black' && attacks(pieces, p, v.square!)).filter(v => {
          const trial = structuredClone(pieces); trial.find(q => q.id === p.id)!.square = v.square;
          const gone = trial.find(q => q.id === v.id)!; gone.zone = 'captured'; gone.square = null;
          return threats(trial, 'white').length === 0;
        }));
        assert.deepEqual(captures, [], 'Vendetta expires only because no legal capture exists');
        players.white.discard.push({ id: 'white-hand-2-vendetta', cardId: 'vendetta' }); effects = [];
      }
      if (n === 62) effects = [];
    } else if (action.type === 'playCard') {
      assert.deepEqual([action.cardId, action.target], cardTargets[n], `exact target: ${label}`);
      const owner: Color = n === 46 ? 'white' : turn.color;
      assert.equal(turn.cardPlays[owner], 0);
      assert.ok(CARD_CATALOG[action.cardId]!.timing.includes(n === 46 ? 'afterOpponentMove' : turn.phase), label);
      if (n === 4) {
        assert.equal(turn.color, 'black'); assert.equal(turn.phase, 'afterMove'); assert.equal(turn.moveMade, true);
        const mover = occupant(pieces, 'f6')!;
        assert.equal(mover.id, 'black-pawn-f7'); assert.equal(mover.role, 'pawn');
        assert.equal(mover.owner, 'black', 'f6 is a concrete legal Man-Trap target');
        assert.equal(CARD_CATALOG['man-trap']!.timing.includes('afterMove'), true);
        for (const corner of ['a1', 'a8', 'h1', 'h8']) assert.ok(occupant(pieces, corner), 'Dungeon has no vacant fixed corner');
        assert.notEqual(mover.role, 'bishop', 'Crusade requires the just-moved Bishop');
        assert.deepEqual(CARD_CATALOG.revenge!.timing, ['afterOpponentMove']);
        assert.equal(pieces.some(p => p.zone === 'captured'), false, 'no capture occurred in either opening move');
      }
      const zone = players[owner], i = zone.hand.findIndex(c => c.id === action.cardInstanceId);
      assert.ok(i >= 0); const card = zone.hand.splice(i, 1)[0]!; assert.equal(card.cardId, action.cardId);
      const draw = zone.deck.shift(); assert.ok(draw); zone.hand.push(draw);
      if (![19, 86].includes(n)) zone.discard.push(card);
      turn.cardPlays[owner]++;
      if (n === 19) effects = [{ type: 'vendetta', owner, card }];
      if (n === 31) {
        assert.equal(turn.phase, 'beforeMove');
        const own = occupant(pieces, 'a1')!, opponent = occupant(pieces, 'a8')!;
        assert.equal(own.role, 'rook'); assert.equal(opponent.role, 'rook');
        assert.equal(own.owner, 'white'); assert.equal(opponent.owner, 'black');
        own.square = 'a8'; opponent.square = 'a1'; rights = 'Kk'; finishMove(false, false);
      }
      if (n === 46) {
        assert.ok(rewind); ({ pieces, ep, rights, half, full, active } = structuredClone(rewind));
        turn.phase = 'beforeMove'; turn.moveMade = false;
      }
      if (n === 50) {
        assert.equal(turn.phase, 'afterMove'); abductionBefore = original;
        const p = occupant(pieces, 'c8')!; assert.equal(p.owner, 'black'); assert.equal(p.royal, false);
        p.square = null; p.zone = 'away';
      }
      if (n === 59) {
        assert.equal(turn.phase, 'afterMove'); assert.equal(occupant(pieces, 'a8'), undefined);
        shift('a4', 'a8'); effects = [{ type: 'dungeon', owner, player: 'white', pieceId: 'white-rook-a1' }];
      }
      if (n === 71) {
        assert.equal(turn.phase, 'beforeMove');
        assert.deepEqual(ray(pieces, 'a1', 'a5').map(p => p.id), ['white-pawn-a2']);
        shift('a1', 'a5', 'black'); finishMove(false, true);
      }
      if (n === 73) {
        assert.equal(turn.phase, 'beforeMove');
        assert.equal(occupant(pieces, 'd4')!.originalRole, 'pawn');
        assert.equal(occupant(pieces, 'c3')!.id, 'white-pawn-c2'); assert.equal(occupant(pieces, 'b2'), undefined);
        shift('d4', 'b2'); finishMove(true, false);
      }
      if (n === 86) {
        assert.equal(turn.phase, 'afterMove');
        const king = occupant(pieces, 'e1')!, next = occupant(pieces, 'b1')!;
        assert.equal(next.role, 'knight'); assert.equal(next.owner, 'white'); king.royal = false; next.royal = true;
        effects = [{ type: 'coup', owner, card, princeId: king.id, kingId: next.id, princeRole: 'king' }];
      }
      if (n === 94) {
        assert.equal(turn.phase, 'beforeMove');
        for (const s of ['a3', 'a4', 'a5']) assert.equal(occupant(pieces, s), undefined);
        shift('a2', 'a5'); finishMove(true, false);
      }
      if (n === 96) {
        assert.equal(turn.phase, 'beforeMove');
        assert.equal(occupant(pieces, 'b4')!.role, 'pawn'); assert.equal(occupant(pieces, 'a5')!.owner, 'white');
        shift('b4', 'a5', 'black'); finishMove(true, true);
      }
    } else if (action.type === 'revealAbduction') {
      assert.equal(n, 51); assert.equal(state.pendingAbduction?.phase, 'concealment');
    } else if (action.type === 'answerAbduction') {
      assert.equal(n, 52);
      assert.deepEqual(action, { type: 'answerAbduction', player: 'black', owner: 'black', role: 'bishop', square: 'c8', pieceId: 'black-bishop-c8' });
      const p = pieces.find(p => p.id === 'black-bishop-c8')!; p.zone = 'board'; p.square = 'c8';
    } else assert.fail(`unreviewed action ${n}`);
    const result = applyAction(state, action);
    assert.deepEqual(state, original, `${label}: immutable input including capture attribution`);
    assert.ok(result.ok, label); state = result.state;
    assert.deepEqual(state.pieces, pieces, `${label}: independently tracked physical identities and captors`);
    assert.deepEqual(state.players, players, `${label}: physical card zones and draw order`);
    assert.deepEqual(state.turn, turn, label);
    assert.deepEqual(state.effects, effects, label);
    assert.equal(state.orientation, 0);
    assert.deepEqual(state.enPassant, ep, label);
    assert.equal(state.fen, `${boardFen(pieces)} ${active} ${rights || '-'} - ${half} ${full}`, `${label}: all six FEN fields`);
    assert.equal(state.pendingRescue ?? null, null); assert.equal(state.pendingDoomsayer ?? null, null);
    assert.deepEqual(state.underElfHill ?? [], []); assert.equal(state.outcome, null);
    assert.equal(state.plotsExecution, undefined);
    assert.deepEqual(state.plotsAllowances ?? [], n === 4 ? [{ player: 'black', remaining: 2, eligibleCards: ['black-hand-0-man-trap'], window: {
      phase: 'afterMove', moveMade: true, shieldMove: { player: 'black', pieceIds: ['black-pawn-f7'], capturedOpponent: false },
      capture: undefined, cardResponse: undefined, fogCheckpoint: undefined, legacyCapture: undefined,
      reaction: { type: 'move', from: 'f7', to: 'f6', movedPieceId: 'black-pawn-f7', movedRoles: ['pawn'] },
    } }] : []);
    assert.deepEqual(state.chaosForbidden, n === 46 ? { player: 'black', movement: 'black-pawn-f7:f4:g3|white-pawn-g2:g3:captured' } : undefined);
    assert.deepEqual(state.fogLocked ?? [], []); assert.deepEqual(state.riposteLostMoves ?? [], []);
    assert.equal(state.riposteSkipped, undefined); assert.equal(state.riposteCheckDeferred, undefined);
    assert.deepEqual(state.pendingAbduction ?? null, n === 50 || n === 51 ? {
      phase: n === 50 ? 'concealment' : 'recall', player: 'black', durationMs: 10000,
      pieceId: 'black-bishop-c8', requiresPieceId: false, before: abductionBefore,
    } : null);
    for (const color of ['white', 'black'] as const) {
      assert.deepEqual(threats(pieces, color), [], `${label}: independent royal attack geometry for ${color}`);
      assert.equal(isKingInCheck(state, color), false, label);
    }
    // Every EP record in this trace lacks any adjacent prospective capturing Pawn.
    for (const opportunity of ep) {
      const victim = pieces.find(p => p.id === opportunity.pawnId)!;
      const candidates = pieces.filter(p => p.zone === 'board' && p.role === 'pawn' && p.owner !== victim.owner && attacks(pieces, p, opportunity.target));
      assert.deepEqual(candidates, []);
      const prospective = { ...state, turn: { ...state.turn, color: other(victim.owner), phase: 'beforeMove' as const, moveMade: false } };
      const destinations = legalDests(prospective);
      for (const p of pieces.filter(p => p.role === 'pawn' && p.owner !== victim.owner && p.square))
        assert.ok(!(destinations.get(p.square!) ?? []).includes(opportunity.target), 'no legal EP capture in next-player context');
    }
  }
  assert.equal(state.fen, '1nbk2r1/3qb2p/1p4p1/p1rnp3/5pP1/1PP1pP1R/3KP1BP/1NQ5 w - - 5 28');
});

test('iteration 149 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/149.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(replayTrace(trace));
});
