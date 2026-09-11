import assert from 'node:assert/strict';
import {applyAction,cardPlayTargets,isKingInCheck} from '../../src/game/reducer.js';
import {createGameState} from '../../src/game/state.js';
import type {GameAction,GameState} from '../../src/game/types.js';
const started=performance.now();let groups=0,actions=0;const observations:unknown[]=[];
function act(s:GameState,a:GameAction){const before=JSON.stringify(s),r=applyAction(s,a);assert.ok(r.ok,JSON.stringify({a,error:r.ok?null:r.error}));assert.equal(JSON.stringify(s),before);actions++;return r.state;}
for(const owner of ['white','black'] as const)for(const role of ['knight','bishop','pawn']){
 const white=owner==='white',other=white?'black':'white',m=(s:string)=>white?s:s[0]+String(9-Number(s[1]));
 const b=new Map(Object.entries({g1:'K',h7:'k',c3:role==='knight'?'N':role==='bishop'?'B':'P'}).map(([s,p])=>[m(s),white?p:p===p.toUpperCase()?p.toLowerCase():p.toUpperCase()]));
 const fen=Array.from({length:8},(_,r)=>[...'abcdefgh'].map(f=>b.get(f+String(8-r))??'1').join('').replace(/1+/g,x=>String(x.length))).join('/')+` ${white?'w':'b'} - - 4 2`;
 let s=createGameState({fen,hands:{[owner]:['coup','under-elf-hill'],[other]:['peace-talks']}});const coup=s.players[owner].hand[0],peace:GameAction={type:'playCard',cardId:'peace-talks',target:coup.id};
 for(const a of [{type:'move',from:m('g1'),to:m('f1')},{type:'playCard',cardId:'coup',target:m('c3')},{type:'endTurn'},{type:'move',from:m('h7'),to:m('g6')}] as GameAction[])s=act(s,a);
 const control=act(s,peace);assert.equal(control.effects.some(e=>e.type==='coup'),false);assert.equal(control.pieces.find(p=>p.id===`${owner}-king-${m('g1')}`)?.royal,true);assert.equal(control.history.at(-1)?.type,'cardPlayed');
 for(const a of [{type:'endTurn'},{type:'playCard',cardId:'under-elf-hill'},{type:'endTurn'},{type:'move',from:m('g6'),to:m('h7')}] as GameAction[])s=act(s,a);
 const before=JSON.stringify(s),result=applyAction(s,peace);actions++;assert.equal(JSON.stringify(s),before);if(!result.ok)assert.deepEqual(result.state,s);
 observations.push({owner,role,result:result.ok?'accepted':result.error,listed:cardPlayTargets(s,'peace-talks').includes(coup.id),retainedCoup:s.effects.some((e:any)=>e.type==='coup'&&e.card.id===coup.id),prince:s.pieces.find(p=>p.id===`${owner}-king-${m('g1')}`),royal:s.pieces.find(p=>p.owner===owner&&p.royal),ownerChecked:isKingInCheck(s,owner)});groups++;
}
console.log(JSON.stringify({sentinel:'ELF_COUP_AWAY_CANCELLATION_OBSERVATION_DONE',groups,actions,observations,ms:performance.now()-started,scope:'Both-color three replacement roles, on-board cancellation controls versus temporary-absence rejection. Normative permission pending independent source review.'}));
