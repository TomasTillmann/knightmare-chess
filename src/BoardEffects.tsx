import { CARD_CATALOG } from './game/cards/catalog.js';
import type { GameEffect, GameState, SquareName } from './game/types.js';

const point = (square: SquareName) => ({ x: (square.charCodeAt(0) - 97 + .5) * 12.5, y: (8.5 - Number(square[1])) * 12.5 });
const capital = (text: string) => text[0].toUpperCase() + text.slice(1);
const shortNames: Partial<Record<GameEffect['type'], string>> = {
  'mystic-shield': 'Shield', 'fatal-attraction': 'Magnet', 'forbidden-city': 'Blocked',
  'man-trap': 'Trap', 'neutrality': 'Neutral', 'pacifism': 'Pacifist', 'challenge': 'Move',
};
const roleLetters = { pawn: 'P', rook: 'R', knight: 'N', bishop: 'B', queen: 'Q', king: 'K' };

export function BoardEffects({ state, onPreview }: { state: GameState; onPreview: (cardId: string | null) => void }) {
  const carrier = (id: string) => {
    const ids = state.effects.find(effect => effect.type === 'confabulation' && effect.pieceIds.includes(id));
    return state.pieces.find(piece => piece.zone === 'board' && piece.square
      && (piece.id === id || ids?.type === 'confabulation' && ids.pieceIds.includes(piece.id)));
  };
  const pieceLabel = (id: string) => {
    const piece = state.pieces.find(piece => piece.id === id);
    return piece ? `${capital(piece.owner)} ${piece.role}, ${carrier(id)?.square ?? piece.zone}` : 'Off board';
  };
  const entries = state.effects.map((effect, index) => {
    const source = [...state.history].reverse().find(event => event.type === 'cardPlayed'
      && (event.copiedCardId ?? event.cardId) === effect.type
      && (!event.player || event.player === effect.owner));
    const cardId = 'card' in effect ? effect.card.cardId : source?.cardId ?? effect.type;
    const card = CARD_CATALOG[cardId];
    const title = cardId === effect.type ? card.name : `${card.name}: ${CARD_CATALOG[effect.type].name}`;
    const ids = 'pieceId' in effect ? [effect.pieceId] : effect.type === 'confabulation' ? effect.pieceIds
      : effect.type === 'coup' ? [effect.princeId, effect.kingId] : [];
    const squares = [...new Set(ids.flatMap(id => carrier(id)?.square ?? []))];
    if ('square' in effect) squares.push(effect.square);
    const suspended = 'suspended' in effect && effect.suspended === true
      || 'active' in effect && effect.active === false
      || 'confabulationEnded' in effect && effect.confabulationEnded === true
      || effect.type === 'neutrality' && !carrier(effect.pieceId)?.neutral;
    const target = effect.type === 'fortification' ? `${effect.from}–${effect.to}`
      : 'square' in effect ? effect.square : ids.length ? ids.map(pieceLabel).join(' + ') : 'Whole board';
    const duration = suspended ? 'Suspended'
      : effect.type === 'mystic-shield' ? `Until ${effect.player === 'white' ? 'Black' : 'White'} finishes`
      : effect.type === 'challenge' || effect.type === 'dungeon' ? `Until ${capital(effect.player)} finishes`
      : effect.type === 'panic' ? `${capital(effect.player)}: 15 seconds for next move`
      : effect.type === 'truce' ? 'Until check or stalemate'
      : effect.type === 'fatal-attraction' ? 'Until the magnet moves or is captured'
      : effect.type === 'man-trap' ? 'Until triggered · DEBUG visible' : 'Continuing';
    const short = effect.type === 'confabulation'
      ? effect.pieceIds.map(id => roleLetters[state.pieces.find(piece => piece.id === id)!.role]).join('+')
      : shortNames[effect.type] ?? capital(effect.type);
    return { key: `effect-${index}`, type: effect.type as string, cardId: cardId as string | undefined,
      title, target, duration, suspended, squares, short,
      proxy: 'card' in effect && effect.card.proxy === true };
  });
  for (const piece of state.pieces) {
    const square = carrier(piece.id)?.square;
    if (!square) continue;
    const statuses = [piece.neutral ? 'Neutral' : '', piece.promoted ? 'Promoted' : '',
      piece.royal && piece.role !== 'king' ? 'King' : !piece.royal && piece.role === 'king' ? 'Prince' : ''].filter(Boolean);
    if (!statuses.length) continue;
    entries.unshift({ key: `piece-${piece.id}`, type: 'piece-status', cardId: undefined,
      title: statuses.join(' · '), target: pieceLabel(piece.id), duration: '', suspended: false,
      squares: [square], short: statuses.join(' / '), proxy: false });
  }
  for (const entry of state.underElfHill ?? []) {
    const square = carrier(entry.pieceId)?.square;
    entries.push({ key: `elf-${entry.pieceId}`, type: 'under-elf-hill', cardId: 'under-elf-hill',
      title: 'Under Elf Hill', target: pieceLabel(entry.pieceId),
      duration: entry.returned ? `Cannot move until ${capital(entry.player)} finishes`
        : entry.returning ? 'Choose an edge square to return' : `Returns at the start of ${capital(entry.player)}’s turn`,
      suspended: false, squares: entry.returned && square ? [square] : [], short: 'Resting', proxy: false });
  }
  const markers = new Map<SquareName, typeof entries>();
  for (const entry of entries) for (const square of entry.squares) {
    markers.set(square, [...markers.get(square) ?? [], entry]);
  }
  const directions = { 0: ['up', 'down'], 90: ['right', 'left'], 180: ['down', 'up'], 270: ['left', 'right'] };
  return <>
    <div className="board-effects" aria-hidden="true">
      {state.effects.map((effect, index) => {
        if (effect.type === 'fortification') {
          const a = point(effect.from), b = point(effect.to);
          const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
          const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
          return <svg key={index} className="effect-wall" viewBox="0 0 100 100"><line x1={x - dy / length * 5} y1={y + dx / length * 5} x2={x + dy / length * 5} y2={y - dx / length * 5} /></svg>;
        }
        return null;
      })}
      {[...markers].map(([square, items]) => {
        const { x, y } = point(square);
        const primary = items.find(item => item.type === 'confabulation') ?? items[0];
        return <span key={square} className="piece-effect" data-square={square} data-effect={primary.type}
          data-suspended={items.every(item => item.suspended)}
          data-effects={items.map(item => item.type).join(' ')} title={items.map(item => item.title).join(', ')}
          style={{ left: `${x}%`, top: `${y + 4}%` }}>{primary.short}{items.length > 1 ? ` +${items.length - 1}` : ''}</span>;
      })}
    </div>
    {entries.length > 0 && <div className="effects-tray" aria-label="Active effects">
      {state.orientation !== 0 && <p className="effect-orientation">Pawns: White {directions[state.orientation][0]} · Black {directions[state.orientation][1]}</p>}
      {entries.map(entry => {
        const detail = [entry.target, entry.duration, entry.proxy ? 'Card taken by Vulture; effect remains' : ''].filter(Boolean).join(' · ');
        return <button type="button" className="effect-entry" key={entry.key} data-effect={entry.type}
          data-suspended={entry.suspended} aria-label={`${entry.title}, ${detail}`}
          onPointerEnter={() => onPreview(entry.cardId ?? null)} onPointerLeave={() => onPreview(null)}
          onFocus={() => onPreview(entry.cardId ?? null)} onBlur={() => onPreview(null)}>
          {entry.cardId && <img src={CARD_CATALOG[entry.cardId].image} alt="" />}<span>{entry.title}<small>{detail}</small></span>
        </button>;
      })}
    </div>}
  </>;
}
