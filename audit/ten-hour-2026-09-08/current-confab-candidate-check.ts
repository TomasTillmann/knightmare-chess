import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root='/Users/tomastillmann/Random/knightmare-chess',reducer=root+'/src/game/reducer.ts',hash=()=>createHash('sha256').update(readFileSync(reducer)).digest('hex'),beforeHash=hash();
assert.equal(beforeHash,'6ddff1fe91ef32c353cf34f9fa4519506e2151a63a35ac484d637b19a24a1ce0','Candidate changed; do not attribute results to the observed revision');
const {applyAction,isKingInCheck}=await import(pathToFileURL(reducer).href),{createGameState}=await import(pathToFileURL(root+'/src/game/state.ts').href);
const started=performance.now();let groups=0,assertions=0,actions=0;
for(const color of ['white','black'] as const){
 const white=color==='white',other=white?'black':'white',m=(s:string)=>white?s:s[0]+String(9-Number(s[1]));
 function fen(original:Record<string,string>){const b=new Map(Object.entries(original).map(([s,p])=>[m(s),white?p:p===p.toUpperCase()?p.toLowerCase():p.toUpperCase()]));return Array.from({length:8},(_,r)=>[...'abcdefgh'].map(f=>b.get(f+String(8-r))??'1').join('').replace(/1+/g,x=>String(x.length))).join('/')+` ${white?'w':'b'} - - 0 1`;}
 for(const escape of [false,true]){
  const state=createGameState({fen:fen({a8:'k',a7:'p',b7:'p',h8:'B',e1:'K',h1:'R'}),hands:{[color]:['confabulation'],[other]:escape?['hidden-passage']:[]}}),before=JSON.stringify(state);
  const merged=applyAction(state,{type:'playCard',cardId:'confabulation',target:[{from:m('h1'),to:m('h8')}]});actions++;assert.ok(merged.ok);assert.equal(JSON.stringify(state),before);assert.equal(merged.state.history.at(-1)?.type,'cardPlayed');assert.equal(merged.state.effects.filter((e:any)=>e.type==='confabulation').length,1);assert.equal(merged.state.pieces.find((p:any)=>p.id===`${color}-rook-${m('h1')}`)?.zone,'away');assert.equal(isKingInCheck(merged.state,other),true);assertions+=6;
  const ended=applyAction(merged.state,{type:'endTurn'});actions++;assert.ok(ended.ok);assertions++;
  if(!escape){assert.deepEqual(ended.state.outcome,{winner:color,reason:'checkmate'});assertions++;}
  else{assert.equal(ended.state.outcome,null);const rescued=applyAction(ended.state,{type:'playCard',cardId:'hidden-passage',target:[{from:m('a8'),to:m('a6')}]});actions++;assert.ok(rescued.ok);assert.equal(isKingInCheck(rescued.state,other),false);assert.equal(rescued.state.pieces.find((p:any)=>p.id===`${other}-king-${m('a8')}`)?.square,m('a6'));assertions+=4;}
  groups++;
 }
 const s=createGameState({fen:fen({a8:'k',e8:'r',e1:'K',e2:'R',c2:'N'}),hands:{[color]:['confabulation']}}),result=applyAction(s,{type:'playCard',cardId:'confabulation',target:[{from:m('e2'),to:m('c2')}]});actions++;assert.ok(result.ok);assert.equal(result.state.history.at(-1)?.type,'cardFizzled');assert.equal(result.state.history.at(-1)?.reason,'SELF_CHECK');assert.deepEqual(result.state.pieces,s.pieces);assert.equal(result.state.players[color].hand.length,0);assertions+=5;groups++;
}
assert.equal(hash(),beforeHash);
console.log(JSON.stringify({sentinel:'CURRENT_CONFAB_CANDIDATE_OK',reducerSha256:beforeHash,groups,actions,assertions,findings:0,ms:performance.now()-started,scope:'External uncommitted four-line candidate; targeted public-API verification only, not a full engine phase gate'}));
