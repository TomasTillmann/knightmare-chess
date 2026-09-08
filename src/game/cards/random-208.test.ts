import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyAction, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameState, PieceState, SquareName } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Independently reviewed in sequence against rules §§8–13,16.3,18.3,18.5,20,21,22.2
// and the ten physical card images. No expectation below comes from trace hashes.
const rationale = `
1 Nb1-c3 jumps to an empty square.
2 White closes the completed knight move.
3 Assassin moves Bc8xb7 diagonally, capturing Black's own pawn instead of the move.
4 Black closes Assassin; its card allowance resets.
5 g2-g3 is a quiet single pawn advance.
6 White closes g3.
7 Bb7-f3 crosses empty c6,d5,e4.
8 Black closes Bf3.
9 g3-g4 advances into empty g4.
10 White closes g4.
11 e7-e6 advances one rank.
12 Black closes e6.
13 Ra1-b1 enters the vacated knight square; White loses queenside castling.
14 White closes Rb1.
15 d7-d6 advances one rank.
16 Black closes d6.
17 g4-g5 advances one rank.
18 White closes g5.
19 Ng8-e7 jumps to the vacated pawn square.
20 Black closes Ne7.
21 Bf1-g2 enters the vacated pawn square.
22 White closes Bg2.
23 Masquerade sends Ra8-d5 along empty b7,c6 as a Queen without capture; queenside rights expire.
24 Black closes the replacement move.
25 Nc3-e4 jumps into empty e4.
26 White closes Ne4.
27 Bf3-h5 crosses empty g4.
28 Dungeon relocates the opposing e2 pawn to empty a1 after Black's move; no promotion.
29 White starts its one-turn prohibition on moving the e2 pawn.
30 d2-d3 moves an unrestricted pawn.
31 White closes d3; Dungeon expires.
32 Ne7-c6 jumps to empty c6.
33 Black closes Nc6.
34 g5-g6 advances into empty g6.
35 White closes g6.
36 Bh5xg6 captures White's g2 pawn; Black is the captor.
37 Black closes the bishop capture.
38 Bc1-d2 enters the vacated pawn square.
39 Mystic Shield protects the just-moved c1 bishop through Black's next turn.
40 White closes Bd2; protection remains.
41 h7-h5 crosses empty h6; no White pawn can capture en passant.
42 Black closes h5; Mystic Shield expires.
43 Bd2-c3 enters empty c3; the old en-passant opportunity expires.
44 White closes Bc3.
45 Bg6-f5 is a diagonal step.
46 Black closes Bf5.
47 Rb1-c1 enters the vacated bishop square.
48 White closes Rc1.
49 Bf5-h3 crosses empty g4.
50 Black closes Bh3.
51 Irresistible Force pushes a2-a3 and advances the former e2 pawn a1-a2, instead of the move.
52 White closes the two-pawn push.
53 Fanatic advances f7-f4 across empty f6,f5,f4; it creates no en-passant right.
54 Black closes Fanatic.
55 Ke1-e2 enters a safe empty square; all White castling rights expire.
56 White closes Ke2.
57 Rh8-h7 enters an empty square; Black's remaining castling right expires.
58 Panic is played after Rh7 and gives White a 15-second next-move obligation.
59 White starts its timed turn.
60 White forfeits its safe turn on Panic timeout; only the halfmove clock advances.
61 Rh7-h8 moves back without restoring castling.
62 Black closes Rh8.
63 Bc3-d4 enters empty d4.
64 White closes Bd4.
65 Nb8-d7 jumps to the vacated pawn square.
66 Black closes Nd7.
67 Bg2-f3 enters empty f3.
68 White closes Bf3.
69 Bh3-f5 crosses empty g4.
70 Black closes Bf5.
71 Bd4-e3 enters empty e3.
72 White closes Be3.
73 g7-g6 advances one rank.
74 Black closes g6.
75 Ke2-e1 returns to a safe square; castling remains unavailable.
76 White closes Ke1.
77 Qd8-e7 is a diagonal step.
78 Black closes Qe7.
79 Bf3-e2 enters empty e2.
80 White closes Be2.
81 Blessing sends Rh8-e5 through empty g7,f6, without capture, instead of the move.
82 Black closes the replacement move.
83 Be2-f3 enters empty f3.
84 White closes Bf3.
85 Nc6-b4 jumps to empty b4.
86 Black closes Nb4.
87 a3-a4 advances one rank.
88 White closes a4.
89 Rd5-b5 crosses empty c5.
90 Black closes Rb5.
91 h2-h4 crosses empty h3; no Black pawn can capture en passant.
92 White closes h4.
93 Rb5-b8 crosses empty b6,b7 and clears the old en-passant opportunity.
94 Black closes Rb8.
95 b2-b3 advances into empty b3.
96 White closes b3.
97 Re5-b5 crosses empty d5,c5.
98 Black closes Rb5.
99 Be3xa7 crosses empty d4,c5,b6 and captures Black's a7 pawn.
100 White closes Bxa7.
101 Qe7-d8 enters empty d8.
102 Black closes Qd8.
103 Ke1-f1 enters a safe empty square.
104 White closes Kf1.
105 Winged Victory returns the captured a7 pawn to empty central d4; placement consumes the move but moves no board identity.
106 Black closes the pawn return.
107 Ne4-f6 gives knight check against e8.
108 White closes Nf6; Black receives a check-response turn.
109 Rb8-b6 leaves Black in knight check provisionally; held Rebirth can return Nf6 to empty b1 and cure it.
110 Rebirth d3-d2 fails to cure Nf6's check; spend the card, restore the rook move and its clocks, retain Black's ordinary response move.
111 Nd7xf6 captures the checking knight and replaces the inert rook movement token.
112 Black closes Nxf6 with both Kings safe.
113 Ba7-c5 crosses empty b6.
114 White closes Bc5.
115 c7-c6 advances one rank.
116 Black closes c6; all 50 move commands and intervening actions are accounted for.
`.trim().split('\n');

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/208.json', import.meta.url), 'utf8')) as RandomTrace;
const other = (c: Color): Color => c === 'white' ? 'black' : 'white';
const square = (s: string): SquareName => { assert.match(s, /^[a-h][1-8]$/); return s as SquareName; };
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
function reaches(pieces: PieceState[], piece: PieceState, to: string, capture: boolean): boolean {
  const [x,y] = xy(piece.square!), [u,v] = xy(to), dx = u-x, dy=v-y;
  if (!dx && !dy) return false;
  if (piece.role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2;
  if (piece.role === 'king') return Math.max(Math.abs(dx),Math.abs(dy)) === 1;
  if (piece.role === 'pawn') {
    const d = piece.owner === 'white' ? 1 : -1;
    if (capture) return Math.abs(dx) === 1 && dy === d;
    if (dx || (dy !== d && !(dy === 2*d && (piece.owner === 'white' ? y <= 1 : y >= 6)))) return false;
  } else if (!(piece.role !== 'bishop' && (dx === 0 || dy === 0) || piece.role !== 'rook' && Math.abs(dx) === Math.abs(dy))) return false;
  const n = Math.max(Math.abs(dx),Math.abs(dy));
  for (let i=1;i<n;i++) if (pieces.some(p => p.zone === 'board' && p.square === `${String.fromCharCode(97+x+Math.sign(dx)*i)}${y+Math.sign(dy)*i+1}`)) return false;
  return true;
}
function checked(pieces: PieceState[], color: Color): boolean {
  const king = pieces.find(p => p.royal && p.owner === color)!;
  return pieces.some(p => p.zone === 'board' && p.owner !== color && reaches(pieces,p,king.square!,true));
}
function placement(pieces: PieceState[]): string {
  const letters = {pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'};
  return Array.from({length:8},(_,r) => {
    let line='',empty=0;
    for(let f=0;f<8;f++) {
      const p=pieces.find(p=>p.zone==='board' && p.square===`${String.fromCharCode(97+f)}${8-r}`);
      if(!p) {empty++;continue;}
      if(empty) line+=empty; empty=0;
      line+=p.owner==='white'?letters[p.role].toUpperCase():letters[p.role];
    }
    return line+(empty||'');
  }).join('/');
}
function immutable(state: GameState, action: GameAction): GameState {
  const original=structuredClone(state), command=structuredClone(action);
  const result=applyAction(state,action);
  assert.deepEqual(state,original,'input GameState'); assert.deepEqual(action,command,'input GameAction');
  assert.ok(result.ok,JSON.stringify(action)); return result.state;
}
function noObligations(state: GameState) {
  for(const key of ['chaosForbidden','plotsExecution','riposteSkipped','riposteCheckDeferred'] as const)assert.equal(state[key],undefined,key);
  for(const key of ['plotsAllowances','fogLocked','riposteLostMoves','underElfHill'] as const)assert.deepEqual(state[key]??[],[],key);
  for(const key of ['pendingAbduction','pendingDoomsayer','outcome'] as const)assert.equal(state[key]??null,null,key);
  assert.equal(state.orientation,0);
}

test('iteration 208 independently accounts for every physical transition', () => {
  assert.equal(trace.seed,860208); assert.equal(rationale.length,116); assert.equal(trace.steps.length,rationale.length);
  let state=createGameState(trace.initial), expected=structuredClone(state);
  let active: Color='white', rights='KQkq', half=0, full=1;
  let checkpoint: GameState | undefined;
  const played: NonNullable<GameState['playedCards']>=[];
  for (const [index,step] of trace.steps.entries()) {
    const n=index+1, action=step.action, before=structuredClone(state), actor=expected.turn.color;
    assert.ok(rationale[index]!.startsWith(`${n} `));
    const at=(s:string) => expected.pieces.find(p=>p.zone==='board' && p.square===s)!;
    const relocate=(from:string,to:string) => { const p=at(from);assert.ok(p);p.square=square(to);return p; };
    let reset=false, advance=false;
    if(action.type==='move') {
      assert.ok(typeof action.from==='string' && typeof action.to==='string');
      const from=action.from,to=action.to,p=at(from),victim=at(to);
      assert.equal(expected.turn.moveMade,false);assert.equal(p.owner,actor);
      assert.ok(reaches(expected.pieces,p,to,!!victim),`${n}: independent geometry`);
      assert.ok(!victim || victim.owner!==actor);assert.ok(!victim?.royal);
      if(n===109) checkpoint=structuredClone(expected);
      const event: GameState['history'][number]={type:'move',from:square(from),to:square(to)};
      if(victim) {event.capturedId=victim.id;victim.square=null;victim.zone='captured';victim.capturedBy=actor;}
      if([109,111,115].includes(n)) {event.movedPieceId=p.id;event.movedRoles=[p.role];}
      expected.history.push(event);relocate(from,to);
      if(p.royal) rights=rights.replace(actor==='white'?/[KQ]/g:/[kq]/g,'');
      for(const [s,r] of [['a1','Q'],['h1','K'],['a8','q'],['h8','k']]) if(from===s && p.role==='rook')rights=rights.replace(r!,'');
      expected.enPassant=p.role==='pawn' && Math.abs(Number(from[1])-Number(to[1]))===2 ? [{target:square(`${from[0]}${(Number(from[1])+Number(to[1]))/2}`),pawnId:p.id}]:[];
      expected.shieldMove={player:actor,pieceIds:[p.id],capturedOpponent:!!victim};
      reset=p.role==='pawn'||!!victim;advance=true;
    } else if(action.type==='playCard') {
      const plans: Record<number,[string,string,unknown,boolean]>={
        3:['assassin','black-hand-4-assassin',[{from:'c8',to:'b7'}],true],
        23:['masquerade','black-hand-1-masquerade',[{from:'a8',to:'d5'}],true],
        28:['dungeon','black-hand-2-dungeon',[{from:'e2',to:'a1'}],false],
        39:['mystic-shield','white-hand-2-mystic-shield','d2',false],
        51:['irresistible-force','white-hand-4-irresistible-force',[{from:'a1',to:'a2'}],true],
        53:['fanatic','black-deck-2-fanatic','f7',true],58:['panic','black-hand-0-panic',undefined,false],
        81:['blessing','black-deck-4-blessing',[{from:'h8',to:'e5'}],true],
        105:['winged-victory','black-deck-1-winged-victory',{pieceId:'black-pawn-a7',to:'d4'},true],
        110:['rebirth','black-deck-0-rebirth',[{from:'d3',to:'d2'}],false],
      };
      const [id,instance,target,replaces]=plans[n]!;
      assert.deepEqual(action,{type:'playCard',cardId:id,cardInstanceId:instance,...(target===undefined?{}:{target})});
      assert.equal(expected.turn.phase,replaces?'beforeMove':'afterMove');assert.equal(expected.turn.cardPlays[actor],0);
      const player=expected.players[actor],card=player.hand.find(c=>c.id===instance)!;assert.ok(card);assert.equal(card.cardId,id);
      player.hand=player.hand.filter(c=>c.id!==instance);player.discard.push(card);player.hand.push(player.deck.shift()!);
      expected.turn.cardPlays[actor]=1;played.push({player:actor,cardInstanceId:instance});
      let movement: Array<{from:SquareName;to:SquareName}>=[];
      const move=(from:string,to:string) => {movement.push({from:square(from),to:square(to)});return relocate(from,to);};
      if(n===3) {const victim=at('b7');victim.square=null;victim.zone='captured';victim.capturedBy='black';move('c8','b7');reset=true;}
      if(n===23) {assert.ok(reaches(expected.pieces,{...at('a8'),role:'queen'},'d5',false));move('a8','d5');rights=rights.replace('q','');}
      if(n===28) {assert.equal(at('a1'),undefined);move('e2','a1');expected.effects=[{type:'dungeon',owner:'black',player:'white',pieceId:'white-pawn-e2'}];}
      if(n===39) expected.effects=[{type:'mystic-shield',owner:'white',player:'white',pieceId:'white-bishop-c1'}];
      if(n===51) {assert.equal(at('a3'),undefined);move('a2','a3');move('a1','a2');reset=true;}
      if(n===53) {for(const s of ['f6','f5','f4'])assert.equal(at(s),undefined);move('f7','f4');reset=true;}
      if(n===58) expected.effects=[{type:'panic',owner:'black',player:'white',durationMs:15000}];
      if(n===81) {assert.ok(reaches(expected.pieces,{...at('h8'),role:'bishop'},'e5',false));move('h8','e5');}
      if(n===105) {const p=expected.pieces.find(p=>p.id==='black-pawn-a7')!;assert.equal(p.zone,'captured');assert.equal(p.capturedBy,'white');assert.equal(at('d4'),undefined);p.zone='board';p.square='d4';delete p.capturedBy;reset=true;}
      if(n===110) {
        const proposed=structuredClone(expected.pieces),pawn=proposed.find(p=>p.square==='d3')!;
        assert.equal(pawn.id,'white-pawn-d2');assert.equal(proposed.some(p=>p.square==='d2'),false);pawn.square='d2';
        assert.equal(checked(proposed,'black'),true,'Rebirth pawn relocation cannot remove the f6 knight check');
        assert.ok(checkpoint);expected.pieces=structuredClone(checkpoint.pieces);expected.history=structuredClone(checkpoint.history);
        expected.enPassant=[];half=1;full=27;active='black';expected.turn.phase='beforeMove';expected.turn.moveMade=false;
        expected.history.push({type:'cardFizzled',cardId:id,reason:'SELF_CHECK',movement:[],preservePreviousMove:false});
      } else {
        expected.history.push({type:'cardPlayed',cardId:id,...(target===undefined?{}:{target:target as GameState['history'][number]['target']}),movement,preservePreviousMove:!replaces,...(n===3?{capturedId:'black-pawn-b7'}:{}),...(n===39?{player:'white' as const}:{})});
      }
      expected.cardResponse={player:actor,historyLength:expected.history.length};
      if(replaces) {expected.enPassant=[];expected.shieldMove={player:actor,pieceIds:movement.map(m=>at(m.to).id),capturedOpponent:false};advance=true;}
    } else {
      assert.ok(action.type==='endTurn'||action.type==='panicTimeout');
      if(action.type==='panicTimeout') {assert.equal(n,60);assert.equal(checked(expected.pieces,actor),false);half++;active=other(actor);expected.enPassant=[];}
      else assert.equal(expected.turn.moveMade,true);
      expected.turn={color:other(actor),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      delete expected.shieldMove;
      delete expected.cardResponse;
      if([31,42,60].includes(n))expected.effects=[];
    }
    if(advance) {half=reset?0:half+1;if(actor==='black')full++;active=other(actor);expected.turn.phase='afterMove';expected.turn.moveMade=true;}
    expected.fen=`${placement(expected.pieces)} ${active[0]} ${rights||'-'} - ${half} ${full}`;
    state=immutable(state,action);
    for(const key of ['pieces','players','turn','effects','history','fen','enPassant','shieldMove','cardResponse'] as const)assert.deepEqual(state[key],expected[key],`${n}: ${key}`);
    assert.deepEqual(state.playedCards??[],played);
    noObligations(state);
    const queryBefore=structuredClone(state);
    for(const color of ['white','black'] as const) {
      const threat=checked(expected.pieces,color);
      assert.equal(threat,color==='black'&&n>=107&&n<=110,`${n}: independent royal status`);
      assert.equal(isKingInCheck(state,color),threat);
    }
    assert.deepEqual(state,queryBefore,'royal queries are immutable');
    if(n===42||n===92) {
      const prospective=structuredClone(state),saved=structuredClone(prospective);
      assert.equal(prospective.turn.phase,'beforeMove');assert.equal(prospective.turn.moveMade,false);
      const opportunity=expected.enPassant[0]!;
      const candidates=expected.pieces.filter(p=>p.zone==='board' && p.owner===prospective.turn.color && p.role==='pawn' && reaches(expected.pieces,p,opportunity.target,true));
      assert.deepEqual(candidates,[],'no adjacent prospective en-passant captor');
      const destinations=legalDests(prospective);
      for(const p of expected.pieces.filter(p=>p.zone==='board' && p.role==='pawn' && p.owner===prospective.turn.color))assert.equal(destinations.get(p.square!)?.includes(opportunity.target)??false,false);
      assert.deepEqual(prospective,saved,'prospective en-passant query is immutable');
    }
    if(n===109) {
      assert.deepEqual(state.pendingRescue,{before,fen:before.fen,pieces:before.pieces,enPassant:[],historyLength:before.history.length,movedPieceIds:['black-rook-a8']});
      rescue(state,expected);
    } else assert.equal(state.pendingRescue??null,null);
    if(n===110) {
      const probe=structuredClone(state);probe.turn.cardPlays.black=0;
      const held=probe.players.black.hand.find(c=>c.cardId==='cowardice')!;assert.ok(held);
      const unchanged=structuredClone(probe),command:GameAction={type:'playCard',cardId:'cowardice',cardInstanceId:held.id,target:[{from:'d3',to:'d2'}]};
      const commandBefore=structuredClone(command),rejected=applyAction(probe,command);assert.equal(rejected.ok,false);if(!rejected.ok)assert.equal(rejected.error.code,'INVALID_TIMING');assert.deepEqual(probe,unchanged);assert.deepEqual(command,commandBefore);
    }
  }
  assert.equal(trace.moves,50);assert.equal(trace.steps.filter(s=>s.action.type==='move').length,50);assert.equal(state.fen,trace.finalFen);
});

function rescue(state: GameState, expected: GameState) {
  const queryBefore=structuredClone(state),targets=cardPlayTargets(state,'rebirth');
  assert.ok(targets.some(target=>JSON.stringify(target)===JSON.stringify([{from:'f6',to:'b1'}])));
  assert.deepEqual(state,queryBefore,'rescue target query is immutable');
  const witness=structuredClone(expected);
  const knight=witness.pieces.find(p=>p.id==='white-knight-b1')!;
  assert.equal(knight.square,'f6');assert.equal(witness.pieces.some(p=>p.square==='b1'),false);knight.square='b1';
  const card=witness.players.black.hand.find(c=>c.id==='black-deck-0-rebirth')!;assert.ok(card);
  witness.players.black.hand=witness.players.black.hand.filter(c=>c.id!==card.id);
  witness.players.black.discard.push(card);witness.players.black.hand.push(witness.players.black.deck.shift()!);
  witness.turn.cardPlays.black=1;
  witness.history.push({type:'cardPlayed',cardId:'rebirth',target:[{from:'f6',to:'b1'}],movement:[{from:'f6',to:'b1'}],preservePreviousMove:true});
  witness.cardResponse={player:'black',historyLength:witness.history.length};
  witness.playedCards=[...(state.playedCards??[]),{player:'black',cardInstanceId:card.id}];
  witness.fen=`${placement(witness.pieces)} w - - 2 28`;
  const cured=immutable(state,{type:'playCard',cardId:'rebirth',cardInstanceId:card.id,target:[{from:'f6',to:'b1'}]});
  for(const key of ['pieces','players','turn','effects','history','fen','enPassant','shieldMove','cardResponse','playedCards'] as const)assert.deepEqual(cured[key],witness[key],`rescue ${key}`);
  noObligations(cured);
  assert.equal(cured.pendingRescue??null,null);assert.equal(checked(witness.pieces,'black'),false);assert.equal(checked(witness.pieces,'white'),false);
  const ended=immutable(cured,{type:'endTurn'});
  for(const key of ['pieces','players','history','fen','enPassant','effects','playedCards'] as const)assert.deepEqual(ended[key],witness[key]);
  noObligations(ended);assert.equal(ended.cardResponse,undefined);assert.equal(ended.pendingRescue??null,null);
  assert.deepEqual(ended.turn,{color:'white',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}});assert.equal(ended.outcome,null);assert.equal(ended.shieldMove,undefined);
}

test('random campaign iteration 208', () => {
  replayTrace(trace)
})
