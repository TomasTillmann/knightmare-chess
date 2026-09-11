import assert from 'node:assert/strict';
import {applyAction} from '../../src/game/reducer.js';
import {createGameState} from '../../src/game/state.js';
import type {GameAction,GameState} from '../../src/game/types.js';
const started=performance.now();let groups=0,actions=0,confirmed=0,directRejections=0,opponentCopies=0;
function act(s:GameState,a:GameAction){const before=JSON.stringify(s),r=applyAction(s,a);assert.ok(r.ok,JSON.stringify({a,fen:s.fen,error:r.ok?null:r.error}));assert.equal(JSON.stringify(s),before);actions++;return r.state;}
for(const owner of ['white','black'] as const)for(const intermediary of [false,true]){
 const white=owner==='white',other=white?'black':'white',m=(s:string)=>white?s:s[0]+String(9-Number(s[1]));
 let s=createGameState({fen:white?'7k/8/8/8/8/8/8/K7 w - - 0 1':'k7/8/8/8/8/8/8/7K b - - 0 1',hands:{[owner]:['vendetta','haunting-memories'],[other]:intermediary?['haunting-memories']:[]}});
 const uniqueId=s.players[owner].hand.find(c=>c.cardId==='vendetta')!.id,copyId=s.players[owner].hand.find(c=>c.cardId==='haunting-memories')!.id;
 s=act(s,{type:'move',from:m('a1'),to:m('b1')});s=act(s,{type:'playCard',cardId:'vendetta'});s=act(s,{type:'endTurn'});s=act(s,{type:'move',from:m('h8'),to:m('g8')});
 if(intermediary){s=act(s,{type:'playCard',cardId:'haunting-memories'});assert.equal(s.history.at(-1)?.type,'cardPlayed');assert.equal(s.history.at(-1)?.copiedCardId,'vendetta');opponentCopies++;}
 s=act(s,{type:'endTurn'});s=act(s,{type:'move',from:m('b1'),to:m('a1')});const before=JSON.stringify(s),r=applyAction(s,{type:'playCard',cardId:'haunting-memories'});actions++;
 assert.equal(JSON.stringify(s),before);assert.equal(r.ok,intermediary);
 if(!intermediary){assert.deepEqual(r.state,s);assert.equal(r.ok?null:r.error.code,'INVALID_TARGET');directRejections++;}
 else {assert.equal(r.state.history.at(-1)?.type,'cardPlayed');assert.equal(r.state.history.at(-1)?.copiedCardId,'vendetta');assert.ok(r.state.effects.some((e:any)=>e.type==='vendetta'&&e.card?.id===copyId));confirmed++;console.log(JSON.stringify({finding:'OWN_UNIQUE_COPY_CHAIN_BYPASS',owner,uniqueId,copyId,events:r.state.history.filter(e=>e.type==='cardPlayed'),effects:r.state.effects,expected:'The original-deck unique prohibition survives an intermediate opposing copy (FAQ34 general rule)'}));}
 groups++;
}
console.log(JSON.stringify({sentinel:'HAUNTING_UNIQUE_CHAIN_REPRODUCED',groups,actions,confirmed,directRejections,opponentCopies,ms:performance.now()-started}));
