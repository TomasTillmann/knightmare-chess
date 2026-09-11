import assert from 'node:assert/strict';
import {applyAction} from '../../src/game/reducer.js';
import {createGameState} from '../../src/game/state.js';
import type {GameAction,GameState} from '../../src/game/types.js';
const started=performance.now();let groups=0,actions=0,assertions=0;const observations:unknown[]=[];
function act(s:GameState,a:GameAction){const before=JSON.stringify(s),r=applyAction(s,a);assert.ok(r.ok,JSON.stringify({a,error:r.ok?null:r.error}));assert.equal(JSON.stringify(s),before);actions++;assertions+=2;return r.state;}
for(const color of ['white','black'] as const)for(const deckCount of [0,1,2]){
 const white=color==='white',other=white?'black':'white',m=(s:string)=>white?s:s[0]+String(9-Number(s[1]));
 const b=new Map(Object.entries({a1:'K',h8:'k',d3:'N',c1:'B',d5:'n'}).map(([s,p])=>[m(s),white?p:p===p.toUpperCase()?p.toLowerCase():p.toUpperCase()]));
 const board=Array.from({length:8},(_,r)=>[...'abcdefgh'].map(f=>b.get(f+String(8-r))??'1').join('').replace(/1+/g,x=>String(x.length))).join('/');
 let s=createGameState({fen:board+` ${white?'w':'b'} - - 0 1`,hands:{[color]:['dubbing','legacy']},decks:{[color]:['neutrality','pacifism'].slice(0,deckCount)}});
 const original=s.players[color].hand[0].id,all=[...s.players[color].hand,...s.players[color].deck].map(c=>c.id).sort();
 s=act(s,{type:'playCard',cardId:'dubbing',target:[{from:m('d3'),to:m('f4')}]});s=act(s,{type:'endTurn'});s=act(s,{type:'move',from:m('d5'),to:m('f4')});
 const beforeFen=s.fen,beforePieces=JSON.stringify(s.pieces),beforeHand=s.players[color].hand.length,beforeDeck=s.players[color].deck.length;
 s=act(s,{type:'playCard',cardId:'legacy',target:original});
 assert.equal(s.players[color].hand.length,beforeHand+(beforeDeck?1:0));assert.equal(s.players[color].deck.length,Math.max(0,beforeDeck-1));assert.equal(s.players[color].hand.filter(c=>c.id===original).length,1);assert.equal(s.players[color].discard.some(c=>c.id===original),false);assert.equal(s.fen,beforeFen);assert.equal(JSON.stringify(s.pieces),beforePieces);assert.deepEqual([...s.players[color].hand,...s.players[color].deck,...s.players[color].discard].map(c=>c.id).sort(),all);assertions+=7;
 s=act(s,{type:'endTurn'});s=act(s,{type:'playCard',cardId:'dubbing',cardInstanceId:original,target:[{from:m('c1'),to:m('d3')}]});assert.equal(s.pieces.find(p=>p.id===`${color}-bishop-${m('c1')}`)?.square,m('d3'));assertions++;groups++;
 let v=createGameState({fen:board+` ${white?'b':'w'} - - 0 1`,hands:{[color]:['vulture'],[other]:['dubbing']},decks:{[color]:['neutrality','pacifism'].slice(0,deckCount)}});
 const played=v.players[other].hand[0].id,vulture=v.players[color].hand[0].id,deck=v.players[color].deck.map(c=>c.id);
 v=act(v,{type:'playCard',cardId:'dubbing',target:[{from:m('d5'),to:m('f4')}]});const stableFen=v.fen;
 v=act(v,{type:'playCard',cardId:'vulture'});assert.equal(v.fen,stableFen);assert.equal(v.players[other].discard.some(c=>c.id===played),false);assert.deepEqual(v.players[color].hand.map(c=>c.id),deckCount===2?[deck[1],played]:[played]);assert.deepEqual(v.players[color].discard.map(c=>c.id),deckCount?[deck[0],vulture]:[vulture]);assert.equal(v.players[color].deck.length,0);assertions+=5;groups++;
 observations.push({color,deckCount,vultureAccepted:true,qualification:deckCount===0?'Acceptance without a top undrawn cost card is observed; source does not explicitly settle this case':'Top undrawn card cost and replacement draw are distinct'});
}
console.log(JSON.stringify({sentinel:'RETRIEVAL_EMPTY_DECK_DOMAIN_OK',groups,actions,assertions,observations,findings:0,ms:performance.now()-started}));
