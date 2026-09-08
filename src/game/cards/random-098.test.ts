import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { Chess } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { makeSquare, parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, SquareName } from '../types.js';

// Independently reviewed in order against rules §§8–13,15.5,19.3,20 and
// cards.md, with all ten played cards' printed artwork inspected.
const rationales = `
1 Nh3 jumps from g1 to an empty square.
2 White finishes; Black receives fresh allowances.
3 Nc6 jumps from b8 to an empty square.
4 Black finishes; White receives fresh allowances.
5 Na3 jumps from b1 to an empty square.
6 White plays Doomsayer after moving; hold its physical card as an effect and draw Rebirth.
7 Black immediately names Pawn and loses d7 to White's effect; discard Doomsayer, reset capture clock.
8 White finishes after the naming choice resolves.
9 Ne5 jumps from c6 without capture.
10 Black finishes the knight turn.
11 Rh1-g1 moves horizontally and permanently forfeits White kingside castling.
12 White finishes the rook turn.
13 Bc8xh3 traverses empty d7,e6,f5,g4 and captures White's original g1 knight for Black.
14 Black finishes the bishop capture.
15 Rg1-h1 returns without restoring castling rights.
16 White finishes the rook return.
17 h7-h6 advances one empty square.
18 Black finishes the pawn turn.
19 g2-g3 advances one empty square.
20 White finishes the pawn turn.
21 b7-b6 advances one empty square.
22 Black finishes the pawn turn.
23 Guardian substitutes c2-c3 with the directly following c1 bishop to c2; no capture or en passant.
24 White finishes the replacement move.
25 Bh3-f5 crosses empty g4.
26 Black finishes the bishop turn.
27 g3-g4 advances into the empty square.
28 White finishes the pawn turn.
29 Bf5-e6 is one diagonal step.
30 Black finishes the bishop turn.
31 Bc2-g6 traverses empty d3,e4,f5.
32 White finishes the bishop turn.
33 f7xg6 captures White's original c1 bishop for Black.
34 Black finishes the pawn capture.
35 Masquerade substitutes Bf1-g2 along an empty queen diagonal; no capture.
36 White finishes the replacement move.
37 Be6-c8 crosses empty d7.
38 Black finishes the bishop turn.
39 Qd1-b3 crosses empty c2.
40 White finishes the queen turn.
41 b6-b5 advances one empty square.
42 Black finishes the pawn turn.
43 Na3-b1 returns by a knight jump.
44 White finishes the knight turn.
45 g6-g5 advances the original f7 pawn one empty square.
46 Black finishes the pawn turn.
47 h2-h3 advances one empty square.
48 White finishes the pawn turn.
49 Ke8-d7 is adjacent and unattacked; Black loses both castling rights.
50 Heresy moves all three surviving Bishops to empty opposite-color neighbors: White g2-h2 first, Black c8-b8 and f8-e8.
51 Black finishes after Heresy; bishop identities persist.
52 Rh1-f1 crosses empty g1.
53 White finishes the rook turn.
54 g7-g6 advances one empty square.
55 Black finishes the pawn turn.
56 Nb1-a3 jumps to the vacant square.
57 White finishes the knight turn.
58 Ne5-f3 is a noncapturing jump, enabling Charge.
59 Charge grants that same knight f3-g1 as its second move; both landing squares are empty and no extra turn is created.
60 Black finishes after the extra knight move.
61 Rf1xg1 captures the Black b8 knight for White.
62 White finishes the rook capture.
63 Resurrection returns Black's captured d7 pawn to vacant h7, retaining identity and clearing capturedBy; consumes Black's move.
64 Black finishes the resurrection turn.
65 Ra1-c1 crosses vacant b1, forfeiting White's remaining queenside castling right.
66 White finishes the rook turn.
67 Annexation simultaneously advances a7-a5 across a6 and h6-h4 across h5; only a7 originated on its starting rank and creates en passant.
68 Black finishes while preserving the a6 en-passant opportunity.
69 Rc1-d1 moves horizontally and expires en passant.
70 White finishes the rook turn.
71 Bb8-a7 makes one diagonal step.
72 Black finishes the bishop turn.
73 d2-d4 crosses vacant d3 and records that pawn's d3 en-passant opportunity.
74 Rebirth relocates enemy original g7 pawn from g6 to vacant f7, a valid Black starting pawn square; no capture, preserve unrelated d3 opportunity.
75 White finishes after Rebirth.
76 Ra8-c8 crosses empty b8; d3 en passant expires.
77 Black finishes the rook turn.
78 Na3xb5 jumps to capture Black's original b7 pawn for White.
79 White finishes the knight capture.
80 Ba7xd4 traverses vacant b6,c5 and captures White's original d2 pawn for Black.
81 Black finishes the bishop capture.
82 e2-e3 advances one empty square.
83 White finishes the pawn turn.
84 e7-e6 advances one empty square.
85 Black finishes the pawn turn.
86 Qb3-b4 moves one empty orthogonal square.
87 White finishes the queen turn.
88 Qd8-f6 traverses empty e7.
89 Black finishes the queen turn.
90 Ke1-f1 moves adjacent onto an unattacked square.
91 White finishes the king turn.
92 Rc8-d8 moves one empty orthogonal square.
93 Holy Quest would swap White Bh2 and Nb5, but Bb5 would check Black Kd7 through c6; SELF_CHECK fizzles, spends and replaces the card.
94 Black finishes with the original unswapped board.
95 Rd1-b1 crosses empty c1.
96 White finishes the rook turn.
97 c7-c5 crosses vacant c6 and records c6 en passant.
98 Black finishes with the c6 opportunity available.
99 Qb4xa5 captures Black's original a7 pawn for White; en passant expires.
100 White finishes the queen capture.
101 Qf6-g7 is one empty diagonal step.
102 Black finishes the queen turn.
103 Qa5-a8 traverses vacant a6,a7.
104 White finishes the queen turn.
105 Kd7-e7 moves adjacent onto an unattacked square.
106 Black finishes the king turn.
107 Fanatic substitutes a2-a5 across vacant a3,a4,a5; no capture, promotion, or en passant.
108 White finishes the replacement move.
109 Qg7-f6 is one empty diagonal step.
110 Black finishes the queen turn.
111 Nb5-a7 jumps to the empty square.
112 White finishes the knight turn.
113 Be8-d7 is one empty diagonal step; Heresy changed its square color, not its identity or powers.
114 Black finishes the bishop turn.
115 b2-b3 advances one empty square as regular move fifty.
116 White finishes; no choices, effects, or rescue remain.
`.trim().split('\n');

test('iteration 098 independently preserves every physical identity and action consequence', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/098.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.length, 116);
  assert.equal(trace.moves, 50);
  let state = createGameState(trace.initial);
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1;
    assert.ok(rationales[index]!.startsWith(`${n} `));
    const before = structuredClone(state);
    const expectedPieces = structuredClone(before.pieces);
    const expectedPlayers = structuredClone(before.players);
    const expectedTurn = structuredClone(before.turn);
    let expectedEffects = structuredClone(before.effects);
    let expectedEp = structuredClone(before.enPassant);
    let expectedFen = before.fen;
    const actor = before.turn.color;
    const other: Color = actor === 'white' ? 'black' : 'white';
    const boardSetup = parseFen(before.fen).unwrap();
    const relocate = (from: SquareName, to: SquareName) => {
      const p = expectedPieces.find(p => p.square === from)!;
      assert.ok(p, `${n}: moving identity at ${from}`);
      assert.equal(expectedPieces.some(p => p.square === to), false, `${n}: ${to} is vacant`);
      p.square = to;
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.match(action.from, /^[a-h][1-8]$/);
      assert.match(action.to, /^[a-h][1-8]$/);
      const position = Chess.fromSetup(boardSetup).unwrap();
      const from = parseSquare(action.from)!;
      const to = parseSquare(action.to)!;
      assert.ok(position.isLegal({ from, to }), `${n}: independent chess legality`);
      const moving = expectedPieces.find(p => p.square === action.from)!;
      const victim = expectedPieces.find(p => p.square === action.to);
      assert.equal(moving.owner, actor);
      if (victim) {
        assert.equal(victim.owner, other);
        assert.equal(victim.royal, false);
        victim.square = null;
        victim.zone = 'captured';
        victim.capturedBy = actor;
      }
      moving.square = action.to as SquareName;
      expectedEp = moving.role === 'pawn' && Math.abs(to - from) === 16
        ? [{ target: makeSquare((to + from) / 2), pawnId: moving.id }] : [];
      position.play({ from, to });
      expectedFen = makeFen(position.toSetup());
      expectedTurn.moveMade = true;
      expectedTurn.phase = 'afterMove';
    } else if (action.type === 'endTurn') {
      assert.equal(before.turn.moveMade, true);
      expectedTurn.color = other;
      expectedTurn.phase = 'beforeMove';
      expectedTurn.moveMade = false;
      expectedTurn.cardPlays = { white: 0, black: 0 };
    } else if (action.type === 'namePiece') {
      assert.equal(n, 7);
      assert.deepEqual(action, { type: 'namePiece', speaker: 'black', name: 'pawn', losses: [{ effectId: 'white-hand-0-doomsayer', pieceId: 'black-pawn-d7' }] });
      const victim = expectedPieces.find(p => p.id === 'black-pawn-d7')!;
      Object.assign(victim, { square: null, zone: 'captured', capturedBy: 'white' });
      expectedEffects = [];
      expectedPlayers.white.discard.push({ id: 'white-hand-0-doomsayer', cardId: 'doomsayer' });
      boardSetup.halfmoves = 0;
    } else if (action.type === 'playCard') {
      const card = expectedPlayers[actor].hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(card, `${n}: actor owns physical card`);
      assert.equal(card.cardId, action.cardId);
      assert.equal(before.turn.cardPlays[actor], 0);
      expectedPlayers[actor].hand = expectedPlayers[actor].hand.filter(c => c.id !== card.id);
      expectedPlayers[actor].hand.push(expectedPlayers[actor].deck.shift()!);
      expectedTurn.cardPlays[actor] = 1;
      if (n === 6) expectedEffects = [{ type: 'doomsayer', owner: 'white', card }];
      else expectedPlayers[actor].discard.push(card);
      const replacements = [23, 35, 63, 67, 107];
      assert.equal(before.turn.phase, replacements.includes(n) ? 'beforeMove' : 'afterMove');
      if (replacements.includes(n)) {
        expectedTurn.moveMade = true;
        expectedTurn.phase = 'afterMove';
        boardSetup.turn = other;
        boardSetup.fullmoves += actor === 'black' ? 1 : 0;
        boardSetup.halfmoves = n === 35 ? boardSetup.halfmoves + 1 : 0;
        boardSetup.epSquare = undefined;
        expectedEp = [];
      }
      switch (n) {
        case 6: assert.equal(action.cardId, 'doomsayer'); break;
        case 23:
          assert.equal(action.cardId, 'guardian');
          relocate('c2', 'c3'); relocate('c1', 'c2'); break;
        case 35:
          assert.equal(action.cardId, 'masquerade');
          relocate('f1', 'g2'); break;
        case 50:
          assert.equal(action.cardId, 'heresy');
          assert.equal(expectedPieces.filter(p => p.role === 'bishop' && p.zone === 'board').length, 3);
          relocate('g2', 'h2'); relocate('c8', 'b8'); relocate('f8', 'e8'); break;
        case 59: {
          assert.equal(action.cardId, 'charge');
          const last = before.history.at(-1)!;
          assert.equal(last.type, 'move'); assert.equal(last.from, 'e5'); assert.equal(last.to, 'f3');
          assert.equal(last.capturedId, undefined);
          relocate('f3', 'g1'); break;
        }
        case 63: {
          assert.equal(action.cardId, 'resurrection');
          const pawn = expectedPieces.find(p => p.id === 'black-pawn-d7')!;
          assert.equal(pawn.zone, 'captured'); assert.equal(pawn.capturedBy, 'white');
          assert.equal(expectedPieces.some(p => p.square === 'h7'), false);
          pawn.square = 'h7'; pawn.zone = 'board'; delete pawn.capturedBy; delete pawn.capturedAtPly; break;
        }
        case 67:
          assert.equal(action.cardId, 'annexation');
          for (const sq of ['a6', 'a5', 'h5', 'h4']) assert.equal(expectedPieces.some(p => p.square === sq), false);
          relocate('a7', 'a5'); relocate('h6', 'h4');
          expectedEp = [{ target: 'a6', pawnId: 'black-pawn-a7' }]; boardSetup.epSquare = parseSquare('a6'); break;
        case 74:
          assert.equal(action.cardId, 'rebirth');
          relocate('g6', 'f7'); boardSetup.epSquare = parseSquare('d3'); break;
        case 93: {
          assert.equal(action.cardId, 'holy-quest');
          assert.deepEqual(action.target, { bishop: 'h2', knight: 'b5' });
          const proposed = Chess.default(); proposed.board = boardSetup.board.clone();
          proposed.board.set(parseSquare('h2')!, { color: 'white', role: 'knight' });
          proposed.board.set(parseSquare('b5')!, { color: 'white', role: 'bishop' });
          assert.equal(proposed.board.has(parseSquare('c6')!), false);
          assert.ok(proposed.kingAttackers(parseSquare('d7')!, 'white', proposed.board.occupied).has(parseSquare('b5')!));
          break;
        }
        case 107:
          assert.equal(action.cardId, 'fanatic');
          for (const sq of ['a3', 'a4', 'a5']) assert.equal(expectedPieces.some(p => p.square === sq), false);
          relocate('a2', 'a5'); break;
        default: assert.fail(`${n}: unreviewed card`);
      }
    } else assert.fail(`${n}: unreviewed action type`);
    if (action.type === 'playCard' || action.type === 'namePiece') {
      boardSetup.board.clear();
      for (const p of expectedPieces) if (p.square) boardSetup.board.set(parseSquare(p.square)!, { color: p.owner, role: p.role });
      expectedFen = makeFen(boardSetup);
    }
    const result = applyAction(state, action);
    assert.deepEqual(state, before, `${n}: full structuredClone input immutability, including capturedBy`);
    assert.ok(result.ok, `${n}: ${rationales[index]}`);
    const after = result.state;
    assert.deepEqual(after.pieces, expectedPieces, `${n}: all physical fields, including unaffected identities and capture actors`);
    assert.deepEqual(after.players, expectedPlayers, `${n}: every hand/deck/discard identity and order`);
    assert.deepEqual(after.turn, expectedTurn, `${n}: turn and allowance accounting`);
    assert.deepEqual(after.effects, expectedEffects, `${n}: complete effect records`);
    assert.deepEqual(after.enPassant, expectedEp, `${n}: en passant lifecycle`);
    assert.equal(after.fen, expectedFen, `${n}: independent board, castling, turn and clocks`);
    assert.equal(after.orientation, 0);
    assert.equal(after.outcome, null);
    assert.equal(!!after.pendingRescue, false);
    assert.equal(!!after.pendingAbduction, false);
    assert.equal(!!after.pendingDoomsayer, n === 6);
    if (action.type === 'playCard' && action.cardId !== 'doomsayer') {
      assert.equal(Chess.fromSetup(parseFen(after.fen).unwrap()).unwrap().isCheckmate(), false, `${n}: regular card did not directly mate`);
    }
    if (n === 93) assert.equal(after.history.at(-1)?.reason, 'SELF_CHECK');
    const safety = Chess.default(); safety.board = parseFen(after.fen).unwrap().board;
    const king = after.pieces.find(p => p.royal && p.owner === actor)!;
    assert.equal(safety.kingAttackers(parseSquare(king.square!)!, other, safety.board.occupied).isEmpty(), true, `${n}: actor royal safety`);
    state = after;
  }
  assert.equal(state.fen, trace.finalFen);
});

test('iteration 098 trace replays', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/098.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(replayTrace(trace));
});
