import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameEvent, GameState, PieceState, Role, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Independently reviewed in order against rules §§8–11, 14.4, 15.5, 16.1/3,
// 17.1, 18.5, 22.7/8 and all eight played cards' printed artwork.
const rationale = `
1. b2-b4 advances the original White Pawn two empty squares through b3.
2. White closes the completed move; Black receives a fresh allowance.
3. c7-c5 advances the Black Pawn through vacant c6.
4. Black closes its move and White acts next.
5. g2-g4 advances through vacant g3 and resets the Pawn clock.
6. White ends its completed move without spending a card.
7. b8-a6 is an unobstructed Knight jump to an empty square.
8. Black closes its Knight move.
9. b4xc5 is a forward diagonal Pawn capture of black-pawn-c7 by White.
10. White closes the capture; the victim remains captured by White.
11. g8-h6 is a Knight jump to a vacant square.
12. Black ends the Knight move.
13. c5-c6 advances the original b2 Pawn one empty square.
14. White retains Fortification on adjacent f6/f7 after its move; f7 may be occupied.
15. White ends; the wall and its physical card persist.
16. h6xg4 is a Knight capture of white-pawn-g2 by Black.
17. Black plays Panic after the capture; White owes a timed next move.
18. Black ends; Panic carries into White's turn.
19. White marks its nonroyal c6 Pawn Pacifist before moving; Panic still applies.
20. g1-f3 is a quiet Knight jump; the completed move satisfies Panic.
21. White ends; the wall and Pacifism persist, while Panic has expired.
22. d7-d5 is a clear starting Pawn double step through d6.
23. Black ends with the d6 opportunity retained but no eligible White captor.
24. f3-g5 is an empty-square Knight jump.
25. White ends the Knight move.
26. d5-d4 advances Black's Pawn one empty square.
27. Black ends the Pawn move.
28. g5-h3 is a quiet Knight jump.
29. White ends its Knight move.
30. c8-f5 follows the open diagonal through d7 and e6 without crossing the wall.
31. Black ends its Bishop move.
32. Haunting Memories copies the latest nonunique Pacifism onto White's f2 Pawn before moving.
33. c1-a3 is a Bishop slide through vacant b2.
34. White ends; both distinct Pacifist identities remain marked.
35. f5-g6 is a one-square diagonal Bishop move, not the f6/f7 wall boundary.
36. Black ends the Bishop move.
37. a3-c1 returns the same Bishop along vacant b2.
38. White ends the Bishop move.
39. d8-d5 slides the Queen through vacant d7 and d6.
40. Black ends the Queen move.
41. f2-f4 quietly advances the Pacifist Pawn through f3; Pacifism permits quiet movement.
42. White ends; the f3 opportunity exists but no adjacent Black Pawn can capture.
43. d5xa2 follows c4/b3 and captures White's original a2 Pawn for Black.
44. Black's Mystic Shield targets the exact Queen just moved to a2 and protects it next White turn.
45. Black ends; the Queen's protection becomes active during White's turn.
46. c1-b2 quietly moves White's Bishop without capturing the protected Queen.
47. White ends its move and the temporary Mystic Shield expires.
48. a6-b8 is a quiet Knight jump back to its original square.
49. Black ends the Knight move.
50. h3-f2 jumps White's Knight to the square vacated by its Pacifist Pawn.
51. White ends the Knight move.
52. g6-d3 slides the Bishop through f5/e4 without crossing Fortification.
53. Black ends the Bishop move.
54. h2-h3 advances White's Pawn one empty square.
55. White ends the Pawn move.
56. b8-d7 is a quiet Knight jump, provisionally completed for reactions.
57. White's Knightmare cancels that exact move, restores b8/clocks/history, and forbids b8-d7.
58. b8-a6 is a genuinely different Knight replacement and clears the cancellation restriction.
59. Black closes the replacement, preserving White's spent Knightmare and replacement draw.
60. h3xg4 is a forward Pawn capture of Black's original g8 Knight by White.
61. White closes the capture.
62. a2-a4 slides Black's Queen through vacant a3.
63. Black ends the Queen move.
64. f2-h3 is a quiet White Knight jump.
65. White ends the Knight move.
66. d3-g6 slides the Bishop back through e4/f5.
67. Black ends the Bishop move.
68. g4-g5 quietly advances White's original h2 Pawn.
69. White ends the Pawn move.
70. e8-d7 moves Black's King one diagonal step; c6's raw Pawn attack is suppressed by Pacifism.
71. Black closes safely; both Black castling rights remain revoked.
72. h3-g1 is a quiet Knight jump.
73. White ends the Knight move.
74. b7-b5 advances through empty b6; raw b6 FEN does not grant the Pacifist c6 Pawn en passant.
75. Black ends; b6 serialization and physical opportunity persist, but legal en passant remains absent.
76. h1-h4 slides the Rook through h2/h3; moving this identity permanently revokes White K rights.
77. White ends its Rook move.
78. a4-a2 slides the Queen through vacant a3.
79. Black ends the Queen move.
80. h4-h3 is a quiet one-square Rook move.
81. White ends the Rook move.
82. a2-e6 slides the Queen through b3/c4/d5, all empty.
83. Black ends the Queen move.
84. h3-d3 slides White's Rook through g3/f3/e3, all empty.
85. White ends its Rook move.
86. a6-b4 is a quiet Black Knight jump.
87. Black ends the Knight move.
88. d3xd4 captures black-pawn-d7 for White and checks d7 along empty d5/d6.
89. White may close its checking move; Black receives its chance to answer the check.
90. b4-d5 is a Knight jump that interposes on the d4-d7 Rook ray and cures Black's check.
91. Black closes safely, with c6's separate geometric Pawn attack still Pacifist-suppressed.
92. b2-a3 is a one-square diagonal Bishop move.
93. White ends the Bishop move.
94. a8-e8 slides Black's Rook through b8/c8/d8, all empty; Black rights were already lost.
95. Black ends the Rook move.
96. c2-c4 advances a Pawn through vacant c3; no Black Pawn is beside c4 to capture en passant.
97. White ends and retains the physical c3 opportunity.
98. h7-h5 advances through h6; White's ordinary g5 Pawn now has a safe g5xh6 en-passant option.
99. Black ends; the h6 option survives for White before its move.
100. Resurrection returns White's captured original a2 Pawn to empty starting-rank g2, consuming the move and clearing en passant/captor.
101. Black immediately uses Vulture to retrieve that exact Resurrection; discard top evil-eye, then Vulture, and draw crab.
102. White ends the replacement move; Black's own-turn allowance resets despite its reaction.
103. e6-e3 slides the Queen through empty e5/e4.
104. Black ends the Queen move.
105. d4-d3 quietly moves White's Rook; d5 still blocks its line toward Black's King.
106. White ends the Rook move.
107. e3-f2 moves the Queen diagonally to give ordinary check to e1.
108. Black closes the checking move; White can answer with Kxf2, so no mate is final.
`.trim().split('\n');

const colors = ['white', 'black'] as const;
const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
const square = (value: string): SquareName => { assert.match(value, /^[a-h][1-8]$/); return value as SquareName; };
const xy = (value: string) => [value.charCodeAt(0) - 97, Number(value[1])] as const;
const at = (pieces: PieceState[], sq: string) => pieces.find(p => p.zone === 'board' && p.square === sq);
const ordered = (pieces: PieceState[]) => [...pieces].sort((a, b) => a.id.localeCompare(b.id));
const physicalStart = (): PieceState[] => colors.flatMap(owner => {
  const back: Role[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  return [owner === 'white' ? 1 : 8, owner === 'white' ? 2 : 7].flatMap((rank, row) => back.map((role, file) => {
    role = row ? 'pawn' : role;
    const sq = square(`${'abcdefgh'[file]}${rank}`);
    return { id: `${owner}-${role}-${sq}`, owner, role, originalRole: role, square: sq,
      zone: 'board', promoted: false, royal: role === 'king', neutral: false } satisfies PieceState;
  }));
});

function boardFen(pieces: PieceState[]): string {
  return Array.from({ length: 8 }, (_, row) => {
    let result = '', empty = 0;
    for (const file of 'abcdefgh') {
      const piece = at(pieces, `${file}${8 - row}`);
      if (!piece) { empty++; continue; }
      if (empty) result += empty;
      empty = 0;
      const letter = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }[piece.role];
      result += piece.owner === 'white' ? letter.toUpperCase() : letter;
    }
    return result + (empty || '');
  }).join('/');
}

// Board geometry is calculated from physical records, without reducer destinations/check helpers.
function reaches(pieces: PieceState[], piece: PieceState, to: string, capture: boolean, wall: boolean): boolean {
  assert.ok(piece.square);
  const [x, y] = xy(piece.square), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
  if (!dx && !dy) return false;
  if (piece.role === 'knight') return Math.abs(dx * dy) === 2;
  if (piece.role === 'king' && Math.max(Math.abs(dx), Math.abs(dy)) !== 1) return false;
  if (piece.role === 'pawn') {
    const direction = piece.owner === 'white' ? 1 : -1;
    if (capture) { if (Math.abs(dx) !== 1 || dy !== direction) return false; }
    else if (dx || !(dy === direction || dy === 2 * direction && y === (piece.owner === 'white' ? 2 : 7))) return false;
  }
  if (piece.role === 'bishop' && Math.abs(dx) !== Math.abs(dy)) return false;
  if (piece.role === 'rook' && dx !== 0 && dy !== 0) return false;
  if (piece.role === 'queen' && dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return false;
  let previous: string = piece.square;
  for (let distance = 1; distance <= Math.max(Math.abs(dx), Math.abs(dy)); distance++) {
    const next: string = `${String.fromCharCode(97 + x + Math.sign(dx) * distance)}${y + Math.sign(dy) * distance}`;
    if (wall && [previous, next].sort().join('/') === 'f6/f7') return false;
    if (next !== to && at(pieces, next)) return false;
    previous = next;
  }
  return true;
}

function threatened(pieces: PieceState[], color: Color, step: number, raw = false): boolean {
  const king = pieces.find(p => p.owner === color && p.royal)!;
  assert.ok(king.square);
  return pieces.some(p => p.zone === 'board' && p.owner !== color
    && (raw || !(step >= 19 && p.id === 'white-pawn-b2' || step >= 32 && p.id === 'white-pawn-f2'))
    && reaches(pieces, p, king.square!, true, step >= 14));
}

test('iteration 173: 108 individually reasoned actions have independent physical and permission oracles', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/173.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860173);
  assert.equal(trace.steps.length, 108);
  assert.equal(rationale.length, trace.steps.length);
  const model = createGameState(trace.initial);
  model.pieces = physicalStart();
  model.playedCards = [];
  let state = createGameState(trace.initial);
  let rights = 'KQkq', half = 0, full = 1, active: Color = 'white', rawEp = '-';
  let checkpoint: { pieces: PieceState[]; history: GameEvent[]; half: number; full: number; active: Color } | undefined;
  let moves = 0, cards = 0;
  const cardRows: Record<number, { owner: Color; id: string; instance: string; target?: unknown; points: number }> = {
    14: { owner: 'white', id: 'fortification', instance: 'white-hand-0-fortification', target: { from: 'f6', to: 'f7' }, points: 7 },
    17: { owner: 'black', id: 'panic', instance: 'black-hand-2-panic', points: 5 },
    19: { owner: 'white', id: 'pacifism', instance: 'white-hand-2-pacifism', target: 'c6', points: 3 },
    32: { owner: 'white', id: 'haunting-memories', instance: 'white-deck-1-haunting-memories', target: 'f2', points: 6 },
    44: { owner: 'black', id: 'mystic-shield', instance: 'black-deck-0-mystic-shield', target: 'a2', points: 9 },
    57: { owner: 'white', id: 'knightmare', instance: 'white-deck-0-knightmare', points: 10 },
    100: { owner: 'white', id: 'resurrection', instance: 'white-deck-3-resurrection', target: { pieceId: 'white-pawn-a2', to: 'g2' }, points: 8 },
    101: { owner: 'black', id: 'vulture', instance: 'black-hand-4-vulture', points: 5 },
  };
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1, label = rationale[index]!;
    assert.ok(label.startsWith(`${step}. `));
    const input = structuredClone(state);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.equal(action.promotion, undefined, label);
      assert.equal(model.turn.moveMade, false, label);
      assert.equal(model.turn.phase, 'beforeMove', label);
      const mover = at(model.pieces, from)!;
      assert.ok(mover, label);
      assert.equal(mover.owner, model.turn.color, label);
      const victim = at(model.pieces, to);
      assert.ok(!victim || victim.owner !== mover.owner && !victim.royal, label);
      if (victim) {
        assert.ok(!['white-pawn-b2', ...(step >= 32 ? ['white-pawn-f2'] : [])].includes(victim.id) || step < 19, label);
        assert.ok(!['white-pawn-b2', 'white-pawn-f2'].includes(mover.id) || step < 19, label);
      }
      assert.ok(reaches(model.pieces, mover, to, !!victim, step >= 14), label);
      if (step === 56) checkpoint = { pieces: structuredClone(model.pieces), history: structuredClone(model.history), half, full, active };
      if (victim) Object.assign(victim, { zone: 'captured', square: null, capturedBy: mover.owner });
      mover.square = square(to);
      if (mover.royal) rights = rights.replace(mover.owner === 'white' ? /[KQ]/g : /[kq]/g, '');
      if (mover.id === 'white-rook-h1') rights = rights.replace('K', '');
      if (mover.id === 'black-rook-a8') rights = rights.replace('q', '');
      model.enPassant = mover.role === 'pawn' && Math.abs(Number(to[1]) - Number(from[1])) === 2
        ? [{ target: square(`${from[0]}${(Number(from[1]) + Number(to[1])) / 2}`), pawnId: mover.id }] : [];
      // FEN's raw serialization is distinct from the independently tested legal EP set below.
      rawEp = step === 74 ? 'b6' : step === 98 ? 'h6' : '-';
      half = mover.role === 'pawn' || victim ? 0 : half + 1;
      if (mover.owner === 'black') full++;
      active = opposite(mover.owner);
      model.turn.phase = 'afterMove'; model.turn.moveMade = true;
      model.shieldMove = { player: mover.owner, pieceIds: [mover.id], capturedOpponent: !!victim };
      model.chaosForbidden = undefined;
      model.history.push({ type: 'move', from: square(from), to: square(to), ...(victim ? { capturedId: victim.id } : {}),
        ...(mover.owner === 'white' ? { movedPieceId: mover.id, movedRoles: [mover.role] } : {}) });
      if (step === 20) model.effects = model.effects.filter(e => (e as { type: string }).type !== 'panic');
      assert.equal(threatened(model.pieces, mover.owner, step), false, `${label}: no provisional self-check requires a rescue`);
      moves++;
    } else if (action.type === 'endTurn') {
      assert.equal(model.turn.moveMade, true, label);
      assert.equal(threatened(model.pieces, model.turn.color, step), false, label);
      model.turn = { color: opposite(model.turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      model.shieldMove = undefined;
      if (step === 47) model.effects = model.effects.filter(e => (e as { type: string }).type !== 'mystic-shield');
    } else if (action.type === 'playCard') {
      const row = cardRows[step]!;
      assert.ok(row, label);
      assert.deepEqual(action, { type: 'playCard', cardId: row.id, cardInstanceId: row.instance,
        ...(row.target === undefined ? {} : { target: row.target }) }, label);
      assert.equal(CARD_CATALOG[row.id]!.points, row.points);
      assert.equal(CARD_CATALOG[row.id]!.unique, false);
      assert.equal(model.turn.cardPlays[row.owner], 0, label);
      const player = model.players[row.owner], pos = player.hand.findIndex(c => c.id === row.instance);
      assert.ok(pos >= 0, `${label}: physical card is held by the authorized owner`);
      const [card] = player.hand.splice(pos, 1);
      assert.ok(card);
      if ([14, 17, 44].includes(step)) {
        assert.equal(row.owner, model.turn.color, label); assert.equal(model.turn.phase, 'afterMove', label);
      } else if ([19, 32, 100].includes(step)) {
        assert.equal(row.owner, model.turn.color, label); assert.equal(model.turn.phase, 'beforeMove', label);
      } else if (step === 57) {
        assert.equal(row.owner, opposite(model.turn.color)); assert.equal(model.turn.moveMade, true);
        assert.deepEqual(model.history.at(-1), { type: 'move', from: 'b8', to: 'd7' });
      } else {
        assert.equal(row.owner, opposite(model.turn.color)); assert.equal(model.history.at(-1)?.cardId, 'resurrection');
      }
      let event: GameEvent = { type: 'cardPlayed', cardId: row.id };
      if (step === 14) {
        model.effects.push({ type: 'fortification', owner: 'white', card, from: 'f6', to: 'f7' });
        event.target = { from: 'f6', to: 'f7' };
      } else if (step === 17) {
        model.effects.push({ type: 'panic', owner: 'black', player: 'white', durationMs: 15000 });
        Object.assign(event, { movement: [], preservePreviousMove: true });
      } else if (step === 19 || step === 32) {
        const target = step === 19 ? 'c6' : 'f2', piece = at(model.pieces, target)!;
        assert.equal(piece.owner, 'white'); assert.equal(piece.royal, false);
        if (step === 32) assert.equal([...model.history].reverse().find(e => e.type === 'cardPlayed')?.cardId, 'pacifism');
        model.effects.push({ type: 'pacifism', owner: 'white', card, pieceId: piece.id });
        Object.assign(event, { target, movement: [], preservePreviousMove: false,
          ...(step === 32 ? { copiedCardId: 'pacifism', player: 'white' } : {}) });
      } else if (step === 44) {
        assert.deepEqual(model.shieldMove, { player: 'black', pieceIds: ['black-queen-d8'], capturedOpponent: true });
        assert.equal(at(model.pieces, 'a2')?.id, 'black-queen-d8');
        model.effects.push({ type: 'mystic-shield', owner: 'black', player: 'black', pieceId: 'black-queen-d8' });
        Object.assign(event, { target: 'a2', player: 'black', movement: [], preservePreviousMove: true });
      } else if (step === 57) {
        assert.ok(checkpoint);
        model.pieces = structuredClone(checkpoint.pieces); model.history = structuredClone(checkpoint.history);
        half = checkpoint.half; full = checkpoint.full; active = checkpoint.active;
        model.turn.phase = 'beforeMove'; model.turn.moveMade = false; model.shieldMove = undefined;
        model.chaosForbidden = { player: 'black', movement: 'black-knight-b8:b8:d7' };
        Object.assign(event, { player: 'white', movement: [{ from: 'd7', to: 'b8' }], preservePreviousMove: true });
      } else if (step === 100) {
        const piece = model.pieces.find(p => p.id === 'white-pawn-a2')!;
        assert.equal(piece.zone, 'captured'); assert.equal(piece.capturedBy, 'black'); assert.equal(at(model.pieces, 'g2'), undefined);
        Object.assign(piece, { zone: 'board', square: 'g2' }); delete piece.capturedBy;
        model.turn.phase = 'afterMove'; model.turn.moveMade = true;
        model.shieldMove = { player: 'white', capturedOpponent: false, pieceIds: [] };
        model.enPassant = []; rawEp = '-'; half = 0; active = 'black';
        Object.assign(event, { target: { pieceId: 'white-pawn-a2', to: 'g2' }, movement: [], preservePreviousMove: false });
      } else if (step === 101) {
        const top = player.deck.shift()!; assert.equal(top.cardId, 'evil-eye'); player.discard.push(top);
        Object.assign(event, { player: 'black', movement: [], preservePreviousMove: true });
      }
      if (![14, 19, 32].includes(step)) player.discard.push(card);
      const drawn = player.deck.shift(); assert.ok(drawn); player.hand.push(drawn);
      if (step === 101) {
        assert.equal(drawn.cardId, 'crab');
        const retrieved = model.players.white.discard.pop()!;
        assert.deepEqual(retrieved, { id: 'white-deck-3-resurrection', cardId: 'resurrection' });
        player.hand.push(retrieved);
      }
      model.turn.cardPlays[row.owner]++;
      model.playedCards!.push({ player: row.owner, cardInstanceId: row.instance });
      model.history.push(event);
      cards++;
    } else assert.fail(`${label}: unreviewed action`);

    model.fen = `${boardFen(model.pieces)} ${active[0]} ${rights || '-'} ${rawEp} ${half} ${full}`;
    const result = applyAction(state, action);
    assert.deepEqual(state, input, `${label}: input-state immutability includes capturedBy and nested checkpoints`);
    assert.ok(result.ok, label);
    state = result.state;
    assert.equal(state.fen, model.fen, `${label}: all six FEN fields`);
    assert.deepEqual(ordered(state.pieces), ordered(model.pieces), `${label}: all physical records, captors and identities`);
    assert.deepEqual(state.players, model.players, `${label}: exact ordered physical hand/deck/discard accounting`);
    assert.deepEqual(state.turn, model.turn, `${label}: actor, phase, move status and both card allowances`);
    assert.deepEqual(state.effects, model.effects, `${label}: complete effects including retained physical cards`);
    assert.deepEqual(state.history, model.history, `${label}: complete history, including cancellation removal`);
    assert.deepEqual(state.playedCards ?? [], model.playedCards, `${label}: physical declaration ledger`);
    assert.deepEqual(state.enPassant, model.enPassant, `${label}: physical en-passant victims`);
    assert.deepEqual(state.shieldMove, model.shieldMove, `${label}: exact moved identities and capture flag`);
    assert.deepEqual(state.chaosForbidden, model.chaosForbidden, `${label}: full cancellation movement token`);
    assert.equal(state.plotsExecution, undefined, label);
    assert.deepEqual(state.plotsAllowances ?? [], [], label);
    assert.deepEqual(state.fogLocked ?? [], [], label);
    assert.deepEqual(state.riposteLostMoves ?? [], [], label);
    assert.equal(state.riposteSkipped, undefined, label);
    assert.equal(state.riposteCheckDeferred, undefined, label);
    assert.equal(state.pendingRescue ?? null, null, label);
    assert.equal(state.pendingAbduction ?? null, null, label);
    assert.equal(state.pendingDoomsayer ?? null, null, label);
    assert.deepEqual(state.underElfHill ?? [], [], label);
    assert.equal(state.orientation, 0, label);
    assert.equal(state.outcome, null, label);
    for (const color of colors) {
      const expectedCheck = threatened(model.pieces, color, step);
      assert.equal(expectedCheck, color === 'white' ? step >= 107 : [88, 89].includes(step), `${label}: directed royal-check review`);
      assert.equal(isKingInCheck(state, color), expectedCheck, `${label}: independent royal geometry and capture restrictions`);
      assert.equal(threatened(model.pieces, color, step, true), color === 'white' ? step >= 107 : step >= 70,
        `${label}: raw royal geometry separately exposes the Pacifist c6 attack`);
    }
    if (state.enPassant.length) {
      const prospect = structuredClone(state);
      prospect.turn = { color: active, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      const saved = structuredClone(prospect), legal = legalDests(prospect);
      for (const opportunity of model.enPassant) for (const captor of model.pieces.filter(p => p.zone === 'board' && p.role === 'pawn' && p.owner === active)) {
        const victim = model.pieces.find(p => p.id === opportunity.pawnId)!;
        const copy = structuredClone(model.pieces), from = captor.square!;
        const geometric = reaches(copy, captor, opportunity.target, true, step >= 14);
        const sameRank = captor.square![1] === victim.square![1];
        const pacifist = step >= 19 && captor.id === 'white-pawn-b2' || step >= 32 && captor.id === 'white-pawn-f2'
          || step >= 32 && victim.id === 'white-pawn-f2';
        let expected = geometric && sameRank && !pacifist && !at(copy, opportunity.target);
        if (expected) {
          copy.find(p => p.id === victim.id)!.zone = 'captured'; copy.find(p => p.id === victim.id)!.square = null;
          copy.find(p => p.id === captor.id)!.square = opportunity.target;
          expected = !threatened(copy, active, step);
        }
        assert.equal(legal.get(from)?.includes(opportunity.target) ?? false, expected, `${label}: prospective legal en passant ${from}-${opportunity.target}`);
        if (expected) {
          const probe = applyAction(prospect, { type: 'move', from, to: opportunity.target });
          assert.ok(probe.ok, label); assert.equal(probe.state.pendingRescue ?? null, null);
          const captured = copy.find(p => p.id === victim.id)!; captured.capturedBy = active;
          assert.deepEqual(ordered(probe.state.pieces), ordered(copy), `${label}: EP independently moves captor and removes passed victim`);
        }
      }
      assert.deepEqual(prospect, saved, `${label}: EP enumeration and capture probe are immutable`);
    }
    if (step === 57) {
      const saved = structuredClone(state), repeat = applyAction(state, { type: 'move', from: 'b8', to: 'd7' });
      assert.equal(repeat.ok, false, 'the canceled physical movement cannot be repeated');
      assert.deepEqual(state, saved, 'rejected cancellation repeat is atomic');
    }
  }
  assert.equal(moves, 50); assert.equal(cards, 8);
  assert.equal(state.fen, '4rb1r/p2kppp1/2P3b1/1p1n2Pp/2P2P2/B2R4/3PPqP1/RN1QKBN1 w Q - 3 26');
  const saved = structuredClone(state), escape = applyAction(state, { type: 'move', from: 'e1', to: 'f2' });
  const board = structuredClone(model.pieces), queen = at(board, 'f2')!, king = at(board, 'e1')!;
  Object.assign(queen, { zone: 'captured', square: null, capturedBy: 'white' }); king.square = 'f2';
  assert.equal(threatened(board, 'white', 108), false, 'Kxf2 is an independent final-check escape');
  assert.ok(escape.ok); assert.deepEqual(ordered(escape.state.pieces), ordered(board));
  assert.equal(escape.state.pendingRescue ?? null, null); assert.deepEqual(state, saved);
});

test('iteration 173: deterministic trace replays', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/173.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(replayTrace(trace));
});
