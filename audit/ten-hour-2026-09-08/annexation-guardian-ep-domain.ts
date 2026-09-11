import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction,GameState } from '../../src/game/types.js';
const started=performance.now();let groups=0,actions=0,assertions=0;
const observations:unknown[]=[];
function act(state:GameState,action:GameAction):GameState {const before=JSON.stringify(state),r=applyAction(state,action);assert.ok(r.ok,JSON.stringify({action,error:r.ok?undefined:r.error}));assert.equal(JSON.stringify(state),before);actions++;assertions+=2;return r.state;}
for(const color of ['white','black'] as const) {
  const white=color==='white',mirror=(s:string)=>white?s:s[0]+String(9-Number(s[1]));
  function fen(original:Record<string,string>):string {const board=new Map(Object.entries(original).map(([s,p])=>[mirror(s),white?p:p===p.toUpperCase()?p.toLowerCase():p.toUpperCase()]));return Array.from({length:8},(_,row)=>[...'abcdefgh'].map(f=>board.get(f+String(8-row))??'1').join('').replace(/1+/g,m=>String(m.length))).join('/')+` ${white?'w':'b'} - - 0 1`;}
  for(const rank of [1,2]) {
    const original={c6:'K',h6:'k',[`e${rank}`]:'P',[`g${rank}`]:'P',[`f${rank+2}`]:'p'};
    let state=createGameState({fen:fen(original),hands:{[color]:['annexation']}});
    state=act(state,{type:'playCard',cardId:'annexation',target:[{from:mirror(`e${rank}`),to:mirror(`e${rank+2}`)},{from:mirror(`g${rank}`),to:mirror(`g${rank+2}`)}]});
    assert.deepEqual(state.enPassant.map(e=>e.target).sort(),rank===2?[mirror(`e${rank+1}`),mirror(`g${rank+1}`)].sort():[]);assertions++;
    state=act(state,{type:'endTurn'});
    for(const file of ['e','g']) {
      if(rank===1){const before=JSON.stringify(state),r=applyAction(state,{type:'move',from:mirror(`f${rank+2}`),to:mirror(`${file}${rank+1}`)});assert.equal(r.ok,false);assert.equal(JSON.stringify(state),before);assert.deepEqual(r.state,state);assertions+=3;continue;}
      const capture=act(state,{type:'move',from:mirror(`f${rank+2}`),to:mirror(`${file}${rank+1}`)});
      assert.equal(capture.pieces.find(p=>p.id===`${color}-pawn-${mirror(`${file}${rank}`)}`)?.zone,'captured');
      assert.equal(capture.pieces.find(p=>p.id===`${color}-pawn-${mirror(`${file==='e'?'g':'e'}${rank}`)}`)?.zone,'board');assert.equal(capture.enPassant.length,0);assertions+=3;
    }
    const declined=act(state,{type:'move',from:mirror(`f${rank+2}`),to:mirror(`f${rank+1}`)});assert.equal(declined.enPassant.length,0);assertions++;
    observations.push({color,card:'annexation',rank,rights:rank===2?2:0,eachCaptureOptionWorks:rank===2,qualification:rank===1?'Observed first-rank double advance grants no en-passant rights; publisher interpretation remains qualified':'Second-rank capture eligibility follows explicit card text'});groups++;
  }
  for(const follower of ['none','knight','safe-king','attacked-king']) {
    const royal=follower.includes('king');
    const original:Record<string,string>={h6:'k',e2:'P',[follower==='safe-king'?'a4':'d4']:'p',[royal?'e1':'c6']:'K'};
    if(follower==='knight')original.e1='N';
    let state=createGameState({fen:fen(original),hands:{[color]:['guardian']}});
    const target=[{from:mirror('e2'),to:mirror('e4')}];if(follower!=='none')target.push({from:mirror('e1'),to:mirror('e3')});
    const result=applyAction(state,{type:'playCard',cardId:'guardian',target});assert.ok(result.ok,JSON.stringify({color,follower,error:result.ok?undefined:result.error}));assertions++;
    if(follower==='attacked-king') {
      assert.equal(result.state.history.at(-1)?.type,'cardFizzled');assert.equal(result.state.history.at(-1)?.reason,'SELF_CHECK');
      assert.equal(result.state.pieces.find(p=>p.id===`${color}-king-${mirror('e1')}`)?.square,mirror('e1'));assert.equal(result.state.pieces.find(p=>p.id===`${color}-pawn-${mirror('e2')}`)?.square,mirror('e2'));assertions+=4;groups++;continue;
    }
    state=result.state;assert.equal(state.pieces.find(p=>p.id===`${color}-pawn-${mirror('e2')}`)?.square,mirror('e4'));assert.equal(state.enPassant.length,0);assertions+=2;
    if(follower!=='none'){assert.equal(state.pieces.find(p=>p.id===`${color}-${royal?'king':'knight'}-${mirror('e1')}`)?.square,mirror('e3'));assertions++;}
    state=act(state,{type:'endTurn'});
    if(follower==='none') {
      const capture=applyAction(state,{type:'move',from:mirror('d4'),to:mirror('e3')});assert.equal(capture.ok,false);assert.deepEqual(capture.state,state);assertions+=2;
      observations.push({color,card:'guardian',follower,epRejected:true,qualification:'No-follower immunity is observed; publisher wording does not explicitly settle it'});
    }
    if(follower==='knight') {
      state=act(state,{type:'move',from:mirror('d4'),to:mirror('e3')});assert.equal(state.pieces.find(p=>p.id===`${color}-knight-${mirror('e1')}`)?.zone,'captured');assert.equal(state.pieces.find(p=>p.id===`${color}-pawn-${mirror('e2')}`)?.zone,'board');assertions+=2;
    }
    groups++;
  }
}
console.log(JSON.stringify({sentinel:'ANNEXATION_GUARDIAN_EP_DOMAIN_OK',groups,actions,assertions,observations,findings:0,ms:performance.now()-started}));
