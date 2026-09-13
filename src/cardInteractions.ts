import { applyAction, cardPlayTargets } from './game/reducer.js';
import { CARD_CATALOG } from './game/cards/catalog.js';
import type { CardInstance, CardMove, GameAction, GameState, PromotionDeclaration, SquareName } from './game/types.js';

export interface CardPick { id: string; label: string; square?: SquareName; prompt?: string }
export interface CardOption { picks: CardPick[]; action: GameAction; unorderedAfter?: number; groupSize?: number }
export interface CardInteraction { prompts: string[]; options: CardOption[] }

export const squarePick = (square: SquareName): CardPick => ({ id: square, label: square, square });

const choicePick = (id: string, label = id, prompt?: string): CardPick => ({ id, label, prompt });
const title = (word: string) => word[0].toUpperCase() + word.slice(1);
const square = (value: SquareName, prompt: string): CardPick => ({ ...squarePick(value), prompt });

export function effectPick(state: GameState, id: string): CardPick {
  const effect = state.effects.find(effect => 'card' in effect && effect.card.id === id);
  const peers = state.effects.filter(other => 'card' in other && effect && 'card' in effect
    && other.card.cardId === effect.card.cardId);
  const name = effect && 'card' in effect ? CARD_CATALOG[effect.card.cardId].name : 'Continuing effect';
  return choicePick(id, peers.length > 1 ? `${name} ${peers.indexOf(effect!) + 1}` : name, 'Choose an effect to end');
}

export function piecePick(state: GameState, id: string): CardPick {
  const piece = state.pieces.find(piece => piece.id === id)!;
  const peers = state.pieces.filter(other => other.zone === piece.zone
    && other.owner === piece.owner && other.role === piece.role);
  const label = title(piece.role);
  return choicePick(id, peers.length > 1 ? `${label} ${peers.indexOf(piece) + 1}` : label,
    'Choose a captured piece');
}

const squarePrompts: Record<string, string> = {
  disintegration: 'Choose a Pawn to remove', fireball: 'Choose the piece to explode',
  'mystic-shield': 'Choose a piece to protect', curse: 'Choose a piece to curse',
  neutrality: 'Choose a piece to make neutral', 'fatal-attraction': 'Choose a piece to bind',
  abduction: 'Choose a piece to abduct', 'man-trap': 'Choose a piece to trap',
  coup: 'Choose your new King', challenge: 'Choose the piece that must move',
  'forbidden-city': 'Choose a square to forbid', revenge: 'Choose an opposing Pawn to capture',
  pacifism: 'Choose a piece to protect', crab: 'Choose a Pawn to become a Crab',
  fanatic: 'Choose a Pawn to advance three squares',
};

const noTargets = new Set(['think-again', 'riposte', 'knightmare', 'chaos', 'under-elf-hill',
  'vulture', 'truce', 'doomsayer', 'no-quarter', 'vendetta', 'bog', 'panic']);
const rollbackCards = new Set(['think-again', 'knightmare', 'chaos']);
const movementCards = new Set(['hidden-passage', 'merciless', 'crusade', 'bombard', 'dungeon',
  'passing-in-the-night', 'blessing', 'confabulation', 'ghostwalk', 'irresistible-force',
  'masquerade', 'assassin', 'annexation', 'forced-march', 'guardian', 'heresy', 'cowardice',
  'doppelganger', 'rebirth', 'madman', 'dark-mirror', 'breakthrough', 'charge', 'onslaught',
  'long-jump', 'dubbing', 'squaring-the-circle']);
const unorderedMoves = new Set(['annexation', 'forced-march', 'passing-in-the-night', 'onslaught']);
const pairFields: Record<string, [string, string]> = {
  'man-of-straw': ['king', 'pawn'], 'evil-eye': ['attacker', 'victim'], sanctuary: ['king', 'rook'],
  'holy-war': ['knight', 'bishop'], anathema: ['bishop', 'rook'], 'holy-quest': ['bishop', 'knight'],
  treason: ['rook', 'knight'], cathedral: ['rook', 'bishop'], siege: ['knight', 'rook'],
  evangelists: ['own', 'opponent'], tournament: ['own', 'opponent'], 'lost-castle': ['own', 'opponent'],
};

export function promotionPicks(promotions: readonly PromotionDeclaration[]): CardPick[] {
  return promotions.map(({ square, role }) => choicePick(`promote-${square}-${role}`,
    `${square} → ${title(role)}`, `Promote the Pawn on ${square}`));
}

type Inputs = Omit<CardOption, 'action'>;

function inputs(state: GameState, cardId: string, target: unknown, multipleSources: boolean): Inputs {
  if (squarePrompts[cardId]) return { picks: [square(target as SquareName, squarePrompts[cardId])] };
  if (noTargets.has(cardId)) return { picks: rollbackCards.has(cardId) && target !== undefined
    ? [choicePick((target as { returnCard: boolean }).returnCard ? 'return-card' : 'keep-card-played',
      (target as { returnCard: boolean }).returnCard ? 'Take the card back' : 'Leave the card played',
      `${title(state.turn.color)}: take your card back?`)] : [] };
  if (movementCards.has(cardId)) {
    const moves = target as CardMove[];
    if (cardId === 'hidden-passage' && !multipleSources) {
      return { picks: [square(moves[0].to, 'Choose a square for your King')] };
    }
    if (cardId === 'madman') return { picks: [square(moves[0].from, 'Choose a Pawn to jump'),
      ...moves.map(move => square(move.to, 'Choose the next landing square'))] };
    if (cardId === 'guardian') return { picks: [square(moves[0].from, 'Choose a Pawn'),
      square(moves[0].to, 'Choose its destination'), ...moves.slice(1).map(move => choicePick(
        `follow-${move.from}-${move.to}`, `Follow from ${move.from} to ${move.to}`, 'Bring the piece behind it, or play card'))] };
    const pawn = ['forced-march', 'annexation', 'onslaught', 'guardian', 'passing-in-the-night'].includes(cardId);
    return {
      picks: moves.flatMap((move, index) => [
        square(move.from, cardId === 'heresy'
          ? `Choose ${state.pieces.find(piece => piece.square === move.from)?.owner === state.turn.color ? 'your' : 'an opposing'} Bishop`
          : index ? `Choose another ${pawn ? 'Pawn' : 'piece'}, or play card` : `Choose a ${pawn ? 'Pawn' : 'piece'}`),
        square(move.to, cardId === 'passing-in-the-night' ? 'Choose the opposing Pawn' : 'Choose its destination'),
      ]),
      ...(unorderedMoves.has(cardId) ? { unorderedAfter: 0, groupSize: 2 } : {}),
    };
  }
  if (pairFields[cardId]) {
    const value = target as Record<string, SquareName>;
    return { picks: pairFields[cardId].map(field => square(value[field],
      field === 'own' ? 'Choose your piece' : field === 'opponent' ? 'Choose the opposing piece' : `Choose the ${field}`)) };
  }
  if (['resurrection', 'winged-victory', 'betrayal', 'hostage'].includes(cardId)) {
    const value = target as { pieceId: string; to: SquareName; pawn: SquareName };
    return { picks: [piecePick(state, value.pieceId), square(cardId === 'hostage' ? value.pawn : value.to,
      cardId === 'hostage' ? 'Choose the Pawn to sacrifice' : 'Choose its return square')] };
  }
  if (cardId === 'fortification') {
    const value = target as CardMove;
    return { picks: [square(value.from, 'Choose one side of the wall'), square(value.to, 'Choose the other side of the wall')],
      unorderedAfter: 0, groupSize: 1 };
  }
  if (cardId === 'split-knight') {
    const value = target as { knight: SquareName; targets: SquareName[] };
    return { picks: [square(value.knight, 'Choose a Knight'),
      ...value.targets.map(target => square(target, 'Choose another victim, or play card'))],
      unorderedAfter: 1, groupSize: 1 };
  }
  if (cardId === 'earthquake') {
    const value = target as { direction: string; promotions: PromotionDeclaration[] };
    return { picks: [choicePick(value.direction, value.direction === 'clockwise' ? 'Clockwise' : 'Counterclockwise',
      'Choose how to rotate the board'), ...promotionPicks(value.promotions)] };
  }
  if (cardId === 'figure-dance') return { picks: promotionPicks(target as PromotionDeclaration[]) };
  if (cardId === 'peace-talks') {
    const value = target as { effectId: string; promotions: PromotionDeclaration[] };
    return { picks: typeof target === 'string' ? [effectPick(state, target)]
      : [effectPick(state, value.effectId), ...promotionPicks(value.promotions)] };
  }
  if (cardId === 'toll') return { picks: [target === undefined
    ? choicePick('decline', 'Decline — cancel the move', 'Opponent: sacrifice a Pawn or decline')
    : square(target as SquareName, 'Opponent: sacrifice a Pawn or decline')] };
  if (cardId === 'legacy') {
    const cards = Object.values(state.players).flatMap(player => player.discard);
    const card = cards.find(card => card.id === target)!;
    const peers = cards.filter(other => other.cardId === card.cardId);
    return { picks: [choicePick(card.id, CARD_CATALOG[card.cardId].name
      + (peers.length > 1 ? ` ${peers.indexOf(card) + 1}` : ''), 'Choose a discarded card')] };
  }
  if (cardId === 'fog-of-war') {
    if (target === undefined) return { picks: [] };
    let checkpoint = state.fogCheckpoint;
    while (checkpoint && checkpoint.card.id !== target) checkpoint = checkpoint.plots?.previous;
    return { picks: [choicePick(target as string, checkpoint ? CARD_CATALOG[checkpoint.card.cardId].name : 'Previous card',
      'Choose a card to cancel')] };
  }
  if (cardId === 'plots-within-plots') return { picks: [] };
  throw new Error(`Missing card inputs: ${cardId}`);
}

// Reorder independent selections only as the user picks them; never enumerate permutations.
export function matchingCardOptions(options: CardOption[], picked: string[]): CardOption[] {
  return options.flatMap(option => {
    if (option.unorderedAfter === undefined) {
      return picked.every((id, index) => option.picks[index]?.id === id) ? [option] : [];
    }
    const start = option.unorderedAfter;
    if (!picked.slice(0, start).every((id, index) => option.picks[index]?.id === id)) return [];
    if (picked.length < start) return [option];
    const size = option.groupSize ?? 1;
    const groups: CardPick[][] = [];
    for (let index = start; index < option.picks.length; index += size) groups.push(option.picks.slice(index, index + size));
    const prefix = option.picks.slice(0, start);
    for (let index = start; index < picked.length; index += size) {
      const selected = picked.slice(index, index + size);
      const match = groups.findIndex(group => selected.every((id, offset) => group[offset]?.id === id));
      if (match < 0) return [];
      prefix.push(...groups.splice(match, 1)[0]);
    }
    if (picked.length < prefix.length || !groups.length) return [{ ...option, picks: [...prefix, ...groups.flat()] }];
    return groups.map((group, index) => ({ ...option,
      picks: [...prefix, ...group, ...groups.filter((_, other) => other !== index).flat()],
    }));
  });
}

function cardInteraction(state: GameState, card: CardInstance): CardInteraction {
  const previous = card.cardId === 'haunting-memories'
    ? [...state.history].reverse().find(event => event.type === 'cardPlayed' || event.type === 'cardFizzled') : undefined;
  const inputCard = card.cardId === 'haunting-memories' ? previous?.copiedCardId ?? previous?.cardId : card.cardId;
  if (!inputCard || inputCard === 'haunting-memories') return { prompts: [], options: [] };
  const owner = Object.entries(state.players).find(([, player]) => player.hand.some(candidate => candidate.id === card.id))?.[0];
  let targets = cardPlayTargets(state, card.cardId);
  if (targets.length && rollbackCards.has(inputCard)) {
    const choices = [true, false].map(returnCard => ({ returnCard }));
    const results = choices.map(target => applyAction(state, {
      type: 'playCard', cardId: card.cardId, cardInstanceId: card.id, target,
    }));
    if (results[0].ok && results[1].ok
      && JSON.stringify(results[0].state.players) !== JSON.stringify(results[1].state.players)) targets = choices;
  }
  const multipleSources = new Set(targets.flatMap(target => Array.isArray(target) && target[0]?.from ? [target[0].from] : [])).size > 1;
  const options = targets.flatMap(target => {
    if (inputCard === 'plots-within-plots' && (target as { player: string }).player !== owner) return [];
    const action: GameAction = { type: 'playCard', cardId: card.cardId, cardInstanceId: card.id, target };
    if (!applyAction(state, action).ok) return [];
    return [{ ...inputs(state, inputCard, target, multipleSources), action }];
  });
  return { prompts: options.reduce<string[]>((longest, option) => option.picks.length > longest.length
    ? option.picks.map(pick => pick.prompt ?? 'Choose a target') : longest, []), options };
}

// Every catalog card uses the engine's legal targets and exact physical card instance.
export const cardInteractions: Record<string, (state: GameState, card: CardInstance) => CardInteraction>
  = Object.fromEntries(Object.keys(CARD_CATALOG).map(id => [id, cardInteraction]));
