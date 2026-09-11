import assert from 'node:assert/strict';
import {applyAction,doppelgangerDests} from '../../src/game/reducer.js';
import {createGameState} from '../../src/game/state.js';
import type {GameAction,GameState} from '../../src/game/types.js';
import type {SquareName} from 'chessops/types';
const started=performance.now();let groups=0,actions=0;const observations:unknown[]=[];
function act(s:GameState,a:GameAction){const r=applyAction(s,a);assert.ok(r.ok,JSON.stringify({a,error:r.ok?null:r.error}));actions++;return r.state;}
for(const color of ['white','black'] as const)for(const marker of ['none','crab','forbidden-city','fortification']){
 const white=color==='white',other=white?'black':'white',m=(s:string)=>(white?s:s[0]+String(9-Number(s[1]))) as SquareName;
 const board=new Map(Object.entries({c2:'K',a3:'R',h8:'k',f6:'n',h7:'p'}).map(([s,p])=>[m(s),white?p:p===p.toUpperCase()?p.toLowerCase():p.toUpperCase()]));
 const fen=Array.from({length:8},(_,r)=>[...'abcdefgh'].map(f=>board.get(f+String(8-r))??'1').join('').replace(/1+/g,x=>String(x.length))).join('/')+` ${white?'b':'w'} - - 0 1`;
 let s=createGameState({fen,hands:{[color]:['doppelganger'],[other]:marker==='none'?[]:[marker]}});s=act(s,{type:'move',from:m('f6'),to:m('h5')});
 if(marker!=='none')s=act(s,{type:'playCard',cardId:marker,target:marker==='crab'?m('h7'):marker==='forbidden-city'?m('d5'):{from:m('d5'),to:m('e5')}});
 s=act(s,{type:'endTurn'});const before=JSON.stringify(s),r=applyAction(s,{type:'playCard',cardId:'doppelganger',target:[{from:m('a3'),to:m('b5')}]});actions++;assert.equal(JSON.stringify(s),before);
 if(marker==='none'||marker==='crab'){assert.ok(r.ok);assert.equal(r.state.history.at(-1)?.type,'cardPlayed');assert.equal(r.state.pieces.find(p=>p.id===`${color}-rook-${m('a3')}`)?.square,m('b5'));}
 else{assert.equal(r.ok,false);assert.deepEqual(r.state,s);observations.push({color,marker,fen:s.fen,history:s.history.slice(-2),dests:doppelgangerDests(s,m('a3')),error:r.ok?null:r.error});}
 groups++;
}
console.log(JSON.stringify({sentinel:'DOPPELGANGER_PASSIVE_MARKER_OBSERVATION_DONE',groups,actions,observations,ms:performance.now()-started,qualification:'Source review supports retaining last-moved identity through nonmoving markers; exact card pairing is an inference from eligibility text, not an explicit FAQ pairing'}));
