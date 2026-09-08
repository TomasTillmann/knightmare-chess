import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameEvent, GameState, PieceState, SquareName } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/177.json', import.meta.url), 'utf8')) as RandomTrace;
test('iteration 177 deterministic engine replay', () => {
  assert.equal(replayTrace(trace).fen, trace.finalFen);
});

// Explicit review in trace order; each endTurn retains board/history and resets allowances.
const rationales = `
1 d2-d4: clear starting double step; d3 opportunity, no adjacent captor.
2 End White: d4 remains; Black receives its move.
3 b7-b5: clear starting double step; b6 opportunity, no adjacent captor.
4 End Black: b5 remains; White receives its move.
5 e2-e3: one empty forward square; prior opportunity expires.
6 End White: e3 remains.
7 e7-e5: clear starting double step; e6 opportunity is uncapturable.
8 End Black: e5 remains.
9 g2-g3: one empty forward square.
10 End White: g3 remains.
11 Ng8-f6: ordinary empty Knight jump.
12 End Black: Nf6 remains.
13 Qd1-f3: diagonal through vacated e2.
14 End White: Qf3 remains.
15 e5-e4: empty forward square.
16 End Black: e4 remains.
17 Long Jump Ng1-g4 changes square color, empty destination, replacement move.
18 End White: jumped Ng4 remains, card spent.
19 Nf6-d5: empty Knight jump.
20 End Black: Nd5 remains.
21 Nb1-d2: empty Knight jump.
22 End White: Nd2 remains.
23 h7-h5: clear starting double step; no h6 captor.
24 End Black: h5 remains.
25 Rh1-g1: adjacent empty square, revoke K right.
26 End White: Rg1 remains.
27 Nd5-f6: empty Knight jump.
28 End Black: Nf6 remains.
29 Nd2-b3: empty Knight jump.
30 End White: Nb3 remains.
31 Bombard Ra8-a4: jump exactly a7 Pawn through empty a6/a5; revoke q right.
32 End Black: Ra4 remains.
33 Qf3xf6: clear f4/f5, capture black-knight-g8 for White.
34 End White: Qf6 remains.
35 c7-c6: empty forward square.
36 End Black: c6 remains.
37 c2-c3: empty forward square.
38 End White: c3 remains.
39 Ra4xd4: clear b4/c4, capture white-pawn-d2 for Black.
40 End Black: Rd4 remains.
41 Qf6-e6: horizontal step gives check up e7 to e8.
42 End White: Black receives the checked turn.
43 f7xe6: forward diagonal captures checking white-queen-d1 for Black.
44 End Black: e6 Pawn remains, check cured.
45 Ra1-b1: adjacent empty square; revoke Q right.
46 End White: Rb1 remains.
47 Bf8-a3: clear e7/d6/c5/b4 diagonal.
48 End Black: Ba3 remains.
49 Hidden Passage Ke1-f4: empty safe destination; e4 blocks Rd4 horizontal attack.
50 End White: Kf4 remains.
51 Rd4-a4: clear c4/b4, no capture.
52 Fireball at just-moved a4 captures Ra4, Ba3, Nb3, b5 Pawn for Black; no King nearby.
53 End Black: four blast victims remain captured.
54 Bf1-b5: clear e2/d3/c4 diagonal.
55 End White: Bb5 remains.
56 Rh8-f8: clear g8; revoke last k castling right.
57 End Black: Rf8 remains.
58 Ng4-f6: Knight jump checks Ke8.
59 End White: Black receives the checked turn.
60 g7xf6: capture checking white-knight-g1 for Black and cure check.
61 End Black: f6 Pawn remains.
62 Bb5xc6: diagonal captures black-pawn-c7 for White.
63 End White: Bc6 remains.
64 Rf8-g8: empty horizontal step.
65 End Black: Rg8 remains.
66 Bc6-a4: clear b5 diagonal.
67 End White: Ba4 remains.
68 Rg8xg3: clear g7/g6/g5/g4 captures white-pawn-g2 for Black.
69 End Black: Rg3 remains.
70 b2-b4: clear b3 double step; no b3 captor.
71 End White: b4 remains.
72 Onslaught d7-d6/e6-e5/h5-h4 has empty targets but opens Ba4-b5-c6-d7-e8; SELF_CHECK fizzle spends card and safe-start replacement move.
73 End Black: all Onslaught Pawns restored, no extra move.
74 Rb1-a1: empty horizontal step.
75 End White: Ra1 remains.
76 Bc8-b7: empty diagonal step.
77 Fortification after move retains physical card at boundary a4-a5, clocks unchanged.
78 End Black: wall remains.
79 Ba4-c2: clear b3 diagonal does not cross a4-a5 wall.
80 End White: Bc2 remains.
81 e6-e5: empty forward step checks Kf4 by Pawn diagonal.
82 End Black: White receives checked turn.
83 Kf4xg3: adjacent safe capture of black-rook-h8, escaping e5 Pawn check.
84 End White: Kg3 remains.
85 Qd8-e7: empty diagonal step.
86 End Black: Qe7 remains.
87 Confabulation Ra1-c1: clear b1, merge with own nonroyal Bc1; physical Rook away, Bishop board representative gains Rook movement.
88 End White: merged Bc1/Ra1 remains, continuing card retained.
89 Bb7-c6: empty diagonal step.
90 End Black: Bc6 remains.
91 Ghostwalk a2-a4: clear a3 and destination, no wall crossing; raw a3 FEN target exists although no black b4 captor.
92 End White: a4 and uncapturable serialized a3 remain.
93 Ke8-f7: safe empty adjacent square, old en-passant expires.
94 End Black: Kf7 remains.
95 Composite Bc1-a1 uses merged Rook along clear b1; both physical identities count as moved.
96 End White: composite a1 remains.
97 Bc6-a8: clear b7 diagonal.
98 End Black: Ba8 remains.
99 Betrayal replaces enemy e4 Pawn on White half with captured white-pawn-d2; enemy dead, return clears captor, preserves move and clocks.
100 Kg3-h4: safe empty diagonal step; h5 Pawn attacks g4, not h4.
101 End White: Kh4 remains, Betrayal allowance resets.
102 d7-d5: clear d6 double step; White e4 cannot capture en passant from fourth rank.
103 End Black: d5 remains.
104 Rg1-g4: clear g2/g3 vertical path.
105 End White: Rg4 remains.
106 Qe7-e6: empty vertical step.
107 End Black: Qe6 remains.
108 Rg4-g5: empty vertical step.
109 End White: Rg5 remains.
110 Kf7-e8: safe empty diagonal step.
111 End Black: Ke8 remains.
112 h2-h3: empty forward step.
113 End White: h3 remains.
114 Nb8-c6: empty Knight jump.
115 End Black: final White turn, no unresolved choice or check.
`.trim().split('\n');

const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white';
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const square = (x: number, y: number): SquareName => {
  const value = `${String.fromCharCode(97 + x)}${y + 1}`;
  assert.match(value, /^[a-h][1-8]$/);
  return value as SquareName;
};

test('iteration 177 independent physical, rules, history, and six-field FEN oracle', () => {
  assert.equal(rationales.length, 115);
  assert.equal(trace.steps.length, rationales.length);
  let state = createGameState(trace.initial);
  const pieces = structuredClone(state.pieces), players = structuredClone(state.players);
  const history: GameEvent[] = [], effects: unknown[] = [];
  let turn = structuredClone(state.turn), ep: GameState['enPassant'] = [];
  let rights = 'KQkq', half = 0, full = 1, active: Color = 'white', rawEp = '-';
  let shield: GameState['shieldMove'];
  const at = (s: string, board = pieces) => board.find(p => p.zone === 'board' && p.square === s);
  const merged = (p: PieceState) => p.id === 'white-bishop-c1' && effects.length === 2;
  const ray = (from: string, to: string, board = pieces, allowance = 0) => {
    const [x, y] = xy(from), [tx, ty] = xy(to), dx = Math.sign(tx - x), dy = Math.sign(ty - y);
    let obstacles = 0, previous = from;
    for (let n = 1; n <= Math.max(Math.abs(tx - x), Math.abs(ty - y)); n++) {
      const s = square(x + n * dx, y + n * dy);
      if (effects.length && [previous, s].sort().join() === 'a4,a5') obstacles++;
      if (s !== to && at(s, board)) obstacles++;
      previous = s;
    }
    return obstacles <= allowance;
  };
  const geometry = (p: PieceState, to: string, capture: boolean, board = pieces) => {
    const [x, y] = xy(p.square!), [tx, ty] = xy(to), dx = Math.abs(tx - x), dy = Math.abs(ty - y);
    const role = merged(p) ? 'queen' : p.role;
    if (role === 'knight') return dx * dy === 2;
    if (role === 'king') return Math.max(dx, dy) === 1 && ray(p.square!, to, board);
    if (role === 'pawn') {
      const forward = p.owner === 'white' ? 1 : -1;
      return capture ? dx === 1 && ty - y === forward && ray(p.square!, to, board)
        : dx === 0 && (ty - y === forward || ty - y === 2 * forward && y === (p.owner === 'white' ? 1 : 6)) && ray(p.square!, to, board);
    }
    return (role !== 'bishop' && (dx === 0 || dy === 0) || role !== 'rook' && dx === dy) && ray(p.square!, to, board);
  };
  const check = (c: Color, board = pieces) => {
    const king = board.find(p => p.royal && p.owner === c)!;
    return board.some(p => p.zone === 'board' && p.owner !== c && geometry(p, king.square!, true, board));
  };
  const boardFen = () => Array.from({ length: 8 }, (_, r) => {
    let text = '', empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = at(square(f, 7 - r));
      if (!p) { empty++; continue; }
      if (empty) { text += empty; empty = 0; }
      const symbol = ({ pawn: 'p', rook: 'r', knight: 'n', bishop: 'b', queen: 'q', king: 'k' })[p.role];
      text += p.owner === 'white' ? symbol.toUpperCase() : symbol;
    }
    return text + (empty || '');
  }).join('/');
  const capture = (p: PieceState, by: Color) => { p.square = null; p.zone = 'captured'; p.capturedBy = by; };
  const tick = (pawn = false, captured = false) => {
    half = pawn || captured ? 0 : half + 1;
    if (turn.color === 'black') full++;
    active = opposite(turn.color); rawEp = '-'; ep = [];
    turn.phase = 'afterMove'; turn.moveMade = true;
  };
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, note = rationales[index]!;
    assert.ok(note.startsWith(`${n} `));
    const snapshot = structuredClone(state), actionSnapshot = structuredClone(action);
    if (action.type === 'endTurn') {
      assert.equal(check(turn.color), false, note);
      assert.equal(turn.moveMade, true, note);
      turn = { color: opposite(turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      shield = undefined;
    } else if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.match(to, /^[a-h][1-8]$/);
      const p = at(from)!, victim = at(to);
      assert.ok(p); assert.equal(p.owner, turn.color); assert.equal(turn.moveMade, false);
      assert.ok(geometry(p, to, !!victim), note);
      assert.ok(!victim || victim.owner !== p.owner && !victim.royal);
      assert.ok(legalDests(state, false).get(from as SquareName)?.includes(to as SquareName), note);
      const event: GameEvent = { type: 'move', from: from as SquareName, to: to as SquareName };
      if (victim) { event.capturedId = victim.id; capture(victim, turn.color); }
      const [x, y] = xy(from), [, ty] = xy(to);
      tick(p.role === 'pawn', !!victim);
      if (p.role === 'pawn' && Math.abs(ty - y) === 2) ep = [{ target: square(x, (y + ty) / 2), pawnId: p.id }];
      if (p.id === 'white-rook-h1') rights = rights.replace('K', '');
      if (p.id === 'white-rook-a1') rights = rights.replace('Q', '');
      if (p.id === 'black-rook-h8') rights = rights.replace('k', '');
      if (p.royal) rights = rights.replace(p.owner === 'white' ? /[KQ]/g : /[kq]/g, '');
      p.square = to as SquareName; history.push(event);
      shield = { player: turn.color, pieceIds: merged(p) ? [p.id, 'white-rook-a1'] : [p.id], capturedOpponent: !!victim };
      assert.equal(check(turn.color), false, note);
    } else {
      assert.equal(action.type, 'playCard');
      if (action.type !== 'playCard') throw new Error(note);
      const expected: Record<number, [string, string, unknown]> = {
        17: ['long-jump', 'white-hand-4-long-jump', [{ from: 'g1', to: 'g4' }]],
        31: ['bombard', 'black-hand-0-bombard', [{ from: 'a8', to: 'a4' }]],
        49: ['hidden-passage', 'white-hand-3-hidden-passage', [{ from: 'e1', to: 'f4' }]],
        52: ['fireball', 'black-hand-2-fireball', 'a4'],
        72: ['onslaught', 'black-hand-4-onslaught', [{ from: 'd7', to: 'd6' }, { from: 'e6', to: 'e5' }, { from: 'h5', to: 'h4' }]],
        77: ['fortification', 'black-hand-1-fortification', { from: 'a4', to: 'a5' }],
        87: ['confabulation', 'white-hand-0-confabulation', [{ from: 'a1', to: 'c1' }]],
        91: ['ghostwalk', 'white-hand-2-ghostwalk', [{ from: 'a2', to: 'a4' }]],
        99: ['betrayal', 'white-hand-1-betrayal', { pieceId: 'white-pawn-d2', to: 'e4' }],
      };
      assert.deepEqual([action.cardId, action.cardInstanceId, action.target], expected[n], note);
      assert.equal(turn.phase, [52, 77].includes(n) ? 'afterMove' : 'beforeMove');
      assert.equal(turn.cardPlays[turn.color], 0);
      const player = players[turn.color], ci = player.hand.findIndex(c => c.id === action.cardInstanceId);
      assert.ok(ci >= 0); const [card] = player.hand.splice(ci, 1); assert.equal(card!.cardId, action.cardId);
      player.hand.push(player.deck.shift()!); turn.cardPlays[turn.color]++;
      if (![77, 87].includes(n)) player.discard.push(card!);
      const event = { type: 'cardPlayed', cardId: action.cardId, target: action.target } as GameEvent;
      if (n === 52) {
        assert.deepEqual(shield, { player: 'black', pieceIds: ['black-rook-a8'], capturedOpponent: false });
        const victims = pieces.filter(p => p.zone === 'board' && !p.royal && Math.abs(xy(p.square!)[0]) <= 1 && Math.abs(xy(p.square!)[1] - 3) <= 1);
        assert.deepEqual(victims.map(p => p.id), ['white-knight-b1', 'black-pawn-b7', 'black-rook-a8', 'black-bishop-f8']);
        for (const p of victims) capture(p, 'black'); half = 0;
        Object.assign(event, { capturedIds: victims.map(p => p.id), player: 'black', movement: [], preservePreviousMove: true });
      } else if (n === 72) {
        assert.equal(check('black'), false);
        const proposed = structuredClone(pieces);
        for (const [from, to] of [['d7', 'd6'], ['e6', 'e5'], ['h5', 'h4']] as const) {
          const p = at(from, proposed)!; assert.equal(at(to), undefined); assert.ok(geometry(p, to, false)); p.square = to;
        }
        assert.equal(check('black', proposed), true, 'Ba4 now has clear diagonal to Ke8');
        tick(); shield = undefined;
        history.push({ type: 'cardFizzled', cardId: 'onslaught', reason: 'SELF_CHECK', movement: [], preservePreviousMove: false });
      } else if (n === 77) {
        effects.push({ type: 'fortification', owner: 'black', card, from: 'a4', to: 'a5' });
      } else if (n === 99) {
        const victim = at('e4')!, returned = pieces.find(p => p.id === 'white-pawn-d2')!;
        assert.equal(victim.id, 'black-pawn-e7'); assert.equal(returned.zone, 'captured');
        victim.zone = 'dead'; victim.square = null; delete victim.capturedBy;
        returned.zone = 'board'; returned.square = 'e4'; delete returned.capturedBy;
        Object.assign(event, { movement: [], preservePreviousMove: false });
      } else {
        const [move] = action.target as Array<{ from: SquareName; to: SquareName }>;
        const p = at(move!.from)!; assert.equal(p.owner, turn.color);
        if (n === 17) { assert.equal(p.role, 'knight'); assert.notEqual((xy(move!.from)[0] + xy(move!.from)[1]) % 2, (xy(move!.to)[0] + xy(move!.to)[1]) % 2); }
        if (n === 31) { assert.equal(p.role, 'rook'); assert.equal(move!.from[0], move!.to[0]); assert.ok(ray(move!.from, move!.to, pieces, 1)); assert.equal(at('a7')!.id, 'black-pawn-a7'); rights = rights.replace('q', ''); }
        if (n === 49) assert.equal(p.royal, true);
        if (n === 87 || n === 91) assert.ok(geometry(p, move!.to, false));
        if (n !== 87) assert.equal(at(move!.to), undefined);
        tick(p.role === 'pawn');
        shield = { player: turn.color, pieceIds: [p.id], capturedOpponent: false };
        if (n === 87) {
          assert.equal(at('c1')!.id, 'white-bishop-c1');
          p.zone = 'away'; p.square = null;
          effects.push({ type: 'confabulation', owner: 'white', card, pieceIds: ['white-bishop-c1', 'white-rook-a1'] });
        } else p.square = move!.to;
        if (n === 91) { rawEp = 'a3'; ep = [{ target: 'a3', pawnId: p.id }]; }
        Object.assign(event, { movement: action.target, preservePreviousMove: false });
      }
      if (n !== 72) history.push(event);
      assert.equal(check(turn.color), false, note);
    }
    const result = applyAction(state, action);
    assert.deepEqual(state, snapshot, `${note}: action input immutable`);
    assert.deepEqual(action, actionSnapshot, `${note}: payload immutable`);
    assert.ok(result.ok, note); state = result.state;
    assert.deepEqual(state.pieces, pieces, `${note}: physical identities, zones, and captors`);
    assert.deepEqual(state.players, players, `${note}: exact card instances and drawing`);
    assert.deepEqual(state.turn, turn, note); assert.deepEqual(state.effects, effects, note);
    assert.deepEqual(state.history, history, `${note}: full event history`);
    assert.equal(state.fen, `${boardFen()} ${active[0]} ${rights || '-'} ${rawEp} ${half} ${full}`, note);
    assert.deepEqual(state.enPassant, ep, note);
    assert.equal(state.pendingRescue ?? null, null, note);
    assert.equal(state.pendingAbduction ?? null, null); assert.equal(state.pendingDoomsayer ?? null, null);
    assert.deepEqual(state.underElfHill ?? [], []); assert.equal(state.outcome, null); assert.equal(state.orientation, 0);
    for (const key of ['chaosForbidden', 'plotsExecution', 'riposteSkipped', 'riposteCheckDeferred'] as const) assert.equal(state[key], undefined, `${note}: ${key}`);
    for (const key of ['plotsAllowances', 'fogLocked', 'riposteLostMoves'] as const) assert.deepEqual(state[key] ?? [], [], `${note}: ${key}`);
    assert.deepEqual(state.shieldMove, shield, `${note}: exact movement token`);
    const queryInput = structuredClone(state);
    for (const c of ['white', 'black'] as const) assert.equal(isKingInCheck(state, c), check(c), `${note}: ${c} royal threats`);
    // Every EP opportunity here lacks an adjacent prospective captor. Check in that player's before-move context.
    for (const opportunity of ep) {
      const victim = pieces.find(p => p.id === opportunity.pawnId)!;
      const captorColor = opposite(victim.owner), prospective = structuredClone(state);
      prospective.turn = { color: captorColor, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      const beforeQuery = structuredClone(prospective);
      const [vx, vy] = xy(victim.square!);
      assert.equal(pieces.some(p => p.zone === 'board' && p.owner === captorColor && p.role === 'pawn' && xy(p.square!)[1] === vy && Math.abs(xy(p.square!)[0] - vx) === 1), false);
      const destinations = legalDests(prospective, false);
      for (const p of pieces.filter(p => p.zone === 'board' && p.owner === captorColor && p.role === 'pawn')) assert.equal(destinations.get(p.square!)?.includes(opportunity.target) ?? false, false);
      assert.deepEqual(prospective, beforeQuery);
    }
    assert.deepEqual(state, queryInput, `${note}: check and destination queries immutable`);
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 9);
  assert.equal(state.fen, 'b3k3/p7/2n1qp2/3pp1Rp/PP2P2K/2P1P2P/2B2P2/B7 w - - 1 29');
});
