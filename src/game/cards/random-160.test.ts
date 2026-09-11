import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Independently reviewed in order against rules §§11, 14, 15, 16, 17, 19, 21
// and the printed catalog metadata. Each line fixes the action and its reason.
const rationales = `
1 h2-h3: White Pawn advances one empty square.
2 end: White closes its completed safe turn.
3 h7-h5: Black Pawn crosses empty h6; h6 is an uncapturable EP opportunity.
4 end: Black closes; h6 opportunity survives until White moves.
5 g1-f3: White Knight makes an unobstructed L jump and expires EP.
6 end: White closes with both Kings safe.
7 b7-b5: Black Pawn crosses empty b6; no White Pawn can use b6 EP.
8 end: Black closes, retaining that physical EP opportunity.
9 a2-a3: White Pawn advances one square and expires b6 EP.
10 end: White closes safely.
11 f7-f6: Black Pawn advances one square.
12 end: Black closes safely.
13 h1-h2: White Rook enters vacated h2 and loses kingside castling.
14 disintegration: Own unpromoted Pawn g2 dies; no capture or clock advance.
15 end: White closes and resets card allowances.
16 e8-f7: Black King steps diagonally to vacant safe f7; both rights disappear.
17 end: Black closes safely.
18 h2-h1: White Rook returns without regaining castling.
19 holy-war: Controlled Knight f3 and Bishop c1 exchange identities and squares.
20 end: White closes after its one after-move card.
21 f7-e8: Black King returns one diagonal step; rights remain revoked.
22 end: Black closes safely.
23 f3-g4: Relocated original Bishop advances one diagonal square.
24 end: White closes safely.
25 c7-c6: Black Pawn advances one empty square.
26 end: Black closes safely.
27 h1-h2: White Rook moves one file step upward.
28 end: White closes safely.
29 c8-a6: Black Bishop crosses empty b7 to a6.
30 end: Black closes safely.
31 long-jump: Knight c1 jumps to empty opposite-color a2; consumes Regular Move.
32 end: White closes its replacement-move turn.
33 b5-b4: Black Pawn advances one empty square before rotation.
34 end: Black closes safely.
35 h3-h4: White Pawn advances one empty square.
36 earthquake: Counterclockwise rotation makes White move east and Black west; a7 promotes to Black Rook before h4 promotes to White Bishop.
37 end: White closes; rotation remains active without moving coordinates.
38 a6-b5: Black Bishop makes one diagonal step.
39 think-again: Immediate White reaction restores a6 Bishop and clocks; forbids black-bishop-c8:a6:b5 only for replacement.
40 a6-b7: Black Bishop makes a genuinely different diagonal move; clears prohibition.
41 end: Black closes and clears White reaction allowance.
42 g4-e6: White Bishop crosses empty f5 to e6.
43 doomsayer: After-move Continuing Effect opens Black immediate naming choice.
44 decline: Black declines naming; no piece or card moves.
45 name: White says Knight and loses owned b1 Knight to its own Doomsayer; effect discards and capture clock resets.
46 end: White closes safely with Doomsayer resolved.
47 d8-c8: Black Queen moves one horizontal square.
48 figure-dance: Occupied a1,a8,h8 simultaneously rotate to h1,a1,a8; no capture; remaining White castling right revoked.
49 end: Black closes after corner rotation.
50 e6-d7: White Bishop captures Black original d7 Pawn and checks e8 King.
51 end: White closes checking Black; Black receives an escape turn.
52 breakthrough: Checked Black Pawn e7 captures forward west on d7, removing checking Bishop; consumes move and resets capture clock.
53 end: Black closes with check cured.
54 h4-g3: Promoted White Bishop moves diagonally; it is no longer a Pawn for clocks.
55 truce: After-move Continuing Effect forbids captures; neither King has a raw attack.
56 end: White closes with Truce retained.
57 b4-a4: Black Pawn advances west to its new last rank and promotes to Bishop without capture.
58 end: Black closes with no raw royal attack.
59 h2-g2: White Rook moves one empty horizontal square under Truce.
60 end: White closes; neither raw royal attack ends Truce.
61 d7-c7: Black Pawn advances west to empty c7.
62 end: Black closes with Truce active.
63 h1-h4: White Rook crosses empty h2,h3 without capturing.
64 end: White closes with Truce active.
65 a1-c1: Black Rook crosses vacant b1 to c1; d1 Queen remains between it and e1 King.
66 end: Black closes; raw royal attack scan retains Truce.
67 h4-g4: White Rook moves one empty square.
68 end: White closes with Truce active.
69 e8-d8: Black King steps to empty unattacked d8.
70 end: Black closes safely.
71 g4-e4: White Rook crosses empty f4 to e4.
72 end: White closes with Truce active.
73 c8-e6: Black Queen crosses vacant d7 to e6.
74 end: Black closes with Truce active.
75 g3-e5: Promoted White Bishop crosses empty f4 to e5.
76 end: White closes with Truce active.
77 e6-c4: Black Queen crosses empty d5 to c4.
78 disintegration: Black original e7 Pawn now at c7 dies; Truce forbids capture, not death.
79 end: Black closes and resets card allowances.
80 e5-c3: White Bishop crosses vacant d4 to c3.
81 end: White closes with Truce active.
82 f6-e6: Black Pawn advances one square west.
83 end: Black closes with Truce active.
84 tournament: Owned a2 Knight and opponent b8 Knight swap; no capture under Truce; consumes move.
85 end: White closes its replacement-move turn.
86 c4-d5: Black Queen moves one diagonal square.
87 end: Black closes with Truce active.
88 e4-h4: White Rook crosses vacant f4,g4.
89 end: White closes with Truce active.
90 g7-f7: Black Pawn advances one empty square west.
91 end: Black closes safely.
92 c3-b4: White Bishop moves one diagonal square.
93 end: White closes with Truce active.
94 d5-c5: Black Queen moves one horizontal square.
95 end: Black closes with Truce active.
96 h4-g4: White Rook moves one horizontal square.
97 end: White closes safely.
98 d8-e8: Black King steps right to unattacked e8.
99 end: Black closes with Truce active.
100 g4-c4: White Rook crosses empty f4,e4,d4.
101 end: White closes safely.
102 confabulation: Black Queen c5 crosses d5,e5,f5,g5 to merge with owned h5 Pawn; no capture; consumes move.
103 fog-of-war: Immediate White counter restores Queen c5, clocks and Black move; both cards spent; Black card play locked.
104 c1-b1: Black uses restored Regular Move for Rook step; no card allowed.
105 end: Black closes and releases Fog lock and both allowances.
106 g2-h2: White Rook moves one empty square.
107 end: White closes with Truce active.
108 a7-a5: Promoted Black Rook crosses empty a6; non-Pawn clock increment.
109 end: Black closes safely.
110 c4-d4: White Rook moves one empty square.
111 end: White closes with Truce active.
112 c5-c3: Black Queen crosses c4, now vacated, to empty c3.
113 end: Black closes with Truce active.
114 d4-d7: White Rook crosses empty d5,d6; e8 King is not on its ray.
115 end: White closes with Truce retained by independent raw attack scan.
116 a5-d5: Promoted Black Rook crosses empty b5,c5.
117 end: Black closes; fifty Regular Move commands reviewed, White to move.
`.trim().split('\n');

const targets: Record<number, unknown> = {
  14: 'g2', 19: { knight: 'f3', bishop: 'c1' }, 31: [{ from: 'c1', to: 'a2' }],
  36: { direction: 'counterclockwise', promotions: [{ square: 'a7', role: 'rook' }, { square: 'h4', role: 'bishop' }] },
  39: undefined, 43: undefined, 48: [], 52: [{ from: 'e7', to: 'd7' }], 55: undefined,
  78: 'c7', 84: { own: 'a2', opponent: 'b8' }, 102: [{ from: 'c5', to: 'h5' }], 103: undefined,
};
const instances: Record<number,string> = {
  14:'white-hand-4-disintegration',19:'white-hand-3-holy-war',31:'white-deck-1-long-jump',
  36:'white-hand-0-earthquake',39:'white-deck-2-think-again',43:'white-hand-1-doomsayer',
  48:'black-hand-4-figure-dance',52:'black-hand-2-breakthrough',55:'white-deck-5-truce',
  78:'black-hand-1-disintegration',84:'white-deck-4-tournament',102:'black-hand-0-confabulation',103:'white-deck-0-fog-of-war',
};
const colors = ['white', 'black'] as const;
const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white';
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const square = (s: string): SquareName => { assert.match(s, /^[a-h][1-8]$/); return s as SquareName; };

test('iteration 160 independently reviewed campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/160.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860160);
  assert.equal(rationales.length, trace.steps.length);
  let state = createGameState(trace.initial);
  assert.equal(state.fen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  let pieces = structuredClone(state.pieces), effects: unknown[] = [];
  const players = structuredClone(state.players);
  let turn = structuredClone(state.turn), ep = structuredClone(state.enPassant);
  let shieldMove: {player: Color; pieceIds: string[]; capturedOpponent: boolean} | null = null;
  let orientation: 0 | 90 = 0, rights = 'KQkq', half = 0, full = 1, active: Color = 'white';
  let lastMove: { pieces: PieceState[]; half: number; full: number; active: Color } | undefined;
  let preMerge: typeof lastMove;
  const at = (s: string) => pieces.find(p => p.square === s && p.zone === 'board');
  const piece = (s: string) => { const p = at(s); assert.ok(p, `occupied ${s}`); return p; };
  const clearRay = (from: string, to: string) => {
    const [x,y] = xy(from), [u,v] = xy(to), dx = Math.sign(u-x), dy = Math.sign(v-y);
    for (let i = 1; i < Math.max(Math.abs(u-x), Math.abs(v-y)); i++) {
      if (at(`${String.fromCharCode(97+x+i*dx)}${y+i*dy+1}`)) return false;
    }
    return true;
  };
  const reaches = (p: PieceState, to: string, capture: boolean) => {
    assert.ok(p.square);
    const [x,y] = xy(p.square), [u,v] = xy(to), dx = u-x, dy = v-y;
    if (!dx && !dy) return false;
    if (p.role === 'knight') return Math.abs(dx*dy) === 2;
    if (p.role === 'king') return Math.max(Math.abs(dx),Math.abs(dy)) === 1;
    if (p.role === 'pawn') {
      const sign = p.owner === 'white' ? 1 : -1;
      const forward = orientation === 0 ? dy*sign : dx*sign;
      const sideways = orientation === 0 ? dx : dy;
      if (capture) return forward === 1 && Math.abs(sideways) === 1;
      const home = orientation === 0 ? y === (p.owner === 'white' ? 1 : 6) : x === (p.owner === 'white' ? 1 : 6);
      return sideways === 0 && (forward === 1 || forward === 2 && home) && clearRay(p.square,to);
    }
    const aligned = p.role === 'bishop' ? Math.abs(dx) === Math.abs(dy)
      : p.role === 'rook' ? dx === 0 || dy === 0 : dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
    return aligned && clearRay(p.square,to);
  };
  const rawCheck = (color: Color) => {
    const king = pieces.find(p => p.royal && p.owner === color)!;
    assert.ok(king.square);
    const attackers = pieces.filter(p => p.zone === 'board');
    // During the one merged checkpoint the h5 body also has its Queen component's powers.
    if (effects.some(e => (e as {type:string}).type === 'confabulation')) {
      const queen = pieces.find(p => p.id === 'black-queen-d8')!;
      attackers.push({...queen,square:'h5',zone:'board'});
    }
    return attackers.some(p => p.owner !== color && reaches(p, king.square!, true));
  };
  const boardFen = () => {
    const chars = { pawn:'p', knight:'n', bishop:'b', rook:'r', queen:'q', king:'k' };
    return Array.from({length:8},(_,row) => {
      let out = '', empty = 0;
      for (let x=0;x<8;x++) {
        const p = at(`${String.fromCharCode(97+x)}${8-row}`);
        if (!p) { empty++; continue; }
        if (empty) { out += empty; empty = 0; }
        out += p.owner === 'white' ? chars[p.role].toUpperCase() : chars[p.role];
      }
      return out + (empty || '');
    }).join('/');
  };
  const consumeMove = (reset: boolean) => {
    half = reset ? 0 : half + 1; if (turn.color === 'black') full++;
    active = opposite(turn.color); turn.phase = 'afterMove'; turn.moveMade = true; ep = [];
  };
  const promote = (s: string, role: 'rook' | 'bishop') => {
    const p = piece(s); assert.equal(p.role,'pawn'); p.role = role; p.promoted = true;
  };
  const spend = (owner: Color, id: string, continuing: boolean) => {
    const player = players[owner], index = player.hand.findIndex(c => c.id === id);
    assert.ok(index >= 0, 'physical card held'); assert.equal(turn.cardPlays[owner],0);
    const [card] = player.hand.splice(index,1); assert.ok(card);
    const draw = player.deck.shift(); assert.ok(draw); player.hand.push(draw);
    if (!continuing) player.discard.push(card);
    turn.cardPlays[owner]++; return card;
  };
  let moves = 0, cards = 0, historyLength = 0;
  for (const [index, {action}] of trace.steps.entries()) {
    const n = index + 1, reason = rationales[index]!;
    assert.ok(reason.startsWith(`${n} `));
    const command = reason.slice(reason.indexOf(' ')+1, reason.indexOf(':'));
    const prior = structuredClone(state);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.equal(command, `${from}-${to}`);
      const p = piece(from), victim = at(to);
      assert.equal(p.owner,turn.color); assert.equal(turn.moveMade,false);
      assert.ok(reaches(p,to,!!victim), `${n}: independent movement geometry`);
      shieldMove = {player:turn.color,pieceIds:[p.id],capturedOpponent:!!victim};
      if (victim) {
        assert.equal(n,50); assert.equal(victim.owner,opposite(turn.color)); assert.equal(victim.royal,false);
        assert.equal(effects.some(e => (e as {type:string}).type === 'truce'),false);
      }
      lastMove = {pieces:structuredClone(pieces),half,full,active};
      const pawn = p.role === 'pawn';
      if (victim) { victim.zone = 'captured'; victim.square = null; victim.capturedBy = turn.color; }
      p.square = square(to);
      if (p.royal) rights = rights.replace(p.owner === 'white' ? /[KQ]/g : /[kq]/g,'');
      if (p.id === 'white-rook-h1') rights = rights.replace('K','');
      consumeMove(pawn || !!victim);
      if (n === 3 || n === 7) ep = [{target:square(n === 3 ? 'h6' : 'b6'),pawnId:p.id}];
      if (n === 57) { assert.equal(action.promotion,'bishop'); promote('a4','bishop'); }
      else assert.equal(action.promotion,undefined);
      moves++;
    } else if (action.type === 'endTurn') {
      assert.equal(command,'end'); assert.equal(turn.moveMade,true); assert.equal(rawCheck(turn.color),false);
      turn = {color:opposite(turn.color),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      shieldMove = null;
    } else if (action.type === 'playCard') {
      cards++; assert.equal(command,action.cardId); assert.deepEqual(action.target,targets[n]);
      assert.ok(typeof action.cardInstanceId === 'string');
      assert.equal(action.cardInstanceId,instances[n],`${n}: exact played physical card`);
      const owner: Color = n === 39 || n === 103 ? 'white' : turn.color;
      const meta = CARD_CATALOG[action.cardId]!;
      assert.ok(meta.timing.includes(n === 39 ? 'afterOpponentMove' : n === 103 ? 'afterOpponentCard' : turn.phase));
      const card = spend(owner,action.cardInstanceId,meta.continuing);
      if (n === 14 || n === 78) {
        const p = piece(n === 14 ? 'g2' : 'c7'); assert.equal(p.owner,owner); assert.equal(p.role,'pawn');
        p.square = null; p.zone = 'dead'; delete p.capturedBy;
      } else if (n === 19) {
        const bishop = piece('c1'), knight = piece('f3'); assert.equal(bishop.role,'bishop'); assert.equal(knight.role,'knight');
        bishop.square = 'f3'; knight.square = 'c1';
      } else if (n === 31) {
        const knight = piece('c1'); assert.equal(knight.role,'knight'); assert.equal(at('a2'),undefined);
        const [x,y] = xy('c1'), [u,v] = xy('a2'); assert.notEqual((x+y)%2,(u+v)%2);
        knight.square = 'a2'; consumeMove(false);
        shieldMove = {player:owner,pieceIds:[knight.id],capturedOpponent:false};
      } else if (n === 36) {
        orientation = 90; promote('a7','rook'); promote('h4','bishop');
        effects.push({type:'earthquake',owner,card,direction:'counterclockwise',target:targets[36]});
      } else if (n === 39) {
        assert.ok(lastMove); pieces = structuredClone(lastMove.pieces); half = lastMove.half; full = lastMove.full; active = lastMove.active;
        turn.phase = 'beforeMove'; turn.moveMade = false;
        shieldMove = null;
      } else if (n === 43 || n === 55) {
        effects.push({type:action.cardId,owner,card});
      } else if (n === 48) {
        const corners: Record<string,SquareName> = {a1:'h1',h1:'h8',h8:'a8',a8:'a1'};
        for (const p of pieces) if (p.square && corners[p.square]) p.square = corners[p.square]!;
        rights = '';
      } else if (n === 52) {
        const pawn = piece('e7'), bishop = piece('d7');
        assert.equal(pawn.role,'pawn'); assert.equal(pawn.owner,'black'); assert.equal(bishop.owner,'white');
        assert.equal(orientation,90); bishop.square = null; bishop.zone = 'captured'; bishop.capturedBy = 'black';
        pawn.square = 'd7'; consumeMove(true);
        shieldMove = {player:owner,pieceIds:[pawn.id],capturedOpponent:true};
      } else if (n === 84) {
        const own = piece('a2'), enemy = piece('b8'); assert.equal(own.role,'knight'); assert.equal(enemy.role,'knight');
        assert.equal(own.owner,'white'); assert.equal(enemy.owner,'black'); own.square = 'b8'; enemy.square = 'a2'; consumeMove(false);
        // Tournament exchanges positions rather than moving either physical piece.
        shieldMove = {player:owner,pieceIds:[],capturedOpponent:false};
      } else if (n === 102) {
        preMerge = {pieces:structuredClone(pieces),half,full,active};
        const queen = piece('c5'), pawn = piece('h5'); assert.equal(queen.role,'queen'); assert.equal(pawn.owner,'black');
        assert.ok(reaches(queen,'h5',false)); queen.square = null; queen.zone = 'away';
        effects.push({type:'confabulation',owner,card,pieceIds:[pawn.id,queen.id]}); consumeMove(false);
        shieldMove = {player:owner,pieceIds:[queen.id],capturedOpponent:false};
      } else if (n === 103) {
        assert.ok(preMerge); pieces = structuredClone(preMerge.pieces); half = preMerge.half; full = preMerge.full; active = preMerge.active;
        effects.pop(); players.black.discard.push({id:'black-hand-0-confabulation',cardId:'confabulation'});
        turn.phase = 'beforeMove'; turn.moveMade = false;
        shieldMove = null;
      } else assert.fail(`unreviewed card ${n}`);
    } else if (action.type === 'declineDoomsayer') {
      assert.equal(n,44); assert.equal(command,'decline'); assert.equal(action.player,'black');
    } else if (action.type === 'namePiece') {
      assert.equal(n,45); assert.equal(command,'name');
      assert.deepEqual(action,{type:'namePiece',speaker:'white',name:'knight',losses:[{effectId:'white-hand-1-doomsayer',pieceId:'white-knight-b1'}]});
      const knight = piece('b1'); knight.square = null; knight.zone = 'captured'; knight.capturedBy = 'white';
      effects.pop(); players.white.discard.push({id:'white-hand-1-doomsayer',cardId:'doomsayer'}); half = 0;
    } else assert.fail(`unreviewed action ${n}`);
    const result = applyAction(state,action);
    assert.deepEqual(state,prior,`${n}: complete input immutability`); assert.ok(result.ok,`${n}: ${reason}`); state = result.state;
    assert.deepEqual(state.pieces,pieces,`${n}: complete independently advanced physical identities, including capture metadata absence`);
    if (action.type !== 'endTurn' && n !== 39) historyLength++;
    assert.equal(state.history.length,historyLength,`${n}: exact history length; Think Again replaces its canceled move`);
    if (n === 39) {
      assert.deepEqual(state.history.at(-1),{type:'cardPlayed',cardId:'think-again',player:'white',movement:[{from:'b5',to:'a6'}],preservePreviousMove:true});
      assert.deepEqual(state.history.at(-2),{type:'cardPlayed',cardId:'earthquake',target:targets[36],movement:[],preservePreviousMove:true});
    }
    if (n >= 39) assert.equal(state.history.some(e => e.type === 'move' && e.from === 'a6' && e.to === 'b5'),false);
    if (n >= 102) assert.deepEqual(state.history[55],{
      type:'cardPlayed',cardId:'confabulation',target:targets[102],movement:[{from:'c5',to:'h5'}],preservePreviousMove:false,
    },`${n}: declaration remains recorded even after Fog cancels its effect`);
    if (n >= 103) assert.deepEqual(state.history[56],{
      type:'cardPlayed',cardId:'fog-of-war',player:'white',movement:[],preservePreviousMove:true,
    });
    assert.deepEqual(state.effects,effects,`${n}: exact effects`);
    assert.deepEqual(state.players,players,`${n}: physical hands/decks/discards`);
    assert.deepEqual(state.turn,turn,`${n}: turn and allowances`);
    assert.deepEqual(state.shieldMove ?? null,shieldMove,`${n}: exact movement identities and capture status`);
    assert.equal(state.orientation,orientation);
    assert.deepEqual(state.enPassant,ep);
    // Neither initial double step has an adjacent prospective capturing Pawn.
    for (const opportunity of ep) {
      const victim = pieces.find(p => p.id === opportunity.pawnId)!;
      const prospective = opposite(victim.owner);
      assert.equal(pieces.some(p => p.owner === prospective && p.zone === 'board' && p.role === 'pawn' && reaches(p,opportunity.target,true)),false);
    }
    if (ep.length) {
      const prospective = structuredClone(state);
      prospective.turn = {color:active,phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      const destinations = legalDests(prospective);
      for (const p of pieces.filter(p => p.zone === 'board' && p.role === 'pawn' && p.owner === active)) {
        for (const to of destinations.get(p.square!) ?? []) {
          assert.equal(!at(to) && reaches(p,to,true),false,`${n}: prospective capturing player has no legal en-passant capture`);
        }
      }
    }
    assert.equal(state.fen,`${boardFen()} ${active === 'white' ? 'w' : 'b'} ${rights || '-'} - ${half} ${full}`,`${n}: all six independent FEN fields`);
    for (const color of colors) {
      const expected = color === 'black' && (n === 50 || n === 51);
      assert.equal(rawCheck(color),expected,`${n}: raw ${color} royal attacks, including during Truce`);
      assert.equal(isKingInCheck(state,color),expected,`${n}: engine royal threats`);
    }
    assert.equal(state.pendingRescue ?? null,null,`${n}: no provisional self-check needs a rescue witness`);
    assert.deepEqual(state.pendingDoomsayer ?? null,n === 43 ? {player:'black',cardInstanceId:'white-hand-1-doomsayer'} : null);
    assert.equal(state.pendingAbduction ?? null,null); assert.deepEqual(state.underElfHill ?? [],[]);
    assert.deepEqual(state.chaosForbidden ?? null,n === 39 ? {player:'black',movement:'black-bishop-c8:a6:b5'} : null);
    assert.equal(state.plotsExecution ?? null,null); assert.deepEqual(state.plotsAllowances ?? [],[]);
    assert.deepEqual(state.fogLocked ?? [],n === 103 || n === 104 ? ['black'] : []);
    assert.deepEqual(state.riposteLostMoves ?? [],[]); assert.equal(state.riposteSkipped ?? null,null); assert.equal(state.riposteCheckDeferred ?? null,null);
    assert.equal(state.outcome ?? null,null);
  }
  assert.equal(moves,50); assert.equal(cards,13);
  assert.equal(state.fen,'rN2kbn1/1b1R1p2/2p1p3/3r3p/bB6/P1q5/nPPPPP1R/1r1QKB2 w - - 12 27');
  assert.equal(replayTrace(trace).fen,state.fen);
});
