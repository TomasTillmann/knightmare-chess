import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';

// Each row is a sequential rules review, not a label inferred from reducer acceptance.
const rationales = `
1 d2-d4: double advance through d3; no opposing pawn can capture d3.
2 End White: d4 remains; Black receives its move and the d3 opportunity.
3 b8-a6: Knight jumps; expires d3.
4 End Black: White receives move; no board changes.
5 g2-g4: double advance through g3; no Black pawn on f4/h4.
6 End White: retain g3 opportunity.
7 e7-e6: one empty forward square; g3 expires.
8 End Black: both royals safe.
9 a2-a4: double advance through a3; a3 has no Black captor.
10 End White: retain physical a3 opportunity.
11 Pacifism: Black hand1, beforeMove, own nonroyal h7; continuing immunity and capture prohibition.
12 d7-d6: forward one; Pacifism does not affect d-pawn.
13 End Black: h7 marker remains.
14 d1-d3: Queen through vacated d2 to empty d3.
15 Disintegration: White hand3 afterMove, own pawn a4 becomes dead, not captured.
16 End White: death irreversible; hand refilled once.
17 e6-e5: forward one to empty square.
18 End Black: no outstanding choice.
19 b2-b3: forward one to empty square.
20 End White: b3 remains ordinary pawn.
21 c8-e6: Bishop through vacated d7; e6 empty.
22 Chaos: White hand2 afterOpponentMove; rewind Bishop to c8, clocks/history, prohibit c8-e6 token.
23 d8-f6: Queen through vacant e7; different physical movement satisfies Chaos.
24 Anathema: Black deck0 afterMove; opposing Bishop f1 and Rook a1 swap without a move/capture.
25 End Black: swapped identities retain original roles and royal status.
26 c2-c4: double advance through c3; no Black pawn adjacent on fourth rank.
27 End White: c3 opportunity persists.
28 a6-b8: Knight jumps back; expires c3.
29 Doomsayer: Black deck1 afterMove; immediate naming option belongs to White.
30 White names bishop: owned Bishop originally f1 now a1 lost to Black effect; reset halfmove, discard resolved effect.
31 End Black: naming option resolved; White starts.
32 c1-b2: Bishop to adjacent diagonal vacated by pawn.
33 Coup: White deck0 afterMove, own b3 Pawn eligible; e1 becomes Prince and b3 the sole royal.
34 End White: Pawn keeps forward movement and King protection.
35 a7-a6: one forward empty square.
36 End Black: b3 royal remains safe.
37 f2-f4: clear f3; Black has no pawn on e4/g4 to capture en passant.
38 End White: physical f3 opportunity remains.
39 f6-h4: Queen diagonal through g5; b3 royal unaffected.
40 End Black: ordinary e1 Prince is not royal.
41 f1-f3: Rook through vacated f2; loses original a1 castling right.
42 End White: original h1 right remains only White right.
43 d6-d5: one forward step.
44 End Black: White receives its move.
45 e2-e4: clear e3; raw FEN e3 serialization has no Black pawn captor at d4/f4.
46 End White: retain raw e3 and physical victim separately from legal capture availability.
47 h4-e7: Queen diagonal through g5,f6; e3 opportunity expires.
48 End Black: no capture or card.
49 h2-h3: one forward empty step.
50 End White: no outstanding obligations.
51 e7-f6: Queen single diagonal.
52 End Black: royal b3 remains protected.
53 b2-a3: Bishop single diagonal.
54 End White: both royals safe.
55 f6-g5: Queen single diagonal.
56 Vendetta: Black hand3 afterMove; White has ordinary captures, so capture obligation starts.
57 End Black: White must capture an opposing piece.
58 f4xe5: Pawn captures Black e-pawn, satisfying Vendetta; white captor recorded.
59 End White: Black has d5xc4, so Vendetta remains.
60 d5xc4: Black d-pawn captures White c-pawn and checks royal b3; satisfies capture obligation.
61 End Black: check continues into White turn; royal b3 can capture c4 safely.
62 b3xc4: royal Pawn captures Black d-pawn; destination safe; royal movement revokes White castling.
63 End White: capture obligation remains possible.
64 c8xg4: Bishop through d7,e6,f5 captures White g-pawn.
65 End Black: h3 pawn can capture the Bishop.
66 h3xg4: Pawn captures Bishop; White owns capture.
67 End White: Black Queen can capture e5.
68 g5xe5: Queen through f5 takes White f-pawn.
69 Fortification: Black deck2 afterMove; create a6/a7 boundary wall without relocating pieces.
70 End Black: White can capture e5, so Vendetta persists.
71 d4xe5: White d-pawn captures Black Queen.
72 End White: Black Bishop can capture a3.
73 f8xa3: Bishop through e7,d6,c5,b4 takes White Bishop; wall a6/a7 unrelated.
74 End Black: White Knight can capture a3.
75 b1xa3: Knight jumps and captures remaining Black Bishop.
76 End White: Black has no ordinary capture; Vendetta ends and its card is discarded.
77 b7-b5: clear b6; pawn checks royal c4; no White pawn on a5/c5 can capture b6.
78 End Black: retain b6 opportunity; White royal c4 receives escape turn in check.
79 c4xb5: royal Pawn takes b-pawn but a6 attacks b5; held Doomsayer then Black names a6 supplies concrete cure.
80 Heresy: White hand4 afterMove, empty target because all Bishops captured; fails to cure a6 attack, spends card and rewinds provisional move to initial b5-pawn check on c4.
81 a3xb5: Knight captures restored Black b-pawn, while royal stays safe on c4.
82 End White: Heresy spent, Black receives move.
83 b8-c6: Knight jump to empty c6.
84 End Black: no ongoing capture obligation.
85 Long Jump: White deck2 replaces move; Knight b5 to empty opposite-color e3; no capture.
86 End White: replacement move completed; no additional ordinary move.
87 h7-h5: Pacifist Pawn may make noncapture double advance through h6; cannot be captured en passant.
88 End Black: physical h6 opportunity persists but has no legal captor.
89 g1-e2: Knight jumps to empty e2; expires h6.
90 Panic: White hand0 afterMove targets Black next turn, sets 15000ms obligation.
91 End White: Black begins timed turn.
92 Panic timeout: safe Black forfeits whole turn; no piece/history movement; clocks advance once.
93 d3-a3: Queen horizontal through c3,b3.
94 End White: Black receives move.
95 a8-a7: Rook forward to empty a7; does not cross wall a7/a6; revoke Black queenside right.
96 End Black: only Black kingside castling remains.
97 a3-a2: Queen one orthogonal step.
98 End White: c4 remains White royal.
99 g8-h6: Knight jumps to empty square.
100 End Black: royals safe.
101 e1-f2: Prince moves one diagonal; White royal still c4.
102 End White: Prince movement changes no royal identity.
103 e8-f8: Black King steps safely; revoke its last castling right.
104 End Black: no castling rights remain.
105 e3-c2: Knight jump to empty c2.
106 End White: board stable across handoff.
107 g7-g6: forward one; no capture.
108 End Black: royals safe.
109 e2-f4: Knight jump to empty f4.
110 Doomsayer: White deck1 afterMove; Black receives immediate naming option.
111 Black declines: no sacrifice and effect remains for next intentional naming.
112 White names pawn and loses own nonroyal e5 d-pawn to White effect; no Black captor attribution.
113 End White: resolved Doomsayer discarded; Black starts safe.
114 Lost Castle: Black deck3 replacement swap h8/h1 would expose f8 to White Rook h8 through g8; fizzle and consume replacement move.
115 End Black: board restored; clocks include consumed replacement.
116 a2-a5: Queen through empty a3,a4; stops below Black pawn a6.
117 End White: final Black turn, no unresolved choice or check.
`.trim().split('\n');

const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white';
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const square = (x: number, y: number) => `${String.fromCharCode(97 + x)}${y + 1}` as SquareName;
const clone = <T>(x: T): T => structuredClone(x);

// Physical geometry oracle: independent of legalDests and reducer threat routines.
function reaches(pieces: PieceState[], piece: PieceState, to: string, capture: boolean, wall: boolean): boolean {
  if (!piece.square || piece.square === to) return false;
  const [x, y] = xy(piece.square), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
  if (piece.role === 'knight') return Math.abs(dx * dy) === 2;
  const step = piece.owner === 'white' ? 1 : -1;
  if (piece.role === 'pawn') {
    if (capture) return Math.abs(dx) === 1 && dy === step;
    if (dx || !(dy === step || dy === 2 * step && (piece.owner === 'white' ? y <= 1 : y >= 6))) return false;
  } else if (piece.role === 'king') { if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) return false; }
  else if (!(piece.role !== 'bishop' && (dx === 0 || dy === 0) || piece.role !== 'rook' && Math.abs(dx) === Math.abs(dy))) return false;
  let prev: string = piece.square;
  for (let n = 1; n <= Math.max(Math.abs(dx), Math.abs(dy)); n++) {
    const next: string = square(x + n * Math.sign(dx), y + n * Math.sign(dy));
    if (wall && [prev, next].sort().join() === 'a6,a7') return false;
    if (next !== to && pieces.some(p => p.zone === 'board' && p.square === next)) return false;
    prev = next;
  }
  return true;
}
function checked(pieces: PieceState[], color: Color, pacifism: boolean, wall: boolean): boolean {
  const king = pieces.find(p => p.owner === color && p.royal && p.zone === 'board')!;
  return pieces.some(p => p.zone === 'board' && p.owner !== color
    && !(pacifism && p.id === 'black-pawn-h7') && reaches(pieces, p, king.square!, true, wall));
}
function boardFen(pieces: PieceState[]): string {
  const symbols = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, i) => {
    let row = '', empty = 0;
    for (let x = 0; x < 8; x++) {
      const p = pieces.find(p => p.zone === 'board' && p.square === square(x, 7 - i));
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += p.owner === 'white' ? symbols[p.role].toUpperCase() : symbols[p.role];
    }
    return row + (empty || '');
  }).join('/');
}

test('iteration 167: independently reviewed deterministic campaign', () => {
  const trace: RandomTrace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/167.json', import.meta.url), 'utf8'));
  assert.equal(trace.seed, 860167);
  assert.equal(trace.steps.length, rationales.length);
  let state = createGameState(trace.initial);
  let pieces = clone(state.pieces), players = clone(state.players), turn = clone(state.turn);
  let history: GameEvent[] = [], ep: GameState['enPassant'] = [], shield: GameState['shieldMove'];
  let rights = 'KQkq', half = 0, full = 1, active = 'w';
  let pendingDoom: GameState['pendingDoomsayer'] = null;
  let canceled: { pieces: PieceState[]; history: GameEvent[]; ep: GameState['enPassant']; rights: string; half: number; full: number; active: string } | undefined;
  let rescueBefore: GameState | undefined;
  const card = (id: string, cardId: string) => ({ id, cardId });
  const pacifism = { type: 'pacifism', owner: 'black', card: card('black-hand-1-pacifism', 'pacifism'), pieceId: 'black-pawn-h7' };
  const coup = { type: 'coup', owner: 'white', card: card('white-deck-0-coup', 'coup'), princeId: 'white-king-e1', kingId: 'white-pawn-b2', princeRole: 'king' };
  const vendetta = { type: 'vendetta', owner: 'black', card: card('black-hand-3-vendetta', 'vendetta') };
  const wall = { type: 'fortification', owner: 'black', card: card('black-deck-2-fortification', 'fortification'), from: 'a6', to: 'a7' };
  let effects: unknown[] = [];
  const cards: Record<number, { owner: Color; id: string; cardId: string; target?: unknown; phase: string }> = {
    11: { owner: 'black', id: 'black-hand-1-pacifism', cardId: 'pacifism', target: 'h7', phase: 'beforeMove' },
    15: { owner: 'white', id: 'white-hand-3-disintegration', cardId: 'disintegration', target: 'a4', phase: 'afterMove' },
    22: { owner: 'white', id: 'white-hand-2-chaos', cardId: 'chaos', phase: 'afterOpponentMove' },
    24: { owner: 'black', id: 'black-deck-0-anathema', cardId: 'anathema', target: { bishop: 'f1', rook: 'a1' }, phase: 'afterMove' },
    29: { owner: 'black', id: 'black-deck-1-doomsayer', cardId: 'doomsayer', phase: 'afterMove' },
    33: { owner: 'white', id: 'white-deck-0-coup', cardId: 'coup', target: 'b3', phase: 'afterMove' },
    56: { owner: 'black', id: 'black-hand-3-vendetta', cardId: 'vendetta', phase: 'afterMove' },
    69: { owner: 'black', id: 'black-deck-2-fortification', cardId: 'fortification', target: { from: 'a6', to: 'a7' }, phase: 'afterMove' },
    80: { owner: 'white', id: 'white-hand-4-heresy', cardId: 'heresy', target: [], phase: 'afterMove' },
    85: { owner: 'white', id: 'white-deck-2-long-jump', cardId: 'long-jump', target: [{ from: 'b5', to: 'e3' }], phase: 'beforeMove' },
    90: { owner: 'white', id: 'white-hand-0-panic', cardId: 'panic', phase: 'afterMove' },
    110: { owner: 'white', id: 'white-deck-1-doomsayer', cardId: 'doomsayer', phase: 'afterMove' },
    114: { owner: 'black', id: 'black-deck-3-lost-castle', cardId: 'lost-castle', target: { own: 'h8', opponent: 'h1' }, phase: 'beforeMove' },
  };
  function probe(input: GameState, action: GameAction) {
    const snapshot = clone(input), result = applyAction(input, action);
    assert.deepEqual(input, snapshot, 'probe input immutability includes capturedBy');
    assert.ok(result.ok, JSON.stringify(action));
    return result.state;
  }
  for (const [index, entry] of trace.steps.entries()) {
    const n = index + 1, action = entry.action, label = rationales[index]!;
    assert.ok(label.startsWith(`${n} `));
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.match(from, /^[a-h][1-8]$/); assert.match(to, /^[a-h][1-8]$/);
      assert.ok(label.startsWith(`${n} ${from}-${to}:`) || label.startsWith(`${n} ${from}x${to}:`), label);
      const mover = pieces.find(p => p.square === from && p.zone === 'board')!;
      const victim = pieces.find(p => p.square === to && p.zone === 'board');
      assert.equal(mover.owner, turn.color, label);
      assert.ok(reaches(pieces, mover, to, !!victim, n >= 69), label);
      assert.ok(!victim || victim.owner !== mover.owner && !victim.royal && victim.id !== 'black-pawn-h7', label);
      assert.ok(!victim || mover.id !== 'black-pawn-h7', label);
      if (n >= 58 && n <= 75) assert.ok(victim, 'Vendetta requires capture');
      if (n === 21 || n === 79) canceled = { pieces: clone(pieces), history: clone(history), ep: clone(ep), rights, half, full, active };
      if (n === 79) rescueBefore = clone(state);
      if (victim) { victim.zone = 'captured'; victim.square = null; victim.capturedBy = mover.owner; }
      mover.square = to as SquareName;
      ep = mover.role === 'pawn' && Math.abs(Number(to[1]) - Number(from[1])) === 2
        ? [{ target: `${from[0]}${(Number(from[1]) + Number(to[1])) / 2}` as SquareName, pawnId: mover.id }] : [];
      if (n === 41) rights = 'Kkq';
      if (n === 62) rights = 'kq';
      if (n === 95) rights = 'k';
      if (n === 103) rights = '-';
      half = victim || mover.role === 'pawn' ? 0 : half + 1;
      if (turn.color === 'black') full++;
      active = turn.color === 'white' ? 'b' : 'w';
      turn.phase = 'afterMove'; turn.moveMade = true;
      shield = { player: turn.color, pieceIds: [mover.id], capturedOpponent: !!victim };
      history.push({ type: 'move', from: from as SquareName, to: to as SquareName,
        ...(victim ? { capturedId: victim.id } : {}),
        ...(n >= 73 && mover.owner === 'black' ? { movedPieceId: mover.id, movedRoles: [mover.role] } : {}) });
    } else if (action.type === 'endTurn') {
      assert.ok(label.includes('End '));
      assert.equal(turn.moveMade, true, label);
      turn = { color: opposite(turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      shield = undefined;
      if (n === 76) {
        // Exhaustively inspect every enemy physical piece: Black has no available capture.
        const available = pieces.flatMap(p => p.zone === 'board' && p.owner === 'black' && p.id !== 'black-pawn-h7'
          ? pieces.filter(q => q.zone === 'board' && q.owner === 'white' && !q.royal && reaches(pieces, p, q.square!, true, true)) : []);
        assert.equal(available.length, 0, 'Vendetta ends at first captureless turn');
        effects = effects.filter(e => e !== vendetta); players.black.discard.push(vendetta.card);
      }
    } else if (action.type === 'playCard') {
      const expected = cards[n]!;
      assert.ok(expected, label);
      assert.deepEqual(action, { type: 'playCard', cardId: expected.cardId, cardInstanceId: expected.id,
        ...(expected.target === undefined ? {} : { target: expected.target }) }, label);
      assert.equal(turn.cardPlays[expected.owner], 0, label);
      assert.equal(expected.phase, expected.owner !== turn.color ? 'afterOpponentMove' : turn.phase, label);
      const owner = players[expected.owner], physical = card(expected.id, expected.cardId);
      assert.deepEqual(owner.hand.find(c => c.id === expected.id), physical, label);
      owner.hand = owner.hand.filter(c => c.id !== expected.id);
      owner.hand.push(owner.deck.shift()!); turn.cardPlays[expected.owner]++;
      if (![11, 29, 33, 56, 69, 110].includes(n)) owner.discard.push(physical);
      const event: GameEvent = { type: 'cardPlayed', cardId: expected.cardId,
        ...(expected.target === undefined ? {} : { target: expected.target as GameEvent['target'] }),
        movement: [], preservePreviousMove: turn.moveMade };
      if (n === 11) effects.push(pacifism);
      if (n === 15) { const p = pieces.find(p => p.id === 'white-pawn-a2')!; p.square = null; p.zone = 'dead'; delete p.capturedBy; }
      if (n === 22 || n === 80) {
        assert.ok(canceled);
        ({ pieces, history, ep, rights, half, full, active } = clone(canceled));
        turn.phase = 'beforeMove'; turn.moveMade = false;
        if (n === 22) { shield = undefined; event.player = 'white'; event.movement = [{ from: 'e6', to: 'c8' }]; }
        else { event.type = 'cardFizzled'; event.reason = 'SELF_CHECK'; event.preservePreviousMove = false; delete event.target; }
      }
      if (n === 24) {
        pieces.find(p => p.id === 'white-rook-a1')!.square = 'f1';
        pieces.find(p => p.id === 'white-bishop-f1')!.square = 'a1';
        rights = 'KAkq'; event.movement = [{ from: 'a1', to: 'f1' }, { from: 'f1', to: 'a1' }];
      }
      if (n === 29 || n === 110) {
        effects.push({ type: 'doomsayer', owner: expected.owner, card: physical });
        pendingDoom = { player: opposite(expected.owner), cardInstanceId: physical.id };
      }
      if (n === 33) { effects.push(coup); pieces.find(p => p.id === 'white-king-e1')!.royal = false; pieces.find(p => p.id === 'white-pawn-b2')!.royal = true; }
      if (n === 56) effects.push(vendetta);
      if (n === 69) { effects.push(wall); delete event.movement; delete event.preservePreviousMove; }
      if (n === 85) {
        const p = pieces.find(p => p.id === 'white-knight-b1')!;
        assert.equal(p.square, 'b5'); assert.equal(p.role, 'knight');
        assert.equal((xy('b5')[0] + xy('b5')[1] + xy('e3')[0] + xy('e3')[1]) % 2, 1);
        assert.ok(!pieces.some(p => p.square === 'e3'));
        p.square = 'e3'; half++; active = 'b'; ep = [];
        turn.phase = 'afterMove'; turn.moveMade = true;
        shield = { player: 'white', pieceIds: [p.id], capturedOpponent: false };
        event.movement = [{ from: 'b5', to: 'e3' }];
      }
      if (n === 90) effects.push({ type: 'panic', owner: 'white', player: 'black', durationMs: 15000 });
      if (n === 114) {
        const swapped = clone(pieces);
        swapped.find(p => p.id === 'white-rook-h1')!.square = 'h8';
        swapped.find(p => p.id === 'black-rook-h8')!.square = 'h1';
        assert.ok(checked(swapped, 'black', true, true), 'Lost Castle would expose Black King along h8-g8-f8');
        event.type = 'cardFizzled'; event.reason = 'SELF_CHECK'; delete event.target;
        half++; full++; active = 'w'; ep = []; turn.phase = 'afterMove'; turn.moveMade = true; shield = undefined;
      }
      history.push(event);
    } else if (action.type === 'namePiece') {
      const first = n === 30, id = first ? 'white-bishop-f1' : 'white-pawn-d2';
      const effectId = first ? 'black-deck-1-doomsayer' : 'white-deck-1-doomsayer';
      assert.ok(first || n === 112);
      assert.deepEqual(action, { type: 'namePiece', speaker: 'white', name: first ? 'bishop' : 'pawn', losses: [{ effectId, pieceId: id }] });
      const p = pieces.find(p => p.id === id)!;
      assert.equal(p.royal, false); assert.equal(p.owner, 'white');
      p.square = null; p.zone = 'captured'; p.capturedBy = first ? 'black' : 'white';
      effects = effects.filter(e => (e as { type: string }).type !== 'doomsayer');
      players[first ? 'black' : 'white'].discard.push(card(effectId, 'doomsayer'));
      half = 0; pendingDoom = null;
      history.push({ type: 'pieceNamed', speaker: 'white', name: first ? 'bishop' : 'pawn', capturedIds: [id], resolvedEffectIds: [effectId] });
    } else if (action.type === 'declineDoomsayer') {
      assert.equal(n, 111); assert.deepEqual(action, { type: 'declineDoomsayer', player: 'black' });
      pendingDoom = null; history.push({ type: 'doomsayerDeclined', player: 'black' });
    } else if (action.type === 'panicTimeout') {
      assert.equal(n, 92); assert.equal(turn.color, 'black');
      effects = effects.filter(e => (e as { type: string }).type !== 'panic');
      half++; full++; active = 'w'; ep = []; shield = undefined;
      turn = { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    } else assert.fail(`Unreviewed action ${n}`);
    state = probe(state, action);
    const expectedFen = `${boardFen(pieces)} ${active} ${rights} ${n === 45 || n === 46 ? 'e3' : '-'} ${half} ${full}`;
    assert.equal(state.fen, expectedFen, label);
    assert.deepEqual(state.pieces, pieces, label);
    assert.deepEqual(state.players, players, label);
    assert.deepEqual(state.turn, turn, label);
    assert.deepEqual(state.effects, effects, label);
    assert.deepEqual(state.history, history, label);
    assert.deepEqual(state.enPassant, ep, label);
    assert.deepEqual(state.shieldMove, shield, label);
    assert.deepEqual(state.pendingDoomsayer ?? null, pendingDoom, label);
    assert.equal(state.orientation, 0); assert.equal(state.outcome, null);
    for (const key of ['plotsExecution', 'riposteSkipped', 'riposteCheckDeferred'] as const) assert.equal(state[key], undefined, label);
    for (const key of ['plotsAllowances', 'fogLocked', 'riposteLostMoves', 'underElfHill'] as const) assert.deepEqual(state[key] ?? [], [], label);
    assert.equal(state.pendingAbduction ?? null, null);
    assert.deepEqual(state.chaosForbidden, n === 22 ? { player: 'black', movement: 'black-bishop-c8:c8:e6' } : undefined, label);
    const beforeThreatQueries = clone(state);
    for (const color of ['white', 'black'] as const) {
      const threat = checked(pieces, color, n >= 11, n >= 69);
      assert.equal(threat, [60, 61, 77, 78, 79, 80].includes(n) && color === 'white', label);
      assert.equal(isKingInCheck(state, color), threat, label);
    }
    assert.deepEqual(state, beforeThreatQueries, 'royal threat queries are immutable');
    // Evaluate EP in the prospective captor's before-move context. None of this
    // trace's opportunities has a legal captor; geometry and royal simulation
    // still run independently before consulting the public move enumeration.
    for (const chance of ep) {
      const victim = pieces.find(p => p.id === chance.pawnId)!;
      const captorColor = opposite(victim.owner);
      const context = clone(state); context.turn = { color: captorColor, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      const fields = context.fen.split(' '); fields[1] = captorColor === 'white' ? 'w' : 'b'; context.fen = fields.join(' ');
      const contextBefore = clone(context), dests = legalDests(context);
      assert.deepEqual(context, contextBefore, 'EP enumeration is immutable');
      for (const p of pieces.filter(p => p.owner === captorColor && p.role === 'pawn' && p.zone === 'board')) {
        const geometric = reaches(pieces, p, chance.target, true, n >= 69)
          && Number(p.square![1]) === Number(victim.square![1]) && !pieces.some(q => q.square === chance.target);
        const simulated = clone(pieces);
        simulated.find(q => q.id === p.id)!.square = chance.target;
        const removed = simulated.find(q => q.id === victim.id)!; removed.square = null; removed.zone = 'captured'; removed.capturedBy = captorColor;
        const legal = geometric && victim.id !== 'black-pawn-h7' && !checked(simulated, captorColor, n >= 11, n >= 69);
        assert.equal(legal, false, label);
        assert.equal(dests.get(p.square!)?.includes(chance.target) ?? false, legal, label);
      }
    }
    assert.equal(!!state.pendingRescue, n === 79, label);
    if (n === 79) {
      assert.ok(rescueBefore && state.pendingRescue);
      assert.equal(state.pendingRescue.fen, rescueBefore.fen);
      assert.deepEqual(state.pendingRescue.pieces, rescueBefore.pieces);
      assert.deepEqual(state.pendingRescue.enPassant, rescueBefore.enPassant);
      assert.equal(state.pendingRescue.historyLength, rescueBefore.history.length);
      assert.deepEqual(state.pendingRescue.history ?? state.history.slice(0, state.pendingRescue.historyLength), rescueBefore.history);
      assert.deepEqual(state.pendingRescue.movedPieceIds, ['white-pawn-b2']);
      if (state.pendingRescue.before) assert.deepEqual(state.pendingRescue.before, rescueBefore);
      const afterDoom = probe(state, { type: 'playCard', cardId: 'doomsayer', cardInstanceId: 'white-deck-1-doomsayer' });
      assert.deepEqual(afterDoom.pendingDoomsayer, { player: 'black', cardInstanceId: 'white-deck-1-doomsayer' });
      assert.ok(afterDoom.pendingRescue);
      const saved = probe(afterDoom, { type: 'namePiece', speaker: 'black', name: 'pawn', losses: [{ effectId: 'white-deck-1-doomsayer', pieceId: 'black-pawn-a7' }] });
      const savedPieces = clone(pieces), attacker = savedPieces.find(p => p.id === 'black-pawn-a7')!;
      assert.equal(attacker.square, 'a6'); attacker.square = null; attacker.zone = 'captured'; attacker.capturedBy = 'white';
      assert.deepEqual(saved.pieces, savedPieces);
      assert.equal(checked(savedPieces, 'white', true, true), false);
      assert.equal(checked(savedPieces, 'black', true, true), false);
      assert.equal(!!saved.pendingRescue, false);
      assert.equal(saved.fen, 'rn2k1nr/2p2ppp/8/1P2P3/4P1P1/N2Q1R2/8/4K1NR b kq - 0 18');
      const completed = probe(saved, { type: 'endTurn' }); assert.equal(completed.turn.color, 'black');
    }
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 13);
  assert.equal(state.fen, '5k1r/r1p2p2/p1n3pn/Q6p/2P1PNP1/5R2/2N2K2/7R b - - 2 26');
  assert.equal(replayTrace(trace).fen, state.fen);
});
