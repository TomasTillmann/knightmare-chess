import assert from 'node:assert/strict';
import {applyAction} from '../../src/game/reducer.js';
import {createGameState} from '../../src/game/state.js';
import type {GameAction,GameState} from '../../src/game/types.js';
const started=performance.now();let groups=0,actions=0;const observations:unknown[]=[];
function act(s:GameState,a:GameAction){const before=JSON.stringify(s),r=applyAction(s,a);assert.ok(r.ok,JSON.stringify({a,fen:s.fen,error:r.ok?null:r.error}));assert.equal(JSON.stringify(s),before);actions++;return r.state;}
for(const actor of ['white','black'] as const)for(const copied of [false,true])for(const correct of [false,true]){
 const white=actor==='white',other=white?'black':'white',m=(s:string)=>white?s:s[0]+String(9-Number(s[1]));
 const board=new Map(Object.entries({a1:'K',h8:'k',b2:'P',c3:'N',f6:'n'}).map(([s,p])=>[m(s),white?p:p===p.toUpperCase()?p.toLowerCase():p.toUpperCase()]));
 const fen=Array.from({length:8},(_,r)=>[...'abcdefgh'].map(f=>board.get(f+String(8-r))??'1').join('').replace(/1+/g,x=>String(x.length))).join('/')+` ${other==='white'?'w':'b'} - - 0 1`;
 let s=createGameState({fen,hands:{[actor]:['abduction','haunting-memories'],[other]:['abduction','fog-of-war']}});const initialTypes=Object.values(s.players).flatMap(p=>p.hand).map(c=>[c.id,c.cardId]).sort();
 for(const a of [{type:'move',from:m('h8'),to:m('g8')},{type:'playCard',cardId:'abduction',target:m('b2')},{type:'revealAbduction'},{type:'answerAbduction',player:actor,role:'pawn',owner:actor,square:m('b2')},{type:'endTurn'},{type:'move',from:m('a1'),to:m('b1')}] as GameAction[])s=act(s,a);
 const card=copied?'haunting-memories':'abduction',selected=s.players[actor].hand.find(c=>c.cardId===card)!.id;
 s=act(s,{type:'playCard',cardId:card,target:m('f6')});
 const early=act(s,{type:'playCard',cardId:'fog-of-war'});assert.equal(early.pendingAbduction,null);assert.deepEqual(Object.values(early.players).flatMap(p=>[...p.hand,...p.deck,...p.discard]).map(c=>[c.id,c.cardId]).sort(),initialTypes);
 s=act(s,{type:'revealAbduction'});s=act(s,{type:'answerAbduction',player:other,role:correct?'knight':'rook',owner:other,square:m('f6')});
 assert.equal(s.pendingAbduction,null);assert.equal(s.pieces.find(p=>p.id===`${other}-knight-${m('f6')}`)?.zone,correct?'board':'captured');
 const beforeFog=Object.values(s.players).flatMap(p=>[...p.hand,...p.deck,...p.discard]).map(c=>[c.id,c.cardId]).sort(),fog=applyAction(s,{type:'playCard',cardId:'fog-of-war'});actions++;assert.deepEqual(beforeFog,initialTypes);
 if(!fog.ok){assert.deepEqual(fog.state,s);observations.push({issue:'RESOLVED_ABDUCTION_FOG_WINDOW_MISSING',actor,copied,correct,error:fog.error,cardResponse:s.cardResponse,fogCheckpointPresent:Boolean(s.fogCheckpoint),history:s.history.slice(-3)});groups++;continue;}s=fog.state;
 const finalTypes=Object.values(s.players).flatMap(p=>[...p.hand,...p.deck,...p.discard]).map(c=>[c.id,c.cardId]).sort();
 assert.equal(s.pieces.find(p=>p.id===`${other}-knight-${m('f6')}`)?.square,m('f6'));assert.equal(s.pendingAbduction,null);
 const changed=JSON.stringify(finalTypes)!==JSON.stringify(initialTypes);if(changed)observations.push({actor,copied,correct,selected,beforeFog,initialTypes,finalTypes,history:s.history.slice(-4)});else assert.deepEqual(finalTypes,initialTypes);groups++;
}
console.log(JSON.stringify({sentinel:'HAUNTING_ABDUCTION_FOG_OBSERVATION_DONE',groups,actions,observations,ms:performance.now()-started,scope:'Original/copied Abduction, correct/incorrect recall, then real Fog cancellation; physical card type conservation'}));
