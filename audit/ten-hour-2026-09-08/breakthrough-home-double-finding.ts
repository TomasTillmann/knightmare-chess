import assert from 'node:assert/strict';
import {applyAction,breakthroughDests} from '../../src/game/reducer.js';
import {createGameState} from '../../src/game/state.js';
import type {SquareName} from 'chessops/types';
const start=performance.now();let groups=0,probes=0,confirmed=0;
for(const color of ['white','black'] as const)for(const mode of ['home-double','single','blocked-double','nonhome-double']){
 const white=color==='white',m=(s:string)=>(white?s:s[0]+String(9-Number(s[1]))) as SquareName,from=mode==='nonhome-double'?'e3':'e2',to=mode==='single'?'e3':mode==='nonhome-double'?'e5':'e4';
 const board=new Map(Object.entries({a1:'K',h8:'k',[from]:'P',[to]:'n',...(mode==='blocked-double'?{e3:'B'}:{})}).map(([s,p])=>[m(s),white?p:p===p.toUpperCase()?p.toLowerCase():p.toUpperCase()]));
 const fen=Array.from({length:8},(_,r)=>[...'abcdefgh'].map(f=>board.get(f+String(8-r))??'1').join('').replace(/1+/g,x=>String(x.length))).join('/')+` ${white?'w':'b'} - - 0 1`;
 const s=createGameState({fen,hands:{[color]:['breakthrough']}}),before=JSON.stringify(s),dests=breakthroughDests(s,m(from)),r=applyAction(s,{type:'playCard',cardId:'breakthrough',target:[{from:m(from),to:m(to)}]});probes++;
 assert.equal(JSON.stringify(s),before);
 if(mode==='single'){
  assert.ok(r.ok);assert.equal(r.state.history.at(-1)?.type,'cardPlayed');assert.equal(r.state.pieces.find(p=>p.id===`${color}-pawn-${m(from)}`)?.square,m(to));assert.equal(r.state.pieces.find(p=>p.id===`${white?'black':'white'}-knight-${m(to)}`)?.zone,'captured');assert.ok(dests.includes(m(to)));
 }else{
  assert.equal(r.ok,false);assert.deepEqual(r.state,s);assert.equal(dests.includes(m(to)),false);
  if(mode==='home-double'){confirmed++;console.log(JSON.stringify({finding:'BREAKTHROUGH_HOME_DOUBLE_REJECTED',color,fen,from:m(from),to:m(to),error:r.ok?null:r.error,advertised:dests,source:'Official FAQ page14 explicitly permits a home-rank Pawn to capture with a two-square forward move'}));}
 }
 groups++;
}
console.log(JSON.stringify({sentinel:'BREAKTHROUGH_HOME_DOUBLE_FINDING_REPRODUCED',groups,probes,confirmed,ms:performance.now()-start}));
