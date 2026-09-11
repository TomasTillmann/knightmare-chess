import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, PieceState, SquareName } from '../types.js';

// Independently reviewed in order against rules §§8–11, 13.6, 13.11,
// 14.1, 15.1, 16.2, 18.1, 18.6, 20, 22.5 and printed card metadata.
const rationales = `
1 Knight b1-a3 jumps to an empty square.
2 White ends its completed move; Black receives fresh allowances.
3 Black e7-e6 advances one into an empty square.
4 Holy War exchanges Black g8 Knight and c8 Bishop after the move; identities travel.
5 Black ends after Holy War; its spent card remains discarded.
6 White a1-b1 Rook moves horizontally; queenside castling ends.
7 White ends with no card draw.
8 Black King e8-e7 steps into the vacated pawn square; both Black castling rights end.
9 Black ends with King on e7.
10 White c2-c4 crosses empty c3; physical c-pawn gets c3 en-passant opportunity.
11 White ends retaining that opportunity for Black.
12 Black b8-c6 Knight jumps quietly; c-pawn opportunity expires.
13 Black ends without changing any piece.
14 White a3-b5 Knight makes a quiet L jump.
15 White ends with Knight on b5.
16 Black a7-a6 advances one; pawn move resets clock.
17 Cowardice moves opposing unpromoted c4 Pawn backward to empty c3 after Black move.
18 Black ends; Cowardice has not advanced clocks or used White move.
19 White b5-a3 Knight returns by an L jump.
20 White ends; no automatic optional discard.
21 Black g7-g5 crosses empty g6 and grants g6 en passant.
22 Black ends retaining the g6 opportunity.
23 White a3-c2 Knight jumps into its pawn-vacated square; g6 expires.
24 White ends with c2 occupied by its Knight.
25 Black h7-h6 pawn advances quietly.
26 Black ends; physical pawn remains on h6.
27 White e2-e4 crosses empty e3 and grants e3 en passant.
28 Fatal Attraction attaches to controlled b1 Rook; adjacent a2,b2,c1,c2 become frozen.
29 White ends retaining the magnet and e3 opportunity.
30 Black f7-f6 pawn advances outside magnet range; e3 expires.
31 Black ends with the magnet unchanged.
32 White c3-c4 Pawn advances; c3 is two ranks from b1 and not frozen.
33 White ends with the c-pawn on c4.
34 Black h6-h5 pawn advances quietly.
35 Black ends; no effect expires.
36 White d2-d4 crosses empty d3; neither square is a frozen origin.
37 White ends retaining the d3 en-passant opportunity.
38 Black original g8 Knight jumps c8-d6; d3 opportunity expires.
39 Truce follows Black move and forbids captures; retained card replaces once.
40 Black ends under Truce; both Kings remain safe.
41 Forced March simultaneously shifts c4-b4 and e4-f4 into distinct empty squares, replacing White move.
42 White ends its replacement move; Black now acts.
43 Black h8-h7 Rook moves one into its pawn-vacated square.
44 Black ends; Truce and magnet remain.
45 White f1-d3 Bishop passes empty e2; no capture under Truce.
46 Vendetta is retained after White move without changing the board.
47 Black turn starts with no permitted capture under Truce, ending and discarding Vendetta.
48 Black d8-b8 Queen crosses empty c8.
49 Black ends with Queen on b8.
50 White King e1-e2 moves quietly and loses its remaining castling right.
51 White ends with both sides now lacking castling rights.
52 Black b8-d8 Queen crosses empty c8.
53 Black ends without card accounting changes.
54 White original e-pawn f4-f5 advances quietly.
55 White ends; pawn clock remains zero.
56 Black d8-e8 Queen moves one horizontally.
57 Black ends with Queen on e8.
58 White d4-d5 Pawn advances quietly.
59 White ends with d6 still occupied by Black Knight.
60 Black e6-e5 Pawn advances quietly.
61 Neutrality marks opposing f5 Pawn after Black move; original White ownership is retained.
62 Black ends; neutral pawn stays f5 and faces White forward direction.
63 White d3-e4 Bishop moves diagonally into an empty square.
64 White ends with King still on e2.
65 Hidden Passage relocates Black royal e7-f7 to an empty square, replacing Black move and advancing fullmove.
66 Black ends the replacement move under Truce.
67 White King e2-d3 steps diagonally into the Bishop-vacated square.
68 White ends safely with King on d3.
69 Black King f7-g7 steps horizontally into an empty square.
70 Black ends with King on g7.
71 White d1-d2 Queen moves vertically outside b1 magnet adjacency.
72 Crab marks owned original b2 Pawn without moving it; Fatal Attraction still freezes it.
73 White ends; Crab and magnet coexist on separate physical identities.
74 Black d6-f7 Knight jumps into its King's former square.
75 Black ends retaining all four effects.
76 White d2-d1 Queen returns quietly; neither origin is frozen.
77 White ends with Queen d1.
78 Black h5-h4 Pawn advances one square.
79 Black ends with h4 Pawn; Truce prevents captures.
80 White g1-e2 Knight makes an L jump into an empty square.
81 White ends retaining the frozen c2 Knight.
82 Black e8-e7 Queen steps vertically into an empty square.
83 Black ends; no board or clock change at endTurn.
84 White h1-e1 Rook crosses empty g1 and f1.
85 White ends with original h1 Rook on e1, b1 magnet unmoved.
86 Black c6-d8 Knight jumps to the Queen-vacated square.
87 Black ends; both physical Knights retain original identities.
88 White d5-d6 Pawn advances into the original g8 Knight-vacated square.
89 White ends; no en-passant opportunity for a one-step pawn.
90 Black a8-a7 Rook moves one into its pawn-vacated square.
91 Black ends with Rook a7 and pawn a6.
92 White h2-h3 Pawn advances into an empty square.
93 White ends; h3 is occupied so Black h4 Pawn cannot advance there.
94 Black King g7-h6 steps diagonally into an empty square.
95 Black ends with King h6 and no effect expiration.
96 White e2-c3 Knight jumps; destination c3 lies outside b1 magnet range.
97 White ends with Knight c3.
98 Black d8-c6 Knight returns by a quiet L jump.
99 Black ends; d8 becomes vacant.
100 White c3-d5 Knight jumps to its pawn-vacated square.
101 White ends with Knight d5 and Pawn d6.
102 Black f7-d8 Knight jumps into its other Knight-vacated square.
103 Black ends; no captures occurred.
104 White g2-g3 Pawn advances quietly.
105 White ends with g2 vacant.
106 Black f8-g7 Bishop moves diagonally to an empty square.
107 Earthquake rotates clockwise: White a-file and Black h-file pawns promote, White a2 to Rook first then Black h4 to Knight; all coordinates stay fixed.
108 Black ends; orientation remains 270 and both promotion identities remain Pawns originally.
109 White e4-g2 Bishop crosses empty f3, moving geometrically independently of orientation.
110 White ends with g2 Bishop; a2 promoted Rook remains frozen beside b1 magnet.
111 Black h7-h8 Rook moves quietly to an empty square.
112 Black ends the fiftieth regular move; White begins with all retained effects intact.
`.trim().split('\n');

const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
const boardFen = (pieces: PieceState[]) => Array.from({ length: 8 }, (_, row) => {
  let line = '', empty = 0;
  for (let file = 0; file < 8; file++) {
    const p = pieces.find(p => p.square === `${String.fromCharCode(97 + file)}${8 - row}`);
    if (!p) { empty++; continue; }
    if (empty) { line += empty; empty = 0; }
    const letter = ({ king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p' })[p.role];
    line += p.owner === 'white' ? letter.toUpperCase() : letter;
  }
  return line + (empty || '');
}).join('/');

function frozen(p: PieceState, magnet: boolean): boolean {
  if (!magnet || p.royal || p.id === 'white-rook-a1') return false;
  const [x, y] = xy(p.square!);
  return Math.max(Math.abs(x - 1), Math.abs(y)) <= 1;
}

function reaches(p: PieceState, to: string, pieces: PieceState[], capture: boolean, orientation: number, crab: boolean): boolean {
  const [x, y] = xy(p.square!), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
  if (!dx && !dy) return false;
  if (p.role === 'knight') return Math.abs(dx * dy) === 2;
  if (p.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  if (p.role === 'pawn') {
    const sign = p.owner === 'white' ? 1 : -1;
    const forward = orientation === 270 ? -dx * sign : dy * sign;
    const sideways = orientation === 270 ? dy : dx;
    if (capture || crab) return forward === 1 && Math.abs(sideways) === 1;
    return sideways === 0 && (forward === 1 || forward === 2 && y === (p.owner === 'white' ? 1 : 6)
      && !pieces.some(q => q.square === `${p.square![0]}${y + 1 + sign}`));
  }
  if (!(p.role === 'bishop' && Math.abs(dx) === Math.abs(dy)
    || p.role === 'rook' && (!dx || !dy)
    || p.role === 'queen' && (!dx || !dy || Math.abs(dx) === Math.abs(dy)))) return false;
  for (let n = 1; n < Math.max(Math.abs(dx), Math.abs(dy)); n++) {
    const square = `${String.fromCharCode(97 + x + n * Math.sign(dx))}${y + 1 + n * Math.sign(dy)}`;
    if (pieces.some(q => q.square === square)) return false;
  }
  return true;
}

test('iteration 106 independently verifies every identity, rule transition, and physical card', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/106.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 10);
  let state = createGameState(trace.initial);
  for (const [i, { action }] of trace.steps.entries()) {
    const label = rationales[i]!;
    assert.ok(label.startsWith(`${i + 1} `));
    const before = structuredClone(state), expected = structuredClone(state);
    const actor = before.turn.color;
    const fields = before.fen.split(' ');
    let side = fields[1]!, rights = fields[2]!, half = Number(fields[4]), full = Number(fields[5]);
    const has = (type: string) => before.effects.some(e => (e as { type?: string }).type === type);
    const relocate = (from: SquareName, to: SquareName) => {
      assert.ok(!before.pieces.some(p => p.square === to), `${label}: empty destination`);
      const p = expected.pieces.find(p => p.square === from)!;
      assert.ok(p, label);
      assert.equal(frozen(p, has('fatal-attraction')), false, `${label}: movable origin`);
      p.square = to;
      return p;
    };
    const consumeMove = (pawn: boolean) => {
      expected.turn.phase = 'afterMove'; expected.turn.moveMade = true;
      side = actor === 'white' ? 'b' : 'w';
      half = pawn ? 0 : half + 1; full += actor === 'black' ? 1 : 0;
      expected.enPassant = [];
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.match(action.from, /^[a-h][1-8]$/); assert.match(action.to, /^[a-h][1-8]$/);
      assert.equal(before.turn.phase, 'beforeMove'); assert.equal(before.turn.moveMade, false);
      const p = before.pieces.find(p => p.square === action.from)!;
      assert.ok(p.owner === actor || p.neutral, label);
      assert.ok(reaches(p, action.to, before.pieces, false, before.orientation, p.id === 'white-pawn-b2' && has('crab')), `${label}: geometry and path`);
      relocate(action.from as SquareName, action.to as SquareName);
      consumeMove(p.role === 'pawn');
      if (p.royal) rights = rights.replace(actor === 'white' ? /[KQ]/g : /[kq]/g, '');
      if (p.id === 'white-rook-a1') rights = rights.replace('Q', '');
      if (p.id === 'white-rook-h1') rights = rights.replace('K', '');
      if (p.id === 'black-rook-a8') rights = rights.replace('q', '');
      if (p.id === 'black-rook-h8') rights = rights.replace('k', '');
      if (p.role === 'pawn' && Math.abs(Number(action.from[1]) - Number(action.to[1])) === 2) {
        expected.enPassant = [{ pawnId: p.id, target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}` as SquareName }];
      }
    } else if (action.type === 'endTurn') {
      assert.equal(before.turn.moveMade, true, label);
      expected.turn = { color: opposite(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      if (i + 1 === 47) {
        assert.ok(has('truce'), 'Truce rules out every capture, ending Vendetta');
        expected.effects = expected.effects.filter(e => (e as { type?: string }).type !== 'vendetta');
        expected.players.white.discard.push({ id: 'white-hand-1-vendetta', cardId: 'vendetta' });
      }
    } else if (action.type === 'playCard') {
      const replacement = ['forced-march', 'hidden-passage'].includes(action.cardId);
      assert.equal(before.turn.phase, replacement ? 'beforeMove' : 'afterMove', label);
      assert.equal(before.turn.cardPlays[actor], 0, label);
      const player = expected.players[actor];
      const card = player.hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(card, label); assert.equal(card.cardId, action.cardId);
      player.hand = player.hand.filter(c => c.id !== card.id); player.hand.push(player.deck.shift()!);
      expected.turn.cardPlays[actor]++;
      const regular = ['holy-war', 'cowardice', 'forced-march', 'hidden-passage'].includes(card.cardId);
      if (regular) player.discard.push(card);
      if (card.cardId === 'holy-war') {
        assert.deepEqual(action.target, { knight: 'g8', bishop: 'c8' });
        expected.pieces.find(p => p.id === 'black-knight-g8')!.square = 'c8';
        expected.pieces.find(p => p.id === 'black-bishop-c8')!.square = 'g8';
      } else if (card.cardId === 'cowardice') {
        assert.deepEqual(action.target, [{ from: 'c4', to: 'c3' }]); relocate('c4', 'c3');
      } else if (card.cardId === 'forced-march') {
        assert.deepEqual(action.target, [{ from: 'c4', to: 'b4' }, { from: 'e4', to: 'f4' }]);
        relocate('c4', 'b4'); relocate('e4', 'f4'); consumeMove(true);
      } else if (card.cardId === 'hidden-passage') {
        assert.deepEqual(action.target, [{ from: 'e7', to: 'f7' }]);
        assert.equal(relocate('e7', 'f7').royal, true); consumeMove(false);
      } else {
        const effect: Record<string, unknown> = { type: card.cardId, owner: actor, card };
        if (card.cardId === 'fatal-attraction') { assert.equal(action.target, 'b1'); effect.pieceId = 'white-rook-a1'; }
        else if (card.cardId === 'neutrality') {
          assert.equal(action.target, 'f5'); effect.pieceId = 'white-pawn-e2';
          Object.assign(expected.pieces.find(p => p.id === effect.pieceId)!, { neutral: true, neutralBeforeEffects: false });
        } else if (card.cardId === 'crab') { assert.equal(action.target, 'b2'); effect.pieceId = 'white-pawn-b2'; }
        else if (card.cardId === 'earthquake') {
          const target = { direction: 'clockwise', promotions: [{ square: 'a2', role: 'rook' }, { square: 'h4', role: 'knight' }] };
          assert.deepEqual(action.target, target); Object.assign(effect, { direction: target.direction, target });
          expected.orientation = 270;
          Object.assign(expected.pieces.find(p => p.id === 'white-pawn-a2')!, { role: 'rook', promoted: true });
          Object.assign(expected.pieces.find(p => p.id === 'black-pawn-h7')!, { role: 'knight', promoted: true });
        } else assert.ok(card.cardId === 'truce' || card.cardId === 'vendetta', label);
        expected.effects.push(effect);
      }
    } else assert.fail(`unreviewed action ${action.type}`);
    // This trace has no captures, deaths, absence, replacement identities, or promotions other than Earthquake.
    // Compare complete physical objects so capturedBy, all untouched fields, and every unaffected identity are checked.
    const result = applyAction(state, action);
    assert.deepEqual(state, before, `${label}: full structured input immutability`);
    assert.ok(result.ok, label);
    const after = result.state;
    assert.deepEqual(after.pieces, expected.pieces, `${label}: all physical identities and lifecycles`);
    assert.deepEqual(after.players, expected.players, `${label}: exact hand/deck/discard order and card identity`);
    assert.deepEqual(after.effects, expected.effects, `${label}: exact retained effect records`);
    assert.deepEqual(after.turn, expected.turn, `${label}: turn and allowances`);
    assert.deepEqual(after.enPassant, expected.enPassant, `${label}: en passant`);
    assert.equal(after.orientation, expected.orientation, label);
    // None of these double steps has a legal adjacent en-passant captor, so FEN carries '-'.
    assert.equal(after.fen, `${boardFen(expected.pieces)} ${side} ${rights || '-'} - ${half} ${full}`, `${label}: board, castling and clocks`);
    assert.equal(after.outcome, null, label);
    assert.ok(!after.pendingRescue && !after.pendingAbduction && !after.pendingDoomsayer && !after.underElfHill?.length, label);
    // Check the stronger condition even during Truce: neither King has a geometric
    // threat from a movable piece. Thus no latent check can expire Truce here.
    const magnet = expected.effects.some(e => (e as { type?: string }).type === 'fatal-attraction');
    for (const king of expected.pieces.filter(p => p.royal)) {
      assert.equal(expected.pieces.some(p => (p.owner !== king.owner || p.neutral) && !frozen(p, magnet)
        && reaches(p, king.square!, expected.pieces, true, expected.orientation, p.id === 'white-pawn-b2' && has('crab'))),
      false, `${label}: independent royal safety and Truce retention`);
    }
    state = after;
  }
  assert.equal(state.fen, trace.finalFen);
});

test('iteration 106 trace replays deterministically', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/106.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(replayTrace(trace));
});
