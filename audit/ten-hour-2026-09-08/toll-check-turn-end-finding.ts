import assert from 'node:assert/strict';
import {applyAction,cardPlayTargets,isKingInCheck} from '../../src/game/reducer.js';
import {createGameState} from '../../src/game/state.js';
import type {GameAction,GameState} from '../../src/game/types.js';
const started=performance.now();let groups=0,actions=0,checkingPayments=0,declineControls=0;
function act(s:GameState,a:GameAction){const before=JSON.stringify(s),r=applyAction(s,a);assert.ok(r.ok,JSON.stringify({a,fen:s.fen,error:r.ok?null:r.error}));assert.equal(JSON.stringify(s),before);actions++;return r.state;}
for(const color of ['white','black'] as const)for(const exposing of [true,false]){
 const white=color==='white',other=white?'black':'white',m=(s:string)=>white?s:s[0]+String(9-Number(s[1]));
 const board=new Map(Object.entries({e1:'K',e2:'P',c3:'N',h8:'k',[exposing?'e8':'f8']:'r'}).map(([s,p])=>[m(s),white?p:p===p.toUpperCase()?p.toLowerCase():p.toUpperCase()]));
 const fen=Array.from({length:8},(_,r)=>[...'abcdefgh'].map(f=>board.get(f+String(8-r))??'1').join('').replace(/1+/g,x=>String(x.length))).join('/')+` ${white?'w':'b'} - - 0 1`;
 let s=createGameState({fen,hands:{[color]:[],[other]:['toll']}});assert.equal(isKingInCheck(s,color),false);assert.equal(isKingInCheck(s,other),false);
 s=act(s,{type:'move',from:m('c3'),to:m('d5')});assert.deepEqual(cardPlayTargets(s,'toll'),[undefined,m('e2')]);
 let decline=act(s,{type:'playCard',cardId:'toll'});assert.equal(decline.pieces.find(p=>p.id===`${color}-knight-${m('c3')}`)?.square,m('c3'));assert.equal(isKingInCheck(decline,color),false);decline=act(decline,{type:'endTurn'});assert.equal(decline.turn.color,other);declineControls++;
 s=act(s,{type:'playCard',cardId:'toll',target:m('e2')});assert.equal(s.history.at(-1)?.type,'cardPlayed');assert.equal(isKingInCheck(s,color),exposing);assert.equal(s.outcome,null);
 s=act(s,{type:'endTurn'});assert.equal(s.turn.color,other);assert.equal(s.outcome,null);
 s=act(s,{type:'move',from:m('h8'),to:m('g8')});s=act(s,{type:'endTurn'});assert.equal(s.turn.color,color);assert.equal(isKingInCheck(s,color),exposing);
 s=act(s,{type:'move',from:m('e1'),to:m('d1')});s=act(s,{type:'endTurn'});assert.equal(s.turn.color,other);assert.equal(isKingInCheck(s,color),false);assert.equal(s.outcome,null);if(exposing)checkingPayments++;
 groups++;
}
console.log(JSON.stringify({sentinel:'TOLL_CHECK_FORBIDDEN_TURN_END_REPRODUCED',groups,actions,checkingPayments,declineControls,findings:checkingPayments,ms:performance.now()-started,scope:'Checking payment wrongly closes turn under universal FAQ4; nonchecking and declined controls remain valid'}));
