import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameState, PieceState, SquareName, GameEvent } from '../types.js';
import { CARD_CATALOG } from './catalog.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/205.json', import.meta.url), 'utf8')) as RandomTrace;
// Ordered reasoning from rules §§8–11, 14.4, 19.2, 20–22 and printed card metadata.
const rationales = [
  '1. g2-g4: Pawn advances two empty squares from home; g3 opportunity.',
  '2. End White turn; no Black Pawn can capture g3.',
  '3. c7-c5: Pawn advances through c6; c6 opportunity replaces g3.',
  '4. Black Fireball c5 after quiet c7-c5 captures only its center Pawn; all eight neighbors empty; draw Bombard.',
  '5. End Black turn; captured c7 identity invalidates c6 opportunity.',
  '6. b2-b4: Pawn advances through b3; b3 opportunity.',
  '7. End White turn; no Black Pawn can capture b3.',
  '8. d8-a5: Queen traverses vacant c7,b6.',
  '9. End Black turn after Qa5.',
  '10. h2-h3: Pawn takes one empty forward square.',
  '11. End White turn after h3.',
  '12. Black Bombard h8-h6 jumps exactly own h7 Pawn and lands empty; consumes move, revokes k, draws Fortification.',
  '13. End Black turn after Bombard.',
  '14. c1-a3: Bishop traverses empty b2.',
  '15. End White turn after Ba3.',
  '16. a5-h5: Queen crosses empty b5,c5,d5,e5,f5,g5.',
  '17. End Black turn after Qh5.',
  '18. White Evil Eye g4/h5 removes the Queen legally threatened by the Pawn diagonal; Pawn stays, consumes move, draws Hostage.',
  '19. End White turn after stationary capture.',
  '20. Black Blessing h7-f5 follows empty g6 diagonal to empty f5; consumes move, draws Ghostwalk.',
  '21. End Black turn after Blessing.',
  '22. f1-g2: Bishop takes one empty diagonal step.',
  '23. End White turn after Bg2.',
  '24. e7-e5: Pawn advances through e6; e6 opportunity.',
  '25. End Black turn; no White Pawn can capture e6.',
  '26. e2-e4: Pawn advances through e3; e3 opportunity.',
  '27. End White turn; no Black Pawn can capture e3.',
  '28. a7-a5: Pawn advances through a6; a6 opportunity.',
  '29. End Black turn; no White Pawn can capture a6.',
  '30. a3-c1: Bishop returns through vacant b2.',
  '31. End White turn after Bc1.',
  '32. h6xh3: Rook crosses empty h5,h4 and captures original h2 Pawn for Black.',
  '33. End Black turn after Rxh3.',
  '34. f2-f3: Pawn advances one empty square.',
  '35. End White turn after f3.',
  '36. e8-e7: King steps to safe e7; revoke Black q.',
  '37. End Black turn after Ke7.',
  '38. g4xf5: Pawn captures original h7 Pawn diagonally for White.',
  '39. End White turn after gxf5.',
  '40. g7-g6: Pawn advances one empty square.',
  '41. End Black turn after g6.',
  '42. d2-d4: Pawn advances through d3; d3 opportunity.',
  '43. End White turn; Black e5 Pawn cannot capture d3.',
  '44. Black Ghostwalk f8-c5 passes through own King e7 and empty d6; empty destination, consumes move, draws Irresistible Force.',
  '45. End Black turn after Ghostwalk.',
  '46. b4xa5: Pawn captures original a7 Pawn diagonally for White.',
  '47. White No Quarter makes that exact a7 Pawn dead; clears capturedBy, draws Curse.',
  '48. End White turn after No Quarter.',
  '49. h3xh1: Rook crosses empty h2 and captures White h1 Rook; revoke K.',
  '50. End Black turn after Rxh1.',
  '51. c1-h6: Bishop traverses empty d2,e3,f4,g5.',
  '52. End White turn after Bh6.',
  '53. h1xh6: Rook crosses empty h2,h3,h4,h5 and captures original c1 Bishop.',
  '54. End Black turn after Rxh6.',
  '55. e1-f2: King steps diagonally to safe f2; revoke Q.',
  '56. End White turn after Kf2.',
  '57. h6-h7: Rook takes one empty orthogonal step.',
  '58. End Black turn after Rh7.',
  '59. g2-f1: Bishop takes one empty diagonal step.',
  '60. End White turn after Bf1.',
  '61. c5-a7: Bishop traverses empty b6.',
  '62. End Black turn after Ba7.',
  '63. f5-f6: Pawn advances and checks Black King e7.',
  '64. End White turn; Black has ordinary Kxf6 escape.',
  '65. a7-b6: Bishop step leaves f6 Pawn checking e7; held Fortification f6-e7 is a complete rescue witness.',
  '66. Black Heresy f1-e1,c8-c7,b6-a6 moves each eligible Bishop in opponent-first order but cannot cure Pawn check; spend/draw Siege and rewind Ba7-b6.',
  '67. e7xf6: King captures checking Pawn on undefended f6; replaces inert move token.',
  '68. End Black turn with safe King f6.',
  '69. f2-e3: King steps diagonally to safe e3.',
  '70. White Panic after move obliges Black to move within 15 seconds; draw Vulture.',
  '71. End White turn preserving Panic obligation.',
  '72. Black Panic timeout skips its move; clear effect, advance clocks once and give White turn.',
  '73. d4xe5: Pawn capture opens a7-b6-c5-d4-e3 Bishop check; held Curse on a7 limits its range and rescues.',
  '74. White Curse targets unrelated a8 Rook, cannot cure Bishop check; spend/draw Think Again and rewind d4xe5.',
  '75. f1-g2: Bishop diagonal step leaves d4 blocking check and replaces inert move token.',
  '76. End White turn after Bg2.',
  '77. f6-e7: King steps diagonally to safe e7.',
  '78. End Black turn after Ke7.',
  '79. g1-e2: Knight jumps two files and one rank.',
  '80. End White turn after Ne2.',
  '81. a7-c5: Bishop traverses empty b6.',
  '82. Black Siege exchanges own g8 Knight and h7 Rook without capture or move; preserve Bishop move token, draw Curse.',
  '83. End Black turn after Siege.',
  '84. e2-g3: Knight jumps two files and one rank.',
  '85. End White turn after Ng3.',
  '86. e7-f6: King steps diagonally to safe f6.',
  '87. End Black turn after Kf6.',
  '88. d1-d3: Queen traverses vacant d2.',
  '89. End White turn after Qd3.',
  '90. c5-f8: Bishop traverses vacant d6,e7.',
  '91. End Black turn after Bf8.',
  '92. d3-c4: Queen takes one vacant diagonal step.',
  '93. End White turn after Qc4.',
  '94. a8-a6: Rook traverses empty a7.',
  '95. Black Fortification marks adjacent boundary b4-c3, retains card and draws Hidden Passage; no clocks or board change.',
  '96. White Vulture reacts to Black card, takes last eligible discard Siege; discard top Breakthrough, spend Vulture, draw Tournament, retain wall.',
  '97. End Black turn with both card allowances reset.',
  '98. c4-e6: Queen traverses empty d5, checks adjacent Black King f6.',
  '99. End White turn; Black has Kxe6 escape.',
  '100. a6-a8: Rook crosses empty a7 but leaves Queen check; held Abduction e6 followed by timeout supplies rescue.',
  '101. Black Curse targets unrelated a1 Rook, cannot cure Queen check; spend/draw Think Again and rewind Ra6-a8.',
  '102. f6xe6: King captures undefended checking Queen; replaces inert token.',
  '103. End Black turn after Kxe6.',
  '104. g2-f1: Bishop takes one vacant diagonal step.',
  '105. End White turn after Bf1.',
  '106. Black Hidden Passage relocates King e6-g1 to empty safe square; consumes move, draws Vulture.',
  '107. End Black turn after Hidden Passage.',
  '108. e3-d3: King takes one safe orthogonal step.',
  '109. End White turn after Kd3.',
  '110. f8-h6: Bishop traverses empty g7.',
  '111. End Black turn after Bh6.',
  '112. b1-c3: Knight jumps to wall endpoint legally without crossing its boundary.',
  '113. End White turn after Nc3.',
  '114. h6-f8: Bishop traverses empty g7.',
  '115. End Black turn after Bf8.',
  '116. g3-h5: Knight jumps one file and two ranks.',
  '117. End White turn after fiftieth move command; wall persists.',
];

const cards: Record<number, GameAction> = {
  4: { type: 'playCard', cardId: 'fireball', cardInstanceId: 'black-hand-1-fireball', target: 'c5' },
  12: { type: 'playCard', cardId: 'bombard', cardInstanceId: 'black-deck-0-bombard', target: [{ from: 'h8', to: 'h6' }] },
  18: { type: 'playCard', cardId: 'evil-eye', cardInstanceId: 'white-hand-4-evil-eye', target: { attacker: 'g4', victim: 'h5' } },
  20: { type: 'playCard', cardId: 'blessing', cardInstanceId: 'black-hand-2-blessing', target: [{ from: 'h7', to: 'f5' }] },
  44: { type: 'playCard', cardId: 'ghostwalk', cardInstanceId: 'black-deck-2-ghostwalk', target: [{ from: 'f8', to: 'c5' }] },
  47: { type: 'playCard', cardId: 'no-quarter', cardInstanceId: 'white-hand-0-no-quarter' },
  66: { type: 'playCard', cardId: 'heresy', cardInstanceId: 'black-hand-0-heresy', target: [{ from: 'f1', to: 'e1' }, { from: 'c8', to: 'c7' }, { from: 'b6', to: 'a6' }] },
  70: { type: 'playCard', cardId: 'panic', cardInstanceId: 'white-hand-3-panic' },
  74: { type: 'playCard', cardId: 'curse', cardInstanceId: 'white-deck-1-curse', target: 'a8' },
  82: { type: 'playCard', cardId: 'siege', cardInstanceId: 'black-deck-4-siege', target: { knight: 'g8', rook: 'h7' } },
  95: { type: 'playCard', cardId: 'fortification', cardInstanceId: 'black-deck-1-fortification', target: { from: 'b4', to: 'c3' } },
  96: { type: 'playCard', cardId: 'vulture', cardInstanceId: 'white-deck-2-vulture' },
  101: { type: 'playCard', cardId: 'curse', cardInstanceId: 'black-deck-5-curse', target: 'a1' },
  106: { type: 'playCard', cardId: 'hidden-passage', cardInstanceId: 'black-deck-6-hidden-passage', target: [{ from: 'e6', to: 'g1' }] },
};
const other = (c: Color): Color => c === 'white' ? 'black' : 'white';
const at = (ps: PieceState[], square: string) => ps.find(p => p.zone === 'board' && p.square === square);
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
function ray(ps: PieceState[], from: string, to: string, effects: unknown[], ignoreOwn?: Color) {
  const [x,y] = xy(from), [a,b] = xy(to), dx = a-x, dy = b-y;
  if (!(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) return false;
  let previous = from;
  const length = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i=1;i<=length;i++) {
    const square: string = String.fromCharCode(97+x+Math.sign(dx)*i)+(1+y+Math.sign(dy)*i);
    if (effects.some(raw => { const e = raw as {type:string;from:string;to:string}; return e.type === 'fortification' && (e.from === previous && e.to === square || e.to === previous && e.from === square); })) return false;
    const p = at(ps,square);
    if (i<length && p && p.owner !== ignoreOwn) return false;
    previous=square;
  }
  return length>0;
}
function attacked(s: GameState, color: Color): boolean {
  const k = s.pieces.find(p=>p.owner===color&&p.royal)!;
  return s.pieces.some(p=> {
    if(p.zone!=='board'||p.owner===color) return false;
    const [x,y]=xy(p.square!),[a,b]=xy(k.square!),dx=a-x,dy=b-y;
    if(s.effects.some(raw=>{const e=raw as {type:string;pieceId:string};return e.type==='curse'&&e.pieceId===p.id;})&&Math.max(Math.abs(dx),Math.abs(dy))>2)return false;
    if(p.role==='knight')return Math.abs(dx)*Math.abs(dy)===2;
    const aligned=p.role==='pawn'?Math.abs(dx)===1&&dy===(p.owner==='white'?1:-1)
      :p.role==='king'?Math.max(Math.abs(dx),Math.abs(dy))===1
      :p.role==='bishop'?Math.abs(dx)===Math.abs(dy):p.role==='rook'?dx===0||dy===0:true;
    return aligned&&ray(s.pieces,p.square!,k.square!,s.effects);
  });
}
function board(ps: PieceState[]) {
  const symbols={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'};
  return Array.from({length:8},(_,r)=>{let row='',empty=0;for(let f=0;f<8;f++){
    const p=at(ps,String.fromCharCode(97+f)+(8-r));if(!p){empty++;continue;}if(empty)row+=empty;empty=0;
    row+=p.owner==='white'?symbols[p.role].toUpperCase():symbols[p.role];}return row+(empty||'');}).join('/');
}
function immutable(s: GameState,a: GameAction) {
  const before=structuredClone(s),payload=structuredClone(a),r=applyAction(s,a);
  assert.deepEqual(s,before,'immutable state');assert.deepEqual(a,payload,'immutable action');return r;
}
function compare(a: GameState,e: GameState,why: string) {
  for(const field of ['pieces','players','effects','history','turn','fen','enPassant','orientation','outcome'] as const)assert.deepEqual(a[field],e[field],`${why}: ${field}`);
  for(const field of ['shieldMove','cardResponse','chaosForbidden','plotsExecution','riposteSkipped','riposteCheckDeferred'] as const)assert.deepEqual(a[field]??null,e[field]??null,`${why}: ${field}`);
  for(const field of ['playedCards','plotsAllowances','fogLocked','riposteLostMoves','underElfHill'] as const)assert.deepEqual(a[field]??[],e[field]??[],`${why}: ${field}`);
  for(const field of ['pendingDoomsayer','pendingAbduction'] as const)assert.equal(a[field]??null,null,why);
  const snapshot=structuredClone(a);
  for(const color of ['white','black'] as const)assert.equal(isKingInCheck(a,color),attacked(e,color),`${why}: ${color} threat`);
  assert.deepEqual(a,snapshot,'immutable royal queries');
}

function spend(e: GameState, action: Extract<GameAction,{type:'playCard'}>, owner: Color, retained=false) {
  assert.equal(e.turn.cardPlays[owner],0);
  const p=e.players[owner],card=p.hand.find(c=>c.id===action.cardInstanceId)!;
  assert.ok(card);assert.equal(card.cardId,action.cardId);
  p.hand=p.hand.filter(c=>c.id!==card.id);
  p.hand.push(p.deck.shift()!);
  if(!retained)p.discard.push(card);
  e.turn.cardPlays[owner]++;
  (e.playedCards??=[]).push({player:owner,cardInstanceId:card.id});
  return card;
}
function endExpected(e:GameState){
  assert.equal(attacked(e,e.turn.color),false,'end requires safe actor');
  e.turn={color:other(e.turn.color),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
  delete e.shieldMove;delete e.cardResponse;
}
function rescued(actual:GameState,expected:GameState,n:number){
  const e=structuredClone(expected);let a=actual;
  const owner=e.turn.color;
  const action:Extract<GameAction,{type:'playCard'}>=n===65
    ?{type:'playCard',cardId:'fortification',cardInstanceId:'black-deck-1-fortification',target:{from:'f6',to:'e7'}}
    :n===73?{type:'playCard',cardId:'curse',cardInstanceId:'white-deck-1-curse',target:'a7'}
    :{type:'playCard',cardId:'abduction',cardInstanceId:'black-hand-3-abduction',target:'e6'};
  assert.equal(e.turn.phase,'afterMove');assert.equal(attacked(e,owner),true);
  const card=spend(e,action,owner,n!==100);
  if(n===65){
    assert.equal(at(e.pieces,'f6')!.id,'white-pawn-g2');assert.equal(at(e.pieces,'e7')!.royal,true);
    e.effects.push({type:'fortification',owner,card,from:'f6',to:'e7'});
    e.history.push({type:'cardPlayed',cardId:'fortification',target:{from:'f6',to:'e7'}});
  }else if(n===73){
    assert.equal(at(e.pieces,'a7')!.id,'black-bishop-f8');
    e.effects.push({type:'curse',owner,card,pieceId:'black-bishop-f8'});
    e.history.push({type:'cardPlayed',cardId:'curse',target:'a7',movement:[],preservePreviousMove:true});
  }else{
    assert.equal(at(e.pieces,'e6')!.id,'white-queen-d1');
    // The only checking piece is removed after the recall timer, not at concealment.
    const result=immutable(a,action);assert.ok(result.ok);a=result.state;
    assert.deepEqual(a.pendingAbduction,{phase:'concealment',player:'white',durationMs:10000,pieceId:'white-queen-d1',requiresPieceId:false,before:actual});
    assert.deepEqual(a.pendingRescue,actual.pendingRescue,'concealment retains complete rescue checkpoint');
    for(const field of ['chaosForbidden','plotsExecution','riposteSkipped','riposteCheckDeferred','pendingDoomsayer'] as const)assert.equal(a[field]??null,null);
    for(const field of ['plotsAllowances','fogLocked','riposteLostMoves','underElfHill'] as const)assert.deepEqual(a[field]??[],[]);
    assert.deepEqual(a.players,e.players);assert.deepEqual(a.playedCards,e.playedCards);
    const away=structuredClone(e.pieces);Object.assign(at(away,'e6')!,{square:null,zone:'away'});
    assert.deepEqual(a.pieces,away);assert.equal(a.fen,`${board(away)} w - - 14 24`);
    assert.deepEqual(a.effects,e.effects);assert.deepEqual(a.turn,e.turn);assert.deepEqual(a.enPassant,[]);
    assert.deepEqual(a.history,expected.history.concat({type:'cardPlayed',cardId:'abduction',movement:[],preservePreviousMove:true}));
    assert.deepEqual(a.shieldMove,e.shieldMove);
    assert.deepEqual(a.cardResponse,{player:'black',historyLength:a.history.length});
    const reveal=immutable(a,{type:'revealAbduction'});assert.ok(reveal.ok);
    const revealed=structuredClone(a);revealed.pendingAbduction!.phase='recall';delete revealed.fogCheckpoint;
    assert.deepEqual(reveal.state,revealed,'reveal opens recall and closes immediate Fog cancellation');a=reveal.state;
    const timeout=immutable(a,{type:'abductionTimeout'});assert.ok(timeout.ok);a=timeout.state;
    Object.assign(at(e.pieces,'e6')!,{square:null,zone:'captured',capturedBy:'black'});
    e.fen=`${board(e.pieces)} w - - 0 24`;
    e.history.push({type:'cardPlayed',cardId:'abduction',target:'e6',capturedId:'white-queen-d1',capturedIds:['white-queen-d1'],movement:[],preservePreviousMove:true});
  }
  if(n!==100){const result=immutable(a,action);assert.ok(result.ok);a=result.state;}
  e.pendingRescue=null;e.cardResponse={player:owner,historyLength:e.history.length};
  compare(a,e,`rescue ${n}`);assert.equal(a.pendingRescue??null,null);
  assert.equal(attacked(e,owner),false);
  if(n===100)assert.equal(attacked(e,'white'),false,'Abduction creates no check, hence no direct mate');
  endExpected(e);const end=immutable(a,{type:'endTurn'});assert.ok(end.ok);compare(end.state,e,`rescue ${n} ended`);
  assert.equal(end.state.pendingRescue??null,null);
}

test('iteration 205: independent ordered board, cards, history, FEN, royal and rescue oracle',()=>{
  assert.equal(trace.seed,860205);
  assert.equal(trace.steps.length,117);assert.equal(rationales.length,117);
  assert.equal(trace.steps.filter(s=>s.action.type==='move').length,50);
  assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,14);
  let actual=createGameState(trace.initial),e=createGameState(trace.initial);
  let rights='KQkq',half=0,full=1,fenTurn:Color='white';
  const checkpoints=new Map<number,GameState>();
  const actualCheckpoints=new Map<number,GameState>();
  for(const [index,{action}]of trace.steps.entries()){
    const n=index+1,why=rationales[index]!;assert.ok(why.startsWith(`${n}.`));
    checkpoints.set(n,structuredClone(e));actualCheckpoints.set(n,structuredClone(actual));
    const actor=e.turn.color;
    if(action.type==='move'){
      assert.ok(typeof action.from==='string'&&typeof action.to==='string');const from=action.from,to=action.to;
      assert.match(why,new RegExp(`${from}[-x]${to}:`));assert.match(to,/^[a-h][1-8]$/);
      assert.equal(e.turn.moveMade,false);const p=at(e.pieces,from)!;assert.ok(p);assert.equal(p.owner,actor);
      const target=at(e.pieces,to);if(target){assert.equal(target.owner,other(actor));assert.equal(target.royal,false);}
      const[x,y]=xy(from),[tx,ty]=xy(to),dx=tx-x,dy=ty-y;
      if(p.role==='pawn'){
        const d=actor==='white'?1:-1;
        if(target){assert.equal(Math.abs(dx),1);assert.equal(dy,d);}
        else{assert.equal(dx,0);assert.ok(dy===d||dy===2*d&&y===(actor==='white'?1:6));}
        assert.ok(ray(e.pieces,from,to,e.effects));
      }else if(p.role==='knight')assert.equal(Math.abs(dx)*Math.abs(dy),2);
      else{
        if(p.role==='king')assert.equal(Math.max(Math.abs(dx),Math.abs(dy)),1);
        if(p.role==='bishop')assert.equal(Math.abs(dx),Math.abs(dy));
        if(p.role==='rook')assert.ok(dx===0||dy===0);
        assert.ok(ray(e.pieces,from,to,e.effects),why);
      }
      p.square=to as SquareName;
      if(target)Object.assign(target,{square:null,zone:'captured',capturedBy:actor});
      e.history.push({type:'move',from:from as SquareName,to:to as SquareName,...(target?{capturedId:target.id}:{})});
      if(p.role==='king')rights=rights.replace(actor==='white'?/[KQ]/g:/[kq]/g,'');
      const corners:Record<string,string>={a1:'Q',h1:'K',a8:'q',h8:'k'};
      if(p.role==='rook')rights=rights.replace(corners[from]??'~','');
      if(target?.role==='rook')rights=rights.replace(corners[to]??'~','');
      e.enPassant=p.role==='pawn'&&Math.abs(dy)===2?[{target:(from[0]!+((Number(from[1])+Number(to[1]))/2))as SquareName,pawnId:p.id}]:[];
      half=p.role==='pawn'||target?0:half+1;if(actor==='black')full++;fenTurn=other(actor);
      e.turn.phase='afterMove';e.turn.moveMade=true;
      e.shieldMove={player:actor,pieceIds:[p.id],capturedOpponent:!!target};
    }else if(action.type==='endTurn'){
      assert.equal(e.turn.moveMade,true);endExpected(e);
    }else if(action.type==='panicTimeout'){
      assert.equal(n,72);assert.deepEqual(e.effects,[{type:'panic',owner:'white',player:'black',durationMs:15000}]);
      e.effects=[];endExpected(e);half++;full++;fenTurn='white';
    }else{
      assert.equal(action.type,'playCard');if(action.type!=='playCard')assert.fail('Unreviewed action');
      assert.deepEqual(action,cards[n]);const owner=n===96?'white':actor;
      const definition=CARD_CATALOG[action.cardId]!;
      assert.ok(definition.timing.includes(n===96?'afterOpponentCard':e.turn.phase));
      if(n===96){assert.deepEqual(e.cardResponse,{player:'black',historyLength:e.history.length});
        const stolen=e.players.black.discard.pop()!;assert.deepEqual(stolen,{id:'black-deck-4-siege',cardId:'siege'});
        const top=e.players.white.deck.shift()!;assert.equal(top.cardId,'breakthrough');e.players.white.discard.push(top);
        // Standard replacement is drawn before adding the extra stolen physical card.
        const card=spend(e,action,owner);assert.equal(card.cardId,'vulture');e.players.white.hand.push(stolen);
        e.history.push({type:'cardPlayed',cardId:'vulture',player:'white',movement:[],preservePreviousMove:true});
      }else{
        const card=spend(e,action,owner,n===95);
        if([66,74,101].includes(n)){
          assert.equal(attacked(e,actor),true);
          if(n===66){
            const proposed=structuredClone(e);
            for(const[from,to]of [['f1','e1'],['c8','c7'],['b6','a6']]as const){
              const bishop=at(proposed.pieces,from)!;assert.equal(bishop.role,'bishop');assert.equal(at(proposed.pieces,to),undefined);
              assert.equal(Math.abs(xy(from)[0]-xy(to)[0])+Math.abs(xy(from)[1]-xy(to)[1]),1);bishop.square=to;
            }
            assert.equal(attacked(proposed,'black'),true,'Heresy fails to remove f6 Pawn check');
          }else assert.equal(at(e.pieces,n===74?'a8':'a1')!.role,'rook');
          const pre=checkpoints.get(n-1)!;
          e.pieces=structuredClone(pre.pieces);e.history=structuredClone(pre.history);e.enPassant=structuredClone(pre.enPassant);
          const fields=pre.fen.split(' ');rights=fields[2]==='-'?'':fields[2]!;half=Number(fields[4]);full=Number(fields[5]);fenTurn=actor;
          e.turn.phase='beforeMove';e.turn.moveMade=false;
          e.history.push({type:'cardFizzled',cardId:action.cardId,reason:'SELF_CHECK',movement:[],preservePreviousMove:false});
        }else if(n===4){
          const center=at(e.pieces,'c5')!;assert.equal(center.id,'black-pawn-c7');assert.deepEqual(e.shieldMove,{player:'black',pieceIds:[center.id],capturedOpponent:false});
          const[x,y]=xy('c5');assert.deepEqual(e.pieces.filter(p=>p.zone==='board'&&Math.max(Math.abs(xy(p.square!)[0]-x),Math.abs(xy(p.square!)[1]-y))<=1).map(p=>p.id),[center.id]);
          Object.assign(center,{square:null,zone:'captured',capturedBy:'black'});e.enPassant=[];half=0;
          e.history.push({type:'cardPlayed',cardId:'fireball',target:'c5',capturedIds:[center.id],player:'black',movement:[],preservePreviousMove:true});
        }else if(n===18){
          const p=at(e.pieces,'g4')!,q=at(e.pieces,'h5')!;assert.equal(p.role,'pawn');assert.equal(q.role,'queen');assert.equal(q.owner,'black');
          const capture=structuredClone(e);Object.assign(at(capture.pieces,'h5')!,{square:null,zone:'captured'});at(capture.pieces,'g4')!.square='h5';assert.equal(attacked(capture,'white'),false);
          Object.assign(q,{square:null,zone:'captured',capturedBy:'white'});e.enPassant=[];half=0;fenTurn='black';
          e.turn.phase='afterMove';e.turn.moveMade=true;e.shieldMove={player:'white',pieceIds:[],capturedOpponent:true};
          e.history.push({type:'cardPlayed',cardId:'evil-eye',target:{attacker:'g4',victim:'h5'},capturedId:q.id,capturedIds:[q.id],movement:[],preservePreviousMove:false});
        }else if([12,20,44,106].includes(n)){
          const[from,to]:[SquareName,SquareName]=n===12?['h8','h6']:n===20?['h7','f5']:n===44?['f8','c5']:['e6','g1'];
          const p=at(e.pieces,from)!;assert.equal(p.owner,actor);assert.equal(at(e.pieces,to),undefined);
          if(n===12){assert.equal(p.role,'rook');assert.equal(at(e.pieces,'h7')!.owner,'black');rights=rights.replace('k','');}
          if(n===20){assert.equal(p.role,'pawn');assert.ok(ray(e.pieces,from,to,e.effects));}
          if(n===44){assert.equal(p.role,'bishop');assert.equal(at(e.pieces,'e7')!.owner,'black');assert.ok(ray(e.pieces,from,to,e.effects,'black'));}
          if(n===106)assert.equal(p.royal,true);
          p.square=to;e.enPassant=[];half=p.role==='pawn'?0:half+1;full++;fenTurn='white';
          e.turn.phase='afterMove';e.turn.moveMade=true;e.shieldMove={player:actor,pieceIds:[p.id],capturedOpponent:false};
          e.history.push({type:'cardPlayed',cardId:action.cardId,target:[{from,to}],movement:[{from,to}],preservePreviousMove:false});
        }else if(n===47){
          const p=e.pieces.find(p=>p.id==='black-pawn-a7')!;assert.equal(p.zone,'captured');assert.equal(e.history.at(-1)!.capturedId,p.id);
          p.zone='dead';delete p.capturedBy;e.history.push({type:'cardPlayed',cardId:'no-quarter',movement:[],preservePreviousMove:true});
        }else if(n===70){
          e.effects.push({type:'panic',owner:'white',player:'black',durationMs:15000});
          e.history.push({type:'cardPlayed',cardId:'panic',movement:[],preservePreviousMove:true});
        }else if(n===82){
          const knight=at(e.pieces,'g8')!,rook=at(e.pieces,'h7')!;assert.equal(knight.role,'knight');assert.equal(rook.role,'rook');assert.equal(knight.owner,owner);assert.equal(rook.owner,owner);
          knight.square='h7';rook.square='g8';e.history.push({type:'cardPlayed',cardId:'siege',target:{knight:'g8',rook:'h7'},movement:[{from:'g8',to:'h7'},{from:'h7',to:'g8'}],preservePreviousMove:true});
        }else if(n===95){
          e.effects.push({type:'fortification',owner,card,from:'b4',to:'c3'});
          e.history.push({type:'cardPlayed',cardId:'fortification',target:{from:'b4',to:'c3'}});
        }else assert.fail('unreviewed card');
      }
      e.cardResponse={player:owner,historyLength:e.history.length};
      if(![66,74,101].includes(n)){
        assert.equal(attacked(e,actor),false,'resolved card leaves actor safe');
        assert.equal(attacked(e,other(actor)),false,'no regular card in this trace directly gives check');
      }
    }
    // Every retained opportunity in this particular trace lacks an adjacent legal captor.
    for(const ep of e.enPassant){
      const victim=e.pieces.find(p=>p.id===ep.pawnId)!;
      const prospective=other(victim.owner),[x,y]=xy(ep.target);
      assert.equal(e.pieces.some(p=>p.zone==='board'&&p.owner===prospective&&p.role==='pawn'&&Math.abs(xy(p.square!)[0]-x)===1&&y-xy(p.square!)[1]===(prospective==='white'?1:-1)),false);
    }
    e.fen=`${board(e.pieces)} ${fenTurn[0]} ${rights||'-'} - ${half} ${full}`;
    const result=immutable(actual,action);assert.ok(result.ok,why);actual=result.state;
    compare(actual,e,why);
    if([65,73,100].includes(n)){
      const pre=checkpoints.get(n)!,apre=actualCheckpoints.get(n)!;
      assert.deepEqual(actual.pendingRescue,{before:apre,fen:pre.fen,pieces:pre.pieces,enPassant:pre.enPassant,historyLength:pre.history.length,movedPieceIds:e.shieldMove!.pieceIds});
      rescued(actual,e,n);
    }else assert.equal(actual.pendingRescue??null,null,why);
    if(action.type==='move'&&![65,73,100].includes(n))assert.equal(attacked(e,actor),false,'ordinary move actor safe');
    if([66,74,101].includes(n)){
      // Reset card allowance so the stale movement token cannot hide behind CARD_ALREADY_PLAYED.
      const probe=structuredClone(actual);probe.turn.cardPlays[actor]=0;
      const held=probe.players[actor].hand.find(c=>c.cardId===(n===66?'fortification':n===74?'cathedral':'abduction'))!;
      assert.ok(held);
      const target=n===66?{from:'f6',to:'e7'}:n===74?{rook:'a1',bishop:'f1'}:'e6';
      const denied=immutable(probe,{type:'playCard',cardId:held.cardId,cardInstanceId:held.id,target});
      assert.equal(denied.ok,false,'inert rollback token grants no after-move card permission');
      if(!denied.ok)assert.equal(denied.error.code,'INVALID_TIMING');
      assert.deepEqual(denied.state,probe);
    }
    if(e.enPassant.length){
      const probe=structuredClone(actual),ep=e.enPassant[0]!,victim=e.pieces.find(p=>p.id===ep.pawnId)!;
      probe.turn={color:other(victim.owner),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      const before=structuredClone(probe),dests=legalDests(probe);
      for(const p of e.pieces.filter(p=>p.zone==='board'&&p.owner===probe.turn.color&&p.role==='pawn'))assert.equal(dests.get(p.square!)?.includes(ep.target)??false,false);
      assert.deepEqual(probe,before,'immutable EP availability query');
    }
  }
  assert.equal(actual.fen,'1nb2br1/1p1p1p1n/r5p1/P3p2N/3PP3/2NK1P2/P1P5/R4Bk1 b - - 7 27');
});

test('random campaign iteration 205', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/205.json', import.meta.url), 'utf8')) as RandomTrace;
  replayTrace(trace);
});
