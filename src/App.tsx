import { useCallback, useState } from 'react';

import assetRightsUrl from '../ASSET_RIGHTS.md?url';
import licenseUrl from '../LICENSE?url';
import noticesUrl from '../THIRD_PARTY_NOTICES.md?url';

import { ChessBoard } from './ChessBoard.js';
import { CARD_CATALOG } from './game/cards/catalog.js';
import { annexationDests, applyAction, forcedMarchDests, legalDests } from './game/reducer.js';
import { createGameState } from './game/state.js';
import type { CardInstance, CardMove, Color, GameState, SquareName, TurnPhase } from './game/types.js';

const titleCase = (value: string) => value[0].toUpperCase() + value.slice(1);

function demoGame(): GameState {
  return createGameState({
    hands: {
      white: ['disintegration', 'fanatic', 'annexation', 'forced-march', 'holy-war'],
      black: ['disintegration', 'fanatic', 'annexation', 'forced-march', 'holy-war'],
    },
    decks: { white: [], black: [] },
  });
}

interface HandProps {
  color: Color;
  cards: CardInstance[];
  active: boolean;
  phase: TurnPhase;
  selected: string | null;
  onSelect: (card: CardInstance) => void;
  onPreview: (cardId: string) => void;
}

function Hand({ color, cards, active, phase, selected, onSelect, onPreview }: HandProps) {
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
          return (
            <button
              aria-label={definition.name}
              aria-pressed={selected === card.id}
              className={`card ${selected === card.id ? 'card--selected' : ''}`}
              disabled={!active || !definition.timing.includes(phase)}
              key={card.id}
              onClick={() => onSelect(card)}
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
  const preview = CARD_CATALOG[previewId] ?? CARD_CATALOG.disintegration;
  const selectedInstance = game.players[game.turn.color].hand.find(card => card.id === selectedCard);
  const selectedDefinition = selectedInstance ? CARD_CATALOG[selectedInstance.cardId] : undefined;
  const moveCardId = selectedDefinition?.id === 'forced-march' || selectedDefinition?.id === 'annexation'
    ? selectedDefinition.id
    : null;
  const moveCardDests = (from: SquareName) => moveCardId === 'annexation'
    ? annexationDests(game, from)
    : forcedMarchDests(game, from);
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
      || (piece.owner !== game.turn.color && !piece.neutral)
    ) return false;
    if (selectedDefinition?.id === 'holy-war') {
      return piece.role === 'knight'
        || piece.originalRole === 'knight'
        || piece.role === 'bishop'
        || piece.originalRole === 'bishop';
    }
    return piece.originalRole === 'pawn'
      && !piece.promoted
      && (!piece.royal || selectedDefinition?.id === 'fanatic' || Boolean(moveCardId));
  });
  const holyWarKnights = cardTargets.filter(piece => piece.role === 'knight' || piece.originalRole === 'knight');
  const holyWarBishops = cardTargets.filter(piece => piece.role === 'bishop' || piece.originalRole === 'bishop');
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
    setGame(result.state);
    setHasError(false);
    setKeyboardFrom('');
    setKeyboardTo('');
    setKeyboardTarget('');
    setCardMoveFrom(null);
    setCardMoves([]);
    setSwapFrom(null);
    if (result.state.outcome) {
      setMessage(
        result.state.outcome.reason === 'stalemate'
          ? 'Game over — stalemate.'
          : `Game over — ${titleCase(result.state.outcome.winner!)} wins by checkmate.`,
      );
      return true;
    }
    const event = result.state.history.at(-1);
    if (event?.type === 'cardFizzled') {
      const name = CARD_CATALOG[event.cardId!]?.name ?? 'Card';
      setMessage(
        event.reason === 'SELF_CHECK'
          ? `${name} was spent, but leaving the King in check made its effect fizzle.`
          : `${name} was spent, but direct checkmate made its effect fizzle.`,
      );
    } else if (event?.type === 'cardPlayed') {
      setMessage(
        event.cardId === 'fanatic'
          ? `Fanatic moved the Pawn three squares from ${event.target}.`
          : event.cardId === 'annexation'
            ? `Annexation moved ${Array.isArray(event.target) ? event.target.length : 0} Pawn${Array.isArray(event.target) && event.target.length === 1 ? '' : 's'} forward.`
          : event.cardId === 'forced-march'
            ? `Forced March moved ${Array.isArray(event.target) ? event.target.length : 0} Pawn${Array.isArray(event.target) && event.target.length === 1 ? '' : 's'} sideways.`
            : event.cardId === 'holy-war' && event.target && !Array.isArray(event.target) && typeof event.target === 'object'
              ? `Holy War swapped ${event.target.knight} and ${event.target.bishop}.`
          : `Disintegration removed the Pawn on ${event.target}.`,
      );
    } else {
      setMessage('Move complete. You may play a card or end the turn.');
    }
    return true;
  }, [game]);

  const move = useCallback((from: SquareName, to: SquareName) => {
    const moving = game.pieces.find(piece => piece.zone === 'board' && piece.square === from);
    const promotes = moving?.role === 'pawn' && (to.endsWith('1') || to.endsWith('8'));
    const promotion = promotes
      ? window.prompt('Promote to queen, rook, bishop, or knight:', 'queen') ?? 'queen'
      : undefined;
    reduce({ type: 'move', from, to, ...(promotion ? { promotion } : {}) });
  }, [game.pieces, reduce]);

  const addCardMove = useCallback((from: SquareName, to: SquareName) => {
    if (!moveCardDests(from).includes(to)) {
      setMessage(
        moveCardId === 'annexation'
          ? 'That Pawn needs two clear forward squares.'
          : 'That Pawn must move one square sideways to an empty square.',
      );
      setHasError(true);
      return;
    }
    if (cardMoves.some(move => move.from === from || move.to === to)) {
      setMessage('Choose a different Pawn and destination.');
      setHasError(true);
      return;
    }
    const next = [...cardMoves, { from, to }];
    setCardMoves(next);
    setCardMoveFrom(null);
    setKeyboardFrom('');
    setKeyboardTo('');
    setMessage(
      next.length === 2
        ? `Two Pawn moves ready. Play ${selectedDefinition?.name}.`
        : 'One Pawn move ready. Play the card now, or choose one more Pawn.',
    );
    setHasError(false);
  }, [cardMoves, moveCardDests, moveCardId, selectedDefinition?.name]);

  const playHolyWar = useCallback((knight: SquareName, bishop: SquareName) => {
    if (!selectedInstance || selectedInstance.cardId !== 'holy-war') return;
    if (reduce({
      type: 'playCard',
      cardId: selectedInstance.cardId,
      cardInstanceId: selectedInstance.id,
      target: { knight, bishop },
    })) setSelectedCard(null);
  }, [reduce, selectedInstance]);

  const target = useCallback((square: SquareName) => {
    if (!selectedInstance) return;
    if (selectedInstance.cardId === 'holy-war') {
      if (swapFrom === square) {
        setSwapFrom(null);
        setMessage('Piece selection canceled. Choose a Knight or Bishop.');
        setHasError(false);
        return;
      }
      const piece = cardTargets.find(candidate => candidate.square === square);
      if (!piece) {
        setMessage('Choose a Knight or Bishop you control.');
        setHasError(true);
        return;
      }
      if (!swapFrom) {
        setSwapFrom(square);
        const isKnight = piece.role === 'knight' || piece.originalRole === 'knight';
        const isBishop = piece.role === 'bishop' || piece.originalRole === 'bishop';
        setMessage(
          `Choose a ${isKnight && !isBishop ? 'Bishop' : isBishop && !isKnight ? 'Knight' : 'complementary piece'} to swap with ${square}.`,
        );
        setHasError(false);
        return;
      }
      const first = cardTargets.find(candidate => candidate.square === swapFrom)!;
      const firstIsKnight = first.role === 'knight' || first.originalRole === 'knight';
      const firstIsBishop = first.role === 'bishop' || first.originalRole === 'bishop';
      const secondIsKnight = piece.role === 'knight' || piece.originalRole === 'knight';
      const secondIsBishop = piece.role === 'bishop' || piece.originalRole === 'bishop';
      if (!((firstIsKnight && secondIsBishop) || (secondIsKnight && firstIsBishop))) {
        setMessage('Holy War needs one Knight and one Bishop.');
        setHasError(true);
        return;
      }
      playHolyWar(
        firstIsKnight && secondIsBishop ? swapFrom : square,
        firstIsKnight && secondIsBishop ? square : swapFrom,
      );
      return;
    }
    if (moveCardId) {
      if (cardMoveFrom) {
        if (square === cardMoveFrom) {
          setCardMoveFrom(null);
          setMessage('Pawn selection canceled. Choose a Pawn.');
          setHasError(false);
        } else {
          addCardMove(cardMoveFrom, square);
        }
        return;
      }
      if (cardMoves.length >= 2) {
        setMessage(`Two Pawn moves are already ready. Play ${selectedDefinition?.name}.`);
        setHasError(true);
        return;
      }
      if (!availableCardTargets.some(piece => piece.square === square)) {
        setMessage('Choose one of your available Pawns.');
        setHasError(true);
        return;
      }
      setCardMoveFrom(square);
      setMessage(
        moveCardId === 'annexation'
          ? `Pawn ${square} selected. Choose its two-square forward destination.`
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
  }, [addCardMove, availableCardTargets, cardMoveFrom, cardMoves.length, cardTargets, moveCardId, playHolyWar, reduce, selectedDefinition?.name, selectedInstance, swapFrom]);

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
  };

  const selectCard = (card: CardInstance) => {
    const selecting = selectedCard !== card.id;
    setPreviewId(card.cardId);
    setSelectedCard(selecting ? card.id : null);
    setMessage(
      selecting
        ? card.cardId === 'holy-war'
          ? 'Choose a Knight, then choose a Bishop to swap with it.'
          : card.cardId === 'forced-march' || card.cardId === 'annexation'
          ? `Choose a Pawn, then choose its ${card.cardId === 'annexation' ? 'two-square forward' : 'sideways'} destination.`
          : 'Choose one of your Pawns on the board.'
        : 'Card deselected. Make a legal move or select it again.',
    );
    setHasError(false);
    setKeyboardTarget('');
    setKeyboardFrom('');
    setKeyboardTo('');
    setCardMoveFrom(null);
    setCardMoves([]);
    setSwapFrom(null);
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
              active={!game.outcome && game.turn.color === 'black' && game.turn.cardPlays.black < 1}
              cards={game.players.black.hand}
              color="black"
              onPreview={setPreviewId}
              onSelect={selectCard}
              phase={game.turn.phase}
              selected={selectedCard}
            />
            <Hand
              active={!game.outcome && game.turn.color === 'white' && game.turn.cardPlays.white < 1}
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

            <div className={selectedCard ? 'board-frame board-frame--targeting' : 'board-frame'}>
              <ChessBoard
                onMove={move}
                onTarget={target}
                selectedTarget={swapFrom ?? cardMoveFrom}
                state={game}
                targeting={Boolean(selectedCard)}
              />
            </div>

            <div className="controls">
              <div className="controls__main">
                <p className="message" role={hasError ? 'alert' : 'status'}>
                  {message}
                </p>
                <div className="controls__buttons">
                  {moveCardId ? (
                    <button
                      aria-label={`Play ${selectedDefinition?.name}`}
                      className="button button--primary"
                      disabled={cardMoves.length === 0 || Boolean(cardMoveFrom)}
                      onClick={playMoveCard}
                      type="button"
                    >
                      Play ({cardMoves.length}/2)
                    </button>
                  ) : null}
                  <button className="button button--ghost" onClick={reset} type="button">Reset</button>
                  <button
                    className="button button--primary"
                    disabled={!game.turn.moveMade || Boolean(game.outcome)}
                    onClick={() => {
                      if (reduce({ type: 'endTurn' })) setSelectedCard(null);
                    }}
                    type="button"
                  >
                    End turn
                  </button>
                </div>
              </div>

              <details className="keyboard-controls">
                <summary>Keyboard controls</summary>
                {selectedDefinition?.id === 'holy-war' ? (
                  <form onSubmit={event => {
                    event.preventDefault();
                    if (keyboardFrom && keyboardTo) playHolyWar(keyboardFrom, keyboardTo);
                  }}>
                    <label>
                      Knight
                      <select
                        aria-label="Knight target"
                        onChange={event => setKeyboardFrom(event.target.value as SquareName)}
                        required
                        value={keyboardFrom}
                      >
                        <option value="">Choose Knight</option>
                        {holyWarKnights.map(piece => <option key={piece.id} value={piece.square!}>{piece.square}</option>)}
                      </select>
                    </label>
                    <label>
                      Bishop
                      <select
                        aria-label="Bishop target"
                        onChange={event => setKeyboardTo(event.target.value as SquareName)}
                        required
                        value={keyboardTo}
                      >
                        <option value="">Choose Bishop</option>
                        {holyWarBishops.map(piece => <option key={piece.id} value={piece.square!}>{piece.square}</option>)}
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
                      Pawn
                      <select
                        aria-label="Pawn source"
                        disabled={cardMoves.length >= 2}
                        onChange={event => {
                          setKeyboardFrom(event.target.value as SquareName);
                          setKeyboardTo('');
                        }}
                        required
                        value={keyboardFrom}
                      >
                        <option value="">Choose Pawn</option>
                        {availableCardTargets.map(piece => <option key={piece.id} value={piece.square!}>{piece.square}</option>)}
                      </select>
                    </label>
                    <label>
                      Sideways to
                      <select
                        aria-label="Pawn destination"
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
              {preview.id === 'holy-war'
                ? 'Play after your move'
                : preview.id === 'fanatic' || preview.id === 'forced-march' || preview.id === 'annexation'
                ? 'Play instead of your move'
                : 'Play before or after your move'}
            </span>
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
