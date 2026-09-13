import { applyAction, cardPlayTargets } from './game/reducer.js';
import { CARD_CATALOG } from './game/cards/catalog.js';
import type { CardInstance, CardMove, GameAction, GameState, PeaceTalksTarget, ResurrectionTarget, SquareName } from './game/types.js';

export interface CardPick { id: string; label: string; square?: SquareName }
export interface CardOption { picks: CardPick[]; action: GameAction }
export interface CardInteraction { prompts: string[]; options: CardOption[] }

const squarePick = (square: SquareName): CardPick => ({ id: square, label: square, square });

function effectPick(state: GameState, id: string): CardPick {
  const effect = state.effects.find(effect => 'card' in effect && effect.card.id === id);
  return { id, label: effect && 'card' in effect ? CARD_CATALOG[effect.card.cardId].name : id };
}

function interaction(
  state: GameState, card: CardInstance, prompts: string[],
  picks: (target: unknown) => CardPick[],
): CardInteraction {
  return {
    prompts,
    options: cardPlayTargets(state, card.cardId).map(target => ({
      picks: picks(target),
      action: { type: 'playCard' as const, cardId: card.cardId, cardInstanceId: card.id, target },
    })).filter(option => applyAction(state, option.action).ok),
  };
}

// Each entry describes input; the engine supplies targets and validates the action.
export const cardInteractions: Partial<Record<string,
  (state: GameState, card: CardInstance) => CardInteraction
>> = {
  'hidden-passage': (state, card) => interaction(state, card,
    ['Choose a square for your King'], target => [squarePick((target as CardMove[])[0].to)]),
  disintegration: (state, card) => interaction(state, card,
    ['Choose a piece to remove'], target => [squarePick(target as SquareName)]),
  fireball: (state, card) => interaction(state, card,
    ['Choose a piece to destroy'], target => [squarePick(target as SquareName)]),
  'mystic-shield': (state, card) => interaction(state, card,
    ['Choose a piece to protect'], target => [squarePick(target as SquareName)]),
  curse: (state, card) => interaction(state, card,
    ['Choose a piece to curse'], target => [squarePick(target as SquareName)]),
  'forced-march': (state, card) => {
    const result = interaction(state, card,
      ['Choose a Pawn', 'Choose its destination', 'Move another Pawn, or play card', 'Choose its destination'],
      target => (target as CardMove[]).flatMap(move => [squarePick(move.from), squarePick(move.to)]));
    result.options = result.options.flatMap(option => option.picks.length === 4
      ? [option, { ...option, picks: [...option.picks.slice(2), ...option.picks.slice(0, 2)] }]
      : [option]);
    return result;
  },
  resurrection: (state, card) => interaction(state, card,
    ['Choose a captured piece', 'Choose its return square'], target => {
      const { pieceId, to } = target as ResurrectionTarget;
      const piece = state.pieces.find(piece => piece.id === pieceId)!;
      const peers = state.pieces.filter(other => other.zone === 'captured'
        && other.owner === piece.owner && other.role === piece.role);
      const role = piece.role[0].toUpperCase() + piece.role.slice(1);
      const label = peers.length > 1 ? `${role} ${peers.findIndex(other => other.id === pieceId) + 1}` : role;
      return [{ id: pieceId, label }, squarePick(to)];
    }),
  fortification: (state, card) => {
    const result = interaction(state, card,
      ['Choose one side of the wall', 'Choose the other side of the wall'], target => {
        const { from, to } = target as CardMove;
        return [squarePick(from), squarePick(to)];
      });
    result.options = result.options.flatMap(option => [option, { ...option, picks: [...option.picks].reverse() }]);
    return result;
  },
  'peace-talks': (state, card) => interaction(state, card,
    ['Choose an effect to end', 'Choose the promotions'], target => {
      if (typeof target === 'string') return [effectPick(state, target)];
      const { effectId, promotions } = target as PeaceTalksTarget;
      return [effectPick(state, effectId), {
        id: JSON.stringify(promotions),
        label: promotions.map(promotion => `${promotion.square}: ${promotion.role}`).join(', '),
      }];
    }),
  'fog-of-war': (state, card) => interaction(state, card,
    ['Choose a card to cancel'], target => {
      if (target === undefined) return [];
      let checkpoint = state.fogCheckpoint;
      while (checkpoint && checkpoint.card.id !== target) checkpoint = checkpoint.plots?.previous;
      return [{ id: target as string, label: checkpoint ? CARD_CATALOG[checkpoint.card.cardId].name : target as string }];
    }),
};
