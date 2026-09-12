import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction,cardPlayTargets,isKingInCheck} from '../reducer.js';
import type {GameAction,GameState} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s);const r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
function position(cardId:string,mate=false){
 let s=createGameState({fen:mate?'k5rr/8/8/8/8/5P2/PP2PP2/5RNK w - - 0 1':'k5r1/8/8/8/8/8/PP6/6NK w - - 0 1',hands:{white:['coup','confabulation',cardId],black:mate?['plots-within-plots','mystic-shield','earthquake']:['earthquake']}});
 const opening:GameAction[]=[{type:'move',from:'b2',to:'b3'},{type:'playCard',cardId:'coup',target:'a2'},{type:'endTurn'},{type:'move',from:'a8',to:'b8'},{type:'endTurn'},{type:'playCard',cardId:'confabulation',target:[{from:'h1',to:'g1'}]},{type:'endTurn'}];
 const reply:GameAction[]=mate?[{type:'move',from:'h8',to:'h1'},{type:'playCard',cardId:'plots-within-plots'},{type:'playCard',cardId:'mystic-shield',target:'h1'}]:[{type:'move',from:'b8',to:'c8'}];
 const actions:GameAction[]=[...opening,...reply,{type:'playCard',cardId:'earthquake',target:{direction:'clockwise',promotions:[{square:'a2',role:'rook'}]}},{type:'endTurn'}];
 return actions.reduce(act,s);
}
function escape(cardId:string,target:unknown,mate=false){
 const state=position(cardId,mate);
 assert.equal(state.outcome,null);
 return act(state,{type:'playCard',cardId,...(target===undefined?{}:{target})});
}
function squareOf(s:GameState,id:string){return s.pieces.find(p=>p.id===id)?.square;}
function zoneOf(s:GameState,id:string){return s.pieces.find(p=>p.id===id)?.zone;}
// REGRESSION_CASES
for(const to of ['f1','e2','c4'])test(`Hidden Passage carries a restored composite King to ${to}`,()=>{
 const s=escape('hidden-passage',[{from:'g1',to}]);
 assert.equal(squareOf(s,'white-knight-g1'),to);
 assert.equal(isKingInCheck(s,'white'),false);
});
test('Hidden Passage query exposes a restored composite King escape',()=>{
 assert.ok(cardPlayTargets(position('hidden-passage'),'hidden-passage').some(t=>JSON.stringify(t)===JSON.stringify([{from:'g1',to:'f1'}])));
});
test('Under Elf Hill removes the restored composite King carrier',()=>{
 const s=escape('under-elf-hill',undefined);
 assert.equal(zoneOf(s,'white-knight-g1'),'away');
 assert.equal(isKingInCheck(s,'white'),false);
});
test('Under Elf Hill query exposes the restored composite King escape',()=>{
 assert.deepEqual(cardPlayTargets(position('under-elf-hill'),'under-elf-hill'),[undefined]);
});
test('Man of Straw swaps the restored composite King carrier',()=>{
 const s=escape('man-of-straw',{king:'g1',pawn:'b3'});
 assert.equal(squareOf(s,'white-knight-g1'),'b3');
 assert.equal(squareOf(s,'white-pawn-b2'),'g1');
 assert.equal(isKingInCheck(s,'white'),false);
});
for(const [cardId,target] of [
 ['hidden-passage',[{from:'g1',to:'c4'}]],
 ['under-elf-hill',undefined],
 ['man-of-straw',{king:'g1',pawn:'f3'}],
] as const)test(`${cardId} prevents premature mate with a restored composite King`,()=>{
 const s=escape(cardId,target,true);
 assert.equal(isKingInCheck(s,'white'),false);
});
