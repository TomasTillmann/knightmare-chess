import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { CardMove, Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';

// Read in order against rules §§8–13, 15.5, 16.3, 17–18, 20, 22.8/22.12
// and artwork KC12/1, KC19/2, KC12/3, KC17/1, KC16/4, KC4/1,
// KC20/2, KC18/3, KC3/2, KC8/2, KC10/4. Each line is one reviewed action.
const rationales = `
1 Nh3: g1-h3 is an unobstructed Knight jump to an empty square.
2 End White: completed Nh3 leaves both royals safe; no card or capture changes.
3 e5: black e7 pawn crosses empty e6 to empty e5; record e6 opportunity.
4 End Black: e6 opportunity survives but White has no adjacent fifth-rank Pawn.
5 d4: white d2 pawn crosses empty d3; prior e6 opportunity expires.
6 End White: d3 opportunity survives; no black fourth-rank captor exists.
7 Qh4: d8-e7-f6-g5-h4 diagonal is clear after e7-e5.
8 End Black: Qh4 does not attack e1 through any legal ray.
9 Ng1: h3-g1 is a Knight jump back to the empty origin.
10 End White: clocks and all cards stay unchanged.
11 Qxh2: h4-h3-h2 clear ray captures white h2 Pawn for Black.
12 End Black: h2 Queen leaves both Kings safe.
13 e4: e2-e3-e4 clear double Pawn move creates e3 opportunity.
14 End White: no black Pawn can capture e3 en passant.
15 c5: c7-c6-c5 is clear; e3 opportunity expires for c6.
16 End Black: no white Pawn on b5 or d5 can capture c6.
17 Bg5: c1-d2-e3-f4-g5 is a clear diagonal to an empty square.
18 End White: no unresolved choice or check remains.
19 Onslaught: Black spends hand-3; a7/c5/f7/g7/h7 all advance one to initially empty squares, consume move, no capture or EP.
20 Fog: White spends hand-2 immediately; restore all five Pawns, original FEN and move, retain both spent cards and both draws; lock Black's card allowance.
21 h5: Black's replacement h7-h6-h5 double step is clear; Fog allows this move but no second card.
22 End Black: clear Fog lock and both turn allowances; h6 remains only a raw opportunity.
23 f3: white f2 Pawn advances one empty square; h6 expires.
24 End White: no card or physical change.
25 Rh6: h8-h7-h6 clear file; revoke Black's h8 castling right.
26 End Black: halfmove one and remaining castling rights persist.
27 Tournament: White spends hand-1 to swap white b1 and black b8 Knights, no capture; replaces move.
28 End White: both Knights keep original owners and physical identities.
29 Ra6: h6-g6-f6-e6-d6-c6-b6-a6 clear rank.
30 End Black: both royals safe and no pending obligations.
31 Bd2: g5-f4-e3-d2 clear diagonal, no capture.
32 End White: no state change beyond turn opening.
33 Rd6: a6-b6-c6-d6 clear rank.
34 Treason: Black spends hand-0 after move; exchange opponent h1 Rook and b8 Knight without move/capture or clock advance; retain prior Rook move trigger.
35 End Black: relocated h1 Rook retains identity; swap alone does not consume castling permission.
36 Resurrection: White spends deck-0 to return captured h2 Pawn to empty starting-type square e2; clear captor, consume replacement move, reset Pawn clock.
37 End White: returned h2 Pawn is a distinct physical piece from e2 Pawn on e4.
38 Nf6: g8-f6 Knight jump to empty square.
39 End Black: no capture or card changes.
40 Ba5: d2-c3-b4-a5 clear diagonal.
41 End White: Kings safe, no additional choices.
42 Ra6: d6-c6-b6-a6 clear rank.
43 Vendetta: Black spends deck-1 after move; retain card as effect and draw Legacy, requiring future legal captures.
44 End Black: White can capture black b1 Knight, so Vendetta survives.
45 Qxb1: d1-c1-b1 captures black original b8 Knight and satisfies Vendetta.
46 Legacy: Black's non-Pawn Knight just captured; spend deck-2, retrieve exact discarded hand-3 Onslaught, then draw Hostage; board/history of capture persist.
47 End White: Black can capture g2 Pawn; reset both allowances including Legacy reaction.
48 Qxg2: h2-g2 takes white g2 Pawn, satisfying Vendetta.
49 End Black: White can capture Queen g2, so effect remains.
50 Bxg2: f1-g2 captures black original d8 Queen, satisfying Vendetta.
51 End White: Black a8 Rook can capture white Rook b8.
52 Rxb8: a8-b8 captures relocated white original h1 Rook; revoke both affected Rook castling rights.
53 End Black: White d4 Pawn can capture c5 Pawn.
54 dxc5: white original d2 Pawn diagonally captures black c7 Pawn on c5.
55 End White: black f8 Bishop has clear e7-d6-c5 capture ray.
56 Bxc5: f8-e7-d6-c5 captures white original d2 Pawn under Vendetta.
57 End Black: independently enumerate all White captures; none legal, so discard Vendetta now.
58 b3: b2-b3 clear one-square Pawn move after Vendetta expires.
59 End White: no capture requirement remains.
60 Bb4: c5-b4 clear diagonal step.
61 End Black: Bishop b4 checks white King e1 along empty c3,d2.
62 Kf1: e1-f1 safe empty adjacent square escapes Bishop check; remove remaining White castling right.
63 End White: f1 King safe; no remaining castling rights.
64 g5: g7-g6-g5 clear double Pawn step; record g6, no available EP captor.
65 End Black: g6 raw opportunity survives without legal capture.
66 f4: f3-f4 empty forward square; clear g6 opportunity.
67 End White: safe completed Pawn move.
68 Bxa5: b4-a5 captures white original c1 Bishop.
69 Mystic Shield: Black spends deck-0 after its Bishop capture; protect that exact f8 Bishop on a5 for White's next turn, discard card and draw Lost Castle.
70 End Black: Shield remains through White's upcoming turn.
71 Madman: White spends hand-4; Pawn f4 jumps diagonally over black e5 Pawn to empty d6; e5 survives, replacement move consumed.
72 End White: Shield expires exactly after the protected opponent turn; no continuing card is discarded again.
73 Onslaught: retrieved Black hand-3 advances only g5 Pawn to empty g4, consumes move and draws Peace Talks.
74 End Black: no new EP opportunity arises from one-square Onslaught.
75 c3: c2-c3 is a clear forward Pawn step.
76 End White: no capture/card effects.
77 Ng8: f6-g8 empty Knight destination.
78 End Black: both royal pieces remain safe.
79 a4: a2-a3-a4 clear double Pawn step; record a3 with no opposing EP captor.
80 End White: a3 opportunity remains until reply move.
81 Nh6: g8-h6 Knight jump clears a3 opportunity.
82 End Black: no new choices or effects.
83 Bf3: g2-f3 empty diagonal step.
84 End White: Bishop relocation preserves physical identity.
85 Kd8: e8-d8 empty adjacent safe square.
86 End Black: no castling rights revive.
87 Qd3: b1-c2-d3 clear diagonal.
88 End White: no capture or royal threat.
89 Rxd6: a6-b6-c6-d6 captures white original f2 Pawn moved by Madman.
90 End Black: original Pawn remains captured by Black, with no transformation.
91 Nf2: original white b1 Knight jumps h1-f2 to empty square.
92 End White: both Kings safe.
93 f5: f7-f6-f5 clear double Pawn step; record f6 but no white fifth-rank captor.
94 End Black: no en-passant capture exists despite raw f6 opportunity.
95 Irresistible Force: White deck-1 pushes from a4 to occupied a5; black Bishop goes to empty a6, neither captured; Pawn replacement move clears f6.
96 End White: pushed Bishop keeps original f8 identity; no card protection remains.
97 Rd5: d6-d5 empty orthogonal step.
98 End Black: no changed hand or effect.
99 b4: b3-b4 clear Pawn step.
100 End White: no pending obligation.
101 Rd4: d5-d4 empty orthogonal step.
102 End Black: Rook has no ray to white King f1.
103 Ke1: f1-e1 safe adjacent empty square, no castling restoration.
104 End White: no additional move allowed.
105 f4: f5-f4 empty forward step for Black.
106 End Black: no Pawn capture or EP right created.
107 Nh3: f2-h3 empty Knight jump.
108 End White: no card spending.
109 Rc4: d4-c4 clear one-square rank move.
110 End Black: both royals safe.
111 Qd4: d3-d4 empty one-square file move.
112 Coup: White spends deck-4 after Qd4; e1 King becomes capturable Prince and g1 Knight becomes royal while retaining Knight movement; retain continuing card and draw Split Knight.
113 End White: evaluate White's royal g1 Knight, not Prince e1.
114 b5: b7-b6-b5 clear double step; White a5 Pawn can capture b6 en passant without exposing royal g1.
115 End Black: b6 remains legal to prospective White a5 captor; simulate removal of black b5 Pawn independently.
116 Bh1: f3-g2-h1 clear diagonal, declining b6 EP; g1 royal Knight remains safe.
117 End White: final board has white Prince e1 and royal Knight g1, Coup active, Black to move with no EP or pending choices.
`.trim().split('\n');

const colors = ['white', 'black'] as const;
const other = (color: Color): Color => color === 'white' ? 'black' : 'white';
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const sq = (x: number, y: number) => `${String.fromCharCode(97 + x)}${y + 1}` as SquareName;
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
function geometry(pieces: PieceState[], piece: PieceState, to: string, capture: boolean): boolean {
  assert.ok(piece.square);
  const [x, y] = xy(piece.square), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
  if (!dx && !dy) return false;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'king') return Math.max(ax, ay) === 1;
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    if (capture) return ax === 1 && dy === forward;
    return dx === 0 && !at(pieces, to) && (dy === forward || dy === 2 * forward
      && (piece.owner === 'white' ? y <= 1 : y >= 6) && !at(pieces, sq(x, y + forward)));
  }
  if (!(piece.role === 'rook' && (dx === 0 || dy === 0)
    || piece.role === 'bishop' && ax === ay
    || piece.role === 'queen' && (dx === 0 || dy === 0 || ax === ay))) return false;
  for (let i = 1; i < Math.max(ax, ay); i++) if (at(pieces, sq(x + i * Math.sign(dx), y + i * Math.sign(dy)))) return false;
  return true;
}
function checked(pieces: PieceState[], color: Color): boolean {
  const king = pieces.find(p => p.owner === color && p.royal && p.zone === 'board');
  assert.ok(king?.square);
  return pieces.some(p => p.owner !== color && p.zone === 'board' && geometry(pieces, p, king.square!, true));
}
function captures(pieces: PieceState[], color: Color): string[] {
  const result: string[] = [];
  for (const p of pieces.filter(p => p.zone === 'board' && p.owner === color)) {
    for (const target of pieces.filter(p => p.zone === 'board' && p.owner !== color && !p.royal)) {
      if (!geometry(pieces, p, target.square!, true)) continue;
      const next = structuredClone(pieces);
      next.find(q => q.id === p.id)!.square = target.square;
      Object.assign(next.find(q => q.id === target.id)!, { square: null, zone: 'captured' });
      if (!checked(next, color)) result.push(`${p.square}${target.square}`);
    }
  }
  return result;
}
function boardFen(pieces: PieceState[]): string {
  const letters = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, rank) => {
    let row = '', empty = 0;
    for (let file = 0; file < 8; file++) {
      const p = at(pieces, sq(file, 7 - rank));
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += p.owner === 'white' ? letters[p.role].toUpperCase() : letters[p.role];
    }
    return row + (empty || '');
  }).join('/');
}

test('iteration 189 independently reviews every action, physical card and royal position', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/189.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860189);
  assert.equal(trace.steps.length, 117);
  assert.equal(rationales.length, trace.steps.length);
  let state = createGameState(trace.initial);
  let pieces = structuredClone(state.pieces), players = structuredClone(state.players);
  let turn = structuredClone(state.turn), ep: GameState['enPassant'] = [], effects: unknown[] = [];
  const history: GameEvent[] = [], played: NonNullable<GameState['playedCards']> = [];
  let shield: GameState['shieldMove'], half = 0, full = 1, active: Color = 'white';
  const rights = new Set(['K', 'Q', 'k', 'q']);
  let fogBefore: { pieces: PieceState[]; ep: GameState['enPassant']; half: number; full: number; active: Color } | undefined;
  let moves = 0, cards = 0, epQueries = 0;
  const expectedCards: Record<number, [Color, string, string, unknown?]> = {
    19: ['black', 'onslaught', 'black-hand-3-onslaught', [{ from: 'a7', to: 'a6' }, { from: 'c5', to: 'c4' }, { from: 'f7', to: 'f6' }, { from: 'g7', to: 'g6' }, { from: 'h7', to: 'h6' }]],
    20: ['white', 'fog-of-war', 'white-hand-2-fog-of-war'],
    27: ['white', 'tournament', 'white-hand-1-tournament', { own: 'b1', opponent: 'b8' }],
    34: ['black', 'treason', 'black-hand-0-treason', { rook: 'h1', knight: 'b8' }],
    36: ['white', 'resurrection', 'white-deck-0-resurrection', { pieceId: 'white-pawn-h2', to: 'e2' }],
    43: ['black', 'vendetta', 'black-deck-1-vendetta'],
    46: ['black', 'legacy', 'black-deck-2-legacy', 'black-hand-3-onslaught'],
    69: ['black', 'mystic-shield', 'black-deck-0-mystic-shield', 'a5'],
    71: ['white', 'madman', 'white-hand-4-madman', [{ from: 'f4', to: 'd6' }]],
    73: ['black', 'onslaught', 'black-hand-3-onslaught', [{ from: 'g5', to: 'g4' }]],
    95: ['white', 'irresistible-force', 'white-deck-1-irresistible-force', [{ from: 'a4', to: 'a5' }]],
    112: ['white', 'coup', 'white-deck-4-coup', 'g1'],
  };
  for (const [index, entry] of trace.steps.entries()) {
    const n = index + 1, action = entry.action, label = rationales[index]!;
    assert.ok(label.startsWith(`${n} `));
    const original = structuredClone(state), payload = structuredClone(action);
    const initialPieces = structuredClone(pieces);
    const moveClock = (pawn: boolean, capture = false) => {
      half = pawn || capture ? 0 : half + 1;
      if (turn.color === 'black') full++;
      active = other(turn.color); turn.phase = 'afterMove'; turn.moveMade = true; ep = [];
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.match(from, /^[a-h][1-8]$/); assert.match(to, /^[a-h][1-8]$/);
      assert.equal(turn.phase, 'beforeMove', label); assert.equal(turn.moveMade, false, label);
      const mover = at(pieces, from), victim = at(pieces, to);
      assert.ok(mover); assert.equal(mover.owner, turn.color, label);
      assert.ok(geometry(pieces, mover, to, !!victim), label);
      if (victim) { assert.notEqual(victim.owner, mover.owner); assert.equal(victim.royal, false); }
      if (effects.some(e => (e as { type: string }).type === 'vendetta')) assert.ok(victim, label);
      if (victim) Object.assign(victim, { square: null, zone: 'captured', capturedBy: mover.owner });
      const [x, y] = xy(from), [, ty] = xy(to);
      mover.square = to as SquareName;
      if (mover.royal) for (const right of mover.owner === 'white' ? ['K', 'Q'] : ['k', 'q']) rights.delete(right);
      const rookRights: Record<string, string> = { 'white-rook-h1': 'K', 'white-rook-a1': 'Q', 'black-rook-h8': 'k', 'black-rook-a8': 'q' };
      if (rookRights[mover.id]) rights.delete(rookRights[mover.id]!);
      if (victim && rookRights[victim.id]) rights.delete(rookRights[victim.id]!);
      moveClock(mover.role === 'pawn', !!victim);
      if (mover.role === 'pawn' && Math.abs(ty - y) === 2) ep = [{ target: sq(x, (y + ty) / 2), pawnId: mover.id }];
      history.push({ type: 'move', from: from as SquareName, to: to as SquareName, ...(victim ? { capturedId: victim.id } : {}) });
      shield = { player: turn.color, pieceIds: [mover.id], capturedOpponent: !!victim };
      assert.equal(checked(pieces, turn.color), false, label);
      moves++;
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true, label); assert.equal(checked(pieces, turn.color), false, label);
      turn = { color: other(turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      shield = undefined;
      if (n === 57) {
        assert.deepEqual(captures(pieces, 'white'), [], label);
        effects = []; players.black.discard.push({ id: 'black-deck-1-vendetta', cardId: 'vendetta' });
      } else if (n >= 44 && n <= 55) assert.ok(captures(pieces, turn.color).length > 0, label);
      if (n === 72) effects = [];
    } else {
      assert.equal(action.type, 'playCard', label);
      if (action.type !== 'playCard') throw new Error(label);
      const [owner, cardId, id, target] = expectedCards[n]!;
      assert.deepEqual(action, { type: 'playCard', cardId, cardInstanceId: id, ...(target === undefined ? {} : { target }) }, label);
      assert.equal(turn.cardPlays[owner], 0, label);
      const hand = players[owner].hand, card = hand.find(c => c.id === id);
      assert.deepEqual(card, { id, cardId }, label); assert.ok(card);
      hand.splice(hand.indexOf(card), 1);
      if (cardId === 'legacy') {
        assert.equal(history.at(-1)?.capturedId, 'black-knight-b8', label);
        assert.equal(pieces.find(p => p.id === 'black-knight-b8')?.zone, 'captured');
        const retrieved = players.black.discard.find(c => c.id === target); assert.ok(retrieved);
        players.black.discard.splice(players.black.discard.indexOf(retrieved), 1); hand.push(retrieved);
      }
      if (!['vendetta', 'coup'].includes(cardId)) players[owner].discard.push(card);
      const draw = players[owner].deck.shift(); assert.ok(draw); hand.push(draw);
      turn.cardPlays[owner]++; played.push({ player: owner, cardInstanceId: id }); cards++;
      const replacement = [19, 27, 36, 71, 73, 95].includes(n);
      if (replacement) { assert.equal(turn.color, owner); assert.equal(turn.moveMade, false); }
      else if (![20, 46].includes(n)) { assert.equal(turn.color, owner); assert.equal(turn.phase, 'afterMove'); }
      let movement: CardMove[] = [];
      if (n === 19 || n === 73) {
        if (n === 19) fogBefore = { pieces: structuredClone(pieces), ep: structuredClone(ep), half, full, active };
        const selected = target as CardMove[];
        for (const m of selected) { const p = at(initialPieces, m.from); assert.ok(p); assert.equal(p.role, 'pawn'); assert.equal(p.owner, owner); assert.equal(at(initialPieces, m.to), undefined); assert.equal(xy(m.to)[1] - xy(m.from)[1], -1); }
        for (const m of selected) at(pieces, m.from)!.square = m.to;
        movement = selected;
      } else if (n === 20) {
        assert.ok(fogBefore); assert.equal(history.at(-1)?.cardId, 'onslaught');
        movement = (expectedCards[19]![3] as CardMove[]).map(m => ({ from: m.to, to: m.from }));
        pieces = structuredClone(fogBefore.pieces); ep = structuredClone(fogBefore.ep);
        half = fogBefore.half; full = fogBefore.full; active = fogBefore.active;
        turn.phase = 'beforeMove'; turn.moveMade = false; shield = undefined;
      } else if (n === 27 || n === 34) {
        const a = at(pieces, n === 27 ? 'b1' : 'b8')!, b = at(pieces, n === 27 ? 'b8' : 'h1')!;
        assert.equal(a.role, 'knight'); assert.equal(b.role, n === 27 ? 'knight' : 'rook');
        assert.equal(a.owner, 'white'); assert.equal(b.owner, n === 27 ? 'black' : 'white');
        movement = [{ from: a.square!, to: b.square! }, { from: b.square!, to: a.square! }];
        [a.square, b.square] = [b.square, a.square];
      } else if (n === 36) {
        const p = pieces.find(p => p.id === 'white-pawn-h2')!;
        assert.equal(p.zone, 'captured'); assert.equal(p.role, 'pawn'); assert.equal(p.capturedBy, 'black'); assert.equal(at(pieces, 'e2'), undefined);
        p.square = 'e2'; p.zone = 'board'; delete p.capturedBy;
      } else if (n === 43) effects.push({ type: 'vendetta', owner, card });
      else if (n === 69) {
        assert.deepEqual(shield, { player: 'black', pieceIds: ['black-bishop-f8'], capturedOpponent: true });
        assert.equal(at(pieces, 'a5')?.id, 'black-bishop-f8');
        effects.push({ type: 'mystic-shield', owner, player: owner, pieceId: 'black-bishop-f8' });
      } else if (n === 71) {
        assert.equal(at(pieces, 'f4')?.id, 'white-pawn-f2'); assert.ok(at(pieces, 'e5')); assert.equal(at(pieces, 'd6'), undefined);
        at(pieces, 'f4')!.square = 'd6'; movement = [{ from: 'f4', to: 'd6' }];
      } else if (n === 95) {
        assert.equal(at(pieces, 'a4')?.id, 'white-pawn-a2'); assert.equal(at(pieces, 'a5')?.id, 'black-bishop-f8'); assert.equal(at(pieces, 'a6'), undefined);
        at(pieces, 'a5')!.square = 'a6'; at(pieces, 'a4')!.square = 'a5';
        movement = [{ from: 'a4', to: 'a5' }, { from: 'a5', to: 'a6' }];
      } else if (n === 112) {
        const prince = at(pieces, 'e1')!, king = at(pieces, 'g1')!;
        assert.equal(prince.royal, true); assert.equal(king.role, 'knight'); assert.equal(king.owner, 'white');
        prince.royal = false; king.royal = true;
        effects.push({ type: 'coup', owner, card, princeId: prince.id, kingId: king.id, princeRole: 'king' });
      }
      if (replacement) {
        moveClock(n !== 27);
        shield = { player: owner, capturedOpponent: false,
          pieceIds: [27, 36].includes(n) ? [] : initialPieces.filter(p => p.owner === owner && movement.some(m => m.from === p.square)).map(p => p.id) };
      }
      const event: GameEvent = { type: 'cardPlayed', cardId, ...(target !== undefined && ![20, 46].includes(n) ? { target: target as GameEvent['target'] } : {}), movement, preservePreviousMove: !replacement };
      if ([20, 46, 69].includes(n)) event.player = owner;
      history.push(event);
      assert.equal(checked(pieces, owner), false, label);
    }
    const result = applyAction(state, action);
    assert.deepEqual(state, original, `${label}: reducer input immutable`);
    assert.deepEqual(action, payload, `${label}: action payload immutable`);
    assert.ok(result.ok, label); state = result.state;
    assert.deepEqual(state.pieces, pieces, `${label}: all identities, captures and captors`);
    assert.deepEqual(state.players, players, `${label}: exact hand, draw order and discard`);
    assert.deepEqual(state.turn, turn, label); assert.deepEqual(state.effects, effects, label);
    assert.deepEqual(state.history, history, label); assert.deepEqual(state.playedCards ?? [], played, label);
    assert.deepEqual(state.enPassant, ep, label); assert.equal(state.orientation, 0);
    assert.equal(state.pendingRescue ?? null, null, label); assert.equal(state.pendingAbduction ?? null, null, label);
    assert.equal(state.pendingDoomsayer ?? null, null, label); assert.deepEqual(state.underElfHill ?? [], []);
    assert.equal(state.outcome, null, label);
    assert.equal(state.chaosForbidden, undefined, label); assert.equal(state.plotsExecution, undefined, label);
    assert.deepEqual(state.plotsAllowances ?? [], [], label); assert.deepEqual(state.riposteLostMoves ?? [], [], label);
    assert.equal(state.riposteSkipped, undefined); assert.equal(state.riposteCheckDeferred, undefined);
    assert.deepEqual(state.fogLocked ?? [], n === 20 || n === 21 ? ['black'] : [], label);
    assert.deepEqual(state.shieldMove, shield, `${label}: exact move trigger`);
    const snapshot = structuredClone(state);
    for (const color of colors) assert.equal(isKingInCheck(state, color), checked(pieces, color), `${label}: independent ${color} royal geometry`);
    assert.deepEqual(state, snapshot, `${label}: threat query immutable`);
    let epField = '-';
    for (const opportunity of ep) {
      const pawn = pieces.find(p => p.id === opportunity.pawnId)!;
      const prospective = other(pawn.owner);
      const query = structuredClone(state);
      query.turn = { color: prospective, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      query.fen = query.fen.split(' ').map((f, i) => i === 1 ? prospective[0]! : f).join(' ');
      const queryBefore = structuredClone(query), destinations = legalDests(query);
      for (const captor of pieces.filter(p => p.zone === 'board' && p.owner === prospective && p.role === 'pawn')) {
        if (!geometry(pieces, captor, opportunity.target, true)) continue;
        const candidate = structuredClone(pieces);
        candidate.find(p => p.id === captor.id)!.square = opportunity.target;
        Object.assign(candidate.find(p => p.id === pawn.id)!, { square: null, zone: 'captured' });
        const legal = !at(pieces, opportunity.target) && !checked(candidate, prospective);
        assert.equal(destinations.get(captor.square!)?.includes(opportunity.target) ?? false, legal, `${label}: prospective EP capture`);
        if (legal) epField = opportunity.target;
        epQueries++;
      }
      assert.deepEqual(query, queryBefore, `${label}: prospective EP query immutable`);
    }
    const rightsField = ['K', 'Q', 'k', 'q'].filter(r => rights.has(r)).map(r => r === 'K' && at(pieces, 'h1')?.role !== 'rook' ? 'H' : r).join('') || '-';
    assert.equal(state.fen, `${boardFen(pieces)} ${active[0]} ${rightsField} ${epField} ${half} ${full}`, `${label}: all six FEN fields`);
  }
  assert.equal(moves, 50); assert.equal(cards, 12); assert.equal(epQueries, 2);
  assert.equal(state.fen, '1rbk4/p2p4/b6n/Pp2p2p/1PrQPpp1/2P4N/4P3/R3K1NB b - - 1 28');
});

test('iteration 189 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/189.json', import.meta.url), 'utf8')) as RandomTrace;
  replayTrace(trace);
});
