import { useCallback, useState } from 'react';
import { flushSync } from 'react-dom';

import assetRightsUrl from '../ASSET_RIGHTS.md?url';
import licenseUrl from '../LICENSE?url';
import noticesUrl from '../THIRD_PARTY_NOTICES.md?url';

import { ChessBoard } from './ChessBoard.js';
import { CARD_CATALOG } from './game/cards/catalog.js';
import {
  activeDoomsayers,
  annexationDests,
  applyAction,
  assassinDests,
  cowardiceDests,
  doomsayerTargets,
  dubbingDests,
  forcedMarchDests,
  isPromotionSquare,
  legalDests,
  longJumpDests,
  onslaughtDests,
  squaringTheCircleDests,
} from './game/reducer.js';
import { createGameState } from './game/state.js';
import type { CardInstance, CardMove, Color, DoomsayerRole, GameState, SquareName, TurnPhase } from './game/types.js';

const titleCase = (value: string) => value[0].toUpperCase() + value.slice(1);

function demoGame(): GameState {
  return createGameState({
    hands: {
      white: ['assassin', 'disintegration', 'doomsayer', 'fanatic', 'annexation', 'forced-march', 'cowardice', 'holy-war', 'anathema', 'evangelists', 'tournament', 'cathedral', 'lost-castle', 'siege', 'holy-quest', 'treason', 'onslaught', 'long-jump', 'dubbing', 'squaring-the-circle', 'no-quarter'],
      black: ['assassin', 'disintegration', 'doomsayer', 'fanatic', 'annexation', 'forced-march', 'cowardice', 'holy-war', 'anathema', 'evangelists', 'tournament', 'cathedral', 'lost-castle', 'siege', 'holy-quest', 'treason', 'onslaught', 'long-jump', 'dubbing', 'squaring-the-circle', 'no-quarter'],
    },
    decks: { white: [], black: [] },
  });
}

interface HandProps {
  color: Color;
  cards: CardInstance[];
  active: boolean;
  canPlayNoQuarter: boolean;
  canPlaySquaringTheCircle: boolean;
  phase: TurnPhase;
  selected: string | null;
  onSelect: (card: CardInstance) => void;
  onPreview: (cardId: string) => void;
}

function Hand({ color, cards, active, canPlayNoQuarter, canPlaySquaringTheCircle, phase, selected, onSelect, onPreview }: HandProps) {
  return (
    <section className={`hand hand--${color}`} aria-label={`${titleCase(color)} hand`}>
      <div className="hand__label">
        <span>{titleCase(color)}</span>
        <span>{cards.length} card{cards.length === 1 ? '' : 's'}</span>
      </div>
      <div className="hand__cards">
        {cards.length === 0 ? <span className="empty-hand">No cards</span> : null}
        {cards.map(card => {
          const definition = CARD_CATALOG[card.cardId];
          if (!definition) return null;
          const playable = active
            && definition.timing.includes(phase)
            && (card.cardId !== 'no-quarter' || canPlayNoQuarter)
            && (card.cardId !== 'squaring-the-circle' || canPlaySquaringTheCircle);
          return (
            <button
              aria-disabled={!playable}
              aria-label={definition.name}
              aria-pressed={selected === card.id}
              className={`card ${selected === card.id ? 'card--selected' : ''}`}
              key={card.id}
              onClick={() => { if (playable) onSelect(card); }}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(card);
                }
              }}
              onFocus={() => onPreview(card.cardId)}
              onMouseEnter={() => onPreview(card.cardId)}
              type="button"
            >
              <img alt="" src={definition.image} />
              <span>{definition.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function App() {
  const [game, setGame] = useState(demoGame);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState('disintegration');
  const [message, setMessage] = useState('Select a card or make a legal move.');
  const [hasError, setHasError] = useState(false);
  const [keyboardFrom, setKeyboardFrom] = useState<SquareName | ''>('');
  const [keyboardTo, setKeyboardTo] = useState<SquareName | ''>('');
  const [keyboardTarget, setKeyboardTarget] = useState<SquareName | ''>('');
  const [cardMoveFrom, setCardMoveFrom] = useState<SquareName | null>(null);
  const [cardMoves, setCardMoves] = useState<CardMove[]>([]);
  const [swapFrom, setSwapFrom] = useState<SquareName | null>(null);
  const [namedSpeaker, setNamedSpeaker] = useState<Color>('white');
  const [namedRole, setNamedRole] = useState<DoomsayerRole | ''>('');
  const [namedPieceIds, setNamedPieceIds] = useState<string[]>([]);
  const preview = CARD_CATALOG[previewId] ?? CARD_CATALOG.disintegration;
  const selectedInstance = game.players[game.turn.color].hand.find(card => card.id === selectedCard);
  const selectedDefinition = selectedInstance ? CARD_CATALOG[selectedInstance.cardId] : undefined;
  const doomsayers = activeDoomsayers(game);
  const doomsayerPlayer = game.pendingDoomsayer?.player ?? namedSpeaker;
  const namedCandidates = namedRole ? doomsayerTargets(game, doomsayerPlayer, namedRole) : [];
  const namedLossCount = Math.min(doomsayers.length, namedCandidates.length);
  const lastMove = game.history.at(-1)?.type === 'move' ? game.history.at(-1) : undefined;
  const noQuarterCapture = lastMove?.capturedId
    ? game.pieces.find(piece => piece.id === lastMove.capturedId)
    : undefined;
  const noQuarterMover = lastMove?.to
    ? game.pieces.find(piece => piece.zone === 'board' && piece.square === lastMove.to)
    : undefined;
  const canPlayNoQuarter = game.turn.phase === 'afterMove'
    && game.turn.moveMade
    && game.turn.cardPlays[game.turn.color] < 1
    && noQuarterCapture?.zone === 'captured'
    && noQuarterCapture.square === null
    && (noQuarterCapture.owner !== game.turn.color || noQuarterCapture.neutral)
    && (noQuarterMover?.owner === game.turn.color || noQuarterMover?.neutral === true);
  const canPlaySquaringTheCircle = game.pieces.some(piece =>
    piece.zone === 'board'
    && piece.square
    && squaringTheCircleDests(game, piece.square).length > 0,
  );
  const swap = selectedDefinition?.id === 'holy-war'
    ? {
        firstRole: 'knight', firstOwner: 'own', firstLabel: 'Knight',
        secondRole: 'bishop', secondOwner: 'own', secondLabel: 'Bishop',
      } as const
      : selectedDefinition?.id === 'anathema'
        ? {
            firstRole: 'bishop', firstOwner: 'opponent', firstLabel: 'Bishop',
            secondRole: 'rook', secondOwner: 'opponent', secondLabel: 'Rook',
          } as const
        : selectedDefinition?.id === 'holy-quest'
          ? {
              firstRole: 'bishop', firstOwner: 'opponent', firstLabel: 'Bishop',
              secondRole: 'knight', secondOwner: 'opponent', secondLabel: 'Knight',
            } as const
          : selectedDefinition?.id === 'treason'
            ? {
                firstRole: 'rook', firstOwner: 'opponent', firstLabel: 'Rook',
                secondRole: 'knight', secondOwner: 'opponent', secondLabel: 'Knight',
              } as const
            : selectedDefinition?.id === 'cathedral'
              ? {
                  firstRole: 'rook', firstOwner: 'own', firstLabel: 'Rook',
                  secondRole: 'bishop', secondOwner: 'own', secondLabel: 'Bishop',
                } as const
              : selectedDefinition?.id === 'siege'
                ? {
                    firstRole: 'knight', firstOwner: 'own', firstLabel: 'Knight',
                    secondRole: 'rook', secondOwner: 'own', secondLabel: 'Rook',
                  } as const
                : selectedDefinition?.id === 'evangelists'
                  ? {
                      firstRole: 'bishop', firstOwner: 'own', firstLabel: 'Your Bishop',
                      secondRole: 'bishop', secondOwner: 'opponent', secondLabel: 'Opponent Bishop',
                    } as const
                  : selectedDefinition?.id === 'tournament'
                    ? {
                        firstRole: 'knight', firstOwner: 'own', firstLabel: 'Your Knight',
                        secondRole: 'knight', secondOwner: 'opponent', secondLabel: 'Opponent Knight',
                      } as const
                    : selectedDefinition?.id === 'lost-castle'
                      ? {
                          firstRole: 'rook', firstOwner: 'own', firstLabel: 'Your Rook',
                          secondRole: 'rook', secondOwner: 'opponent', secondLabel: 'Opponent Rook',
                        } as const
                      : null;
  const moveCardId = selectedDefinition?.id === 'assassin'
    || selectedDefinition?.id === 'forced-march'
    || selectedDefinition?.id === 'annexation'
    || selectedDefinition?.id === 'onslaught'
    || selectedDefinition?.id === 'long-jump'
    || selectedDefinition?.id === 'dubbing'
    || selectedDefinition?.id === 'squaring-the-circle'
    || selectedDefinition?.id === 'cowardice'
    ? selectedDefinition.id
    : null;
  const moveCardDests = (from: SquareName) => moveCardId === 'assassin'
    ? assassinDests(game, from)
    : moveCardId === 'cowardice'
      ? cowardiceDests(game, from)
    : moveCardId === 'annexation'
      ? annexationDests(game, from)
    : moveCardId === 'onslaught'
      ? onslaughtDests(game, from)
      : moveCardId === 'long-jump'
        ? longJumpDests(game, from)
        : moveCardId === 'dubbing'
          ? dubbingDests(game, from)
          : moveCardId === 'squaring-the-circle'
            ? squaringTheCircleDests(game, from)
          : forcedMarchDests(game, from);
  const moveCardLimit = moveCardId === 'onslaught'
    ? Number.POSITIVE_INFINITY
    : moveCardId === 'assassin' || moveCardId === 'long-jump' || moveCardId === 'dubbing' || moveCardId === 'squaring-the-circle' || moveCardId === 'cowardice' ? 1 : 2;
  const moveCardPieceLabel = moveCardId === 'cowardice'
    ? 'Opponent Pawn'
    : moveCardId === 'assassin' || moveCardId === 'dubbing' || moveCardId === 'squaring-the-circle'
    ? 'Piece'
    : moveCardId === 'long-jump' ? 'Knight' : 'Pawn';
  const moves = legalDests(game);
  const keyboardDestinations = keyboardFrom
    ? moveCardId
      ? moveCardDests(keyboardFrom).filter(
          square => !cardMoves.some(move => move.to === square),
        )
      : moves.get(keyboardFrom) ?? []
    : [];
  const cardTargets = game.pieces.filter(piece => {
    if (
      piece.zone !== 'board'
      || !piece.square
    ) return false;
    const matchesOwner = (owner: 'own' | 'opponent') => piece.neutral
      || (owner === 'own' ? piece.owner === game.turn.color : piece.owner !== game.turn.color);
    if (swap) {
      return matchesOwner(swap.firstOwner)
          && (piece.role === swap.firstRole || piece.originalRole === swap.firstRole)
        || matchesOwner(swap.secondOwner)
          && (piece.role === swap.secondRole || piece.originalRole === swap.secondRole);
    }
    if (moveCardId === 'cowardice') {
      return matchesOwner('opponent') && piece.originalRole === 'pawn' && !piece.promoted;
    }
    if (!matchesOwner('own')) return false;
    if (moveCardId === 'assassin' || moveCardId === 'dubbing' || moveCardId === 'squaring-the-circle') return true;
    if (moveCardId === 'long-jump') {
      return piece.role === 'knight' || piece.originalRole === 'knight';
    }
    return piece.originalRole === 'pawn'
      && !piece.promoted
      && (!piece.royal || selectedDefinition?.id === 'fanatic' || Boolean(moveCardId));
  });
  const firstSwapPieces = swap
    ? cardTargets.filter(piece =>
        (piece.neutral || (swap.firstOwner === 'own' ? piece.owner === game.turn.color : piece.owner !== game.turn.color))
        && (piece.role === swap.firstRole || piece.originalRole === swap.firstRole),
      )
    : [];
  const secondSwapPieces = swap
    ? cardTargets.filter(piece =>
        (piece.neutral || (swap.secondOwner === 'own' ? piece.owner === game.turn.color : piece.owner !== game.turn.color))
        && (piece.role === swap.secondRole || piece.originalRole === swap.secondRole),
      )
    : [];
  const availableCardTargets = cardTargets.filter(
    piece => !cardMoves.some(move => move.from === piece.square)
      && (
        !moveCardId
        || moveCardDests(piece.square!).some(
          square => !cardMoves.some(move => move.to === square),
        )
      ),
  );

  const reduce = useCallback((action: Parameters<typeof applyAction>[1]) => {
    const result = applyAction(game, action);
    if (!result.ok) {
      setMessage(result.error.message);
      setHasError(true);
      return false;
    }
    flushSync(() => setGame(result.state));
    setHasError(false);
    setKeyboardFrom('');
    setKeyboardTo('');
    setKeyboardTarget('');
    setCardMoveFrom(null);
    setCardMoves([]);
    setSwapFrom(null);
    setNamedRole('');
    setNamedPieceIds([]);
    if (result.state.outcome) {
      setMessage(
        result.state.outcome.reason === 'stalemate'
          ? 'Game over — stalemate.'
          : `Game over — ${titleCase(result.state.outcome.winner!)} wins by checkmate.`,
      );
      return true;
    }
    const event = result.state.history.at(-1);
    if (event?.type === 'pieceNamed') {
      const losses = (event.capturedIds ?? []).flatMap(id => {
        const piece = game.pieces.find(candidate => candidate.id === id);
        return piece?.square ? [`${titleCase(piece.role)} on ${piece.square}`] : [];
      });
      setMessage(
        losses.length
          ? `${titleCase(event.speaker!)} intentionally named ${titleCase(event.name!)}; ${losses.join(' and ')} ${losses.length === 1 ? 'was' : 'were'} captured by Doomsayer.`
          : `${titleCase(event.speaker!)} intentionally named ${titleCase(event.name!)} but owned no capturable piece of that type. Doomsayer remains active.`,
      );
    } else if (event?.type === 'doomsayerDeclined') {
      setMessage(`${titleCase(event.player!)} declined the immediate option. Doomsayer remains active.`);
    } else if (event?.type === 'cardFizzled') {
      const name = CARD_CATALOG[event.cardId!]?.name ?? 'Card';
      setMessage(
        event.reason === 'SELF_CHECK'
          ? `${name} was spent, but leaving the King in check made its effect fizzle.`
          : `${name} was spent, but direct checkmate made its effect fizzle.`,
      );
    } else if (event?.type === 'cardPlayed') {
      const capturedMove = result.state.history.at(-2);
      const capturedPiece = capturedMove?.capturedId
        ? result.state.pieces.find(piece => piece.id === capturedMove.capturedId)
        : undefined;
      setMessage(
        event.cardId === 'doomsayer'
          ? result.state.pendingDoomsayer
            ? `Doomsayer is active. ${titleCase(result.state.pendingDoomsayer.player)} may intentionally name a piece immediately or decline.`
            : 'Doomsayer remains active until a piece is lost to its effect.'
        : event.cardId === 'no-quarter' && capturedMove?.type === 'move' && capturedPiece
          ? `No Quarter made the captured piece (${titleCase(capturedPiece.role)}) dead after ${capturedMove.from}–${capturedMove.to}.`
        : event.cardId === 'fanatic'
          ? `Fanatic moved the Pawn three squares from ${event.target}.`
          : event.cardId === 'annexation'
            ? `Annexation moved ${Array.isArray(event.target) ? event.target.length : 0} Pawn${Array.isArray(event.target) && event.target.length === 1 ? '' : 's'} forward.`
          : event.cardId === 'assassin' && Array.isArray(event.target) && event.target[0]
            ? `Assassin moved from ${event.target[0].from} to ${event.target[0].to} and captured your piece.`
          : event.cardId === 'forced-march'
            ? `Forced March moved ${Array.isArray(event.target) ? event.target.length : 0} Pawn${Array.isArray(event.target) && event.target.length === 1 ? '' : 's'} sideways.`
          : event.cardId === 'onslaught'
            ? `Onslaught moved ${Array.isArray(event.target) ? event.target.length : 0} Pawn${Array.isArray(event.target) && event.target.length === 1 ? '' : 's'} forward.`
          : event.cardId === 'long-jump' && Array.isArray(event.target) && event.target[0]
            ? `Long Jump moved the Knight from ${event.target[0].from} to ${event.target[0].to}.`
          : event.cardId === 'dubbing' && Array.isArray(event.target) && event.target[0]
            ? `Dubbing moved the piece from ${event.target[0].from} to ${event.target[0].to} as a Knight.`
          : event.cardId === 'squaring-the-circle' && Array.isArray(event.target) && event.target[0]
            ? `Squaring the Circle moved the piece from ${event.target[0].from} to the empty corner ${event.target[0].to}.`
          : event.cardId === 'cowardice' && Array.isArray(event.target) && event.target[0]
            ? `Cowardice moved the opponent's Pawn from ${event.target[0].from} to ${event.target[0].to}.`
            : event.cardId === 'holy-war' && event.target && !Array.isArray(event.target) && typeof event.target === 'object' && 'knight' in event.target && 'bishop' in event.target
              ? `Holy War swapped ${event.target.knight} and ${event.target.bishop}.`
            : event.cardId === 'anathema' && event.target && !Array.isArray(event.target) && typeof event.target === 'object' && 'bishop' in event.target && 'rook' in event.target
              ? `Anathema swapped ${event.target.bishop} and ${event.target.rook}.`
            : event.cardId === 'holy-quest' && event.target && !Array.isArray(event.target) && typeof event.target === 'object' && 'bishop' in event.target && 'knight' in event.target
              ? `Holy Quest swapped ${event.target.bishop} and ${event.target.knight}.`
            : event.cardId === 'treason' && event.target && !Array.isArray(event.target) && typeof event.target === 'object' && 'rook' in event.target && 'knight' in event.target
              ? `Treason swapped ${event.target.rook} and ${event.target.knight}.`
            : event.cardId === 'cathedral' && event.target && !Array.isArray(event.target) && typeof event.target === 'object' && 'rook' in event.target && 'bishop' in event.target
              ? `Cathedral swapped ${event.target.rook} and ${event.target.bishop}.`
            : event.cardId === 'siege' && event.target && !Array.isArray(event.target) && typeof event.target === 'object' && 'knight' in event.target && 'rook' in event.target
              ? `Siege swapped ${event.target.knight} and ${event.target.rook}.`
            : event.cardId === 'evangelists' && event.target && !Array.isArray(event.target) && typeof event.target === 'object' && 'own' in event.target
              ? `Evangelists swapped ${event.target.own} and ${event.target.opponent}.`
            : event.cardId === 'tournament' && event.target && !Array.isArray(event.target) && typeof event.target === 'object' && 'own' in event.target
              ? `Tournament swapped ${event.target.own} and ${event.target.opponent}.`
            : event.cardId === 'lost-castle' && event.target && !Array.isArray(event.target) && typeof event.target === 'object' && 'own' in event.target
              ? `Lost Castle swapped ${event.target.own} and ${event.target.opponent}.`
          : `Disintegration removed the Pawn on ${event.target}.`,
      );
    } else {
      setMessage(
        result.state.pendingRescue
          ? 'Your King is still in check. Play a rescue card before ending the turn.'
          : 'Move complete. You may play a card or end the turn.',
      );
    }
    return true;
  }, [game]);

  const move = useCallback((from: SquareName, to: SquareName) => {
    const moving = game.pieces.find(piece => piece.zone === 'board' && piece.square === from);
    const promotes = moving?.role === 'pawn' && isPromotionSquare(game, moving.owner, to);
    const promotion = promotes
      ? window.prompt('Promote to queen, rook, bishop, or knight:', 'queen')
      : undefined;
    if (promotion === null) return false;
    return reduce({ type: 'move', from, to, ...(promotion ? { promotion } : {}) });
  }, [game.pieces, reduce]);

  const addCardMove = useCallback((from: SquareName, to: SquareName) => {
    if (!moveCardDests(from).includes(to)) {
      setMessage(
        moveCardId === 'annexation'
          ? 'That Pawn needs two clear forward squares.'
          : moveCardId === 'assassin'
            ? 'That piece cannot capture the selected piece normally.'
          : moveCardId === 'onslaught'
            ? 'That Pawn must move one square forward to an empty square.'
          : moveCardId === 'cowardice'
            ? "Move the opponent's Pawn one or two clear squares backward."
          : moveCardId === 'long-jump'
            ? 'Choose an empty square of the opposite color.'
          : moveCardId === 'dubbing'
            ? 'Move the piece like a Knight to an empty square.'
          : moveCardId === 'squaring-the-circle'
            ? 'Exactly three corners must be occupied; move the piece to the sole empty corner.'
            : 'That Pawn must move one square sideways to an empty square.',
      );
      setHasError(true);
      return;
    }
    if (cardMoves.some(move => move.from === from || move.to === to)) {
      setMessage(`Choose a different ${moveCardPieceLabel.toLowerCase()} and destination.`);
      setHasError(true);
      return;
    }
    const next = [...cardMoves, { from, to }];
    setCardMoves(next);
    setCardMoveFrom(null);
    setKeyboardFrom('');
    setKeyboardTo('');
    setMessage(
      moveCardId === 'onslaught'
        ? `${next.length} Pawn move${next.length === 1 ? '' : 's'} ready. Play Onslaught now, or choose another Pawn.`
      : moveCardId === 'assassin'
        ? 'Assassin ready. Play the card.'
      : moveCardId === 'cowardice'
        ? 'Cowardice ready. Play the card.'
      : moveCardId === 'long-jump'
        ? 'Long Jump ready. Play the card.'
      : moveCardId === 'dubbing'
        ? 'Dubbing ready. Play the card.'
      : moveCardId === 'squaring-the-circle'
        ? 'Squaring the Circle ready. Play the card.'
      : next.length === 2
        ? `Two Pawn moves ready. Play ${selectedDefinition?.name}.`
        : 'One Pawn move ready. Play the card now, or choose one more Pawn.',
    );
    setHasError(false);
  }, [cardMoves, moveCardDests, moveCardId, moveCardPieceLabel, selectedDefinition?.name]);

  const playSwap = useCallback((first: SquareName, second: SquareName) => {
    if (!selectedInstance || !swap) return;
    const target = selectedInstance.cardId === 'holy-war'
      ? { knight: first, bishop: second }
      : selectedInstance.cardId === 'anathema'
        ? { bishop: first, rook: second }
        : selectedInstance.cardId === 'holy-quest'
          ? { bishop: first, knight: second }
          : selectedInstance.cardId === 'treason'
            ? { rook: first, knight: second }
            : selectedInstance.cardId === 'cathedral'
              ? { rook: first, bishop: second }
              : selectedInstance.cardId === 'siege'
                ? { knight: first, rook: second }
                : { own: first, opponent: second };
    if (reduce({
      type: 'playCard',
      cardId: selectedInstance.cardId,
      cardInstanceId: selectedInstance.id,
      target,
    })) setSelectedCard(null);
  }, [reduce, selectedInstance, swap]);

  const target = useCallback((square: SquareName) => {
    if (!selectedInstance) return;
    if (swap) {
      const matchesOwner = (owner: 'own' | 'opponent', piece: (typeof cardTargets)[number]) => piece.neutral
        || (owner === 'own' ? piece.owner === game.turn.color : piece.owner !== game.turn.color);
      const choice = (label: string) => label.startsWith('Your ') || label.startsWith('Opponent ')
        ? label
        : `a ${label}`;
      if (swapFrom === square) {
        setSwapFrom(null);
        setMessage(`Piece selection canceled. Choose ${choice(swap.firstLabel)} or ${choice(swap.secondLabel)}.`);
        setHasError(false);
        return;
      }
      const piece = cardTargets.find(candidate => candidate.square === square);
      if (!piece) {
        setMessage(
          selectedInstance.cardId === 'anathema' || selectedInstance.cardId === 'holy-quest' || selectedInstance.cardId === 'treason'
            ? `Choose an opposing ${swap.firstLabel} or ${swap.secondLabel}.`
            : `Choose ${swap.firstLabel} or ${swap.secondLabel}.`,
        );
        setHasError(true);
        return;
      }
      if (!swapFrom) {
        setSwapFrom(square);
        const isFirst = matchesOwner(swap.firstOwner, piece)
          && (piece.role === swap.firstRole || piece.originalRole === swap.firstRole);
        const isSecond = matchesOwner(swap.secondOwner, piece)
          && (piece.role === swap.secondRole || piece.originalRole === swap.secondRole);
        const nextLabel = isFirst && !isSecond
          ? choice(swap.secondLabel)
          : isSecond && !isFirst
            ? choice(swap.firstLabel)
            : 'a complementary piece';
        setMessage(
          `Choose ${nextLabel} to swap with ${square}.`,
        );
        setHasError(false);
        return;
      }
      const first = cardTargets.find(candidate => candidate.square === swapFrom)!;
      const firstMatchesFirst = matchesOwner(swap.firstOwner, first)
        && (first.role === swap.firstRole || first.originalRole === swap.firstRole);
      const firstMatchesSecond = matchesOwner(swap.secondOwner, first)
        && (first.role === swap.secondRole || first.originalRole === swap.secondRole);
      const secondMatchesFirst = matchesOwner(swap.firstOwner, piece)
        && (piece.role === swap.firstRole || piece.originalRole === swap.firstRole);
      const secondMatchesSecond = matchesOwner(swap.secondOwner, piece)
        && (piece.role === swap.secondRole || piece.originalRole === swap.secondRole);
      if (!((firstMatchesFirst && secondMatchesSecond) || (secondMatchesFirst && firstMatchesSecond))) {
        setMessage(`${selectedDefinition?.name} needs ${swap.firstLabel} and ${swap.secondLabel}.`);
        setHasError(true);
        return;
      }
      playSwap(
        firstMatchesFirst && secondMatchesSecond ? swapFrom : square,
        firstMatchesFirst && secondMatchesSecond ? square : swapFrom,
      );
      return;
    }
    if (moveCardId) {
      if (cardMoveFrom) {
        if (square === cardMoveFrom) {
          setCardMoveFrom(null);
          setMessage(
            moveCardId === 'long-jump'
              ? 'Knight selection canceled. Choose a Knight.'
              : moveCardId === 'assassin'
                ? 'Piece selection canceled. Choose a piece you control.'
              : moveCardId === 'dubbing'
                ? 'Piece selection canceled. Choose a piece.'
              : moveCardId === 'squaring-the-circle'
                ? 'Piece selection canceled. Choose a piece you control.'
              : moveCardId === 'cowardice'
                ? "Pawn selection canceled. Choose an opponent's Pawn."
              : 'Pawn selection canceled. Choose a Pawn.',
          );
          setHasError(false);
        } else {
          addCardMove(cardMoveFrom, square);
        }
        return;
      }
      if (cardMoves.length >= moveCardLimit) {
        setMessage(
          moveCardId === 'long-jump'
            ? 'Long Jump is ready. Play the card.'
            : moveCardId === 'assassin'
              ? 'Assassin is ready. Play the card.'
            : moveCardId === 'dubbing'
              ? 'Dubbing is ready. Play the card.'
            : moveCardId === 'squaring-the-circle'
              ? 'Squaring the Circle is ready. Play the card.'
            : moveCardId === 'cowardice'
              ? 'Cowardice is ready. Play the card.'
            : `Two Pawn moves are already ready. Play ${selectedDefinition?.name}.`,
        );
        setHasError(true);
        return;
      }
      const piece = availableCardTargets.find(candidate => candidate.square === square);
      if (!piece) {
        setMessage(
          moveCardId === 'long-jump'
            ? 'Choose one of your available Knights.'
            : moveCardId === 'assassin'
              ? 'Choose a piece that can capture another piece you control.'
            : moveCardId === 'dubbing'
              ? 'Choose an available piece you control.'
            : moveCardId === 'squaring-the-circle'
              ? 'Exactly three corners must be occupied; choose an available piece you control.'
            : moveCardId === 'cowardice'
              ? "Choose an available opponent's Pawn."
            : 'Choose one of your available Pawns.',
        );
        setHasError(true);
        return;
      }
      setCardMoveFrom(square);
      setMessage(
        moveCardId === 'annexation'
          ? `Pawn ${square} selected. Choose its two-square forward destination.`
          : moveCardId === 'assassin'
            ? `${titleCase(piece.role)} ${square} selected. Choose another piece you control to capture.`
          : moveCardId === 'onslaught'
            ? `Pawn ${square} selected. Choose its one-square forward destination.`
          : moveCardId === 'cowardice'
            ? `Opponent Pawn ${square} selected. Choose a one- or two-square backward destination.`
          : moveCardId === 'long-jump'
            ? `Knight ${square} selected. Choose an empty square of the opposite color.`
          : moveCardId === 'dubbing'
            ? `${titleCase(piece.role)} ${square} selected. Choose an empty Knight-move destination.`
          : moveCardId === 'squaring-the-circle'
            ? `${titleCase(piece.role)} ${square} selected. Choose the sole empty corner.`
            : `Pawn ${square} selected. Choose an empty square beside it.`,
      );
      setHasError(false);
      return;
    }
    if (reduce({
      type: 'playCard',
      cardId: selectedInstance.cardId,
      cardInstanceId: selectedInstance.id,
      target: square,
    })) {
      setSelectedCard(null);
    }
  }, [addCardMove, availableCardTargets, cardMoveFrom, cardMoves.length, cardTargets, game.turn.color, moveCardId, moveCardLimit, playSwap, reduce, selectedDefinition?.name, selectedInstance, swap, swapFrom]);

  const playMoveCard = () => {
    if (!selectedInstance || !moveCardId || cardMoves.length === 0) return;
    if (reduce({
      type: 'playCard',
      cardId: selectedInstance.cardId,
      cardInstanceId: selectedInstance.id,
      target: cardMoves,
    })) setSelectedCard(null);
  };

  const reset = () => {
    setGame(demoGame());
    setSelectedCard(null);
    setMessage('Select a card or make a legal move.');
    setHasError(false);
    setKeyboardFrom('');
    setKeyboardTo('');
    setKeyboardTarget('');
    setCardMoveFrom(null);
    setCardMoves([]);
    setSwapFrom(null);
    setNamedRole('');
    setNamedPieceIds([]);
  };

  const selectCard = (card: CardInstance) => {
    const selecting = selectedCard !== card.id;
    setPreviewId(card.cardId);
    flushSync(() => setSelectedCard(card.id));
    setMessage(
      selecting
        ? card.cardId === 'no-quarter'
          ? canPlayNoQuarter
            ? 'The captured piece is eligible. Play No Quarter now; no target is required.'
            : 'No Quarter can only be played immediately after your ordinary move captures an enemy piece.'
        : card.cardId === 'doomsayer'
          ? 'No board target is required. Play Doomsayer, then the opponent may intentionally name a piece immediately.'
        : card.cardId === 'holy-war'
          ? 'Choose a Knight, then choose a Bishop to swap with it.'
          : card.cardId === 'anathema'
            ? "Choose one of your opponent's Bishops, then choose one of their Rooks."
          : card.cardId === 'holy-quest'
            ? "Choose one of your opponent's Bishops, then choose one of their Knights."
          : card.cardId === 'treason'
            ? "Choose one of your opponent's Rooks, then choose one of their Knights."
          : card.cardId === 'cathedral'
            ? 'Choose one of your Rooks, then choose one of your Bishops.'
          : card.cardId === 'siege'
            ? 'Choose one of your Knights, then choose one of your Rooks.'
          : card.cardId === 'evangelists'
            ? "Choose one of your Bishops, then choose one of your opponent's Bishops."
          : card.cardId === 'tournament'
            ? "Choose one of your Knights, then choose one of your opponent's Knights."
          : card.cardId === 'lost-castle'
            ? "Choose one of your Rooks, then choose one of your opponent's Rooks."
          : card.cardId === 'forced-march' || card.cardId === 'annexation' || card.cardId === 'onslaught'
          ? `Choose a Pawn, then choose its ${card.cardId === 'annexation' ? 'two-square forward' : card.cardId === 'onslaught' ? 'one-square forward' : 'sideways'} destination.`
          : card.cardId === 'assassin'
            ? 'Choose a piece you control, then choose another piece you control that it can capture normally.'
          : card.cardId === 'long-jump'
            ? 'Choose a Knight, then choose any empty square of the opposite color.'
          : card.cardId === 'dubbing'
            ? 'Choose a piece you control, then choose an empty Knight-move destination.'
          : card.cardId === 'squaring-the-circle'
            ? 'Exactly three of the four fixed corners (a1, a8, h1, h8) must be occupied. Choose any piece you control, then the sole empty corner.'
          : card.cardId === 'cowardice'
            ? "Choose an opponent's Pawn, then choose a clear one- or two-square backward destination."
          : 'Choose one of your Pawns on the board.'
        : 'Card already selected.',
    );
    setHasError(false);
    setKeyboardTarget('');
    setKeyboardFrom('');
    setKeyboardTo('');
    setCardMoveFrom(null);
    setCardMoves([]);
    setSwapFrom(null);
    setNamedRole('');
    setNamedPieceIds([]);
  };

  const status = game.outcome
    ? game.outcome.reason === 'stalemate'
      ? 'Draw by stalemate'
      : `${titleCase(game.outcome.winner!)} wins by checkmate`
    : `${titleCase(game.turn.color)} to move`;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/" onClick={event => { event.preventDefault(); reset(); }}>
          <span className="brand__mark">N</span>
          <span>knightmare chess</span>
        </a>
        <div className="turn" aria-live="polite">
          <span className={`turn__dot turn__dot--${game.turn.color}`} />
          {status}
        </div>
      </header>

      <main className="game">
        <div className="game__center">
          <div className="hands-rail">
            <Hand
              active={!game.outcome && game.turn.color === 'black' && game.turn.cardPlays.black < 1 && !game.pendingDoomsayer}
              canPlayNoQuarter={canPlayNoQuarter}
              canPlaySquaringTheCircle={canPlaySquaringTheCircle}
              cards={game.players.black.hand}
              color="black"
              onPreview={setPreviewId}
              onSelect={selectCard}
              phase={game.turn.phase}
              selected={selectedCard}
            />
            <Hand
              active={!game.outcome && game.turn.color === 'white' && game.turn.cardPlays.white < 1 && !game.pendingDoomsayer}
              canPlayNoQuarter={canPlayNoQuarter}
              canPlaySquaringTheCircle={canPlaySquaringTheCircle}
              cards={game.players.white.hand}
              color="white"
              onPreview={setPreviewId}
              onSelect={selectCard}
              phase={game.turn.phase}
              selected={selectedCard}
            />
          </div>

          <section className="board-panel" aria-label="Game board">
            <div className="board-heading">
              <div>
                <span className="eyebrow">Local self-play</span>
                <h1>Your board, both hands</h1>
              </div>
              <span className="phase">{game.turn.phase === 'beforeMove' ? 'before move' : 'after move'}</span>
            </div>

            <div className={selectedCard && selectedDefinition?.id !== 'no-quarter' && selectedDefinition?.id !== 'doomsayer' ? 'board-frame board-frame--targeting' : 'board-frame'}>
              <ChessBoard
                onMove={move}
                onTarget={target}
                selectedTarget={swapFrom ?? cardMoveFrom}
                state={game}
                targeting={Boolean(selectedCard) && selectedDefinition?.id !== 'no-quarter' && selectedDefinition?.id !== 'doomsayer'}
              />
            </div>

            <div className="controls">
              <div className="controls__main">
                <p className="message" role={hasError ? 'alert' : 'status'}>
                  {message}
                </p>
                <div className="controls__buttons">
                  {selectedDefinition?.id === 'no-quarter' ? (
                    <button
                      className="button button--primary"
                      disabled={!canPlayNoQuarter}
                      onClick={() => {
                        if (selectedInstance && reduce({
                          type: 'playCard',
                          cardId: 'no-quarter',
                          cardInstanceId: selectedInstance.id,
                        })) setSelectedCard(null);
                      }}
                      type="button"
                    >
                      Play No Quarter
                    </button>
                  ) : null}
                  {selectedDefinition?.id === 'doomsayer' ? (
                    <button
                      className="button button--primary"
                      onClick={() => {
                        if (selectedInstance && reduce({
                          type: 'playCard',
                          cardId: 'doomsayer',
                          cardInstanceId: selectedInstance.id,
                        })) setSelectedCard(null);
                      }}
                      type="button"
                    >
                      Play Doomsayer
                    </button>
                  ) : null}
                  {moveCardId ? (
                    <button
                      aria-label={`Play ${selectedDefinition?.name}`}
                      className="button button--primary"
                      disabled={cardMoves.length === 0 || Boolean(cardMoveFrom)}
                      onClick={playMoveCard}
                      type="button"
                    >
                      Play ({cardMoves.length}{moveCardId === 'onslaught' ? ' selected' : `/${moveCardLimit}`})
                    </button>
                  ) : null}
                  <button className="button button--ghost" onClick={reset} type="button">Reset</button>
                  <button
                    className="button button--primary"
                    disabled={!game.turn.moveMade || Boolean(game.pendingRescue) || Boolean(game.outcome)}
                    onClick={() => {
                      if (reduce({ type: 'endTurn' })) setSelectedCard(null);
                    }}
                    type="button"
                  >
                    End turn
                  </button>
                </div>
              </div>

              {doomsayers.length ? (
                <>
                <section className="active-effects" aria-label="Active effects">
                  <span>Doomsayer</span>
                </section>
                <section className="doomsayer-controls" aria-label="Doomsayer announcement">
                  <div>
                    <strong>{doomsayers.length} Doomsayer effect{doomsayers.length === 1 ? '' : 's'} active</strong>
                    <span>
                      {game.pendingDoomsayer
                        ? `${titleCase(doomsayerPlayer)} may name a piece immediately.`
                        : `${titleCase(doomsayerPlayer)} may record intentional game speech.`}
                      {' '}Quoted rules, accidental words, and non-game speech do not count.
                    </span>
                  </div>
                  <form onSubmit={event => {
                    event.preventDefault();
                    if (!namedRole) return;
                    const pieceIds = new FormData(event.currentTarget).getAll('doomsayer-loss').map(String);
                    reduce({
                      type: 'namePiece',
                      speaker: doomsayerPlayer,
                      name: namedRole,
                      losses: pieceIds.map((pieceId, index) => ({
                        effectId: doomsayers[index].card.id,
                        pieceId,
                      })),
                    });
                  }}>
                    {!game.pendingDoomsayer ? (
                      <label>
                        Speaker
                        <select
                          aria-label="Speaker"
                          onChange={event => {
                            setNamedSpeaker(event.target.value as Color);
                            setNamedPieceIds([]);
                          }}
                          value={namedSpeaker}
                        >
                          <option value="white">White</option>
                          <option value="black">Black</option>
                        </select>
                      </label>
                    ) : null}
                    <label>
                      Piece name
                      <select
                        aria-label="Piece name"
                        onChange={event => {
                          setNamedRole(event.target.value as DoomsayerRole | '');
                          setNamedPieceIds([]);
                        }}
                        required
                        value={namedRole}
                      >
                        <option value="">Choose piece name</option>
                        <option value="pawn">Pawn</option>
                        <option value="knight">Knight</option>
                        <option value="bishop">Bishop</option>
                        <option value="rook">Rook</option>
                        <option value="queen">Queen</option>
                      </select>
                    </label>
                    {Array.from({ length: namedLossCount }, (_, index) => (
                      <label key={index}>
                        Piece to lose {namedLossCount > 1 ? index + 1 : ''}
                        <select
                          aria-label={`Piece to lose ${index + 1}`}
                          name="doomsayer-loss"
                          onChange={event => {
                            const next = namedPieceIds.slice(0, namedLossCount);
                            next[index] = event.target.value;
                            setNamedPieceIds(next);
                          }}
                          required
                          value={namedPieceIds[index] ?? ''}
                        >
                          <option value="">Choose physical piece</option>
                          {namedCandidates
                            .filter(piece => !namedPieceIds.some((id, chosen) => chosen !== index && id === piece.id))
                            .map(piece => (
                              <option key={piece.id} label={piece.square!} value={piece.id}>
                                {piece.square} ({titleCase(piece.role)})
                              </option>
                            ))}
                        </select>
                      </label>
                    ))}
                    <button
                      className="button button--primary"
                      disabled={!namedRole || namedPieceIds.length !== namedLossCount || namedPieceIds.some(id => !id)}
                      type="submit"
                    >
                      Name piece intentionally
                    </button>
                    {game.pendingDoomsayer ? (
                      <button
                        className="button button--ghost"
                        onClick={() => reduce({ type: 'declineDoomsayer', player: doomsayerPlayer })}
                        type="button"
                      >
                        Decline immediate option
                      </button>
                    ) : null}
                  </form>
                </section>
                </>
              ) : null}

              <details className="keyboard-controls">
                <summary>Keyboard controls</summary>
                {swap ? (
                  <form onSubmit={event => {
                    event.preventDefault();
                    if (keyboardFrom && keyboardTo) playSwap(keyboardFrom, keyboardTo);
                  }}>
                    <label>
                      {swap.firstLabel}
                      <select
                        aria-label={`${swap.firstLabel} target`}
                        onChange={event => setKeyboardFrom(event.target.value as SquareName)}
                        required
                        value={keyboardFrom}
                      >
                        <option value="">Choose {swap.firstLabel}</option>
                        {firstSwapPieces.map(piece => <option key={piece.id} value={piece.square!}>{piece.square}</option>)}
                      </select>
                    </label>
                    <label>
                      {swap.secondLabel}
                      <select
                        aria-label={`${swap.secondLabel} target`}
                        onChange={event => setKeyboardTo(event.target.value as SquareName)}
                        required
                        value={keyboardTo}
                      >
                        <option value="">Choose {swap.secondLabel}</option>
                        {secondSwapPieces.map(piece => <option key={piece.id} value={piece.square!}>{piece.square}</option>)}
                      </select>
                    </label>
                    <button className="button button--primary" type="submit">Swap pieces</button>
                  </form>
                ) : moveCardId ? (
                  <form onSubmit={event => {
                    event.preventDefault();
                    if (keyboardFrom && keyboardTo) addCardMove(keyboardFrom, keyboardTo);
                  }}>
                    <label>
                      {moveCardPieceLabel}
                      <select
                        aria-label={`${moveCardPieceLabel} source`}
                        disabled={cardMoves.length >= moveCardLimit}
                        onChange={event => {
                          setKeyboardFrom(event.target.value as SquareName);
                          setKeyboardTo('');
                        }}
                        required
                        value={keyboardFrom}
                      >
                        <option value="">Choose {moveCardPieceLabel}</option>
                        {availableCardTargets.map(piece => (
                          <option key={piece.id} value={piece.square!}>
                            {piece.square}{moveCardId === 'assassin' || moveCardId === 'dubbing' || moveCardId === 'squaring-the-circle' ? ` (${titleCase(piece.role)})` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {moveCardId === 'assassin' ? 'Capture on' : moveCardId === 'forced-march' ? 'Sideways to' : moveCardId === 'cowardice' ? 'Backward to' : moveCardId === 'long-jump' ? 'Jump to' : moveCardId === 'dubbing' ? 'Knight move to' : moveCardId === 'squaring-the-circle' ? 'Empty corner' : 'Forward to'}
                      <select
                        aria-label={`${moveCardPieceLabel} destination`}
                        disabled={!keyboardFrom}
                        onChange={event => setKeyboardTo(event.target.value as SquareName)}
                        required
                        value={keyboardTo}
                      >
                        <option value="">Choose square</option>
                        {keyboardDestinations.map(square => <option key={square} value={square}>{square}</option>)}
                      </select>
                    </label>
                    <button className="button button--primary" type="submit">Add move</button>
                  </form>
                ) : selectedDefinition?.id === 'no-quarter' || selectedDefinition?.id === 'doomsayer' ? (
                  <p>No target required. Use the Play {selectedDefinition.name} button above.</p>
                ) : selectedCard ? (
                  <form onSubmit={event => {
                    event.preventDefault();
                    if (keyboardTarget) target(keyboardTarget);
                  }}>
                    <label>
                      Pawn target
                      <select
                        aria-label="Pawn target"
                        onChange={event => setKeyboardTarget(event.target.value as SquareName)}
                        required
                        value={keyboardTarget}
                      >
                        <option value="">Choose square</option>
                        {cardTargets.map(piece => <option key={piece.id} value={piece.square!}>{piece.square}</option>)}
                      </select>
                    </label>
                    <button className="button button--primary" type="submit">Play card</button>
                  </form>
                ) : (
                  <form onSubmit={event => {
                    event.preventDefault();
                    if (keyboardFrom && keyboardTo) move(keyboardFrom, keyboardTo);
                  }}>
                    <label>
                      From
                      <select
                        aria-label="Move from"
                        disabled={game.turn.moveMade || Boolean(game.outcome)}
                        onChange={event => {
                          setKeyboardFrom(event.target.value as SquareName);
                          setKeyboardTo('');
                        }}
                        required
                        value={keyboardFrom}
                      >
                        <option value="">Choose piece</option>
                        {[...moves.keys()].map(square => <option key={square} value={square}>{square}</option>)}
                      </select>
                    </label>
                    <label>
                      To
                      <select
                        aria-label="Move to"
                        disabled={!keyboardFrom}
                        onChange={event => setKeyboardTo(event.target.value as SquareName)}
                        required
                        value={keyboardTo}
                      >
                        <option value="">Choose square</option>
                        {keyboardDestinations.map(square => <option key={square} value={square}>{square}</option>)}
                      </select>
                    </label>
                    <button className="button button--primary" type="submit">Make move</button>
                  </form>
                )}
              </details>
            </div>
          </section>

          <aside className="details" aria-label="Card details" role="region">
            <div className="details__topline">
              <span>card preview</span>
              <span>{preview.points} points</span>
            </div>
            <img alt={`${preview.name} card`} src={preview.image} />
            <h2>{preview.name}</h2>
            <p>{preview.description.replaceAll('*', '')}</p>
            <span className="timing">
              {preview.id === 'no-quarter'
                ? 'Play after an ordinary capture'
                : preview.id === 'holy-war' || preview.id === 'anathema' || preview.id === 'holy-quest' || preview.id === 'treason' || preview.id === 'cathedral' || preview.id === 'siege' || preview.id === 'cowardice' || preview.id === 'doomsayer'
                ? 'Play after your move'
                : preview.id === 'assassin' || preview.id === 'fanatic' || preview.id === 'forced-march' || preview.id === 'annexation' || preview.id === 'onslaught' || preview.id === 'long-jump' || preview.id === 'dubbing' || preview.id === 'squaring-the-circle' || preview.id === 'evangelists' || preview.id === 'tournament' || preview.id === 'lost-castle'
                ? 'Play instead of your move'
                : 'Play before or after your move'}
            </span>
            {preview.continuing ? <span className="timing">Continuing Effect</span> : null}
          </aside>
        </div>
      </main>
      <footer className="footer">
        <span>local frontend · no engine · no server</span>
        <nav aria-label="Legal">
          <a href={licenseUrl}>GPL license</a>
          <a href={noticesUrl}>third-party notices</a>
          <a href={assetRightsUrl}>card asset rights</a>
        </nav>
      </footer>
    </div>
  );
}
