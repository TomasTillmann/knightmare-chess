import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameEvent, PieceState, SquareName } from '../types.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/183.json', import.meta.url), 'utf8')) as RandomTrace;
test('iteration 183 deterministic replay', () => {
  assert.ok(trace);
  replayTrace(trace);
});

// Read in order against rules §§8–11, 13.11, 18.6, 22.12 and the seven printed cards.
const rationales = `
1 h2-h3 advances the white Pawn one empty square.
2 Close White's completed quiet move; reset both card allowances.
3 e7-e5 crosses empty e6 from the Pawn starting rank.
4 Close Black's move; preserve its e6 opportunity.
5 d2-d4 crosses empty d3 from the starting rank.
6 Close White's move; preserve its d3 opportunity.
7 g8-e7 is an unobstructed Knight jump to an empty square.
8 Close Black's quiet Knight move.
9 c1-h6 follows the empty d2/e3/f4/g5 diagonal.
10 White's physical Anathema swaps opposing c8 Bishop and h8 Rook after its move; no capture or clock advance.
11 Close the move and Anathema window.
12 e5-e4 advances the black Pawn one empty square.
13 Close Black's Pawn move.
14 h6-g5 is a one-square quiet Bishop diagonal.
15 Close White's Bishop move.
16 d7-d6 advances the black Pawn to empty d6.
17 White's Chaos cancels exactly d7-d6, restores its board/clocks/history and forbids that same move; White draws Fatal Attraction.
18 e7-g8 is a different legal Knight move satisfying Chaos.
19 Black retains physical Truce after its completed move; neither royal is geometrically threatened.
20 Close Black's move and reset both consumed card allowances.
21 g5-d2 follows empty f4/e3 under Truce without capture.
22 Close White's move; Truce remains.
23 c7-c5 crosses empty c6 without capture.
24 Close Black's move retaining the c6 opportunity, uncapturable under Truce.
25 e2-e3 advances into an empty square.
26 Close White's Pawn move.
27 g7-g6 advances one empty square.
28 Close Black's Pawn move.
29 g1-e2 jumps to the now-empty e2 square.
30 White's held Fatal Attraction marks its g2 Pawn after the move; retain the physical effect and draw Merciless.
31 Close White's move while the g2 magnet freezes adjacent nonroyals.
32 d7-d5 crosses empty d6; distinct from the canceled d7-d6 move.
33 Close Black's move with d6 opportunity retained.
34 d2-b4 follows empty c3 outside the magnet neighborhood.
35 Close White's Bishop move.
36 f7-f5 crosses empty f6.
37 Close Black's move with f6 opportunity retained.
38 b4-a3 is a quiet diagonal outside the magnet neighborhood.
39 White's Cowardice sends opposing f5 Pawn backward to empty f6 after its move, preserving clocks.
40 Close White's move and Cowardice window.
41 f8-e7 is a quiet one-square Bishop diagonal.
42 Close Black's Bishop move.
43 b2-b3 advances outside the magnet neighborhood.
44 Close White's Pawn move.
45 b7-b5 crosses empty b6 from its starting rank.
46 Close Black's move with b6 opportunity retained.
47 e2-c1 is a Knight jump outside the magnet neighborhood.
48 Close White's Knight move.
49 e7-f8 quietly returns the Bishop.
50 Close Black's Bishop move.
51 a3-b4 is a quiet Bishop diagonal.
52 Close White's Bishop move.
53 e8-f7 is a safe adjacent royal move and revokes both black castling rights.
54 Close Black's King move; Truce survives the raw attack check.
55 b1-c3 is a quiet Knight jump outside the magnet neighborhood.
56 Close White's Knight move.
57 c8-c7 advances the swapped physical h8 Rook one empty square.
58 Close Black's Rook move.
59 a2-a3 advances one empty square outside the magnet neighborhood.
60 Close White's Pawn move.
61 c7-b7 slides the same black Rook one empty square.
62 Close Black's Rook move.
63 c3-b1 quietly returns the physical b1 Knight.
64 Close White's Knight move.
65 Black's Guardian replaces its move: h7 Pawn advances h6 and the Bishop immediately behind follows h8-h7; reset Pawn clock, no EP.
66 Close the two-piece Guardian move; Black's card allowance resets.
67 b4-d2 follows empty c3 outside the magnet neighborhood.
68 Close White's Bishop move.
69 f7-e8 is a safe adjacent King move; no castling rights return.
70 Close Black's King move.
71 The g2 magnet itself may move g2-g4 through empty g3; discard Fatal Attraction and release its neighbors.
72 Close White's move retaining g3 opportunity; Truce still prevents capture.
73 b7-b6 slides the physical h8 Rook one empty square.
74 Close Black's Rook move.
75 g4-g5 advances the released Pawn one empty square.
76 Close White's Pawn move.
77 g8-e7 is a quiet Knight jump.
78 Close Black's Knight move.
79 The released f1 Bishop may now move diagonally to empty e2.
80 Close White's Bishop move.
81 e8-f7 is a safe adjacent King move.
82 Close Black's King move.
83 c1-a2 is a quiet Knight jump.
84 Close White's Knight move.
85 b5-b4 advances one empty square.
86 Close Black's Pawn move.
87 e2-b5 follows empty d3/c4 without capture.
88 Close White's Bishop move.
89 d8-d6 slides the Queen through empty d7.
90 Close Black's Queen move.
91 b5-e8 follows empty c6/d7 and attacks f7; that raw check ends and discards Truce.
92 Close White's checking Bishop move; Black has a safe capture of e8.
93 f7xe8 captures the white f1 Bishop with the King onto an unattacked square.
94 White's Legacy reacts to that non-Pawn capture and retrieves physical Chaos from its discard, plus draws Fanatic.
95 Close Black's capture window; White's new turn allowance is available.
96 a2xb4 is a Knight capture of the black b7 Pawn.
97 Close White's Knight capture.
98 f6xg5 is a black Pawn diagonal capture of the white g2 Pawn.
99 Close Black's Pawn capture.
100 f2-f4 crosses empty f3; opposing e4 Pawn can legally capture en passant there.
101 Close White's move with the prospective black e4xf3 capture still available.
102 c5xb4 captures the white g1 Knight instead, expiring f3 en passant.
103 Close Black's Pawn capture.
104 h3-h4 advances to an empty square.
105 Close White's Pawn move.
106 b6-a6 slides the black h8 Rook one empty square.
107 Close the fiftieth regular move; White begins turn 26.
`.trim().split('\n');

const other = (c: Color): Color => c === 'white' ? 'black' : 'white';
const xy = (s: string): [number, number] => [s.charCodeAt(0) - 97, Number(s[1]) - 1];
const at = (pieces: PieceState[], s: string) => pieces.find(p => p.zone === 'board' && p.square === s);
function frozen(p: PieceState, pieces: PieceState[], magnet: boolean): boolean {
  if (!magnet || p.royal || p.id === 'white-pawn-g2' || !p.square) return false;
  const anchor = pieces.find(x => x.id === 'white-pawn-g2')!;
  if (!anchor.square) return false;
  const [x,y] = xy(p.square), [a,b] = xy(anchor.square);
  return Math.max(Math.abs(x-a), Math.abs(y-b)) === 1;
}
function geometry(p: PieceState, to: string, pieces: PieceState[], capture: boolean): boolean {
  assert.ok(p.square);
  const [x,y] = xy(p.square), [a,b] = xy(to), dx = a-x, dy = b-y;
  if (!dx && !dy) return false;
  if (p.role === 'knight') return Math.abs(dx*dy) === 2;
  if (p.role === 'king') return Math.max(Math.abs(dx),Math.abs(dy)) === 1;
  if (p.role === 'pawn') {
    const forward = p.owner === 'white' ? 1 : -1;
    if (capture) return Math.abs(dx) === 1 && dy === forward;
    return dx === 0 && (dy === forward || dy === 2*forward && y === (p.owner === 'white' ? 1 : 6)
      && !at(pieces, `${p.square[0]}${y+forward+1}`));
  }
  const diagonal = Math.abs(dx) === Math.abs(dy), straight = dx === 0 || dy === 0;
  if (!(p.role === 'bishop' ? diagonal : p.role === 'rook' ? straight : diagonal || straight)) return false;
  for(let n=1;n<Math.max(Math.abs(dx),Math.abs(dy));n++)
    if(at(pieces,`${String.fromCharCode(97+x+n*Math.sign(dx))}${y+n*Math.sign(dy)+1}`)) return false;
  return true;
}
function threatened(pieces: PieceState[], c: Color, magnet: boolean): boolean {
  const king = pieces.find(p => p.owner === c && p.royal)!;
  assert.ok(king.square);
  return pieces.some(p => p.zone === 'board' && p.owner !== c && !frozen(p,pieces,magnet)
    && geometry(p,king.square!,pieces,true));
}
function boardFen(pieces: PieceState[]): string {
  const letters = { pawn:'p', knight:'n', bishop:'b', rook:'r', queen:'q', king:'k' };
  return Array.from({length:8},(_,r) => {
    let rank = '';
    for(let f=0;f<8;f++) {
      const p = at(pieces,`${String.fromCharCode(97+f)}${8-r}`);
      rank += p ? p.owner === 'white' ? letters[p.role].toUpperCase() : letters[p.role] : '1';
    }
    return rank.replace(/1+/g, s => String(s.length));
  }).join('/');
}

test('iteration 183 independent action, identity, rules and physical-state oracle', () => {
  assert.equal(rationales.length,107);
  assert.equal(trace.steps.length,107);
  let state = createGameState(trace.initial);
  const expected = structuredClone(state);
  let half = 0, full = 1, rights = 'KQkq', fenColor = 'w';
  let magnet = false, truce = false;
  let rollback: { pieces: PieceState[]; half: number; full: number; history: GameEvent[] } | undefined;
  for(const [index,step] of trace.steps.entries()) {
    const n = index+1, action = step.action, reason = rationales[index]!;
    assert.ok(reason.startsWith(`${n} `));
    const snapshot = structuredClone(state), payload = structuredClone(action);
    const actor = expected.turn.color;
    if(action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.match(from,/^[a-h][1-8]$/); assert.match(to,/^[a-h][1-8]$/);
      const p = at(expected.pieces,from)!; assert.ok(p,reason);
      const victim = at(expected.pieces,to);
      assert.equal(p.owner,actor,reason);
      assert.equal(expected.turn.moveMade,false,reason);
      assert.equal(frozen(p,expected.pieces,magnet),false,reason);
      assert.ok(geometry(p,to,expected.pieces,!!victim),reason);
      assert.equal(victim?.royal ?? false,false,reason);
      if(victim) { assert.equal(victim.owner,other(actor)); assert.equal(truce,false); }
      if(n === 16) rollback = { pieces:structuredClone(expected.pieces), half,full,history:structuredClone(expected.history) };
      expected.enPassant = [];
      if(p.role === 'pawn' && Math.abs(Number(from[1])-Number(to[1])) === 2)
        expected.enPassant = [{target:`${from[0]}${(Number(from[1])+Number(to[1]))/2}` as SquareName,pawnId:p.id}];
      if(victim) { victim.square=null; victim.zone='captured'; victim.capturedBy=actor; }
      p.square = to as SquareName;
      half = p.role === 'pawn' || victim ? 0 : half+1;
      if(actor === 'black') full++;
      if(p.royal) rights = rights.replace(actor === 'black' ? /[khq]/g : /[KQ]/g,'');
      fenColor = actor === 'white' ? 'b' : 'w';
      expected.turn.phase='afterMove'; expected.turn.moveMade=true;
      expected.shieldMove={player:actor,pieceIds:[p.id],capturedOpponent:!!victim};
      expected.chaosForbidden=undefined;
      expected.history.push({type:'move',from:from as SquareName,to:to as SquareName,movedPieceId:p.id,movedRoles:[p.role],...(victim ? {capturedId:victim.id}: {})});
      if(magnet && p.id === 'white-pawn-g2') {
        magnet=false; expected.effects=expected.effects.filter(e => (e as {type:string}).type !== 'fatal-attraction');
        expected.players.white.discard.push({id:'white-deck-1-fatal-attraction',cardId:'fatal-attraction'});
      }
      if(truce && (threatened(expected.pieces,'white',magnet)||threatened(expected.pieces,'black',magnet))) {
        assert.equal(n,91,reason); truce=false;
        expected.effects=expected.effects.filter(e => (e as {type:string}).type !== 'truce');
        expected.players.black.discard.push({id:'black-hand-2-truce',cardId:'truce'});
      }
    } else if(action.type === 'endTurn') {
      assert.equal(expected.turn.moveMade,true,reason);
      assert.equal(threatened(expected.pieces,actor,magnet),false,reason);
      expected.turn={color:other(actor),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      expected.shieldMove=undefined;
    } else {
      assert.equal(action.type,'playCard'); if(action.type !== 'playCard') throw new Error(reason);
      const owner: Color = [17,94].includes(n) ? 'white' : actor;
      const hand = expected.players[owner].hand;
      const ci = hand.findIndex(c => c.id === action.cardInstanceId && c.cardId === action.cardId);
      assert.ok(ci >= 0,reason); assert.equal(expected.turn.cardPlays[owner],0);
      const card = hand.splice(ci,1)[0]!;
      const movement: Array<{from:SquareName;to:SquareName}> = [];
      if(n === 10) {
        assert.deepEqual(action,{type:'playCard',cardId:'anathema',cardInstanceId:'white-hand-2-anathema',target:{bishop:'c8',rook:'h8'}});
        const b=at(expected.pieces,'c8')!, r=at(expected.pieces,'h8')!;
        assert.equal(b.role,'bishop'); assert.equal(r.role,'rook'); assert.equal(b.owner,'black'); assert.equal(r.owner,'black');
        b.square='h8'; r.square='c8'; rights='KQhq'; movement.push({from:'c8',to:'h8'},{from:'h8',to:'c8'});
      } else if(n === 17) {
        assert.deepEqual(action,{type:'playCard',cardId:'chaos',cardInstanceId:'white-hand-0-chaos'});
        assert.ok(rollback); expected.pieces=structuredClone(rollback.pieces); half=rollback.half; full=rollback.full;
        expected.history=structuredClone(rollback.history); expected.enPassant=[]; fenColor='b';
        expected.turn.phase='beforeMove'; expected.turn.moveMade=false; expected.shieldMove=undefined;
        expected.chaosForbidden={player:'black',movement:'black-pawn-d7:d7:d6'};
        movement.push({from:'d6',to:'d7'});
      } else if(n === 19) {
        assert.deepEqual(action,{type:'playCard',cardId:'truce',cardInstanceId:'black-hand-2-truce'});
        truce=true; expected.effects.push({type:'truce',owner,card});
      } else if(n === 30) {
        assert.deepEqual(action,{type:'playCard',cardId:'fatal-attraction',cardInstanceId:'white-deck-1-fatal-attraction',target:'g2'});
        assert.equal(at(expected.pieces,'g2')?.owner,'white'); magnet=true;
        expected.effects.push({type:'fatal-attraction',owner,card,pieceId:'white-pawn-g2'});
      } else if(n === 39) {
        assert.deepEqual(action,{type:'playCard',cardId:'cowardice',cardInstanceId:'white-hand-1-cowardice',target:[{from:'f5',to:'f6'}]});
        const p=at(expected.pieces,'f5')!; assert.equal(p.owner,'black'); assert.equal(p.role,'pawn'); assert.equal(at(expected.pieces,'f6'),undefined);
        p.square='f6'; movement.push({from:'f5',to:'f6'});
      } else if(n === 65) {
        assert.deepEqual(action,{type:'playCard',cardId:'guardian',cardInstanceId:'black-hand-0-guardian',target:[{from:'h7',to:'h6'},{from:'h8',to:'h7'}]});
        assert.equal(expected.turn.moveMade,false); const p=at(expected.pieces,'h7')!, b=at(expected.pieces,'h8')!;
        assert.equal(p.role,'pawn'); assert.equal(p.owner,'black'); assert.equal(b.owner,'black'); assert.equal(at(expected.pieces,'h6'),undefined);
        p.square='h6'; b.square='h7'; half=0; full++; fenColor='w'; expected.enPassant=[];
        expected.turn.phase='afterMove'; expected.turn.moveMade=true;
        expected.shieldMove={player:'black',pieceIds:[p.id,b.id],capturedOpponent:false};
        movement.push({from:'h7',to:'h6'},{from:'h8',to:'h7'});
      } else if(n === 94) {
        assert.deepEqual(action,{type:'playCard',cardId:'legacy',cardInstanceId:'white-hand-3-legacy',target:'white-hand-0-chaos'});
        assert.equal(expected.history.at(-1)?.capturedId,'white-bishop-f1');
        const discard=expected.players.white.discard, i=discard.findIndex(c=>c.id === action.target);
        assert.ok(i>=0); hand.push(discard.splice(i,1)[0]!);
      } else throw new Error(`Unreviewed card ${reason}`);
      if(![17,65,94].includes(n)) assert.equal(expected.turn.phase,'afterMove');
      if(![19,30].includes(n)) expected.players[owner].discard.push(card);
      hand.push(expected.players[owner].deck.shift()!); expected.turn.cardPlays[owner]++;
      expected.history.push({type:'cardPlayed',cardId:card.cardId,
        ...([17,94].includes(n)?{player:owner}:{}),
        ...(action.target !== undefined && n !== 94 ? {target:action.target as GameEvent['target']}:{}),
        movement,preservePreviousMove:n!==65});
    }
    const epFen = n === 100 || n === 101 ? 'f3' : '-';
    expected.fen=`${boardFen(expected.pieces)} ${fenColor} ${rights || '-'} ${epFen} ${half} ${full}`;
    const result=applyAction(state,action);
    assert.deepEqual(state,snapshot,`input immutability ${reason}`); assert.deepEqual(action,payload,`payload immutability ${reason}`);
    assert.ok(result.ok,reason); const actual=result.state;
    assert.deepEqual(actual.pieces,expected.pieces,`physical identities/captors ${reason}`);
    assert.equal(actual.fen,expected.fen,`six FEN fields ${reason}`);
    assert.deepEqual(actual.players,expected.players,`exact physical card zones ${reason}`);
    assert.deepEqual(actual.effects,expected.effects,`retained card effects ${reason}`);
    assert.deepEqual(actual.turn,expected.turn,`turn and allowances ${reason}`);
    assert.deepEqual(actual.enPassant,expected.enPassant,reason);
    assert.deepEqual(actual.shieldMove,expected.shieldMove,`all moved identities ${reason}`);
    assert.deepEqual(actual.chaosForbidden,expected.chaosForbidden,reason);
    for(const k of ['plotsExecution','riposteSkipped','riposteCheckDeferred'] as const) assert.equal(actual[k],undefined,`${k} ${reason}`);
    for(const k of ['plotsAllowances','fogLocked','riposteLostMoves','underElfHill'] as const) assert.deepEqual(actual[k]??[],[],`${k} ${reason}`);
    for(const k of ['pendingRescue','pendingDoomsayer','pendingAbduction','outcome'] as const) assert.equal(actual[k]??null,null,`${k} ${reason}`);
    assert.equal(actual.orientation,0);
    assert.deepEqual(actual.history.map((event,i) => event.type === 'move' ? {
      ...event,
      movedPieceId:event.movedPieceId??expected.history[i]?.movedPieceId,
      movedRoles:event.movedRoles??expected.history[i]?.movedRoles,
    }:event),expected.history,`complete semantic history and optional identity annotations ${reason}`);
    if(n === 17) {
      const query=structuredClone(actual), saved=structuredClone(query);
      const forbidden={type:'move',from:'d7',to:'d6'} as const, savedAction=structuredClone(forbidden);
      assert.equal(applyAction(query,forbidden).ok,false,'Chaos forbids the exact canceled Pawn move');
      assert.deepEqual(query,saved); assert.deepEqual(forbidden,savedAction);
    }
    for(const color of ['white','black'] as const) {
      const raw=threatened(expected.pieces,color,magnet);
      if(truce) assert.equal(raw,false,`Truce must end on a raw royal attack ${reason}`);
      const query=structuredClone(actual), saved=structuredClone(query);
      assert.equal(isKingInCheck(query,color),raw,`independent royal geometry ${color} ${reason}`);
      assert.deepEqual(query,saved,`check query immutability ${reason}`);
    }
    // Query opportunities as the prospective captor before moving, not the prior actor's reaction window.
    for(const ep of expected.enPassant) {
      const victim=expected.pieces.find(p=>p.id===ep.pawnId)!;
      const captor=other(victim.owner), query=structuredClone(actual);
      query.turn={color:captor,phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      query.shieldMove=undefined; query.pendingRescue=null;
      const saved=structuredClone(query), dests=legalDests(query);
      assert.deepEqual(query,saved,`EP query immutability ${reason}`);
      for(const p of expected.pieces.filter(p=>p.zone==='board'&&p.owner===captor&&p.role==='pawn')) {
        let possible: boolean=!truce&&!frozen(p,expected.pieces,magnet)&&!at(expected.pieces,ep.target)&&geometry(p,ep.target,expected.pieces,true);
        if(possible) {
          const board=structuredClone(expected.pieces); board.find(q=>q.id===p.id)!.square=ep.target;
          const removed=board.find(q=>q.id===victim.id)!; removed.square=null; removed.zone='captured';
          possible=!threatened(board,captor,magnet);
        }
        assert.equal(dests.get(p.square!)?.includes(ep.target)??false,possible,`prospective EP ${p.square} ${reason}`);
      }
    }
    state=actual;
  }
  assert.equal(trace.steps.filter(s=>s.action.type==='move').length,50);
  assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,7);
  assert.equal(state.fen,'rn2kb2/p3n2b/r2q2pp/3p2p1/1p1PpP1P/PP2P3/2PB4/RN1QK2R w KQ - 1 26');
});
