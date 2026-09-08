import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Independently reviewed in order against rules §§7–11 and the eight printed
// card descriptions. No state digests or generated deltas supply this oracle.
const review = `
1 g2g3 | White Pawn advances one into empty g3.
2 end | White completed g2g3; Black receives a fresh allowance.
3 c7c6 | Black Pawn advances one into empty c6.
4 end | Black completed c7c6; White receives the turn.
5 g3g4 | White Pawn advances one into empty g4.
6 end | White completed g3g4; Black receives the turn.
7 ghostwalk | Black h8 Rook crosses its own h7 Pawn, then empty h6,h5,h4 to empty h3.
8 end | Ghostwalk consumed Black regular move; White receives the turn.
9 a2a3 | White Pawn advances one into empty a3.
10 truce | White after-move Truce forbids captures; neither royal is raw-attacked.
11 end | White completed a2a3 and its card; reset both allowances.
12 c6c5 | Black Pawn advances one into empty c5 without capture.
13 end | Black completed c6c5; Truce persists without raw check.
14 c2c4 | White Pawn double-steps through empty c3; no Black Pawn can capture c3.
15 end | Retain c3 opportunity for Black; no legal capture under Truce.
16 b7b6 | Black Pawn advances one; the prior c3 opportunity expires.
17 end | Black completed b7b6; White receives the turn.
18 d1a4 | White Queen diagonal through empty c2,b3 to empty a4.
19 end | White completed Qa4; neither royal is raw-attacked.
20 b8a6 | Black Knight makes a 1-by-2 jump into empty a6.
21 end | Black completed Na6; White receives the turn.
22 a4c2 | White Queen diagonal through empty b3 to empty c2.
23 end | White completed Qc2; Black receives the turn.
24 d8c7 | Black Queen diagonally enters vacated c7.
25 challenge | Black after-move Challenge selects White d2 Pawn, which can legally advance to d3.
26 end | Black yields; the White d2 obligation persists.
27 d2d3 | White uses the challenged Pawn and advances into empty d3, satisfying Challenge.
28 end | White completed its required move; Black receives the turn.
29 bombard | Black h3 Rook moves vertically through empty h4,h5 to h6; jumping is optional.
30 end | Bombard consumed Black move; White receives the turn.
31 g1h3 | White Knight jumps into h3 vacated by the Rook.
32 end | White completed Nh3; Black receives the turn.
33 h6g6 | Black Rook moves one square horizontally into empty g6.
34 end | Black completed Rg6; White receives the turn.
35 d3d4 | White Pawn advances one into empty d4.
36 coup | White after-move Coup makes e1 King a capturable Prince and f1 Bishop the royal; roles and squares stay.
37 end | White completed d4 and Coup; new royal f1 is safe.
38 g6e6 | Black Rook crosses empty f6 to empty e6.
39 end | Black completed Re6; White receives the turn.
40 c2b3 | White Queen moves one diagonal into empty b3.
41 end | White completed Qb3; Black receives the turn.
42 c7g3 | Black Queen follows empty d6,e5,f4 diagonal to empty g3.
43 end | Black completed Qg3; the g3 Queen and f1 royal are not aligned on a rank, file, or diagonal.
44 c1d2 | White Bishop moves diagonally into empty d2.
45 end | White completed Bd2; Black receives the turn.
46 b6b5 | Black Pawn advances one into empty b5.
47 end | Black completed b5; White receives the turn.
48 d2c3 | White Bishop moves diagonally into empty c3.
49 end | White completed Bc3; Black receives the turn.
50 g3c7 | Black Queen follows empty f4,e5,d6 diagonal back to c7.
51 end | Black completed Qc7; White receives the turn.
52 b1d2 | White Knight jumps into empty d2.
53 end | White completed Nd2; Black receives the turn.
54 c7f4 | Black Queen follows empty d6,e5 diagonal to empty f4.
55 end | Black completed Qf4; White receives the turn.
56 a1c1 | White Rook crosses empty b1 to empty c1, permanently losing queenside castling rights.
57 end | White completed Rc1; Black receives the turn.
58 f4f5 | Black Queen moves vertically one to empty f5.
59 end | Black completed Qf5; White receives the turn.
60 c1a1 | White Rook crosses empty b1 to a1; castling rights do not return.
61 end | White completed Ra1; Black receives the turn.
62 d7d6 | Black Pawn advances one into empty d6.
63 end | Black completed d6; White receives the turn.
64 a1c1 | White Rook crosses empty b1 into empty c1.
65 end | White completed Rc1; Black receives the turn.
66 g8f6 | Black Knight jumps into empty f6.
67 end | Black completed Nf6; White receives the turn.
68 c1b1 | White Rook slides one left into empty b1.
69 end | White completed Rb1; Black receives the turn.
70 g7g5 | Black Pawn double-steps through empty g6; no White Pawn occupies f5 or h5.
71 end | Retain g6 opportunity; neither geometry nor Truce permits an EP capture.
72 onslaught | White d4 and e2 Pawns each advance one into empty d5,e3; this replaces the move and clears g6 EP.
73 end | Onslaught completed White move; Black receives the turn.
74 f6d7 | Black Knight jumps into d7 vacated by its Pawn.
75 end | Black completed Nd7; White receives the turn.
76 c3f6 | White Bishop crosses empty d4,e5 to empty f6.
77 end | White completed Bf6; Black royal e8 is not on that Bishop ray.
78 f5e4 | Black Queen moves diagonally one to empty e4.
79 end | Black completed Qe4; White receives the turn.
80 h3f4 | White Knight jumps to empty f4.
81 cowardice | White after-move card moves opposing g5 Pawn backward through empty g6 to g7; preserves move clocks.
82 end | White completed Nf4 and Cowardice; Black receives the turn.
83 annexation | Black h7 Pawn advances two through empty h6 to h5; raw FEN h6 records the card opportunity.
84 end | Preserve raw h6 EP; White g4 Pawn is one rank short of capturing it, and Truce forbids capture.
85 f4g2 | White Knight jumps into empty g2 and clears h6 EP.
86 end | White completed Ng2; Black receives the turn.
87 h5h4 | Black Pawn advances one into empty h4.
88 end | Black completed h4; White receives the turn.
89 a3a4 | White Pawn advances one into empty a4.
90 end | White completed a4; Black receives the turn.
91 c8b7 | Black Bishop moves one diagonal to vacated b7.
92 end | Black completed Bb7; White receives the turn.
93 f6d4 | White Bishop crosses empty e5 to empty d4.
94 end | White completed Bd4; Black receives the turn.
95 h4h3 | Black Pawn advances one into h3 vacated by White Knight.
96 end | Black completed h3; White receives the turn.
97 b3d3 | White Queen crosses empty c3 to empty d3.
98 end | White completed Qd3; Black receives the turn.
99 e6f6 | Black Rook moves one horizontally into empty f6.
100 end | Black completed Rf6; White receives the turn.
101 d3e2 | White Queen moves diagonally to e2 vacated by Onslaught.
102 end | White completed Qe2; Black receives the turn.
103 e4f5 | Black Queen moves diagonally into empty f5.
104 end | Black completed Qf5; White receives the turn.
105 b1a1 | White Rook moves one left to empty a1.
106 end | White completed Ra1; Black receives the turn.
107 a8b8 | Black Rook moves one right into empty b8, permanently losing queenside castling rights.
108 end | Black completed Rb8; White receives the turn.
109 g4g5 | White Pawn advances one into g5 vacated by Cowardice.
110 end | White completed g5; Black receives the turn.
111 f5e5 | Black Queen moves one left into empty e5.
112 end | Black completed the fiftieth regular move; White receives a safe turn.
`.trim().split('\n');

const cards: Record<number, { owner: Color; phase: 'beforeMove' | 'afterMove'; id: string; target?: unknown }> = {
  7: { owner: 'black', phase: 'beforeMove', id: 'black-hand-3-ghostwalk', target: [{ from: 'h8', to: 'h3' }] },
  10: { owner: 'white', phase: 'afterMove', id: 'white-hand-4-truce' },
  25: { owner: 'black', phase: 'afterMove', id: 'black-hand-2-challenge', target: 'd2' },
  29: { owner: 'black', phase: 'beforeMove', id: 'black-hand-0-bombard', target: [{ from: 'h3', to: 'h6' }] },
  36: { owner: 'white', phase: 'afterMove', id: 'white-hand-3-coup', target: 'f1' },
  72: { owner: 'white', phase: 'beforeMove', id: 'white-deck-0-onslaught', target: [{ from: 'd4', to: 'd5' }, { from: 'e2', to: 'e3' }] },
  81: { owner: 'white', phase: 'afterMove', id: 'white-hand-1-cowardice', target: [{ from: 'g5', to: 'g7' }] },
  83: { owner: 'black', phase: 'beforeMove', id: 'black-deck-1-annexation', target: [{ from: 'h7', to: 'h5' }] },
};
const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const square = (x: number, y: number) => `${String.fromCharCode(97 + x)}${y + 1}` as SquareName;
function attacks(pieces: PieceState[], piece: PieceState, target: string): boolean {
  assert.ok(piece.square);
  const [x, y] = xy(piece.square), [tx, ty] = xy(target), dx = tx - x, dy = ty - y;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (!ax && !ay) return false;
  if (piece.role === 'pawn') return ax === 1 && dy === (piece.owner === 'white' ? 1 : -1);
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'king') return Math.max(ax, ay) === 1;
  if (!(piece.role === 'bishop' ? ax === ay : piece.role === 'rook' ? !dx || !dy : ax === ay || !dx || !dy)) return false;
  for (let n = 1; n < Math.max(ax, ay); n++) {
    if (pieces.some(p => p.square === square(x + n * Math.sign(dx), y + n * Math.sign(dy)))) return false;
  }
  return true;
}
function rawCheck(pieces: PieceState[], color: Color): boolean {
  const royal = pieces.find(p => p.owner === color && p.royal)!;
  assert.ok(royal.square);
  return pieces.some(p => p.owner !== color && p.zone === 'board' && attacks(pieces, p, royal.square!));
}
function boardFen(pieces: PieceState[]): string {
  const letter = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, row) => {
    let result = '', empty = 0;
    for (let x = 0; x < 8; x++) {
      const p = pieces.find(p => p.square === square(x, 7 - row));
      if (!p) { empty++; continue; }
      if (empty) { result += empty; empty = 0; }
      result += p.owner === 'white' ? letter[p.role].toUpperCase() : letter[p.role];
    }
    return result + (empty || '');
  }).join('/');
}

test('iteration 166 independent sequential semantics', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/166.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860166);
  assert.equal(review.length, trace.steps.length);
  let state = createGameState(trace.initial);
  const expected = structuredClone(state);
  let rights = 'KQkq', half = 0, full = 1, fenActor = 'w', rawEp = '-';
  let moves = 0, played = 0;
  const applyImmutable = (input: GameState, action: GameAction) => {
    const original = structuredClone(input);
    const result = applyAction(input, action);
    assert.deepEqual(input, original, 'action/probe must not mutate its input');
    return result;
  };
  assert.equal(boardFen(expected.pieces), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
  for (let i = 0; i < trace.steps.length; i++) {
    const action = trace.steps[i]!.action, row = i + 1;
    const [label] = review[i]!.split(' | '), [number, token] = label!.split(' ');
    assert.equal(Number(number), row);
    const actor = expected.turn.color;
    const at = (s: string) => expected.pieces.find(p => p.square === s)!;
    let movement: Array<{ from: SquareName; to: SquareName }> = [];
    const replacement = action.type === 'playCard' && cards[row]!.phase === 'beforeMove';
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.equal(token, from + to);
      assert.match(from, /^[a-h][1-8]$/); assert.match(to, /^[a-h][1-8]$/);
      assert.equal(expected.turn.moveMade, false);
      const p = at(from); assert.ok(p); assert.equal(p.owner, actor); assert.equal(at(to), undefined);
      if (p.role === 'pawn') {
        const [x, y] = xy(from), [tx, ty] = xy(to), direction = actor === 'white' ? 1 : -1;
        assert.equal(x, tx);
        assert.ok(ty - y === direction || y === (actor === 'white' ? 1 : 6) && ty - y === direction * 2);
        assert.equal(at(square(x, y + direction)), undefined);
      } else assert.ok(attacks(expected.pieces, p, to), `row ${row}: geometry and intervening squares`);
      movement = [{ from: from as SquareName, to: to as SquareName }];
      expected.history.push({ type: 'move', from: from as SquareName, to: to as SquareName });
      if (row === 27) expected.effects = expected.effects.filter(e => (e as { type: string }).type !== 'challenge');
      moves++;
    } else if (action.type === 'playCard') {
      assert.equal(token, action.cardId);
      const spec = cards[row]!; assert.ok(spec);
      assert.equal(actor, spec.owner); assert.equal(expected.turn.phase, spec.phase);
      assert.equal(expected.turn.cardPlays[actor], 0);
      assert.deepEqual(action, { type: 'playCard', cardId: token, cardInstanceId: spec.id, ...(spec.target === undefined ? {} : { target: spec.target }) });
      assert.ok(CARD_CATALOG[action.cardId]!.timing.includes(spec.phase));
      const player = expected.players[actor], card = player.hand.find(c => c.id === spec.id)!;
      assert.ok(card); assert.equal(card.cardId, token);
      player.hand = player.hand.filter(c => c.id !== spec.id);
      player.hand.push(player.deck.shift()!);
      if (row === 10) expected.effects.push({ type: 'truce', owner: actor, card });
      else if (row === 36) {
        at('e1').royal = false; at('f1').royal = true;
        expected.effects.push({ type: 'coup', owner: actor, card, princeId: 'white-king-e1', kingId: 'white-bishop-f1', princeRole: 'king' });
      } else {
        player.discard.push(card);
        if (row === 25) {
          assert.equal(at('d2').role, 'pawn'); assert.equal(at('d3'), undefined);
          expected.effects.push({ type: 'challenge', owner: actor, player: 'white', pieceId: 'white-pawn-d2' });
        }
      }
      expected.turn.cardPlays[actor]++;
      expected.playedCards ??= []; expected.playedCards.push({ player: actor, cardInstanceId: spec.id });
      movement = Array.isArray(spec.target) ? spec.target as typeof movement : [];
      expected.history.push({ type: 'cardPlayed', cardId: token, ...(spec.target === undefined ? {} : { target: spec.target as GameEvent['target'] }), movement, preservePreviousMove: !replacement });
      played++;
    } else {
      assert.equal(action.type, 'endTurn'); assert.equal(token, 'end'); assert.equal(expected.turn.moveMade, true);
      expected.turn = { color: opposite(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      delete expected.shieldMove;
    }
    const moving = movement.map(m => at(m.from));
    for (const [j, m] of movement.entries()) {
      const p = moving[j]!; assert.ok(p); assert.equal(at(m.to), undefined);
      if (action.type === 'playCard') {
        const [x, y] = xy(m.from), [tx, ty] = xy(m.to);
        assert.equal(p.owner, row === 81 ? 'black' : actor);
        if ([72, 81, 83].includes(row)) {
          assert.equal(p.role, 'pawn'); assert.equal(x, tx);
          assert.equal(ty - y, row === 72 ? 1 : row === 81 ? 2 : -2);
          for (let n = 1; n < Math.abs(ty - y); n++) assert.equal(at(square(x, y + n * Math.sign(ty - y))), undefined);
        } else {
          assert.equal(p.role, 'rook'); assert.equal(x, tx);
          const blockers: PieceState[] = [];
          for (let n = 1; n < Math.abs(ty - y); n++) { const b = at(square(x, y + n * Math.sign(ty - y))); if (b) blockers.push(b); }
          if (row === 7) assert.deepEqual(blockers.map(b => b.id), ['black-pawn-h7']);
          else assert.equal(blockers.length, 0);
        }
      }
      p.square = m.to;
      if (p.id === 'black-rook-h8') rights = rights.replace('k', '');
      if (p.id === 'white-rook-a1') rights = rights.replace('Q', '');
      if (p.id === 'black-rook-a8') rights = rights.replace('q', '');
    }
    if (action.type === 'move' || replacement) {
      expected.turn.phase = 'afterMove'; expected.turn.moveMade = true;
      half = moving.some(p => p.role === 'pawn') ? 0 : half + 1;
      if (actor === 'black') full++;
      fenActor = actor === 'white' ? 'b' : 'w'; rawEp = '-'; expected.enPassant = [];
      for (const [j, m] of movement.entries()) {
        const p = moving[j]!;
        if (p.role === 'pawn' && Math.abs(Number(m.to[1]) - Number(m.from[1])) === 2) {
          const target = `${m.from[0]}${(Number(m.from[1]) + Number(m.to[1])) / 2}` as SquareName;
          expected.enPassant.push({ target, pawnId: p.id });
          if (replacement) rawEp = target;
        }
      }
      expected.shieldMove = { player: actor, pieceIds: moving.map(p => p.id), capturedOpponent: false };
    }
    expected.fen = `${boardFen(expected.pieces)} ${fenActor} ${rights || '-'} ${rawEp} ${half} ${full}`;
    const result = applyImmutable(state, action);
    assert.ok(result.ok, `row ${row}: ${review[i]}`);
    state = result.state;
    for (const key of ['pieces', 'players', 'turn', 'effects', 'history', 'enPassant', 'fen', 'shieldMove'] as const) {
      assert.deepEqual(state[key], expected[key], `row ${row}: ${key}`);
    }
    assert.deepEqual(state.playedCards ?? [], expected.playedCards ?? []);
    assert.equal(state.orientation, 0); assert.equal(state.outcome, null);
    for (const key of ['pendingRescue', 'pendingDoomsayer', 'pendingAbduction', 'chaosForbidden', 'plotsExecution', 'riposteSkipped', 'riposteCheckDeferred'] as const) assert.equal(state[key] ?? null, null, `row ${row}: ${key}`);
    for (const key of ['plotsAllowances', 'fogLocked', 'riposteLostMoves', 'underElfHill'] as const) assert.deepEqual(state[key] ?? [], [], `row ${row}: ${key}`);
    for (const color of ['white', 'black'] as const) {
      assert.equal(rawCheck(expected.pieces, color), false, `row ${row}: raw ${color} royal attacks must not end Truce`);
      const original = structuredClone(state);
      assert.equal(isKingInCheck(state, color), false);
      assert.deepEqual(state, original);
      assert.equal(state.pieces.filter(p => p.owner === color && p.royal).length, 1);
    }
    // All physical pieces remain aboard: this also checks absence of capturedBy,
    // promotions, allegiance changes, and accidental captures under Truce.
    assert.equal(state.pieces.filter(p => p.zone === 'board').length, 32);
    if (expected.enPassant.length) {
      const captorColor: Color = fenActor === 'w' ? 'white' : 'black';
      const context = structuredClone(state);
      context.turn = { color: captorColor, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      const original = structuredClone(context), destinations = legalDests(context);
      assert.deepEqual(context, original);
      for (const ep of expected.enPassant) {
        for (const p of expected.pieces.filter(p => p.owner === captorColor && p.role === 'pawn')) {
          assert.ok(p.square);
          const geometric = attacks(expected.pieces, p, ep.target);
          let safe = false;
          if (geometric) {
            const hypothetical = structuredClone(expected.pieces).filter(p => p.id !== ep.pawnId);
            hypothetical.find(q => q.id === p.id)!.square = ep.target;
            safe = !rawCheck(hypothetical, captorColor);
          }
          const truce = expected.effects.some(e => (e as { type: string }).type === 'truce');
          assert.equal(destinations.get(p.square)?.includes(ep.target) ?? false, geometric && safe && !truce);
        }
      }
    }
  }
  assert.equal(moves, 50); assert.equal(played, 8);
  assert.equal(state.fen, '1r2kb2/pb1nppp1/n2p1r2/1ppPq1P1/P1PB4/4P2p/1P1NQPNP/R3KB1R w K - 1 28');
});

test('iteration 166 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/166.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(replayTrace(trace));
});
