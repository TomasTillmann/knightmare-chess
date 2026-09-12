// Unfixed audit regression, 12.09.2026; trap interaction is a documented inference.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction} from '../reducer.js';
import type {GameAction,GameState,SquareName,Color} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s),r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
type Fixture={name:string;fen:string;trap:SquareName;trapKing:SquareName;trapKingTo:SquareName;moverKing:SquareName;moverKingTo:SquareName;pawnTo:SquareName;from:SquareName;short:SquareName;safe:SquareName;owner:Color;trapOwner:Color;pieceId:string};
const fixtures:Fixture[]=[
 {name:'Black Rook',fen:'7k/8/1r6/8/8/p7/1P6/7K w - - 0 1',trap:'b2',trapKing:'h1',trapKingTo:'g1',moverKing:'h8',moverKingTo:'g8',pawnTo:'a3',from:'b6',short:'b5',safe:'b3',owner:'black',trapOwner:'white',pieceId:'black-rook-b6'},
 {name:'Black Queen',fen:'7k/8/1q6/8/8/p7/1P6/7K w - - 0 1',trap:'b2',trapKing:'h1',trapKingTo:'h2',moverKing:'h8',moverKingTo:'g8',pawnTo:'a3',from:'b6',short:'b5',safe:'b3',owner:'black',trapOwner:'white',pieceId:'black-queen-b6'},
 {name:'Black Bishop',fen:'7k/8/5b2/8/8/p7/1P6/7K w - - 0 1',trap:'b2',trapKing:'h1',trapKingTo:'g1',moverKing:'h8',moverKingTo:'g8',pawnTo:'a3',from:'f6',short:'e5',safe:'c3',owner:'black',trapOwner:'white',pieceId:'black-bishop-f6'},
 {name:'White Rook',fen:'7k/1p6/P7/8/8/1R6/8/7K b - - 0 1',trap:'b7',trapKing:'h8',trapKingTo:'g8',moverKing:'h1',moverKingTo:'g1',pawnTo:'a6',from:'b3',short:'b4',safe:'b6',owner:'white',trapOwner:'black',pieceId:'white-rook-b3'},
];
function window(f:Fixture){let s=createGameState({fen:f.fen,hands:{[f.trapOwner]:['man-trap','bog']}});for(const a of [{type:'move',from:f.trapKing,to:f.trapKingTo},{type:'playCard',cardId:'man-trap',target:f.trap},{type:'endTurn'},{type:'move',from:f.moverKing,to:f.moverKingTo},{type:'endTurn'},{type:'move',from:f.trap,to:f.pawnTo},{type:'endTurn'}] satisfies GameAction[])s=act(s,a);return s;}
// Printed Bog says the opponent's just-moved Rook/Bishop/Queen actually moved
// only one square. Man Trap captures after arrival (§19.1). Restoring that mover
// and trap when shortening is inferred from Bog and the Bog/Fireball FAQ
// (§22.1), not an explicit official Bog/Man Trap ruling.
// Current failure: Bog returns WRONG_ROLE after the qualifying slider is captured.
for (const f of fixtures) {
  test(`${f.name}: Bog restores a mover captured on arrival by Man Trap`, () => {
    const moved = act(window(f), {type:'move', from:f.from, to:f.trap});
    const captured = moved.pieces.find(piece => piece.id === f.pieceId)!;
    assert.equal(captured.zone, 'captured');
    assert.equal(captured.square, null);
    assert.equal(captured.capturedBy, f.trapOwner);
    assert.equal(moved.effects.some(effect => effect.type === 'man-trap' && effect.square === f.trap), false);
    const shortened = act(moved, {type:'playCard', cardId:'bog'});
    const restored = shortened.pieces.find(piece => piece.id === f.pieceId)!;
    assert.equal(restored.zone, 'board');
    assert.equal(restored.square, f.short);
    assert.equal(restored.capturedBy, undefined);
    assert.equal(shortened.pieces.some(piece => piece.zone === 'board' && piece.square === f.trap), false);
    assert.equal(shortened.effects.some(effect => effect.type === 'man-trap' && effect.square === f.trap), true);
    assert.equal(shortened.turn.moveMade, true);
    assert.equal(act(shortened, {type:'endTurn'}).turn.color, f.trapOwner);
  });
  test(`${f.name}: Bog shortens a safe move beside an armed trap`, () => {
    const moved = act(window(f), {type:'move', from:f.from, to:f.safe});
    const shortened = act(moved, {type:'playCard', cardId:'bog'});
    const piece = shortened.pieces.find(piece => piece.id === f.pieceId)!;
    assert.equal(piece.zone, 'board');
    assert.equal(piece.square, f.short);
    assert.equal(piece.capturedBy, undefined);
    assert.equal(shortened.pieces.some(piece => piece.zone === 'board' && piece.square === f.safe), false);
    assert.equal(shortened.effects.some(effect => effect.type === 'man-trap' && effect.square === f.trap), true);
    assert.equal(shortened.turn.moveMade, true);
    assert.equal(act(shortened, {type:'endTurn'}).turn.color, f.trapOwner);
  });
}
for (const f of [fixtures[0]!, fixtures[3]!]) {
  test(`${f.name}: Man Trap records capture provenance without Bog`, () => {
    const moved = act(window(f), {type:'move', from:f.from, to:f.trap});
    const captured = moved.pieces.find(piece => piece.id === f.pieceId)!;
    assert.equal(captured.zone, 'captured');
    assert.equal(captured.square, null);
    assert.equal(captured.capturedBy, f.trapOwner);
    assert.equal(moved.pieces.some(piece => piece.zone === 'board' && (piece.square === f.from || piece.square === f.trap)), false);
    assert.equal(moved.effects.some(effect => effect.type === 'man-trap' && effect.square === f.trap), false);
    assert.equal(moved.turn.moveMade, true);
    assert.equal(act(moved, {type:'endTurn'}).turn.color, f.trapOwner);
  });
}
