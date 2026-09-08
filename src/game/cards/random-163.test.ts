// Iteration 163: fresh-agent deterministic engine regression.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameEvent, GameState, PieceState, Role, SquareName } from '../types.js';

// Explicit chronological review: no reason or expected action is derived from reducer output.
const review = `
1 d2d3 | White pawn advances one into empty d3.
2 end | White completes its safe turn.
3 pacifism | Black marks its nonroyal d7 pawn; no move consumed.
4 f7f6 | Black pawn advances one into empty f6.
5 end | Black completes its safe turn and card allowances reset.
6 c2c4 | White pawn crosses empty c3; c3 is an uncapturable EP opportunity.
7 end | Black receives the immediate EP window.
8 b7b5 | Black pawn crosses empty b6; White has no pawn on a5 or c5 yet.
9 end | White receives the immediate EP window.
10 c1d2 | Bishop takes the adjacent empty diagonal square.
11 end | White ends safely; EP has expired.
12 e8f7 | Black King moves diagonally into the square vacated by its pawn.
13 end | Black ends safely; its castling rights are permanently gone.
14 d2c1 | White Bishop returns along the adjacent diagonal.
15 end | White completes its safe turn.
16 d8e8 | Black Queen moves one file to the vacated royal square.
17 end | Black completes its safe turn.
18 c4c5 | White pawn advances one without capturing b5.
19 end | White completes its safe turn.
20 fanatic | Black a7 pawn traverses empty a6 and a5 to a4; replacement move, no EP.
21 end | Black has used its move and card.
22 d1a4 | Queen crosses c2,b3 and captures physical black a7 pawn on a4.
23 end | White completes its safe turn.
24 d7d5 | Pacifist pawn crosses empty d6; raw FEN has d6, but its immunity forbids EP capture.
25 end | White receives the immediate EP window without overriding immunity.
26 pacifism | White c5 pawn becomes pacifist; existing raw d6 FEN remains serialized.
27 a4b5 | Queen captures black b7 pawn diagonally; pacifist c5 does not participate.
28 end | White completes its safe turn.
29 d5d4 | Pacifist pawn advances into empty d4 without capturing.
30 end | Black completes its safe turn.
31 b5a5 | Queen moves one file to empty a5.
32 end | White completes its safe turn.
33 c8d7 | Black Bishop moves diagonally to the pawn's former square.
34 end | Black completes its safe turn.
35 haunting-memories | Copy the last Pacifism onto White a1 Rook, preserving the copying card's identity.
36 e1d2 | White King enters empty d2 safely and loses both castling rights.
37 end | White completes its safe turn.
38 g7g6 | Black pawn advances one into empty g6.
39 end | Black completes its safe turn.
40 g1f3 | White Knight jumps to empty f3.
41 end | White completes its safe turn.
42 evangelists | Swap black d7 Bishop with white c1 Bishop, retaining ownership; c1 Bishop checks d2 King.
43 end | Black may complete a checking replacement move; White receives its escape turn.
44 h1g1 | Rook moves one file, temporarily leaving c1 Bishop's check; held Dungeon c1→h1 cures it.
45 cowardice | c7→c8 cannot cure c1 Bishop's check; spend card, rewind Rook and reopen White's move.
46 d2e1 | White King leaves the c1 diagonal for safe e1.
47 end | White completes its corrected turn with its card already spent.
48 c1d2 | Black Bishop moves one diagonal and checks e1 King.
49 curse | Mark White f1 Bishop after Black's move; preserve the checking move.
50 end | White receives the checking Bishop position.
51 f3d2 | Knight jumps to d2, captures physical black c8 Bishop and cures check.
52 end | White completes its safe turn.
53 passing-in-the-night | Simultaneously swap d4/h2 and f6/d3 Pawns; preserve four identities and d7 Pacifism.
54 end | Black completes its noncapturing replacement move.
55 h1g1 | White Rook moves to empty g1.
56 end | White completes its safe turn.
57 e8c8 | Black Queen crosses empty d8 to c8.
58 end | Black completes its safe turn.
59 a5a6 | White Queen advances along the clear a-file.
60 end | White completes its safe turn.
61 f7g7 | King enters f6 Pawn's attack provisionally; held Coup h2 transfers royalty to a safe pawn.
62 truce | Raw f6 Pawn attack immediately defeats Truce; spend it and rewind unsafe King move.
63 c8d8 | Black Queen moves one file; the returned f7 King is safe.
64 end | Black completes its corrected turn with Truce spent.
65 a2a3 | White pawn advances one into empty a3.
66 dungeon | Relocate black e7 Pawn to empty h1, without promotion, and bar its next turn movement.
67 end | Black receives the h1 Pawn prohibition.
68 g8e7 | Knight jumps to empty e7; Dungeon only bars the physical e7 Pawn now on h1.
69 end | Black ends; Dungeon's one-turn prohibition expires.
70 e1d1 | White King moves one file to safe d1.
71 end | White completes its safe turn.
72 winged-victory | Return captured black b7 Pawn on empty central d5, clearing its captor.
73 end | Black completes its replacement placement; placement does not trigger Shield.
74 a6a8 | Queen crosses empty a7 and captures black a8 Rook.
75 end | White completes its safe turn.
76 g6g5 | Black pawn advances to empty g5.
77 end | Black completes its safe turn.
78 a8a5 | Queen crosses empty a7,a6 to a5.
79 crab | White marks its g2 Pawn as a Crab after moving; no physical relocation.
80 end | White completes its safe turn.
81 f8g7 | Black Bishop enters empty adjacent diagonal g7.
82 end | Black completes its safe turn.
83 bombard | White Rook jumps exactly one blocker, its g2 Crab, and lands on empty g3.
84 end | White completes its replacement Rook move.
85 d8g8 | Queen crosses empty e8,f8 to g8.
86 end | Black completes its safe turn.
87 d7c6 | White Bishop moves to adjacent empty diagonal c6.
88 end | White completes its safe turn.
89 g8c8 | Queen crosses empty f8,e8,d8 to c8.
90 end | Black completes its safe turn.
91 g3d3 | White Rook crosses empty f3,e3 and captures the physical black f7 Pawn.
92 end | White completes its safe turn.
93 f7f8 | Black King retreats into empty safe f8.
94 end | Black completes its safe turn.
95 breakthrough | White h2 Pawn now on d4 captures the returned black b7 Pawn forward on d5.
96 end | White completes its replacement capture.
97 g5g4 | Black pawn advances one into empty g4.
98 end | Black completes its safe turn.
99 f2f4 | White pawn crosses empty f3; black g4 pawn has a legal immediate EP capture.
100 end | Black receives that f3 EP capture window.
101 e7f5 | Black Knight jumps to empty f5, declining and expiring EP.
102 end | Black completes its safe turn.
103 f6f7 | White d2 Pawn advances into empty f7; it attacks e8,g8 rather than f8 King.
104 end | White completes its safe turn.
105 g4g3 | Black pawn advances into empty g3.
106 end | Black completes its safe turn.
107 d1e1 | White King returns one file to safe e1.
108 end | White completes its safe turn.
109 h7h6 | Black pawn advances one into empty h6.
110 coup | Transfer royalty from f8 King to physical d7 Pawn on h2, keeping its Pawn motion and marker.
111 end | Black completes its safe turn with its new royal identity.
112 d2c4 | White Knight jumps into empty c4.
113 end | White completes its safe turn.
114 c8d8 | Black Queen moves one file into empty d8.
115 end | Black completes its safe turn.
116 a3a4 | White pawn advances one into empty a4.
117 end | White completes its safe turn.
118 d8d6 | Black Queen crosses empty d7 to d6; White d5 Pawn blocks its d-file continuation.
119 end | Black completes move command fifty and passes to White.
`.trim().split('\n').map(line => {
  const [head, reason] = line.split(' | ');
  const [n, command] = head!.split(' ');
  return { n: Number(n), command: command!, reason: reason! };
});

const cardActions: Record<number, GameAction> = {
  3: { type: 'playCard', cardId: 'pacifism', cardInstanceId: 'black-hand-2-pacifism', target: 'd7' },
  20: { type: 'playCard', cardId: 'fanatic', cardInstanceId: 'black-hand-1-fanatic', target: 'a7' },
  26: { type: 'playCard', cardId: 'pacifism', cardInstanceId: 'white-hand-1-pacifism', target: 'c5' },
  35: { type: 'playCard', cardId: 'haunting-memories', cardInstanceId: 'white-hand-4-haunting-memories', target: 'a1' },
  42: { type: 'playCard', cardId: 'evangelists', cardInstanceId: 'black-deck-1-evangelists', target: { own: 'd7', opponent: 'c1' } },
  45: { type: 'playCard', cardId: 'cowardice', cardInstanceId: 'white-hand-0-cowardice', target: [{ from: 'c7', to: 'c8' }] },
  49: { type: 'playCard', cardId: 'curse', cardInstanceId: 'black-hand-0-curse', target: 'f1' },
  53: { type: 'playCard', cardId: 'passing-in-the-night', cardInstanceId: 'black-deck-0-passing-in-the-night', target: [{ from: 'd4', to: 'h2' }, { from: 'f6', to: 'd3' }] },
  62: { type: 'playCard', cardId: 'truce', cardInstanceId: 'black-deck-2-truce' },
  66: { type: 'playCard', cardId: 'dungeon', cardInstanceId: 'white-hand-2-dungeon', target: [{ from: 'e7', to: 'h1' }] },
  72: { type: 'playCard', cardId: 'winged-victory', cardInstanceId: 'black-deck-5-winged-victory', target: { pieceId: 'black-pawn-b7', to: 'd5' } },
  79: { type: 'playCard', cardId: 'crab', cardInstanceId: 'white-deck-0-crab', target: 'g2' },
  83: { type: 'playCard', cardId: 'bombard', cardInstanceId: 'white-hand-3-bombard', target: [{ from: 'g1', to: 'g3' }] },
  95: { type: 'playCard', cardId: 'breakthrough', cardInstanceId: 'white-deck-2-breakthrough', target: [{ from: 'd4', to: 'd5' }] },
  110: { type: 'playCard', cardId: 'coup', cardInstanceId: 'black-deck-3-coup', target: 'h2' },
};
const cardWindows: Record<number, [Color, GameState['turn']['phase']]> = {
  3:['black','beforeMove'],20:['black','beforeMove'],26:['white','beforeMove'],
  35:['white','beforeMove'],42:['black','beforeMove'],45:['white','afterMove'],
  49:['black','afterMove'],53:['black','beforeMove'],62:['black','afterMove'],
  66:['white','afterMove'],72:['black','beforeMove'],79:['white','afterMove'],
  83:['white','beforeMove'],95:['white','beforeMove'],110:['black','afterMove'],
};

const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const square = (x: number, y: number): SquareName => `${'abcdefgh'[x]}${y + 1}` as SquareName;
const on = (pieces: PieceState[], s: string) => pieces.find(p => p.square === s && p.zone === 'board');
type Effect = { type: string; pieceId?: string; player?: Color };
const has = (effects: unknown[], type: string, id: string) => effects.some(e => (e as Effect).type === type && (e as Effect).pieceId === id);

function geometry(p: PieceState, to: string, pieces: PieceState[], effects: unknown[], capture: boolean): boolean {
  const [x,y] = xy(p.square!), [u,v] = xy(to), dx = u-x, dy = v-y, a = Math.abs(dx), b = Math.abs(dy);
  if (!a && !b) return false;
  if (has(effects, 'curse', p.id) && Math.max(a,b) > 2) return false;
  if (p.role === 'knight') return a*b === 2;
  if (p.role === 'king') return Math.max(a,b) === 1;
  if (p.role === 'pawn') {
    const direction = p.owner === 'white' ? 1 : -1;
    if (capture || has(effects, 'crab', p.id)) return a === 1 && dy === direction;
    return dx === 0 && (dy === direction || dy === 2*direction && (p.owner === 'white' ? y <= 1 : y >= 6)
      && !on(pieces, square(x,y+direction)));
  }
  if (!(p.role === 'rook' ? dx === 0 || dy === 0 : p.role === 'bishop' ? a === b : dx === 0 || dy === 0 || a === b)) return false;
  for (let i = 1; i < Math.max(a,b); i++) if (on(pieces, square(x+Math.sign(dx)*i,y+Math.sign(dy)*i))) return false;
  return true;
}

function checked(pieces: PieceState[], effects: unknown[], color: Color): boolean {
  const royal = pieces.find(p => p.royal && p.owner === color)!;
  if (has(effects, 'pacifism', royal.id)) return false;
  return pieces.some(p => p.zone === 'board' && p.owner !== color
    && !has(effects, 'pacifism', p.id)
    && !effects.some(e => (e as Effect).type === 'dungeon' && (e as Effect).pieceId === p.id && (e as Effect).player === p.owner)
    && geometry(p, royal.square!, pieces, effects, true));
}

function boardFen(pieces: PieceState[]): string {
  const roles = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_,row) => {
    let rank = '', empty = 0;
    for (let x = 0; x < 8; x++) {
      const p = on(pieces, square(x,7-row));
      if (!p) { empty++; continue; }
      if (empty) { rank += empty; empty = 0; }
      const ch = roles[p.role]; rank += p.owner === 'white' ? ch.toUpperCase() : ch;
    }
    return rank + (empty || '');
  }).join('/');
}

test('iteration 163 independently reviewed deterministic trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/163.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860163);
  assert.equal(review.length, trace.steps.length);
  let state = createGameState(trace.initial);
  const back: Role[] = ['rook','knight','bishop','queen','king','bishop','knight','rook'];
  let pieces: PieceState[] = [];
  for (const rank of [0,1,6,7]) for (let file = 0; file < 8; file++) {
    const owner = rank < 2 ? 'white' : 'black', role = rank === 1 || rank === 6 ? 'pawn' : back[file]!;
    const s = square(file,rank);
    pieces.push({ id: `${owner}-${role}-${s}`, owner, role, originalRole: role, square:s, zone:'board', promoted:false, royal:role==='king', neutral:false });
  }
  const initialPlayer = (color: Color): GameState['players']['white'] => ({
    hand: trace.initial.hands![color]!.map((cardId,i) => ({ id:`${color}-hand-${i}-${cardId}`,cardId })),
    deck: trace.initial.decks![color]!.map((cardId,i) => ({ id:`${color}-deck-${i}-${cardId}`,cardId })), discard:[],
  });
  const players: GameState['players'] = { white: initialPlayer('white'), black: initialPlayer('black') };
  let turn: GameState['turn'] = { color:'white',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0} };
  let effects: unknown[] = [], history: GameEvent[] = [], ep: GameState['enPassant'] = [];
  let shield: GameState['shieldMove'], rights = 'KQkq', rawEp = '-', half = 0, full = 1, fenTurn: Color = 'white';
  let rollback: { pieces:PieceState[]; fen:string; ep:GameState['enPassant']; history:GameEvent[]; half:number; full:number; rawEp:string; fenTurn:Color } | undefined;
  const fen = () => `${boardFen(pieces)} ${fenTurn[0]} ${rights || '-'} ${rawEp} ${half} ${full}`;
  const finish = (pawn: boolean, capture: boolean, ids: string[]) => {
    half = pawn || capture ? 0 : half+1; if (turn.color === 'black') full++;
    fenTurn = opposite(turn.color); turn.phase='afterMove'; turn.moveMade=true;
    shield={player:turn.color,pieceIds:ids,capturedOpponent:capture};
  };
  const movePhysical = (from: string, to: string) => {
    const p = on(pieces,from)!; assert.ok(p); const victim = on(pieces,to);
    if (victim) { assert.notEqual(victim.owner,p.owner); assert.equal(victim.royal,false); assert.equal(has(effects,'pacifism',p.id)||has(effects,'pacifism',victim.id),false); victim.square=null;victim.zone='captured';victim.capturedBy=turn.color; }
    p.square=to as SquareName;
    if(p.royal && p.role==='king') rights=rights.replace(p.owner==='white'?/[KQ]/g:/[kq]/g,'');
    return {p,victim};
  };
  for (const row of review) {
    assert.equal(row.n, review.indexOf(row)+1); assert.ok(row.reason.length > 20);
    const n=row.n, expectedAction: GameAction = cardActions[n] ?? (row.command==='end' ? {type:'endTurn'} : {type:'move',from:row.command.slice(0,2),to:row.command.slice(2)});
    const action=trace.steps[n-1]!.action; assert.deepEqual(action,expectedAction,`action ${n}`);
    const prior=structuredClone(state), oldFen=fen(), oldPieces=structuredClone(pieces), oldHistory=structuredClone(history), oldEp=structuredClone(ep);
    if (action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from=action.from,to=action.to,p=on(pieces,from)!; assert.ok(p); assert.equal(p.owner,turn.color);
      assert.equal(turn.moveMade,false); assert.equal(geometry(p,to,pieces,effects,!!on(pieces,to)),true,`geometry ${n}`);
      assert.equal(effects.some(e=>(e as Effect).type==='dungeon'&&(e as Effect).pieceId===p.id),false);
      if(n===44||n===61) rollback={pieces:oldPieces,fen:oldFen,ep:oldEp,history:oldHistory,half,full,rawEp,fenTurn};
      const {victim}=movePhysical(from,to); ep=[];rawEp='-';
      if(p.role==='pawn' && Math.abs(xy(to)[1]-xy(from)[1])===2) {
        const [x,y]=xy(to); ep=[{target:square(x,(xy(from)[1]+y)/2),pawnId:p.id}];
        if(pieces.some(q=>q.zone==='board'&&q.owner!==p.owner&&q.role==='pawn'&&xy(q.square!)[1]===y&&Math.abs(xy(q.square!)[0]-x)===1)) rawEp=ep[0]!.target;
      }
      history.push({type:'move',from:from as SquareName,to:to as SquareName,...(victim?{capturedId:victim.id}:{})});
      finish(p.role==='pawn',!!victim,[p.id]);
    } else if(action.type==='endTurn') {
      assert.equal(turn.moveMade,true); assert.equal(checked(pieces,effects,turn.color),false);
      const actor=turn.color; effects=effects.filter(e=>!((e as Effect).type==='dungeon'&&(e as Effect).player===actor));
      turn={color:opposite(actor),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}}; shield=undefined;
    } else if(action.type==='playCard') {
      const [cardOwner,cardPhase]=cardWindows[n]!;
      assert.equal(turn.color,cardOwner,`card owner's own-turn window ${n}`);
      assert.equal(turn.phase,cardPhase,`printed card timing ${n}`);
      assert.equal(turn.moveMade,cardPhase==='afterMove',`card move status ${n}`);
      if(n===35)assert.equal([...history].reverse().find(event=>event.type==='cardPlayed'||event.type==='cardFizzled')?.cardId,'pacifism','Haunting Memories copies the latest before-move Pacifism');
      const actor=turn.color, player=players[actor], ci=player.hand.findIndex(c=>c.id===action.cardInstanceId);
      assert.ok(ci>=0); assert.equal(turn.cardPlays[actor],0); const card=player.hand.splice(ci,1)[0]!;
      assert.equal(card.cardId,action.cardId); turn.cardPlays[actor]++; player.hand.push(player.deck.shift()!);
      const continuing=[3,26,35,49,79,110].includes(n); if(!continuing)player.discard.push(card);
      let movement: Array<{from:SquareName;to:SquareName}>=[], capturedId: string|undefined;
      const relocate=(from:SquareName,to:SquareName)=>{ const r=movePhysical(from,to);movement.push({from,to});capturedId=r.victim?.id;return r.p; };
      if(continuing) {
        assert.equal(typeof action.target,'string'); const target=on(pieces,action.target as string)!; assert.ok(target);
        if(n===110) {const king=pieces.find(p=>p.owner===actor&&p.royal)!;king.royal=false;target.royal=true;effects.push({type:'coup',owner:actor,card,princeId:king.id,kingId:target.id,princeRole:'king'});}
        else effects.push({type:n===49?'curse':n===79?'crab':'pacifism',owner:actor,card,pieceId:target.id});
      } else if(n===20) { assert.equal(turn.phase,'beforeMove'); for(const s of ['a6','a5','a4'])assert.equal(on(pieces,s),undefined); const p=relocate('a7','a4');ep=[];rawEp='-';finish(true,false,[p.id]); }
      else if(n===42||n===53) {
        const pairs=n===42?[['c1','d7']]:[['d3','f6'],['h2','d4']];
        const changes=pairs.flatMap(([a,b])=>[{p:on(pieces,a!)!,from:a!,to:b!},{p:on(pieces,b!)!,from:b!,to:a!}]);
        for(const item of changes)item.p.square=item.to as SquareName;
        movement=pieces.filter(p=>changes.some(c=>c.p.id===p.id)).map(p=>{const c=changes.find(c=>c.p.id===p.id)!;return{from:c.from as SquareName,to:c.to as SquareName};});
        ep=[];rawEp='-';finish(n===53,false,[]); // §16.3: swaps are not movement triggers.
      } else if(n===45||n===62) {
        assert.ok(rollback); assert.equal(checked(pieces,effects,actor),true);
        if(n===45){assert.ok(on(pieces,'c7'));assert.equal(on(pieces,'c8'),undefined);}
        pieces=structuredClone(rollback.pieces);ep=structuredClone(rollback.ep);history=structuredClone(rollback.history);
        half=rollback.half;full=rollback.full;rawEp=rollback.rawEp;fenTurn=rollback.fenTurn;
        turn.phase='beforeMove';turn.moveMade=false;
      } else if(n===66) { const p=relocate('e7','h1');effects.push({type:'dungeon',owner:actor,player:'black',pieceId:p.id}); }
      else if(n===72) {const p=pieces.find(p=>p.id==='black-pawn-b7')!;assert.equal(p.zone,'captured');assert.equal(p.capturedBy,'white');assert.equal(on(pieces,'d5'),undefined);p.square='d5';p.zone='board';delete p.capturedBy;ep=[];rawEp='-';finish(true,false,[]);}
      else if(n===83) {assert.equal(on(pieces,'g2')?.id,'white-pawn-g2');assert.equal(on(pieces,'g3'),undefined);const p=relocate('g1','g3');ep=[];rawEp='-';finish(false,false,[p.id]);}
      else if(n===95) {assert.equal(on(pieces,'d4')?.id,'white-pawn-h2');assert.equal(on(pieces,'d5')?.id,'black-pawn-b7');const p=relocate('d4','d5');ep=[];rawEp='-';finish(true,true,[p.id]);}
      else assert.fail(`unreviewed card ${n}`);
      if(n===45||n===62)history.push({type:'cardFizzled',cardId:card.cardId,reason:'SELF_CHECK',movement:[],preservePreviousMove:false});
      else history.push({type:'cardPlayed',cardId:card.cardId,...(action.target===undefined?{}:{target:action.target as GameEvent['target']}),...(n===35?{copiedCardId:'pacifism',player:actor}:{}),...(capturedId?{capturedId}:{}),movement,preservePreviousMove:[49,66,79,110].includes(n)});
    } else assert.fail('unreviewed action kind');
    const result=applyAction(state,action);assert.deepEqual(state,prior,`input immutability ${n}`);assert.ok(result.ok,`accepted ${n}`);state=result.state;
    assert.deepEqual(state.pieces,pieces,`physical board and captors ${n}`);
    assert.equal(state.fen,fen(),`all six FEN fields ${n}`); assert.deepEqual(state.turn,turn,`turn ${n}`);
    assert.deepEqual(state.players,players,`exact card zones ${n}`);assert.deepEqual(state.effects,effects,`effects ${n}`);
    assert.deepEqual(state.history,history,`history ${n}`);assert.deepEqual(state.enPassant,ep,`EP ${n}`);
    assert.deepEqual(state.shieldMove,shield,`full movement trigger ${n}`);
    for(const field of ['chaosForbidden','plotsExecution','plotsAllowances','fogLocked','riposteLostMoves','riposteSkipped','riposteCheckDeferred'] as const) assert.ok(state[field]===undefined||Array.isArray(state[field])&&state[field].length===0,`${field} ${n}`);
    assert.equal(state.orientation,0);assert.equal(state.outcome,null);assert.equal(state.pendingAbduction??null,null);assert.equal(state.pendingDoomsayer??null,null);assert.deepEqual(state.underElfHill??[],[]);
    const expectedChecks={white:[42,43,44,45,48,49,50].includes(n),black:n===61};
    for(const color of ['white','black'] as const){assert.equal(checked(pieces,effects,color),expectedChecks[color],`independent royal threat ${color} ${n}`);assert.equal(isKingInCheck(state,color),expectedChecks[color],`engine royal threat ${color} ${n}`);}
    if(n===44||n===61) {
      assert.ok(state.pendingRescue);assert.deepEqual(state.pendingRescue.pieces,oldPieces);assert.equal(state.pendingRescue.fen,oldFen);assert.deepEqual(state.pendingRescue.enPassant,oldEp);assert.equal(state.pendingRescue.historyLength,oldHistory.length);assert.deepEqual(state.pendingRescue.history??state.pendingRescue.before?.history,oldHistory);assert.deepEqual(state.pendingRescue.movedPieceIds,shield!.pieceIds);assert.deepEqual(state.pendingRescue.before,prior);
      const witness:GameAction=n===44?{type:'playCard',cardId:'dungeon',cardInstanceId:'white-hand-2-dungeon',target:[{from:'c1',to:'h1'}]}:{type:'playCard',cardId:'coup',cardInstanceId:'black-deck-3-coup',target:'h2'};
      assert.equal(state.turn.color,n===44?'white':'black');assert.equal(state.turn.phase,'afterMove');assert.equal(state.turn.moveMade,true);
      const saved=structuredClone(state), rescued=applyAction(state,witness);assert.deepEqual(state,saved);assert.ok(rescued.ok);assert.equal(rescued.state.pendingRescue??null,null);
      const witnessPieces=structuredClone(pieces);
      if(n===44){on(witnessPieces,'c1')!.square='h1';}else{witnessPieces.find(p=>p.owner==='black'&&p.royal)!.royal=false;on(witnessPieces,'h2')!.royal=true;}
      assert.deepEqual(rescued.state.pieces,witnessPieces);assert.equal(checked(witnessPieces,rescued.state.effects,turn.color),false);assert.equal(isKingInCheck(rescued.state,turn.color),false);
      const beforeWitnessEnd=structuredClone(rescued.state), completed=applyAction(rescued.state,{type:'endTurn'});assert.deepEqual(rescued.state,beforeWitnessEnd,'witness endTurn input immutability');assert.ok(completed.ok,'concrete rescue completes a legal turn');
    } else assert.equal(state.pendingRescue??null,null,`no rescue ${n}`);
    if(ep.length) {
      const capturing=opposite(pieces.find(p=>p.id===ep[0]!.pawnId)!.owner);
      const prospective={...state,turn:{color:capturing,phase:'beforeMove' as const,moveMade:false,cardPlays:{white:0,black:0}},pendingRescue:null};
      const epCaptures=pieces.filter(p=>p.zone==='board'&&p.owner===capturing&&p.role==='pawn'&&!has(effects,'pacifism',p.id)&&!has(effects,'pacifism',ep[0]!.pawnId)&&geometry(p,ep[0]!.target,pieces,effects,true));
      assert.deepEqual(epCaptures.map(p=>p.square),n===99||n===100?['g4']:[]);
      if(n===99||n===100) {
        const capturedBoard=structuredClone(pieces), pawn=on(capturedBoard,'g4')!, victim=on(capturedBoard,'f4')!;
        assert.equal(capturing,'black');assert.equal(pawn.id,'black-pawn-g7');assert.equal(victim.id,'white-pawn-f2');assert.equal(on(capturedBoard,'f3'),undefined);
        pawn.square='f3';victim.square=null;victim.zone='captured';victim.capturedBy='black';
        assert.equal(checked(capturedBoard,effects,'black'),false,`g4xf3 en passant preserves Black royal safety ${n}`);
      }
      for(const p of pieces.filter(p=>p.zone==='board'&&p.owner===capturing&&p.role==='pawn'&&geometry(p,ep[0]!.target,pieces,effects,true)))assert.equal(legalDests(prospective).get(p.square!)?.includes(ep[0]!.target)??false,epCaptures.includes(p));
    }
  }
  assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,15);
  assert.equal(state.fen,'1n3k1r/2p2Pb1/2Bq3p/Q1PP1n2/P1N2P2/3R2p1/1P2P1Pp/RN2KB1p w - - 1 28');
  replayTrace(trace);
});
