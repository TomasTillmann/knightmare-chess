import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction, GameState } from '../../src/game/types.js';
const started=performance.now(); let actions=0;
function act(state:GameState,action:GameAction):GameState {
  const before=JSON.stringify(state),result=applyAction(state,action);
  assert.ok(result.ok,JSON.stringify({action,error:result.ok?undefined:result.error}));
  assert.equal(JSON.stringify(state),before);actions++;return result.state;
}
const traps=(s:GameState)=>s.effects.filter((e:any)=>e.type==='man-trap').length;
const findings:unknown[]=[];
for(const mode of ['king','royal-knight','ordinary-knight']) {
  let state=createGameState({fen:mode==='king'?'8/8/8/3k1n2/3P4/8/8/7K w - - 0 1':'7k/8/8/5n2/3P4/8/8/7K b - - 0 1',hands:{white:['man-trap'],black:mode==='royal-knight'?['coup']:[]}});
  if(mode!=='king') {
    state=act(state,{type:'move',from:'h8',to:'g8'});
    if(mode==='royal-knight')state=act(state,{type:'playCard',cardId:'coup',target:'f5'});
    state=act(state,{type:'endTurn'});
  }
  state=act(state,{type:'move',from:'h1',to:'g1'});
  state=act(state,{type:'playCard',cardId:'man-trap',target:'d4'});
  assert.equal(traps(state),1);state=act(state,{type:'endTurn'});
  state=act(state,{type:'move',from:mode==='king'?'d5':'f5',to:'d4'});
  const entrant=state.pieces.find(p=>p.id===(mode==='king'?'black-king-d5':'black-knight-f5'))!;
  assert.equal(state.pieces.find(p=>p.id==='white-pawn-d4')?.zone,'captured');
  if(mode==='ordinary-knight') {assert.equal(entrant.zone,'captured');assert.equal(traps(state),0);}
  else {assert.equal(entrant.zone,'board');assert.equal(entrant.royal,true);if(traps(state)!==1)findings.push({mode,problem:'Royal entrant consumes Man-Trap despite FAQ40/46 no-trigger ruling',traps:traps(state)});}
  if(mode==='king') {
    for(const action of [{type:'endTurn'},{type:'move',from:'g1',to:'f1'},{type:'endTurn'},{type:'move',from:'d4',to:'c5'},{type:'endTurn'},{type:'move',from:'f1',to:'g1'},{type:'endTurn'},{type:'move',from:'f5',to:'d4'}] as GameAction[])state=act(state,action);
    if(state.pieces.find(p=>p.id==='black-knight-f5')?.zone!=='captured')findings.push({mode,problem:'Later ordinary Knight survives previously royal-entered trap'});
  }
}
for(const order of ['pacifism-first','trap-first']) {
  let state=createGameState({fen:`7k/8/8/5n2/3P4/8/8/7K ${order==='pacifism-first'?'b':'w'} - - 0 1`,hands:{white:['man-trap'],black:['pacifism']}});
  if(order==='pacifism-first') {
    state=act(state,{type:'playCard',cardId:'pacifism',target:'f5'});
    state=act(state,{type:'move',from:'h8',to:'g8'});state=act(state,{type:'endTurn'});
  }
  state=act(state,{type:'move',from:'h1',to:'g1'});
  state=act(state,{type:'playCard',cardId:'man-trap',target:'d4'});state=act(state,{type:'endTurn'});
  if(order==='trap-first')state=act(state,{type:'playCard',cardId:'pacifism',target:'f5'});
  state=act(state,{type:'move',from:order==='trap-first'?'h8':'g8',to:order==='trap-first'?'g8':'h8'});
  state=act(state,{type:'endTurn'});state=act(state,{type:'move',from:'d4',to:'d5'});state=act(state,{type:'endTurn'});
  state=act(state,{type:'move',from:'f5',to:'d4'});
  const zone=state.pieces.find(p=>p.id==='black-knight-f5')?.zone;
  if(zone!=='board'||traps(state)!==1)findings.push({order,problem:'Pacifist entrant must survive and leave trap active under FAQ40/46',zone,traps:traps(state)});
}
console.log(JSON.stringify({sentinel:'MAN_TRAP_KING_DOMAIN_DONE',groups:5,actions,findings,ms:performance.now()-started}));
if(findings.length)process.exitCode=1;
