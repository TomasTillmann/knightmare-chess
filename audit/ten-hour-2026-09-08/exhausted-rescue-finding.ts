import assert from 'node:assert/strict';
import { applyAction,cardPlayTargets,isKingInCheck,legalDests } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction,GameState } from '../../src/game/types.js';
const started=performance.now();let actions=0;
function act(state:GameState,action:GameAction):GameState {const before=JSON.stringify(state),r=applyAction(state,action);assert.ok(r.ok,JSON.stringify({action,error:r.ok?undefined:r.error}));assert.equal(JSON.stringify(state),before);actions++;return r.state;}
let state=createGameState({fen:'Qnk5/8/1r6/4p3/8/8/8/4K3 b - - 0 1',hands:{black:['coup','pacifism','hidden-passage']}});
const preparation:GameAction[]=[{type:'move',from:'c8',to:'d8'},{type:'playCard',cardId:'coup',target:'e5'},{type:'endTurn'},{type:'move',from:'a8',to:'d5'},{type:'endTurn'}];
for(const action of preparation)state=act(state,action);
assert.equal(isKingInCheck(state,'black'),true);assert.equal(legalDests(state,false).size,0);assert.equal(state.outcome,null);
const saved=state;
const escape=act(state,{type:'playCard',cardId:'hidden-passage',target:[{from:'e5',to:'h7'}]});
assert.equal(isKingInCheck(escape,'black'),false);act(escape,{type:'endTurn'});
state=act(saved,{type:'playCard',cardId:'pacifism',target:'b6'});
const ordinary=[...legalDests(state)],cardResults:unknown[]=[];
for(const card of state.players.black.hand)for(const target of cardPlayTargets(state,card.cardId)) {
  const result=applyAction(state,{type:'playCard',cardId:card.cardId,cardInstanceId:card.id,target});
  if(result.ok)cardResults.push({card:card.cardId,target,event:result.state.history.at(-1),outcome:result.state.outcome});
}
const end=applyAction(state,{type:'endTurn'}),stuck=isKingInCheck(state,'black')&&ordinary.length===0&&cardResults.length===0&&!end.ok&&state.outcome===null;
console.log(JSON.stringify({sentinel:'EXHAUSTED_RESCUE_PROBES_DONE',groups:1,actions,preparation,fen:state.fen,turn:state.turn,outcome:state.outcome,inCheck:isKingInCheck(state,'black'),ordinary,acceptedCardActions:cardResults,endTurn:end.ok?'accepted':end.error,stuck,ms:performance.now()-started}));
if(stuck)process.exitCode=1;
for(const defender of ['black','white'] as const) {
  const mirror=(s:string)=>defender==='black'?s:s[0]+String(9-Number(s[1]));
  const board=new Map([['a8','k'],['c7','Q'],['c6','K'],['h4','r']].map(([s,p])=>[mirror(s),defender==='black'?p:p===p.toUpperCase()?p.toLowerCase():p.toUpperCase()]));
  const fen=Array.from({length:8},(_,row)=>[...'abcdefgh'].map(f=>board.get(f+String(8-row))??'1').join('').replace(/1+/g,m=>String(m.length))).join('/')+` ${defender==='black'?'w':'b'} - - 0 1`;
  let minimal=createGameState({fen,hands:{[defender]:['pacifism','hidden-passage']}});
  minimal=act(minimal,{type:'move',from:mirror('c7'),to:mirror('b7')});minimal=act(minimal,{type:'endTurn'});
  assert.equal(isKingInCheck(minimal,defender),true);assert.equal(legalDests(minimal,false).size,0);assert.equal(minimal.outcome,null);
  const rescueAction:GameAction={type:'playCard',cardId:'hidden-passage',target:[{from:mirror('a8'),to:mirror('h8')}]};
  const rescued=act(minimal,rescueAction);assert.equal(isKingInCheck(rescued,defender),false);act(rescued,{type:'endTurn'});
  const spent=act(minimal,{type:'playCard',cardId:'pacifism',target:mirror('h4')}),remainingRescue=applyAction(spent,rescueAction),end=applyAction(spent,{type:'endTurn'});
  assert.equal(remainingRescue.ok,false);assert.equal(end.ok,false);assert.equal(legalDests(spent).size,0);assert.equal(isKingInCheck(spent,defender),true);
  console.log(JSON.stringify({sentinel:'EXHAUSTED_RESCUE_FOUR_PIECE_CASE',defender,initialFen:fen,finalFen:spent.fen,turn:spent.turn,outcome:spent.outcome,remainingRescue:remainingRescue.ok?'accepted':remainingRescue.error,endTurn:end.ok?'accepted':end.error,stuck:spent.outcome===null}));
  if(spent.outcome===null)process.exitCode=1;
}
console.log(JSON.stringify({sentinel:'EXHAUSTED_RESCUE_ALL_DONE',groups:3,actions,ms:performance.now()-started}));
