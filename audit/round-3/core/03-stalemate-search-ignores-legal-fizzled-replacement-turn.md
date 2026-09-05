# Stalemate search ignores a legal replacement-card fizzle that consumes the move

- Severity: High
- Area: stalemate, replacement cards, card lifecycle
- Frozen checkout: `7c7b7ccac35046b9b9eed5fa26ed89d7c75fe4d9` plus the authoritative uncommitted changes

## Rule citation

`rules.md` §11.6 says that when a replacement-move card fails for self-check from an initially safe position, its board effect is restored, the card is spent, and the replacement move is consumed. Section 23 defines stalemate only when the player has no legal continuation, considering cards playable at that time.

## Expected

Black has no ordinary move in the position below, but Dubbing has valid target `Bb8-d7`. The relocation would expose `Ka8` to `Rh8`, so it correctly fizzles with `SELF_CHECK`; because Black began safe, that legal card play consumes Black's move. Black can then end the turn. The preceding White `endTurn` must not declare stalemate.

## Actual

Reached through White's legal `h2-h3`, `endTurn` immediately records stalemate. Yet creating the identical Black-to-move board and playing Dubbing succeeds, records the required fizzle, sets `moveMade: true`, and permits `endTurn` to pass play back to White.

## Minimal public reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module -e "import {createGameState} from './src/game/state.ts'; import {applyAction,legalDests,dubbingDests} from './src/game/reducer.ts'; const go=(s,a)=>{const r=applyAction(s,a);if(!r.ok)throw new Error(r.error.code);return r.state}; let s=createGameState({fen:'kb5R/2Q5/2K5/8/8/8/7P/8 w - - 0 1',hands:{white:[],black:['dubbing']}}); s=go(s,{type:'move',from:'h2',to:'h3'}); console.log('adjudicated',go(s,{type:'endTurn'}).outcome); let b=createGameState({fen:'kb5R/2Q5/2K5/8/8/7P/8/8 b - - 0 1',hands:{white:[],black:['dubbing']}}); console.log('ordinary',Object.fromEntries(legalDests(b)),'card',dubbingDests(b,'b8')); b=go(b,{type:'playCard',cardId:'dubbing',target:[{from:'b8',to:'d7'}]}); console.log(b.history.at(-1),b.turn.moveMade,go(b,{type:'endTurn'}).turn.color)"
```

Observed:

```text
adjudicated { reason: 'stalemate' }
ordinary {} card [ 'a6', 'd7' ]
{ type: 'cardFizzled', cardId: 'dubbing', reason: 'SELF_CHECK' } true white
```

## Likely root

The escape search at `src/game/reducer.ts:1714-1721` discards every result whose last event is not `cardPlayed`. That also discards a rules-defined `cardFizzled` result whose `turn.moveMade` is true and which legally completes a safe turn.
