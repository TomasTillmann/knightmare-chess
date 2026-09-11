import assert from 'node:assert/strict';
import {applyAction,cardPlayTargets,isKingInCheck} from '../../src/game/reducer.js';
import {createGameState} from '../../src/game/state.js';
import type {GameAction,GameState} from '../../src/game/types.js';
const started=performance.now();let groups=0,actions=0;const observations:unknown[]=[];
function act(s:GameState,a:GameAction){const before=JSON.stringify(s),r=applyAction(s,a);assert.ok(r.ok,JSON.stringify({a,fen:s.fen,error:r.ok?null:r.error}));assert.equal(JSON.stringify(s),before);actions++;return r.state;}
for(const owner of ['white','black'] as const)for(const role of ['bishop','pawn']){
 const white=owner==='white',other=white?'black':'white',m=(s:string)=>white?s:s[0]+String(9-Number(s[1]));
 const b=new Map(Object.entries({g1:'K',h7:'k',c2:role==='bishop'?'B':'P',[role==='bishop'?'d3':'c3']:'N'}).map(([s,p])=>[m(s),white?p:p===p.toUpperCase()?p.toLowerCase():p.toUpperCase()]));
 const fen=Array.from({length:8},(_,r)=>[...'abcdefgh'].map(f=>b.get(f+String(8-r))??'1').join('').replace(/1+/g,x=>String(x.length))).join('/')+` ${white?'w':'b'} - - 4 2`;
 let s=createGameState({fen,hands:{[owner]:['coup','ghostwalk'],[other]:['peace-talks']}});const coup=s.players[owner].hand[0],pieceId=`${owner}-${role}-${m('c2')}`;
 for(const a of [{type:'move',from:m('g1'),to:m('f1')},{type:'playCard',cardId:'coup',target:m('c2')},{type:'endTurn'},{type:'move',from:m('h7'),to:m('g6')}] as GameAction[])s=act(s,a);
 let ordinary=act(s,{type:'playCard',cardId:'peace-talks',target:coup.id});ordinary=act(ordinary,{type:'endTurn'});s=act(s,{type:'endTurn'});
 assert.equal(s.pieces.find(p=>p.id===pieceId)?.royal,true);assert.equal(ordinary.pieces.find(p=>p.id===pieceId)?.royal,false);assert.equal(isKingInCheck(s,owner),false);
 const to=m(role==='bishop'?'e4':'c4'),a:GameAction={type:'playCard',cardId:'ghostwalk',target:[{from:m('c2'),to}]};
 const control=act(ordinary,a);assert.equal(control.history.at(-1)?.type,'cardPlayed');assert.equal(control.pieces.find(p=>p.id===pieceId)?.square,to);
 const before=JSON.stringify(s),royal=applyAction(s,a);actions++;assert.equal(JSON.stringify(s),before);if(!royal.ok)assert.deepEqual(royal.state,s);
 observations.push({owner,role,from:m('c2'),to,controlMoved:true,royal:royal.ok?'accepted':royal.error,listed:cardPlayTargets(s,'ghostwalk').some(x=>JSON.stringify(x)===JSON.stringify(a.target)),fen:s.fen});groups++;
}
console.log(JSON.stringify({sentinel:'GHOSTWALK_ROYAL_OBSERVATION_DONE',groups,actions,observations,ms:performance.now()-started,scope:'Real Coup royal Bishop/Pawn through friendly blocker, paired identical geometry after Peace Talks restores nonroyal status. No Under Elf Hill restriction in these fixtures.'}));
