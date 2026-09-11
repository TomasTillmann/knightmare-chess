import assert from 'node:assert/strict';
import {applyAction,legalDests} from '../../src/game/reducer.js';
import {createGameState} from '../../src/game/state.js';
import type {GameAction,GameState} from '../../src/game/types.js';
import type {SquareName} from 'chessops/types';
const started=performance.now();let groups=0,actions=0,assertions=0,fenActorMismatches=0,redoClockIncrements=0;const examples:unknown[]=[];
function act(s:GameState,a:GameAction){const before=JSON.stringify(s),r=applyAction(s,a);assert.ok(r.ok,JSON.stringify({a,fen:s.fen,error:r.ok?null:r.error}));assert.equal(JSON.stringify(s),before);actions++;assertions+=2;return r.state;}
for(const color of ['white','black'] as const)for(const cancel of ['chaos','knightmare','think-again'])for(const [card,role,via,to,redo] of [['charge','N',29,39,46],['crusade','B',28,46,37],['merciless','R',27,43,29]] as const)for(const returnCard of [true,false]){
 const white=color==='white',other=white?'black':'white',sq=(n:number)=>('abcdefgh'[n%8]+String(1+Math.floor(n/8))) as SquareName,m=(n:number)=>sq(white?n:n^56);
 const b=new Map<number,string>([[7,'K'],[63,'k'],[19,role]]),board=new Map([...b].map(([n,p])=>[white?n:n^56,white?p:p===p.toUpperCase()?p.toLowerCase():p.toUpperCase()]));
 const fen=Array.from({length:8},(_,r)=>Array.from({length:8},(_,f)=>board.get((7-r)*8+f)??'1').join('').replace(/1+/g,x=>String(x.length))).join('/')+` ${white?'w':'b'} - - 11 7`;
 let s=createGameState({fen,hands:{[color]:[card],[other]:[cancel]}});s=act(s,{type:'move',from:m(19),to:m(via)});const first=s;
 s=act(s,{type:'playCard',cardId:card,target:[{from:m(via),to:m(to)}]});const extra=s;
 s=act(s,{type:'playCard',cardId:cancel,target:{returnCard}});const restored=s;
 assert.deepEqual(s.pieces,first.pieces);assert.equal(s.fen,first.fen);assert.equal(s.turn.color,color);assert.equal(s.turn.phase,'beforeMove');assert.equal(s.turn.moveMade,false);assert.equal(s.players[color].hand.some(c=>c.cardId===card),returnCard);assert.equal(s.players[other].hand.length,0);assertions+=7;
 const repeated=applyAction(s,{type:'move',from:m(via),to:m(to)});assert.equal(repeated.ok,false);assert.deepEqual(repeated.state,s);assertions+=2;
 const returnedCardAttempt=applyAction(s,{type:'playCard',cardId:card,target:[{from:m(via),to:m(redo)}]});assert.equal(returnedCardAttempt.ok,false);assertions++;
 assert.ok(legalDests(s,false).get(m(via))?.includes(m(redo)));assertions++;
 s=act(s,{type:'move',from:m(via),to:m(redo)});const replaced=s;s=act(s,{type:'endTurn'});assert.equal(s.turn.color,other);assertions++;
 const expectedFenActor=color==='white'?'w':'b';if(restored.fen.split(' ')[1]!==expectedFenActor)fenActorMismatches++;
 if(Number(replaced.fen.split(' ')[4])>Number(first.fen.split(' ')[4]))redoClockIncrements++;
 if(cancel==='think-again'&&card==='crusade'&&returnCard)examples.push({color,first:first.fen,extra:extra.fen,restored:restored.fen,restoredTurn:restored.turn,replaced:replaced.fen,ended:s.fen,returnedCardError:returnedCardAttempt.ok?null:returnedCardAttempt.error});groups++;
}
console.log(JSON.stringify({sentinel:'CHAOS_ADDITIONAL_TURN_OBSERVATION_DONE',groups,actions,assertions,fenActorMismatches,redoClockIncrements,examples,ms:performance.now()-started,qualification:'Observed representational behavior and legal continuation; FEN-side/redo-clock normative interpretation pending independent source review, not counted as a new bug'}));
