import assert from 'node:assert/strict';
import {applyAction,legalDests} from '../../src/game/reducer.js';
import {createGameState} from '../../src/game/state.js';
import type {GameAction,GameState} from '../../src/game/types.js';
export function runElfCompositeCrab(carriers:readonly string[]=['knight','pawn']){
const started=performance.now();let groups=0,actions=0;const observations:any[]=[];
function act(s:GameState,a:GameAction){const before=JSON.stringify(s),r=applyAction(s,a);assert.ok(r.ok,JSON.stringify({a,fen:s.fen,error:r.ok?null:r.error}));assert.equal(JSON.stringify(s),before);actions++;return r.state;}
for(const owner of ['white','black'] as const)for(const carrier of carriers){
 const white=owner==='white',other=white?'black':'white',m=(s:string)=>white?s:s[0]+String(9-Number(s[1]));
 const map:Record<string,string>={g1:'K',h8:'k',...(carrier==='knight'?{b2:'P',c3:'N'}:{c3:'P',b1:'N'})};
 const board=new Map(Object.entries(map).map(([s,p])=>[m(s),white?p:p===p.toUpperCase()?p.toLowerCase():p.toUpperCase()]));
 const fen=Array.from({length:8},(_,r)=>[...'abcdefgh'].map(f=>board.get(f+String(8-r))??'1').join('').replace(/1+/g,x=>String(x.length))).join('/')+` ${white?'w':'b'} - - 0 1`;
 let s=createGameState({fen,hands:{[owner]:['crab','confabulation','coup','under-elf-hill','peace-talks'],[other]:[]}});
 const coup=s.players[owner].hand[2];
 const crab=s.players[owner].hand[0],pawn=`${owner}-pawn-${m(carrier==='knight'?'b2':'c3')}`;
 for(const a of [{type:'move',from:m('g1'),to:m('f1')},{type:'playCard',cardId:'crab',target:m(carrier==='knight'?'b2':'c3')},{type:'endTurn'},{type:'move',from:m('h8'),to:m('g8')},{type:'endTurn'},{type:'playCard',cardId:'confabulation',target:[{from:m(carrier==='knight'?'b2':'b1'),to:m('c3')}]},{type:'endTurn'},{type:'move',from:m('g8'),to:m('h8')},{type:'endTurn'},{type:'move',from:m('f1'),to:m('g1')},{type:'playCard',cardId:'coup',target:m('c3')},{type:'endTurn'},{type:'move',from:m('h8'),to:m('g8')},{type:'endTurn'}] as GameAction[])s=act(s,a);
 assert.ok(s.effects.some((e:any)=>e.type==='crab'&&e.card.id===crab.id));assert.ok(s.effects.some(e=>e.type==='confabulation'));const royal=s.pieces.find(p=>p.royal&&p.owner===owner)!;assert.equal(royal.square,m('c3'));
 s=act(s,{type:'playCard',cardId:'under-elf-hill'});const retainedAway=s.effects.some((e:any)=>e.type==='crab'&&e.card.id===crab.id),discarded=s.players[owner].discard.some(c=>c.id===crab.id);
 for(const a of [{type:'endTurn'},{type:'move',from:m('g8'),to:m('h8')},{type:'endTurn'},{type:'returnKing',to:m('a3')},{type:'move',from:m('g1'),to:m('f1')},{type:'endTurn'},{type:'move',from:m('h8'),to:m('g8')},{type:'endTurn'}] as GameAction[])s=act(s,a);
 // Remove Coup before testing restored nonroyal movement, avoiding the separate
 // source ambiguity about Coup overriding an earlier Crab's movement powers.
 for(const a of [{type:'move',from:m('f1'),to:m('g1')},{type:'playCard',cardId:'peace-talks',target:coup.id},{type:'endTurn'},{type:'move',from:m('g8'),to:m('h8')},{type:'endTurn'}] as GameAction[])s=act(s,a);
 assert.equal(s.effects.some(e=>e.type==='coup'),false);assert.equal(s.pieces.find(p=>p.id===royal.id)?.royal,false);
 const dests=legalDests(s,false).get(m('a3'))??[],diagonal=applyAction(s,{type:'move',from:m('a3'),to:m('b4')}),forward=applyAction(s,{type:'move',from:m('a3'),to:m('a4')});actions+=2;
 observations.push({owner,carrier,pawn,retainedAway,discarded,diagonal:dests.includes(m('b4')),forward:dests.includes(m('a4')),diagonalAccepted:diagonal.ok,forwardAccepted:forward.ok,finalFen:s.fen});
 if(carrier==='pawn'){assert.equal(retainedAway,true);assert.equal(discarded,false);assert.equal(diagonal.ok,true);assert.equal(forward.ok,false);}groups++;
}
return {sentinel:'ELF_COMPOSITE_CRAB_OBSERVATION_DONE',groups,actions,observations,ms:performance.now()-started};
}
if(process.argv[1]?.endsWith('elf-composite-crab-observation.ts'))console.log(JSON.stringify(runElfCompositeCrab()));
