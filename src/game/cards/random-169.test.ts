import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName, GameAction, GameEvent } from '../types.js';

// Rules §§8–13, 16.3, 17.1, 20 and printed catalog timing. These are
// hand-reviewed action reasons, not captions generated from reducer results.
const rationales = `
1 d2-d4 crosses empty d3; no opposing pawn can capture en passant.
2 End White turn; preserve d3 opportunity until Black moves.
3 a7-a5 crosses empty a6; no White pawn can capture en passant.
4 End Black turn; preserve a6 opportunity.
5 d4-d5 is an empty forward Pawn step.
6 End White turn with both royals safe.
7 f7-f5 crosses empty f6; no adjacent White pawn can take en passant.
8 End Black turn and retain f6 opportunity.
9 Nb1-d2 jumps to the vacated Pawn square.
10 End White turn; previous en-passant rights have expired.
11 Nb8-a6 is an empty Knight jump.
12 End Black turn with both royals safe.
13 Nd2-f3 is an empty Knight jump.
14 End White turn with both royals safe.
15 Ke8-f7 steps onto the vacated Pawn square; revoke both Black castling rights.
16 End Black turn with the royal safe on f7.
17 Qd1-d4 follows empty d2,d3.
18 End White turn with both royals safe.
19 Ra8-b8 follows one empty file step.
20 End Black turn with both royals safe.
21 Qd4-e4 follows one empty file step.
22 End White turn with both royals safe.
23 b7-b5 crosses empty b6; no White pawn can capture en passant.
24 Black Forbidden City marks empty g4 after its move; retain physical card as an effect and draw Tournament.
25 End Black turn, keeping g4 forbidden and b6 opportunity.
26 Qe4-b4 follows empty d4,c4 to b4 and avoids g4.
27 White Disintegration kills its c2 Pawn after moving, with no captor or clock reset; draw Pacifism.
28 End White turn; c2 is dead and cannot return.
29 Black Lost Castle exchanges Rh8/Rh1 instead of moving; identities retain ownership, White loses kingside rights; draw Evangelists.
30 End Black replacement turn; these swaps are not Mystic Shield movement.
31 White Rh8xh7 captures the Black h7 Pawn, credited to White.
32 End White capturing turn; reset halfmove counter retained.
33 Black Na6-c5 is an empty Knight jump.
34 End Black turn with both royals safe.
35 White Pacifism marks its nonroyal b2 Pawn before moving; retain physical effect card and draw Long Jump.
36 Rh7-h4 follows empty h6,h5, never passing g4.
37 End White turn; Pacifism and Forbidden City persist.
38 d7-d6 is an empty forward Pawn step.
39 End Black turn with both royals safe.
40 Nf3-g5 gives Knight check to Black Kf7.
41 End White turn; Black receives its check-answering turn.
42 g7-g6 leaves Ng5 checking Kf7; concrete held Treason Rh4/Ng5 rescue removes that attack.
43 Treason instead selects White Ra1/Ng1 and cannot cure Ng5 check; spend/draw No Quarter and undo illegal g6. Historical shield token is inert before a move.
44 Kf7-f6 escapes the Knight attack; overwrite the inert Pawn movement token.
45 End Black turn with the royal safe on f6.
46 Bc1-f4 follows empty d2,e3.
47 End White turn with both royals safe.
48 Rb8-b6 follows empty b7.
49 White Think Again cancels b8-b6, restores clocks/history, draws No Quarter, and forbids that exact physical move.
50 Black Tournament exchanges Nc5/Ng1 instead of moving; different physical transition satisfies cancellation and draws Knightmare.
51 End Black turn; no cancellation prohibition survives.
52 Qb4-b3 is one empty rank step.
53 End White turn with both royals safe.
54 Bc8-e6 follows empty d7.
55 End Black turn with both royals safe.
56 White Long Jump sends Ng5 to empty c4 of the opposite square color, replacing the move; draw Man of Straw.
57 End White replacement turn.
58 Rb8-b6 follows empty b7; old cancellation prohibition has expired.
59 End Black turn with both royals safe.
60 a2-a3 is an empty forward Pawn step.
61 End White turn with both royals safe.
62 Black Ng1xe2 captures White e2 Pawn, credited to Black.
63 End Black capturing turn.
64 White Blessing moves Qb3-a4 diagonally without capture, replacing the move; draw Siege.
65 End White replacement turn.
66 Ne2-c1 is an empty Knight jump.
67 End Black turn with both royals safe.
68 Qa4-d1 follows empty b3,c2; c2 Pawn remains dead.
69 End White turn with both royals safe.
70 Nc1-e2 is an empty Knight jump.
71 End Black turn with both royals safe.
72 Pacifist b2-b3 advances without capturing; its marker follows its identity.
73 End White turn; b3 Pawn remains immune to capture and unable to capture.
74 Ng8-h6 is an empty Knight jump.
75 End Black turn with both royals safe.
76 White Ke1xe2 safely captures Black original b8 Knight; revoke remaining White castling rights.
77 End White capturing turn.
78 Rb6-b7 is an empty rank step.
79 End Black turn with both royals safe.
80 Ke2-e3 steps to a safe empty square.
81 End White turn with both royals safe.
82 Black b5xc4 captures White original b1 Knight, credited to Black.
83 End Black capturing turn.
84 Qd1-b1 follows empty c1.
85 End White turn with both royals safe.
86 Qd8-a8 follows empty c8,b8.
87 End Black turn with both royals safe.
88 Nc5-e4 gives Knight check to Black Kf6.
89 End White turn; Black must answer the check.
90 Black f5xe4 captures the checking White original g1 Knight and cures check.
91 End Black turn with both royals safe.
92 h2-h3 is an empty forward Pawn step.
93 End White turn with both royals safe.
94 Nh6-g8 is an empty Knight jump.
95 End Black turn with both royals safe.
96 Bf4-h6 follows empty g5; g4 is not on this diagonal.
97 End White turn with both royals safe.
98 Be6-c8 follows empty d7.
99 End Black turn with both royals safe.
100 g2-g3 is an empty forward Pawn step and does not enter g4.
101 End White turn with both royals safe.
102 Bc8-d7 is one empty diagonal step.
103 End Black turn with both royals safe.
104 a3-a4 is an empty forward Pawn step.
105 Black Knightmare cancels a3-a4, restores the Pawn and clocks/history, draws Resurrection, and forbids repeating that physical move.
106 Qb1-e1 follows empty c1,d1; this different replacement clears the prohibition.
107 End White turn; Black reaction allowance resets.
108 Black Resurrection returns its captured h7 Pawn to vacant a7, a legal original Pawn square; clear capturedBy, replace move, draw Fog of War.
109 End Black replacement turn; no en-passant right is created by placement.
110 Qe1-b4 follows empty d2,c3.
111 End White turn with both royals safe.
112 Rb7-b5 follows empty b6.
113 End Black turn after the fiftieth regular move command.
`.trim().split('\n');

const cards: Record<number, { cardId: string; id: string; owner: Color; timing: string; target?: unknown }> = {
  24: { cardId: 'forbidden-city', id: 'black-hand-3-forbidden-city', owner: 'black', timing: 'afterMove', target: 'g4' },
  27: { cardId: 'disintegration', id: 'white-hand-1-disintegration', owner: 'white', timing: 'afterMove', target: 'c2' },
  29: { cardId: 'lost-castle', id: 'black-hand-0-lost-castle', owner: 'black', timing: 'beforeMove', target: { own: 'h8', opponent: 'h1' } },
  35: { cardId: 'pacifism', id: 'white-deck-0-pacifism', owner: 'white', timing: 'beforeMove', target: 'b2' },
  43: { cardId: 'treason', id: 'black-hand-1-treason', owner: 'black', timing: 'afterMove', target: { rook: 'a1', knight: 'g1' } },
  49: { cardId: 'think-again', id: 'white-hand-3-think-again', owner: 'white', timing: 'afterOpponentMove' },
  50: { cardId: 'tournament', id: 'black-deck-0-tournament', owner: 'black', timing: 'beforeMove', target: { own: 'c5', opponent: 'g1' } },
  56: { cardId: 'long-jump', id: 'white-deck-1-long-jump', owner: 'white', timing: 'beforeMove', target: [{ from: 'g5', to: 'c4' }] },
  64: { cardId: 'blessing', id: 'white-hand-4-blessing', owner: 'white', timing: 'beforeMove', target: [{ from: 'b3', to: 'a4' }] },
  105: { cardId: 'knightmare', id: 'black-deck-3-knightmare', owner: 'black', timing: 'afterOpponentMove' },
  108: { cardId: 'resurrection', id: 'black-deck-4-resurrection', owner: 'black', timing: 'beforeMove', target: { pieceId: 'black-pawn-h7', to: 'a7' } },
};
const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white';
const xy = (s: string): [number, number] => [s.charCodeAt(0) - 97, +s[1]! - 1];
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
const square = (s: string): SquareName => { assert.match(s, /^[a-h][1-8]$/); return s as SquareName; };
const pacifist = (s: GameState, id: string) => s.effects.some(e => (e as { type: string; pieceId?: string }).type === 'pacifism' && (e as { pieceId?: string }).pieceId === id);
const forbidden = (s: GameState, target: string) => s.effects.some(e => (e as { type: string; square?: string }).type === 'forbidden-city' && (e as { square?: string }).square === target);

// Geometry is evaluated on expected physical records, without reducer destinations.
function geometry(s: GameState, p: PieceState, to: string, capture: boolean): boolean {
  const [x, y] = xy(p.square!), [u, v] = xy(to), dx = u - x, dy = v - y;
  if ((!dx && !dy) || forbidden(s, to)) return false;
  if (capture && pacifist(s, p.id)) return false;
  if (p.role === 'knight') return Math.abs(dx) * Math.abs(dy) === 2;
  if (p.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  if (p.role === 'pawn') {
    const forward = p.owner === 'white' ? 1 : -1;
    if (capture) return Math.abs(dx) === 1 && dy === forward;
    if (dx || ![forward, 2 * forward].includes(dy)) return false;
    if (dy === 2 * forward && !(p.owner === 'white' ? y <= 1 : y >= 6)) return false;
  } else if (!(p.role === 'queen' && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))
    || p.role === 'rook' && (dx === 0 || dy === 0)
    || p.role === 'bishop' && Math.abs(dx) === Math.abs(dy))) return false;
  for (let i = 1; i < Math.max(Math.abs(dx), Math.abs(dy)); i++) {
    const q = String.fromCharCode(97 + x + i * Math.sign(dx)) + (y + i * Math.sign(dy) + 1);
    if (at(s.pieces, q) || forbidden(s, q)) return false;
  }
  return true;
}
function checked(s: GameState, owner: Color): boolean {
  const king = s.pieces.find(p => p.royal && p.owner === owner)!;
  return s.pieces.some(p => p.zone === 'board' && p.owner !== owner && geometry(s, p, king.square!, true));
}
function placement(pieces: PieceState[]): string {
  const letters = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, rank) => {
    let empty = 0, out = '';
    for (let file = 0; file < 8; file++) {
      const p = at(pieces, String.fromCharCode(97 + file) + (8 - rank));
      if (!p) { empty++; continue; }
      if (empty) { out += empty; empty = 0; }
      out += p.owner === 'white' ? letters[p.role].toUpperCase() : letters[p.role];
    }
    return out + (empty || '');
  }).join('/');
}
function immutable(s: GameState, action: GameAction) {
  const before = structuredClone(s);
  const result = applyAction(s, action);
  assert.deepEqual(s, before, `input immutable: ${JSON.stringify(action)}`);
  return result;
}
function epCaptures(s: GameState, color: Color): string[] {
  return s.enPassant.flatMap(ep => {
    const victim = s.pieces.find(p => p.id === ep.pawnId)!;
    return s.pieces.flatMap(p => {
      if (p.zone !== 'board' || p.owner !== color || p.role !== 'pawn' || victim.owner === color
        || at(s.pieces, ep.target) || !geometry(s, p, ep.target, true) || pacifist(s, victim.id)) return [];
      const trial = structuredClone(s);
      const moving = trial.pieces.find(q => q.id === p.id)!, removed = trial.pieces.find(q => q.id === victim.id)!;
      moving.square = ep.target; removed.square = null; removed.zone = 'captured'; removed.capturedBy = color;
      return checked(trial, color) ? [] : [`${p.square}:${ep.target}`];
    });
  });
}

test('iteration 169: 113 individually reasoned actions and complete physical oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/169.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860169);
  assert.equal(trace.steps.length, 113);
  assert.equal(rationales.length, trace.steps.length);
  let actual = createGameState(trace.initial), expected = structuredClone(actual);
  assert.equal(actual.fen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const back: PieceState['role'][] = ['rook','knight','bishop','queen','king','bishop','knight','rook'];
  expected.pieces = [1,2,7,8].flatMap(rank => Array.from({ length: 8 }, (_, file): PieceState => {
    const owner = rank < 3 ? 'white' : 'black', role = rank === 2 || rank === 7 ? 'pawn' : back[file]!;
    const home = square(String.fromCharCode(97 + file) + rank);
    return { id: `${owner}-${role}-${home}`, owner, role, originalRole: role, square: home,
      zone: 'board', promoted: false, royal: role === 'king', neutral: false };
  }));
  assert.deepEqual(actual.pieces, expected.pieces);
  const checkpoints = new Map<number, GameState>();
  const expectedMoves = 'd2d4 a7a5 d4d5 f7f5 b1d2 b8a6 d2f3 e8f7 d1d4 a8b8 d4e4 b7b5 e4b4 h8h7 a6c5 h7h4 d7d6 f3g5 g7g6 f7f6 c1f4 b8b6 b4b3 c8e6 b8b6 a2a3 g1e2 e2c1 a4d1 c1e2 b2b3 g8h6 e1e2 b6b7 e2e3 b5c4 d1b1 d8a8 c5e4 f5e4 h2h3 h6g8 f4h6 e6c8 g2g3 c8d7 a3a4 b1e1 e1b4 b7b5'.split(' ');
  let moves = 0, played = 0;
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, label = rationales[index]!;
    const actualBefore = structuredClone(actual);
    assert.ok(label.startsWith(`${n} `));
    checkpoints.set(n, structuredClone(expected));
    let fields = expected.fen.split(' ');
    const actor = expected.turn.color;
    const sync = () => { fields[0] = placement(expected.pieces); expected.fen = fields.join(' '); };
    const completeMove = (reset: boolean) => {
      fields[1] = opposite(actor) === 'white' ? 'w' : 'b'; fields[3] = '-';
      fields[4] = String(reset ? 0 : +fields[4]! + 1);
      fields[5] = String(+fields[5]! + (actor === 'black' ? 1 : 0));
      expected.turn.phase = 'afterMove'; expected.turn.moveMade = true; expected.enPassant = [];
      delete expected.chaosForbidden;
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.equal(from + to, expectedMoves[moves++], label);
      assert.equal(expected.turn.phase, 'beforeMove'); assert.equal(expected.turn.moveMade, false);
      const p = at(expected.pieces, from)!, victim = at(expected.pieces, to);
      assert.ok(p); assert.equal(p.owner, actor);
      assert.ok(geometry(expected, p, to, !!victim), label);
      if (victim) { assert.equal(victim.owner, opposite(actor)); assert.equal(victim.royal, false); assert.equal(pacifist(expected, victim.id), false); }
      const event: GameEvent = { type: 'move', from: square(from), to: square(to),
        ...(victim ? { capturedId: victim.id } : {}),
        ...(actor === 'white' ? { movedPieceId: p.id, movedRoles: [p.role] } : {}) };
      if (victim) { victim.square = null; victim.zone = 'captured'; victim.capturedBy = actor; }
      p.square = square(to);
      completeMove(p.role === 'pawn' || !!victim);
      if (n === 15) fields[2] = 'KQ';
      if (n === 76) fields[2] = '-';
      if (p.role === 'pawn' && Math.abs(+to[1]! - +from[1]!) === 2) expected.enPassant = [{ target: square(from[0]! + ((+from[1]! + +to[1]!) / 2)), pawnId: p.id }];
      expected.history.push(event);
      expected.shieldMove = { player: actor, pieceIds: [p.id], capturedOpponent: !!victim };
    } else if (action.type === 'endTurn') {
      assert.ok(expected.turn.moveMade); assert.equal(checked(expected, actor), false, label);
      expected.turn = { color: opposite(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      delete expected.shieldMove; delete expected.cardResponse; delete expected.chaosForbidden;
    } else {
      assert.equal(action.type, 'playCard');
      if (action.type !== 'playCard') throw new Error('unexpected action');
      const contract = cards[n]!; assert.ok(contract); played++;
      assert.equal(action.cardId, contract.cardId); assert.equal(action.cardInstanceId, contract.id); assert.deepEqual(action.target, contract.target);
      assert.equal(expected.turn.cardPlays[contract.owner], 0);
      assert.equal(contract.timing, contract.owner === actor ? expected.turn.phase : 'afterOpponentMove');
      if (contract.owner !== actor) assert.equal(expected.turn.moveMade, true);
      const player = expected.players[contract.owner], card = player.hand.find(c => c.id === contract.id)!;
      assert.deepEqual(card, { id: contract.id, cardId: contract.cardId });
      player.hand = player.hand.filter(c => c.id !== contract.id); player.hand.push(player.deck.shift()!);
      if (![24, 35].includes(n)) player.discard.push(card);
      expected.turn.cardPlays[contract.owner]++;
      let event: GameEvent = { type: 'cardPlayed', cardId: contract.cardId, target: contract.target as GameEvent['target'], movement: [], preservePreviousMove: expected.turn.moveMade };
      if (n === 24) {
        assert.equal(at(expected.pieces, 'g4'), undefined);
        expected.effects.push({ type: 'forbidden-city', owner: 'black', card, square: 'g4' });
        event = { type: 'cardPlayed', cardId: contract.cardId, target: 'g4' };
      } else if (n === 27) {
        const pawn = at(expected.pieces, 'c2')!; assert.equal(pawn.id, 'white-pawn-c2'); pawn.zone = 'dead'; pawn.square = null; delete pawn.capturedBy;
      } else if (n === 35) {
        expected.effects.push({ type: 'pacifism', owner: 'white', card, pieceId: 'white-pawn-b2' });
      } else if ([29, 50].includes(n)) {
        const pair = n === 29 ? ['h1', 'h8'] : ['g1', 'c5'];
        const a = at(expected.pieces, pair[0]!)!, b = at(expected.pieces, pair[1]!)!;
        assert.equal(a.owner, 'white'); assert.equal(b.owner, 'black');
        assert.equal(a.role, n === 29 ? 'rook' : 'knight'); assert.equal(b.role, a.role);
        event.movement = [{ from: a.square!, to: b.square! }, { from: b.square!, to: a.square! }];
        [a.square, b.square] = [b.square, a.square]; completeMove(false);
        if (n === 29) fields[2] = 'Q';
        expected.shieldMove = { player: actor, capturedOpponent: false, pieceIds: [] };
      } else if ([43, 49, 105].includes(n)) {
        const saved = checkpoints.get(n === 43 ? 42 : n - 1)!;
        const oldShield = expected.shieldMove;
        expected.pieces = structuredClone(saved.pieces); expected.enPassant = structuredClone(saved.enPassant);
        expected.history = structuredClone(saved.history); fields = saved.fen.split(' ');
        expected.turn.phase = 'beforeMove'; expected.turn.moveMade = false;
        if (n === 43) {
          event = { type: 'cardFizzled', cardId: 'treason', reason: 'SELF_CHECK', movement: [], preservePreviousMove: false };
          // This historical token is inert: public timing rejects Shield, and the next move replaces it.
          expected.shieldMove = oldShield;
        } else {
          delete expected.shieldMove;
          const from = n === 49 ? 'b8' : 'a3', to = n === 49 ? 'b6' : 'a4';
          event = { type: 'cardPlayed', cardId: contract.cardId, player: contract.owner, movement: [{ from: square(to), to: square(from) }], preservePreviousMove: true };
          expected.chaosForbidden = { player: actor, movement: `${at(saved.pieces, from)!.id}:${from}:${to}` };
        }
      } else if ([56, 64].includes(n)) {
        const from = n === 56 ? 'g5' : 'b3', to = n === 56 ? 'c4' : 'a4', p = at(expected.pieces, from)!;
        assert.equal(at(expected.pieces, to), undefined); assert.equal(forbidden(expected, to), false);
        if (n === 56) { assert.equal(p.role, 'knight'); const [x,y] = xy(from), [u,v] = xy(to); assert.notEqual((x+y)%2, (u+v)%2); }
        else assert.ok(geometry(expected, { ...p, role: 'bishop' }, to, false));
        p.square = square(to); completeMove(false);
        event.movement = [{ from: square(from), to: square(to) }];
        expected.shieldMove = { player: actor, capturedOpponent: false, pieceIds: [p.id] };
      } else if (n === 108) {
        const p = expected.pieces.find(p => p.id === 'black-pawn-h7')!;
        assert.equal(p.zone, 'captured'); assert.equal(p.capturedBy, 'white'); assert.equal(at(expected.pieces, 'a7'), undefined);
        p.zone = 'board'; p.square = 'a7'; delete p.capturedBy; completeMove(true);
        expected.shieldMove = { player: actor, capturedOpponent: false, pieceIds: [] };
      } else throw new Error(`unreviewed card ${n}`);
      expected.history.push(event);
      expected.cardResponse = { player: contract.owner, historyLength: expected.history.length };
    }
    sync();
    const result = immutable(actual, action); assert.ok(result.ok, label); actual = result.state;
    assert.deepEqual(actual.pieces, expected.pieces, `${label}: all physical identities/zones/captors`);
    assert.equal(actual.fen, expected.fen, `${label}: all six FEN fields`);
    assert.deepEqual(actual.players, expected.players, `${label}: physical hands/decks/discards`);
    assert.deepEqual(actual.effects, expected.effects, `${label}: complete effects`);
    assert.deepEqual(actual.turn, expected.turn, `${label}: timing and allowance`);
    assert.deepEqual(actual.history, expected.history, `${label}: events including rollback/fizzle`);
    assert.deepEqual(actual.cardResponse, expected.cardResponse, `${label}: exact response window`);
    assert.deepEqual(actual.enPassant, expected.enPassant, `${label}: raw opportunities`);
    assert.equal(actual.orientation, 0); assert.equal(actual.outcome, null);
    for (const color of ['white', 'black'] as const) {
      const threat = checked(expected, color);
      assert.equal(threat, color === 'black' && [40,41,42,43,88,89].includes(n), `${label}: independent royal geometry`);
      assert.equal(isKingInCheck(actual, color), threat, `${label}: public royal check`);
    }
    const prospective = fields[1] === 'w' ? 'white' : 'black';
    assert.deepEqual(epCaptures(expected, prospective), [], `${label}: no adjacent legal en-passant captor`);
    if (expected.enPassant.length) {
      const context = structuredClone(actual); context.turn = { color: prospective, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      const original = structuredClone(context), dests = legalDests(context);
      assert.deepEqual(context, original);
      for (const ep of expected.enPassant) for (const p of expected.pieces.filter(p => p.owner === prospective && p.role === 'pawn' && p.zone === 'board')) {
        if (p.square![0] !== ep.target[0]) assert.equal(dests.get(p.square!)?.includes(ep.target) ?? false, false);
      }
    }
    assert.deepEqual(actual.shieldMove, expected.shieldMove, `${label}: complete movement token`);
    assert.deepEqual(actual.chaosForbidden, expected.chaosForbidden);
    for (const key of ['plotsExecution','riposteSkipped','riposteCheckDeferred'] as const) assert.equal(actual[key], undefined);
    for (const key of ['plotsAllowances','fogLocked','riposteLostMoves','underElfHill'] as const) assert.deepEqual(actual[key] ?? [], []);
    for (const key of ['pendingAbduction','pendingDoomsayer'] as const) assert.equal(actual[key] ?? null, null);
    if (n === 42) {
      const before = checkpoints.get(42)!;
      assert.ok(actual.pendingRescue);
      assert.equal(actual.pendingRescue.fen, before.fen); assert.deepEqual(actual.pendingRescue.pieces, before.pieces);
      assert.deepEqual(actual.pendingRescue.enPassant, before.enPassant); assert.equal(actual.pendingRescue.historyLength, before.history.length);
      assert.deepEqual(actual.pendingRescue.movedPieceIds, ['black-pawn-g7']); assert.equal(actual.pendingRescue.history, undefined);
      assert.deepEqual(actual.pendingRescue.before, actualBefore, 'complete pre-move rescue checkpoint');
      assert.deepEqual(actual.pendingRescue.before?.history, before.history);
      assert.deepEqual(actual.pendingRescue.before?.pieces, before.pieces); assert.equal(actual.pendingRescue.before?.fen, before.fen);
      assert.deepEqual(actual.pendingRescue.before?.enPassant, before.enPassant);
      const trial = structuredClone(expected), rook = at(trial.pieces, 'h4')!, knight = at(trial.pieces, 'g5')!;
      assert.equal(rook.id, 'white-rook-h1'); assert.equal(knight.id, 'white-knight-b1');
      [rook.square, knight.square] = [knight.square, rook.square];
      assert.equal(checked(trial, 'black'), false); assert.equal(checked(trial, 'white'), false);
      const rescue = immutable(actual, { type: 'playCard', cardId: 'treason', cardInstanceId: 'black-hand-1-treason', target: { rook: 'h4', knight: 'g5' } });
      assert.ok(rescue.ok); assert.deepEqual(rescue.state.pieces, trial.pieces); assert.equal(rescue.state.pendingRescue ?? null, null);
      assert.equal(rescue.state.fen, placement(trial.pieces) + ' w Q - 0 11');
      const rescuePlayers = structuredClone(expected.players), black = rescuePlayers.black;
      const spent = black.hand.find(c => c.id === 'black-hand-1-treason')!;
      black.hand = black.hand.filter(c => c.id !== spent.id); black.discard.push(spent); black.hand.push(black.deck.shift()!);
      assert.deepEqual(rescue.state.players, rescuePlayers);
      assert.deepEqual(rescue.state.turn, { color: 'black', phase: 'afterMove', moveMade: true, cardPlays: { white: 0, black: 1 } });
      assert.deepEqual(rescue.state.effects, expected.effects); assert.deepEqual(rescue.state.enPassant, []);
      assert.deepEqual(rescue.state.shieldMove, expected.shieldMove);
      assert.deepEqual(rescue.state.history, [...expected.history, { type: 'cardPlayed', cardId: 'treason', target: { rook: 'h4', knight: 'g5' },
        movement: [{ from: 'g5', to: 'h4' }, { from: 'h4', to: 'g5' }], preservePreviousMove: true }]);
      assert.equal(isKingInCheck(rescue.state, 'black'), false);
      const closed = immutable(rescue.state, { type: 'endTurn' }); assert.ok(closed.ok);
    } else assert.equal(actual.pendingRescue ?? null, null);
    if (n === 43) {
      const failedSwap = structuredClone(checkpoints.get(43)!);
      const a = at(failedSwap.pieces, 'a1')!, b = at(failedSwap.pieces, 'g1')!;
      [a.square, b.square] = [b.square, a.square];
      assert.equal(checked(failedSwap, 'black'), true, 'chosen Treason target does not remove Ng5 check');
      const probe = structuredClone(actual);
      probe.players.black.hand.push({ id: 'probe-169-shield', cardId: 'mystic-shield' }); probe.turn.cardPlays.black = 0;
      const denied = immutable(probe, { type: 'playCard', cardId: 'mystic-shield', cardInstanceId: 'probe-169-shield', target: 'g7' });
      assert.equal(denied.ok, false, 'rolled-back Pawn token cannot permit Mystic Shield before a move');
      assert.deepEqual(denied.state, probe);
    }
    if ([49,105].includes(n)) {
      const repeated = immutable(actual, { type: 'move', from: n === 49 ? 'b8' : 'a3', to: n === 49 ? 'b6' : 'a4' });
      assert.equal(repeated.ok, false); assert.deepEqual(repeated.state, actual);
    }
  }
  assert.equal(moves, 50); assert.equal(played, 11);
  assert.equal(actual.fen, 'q4bn1/p1pbp1p1/3p1k1B/pr1P4/1Qp1p2R/PP2K1PP/5P2/R4B1r w - - 2 27');
  replayTrace(trace);
});
