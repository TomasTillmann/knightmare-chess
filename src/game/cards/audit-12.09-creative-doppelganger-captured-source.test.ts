// Unfixed audit regressions, 12.09.2026; production baseline c0c90b3.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction,cardPlayTargets} from '../reducer.js';
import type {GameAction,GameState,SquareName} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s),r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
function position(){
 let s=createGameState({fen:'1n5k/8/8/8/8/8/8/2RB3K b - - 0 1',hands:{white:['plots-within-plots','evil-eye','doppelganger','dubbing']}});
 s=act(s,{type:'move',from:'b8',to:'c6'});s=act(s,{type:'endTurn'});
 return act(s,{type:'playCard',cardId:'plots-within-plots'});
}
const captureSource=(s:GameState)=>act(s,{type:'playCard',cardId:'evil-eye',target:{attacker:'c1',victim:'c6'}});
const copy=(s:GameState,to:SquareName)=>act(s,{type:'playCard',cardId:'doppelganger',target:[{from:'d1',to}]});
// RULE INTERPRETATION (12.09.2026): printed Doppelganger copies the last opponent
// mover's kind, with no source-survival condition; §17.3 preserves eligibility.
// This captured-source consequence is an interpretation, not an explicit FAQ example.
for(const to of ['b2','f2','c3','e3'] as const)test(`captured historical Knight still supplies ${to}`,()=>{
 const s=captureSource(position());const next=copy(s,to);
 assert.equal(next.pieces.find(p=>p.id==='white-bishop-d1')?.square,to);
});
for(const to of ['f2','b2'] as const)test(`surviving historical Knight supplies ${to}`,()=>{
 const next=copy(position(),to);assert.equal(next.pieces.find(p=>p.id==='white-bishop-d1')?.square,to);
});
test('captured historical source still offers the Bishop Knight jump',()=>{
 const s=captureSource(position());
 assert.ok(cardPlayTargets(s,'doppelganger').some(target=>JSON.stringify(target)===JSON.stringify([{from:'d1',to:'f2'}])));
});
test('an intervening Dubbing move retains the original opposing Knight kind',()=>{
 const s=act(position(),{type:'playCard',cardId:'dubbing',target:[{from:'c1',to:'b3'}]});
 const next=copy(s,'f2');assert.equal(next.pieces.find(p=>p.id==='white-bishop-d1')?.square,'f2');
});
test('capture preserves the historical kind, eligible physical card and remaining play',()=>{
 const before=position(), knight=before.pieces.find(p=>p.square==='c6')!;
 const card=before.players.white.hand.find(c=>c.cardId==='doppelganger')!;
 const s=captureSource(before),captured=s.pieces.find(p=>p.id===knight.id)!;
 assert.equal(captured.zone,'captured');assert.equal(captured.role,'knight');assert.equal(captured.square,null);
 assert.equal(s.pieces.find(p=>p.id==='white-bishop-d1')?.square,'d1');
 assert.ok(s.players.white.hand.some(c=>c.id===card.id));
 assert.equal(s.plotsAllowances?.at(-1)?.remaining,1);
 assert.ok(s.plotsAllowances?.at(-1)?.eligibleCards.includes(card.id));
});
test('Rook geometry remains rejected atomically',()=>{
 const s=position(),before=structuredClone(s);
 const result=applyAction(s,{type:'playCard',cardId:'doppelganger',target:[{from:'d1',to:'d4'}]});
 assert.equal(result.ok,false);assert.deepEqual(s,before);assert.deepEqual(result.state,before);
});
