import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/184.json', import.meta.url), 'utf8')) as RandomTrace;

test('iteration 184 deterministic replay', () => {
  assert.ok(trace);
  replayTrace(trace);
});

// Independently reviewed in order against rules.md, cards.md, and all 14 played
// card artworks. No neutral pieces, promotions, rescue windows, or royal attacks
// occur in this trace. The independent geometry below verifies that last claim.
const rationales = `
1 Pawn h2-h3 advances to an empty square.
2 White closes a safe completed move; Black receives fresh allowances.
3 Pawn h7-h5 crosses empty h6; no white Pawn can capture en passant.
4 Black closes; the h6 opportunity remains for White.
5 Pawn d2-d4 crosses empty d3; the old h6 opportunity expires.
6 White closes; Black has no Pawn able to use d3.
7 Knight g8-f6 jumps with standard geometry; d3 expires.
8 Black closes the safe Knight move.
9 Rook h1-h2 moves onto the vacated Pawn square and loses kingside rights.
10 White closes the safe Rook move.
11 Rook h8-g8 moves onto the vacated Knight square and loses kingside rights.
12 Black closes the safe Rook move.
13 Knight b1-d2 jumps onto the vacated Pawn square.
14 White Siege swaps its Knight d2 and Rook a1 after moving; identities and clocks persist.
15 White closes; the Siege draw and expenditure persist.
16 Pawn c7-c5 crosses empty c6; White has no c6 en-passant capture.
17 Black closes and preserves the c6 opportunity.
18 Pawn d4-d5 advances quietly and expires c6.
19 White closes the safe Pawn move.
20 Black Fanatic moves e7-e4 through empty e6/e5/e4 instead of moving; no en passant.
21 Black closes the replacement move.
22 Pawn b2-b3 advances into an empty square.
23 White closes the Pawn move.
24 Black Haunting Memories copies latest nonunique Fanatic, b7-b4 through empty b6/b5/b4.
25 Black closes the copied replacement move.
26 Bishop c1-b2 moves one diagonal square.
27 White closes the Bishop move.
28 Black Plots admits only held Long Jump and Confabulation; Fireball timing and Split Knight captures fail.
29 Confabulation spends one Plots allowance: Knight f6 joins own Pawn d7 by a Knight jump.
30 Black ends the replacement move and forfeits the unused Plots play.
31 Pawn g2-g4 crosses empty g3; no Black Pawn can capture on g3.
32 White closes and preserves g3 for Black.
33 Black Long Jump relocates Knight b8-f5 to empty opposite color; g3 expires.
34 Black closes the replacement move.
35 Pawn c2-c4 crosses c3; Black b4 Pawn has a safe c3 en-passant capture.
36 White closes and preserves the genuine c3 capture.
37 Rook a8-b8 declines en passant and loses Black queenside rights.
38 Black closes the Rook move.
39 Queen d1-b1 traverses empty c1.
40 White Curse marks opposing Bishop c8 after moving; its future range is at most two.
41 White closes with Curse retained beside the board.
42 Queen d8-e7 moves one diagonal square.
43 Black closes the Queen move.
44 Knight a1-c2 jumps to the vacated Pawn square.
45 White closes the Knight move.
46 Rook g8-h8 moves one rank square.
47 Black closes the Rook move.
48 Rook h2-g2 moves one rank square.
49 White closes the Rook move.
50 Rook h8-h6 crosses empty h7.
51 Black closes the Rook move.
52 Bishop b2-f6 traverses c3/d4/e5, all empty.
53 White closes the Bishop move.
54 Knight f5-d6 makes an ordinary jump.
55 Black closes the Knight move.
56 White Assassin moves Rook g2-f2 capturing its own Pawn; White is the captor.
57 White closes the Assassin replacement move.
58 Black Tournament d6/g1 fizzles: white Knight on d6 would attack Ke8; spend and consume safe-start move.
59 Black closes the fizzled replacement; physical board stays as before Tournament.
60 Rook f2-f3 moves one file square.
61 Black Chaos rewinds only f2-f3, restores its clock/history and forbids that exact movement.
62 Bishop f6xg7 captures Black Pawn as a different replacement; restriction clears.
63 White closes; Black receives its new allowance despite the earlier reaction.
64 Knight d6xc4 captures White Pawn with a normal jump.
65 Black closes the capture.
66 Rook d2-d1 moves one file square; its original queenside right expires.
67 White closes with no castling rights remaining.
68 Rook h6-c6 traverses empty g6/f6/e6/d6.
69 Black Fireball at moved Rook c6 captures c6/c5/d5/d7 and d7 composite Knight; Black owns all captures.
70 Black closes; captured Confabulation expires to Black discard.
71 Queen b1-c1 moves one rank square.
72 White closes the Queen move.
73 Pawn a7-a6 advances one empty square.
74 Black closes the Pawn move.
75 Queen c1-f4 traverses empty d2/e3.
76 White closes the Queen move.
77 Rook b8-b5 traverses empty b7/b6.
78 Black closes the Rook move.
79 Rook d1-d4 traverses empty d2/d3.
80 White closes the Rook move.
81 Pawn f7-f6 advances one square.
82 Black closes the Pawn move.
83 White Passing in the Night simultaneously swaps a2/e4 and h3/h5; four Pawn identities persist.
84 White closes the four-Pawn replacement with no en-passant rights.
85 Rook b5-f5 traverses empty c5/d5/e5.
86 Black closes the Rook move.
87 Queen f4-b8 traverses empty e5/d6/c7.
88 White closes; Bishop c8 blocks the Queen along the eighth rank.
89 Rook f5-d5 traverses empty e5.
90 Black closes the Rook move.
91 White Pawn e4xd5 captures Black Rook diagonally forward.
92 White closes the Pawn capture.
93 Black Pawn h3-h2 advances one empty square.
94 Black closes the Pawn move.
95 White Evil Eye captures Pawn f6 using Rook f2 along empty f3/f4/f5; the Rook stays f2.
96 White closes the stationary-capture replacement move.
97 Queen e7-b7 traverses empty d7/c7.
98 White Chaos rewinds e7-b7, including fullmove and history, and forbids repetition.
99 Queen e7-f7 is a genuinely different legal replacement.
100 Black closes and clears the reaction allowances.
101 Rook f2-f6 traverses empty f3/f4/f5.
102 White closes the Rook move.
103 Pawn a6-a5 advances one empty square.
104 Black closes the Pawn move.
105 Knight c2-e3 makes an ordinary jump.
106 White closes the Knight move.
107 Bishop f8-c5 traverses empty e7/d6.
108 Black closes the Bishop move.
109 Rook d4-d1 traverses empty d3/d2.
110 White closes the Rook move.
111 Knight c4xe3 captures White Knight by a normal jump.
112 Black closes the capture.
113 Rook d1-c1 moves one rank square.
114 White Coup makes safe Pawn b3 royal and old Ke1 a Prince, retaining movement roles.
115 White closes with the new royal identity b3 safe.
116 Queen f7xh5 traverses empty g6 and captures White Pawn.
117 Black closes; White royal Pawn b3 remains safe.
118 Queen b8-c7 moves one diagonal square.
119 White closes the Queen move.
120 Queen h5-h8 traverses empty h6/h7.
121 Black closes the fiftieth move command; royal Pawn b3 and King e8 remain safe.
`.trim().split('\n');

const xy = (square: string): [number, number] => [square.charCodeAt(0) - 97, Number(square[1]) - 1];
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
function geometry(pieces: PieceState[], piece: PieceState, to: string, capture: boolean, cursed: boolean): boolean {
  assert.ok(piece.square);
  const [x, y] = xy(piece.square), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (!ax && !ay || cursed && Math.max(ax, ay) > 2) return false;
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'king') return Math.max(ax, ay) === 1;
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    if (capture) return ax === 1 && dy === forward;
    return dx === 0 && !at(pieces, to) && (dy === forward || dy === 2 * forward
      && (piece.owner === 'white' ? y <= 1 : y >= 6)
      && !at(pieces, `${piece.square[0]}${y + forward + 1}`));
  }
  if (!(piece.role === 'rook' && (!dx || !dy) || piece.role === 'bishop' && ax === ay
    || piece.role === 'queen' && (!dx || !dy || ax === ay))) return false;
  for (let d = 1; d < Math.max(ax, ay); d++) {
    if (at(pieces, `${String.fromCharCode(97 + x + d * Math.sign(dx))}${y + d * Math.sign(dy) + 1}`)) return false;
  }
  return true;
}
function threatened(pieces: PieceState[], color: Color, step: number): boolean {
  const royal = pieces.find(p => p.owner === color && p.royal && p.zone === 'board');
  assert.ok(royal?.square);
  return pieces.some(p => p.owner !== color && p.zone === 'board' && (
    geometry(pieces, p, royal.square!, true, step >= 40 && p.id === 'black-bishop-c8')
    || step >= 29 && step < 69 && p.id === 'black-pawn-d7'
      && geometry(pieces, { ...p, role: 'knight' }, royal.square!, true, false)));
}
function boardFen(pieces: PieceState[]): string {
  const roles = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, row) => {
    let line = '', empty = 0;
    for (const file of 'abcdefgh') {
      const p = at(pieces, `${file}${8 - row}`);
      if (!p) { empty++; continue; }
      if (empty) line += empty;
      empty = 0;
      line += p.owner === 'white' ? roles[p.role].toUpperCase() : roles[p.role];
    }
    return line + (empty || '');
  }).join('/');
}

test('iteration 184 independent physical, card, history, clocks, royal and obligation review', () => {
  assert.equal(rationales.length, 121);
  assert.equal(trace.steps.length, rationales.length);
  let state = createGameState(trace.initial);
  let expected = structuredClone(state);
  let half = 0, full = 1, fenColor: Color = 'white';
  let rights = 'KQkq', serializedEp = '-';
  let checkpoint: { expected: GameState; half: number; full: number; fenColor: Color; rights: string; serializedEp: string } | undefined;
  const continuing = new Set(['confabulation', 'curse', 'coup']);
  const cardActions: Record<number, [Color, string, unknown]> = {
    14: ['white', 'siege', { knight: 'd2', rook: 'a1' }], 20: ['black', 'fanatic', 'e7'],
    24: ['black', 'haunting-memories', 'b7'], 28: ['black', 'plots-within-plots', { player: 'black' }],
    29: ['black', 'confabulation', [{ from: 'f6', to: 'd7' }]], 33: ['black', 'long-jump', [{ from: 'b8', to: 'f5' }]],
    40: ['white', 'curse', 'c8'], 56: ['white', 'assassin', [{ from: 'g2', to: 'f2' }]],
    58: ['black', 'tournament', { own: 'd6', opponent: 'g1' }], 61: ['black', 'chaos', undefined],
    69: ['black', 'fireball', 'c6'], 83: ['white', 'passing-in-the-night', [{ from: 'a2', to: 'e4' }, { from: 'h3', to: 'h5' }]],
    95: ['white', 'evil-eye', { attacker: 'f2', victim: 'f6' }], 98: ['white', 'chaos', undefined], 114: ['white', 'coup', 'b3'],
  };
  for (const [index, entry] of trace.steps.entries()) {
    const n = index + 1, action = entry.action, label = rationales[index]!;
    assert.ok(label.startsWith(`${n} `));
    const before = structuredClone(state), payload = structuredClone(action);
    const actor = expected.turn.color;
    const piece = (square: string) => { const p = at(expected.pieces, square); assert.ok(p, `${n}: ${square}`); return p; };
    const capture = (p: PieceState, owner: Color) => { p.zone = 'captured'; p.square = null; p.capturedBy = owner; };
    const complete = (pawnOrCapture: boolean, moved: string[], capturedOpponent = false) => {
      half = pawnOrCapture ? 0 : half + 1;
      if (actor === 'black') full++;
      fenColor = opposite(actor); serializedEp = '-'; expected.enPassant = [];
      expected.turn.phase = 'afterMove'; expected.turn.moveMade = true;
      expected.shieldMove = { player: actor, pieceIds: moved, capturedOpponent };
      expected.chaosForbidden = undefined;
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.ok(label.includes(`${from}-${to}`) || label.includes(`${from}x${to}`), label);
      const p = piece(from), victim = at(expected.pieces, to);
      assert.equal(p.owner, actor, label); assert.equal(expected.turn.moveMade, false, label);
      assert.ok(!victim || victim.owner !== actor && !victim.royal, label);
      assert.ok(geometry(expected.pieces, p, to, !!victim, n >= 40 && p.id === 'black-bishop-c8'), label);
      checkpoint = { expected: structuredClone(expected), half, full, fenColor, rights, serializedEp };
      if (victim) capture(victim, actor);
      p.square = to as SquareName;
      complete(p.role === 'pawn' || !!victim, [p.id], !!victim);
      if (p.id === 'white-rook-h1') rights = rights.replace('K', '');
      if (p.id === 'black-rook-h8') rights = rights.replace('k', '');
      if (p.id === 'white-rook-a1') rights = rights.replace('Q', '').replace('A', '');
      if (p.id === 'black-rook-a8') rights = rights.replace('q', '');
      if (p.role === 'pawn' && Math.abs(Number(to[1]) - Number(from[1])) === 2) {
        const target = `${from[0]}${(Number(to[1]) + Number(from[1])) / 2}` as SquareName;
        expected.enPassant = [{ target, pawnId: p.id }];
        // Only b4xc3 exists in this trace; every other double step lacks an adjacent opposing Pawn.
        if (n === 35) serializedEp = 'c3';
      }
      expected.history.push({ type: 'move', from: from as SquareName, to: to as SquareName,
        ...(victim ? { capturedId: victim.id } : {}) });
      expected.plotsAllowances = undefined;
    } else if (action.type === 'endTurn') {
      assert.equal(expected.turn.moveMade, true, label);
      expected.turn = { color: opposite(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      expected.shieldMove = undefined; expected.plotsAllowances = undefined; expected.chaosForbidden = undefined;
    } else {
      assert.equal(action.type, 'playCard');
      if (action.type !== 'playCard') throw new Error('unreviewed action');
      const [owner, id, target] = cardActions[n]!;
      assert.equal(action.cardId, id, label); assert.deepEqual(action.target, target, label);
      const card = expected.players[owner].hand.find(c => c.cardId === id)!;
      assert.ok(card, label); assert.equal(action.cardInstanceId, card.id, label);
      assert.equal(expected.turn.cardPlays[owner], n === 29 ? 1 : 0, label);
      const replacement = [20, 24, 29, 33, 56, 58, 83, 95].includes(n);
      assert.equal(expected.turn.phase, replacement || n === 28 ? 'beforeMove' : 'afterMove', label);
      assert.equal(owner, id === 'chaos' ? opposite(actor) : actor, label);
      let event: GameEvent = { type: 'cardPlayed', cardId: id, target: target as GameEvent['target'], movement: [], preservePreviousMove: !replacement };
      if (n === 14) {
        const a = piece('a1'), b = piece('d2');
        assert.equal(a.role, 'rook'); assert.equal(b.role, 'knight');
        a.square = 'd2'; b.square = 'a1'; rights = rights.replace('Q', 'A');
        event.movement = [{ from: 'a1', to: 'd2' }, { from: 'd2', to: 'a1' }];
      } else if (n === 20 || n === 24) {
        const from = n === 20 ? 'e7' : 'b7', to = n === 20 ? 'e4' : 'b4';
        const p = piece(from); assert.equal(p.role, 'pawn');
        for (const rank of [6, 5, 4]) assert.equal(at(expected.pieces, `${from[0]}${rank}`), undefined);
        p.square = to; complete(true, [p.id]); event.movement = [{ from, to }];
        if (n === 24) { assert.equal([...expected.history].reverse().find(e => e.cardId)?.cardId, 'fanatic'); event.copiedCardId = 'fanatic'; event.player = owner; }
      } else if (n === 28) {
        delete event.target; event.player = owner;
        expected.plotsAllowances = [{ player: owner, remaining: 2,
          eligibleCards: ['black-hand-3-long-jump', 'black-deck-1-confabulation'],
          window: { phase: 'beforeMove', moveMade: false, reaction: { type: 'move', from: 'c1', to: 'b2' },
            shieldMove: undefined, capture: undefined, cardResponse: undefined, fogCheckpoint: undefined, legacyCapture: undefined } }];
      } else if (n === 29) {
        const knight = piece('f6'), pawn = piece('d7');
        assert.equal(knight.role, 'knight'); assert.equal(pawn.role, 'pawn');
        assert.ok(geometry(expected.pieces, knight, 'd7', false, false));
        knight.zone = 'away'; knight.square = null;
        expected.effects.push({ type: id as 'confabulation', owner, card, pieceIds: [pawn.id, knight.id] });
        complete(false, [knight.id]); event.movement = [{ from: 'f6', to: 'd7' }];
        expected.plotsAllowances![0]!.remaining = 1; expected.plotsAllowances![0]!.eligibleCards = ['black-hand-3-long-jump'];
      } else if (n === 33) {
        const p = piece('b8'); assert.equal(p.role, 'knight'); assert.equal(at(expected.pieces, 'f5'), undefined);
        assert.notEqual((1 + 7) % 2, (5 + 4) % 2);
        p.square = 'f5'; complete(false, [p.id]); event.movement = [{ from: 'b8', to: 'f5' }];
      } else if (n === 40) {
        const p = piece('c8'); assert.equal(p.owner, 'black'); assert.equal(p.role, 'bishop');
        expected.effects.push({ type: id as 'curse', owner, card, pieceId: p.id });
      } else if (n === 56) {
        const p = piece('g2'), victim = piece('f2');
        assert.equal(victim.owner, owner); assert.ok(geometry(expected.pieces, p, 'f2', true, false));
        capture(victim, owner); p.square = 'f2'; complete(true, [p.id]);
        event.movement = [{ from: 'g2', to: 'f2' }]; event.capturedId = victim.id;
      } else if (n === 58) {
        const trial = structuredClone(expected.pieces), a = at(trial, 'd6')!, b = at(trial, 'g1')!;
        assert.equal(a.role, 'knight'); assert.equal(b.role, 'knight');
        a.square = 'g1'; b.square = 'd6'; assert.ok(threatened(trial, 'black', n));
        assert.equal(threatened(expected.pieces, 'black', n), false);
        complete(false, []); expected.shieldMove = undefined;
        event = { type: 'cardFizzled', cardId: id, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false };
      } else if (id === 'chaos') {
        assert.ok(checkpoint);
        const last = expected.history.at(-1)!; assert.equal(last.type, 'move');
        const mover = piece(last.to!);
        const forbidden = `${mover.id}:${last.from}:${last.to}`;
        expected = structuredClone(checkpoint.expected);
        ({ half, full, fenColor, rights, serializedEp } = checkpoint);
        expected.chaosForbidden = { player: actor, movement: forbidden };
        event = { type: 'cardPlayed', cardId: id, player: owner, movement: [{ from: last.to!, to: last.from! }], preservePreviousMove: true };
      } else if (n === 69) {
        const center = piece('c6'); assert.equal(center.id, 'black-rook-h8');
        assert.deepEqual(expected.shieldMove, { player: owner, pieceIds: [center.id], capturedOpponent: false });
        const victims = expected.pieces.filter(p => p.zone === 'board' && p.square && !p.royal
          && Math.max(Math.abs(xy(p.square)[0] - 2), Math.abs(xy(p.square)[1] - 5)) <= 1);
        assert.deepEqual(victims.map(p => p.id), ['white-pawn-d2', 'black-pawn-c7', 'black-pawn-d7', 'black-rook-h8']);
        victims.push(expected.pieces.find(p => p.id === 'black-knight-g8')!);
        for (const p of victims) capture(p, owner);
        expected.effects = expected.effects.filter(e => (e as { type: string }).type !== 'confabulation');
        expected.players.black.discard.push({ id: 'black-deck-1-confabulation', cardId: 'confabulation' });
        half = 0;
        event.capturedIds = expected.pieces.filter(p => victims.includes(p)).map(p => p.id); event.player = owner;
      } else if (n === 83) {
        for (const [from, to] of [['a2', 'e4'], ['h3', 'h5']] as const) {
          const a = piece(from), b = piece(to); assert.equal(a.role, 'pawn'); assert.equal(b.role, 'pawn');
          assert.equal(a.owner, 'white'); assert.equal(b.owner, 'black'); a.square = to; b.square = from;
        }
        complete(true, []);
        event.movement = [{ from: 'a2', to: 'e4' }, { from: 'h3', to: 'h5' }, { from: 'e4', to: 'a2' }, { from: 'h5', to: 'h3' }];
      } else if (n === 95) {
        const attacker = piece('f2'), victim = piece('f6');
        assert.ok(geometry(expected.pieces, attacker, 'f6', true, false));
        const trial = structuredClone(expected.pieces); capture(at(trial, 'f6')!, owner); at(trial, 'f2')!.square = 'f6';
        assert.equal(threatened(trial, owner, n), false, 'Evil Eye hypothetical capture preserves King safety');
        capture(victim, owner); complete(true, [], true); event.capturedId = victim.id; event.capturedIds = [victim.id];
      } else if (n === 114) {
        const prince = piece('e1'), king = piece('b3'); assert.equal(king.role, 'pawn');
        prince.royal = false; king.royal = true;
        expected.effects.push({ type: id as 'coup', owner, card, princeId: prince.id, kingId: king.id, princeRole: 'king' });
      } else throw new Error(`unreviewed card ${n}`);
      const player = expected.players[owner];
      player.hand = player.hand.filter(c => c.id !== card.id);
      const drawn = player.deck.shift(); assert.ok(drawn); player.hand.push(drawn);
      if (!continuing.has(id)) player.discard.push(card);
      expected.turn.cardPlays[owner]++;
      expected.history.push(event);
    }
    expected.fen = `${boardFen(expected.pieces)} ${fenColor[0]} ${rights || '-'} ${serializedEp} ${half} ${full}`;
    const result = applyAction(state, action);
    assert.deepEqual(state, before, `${label}: immutable state`);
    assert.deepEqual(action, payload, `${label}: immutable action`);
    assert.ok(result.ok, label); state = result.state;
    assert.deepEqual(state.pieces, expected.pieces, `${label}: full physical identities and captors`);
    assert.deepEqual(state.players, expected.players, `${label}: exact physical card accounting`);
    assert.deepEqual(state.effects, expected.effects, `${label}: retained effects`);
    assert.deepEqual(state.history, expected.history, `${label}: full history including rewinds`);
    assert.deepEqual(state.turn, expected.turn, `${label}: turn permissions`);
    assert.equal(state.fen, expected.fen, `${label}: six FEN fields`);
    assert.deepEqual(state.enPassant, expected.enPassant, `${label}: en-passant opportunities`);
    assert.deepEqual(state.shieldMove, expected.shieldMove, `${label}: actual moved identities`);
    assert.deepEqual(state.chaosForbidden, expected.chaosForbidden, `${label}: cancellation token`);
    assert.deepEqual(state.plotsAllowances ?? [], expected.plotsAllowances ?? [], `${label}: exact saved Plots window`);
    for (const key of ['plotsExecution', 'riposteSkipped', 'riposteCheckDeferred'] as const) assert.equal(state[key], undefined, `${label}: ${key}`);
    for (const key of ['fogLocked', 'riposteLostMoves', 'underElfHill'] as const) assert.deepEqual(state[key] ?? [], [], `${label}: ${key}`);
    for (const key of ['pendingRescue', 'pendingAbduction', 'pendingDoomsayer', 'outcome'] as const) assert.equal(state[key] ?? null, null, `${label}: ${key}`);
    assert.equal(state.orientation, 0);
    const queryBefore = structuredClone(state);
    for (const color of ['white', 'black'] as const) {
      const check = threatened(expected.pieces, color, n);
      assert.equal(check, false, `${label}: independent ${color} royal attack geometry`);
      assert.equal(isKingInCheck(state, color), check, label);
    }
    assert.deepEqual(state, queryBefore, `${label}: immutable royal queries`);
    // Query EP in the prospective capturing player's before-move context.
    for (const ep of expected.enPassant) {
      const victim = expected.pieces.find(p => p.id === ep.pawnId)!;
      const captor = opposite(victim.owner), probe = structuredClone(state);
      probe.turn = { color: captor, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      probe.fen = probe.fen.replace(/ [wb] /, ` ${captor[0]} `); probe.shieldMove = undefined;
      const snapshot = structuredClone(probe), dests = legalDests(probe);
      for (const p of expected.pieces.filter(p => p.owner === captor && p.role === 'pawn' && p.zone === 'board')) {
        let legal = geometry(expected.pieces, p, ep.target, true, false)
          && p.square![1] === victim.square![1] && !at(expected.pieces, ep.target);
        if (legal) {
          const trial = structuredClone(expected.pieces); at(trial, p.square!)!.square = ep.target;
          capture(trial.find(t => t.id === victim.id)!, captor);
          legal = !threatened(trial, captor, n);
        }
        assert.equal(dests.get(p.square!)?.includes(ep.target) ?? false, legal, `${label}: prospective ${p.id} en passant`);
      }
      assert.deepEqual(probe, snapshot, `${label}: immutable prospective EP query`);
    }
    if (expected.chaosForbidden) {
      const repeated: GameAction = n === 61 ? { type: 'move', from: 'f2', to: 'f3' } : { type: 'move', from: 'e7', to: 'b7' };
      const snapshot = structuredClone(state), actionSnapshot = structuredClone(repeated);
      assert.equal(applyAction(state, repeated).ok, false, `${label}: exact repetition forbidden`);
      assert.deepEqual(state, snapshot); assert.deepEqual(repeated, actionSnapshot);
    }
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 15);
  assert.equal(state.fen, '2b1k2q/2Q3B1/5R2/p1bP4/1p4P1/1P2n3/p3P2p/2R1KBN1 w - - 2 29');
});
