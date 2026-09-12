import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction,isKingInCheck,legalDests} from '../reducer.js';
import type {GameAction,GameState,SquareName} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s);const r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
function sq(v:SquareName,mirror:boolean):SquareName{return mirror?(String.fromCharCode(201-v.charCodeAt(0))+v[1]) as SquareName:v;}
function position(royal=true,frozen=true,challenge=false,mirror=false){
 let s=createGameState({fen:mirror?'k7/8/8/5n2/5p2/8/6P1/K7 w - - 0 1':'7k/8/8/2n5/2p5/8/1P6/7K w - - 0 1',hands:{white:[...(royal?['coup']:[]),...(challenge?['challenge']:[])],black:frozen?['fatal-attraction']:[]}});
 s=act(s,{type:'move',from:sq('h1',mirror),to:sq('g1',mirror)});
 if(royal)s=act(s,{type:'playCard',cardId:'coup',target:sq('b2',mirror)});
 s=act(s,{type:'endTurn'});
 s=act(s,{type:'move',from:sq('h8',mirror),to:sq('g8',mirror)});
 if(frozen)s=act(s,{type:'playCard',cardId:'fatal-attraction',target:sq('c5',mirror)});
 return act(s,{type:'endTurn'});
}
const doubleStep=(mirror:boolean):GameAction=>({type:'move',from:sq('b2',mirror),to:sq('b4',mirror)});
// REGRESSION_CASES
for(const mirror of [false,true]){
 test(`frozen en-passant attacker permits royal double step (mirror=${mirror})`,()=>{
  const s=act(position(true,true,false,mirror),doubleStep(mirror));
  assert.equal(isKingInCheck(s,'white'),false);
 });
 test(`legal destinations include safe royal double step (mirror=${mirror})`,()=>{
  const s=position(true,true,false,mirror),before=structuredClone(s);
  assert.ok(legalDests(s).get(sq('b2',mirror))?.includes(sq('b4',mirror)));
  assert.deepEqual(s,before);
 });
 test(`frozen ordinary en-passant capture rejects atomically (mirror=${mirror})`,()=>{
  let s=act(position(false,true,false,mirror),doubleStep(mirror));
  s=act(s,{type:'endTurn'});
  const before=structuredClone(s);
  assert.equal(applyAction(s,{type:'move',from:sq('c4',mirror),to:sq('b3',mirror)}).ok,false);
  assert.deepEqual(s,before);
 });
 test(`unrestricted en-passant threat rejects royal double step atomically (mirror=${mirror})`,()=>{
  const s=position(true,false,false,mirror),before=structuredClone(s);
  assert.equal(applyAction(s,doubleStep(mirror)).ok,false);
  assert.deepEqual(s,before);
 });
 test(`Challenge rescues royal double step from en-passant threat (mirror=${mirror})`,()=>{
  let s=act(position(true,false,true,mirror),doubleStep(mirror));
  s=act(s,{type:'playCard',cardId:'challenge',target:sq('c5',mirror)});
  assert.equal(isKingInCheck(s,'white'),false);
  act(s,{type:'endTurn'});
 });
}
