import assert from 'node:assert/strict';
import {applyAction,isKingInCheck,legalDests} from '../../src/game/reducer.js';
import {createGameState} from '../../src/game/state.js';
import type {GameAction,GameState} from '../../src/game/types.js';
const started=performance.now();let groups=0,actions=0,confirmed=0;
function act(s:GameState,a:GameAction){const before=JSON.stringify(s),r=applyAction(s,a);assert.ok(r.ok,JSON.stringify({a,fen:s.fen,error:r.ok?null:r.error}));assert.equal(JSON.stringify(s),before);actions++;return r.state;}
for(const color of ['white','black'] as const)for(const copied of [false,true]){
 const white=color==='white',other=white?'black':'white',m=(s:string)=>white?s:s[0]+String(9-Number(s[1]));
 const board=new Map(Object.entries({e1:'K',e2:'P',b2:'P',c3:'N',h8:'k',e8:'r'}).map(([s,p])=>[m(s),white?p:p===p.toUpperCase()?p.toLowerCase():p.toUpperCase()]));
 const fen=Array.from({length:8},(_,r)=>[...'abcdefgh'].map(f=>board.get(f+String(8-r))??'1').join('').replace(/1+/g,x=>String(x.length))).join('/')+` ${white?'w':'b'} - - 0 1`;
 let s=createGameState({fen,hands:{[color]:[],[other]:['toll',copied?'haunting-memories':'toll']}});
 const prep:GameAction[]=[{type:'move',from:m('c3'),to:m('d5')},{type:'playCard',cardId:'toll',target:m('b2')},{type:'endTurn'},{type:'move',from:m('h8'),to:m('g8')},{type:'endTurn'},{type:'move',from:m('d5'),to:m('c3')},{type:'endTurn'},{type:'move',from:m('g8'),to:m('h8')},{type:'endTurn'},{type:'move',from:m('c3'),to:m('d5')}];
 for(const a of prep)s=act(s,a);
 s=act(s,{type:'playCard',cardId:copied?'haunting-memories':'toll',target:m('e2')});assert.equal(s.history.at(-1)?.type,'cardPlayed');assert.equal(isKingInCheck(s,color),true);assert.equal(s.outcome,null);
 const end=applyAction(s,{type:'endTurn'});actions++;assert.equal(end.ok,!copied);
 if(copied){assert.equal(s.history.at(-1)?.copiedCardId,'toll');assert.equal(s.turn.moveMade,true);assert.equal(s.players[color].hand.length,0);assert.equal(s.players[other].hand.length,0);assert.equal(legalDests(s).size,0);assert.equal(end.ok?null:end.error.code,'KING_IN_CHECK');assert.deepEqual(end.state,s);confirmed++;console.log(JSON.stringify({finding:'COPIED_TOLL_CHECK_DEADLOCK',color,initialFen:fen,finalFen:s.fen,event:s.history.at(-1),endError:end.ok?null:end.error}));}
 groups++;
}
console.log(JSON.stringify({sentinel:'HAUNTING_TOLL_CHECK_REPRODUCED',groups,actions,confirmed,ms:performance.now()-started,scope:'Printed same-effect copying loses the plain Toll ability to close a checked turn, both colors'}));
