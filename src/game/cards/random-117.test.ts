import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, Role, SquareName } from '../types.js';

// Reviewed in order against rules §§4, 10–16, 18.6, 21.2, 22.7 and printed catalog text.
// Each line is an independent action specification, followed by its numbered rationale.
const review = `
1 b2 b3 | Pawn advances one empty square; no capture.
2 end | White finishes its pawn turn; Black receives the move.
3 c7 c6 | Black pawn advances one empty square.
4 end | Black finishes; White receives the move.
5 c2 c4 | Starting pawn crosses empty c3; c3 en-passant opportunity is recorded.
6 end | Preserve c3 opportunity into Black's turn.
7 h7 h6 | Black pawn advances; prior en-passant opportunity expires.
8 end | Pass the completed Black turn.
9 h2 h4 | Starting pawn crosses empty h3; record h3 en-passant opportunity.
10 end | Preserve h3 opportunity into Black's turn.
11 a7 a6 | Black pawn advances; h3 opportunity expires.
12 end | Pass the completed pawn turn.
13 b1 a3 | Knight jumps to empty a3.
14 end | White finishes its knight turn.
15 g8 f6 | Black knight jumps to empty f6.
16 end | Black finishes its knight turn.
17 a3 b5 | Knight jumps to empty b5.
18 end | White finishes; retain knight identity.
19 f6 g4 | Knight jumps to empty g4.
20 end | Black finishes; no card or clock change.
21 b5 c7 | Knight jumps to c7 and checks King e8.
22 end | Black receives its escape turn in check.
23 d8 c7 | Queen captures the checking white knight on adjacent diagonal c7.
24 earthquake | After-move counterclockwise rotation: White forward becomes east, Black west; h4 promotes to Rook and a6 to Queen, opponent first. Retain card.
25 end | Rotation persists; White receives the move.
26 d1 c2 | Queen takes adjacent empty diagonal c2.
27 end | Pass completed White turn.
28 guardian | Black pawn b7 advances west to a7 without follower; replacement move prohibits promotion and en passant.
29 end | Pass completed replacement move.
30 h1 h3 | Rook crosses vacant h2 to h3; lose White kingside castling.
31 end | Pass completed rook turn.
32 c7 d6 | Queen takes adjacent empty diagonal d6.
33 end | Black finishes its queen turn.
34 a1 b1 | Rook moves to vacated b1; lose White queenside castling.
35 end | White finishes its rook turn.
36 d6 d4 | Queen slides through empty d5.
37 end | Black finishes its queen turn.
38 c2 e4 | Queen slides through empty d3.
39 end | White finishes its queen turn.
40 d4 d5 | Queen moves one empty file square.
41 end | Black finishes its queen turn.
42 e4 e7 | Queen crosses e5/e6 and captures Black pawn e7, checking King e8.
43 end | Black receives the checked position.
44 pacifism | Before-move marker protects owned nonroyal pawn g7; existing check may be answered by the regular move.
45 f8 e7 | Bishop captures checking Queen on adjacent diagonal e7.
46 end | Black finishes its safe capture turn.
47 c1 a3 | Bishop crosses empty b2 to empty a3.
48 end | White finishes its bishop turn.
49 resurrection | Return owned captured pawn e7 to vacant g8, a rotated Black second-rank square; clear capturedBy and consume replacement move.
50 end | Black finishes its resurrection turn.
51 b1 b2 | Rook moves one empty file square.
52 end | White finishes its rook turn.
53 d5 e6 | Queen takes empty diagonal e6.
54 end | Black finishes its queen turn.
55 a3 e7 | Bishop crosses b4/c5/d6 and captures Black bishop e7.
56 end | White finishes its bishop capture.
57 e6 c4 | Queen crosses d5 and captures white pawn c4.
58 end | Black finishes its pawn capture.
59 madman | Pawn b3 jumps over Queen c4 to d5, then pawn c6 to b7; both jumped pieces survive and no promotion occurs.
60 end | White finishes replacement move.
61 fanatic | Pawn h6 advances west through empty g6/f6 to e6; no en passant.
62 end | Black finishes replacement move.
63 irresistible-force | Pawn e2 pushes friendly f2 to g2 and g2 to empty h2; all three identities survive without promotion.
64 end | White finishes replacement move.
65 g4 e5 | Knight jumps to empty e5.
66 end | Black finishes its knight move.
67 assassin | King e1 captures its own pawn e2-identity on f2 using adjacent diagonal movement; credit capture to White.
68 end | White finishes replacement capture.
69 h8 h5 | Rook slides through empty h7/h6; lose Black kingside castling.
70 end | Black finishes its rook move.
71 b2 b6 | Rook crosses empty b3/b4/b5 to b6.
72 end | White finishes its rook move.
73 c4 a2 | Queen crosses empty b3 and captures White pawn a2.
74 end | Black finishes its pawn capture.
75 b6 b3 | Rook crosses empty b5/b4.
76 end | White finishes its rook move.
77 a6 b6 | Promoted Queen moves to b6 and checks King f2 through c5/d4/e3.
78 end | White receives an escape turn in check.
79 h3 d3 | Rook crosses g3/f3/e3 but ends on d3, leaving b6–f2 diagonal check; pending rescue is required.
80 fatal-attraction | Magnet on bishop e7 cannot immobilize Queen b6; SELF_CHECK fizzles, spends card, restores rook h3 and pre-move clocks, leaving White to answer original check.
81 e7 c5 | Bishop crosses d6 and interposes c5 on b6–f2 diagonal; White escapes.
82 end | Pass safe replacement regular move; clear allowance.
83 e8 f8 | King enters Bishop c5's d6/e7/f8 diagonal; pending rescue is required.
84 crab | Transforming pacifist pawn g7 cannot interrupt c5–f8 attack; SELF_CHECK spends card and restores King e8, castling q and clocks.
85 e5 f3 | Knight jumps to f3; King stays safely on e8.
86 end | Pass Black replacement regular move.
87 f1 a6 | Bishop crosses empty e2/d3/c4/b5 to a6.
88 end | White finishes its bishop move.
89 f3 h4 | Knight captures the promoted White h-pawn Rook.
90 end | Black finishes its capture.
91 h3 h4 | White original Rook captures that knight.
92 end | White finishes its capture.
93 h5 c5 | Black rook crosses g5/f5/e5/d5 and captures White bishop c5.
94 end | Black finishes its capture.
95 h4 h7 | Rook crosses empty h5/h6 to h7.
96 end | White finishes its rook move.
97 a2 a4 | Queen crosses empty a3 to a4.
98 curse | After-move marker binds opposing original Rook a1 now b3, limiting its future travel; retain card and clocks.
99 end | Black finishes; Curse remains on b3 rook.
100 ghostwalk | Other White Rook h7 crosses h6/h5/h4/h3 and friendly pawn h2 to empty h1; no capture and no castling restoration.
101 end | White finishes replacement move.
102 c6 b7 | Rotated Black pawn captures diagonally west-north, taking White b-pawn on b7.
103 end | Black finishes pawn capture.
104 g1 e2 | Knight jumps to vacant e2.
105 end | White finishes knight turn.
106 a4 e4 | Queen crosses vacant b4/c4/d4.
107 end | Black finishes queen turn.
108 a6 c4 | Bishop crosses empty b5; quiet regular move enables Crusade.
109 crusade | Same physical Bishop takes an extra quiet diagonal c4–d3; no additional clock increment.
110 end | White finishes two-move bishop turn.
111 e4 e5 | Queen moves to adjacent empty e5.
112 end | Black finishes queen turn.
113 d3 a6 | Same Bishop crosses empty c4/b5; quiet regular move enables copied Crusade.
114 haunting-memories | Last played card is nonunique own Crusade; copy extra Bishop move a6–b5 and spend only Memories, with unchanged clocks.
115 end | White finishes copied extra-move turn.
116 e5 f4 | Queen moves to f4, checking King f2 through empty f3.
117 end | White receives checked position.
118 f2 e1 | King takes empty adjacent e1, outside Queen f4 attack.
119 end | White finishes safely; Black has next turn.
`.trim().split('\n');

const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white';
const boardFen = (pieces: PieceState[]) => Array.from({ length: 8 }, (_, row) => {
  let line = '', empty = 0;
  for (let file = 0; file < 8; file++) {
    const p = pieces.find(p => p.square === `${'abcdefgh'[file]}${8 - row}`);
    if (!p) { empty++; continue; }
    if (empty) { line += empty; empty = 0; }
    const symbol = ({ pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' })[p.role];
    line += p.owner === 'white' ? symbol.toUpperCase() : symbol;
  }
  return line + (empty || '');
}).join('/');

function reaches(pieces: PieceState[], p: PieceState, to: string, rotated: boolean, attack: boolean, cursed: boolean): boolean {
  assert.ok(p.square);
  const [x, y] = xy(p.square), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
  if (!dx && !dy) return false;
  const distance = Math.max(Math.abs(dx), Math.abs(dy));
  if (cursed && distance > 2) return false;
  if (p.role === 'knight') return Math.abs(dx) * Math.abs(dy) === 2;
  if (p.role === 'king') return distance === 1;
  if (p.role === 'pawn') {
    const forward = p.owner === 'white' ? 1 : -1;
    if (attack) return rotated ? dx === forward && Math.abs(dy) === 1 : dy === forward && Math.abs(dx) === 1;
    if (rotated ? dy !== 0 || dx * forward < 1 : dx !== 0 || dy * forward < 1) return false;
    if (distance > 2 || distance === 2 && (rotated ? x !== (p.owner === 'white' ? 1 : 6) : y !== (p.owner === 'white' ? 1 : 6))) return false;
  } else if (!(p.role === 'queen' && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))
    || p.role === 'rook' && (dx === 0 || dy === 0)
    || p.role === 'bishop' && Math.abs(dx) === Math.abs(dy))) return false;
  for (let k = 1; k < distance; k++) {
    const s = `${'abcdefgh'[x + Math.sign(dx) * k]}${y + Math.sign(dy) * k + 1}`;
    if (pieces.some(p => p.square === s)) return false;
  }
  return true;
}

test('iteration 117 independently reviewed random campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/117.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(review.length, 119);
  assert.equal(trace.steps.length, review.length);
  let state = createGameState(trace.initial);
  const pieces: PieceState[] = [];
  const back: Role[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (const owner of ['white', 'black'] as const) for (let file = 0; file < 8; file++) {
    for (const [role, rank] of [[back[file]!, owner === 'white' ? 1 : 8], ['pawn', owner === 'white' ? 2 : 7]] as const) {
      const square = `${'abcdefgh'[file]}${rank}` as SquareName;
      pieces.push({ id: `${owner}-${role}-${square}`, owner, role, originalRole: role, square,
        zone: 'board', promoted: false, royal: role === 'king', neutral: false });
    }
  }
  const players = {} as GameState['players'];
  for (const owner of ['white', 'black'] as const) players[owner] = {
    hand: trace.initial.hands![owner]!.map((cardId, i) => ({ id: `${owner}-hand-${i}-${cardId}`, cardId })),
    deck: trace.initial.decks![owner]!.map((cardId, i) => ({ id: `${owner}-deck-${i}-${cardId}`, cardId })), discard: [],
  };
  let turn: GameState['turn'] = { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
  let effects: unknown[] = [], orientation = 0, rights = 'KQkq', half = 0, full = 1, fenColor: Color = 'white';
  let ep: GameState['enPassant'] = [];
  let rewind: { pieces: PieceState[]; rights: string; half: number; full: number; ep: GameState['enPassant'] } | undefined;
  let moves = 0, cards = 0;
  const at = (s: string) => { const p = pieces.find(p => p.square === s); assert.ok(p, s); return p; };
  const capture = (p: PieceState, actor: Color) => { p.zone = 'captured'; p.square = null; p.capturedBy = actor; };
  const relocate = (from: string, to: SquareName) => { at(from).square = to; };
  const sorted = (ps: PieceState[]) => [...ps].sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(sorted(state.pieces), sorted(pieces));
  assert.deepEqual(state.players, players);
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, [spec, rationale] = review[index]!.split(' | ');
    assert.ok(rationale && rationale.length > 20);
    const [number, command, destination] = spec!.split(' ');
    assert.equal(Number(number), n);
    const action = step.action, actor = turn.color;
    if (/^[a-h][1-8]$/.test(command!)) {
      assert.equal(action.type, 'move');
      assert.ok(action.type === 'move');
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.deepEqual(action, { type: 'move', from: command, to: destination });
      const mover = at(command!), victim = pieces.find(p => p.square === destination);
      assert.equal(mover.owner, actor);
      assert.ok(reaches(pieces, mover, destination!, orientation === 90, !!victim, n >= 98 && mover.id === 'white-rook-a1'), `step ${n}: movement geometry`);
      if ([79, 83].includes(n)) rewind = { pieces: structuredClone(pieces), rights, half, full, ep: structuredClone(ep) };
      ep = [];
      if (mover.role === 'pawn' && Math.abs(xy(command!)[1] - xy(destination!)[1]) === 2) {
        ep = [{ target: `${command![0]}${(Number(command![1]) + Number(destination![1])) / 2}` as SquareName, pawnId: mover.id }];
      }
      if (victim) { assert.equal(victim.owner, opposite(actor)); assert.notEqual(victim.id, 'black-pawn-g7'); capture(victim, actor); }
      half = victim || mover.role === 'pawn' ? 0 : half + 1;
      mover.square = destination as SquareName;
      if (mover.id === 'white-rook-h1') rights = rights.replace('K', '');
      if (mover.id === 'white-rook-a1') rights = rights.replace('Q', '');
      if (mover.id === 'black-rook-h8') rights = rights.replace('k', '');
      if (mover.royal) rights = rights.replace(actor === 'white' ? /[KQ]/g : /[kq]/g, '');
      if (actor === 'black') full++;
      fenColor = opposite(actor); turn.phase = 'afterMove'; turn.moveMade = true; moves++;
    } else if (command === 'end') {
      assert.deepEqual(action, { type: 'endTurn' });
      turn = { color: opposite(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    } else {
      assert.ok(action.type === 'playCard');
      assert.equal(action.cardId, command);
      assert.equal(turn.cardPlays[actor], 0);
      const player = players[actor], cardIndex = player.hand.findIndex(c => c.id === action.cardInstanceId);
      assert.ok(cardIndex >= 0);
      const card = player.hand.splice(cardIndex, 1)[0]!;
      assert.equal(card.cardId, command);
      const drawn = player.deck.shift(); assert.ok(drawn); player.hand.push(drawn);
      turn.cardPlays[actor]++; cards++;
      if (![24, 44, 98].includes(n)) player.discard.push(card);
      const replacement = [28, 49, 59, 61, 63, 67, 100].includes(n);
      assert.equal(turn.phase, replacement || n === 44 ? 'beforeMove' : 'afterMove');
      switch (n) {
        case 24: {
          const target = { direction: 'counterclockwise', promotions: [{ square: 'h4', role: 'rook' }, { square: 'a6', role: 'queen' }] };
          assert.deepEqual(action.target, target);
          Object.assign(at('h4'), { role: 'rook', promoted: true }); Object.assign(at('a6'), { role: 'queen', promoted: true });
          orientation = 90; effects.push({ type: 'earthquake', owner: actor, card, direction: 'counterclockwise', target }); break;
        }
        case 28: assert.deepEqual(action.target, [{ from: 'b7', to: 'a7' }]); relocate('b7', 'a7'); break;
        case 44: assert.equal(action.target, 'g7'); effects.push({ type: 'pacifism', owner: actor, card, pieceId: 'black-pawn-g7' }); break;
        case 49: {
          assert.deepEqual(action.target, { pieceId: 'black-pawn-e7', to: 'g8' });
          const p = pieces.find(p => p.id === 'black-pawn-e7')!; assert.equal(p.zone, 'captured');
          p.zone = 'board'; p.square = 'g8'; delete p.capturedBy; break;
        }
        case 59: assert.deepEqual(action.target, [{ from: 'b3', to: 'd5' }, { from: 'd5', to: 'b7' }]); assert.equal(at('c4').role, 'queen'); assert.equal(at('c6').role, 'pawn'); relocate('b3', 'b7'); break;
        case 61: assert.equal(action.target, 'h6'); relocate('h6', 'e6'); break;
        case 63: assert.deepEqual(action.target, [{ from: 'e2', to: 'f2' }]); relocate('g2', 'h2'); relocate('f2', 'g2'); relocate('e2', 'f2'); break;
        case 67: assert.deepEqual(action.target, [{ from: 'e1', to: 'f2' }]); capture(at('f2'), 'white'); relocate('e1', 'f2'); break;
        case 80:
        case 84:
          assert.equal(action.target, n === 80 ? 'e7' : 'g7'); assert.ok(rewind);
          pieces.splice(0, pieces.length, ...structuredClone(rewind.pieces));
          ({ rights, half, full, ep } = structuredClone(rewind)); rewind = undefined;
          fenColor = actor; turn.phase = 'beforeMove'; turn.moveMade = false; break;
        case 98: assert.equal(action.target, 'b3'); effects.push({ type: 'curse', owner: actor, card, pieceId: 'white-rook-a1' }); break;
        case 100: assert.deepEqual(action.target, [{ from: 'h7', to: 'h1' }]); relocate('h7', 'h1'); break;
        case 109: assert.deepEqual(action.target, [{ from: 'c4', to: 'd3' }]); relocate('c4', 'd3'); break;
        case 114: assert.deepEqual(action.target, [{ from: 'a6', to: 'b5' }]); relocate('a6', 'b5'); break;
        default: assert.fail(`unreviewed card ${n}`);
      }
      if (replacement) { ep = []; half = n === 100 ? half + 1 : 0; if (actor === 'black') full++; fenColor = opposite(actor); turn.phase = 'afterMove'; turn.moveMade = true; }
    }
    const before = structuredClone(state), result = applyAction(state, action);
    assert.deepEqual(state, before, `step ${n}: complete input immutability`);
    assert.ok(result.ok, `step ${n}: action accepted`); state = result.state;
    assert.deepEqual(sorted(state.pieces), sorted(pieces), `step ${n}: complete physical state and captors`);
    assert.deepEqual(state.players, players, `step ${n}: complete physical card zones`);
    assert.deepEqual(state.effects, effects, `step ${n}: complete retained effects`);
    assert.deepEqual(state.turn, turn, `step ${n}: turn`);
    assert.equal(state.orientation, orientation);
    assert.deepEqual(state.enPassant, ep, `step ${n}: physical en passant`);
    assert.equal(state.fen, `${boardFen(pieces)} ${fenColor[0]} ${rights || '-'} - ${half} ${full}`, `step ${n}: independent complete FEN`);
    assert.equal(!!state.pendingRescue, [79, 83].includes(n), `step ${n}: rescue iff required`);
    if (state.pendingRescue) {
      assert.ok(rewind);
      assert.deepEqual(sorted(state.pendingRescue.pieces), sorted(rewind.pieces));
      assert.equal(state.pendingRescue.fen, before.fen);
      assert.deepEqual(state.pendingRescue.enPassant, rewind.ep);
      assert.equal(state.pendingRescue.historyLength, before.history.length);
      assert.deepEqual(state.pendingRescue.movedPieceIds, [n === 79 ? 'white-rook-h1' : 'black-king-e8']);
    }
    assert.equal(state.pendingAbduction ?? null, null); assert.equal(state.pendingDoomsayer ?? null, null);
    assert.deepEqual(state.underElfHill ?? [], []); assert.equal(state.outcome, null);
    for (const owner of ['white', 'black'] as const) {
      const king = pieces.find(p => p.owner === owner && p.royal)!;
      const checked = pieces.some(p => p.zone === 'board' && p.owner !== owner && !(n >= 44 && p.id === 'black-pawn-g7')
        && reaches(pieces, p, king.square!, orientation === 90, true, n >= 98 && p.id === 'white-rook-a1'));
      const expected = owner === 'white' ? [77, 78, 79, 80, 116, 117].includes(n) : [21, 22, 42, 43, 44, 83].includes(n);
      assert.equal(checked, expected, `step ${n}: independent ${owner} royal safety`);
    }
    if (n === 80 || n === 84) assert.deepEqual(state.history[state.history.length - 1], {
      type: 'cardFizzled', cardId: n === 80 ? 'fatal-attraction' : 'crab', reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
    });
    if (n === 114) assert.equal(state.history[state.history.length - 1]!.copiedCardId, 'crusade');
  }
  assert.equal(moves, 50); assert.equal(cards, 14);
  assert.equal(state.fen, 'rnb1k1p1/pp1p1pp1/1q2p3/1Br5/5q2/1R6/3PN1PP/4K2R b q - 7 28');
  assert.equal(replayTrace(trace).fen, state.fen);
});
