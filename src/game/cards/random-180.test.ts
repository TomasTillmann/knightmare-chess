import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';

// Reviewed against rules §§8–11,13.7/9/11,17.1,19.1,20,22.8 and all eleven printed artworks.
const rationales = `
1 Nc3: b1-c3 is an empty Knight landing.
2 Black receives the turn after Nc3; no card or board change.
3 g7-g6 advances the black Pawn one empty square.
4 White receives the turn after g6.
5 a2-a4 crosses empty a3; no black Pawn can capture en passant.
6 Black receives the turn with the a3 opportunity retained.
7 b7-b6 advances one square and expires a3.
8 White receives the turn after b6.
9 f2-f3 advances one empty square.
10 White Treason swaps opposing a8 Rook and g8 Knight after f3; identities and clocks persist.
11 Black receives the turn after the Treason swap.
12 h7-h5 crosses empty h6; no white Pawn can capture en passant.
13 White receives the turn with h6 retained.
14 Dubbing replaces White's move: f3-e5 is a noncapturing Knight jump; the mover stays a Pawn.
15 Black receives the turn after the replacement move.
16 f7-f6 advances the black Pawn one square.
17 White receives the turn after f6.
18 g2-g3 advances the white Pawn one square.
19 Black receives the turn after g3.
20 Rg8-g7 moves one square and revokes the original a8 Rook's remaining right.
21 White receives the turn after Rg7.
22 e2-e3 advances one empty square.
23 White plays Truce after e3; both Kings are free of raw attacks, so the card remains active.
24 Black receives the turn under Truce.
25 Nb8-c6 jumps to an empty square; Truce permits noncaptures.
26 White receives the turn after Nc6.
27 h2-h3 advances one empty square under Truce.
28 Black receives the turn after h3.
29 g6-g5 advances one empty square under Truce.
30 White receives the turn after g5.
31 Bf1-g2 moves one diagonal square to an empty destination.
32 Black receives the turn after Bg2.
33 Bc8-a6 crosses empty b7 to empty a6; Bog's response record preserves the previous FEN.
34 White receives the turn after Ba6.
35 Bg2-f1 returns diagonally to an empty square.
36 Black receives the turn after Bf1.
37 Rg7-g6 advances one empty square.
38 White receives the turn after Rg6.
39 h3-h4 advances one empty square.
40 White Siege exchanges its c3 Knight and h1 Rook after h4; neither is a capture or arrival move.
41 Black receives the turn after Siege.
42 d7-d6 advances one empty square.
43 White receives the turn after d6.
44 Bf1-e2 moves diagonally to the vacated e2 square.
45 Black receives the turn after Be2.
46 Ke8-d7 moves to an unattacked neighboring square and loses Black's castling rights.
47 White receives the turn after Kd7.
48 e3-e4 advances one empty square.
49 Black receives the turn after e4.
50 Passing in the Night replaces Black's move, simultaneously exchanging a7/e4 and f6/g3 Pawns without promotion or capture.
51 White receives the turn after the four-Pawn swap.
52 Rc3-d3 moves one empty square and loses the original h1 Rook's castling right.
53 Black receives the turn after Rd3.
54 Rh8-g8 moves one empty square; Black already has no castling rights.
55 White receives the turn after Rg8.
56 c2-c3 advances one square into the Rook's vacated square.
57 Black receives the turn after c3.
58 d6-d5 advances one empty square.
59 White receives the turn after d5.
60 Qd1-c2 moves one diagonal square to an empty destination.
61 Black receives the turn after Qc2.
62 Bf8-h6 crosses empty g7; Bog has an immediate long-slider response window.
63 White receives the turn after Bh6.
64 Rd3-f3 crosses empty e3 to empty f3.
65 Black receives the turn after Rf3.
66 Qd8-c8 moves horizontally to the empty adjacent square.
67 Black seals Man-Trap on friendly Pawn square b6 after Qc8; the card stays beside the board.
68 White receives the turn with the b6 trap and Truce retained.
69 Ke1-d1 moves to a safe adjacent square and loses White's final castling right.
70 Black receives the turn after Kd1.
71 The black a7 Pawn now on e4 advances to e3 without capture.
72 White receives the turn after e3.
73 Onslaught moves a4-a5,b2-b3,d2-d3,e5-e6 simultaneously to initially empty squares. Pe6 checks Kd7 and ends Truce; Kd8 is an ordinary escape, so no direct mate.
74 Black receives the turn in Pawn check and may cure it under §11.6.
75 Ba6-c4 crosses empty b5 while Pe6 still checks Kd7; held Cowardice e6-e4 through empty e5 is the concrete same-turn cure.
76 Black spends Cowardice after its Bishop move, pulling Pe6 back through empty e5 to e4, removing the Pawn check.
77 White's immediate Vulture takes that physical black Cowardice, discards its top Riposte, spends Vulture and draws Think Again.
78 White receives the turn with both reaction allowances reset.
79 Bc1xe3 crosses empty d2 and captures the black a7 Pawn.
80 Black receives the turn after Bxe3.
81 Nc6-d4 is an empty Knight landing.
82 White receives the turn after Nd4.
83 Nh1xg3 captures the relocated black f7 Pawn by Knight geometry.
84 Black receives the turn after Nxg3.
85 Bc4xd3 captures the white d2 Pawn by one diagonal step.
86 White Think Again cancels Bxd3, restores the Pawn and Bishop and clocks, and forbids the exact physical capture during Black's replacement opportunity.
87 d5xe4 captures the white f2 Pawn by a different move and clears the canceled-capture prohibition.
88 White receives the turn after dxe4.
89 Rf3-f2 moves one empty square.
90 Black receives the turn after Rf2.
91 e7xf6 captures the white g2 Pawn one square diagonally forward.
92 White receives the turn after exf6.
93 Rf2xf6 crosses empty f3,f4,f5 and captures the black e7 Pawn.
94 Black receives the turn after Rxf6.
95 Bc4-e6 crosses empty d5 to e6; Bog may react to this long Bishop move.
96 White receives the turn after Be6.
97 Kd1-d2 moves to an unattacked adjacent square.
98 Black receives the turn after Kd2.
99 Kd7-e8 moves diagonally to an unattacked square.
100 White receives the turn after Ke8.
101 Ng3-f1 is an empty Knight landing.
102 Black receives the turn after Nf1.
103 Be6-d5 moves one empty diagonal square.
104 White receives the turn after Bd5.
105 a5xb6 captures Black's b7 Pawn, then Black's b6 Man-Trap captures the arriving white a2 Pawn; both captors and the trap discard are distinct.
106 Black Revenge responds to its Pawn's ordinary capture, taking white h4 Pawn while retaining the completed double-capture move.
107 Black receives the turn after Revenge; its own next-turn allowance is fresh.
108 Bd5-c6 moves one empty diagonal square.
109 White receives the turn after Bc6.
110 Ra1-d1 crosses empty b1,c1 to empty d1.
111 Black receives the turn after Rd1.
112 h5-h4 advances to the square emptied by Revenge.
113 White receives the turn after h4; no pending choices or checks remain.
`.trim().split('\n');

const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white';
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1])] as const;
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.square === square && p.zone === 'board');
function geometry(pieces: PieceState[], p: PieceState, to: string, capture: boolean): boolean {
  assert.ok(p.square);
  const [x,y] = xy(p.square), [u,v] = xy(to), dx = u-x, dy = v-y;
  const ax = Math.abs(dx), ay = Math.abs(dy), d = p.owner === 'white' ? 1 : -1;
  if (p.role === 'knight') return ax*ay === 2;
  if (p.role === 'king') return Math.max(ax,ay) === 1;
  if (p.role === 'pawn') return capture ? ax === 1 && dy === d : dx === 0 && (dy === d || dy === 2*d && y === (d === 1 ? 2 : 7) && !at(pieces, `${String.fromCharCode(97+x)}${y+d}`));
  const aligned = p.role === 'bishop' ? ax === ay : p.role === 'rook' ? dx === 0 || dy === 0 : ax === ay || dx === 0 || dy === 0;
  if (!aligned || !Math.max(ax,ay)) return false;
  for (let n=1;n<Math.max(ax,ay);n++) if (at(pieces,`${String.fromCharCode(97+x+n*Math.sign(dx))}${y+n*Math.sign(dy)}`)) return false;
  return true;
}
function rawCheck(pieces: PieceState[], color: Color): boolean {
  const king = pieces.find(p => p.owner === color && p.royal)!;
  assert.ok(king.square);
  return pieces.some(p => p.zone === 'board' && p.owner !== color && geometry(pieces,p,king.square!,true));
}
function boardFen(pieces: PieceState[]): string {
  const roles = { pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k' };
  return Array.from({length:8},(_,i)=>{
    let text='', empty=0;
    for (let f=0;f<8;f++) {const p=at(pieces,`${String.fromCharCode(97+f)}${8-i}`); if(!p){empty++;continue;} if(empty){text+=empty;empty=0;} const r=roles[p.role];text+=p.owner==='white'?r.toUpperCase():r;}
    return text+(empty||'');
  }).join('/');
}
function immutable(state: GameState, action: GameAction): GameState {
  const snapshot = structuredClone(state), payload=structuredClone(action), result=applyAction(state,action);
  assert.deepEqual(state,snapshot,'input immutability');assert.deepEqual(action,payload,'action immutability'); assert.ok(result.ok,JSON.stringify(action)); return result.state;
}

test('iteration 180 independent action, board, cards, history, FEN and royal oracle', () => {
  const trace=JSON.parse(readFileSync(new URL('../../../campaign/iterations/180.json',import.meta.url),'utf8')) as RandomTrace;
  assert.equal(trace.steps.length,113); assert.equal(rationales.length,113);
  let actual=createGameState(trace.initial), expected=structuredClone(actual), rollback: GameState | undefined;
  const cardSteps: Record<number,[Color,string,unknown]> = {
    10:['white','white-hand-1-treason',{rook:'a8',knight:'g8'}],14:['white','white-hand-0-dubbing',[{from:'f3',to:'e5'}]],
    23:['white','white-deck-0-truce',undefined],40:['white','white-hand-2-siege',{knight:'c3',rook:'h1'}],
    50:['black','black-hand-1-passing-in-the-night',[{from:'a7',to:'e4'},{from:'f6',to:'g3'}]],67:['black','black-hand-4-man-trap','b6'],
    73:['white','white-hand-4-onslaught',[{from:'a4',to:'a5'},{from:'b2',to:'b3'},{from:'d2',to:'d3'},{from:'e5',to:'e6'}]],
    76:['black','black-hand-3-cowardice',[{from:'e6',to:'e4'}]],77:['white','white-deck-4-vulture',undefined],
    86:['white','white-deck-6-think-again',undefined],106:['black','black-hand-2-revenge','h4'],
  };
  for (const [index,{action}] of trace.steps.entries()) {
    const step=index+1, why=rationales[index]; assert.ok(why.startsWith(`${step} `));
    const before=structuredClone(expected), input=actual, actor=expected.turn.color;
    let fields=expected.fen.split(' '), moved: string[]=[], pawnMove=false, captured=false, regular=false;
    const shift=(from: string,to: string) => {const p=at(expected.pieces,from);assert.ok(p,why);p.square=to as SquareName; moved.push(p.id);return p;};
    const take=(p: PieceState,by: Color) => {assert.equal(p.royal,false);p.zone='captured';p.square=null;p.capturedBy=by;};
    if(action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from=action.from,to=action.to,p=at(expected.pieces,from),victim=at(expected.pieces,to);assert.ok(p,why);
      assert.equal(expected.turn.moveMade,false);assert.equal(p.owner,actor);assert.ok(geometry(expected.pieces,p,to,!!victim),why);
      if(victim){assert.equal(victim.owner,opposite(actor));assert.ok(!expected.effects.some(e=>(e as {type:string}).type==='truce'));take(victim,actor);captured=true;}
      pawnMove=p.role==='pawn'; shift(from,to); regular=true;
      expected.enPassant=pawnMove&&Math.abs(xy(to)[1]-xy(from)[1])===2?[{target:`${from[0]}${(xy(to)[1]+xy(from)[1])/2}` as SquareName,pawnId:p.id}]:[];
      const event: GameEvent={type:'move',from:from as SquareName,to:to as SquareName,...(victim?{capturedId:victim.id}:{})};
      if([33,62,75,95].includes(step))event.previousFen=before.fen;
      if(step===105){assert.equal(p.id,'white-pawn-a2');take(p,'black');event.movedPieceId=p.id;expected.effects=[];expected.players.black.discard.push({id:'black-hand-4-man-trap',cardId:'man-trap'});}
      expected.history.push(event);
      if(step===85)rollback=before;
      delete expected.chaosForbidden;
    } else if(action.type==='playCard') {
      const [owner,id,target]=cardSteps[step]!;assert.equal(action.cardInstanceId,id);assert.deepEqual(action.target,target);
      const player=expected.players[owner],ci=player.hand.findIndex(c=>c.id===id);assert.ok(ci>=0);const card=player.hand[ci]!;assert.equal(action.cardId,card.cardId);
      assert.equal(expected.turn.cardPlays[owner],0);
      const replacement=[14,50,73].includes(step);assert.equal(expected.turn.moveMade,!replacement);
      assert.equal(owner,[77,86,106].includes(step)?opposite(actor):actor);
      if(step===77){assert.equal(expected.history.at(-1)?.cardId,'cowardice');player.discard.push(player.deck.shift()!);}
      player.hand.splice(ci,1);if(![23,67].includes(step))player.discard.push(card);player.hand.push(player.deck.shift()!);expected.turn.cardPlays[owner]++;
      const event: GameEvent={type:'cardPlayed',cardId:card.cardId,...(target!==undefined&&step!==67?{target:target as GameEvent['target']} : {}),movement:[],preservePreviousMove:!replacement};
      if([77,86].includes(step))event.player=owner;
      if(step===10||step===40){const a=step===10?'a8':'c3',b=step===10?'g8':'h1',p=at(expected.pieces,a)!,q=at(expected.pieces,b)!;assert.equal(p.owner,step===10?'black':'white');assert.equal(q.owner,p.owner);assert.deepEqual([p.role,q.role],step===10?['rook','knight']:['knight','rook']);p.square=b;q.square=a;event.movement=[{from:a,to:b},{from:b,to:a}];}
      if(step===14){assert.equal(at(expected.pieces,'e5'),undefined);assert.equal(xy('f3')[0]-xy('e5')[0],1);shift('f3','e5');event.movement=[{from:'f3',to:'e5'}];pawnMove=true;}
      if(step===23)expected.effects.push({type:'truce',owner,card});
      if(step===50){for(const [a,b] of [['a7','e4'],['f6','g3']] as const){const p=at(expected.pieces,a)!,q=at(expected.pieces,b)!;assert.equal(p.role,'pawn');assert.equal(q.role,'pawn');assert.equal(p.owner,'black');assert.equal(q.owner,'white');p.square=b;q.square=a;}event.movement=[{from:'e4',to:'a7'},{from:'g3',to:'f6'},{from:'a7',to:'e4'},{from:'f6',to:'g3'}];pawnMove=true;}
      if(step===67){assert.equal(at(expected.pieces,'b6')!.owner,'black');expected.effects.push({type:'man-trap',owner,card,square:'b6'});}
      if(step===73){for(const [a,b] of [['a4','a5'],['b2','b3'],['d2','d3'],['e5','e6']] as const){assert.equal(at(before.pieces,b),undefined);assert.equal(at(before.pieces,a)!.owner,'white');assert.equal(at(before.pieces,a)!.role,'pawn');shift(a,b);event.movement!.push({from:a,to:b});}pawnMove=true;expected.effects=expected.effects.filter(e=>(e as {type:string}).type!=='truce');player.discard.push({id:'white-deck-0-truce',cardId:'truce'});}
      if(step===76){assert.equal(at(expected.pieces,'e5'),undefined);assert.equal(at(expected.pieces,'e4'),undefined);assert.equal(at(expected.pieces,'e6')!.owner,'white');shift('e6','e4');event.movement=[{from:'e6',to:'e4'}];}
      if(step===77){const stolen=expected.players.black.discard.pop()!;assert.equal(stolen.id,'black-hand-3-cowardice');player.hand.push(stolen);}
      if(step===86){assert.ok(rollback);expected.pieces=structuredClone(rollback.pieces);expected.enPassant=structuredClone(rollback.enPassant);fields=rollback.fen.split(' ');expected.history=structuredClone(rollback.history);expected.turn.phase='beforeMove';expected.turn.moveMade=false;delete expected.shieldMove;expected.chaosForbidden={player:'black',movement:'black-bishop-c8:c4:d3|white-pawn-d2:d3:captured'};event.movement=[{from:'d3',to:'c4'}];}
      if(step===106){assert.equal(expected.history.at(-1)?.capturedId,'black-pawn-b7');const p=at(expected.pieces,'h4')!;assert.equal(p.owner,'white');assert.equal(p.role,'pawn');take(p,'black');event.capturedId=p.id;}
      expected.history.push(event);regular=replacement;if(replacement)expected.enPassant=[];
    } else {
      assert.equal(action.type,'endTurn');assert.ok(expected.turn.moveMade);assert.equal(rawCheck(expected.pieces,actor),false,why);
      expected.turn={color:opposite(actor),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};delete expected.shieldMove;
    }
    if(regular){fields[1]=actor==='white'?'b':'w';fields[4]=pawnMove||captured?'0':String(Number(fields[4])+1);fields[5]=String(Number(fields[5])+(actor==='black'?1:0));expected.turn.phase='afterMove';expected.turn.moveMade=true;expected.shieldMove={player:actor,pieceIds:moved,capturedOpponent:captured};}
    const rights: Record<number,string>={10:'KQka',20:'KQk',40:'HQk',46:'HQ',52:'Q',69:'-'};if(rights[step])fields[2]=rights[step];
    fields[0]=boardFen(expected.pieces);fields[3]='-';expected.fen=fields.join(' ');
    actual=immutable(actual,action);
    assert.deepEqual(actual.pieces,expected.pieces,why);assert.deepEqual(actual.players,expected.players,why);assert.deepEqual(actual.history,expected.history,why);
    assert.equal(actual.fen,expected.fen,why);assert.deepEqual(actual.turn,expected.turn,why);assert.deepEqual(actual.effects,expected.effects,why);assert.deepEqual(actual.enPassant,expected.enPassant,why);
    assert.deepEqual(actual.shieldMove,expected.shieldMove,why);assert.deepEqual(actual.chaosForbidden,expected.chaosForbidden,why);
    for(const key of ['plotsExecution','riposteSkipped','riposteCheckDeferred'] as const)assert.equal(actual[key],undefined,why);
    for(const key of ['plotsAllowances','fogLocked','riposteLostMoves','underElfHill'] as const)assert.deepEqual(actual[key]??[],[],why);
    assert.equal(actual.pendingAbduction??null,null);assert.equal(actual.pendingDoomsayer??null,null);assert.equal(actual.orientation,0);assert.equal(actual.outcome,null);
    for(const c of ['white','black'] as const){const raw=rawCheck(expected.pieces,c),snapshot=structuredClone(actual);assert.equal(isKingInCheck(actual,c),raw,why);assert.deepEqual(actual,snapshot,'royal query immutability');assert.equal(raw,c==='black'&&[73,74,75].includes(step),why);}
    assert.equal(!!actual.pendingRescue,step===75,why);
    if(step===73){const escape=structuredClone(expected.pieces),king=at(escape,'d7')!;assert.equal(at(escape,'d8'),undefined);assert.ok(geometry(escape,king,'d8',false));king.square='d8';assert.equal(rawCheck(escape,'black'),false,'Onslaught gives check but permits Kd8, so it does not directly mate');}
    if(step===74){const escapePieces=structuredClone(expected.pieces);at(escapePieces,'d7')!.square='d8';assert.equal(rawCheck(escapePieces,'black'),false);const escaped=immutable(actual,{type:'move',from:'d7',to:'d8'});assert.deepEqual(escaped.pieces,escapePieces);assert.deepEqual(escaped.players,expected.players);assert.deepEqual(escaped.effects,expected.effects);assert.equal(escaped.pendingRescue??null,null);assert.deepEqual(escaped.enPassant,[]);assert.equal(escaped.fen,`${boardFen(escapePieces)} w - - 1 19`);assert.deepEqual(escaped.history,[...expected.history,{type:'move',from:'d7',to:'d8'}]);assert.deepEqual(escaped.turn,{color:'black',phase:'afterMove',moveMade:true,cardPlays:{white:0,black:0}});const ended=immutable(escaped,{type:'endTurn'});assert.deepEqual(ended.pieces,escapePieces);assert.deepEqual(ended.players,expected.players);assert.deepEqual(ended.history,escaped.history);assert.deepEqual(ended.effects,expected.effects);assert.equal(ended.fen,escaped.fen);assert.deepEqual(ended.turn,{color:'white',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}});}
    if(step===75){const p=actual.pendingRescue!;assert.deepEqual(p.before,input);assert.equal(p.fen,before.fen);assert.deepEqual(p.pieces,before.pieces);assert.deepEqual(p.enPassant,before.enPassant);assert.equal(p.historyLength,before.history.length);assert.deepEqual(p.movedPieceIds,['black-bishop-c8']);
      const cure=immutable(actual,{type:'playCard',cardId:'cowardice',cardInstanceId:'black-hand-3-cowardice',target:[{from:'e6',to:'e4'}]});
      const curedPieces=structuredClone(expected.pieces);at(curedPieces,'e6')!.square='e4';assert.deepEqual(cure.pieces,curedPieces);assert.equal(rawCheck(curedPieces,'black'),false);
      const curedPlayers=structuredClone(expected.players),cp=curedPlayers.black;const held=cp.hand.splice(cp.hand.findIndex(c=>c.id==='black-hand-3-cowardice'),1)[0]!;cp.discard.push(held);cp.hand.push(cp.deck.shift()!);assert.deepEqual(cure.players,curedPlayers);
      const cureHistory=[...expected.history,{type:'cardPlayed',cardId:'cowardice',target:[{from:'e6',to:'e4'}],movement:[{from:'e6',to:'e4'}],preservePreviousMove:true}];assert.deepEqual(cure.history,cureHistory);assert.equal(cure.pendingRescue??null,null);assert.deepEqual(cure.effects,expected.effects);assert.deepEqual(cure.enPassant,[]);assert.deepEqual(cure.shieldMove,expected.shieldMove);
      assert.equal(cure.fen,`${boardFen(curedPieces)} w - - 1 19`);assert.deepEqual(cure.turn,{color:'black',phase:'afterMove',moveMade:true,cardPlays:{white:0,black:1}});
      const ended=immutable(cure,{type:'endTurn'});assert.deepEqual(ended.pieces,curedPieces);assert.deepEqual(ended.players,curedPlayers);assert.deepEqual(ended.history,cureHistory);assert.equal(ended.fen,cure.fen);assert.deepEqual(ended.effects,cure.effects);assert.deepEqual(ended.enPassant,[]);assert.equal(ended.shieldMove,undefined);assert.deepEqual(ended.turn,{color:'white',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}});
    }
    if(step===86){const snapshot=structuredClone(actual),repeat=applyAction(actual,{type:'move',from:'c4',to:'d3'});assert.equal(repeat.ok,false);assert.deepEqual(actual,snapshot);assert.ok(!legalDests(actual,false).get('c4')?.includes('d3'));assert.deepEqual(actual,snapshot);}
    for(const ep of expected.enPassant){const victim=expected.pieces.find(p=>p.id===ep.pawnId)!,c=opposite(victim.owner),probe=structuredClone(actual);probe.turn={color:c,phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};probe.fen=probe.fen.split(' ').map((v,i)=>i===1?(c==='white'?'w':'b'):v).join(' ');const snapshot=structuredClone(probe),dests=legalDests(probe,false);assert.deepEqual(probe,snapshot);
      for(const p of expected.pieces.filter(p=>p.owner===c&&p.role==='pawn'&&p.square)){const possible=geometry(expected.pieces,p,ep.target,true)&&xy(p.square!)[1]===xy(victim.square!)[1];assert.equal(possible,false,'a3/h6 have no adjacent enemy captor');assert.ok(!dests.get(p.square!)?.includes(ep.target));}
    }
  }
  assert.equal(trace.steps.filter(s=>s.action.type==='move').length,50);assert.equal(Object.keys(cardSteps).length,11);assert.equal(actual.fen,'n1q1k1r1/P1p5/2b2Rrb/6p1/3np2p/1PPPB3/2QKB3/3R1NN1 w - - 0 27');
});

test('iteration 180 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/180.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(replayTrace(trace));
});
