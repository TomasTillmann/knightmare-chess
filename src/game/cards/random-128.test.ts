import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import { parseFen } from 'chessops/fen';
import type { Color, GameState, PieceState, SquareName } from '../types.js';

// Reviewed against rules §§8–11, 15 and the 18 played cards' final_cards artwork.
// Each numbered entry is an independent chronological explanation, not a hash verdict.
const reasons = `
1 a2-a4: original white a-Pawn advances over vacant a3; a3 EP opportunity.
2 White closes its completed move; Black starts with a fresh allowance.
3 e7-e6: black e-Pawn advances once; the a-Pawn EP window expires.
4 Black closes its completed move; White starts.
5 b1-c3: white b-Knight makes an unobstructed jump.
6 White closes the Knight move; Black starts.
7 e8-e7: black King steps to the vacated e7 square and loses both castling rights.
8 Rebirth after Black moves relocates enemy b2 Pawn to empty starting-rank a2; no capture.
9 Black closes after spending Rebirth; allowances reset.
10 c3-b1: the same white Knight jumps home.
11 White ends after its Knight move.
12 h7-h6: black h-Pawn advances into empty h6.
13 Black ends after its Pawn move.
14 a2-a3: the reborn original b-Pawn advances; its identity stays b2.
15 White ends; Black starts.
16 g7-g6: black g-Pawn advances into empty g6.
17 Black ends; White starts.
18 g1-f3: white g-Knight jumps into empty f3.
19 Cathedral after the move swaps white h1 Rook with c1 Bishop, with no capture or clock increment.
20 White closes the Cathedral turn.
21 f7-f5: black f-Pawn crosses empty f6; f6 EP is available provisionally.
22 White reacts with Chaos: restore f7 Pawn, prior clocks and EP; Black must choose another move.
23 f7-f6 differs from canceled f7-f5; one Pawn step clears Chaos restriction.
24 Black ends the replacement move; White gets its own card allowance.
25 d2-d4: white d-Pawn crosses vacant d3; d3 EP opportunity.
26 White closes its Pawn move.
27 e7-f7: black King steps into the recently vacated f7 square.
28 Black closes its King move.
29 Lost Castle replaces White move: swap a1/a8 Rooks, retaining identities and losing white a-Rook castling.
30 White ends the replacement turn.
31 Madman replaces Black move: g6-e8 jumps over f7 King, then e8-c6 over d7 Pawn; neither jumped piece is captured.
32 Black ends its two-jump replacement move.
33 d1-d3: white Queen slides through empty d2 to empty d3.
34 White closes its Queen move.
35 d7-d5: black d-Pawn crosses empty d6; d6 EP opportunity.
36 Black ends its Pawn move.
37 b1-d2: white b-Knight jumps to empty d2; c1 Rook remains between a1 Rook and e1 King.
38 White closes its Knight move.
39 a1-a2: exchanged black a-Rook moves one square to empty a2.
40 Black closes its Rook move.
41 f3-g5: white g-Knight jumps, checking the black King on f7.
42 White ends; checked Black may answer on its turn.
43 f7-g7: black King escapes the g5 Knight attack.
44 Black closes the safe King move.
45 Forced March replaces White move: original d-Pawn steps sideways d4-e4 into empty e4.
46 White closes the sideways Pawn move.
47 f8-b4: black Bishop slides over vacant e7,d6,c5; d2 Knight blocks its line to e1 King.
48 Black closes its Bishop move.
49 Blessing replaces White move: Queen d3-a6 slides through empty c4,b5 without capturing.
50 White closes its Blessing move.
51 a2-a3: black Rook captures original white b-Pawn; capturedBy is black.
52 Black closes its capture.
53 g2-g3: white g-Pawn advances one square.
54 White closes its Pawn move.
55 c6-c5: the Madman-relocated black g-Pawn advances with its original black direction.
56 Black closes its Pawn move.
57 e4-d5: original white d-Pawn captures black d-Pawn diagonally; capturedBy is white.
58 White closes its capture.
59 a3-a2: black Rook retreats to the now-empty a2 square.
60 Black closes its Rook move.
61 a4-a5: original white a-Pawn advances once.
62 White closes its Pawn move.
63 Haunting Memories copies the last card Blessing: black g-Pawn moves c5-b6 diagonally without capture.
64 Black closes the copied Blessing replacement move.
65 g5-h7: white g-Knight jumps into empty h7.
66 White closes its Knight move.
67 f6-f5: black f-Pawn advances one square.
68 Black closes its Pawn move.
69 a6-b6: white Queen captures original black g-Pawn; capturedBy is white.
70 White closes its capture.
71 Guardian replaces Black move: a7-a6 advances black a-Pawn; enemy Rook at a8 cannot follow.
72 Black closes its Guardian turn.
73 h7-f8: white g-Knight jumps to the vacated f8 square.
74 Siege after White move swaps f8 Knight with c1 Rook, retaining both identities.
75 White closes its Siege turn.
76 b8-d7: black b-Knight jumps into empty d7.
77 Black closes its Knight move.
78 b6-d4: white Queen slides through vacant c5; d4-e5-f6-g7 gives check to Black.
79 Neutrality after White move marks enemy a2 Rook; its owner stays black and Queen check remains.
80 White ends; Black begins in Queen check.
81 a2-a5: Black uses neutral Rook, capturing white a-Pawn through vacant a3,a4, but Queen still checks g7; rescue pending.
82 No Quarter cannot cure the Queen check; spend it and undo illegal capture, returning Pawn a5 and neutral Rook a2.
83 e6-e5: black e-Pawn blocks the Queen d4-g7 diagonal and resolves check.
84 Black closes its safe replacement move.
85 f8-f6: white h-Rook slides through empty f7, permanently removing its last castling right.
86 White closes its Rook move.
87 d8-f6: black Queen crosses empty e7 and captures white h-Rook; capturedBy black.
88 Black closes its capture.
89 h2-h3: white h-Pawn advances once.
90 Figure Dance rotates a8 Rook to a1, h1 Bishop to h8, h8 Rook to a8 simultaneously; Bishop h8 checks g7.
91 White ends; Black begins in Bishop check.
92 Blessing replaces Black move: King g7-f8 escapes Bishop h8 without capture.
93 Black closes its safe replacement move.
94 Assassin replaces White move: controlled neutral Rook a2 takes own white Rook a1; captor is white despite black original ownership.
95 White closes its Assassin turn; c1 Knight blocks a1-e1 neutral Rook ray.
96 f6-c6: black Queen crosses empty e6,d6 to empty c6.
97 Black closes its Queen move.
98 a1-a4: White controls neutral Rook through empty a2,a3; no capture.
99 White closes its neutral Rook move.
100 c6-d6: black Queen slides one file into empty d6.
101 Black closes its Queen move.
102 h3-h4: white h-Pawn advances into empty h4.
103 White closes its Pawn move.
104 e5-d4: black e-Pawn captures white Queen diagonally; capturedBy black.
105 Black closes its capture.
106 g3-g4: white g-Pawn advances into empty g4.
107 White closes its Pawn move.
108 d6-e5: black Queen slides one diagonal square into vacated e5.
109 Black closes its Queen move.
110 a4-b4: White controls neutral Rook and captures black f-Bishop; capturedBy white.
111 White closes its neutral capture.
112 e5-e6: black Queen slides to empty e6.
113 Black closes its Queen move.
114 Pacifism before White move marks own h4 Pawn; retained effect prevents capture both ways without moving it.
115 b4-a4: White slides controlled neutral Rook one file to empty a4.
116 White closes its Pacifism turn.
117 f8-e7: black King steps diagonally into empty e7, outside white attacks.
118 Forbidden City after Black move marks vacant g3; preserve all physical pieces and clocks.
119 Black closes its Forbidden City turn.
120 Confabulation replaces White move: Knight c1-e2 makes a legal jump onto own Pawn; Pawn carries both identities, Knight is away, no capture.
121 White closes its merged-piece turn.
122 d7-f6: black Knight jumps to empty f6; no interaction with forbidden g3.
123 Black closes its Knight move.
124 a4-a1: White moves neutral Rook through empty a3,a2; its a1-b1-c1-d1-e1 ray now checks White, opening rescue.
125 Anathema c8/a8 cannot block neutral Rook a1-e1; spend card, rewind Rook to a4 and restore White move and clocks.
`.trim().split('\n');

test('iteration 128 independent physical, card, phase and royal-state oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/128.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.steps.length, reasons.length);
  assert.equal(reasons.length, 125);
  let state = createGameState(trace.initial);
  let pieces = structuredClone(state.pieces);
  const players = structuredClone(state.players);
  const effects: unknown[] = [];
  let turn = structuredClone(state.turn);
  let ep: GameState['enPassant'] = [];
  let half = 0, full = 1;
  let fenActor: Color = 'white';
  let castling = [0, 7, 56, 63];
  const xy = (square: string) => [square.charCodeAt(0)-97, Number(square[1])-1] as const;
  const pacifist = (piece: PieceState) => effects.some(effect => {
    const e = effect as {type?:string; pieceId?:string};
    return e.type === 'pacifism' && e.pieceId === piece.id;
  });
  const geometry = (board: PieceState[], piece: PieceState, to: string, capture: boolean): boolean => {
    if (!piece.square || piece.zone !== 'board' || capture && pacifist(piece)) return false;
    const forbidden = effects.flatMap(effect => {
      const e = effect as {type?:string; square?:string};
      return e.type === 'forbidden-city' && e.square ? [e.square] : [];
    });
    if (forbidden.includes(to)) return false;
    const [x,y] = xy(piece.square), [tx,ty] = xy(to);
    const dx = tx-x, dy = ty-y;
    const roles = [piece.role];
    for (const effect of effects) {
      const e = effect as {type?:string; pieceIds?:string[]};
      if (e.type === 'confabulation' && e.pieceIds?.[0] === piece.id) {
        for (const id of e.pieceIds.slice(1)) roles.push(board.find(p=>p.id===id)!.role);
      }
    }
    return roles.some(role => {
      if (role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2;
      if (role === 'king') return Math.max(Math.abs(dx),Math.abs(dy)) === 1;
      if (role === 'pawn') {
        const forward = piece.owner === 'white' ? 1 : -1;
        if (capture) return Math.abs(dx) === 1 && dy === forward;
        if (dx !== 0 || dy !== forward && !(y === (piece.owner==='white'?1:6) && dy===2*forward)) return false;
      } else {
        const diagonal = Math.abs(dx) === Math.abs(dy) && dx !== 0;
        const straight = (dx === 0) !== (dy === 0);
        if (!(role === 'bishop' ? diagonal : role === 'rook' ? straight : diagonal || straight)) return false;
      }
      const steps = Math.max(Math.abs(dx),Math.abs(dy));
      for (let distance=1; distance<steps; distance++) {
        const square = `${String.fromCharCode(97+x+Math.sign(dx)*distance)}${1+y+Math.sign(dy)*distance}`;
        if (forbidden.includes(square) || board.some(p=>p.zone==='board' && p.square===square)) return false;
      }
      return true;
    });
  };
  const royalCheck = (board: PieceState[], color: Color): boolean => {
    const king = board.find(p=>p.royal && p.owner===color && p.zone==='board')!;
    const controller: Color = color === 'white' ? 'black' : 'white';
    return board.some(attacker => {
      if (attacker.id === king.id || !attacker.neutral && attacker.owner === color
        || !geometry(board,attacker,king.square!,true)) return false;
      if (!attacker.neutral) return true;
      // §15.1: either side controls the neutral capture, but that controller's
      // own King must remain safe. This trace has exactly one neutral component.
      assert.equal(board.filter(p=>p.neutral && p.zone==='board').length,1);
      const hypothetical = structuredClone(board);
      const victim = hypothetical.find(p=>p.id===king.id)!;
      victim.square = null; victim.zone = 'away';
      hypothetical.find(p=>p.id===attacker.id)!.square = king.square;
      const ownKing = hypothetical.find(p=>p.royal && p.owner===controller && p.zone==='board')!;
      return !hypothetical.some(p=>p.owner!==controller && !p.neutral && geometry(hypothetical,p,ownKing.square!,true));
    });
  };
  const snapshots = new Map<number, {pieces: PieceState[]; ep: GameState['enPassant']; half: number; full: number; fenActor: Color; turn: GameState['turn']} >();
  const at = (square: string) => { const piece = pieces.find(p => p.square === square && p.zone === 'board'); assert.ok(piece, square); return piece; };
  const move = (from: string, to: SquareName, actor: Color, capture = false) => {
    const piece = at(from);
    if (capture) { const victim = at(to); victim.zone = 'captured'; victim.square = null; victim.capturedBy = actor; }
    else assert.ok(!pieces.some(p => p.square === to && p.zone === 'board'), `empty ${to}`);
    piece.square = to;
    return piece;
  };
  const swap = (a: SquareName, b: SquareName) => { const x = at(a), y = at(b); x.square = b; y.square = a; };
  const advance = (pawnOrCapture: boolean) => {
    half = pawnOrCapture ? 0 : half + 1;
    if (turn.color === 'black') full++;
    fenActor = turn.color === 'white' ? 'black' : 'white';
    turn.phase = 'afterMove'; turn.moveMade = true; ep = [];
  };
  const restore = (step: number) => {
    const saved = snapshots.get(step)!;
    pieces = structuredClone(saved.pieces); ep = structuredClone(saved.ep);
    half = saved.half; full = saved.full; fenActor = saved.fenActor;
    turn = structuredClone(saved.turn);
  };
  for (const [index, {action}] of trace.steps.entries()) {
    const n = index + 1;
    const label = reasons[index]!;
    assert.ok(label.startsWith(`${n} `));
    snapshots.set(n, { pieces: structuredClone(pieces), ep: structuredClone(ep), half, full, fenActor, turn: structuredClone(turn) });
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.match(action.to, /^[a-h][1-8]$/);
      const pawn = at(action.from).role === 'pawn';
      const capture = [51, 57, 69, 81, 87, 104, 110].includes(n);
      const mover = at(action.from);
      assert.ok(mover.owner === turn.color || mover.neutral, `${label}: controller`);
      assert.ok(geometry(pieces,mover,action.to,capture), `${label}: independent movement path`);
      if (capture) {
        const victim = at(action.to);
        assert.ok(!victim.royal && !pacifist(victim), `${label}: capturable victim`);
        assert.ok(mover.neutral || victim.neutral || mover.owner!==victim.owner, label);
      }
      const piece = move(action.from, action.to as SquareName, turn.color, capture);
      advance(pawn || capture);
      if ([1,21,25,35].includes(n)) ep = [{ target: `${action.from[0]}${(Number(action.from[1])+Number(action.to[1]))/2}` as SquareName, pawnId: piece.id }];
      if (n === 7) castling = [0, 7];
      if (n === 85) castling = [];
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true, label);
      turn = { color: turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: {white: 0, black: 0} };
    } else {
      assert.equal(action.type, 'playCard');
      if (action.type !== 'playCard') throw new Error('Unexpected choice action');
      const owner: Color = n === 22 ? 'white' : turn.color;
      const player = players[owner];
      const cardIndex = player.hand.findIndex(c => c.id === action.cardInstanceId);
      assert.ok(cardIndex >= 0, label);
      const [card] = player.hand.splice(cardIndex, 1); assert.ok(card);
      assert.equal(card.cardId, action.cardId);
      assert.equal(turn.cardPlays[owner], 0, label);
      if (![79,114,118,120].includes(n)) player.discard.push(card);
      player.hand.push(player.deck.shift()!);
      switch (n) {
        case 8: move('b2', 'a2', 'black'); break;
        case 19: swap('h1','c1'); break;
        case 22: restore(21); break;
        case 29: swap('a1','a8'); castling = [7]; advance(false); break;
        case 31: move('g6','c6','black'); advance(true); break;
        case 45: move('d4','e4','white'); advance(true); break;
        case 49: move('d3','a6','white'); advance(false); break;
        case 63: move('c5','b6','black'); advance(true); break;
        case 71: move('a7','a6','black'); advance(true); break;
        case 74: swap('f8','c1'); break;
        case 79: Object.assign(at('a2'), {neutral: true, neutralBeforeEffects: false}); effects.push({type:'neutrality',owner,card,pieceId:'black-rook-a8'}); break;
        case 82: restore(81); break;
        case 90: { const rook = at('a8'), bishop = at('h1'), blackRook = at('h8'); rook.square = 'a1'; bishop.square = 'h8'; blackRook.square = 'a8'; break; }
        case 92: move('g7','f8','black'); advance(false); break;
        case 94: move('a2','a1','white',true); advance(true); break;
        case 114: effects.push({type:'pacifism',owner,card,pieceId:'white-pawn-h2'}); break;
        case 118: effects.push({type:'forbidden-city',owner,card,square:'g3'}); break;
        case 120: { const knight = at('c1'); knight.square = null; knight.zone = 'away'; effects.push({type:'confabulation',owner,card,pieceIds:['white-pawn-e2','white-knight-g1']}); advance(false); break; }
        case 125: restore(124); break;
        default: throw new Error(`Unreviewed card at ${n}`);
      }
      turn.cardPlays[owner]++;
    }
    const input = structuredClone(state);
    const actionInput = structuredClone(action);
    const result = applyAction(state, action);
    assert.deepEqual(state, input, `${label}: complete structuredClone input immutability`);
    assert.deepEqual(action, actionInput, `${label}: action immutability`);
    assert.ok(result.ok, label);
    state = result.state;
    assert.deepEqual(state.pieces, pieces, `${label}: every physical identity, role, square, zone and capturedBy`);
    assert.deepEqual(state.players, players, `${label}: every physical card in hand/deck/discard`);
    assert.deepEqual(state.effects, effects, `${label}: complete retained effects`);
    assert.deepEqual(state.turn, turn, `${label}: owner, phase, move status, allowances`);
    assert.deepEqual(state.enPassant, ep, `${label}: en-passant`);
    const fen = parseFen(state.fen).unwrap();
    assert.deepEqual([fen.halfmoves, fen.fullmoves, fen.turn, [...fen.castlingRights]], [half,full,fenActor,castling], `${label}: clocks and castling`);
    for (const piece of pieces.filter(p => p.square)) {
      const square = piece.square!;
      const encoded = fen.board.get((square.charCodeAt(0)-97)+(Number(square[1])-1)*8);
      assert.deepEqual(encoded, {color:piece.owner,role:piece.role,promoted:false}, `${label}: FEN ${square}`);
    }
    assert.equal(fen.board.occupied.size(), pieces.filter(p=>p.zone==='board').length, label);
    assert.equal(state.fen.split(' ')[3], '-', `${label}: no available FEN EP capture despite physical opportunity`);
    assert.equal(royalCheck(pieces,'white'), n === 124, `${label}: independent white royal attack calculation`);
    assert.equal(royalCheck(pieces,'black'), [41,42,78,79,80,81,82,90,91].includes(n), `${label}: independent black royal attack calculation`);
    assert.equal(isKingInCheck(state,'white'), n === 124, `${label}: white royal check`);
    assert.equal(isKingInCheck(state,'black'), [41,42,78,79,80,81,82,90,91].includes(n), `${label}: black royal check`);
    assert.equal(!!state.pendingRescue, [81,124].includes(n), `${label}: rescue phase`);
    if (state.pendingRescue) {
      assert.deepEqual(state.pendingRescue.pieces, snapshots.get(n)!.pieces, `${label}: rescue restores complete physical snapshot`);
      assert.equal(state.pendingRescue.fen, input.fen, `${label}: rescue clock checkpoint`);
      assert.deepEqual(state.pendingRescue.enPassant, snapshots.get(n)!.ep, label);
    }
    assert.equal(state.pendingAbduction ?? null, null, label);
    assert.equal(state.pendingDoomsayer ?? null, null, label);
    assert.deepEqual(state.underElfHill ?? [], [], label);
    assert.equal(state.orientation, 0, label);
    assert.equal(state.outcome, null, label);
    assert.deepEqual(state.chaosForbidden, n === 22 ? {player:'black',movement:'black-pawn-f7:f7:f5'} : undefined, `${label}: exact Chaos replacement restriction`);
    assert.deepEqual(state.plotsAllowances ?? [], [], `${label}: no Plots allowance`);
  }
  assert.equal(trace.moves, 50);
  assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,19);
  assert.equal(state.fen, 'r1b3nB/1pp1k3/p3qn1p/P2P1p2/r2p2PP/8/2PNPP2/4KB2 w - - 5 29');
});

test('iteration 128 deterministic trace remains reproducible', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/128.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(trace);
  replayTrace(trace);
});
