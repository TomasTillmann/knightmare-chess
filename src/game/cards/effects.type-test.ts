import type { GameState } from '../types.js';

type Effect = GameState['effects'][number];

// Compile-only contract: this function is intentionally never invoked.
function checkEffectTypes() {
  const accept = (_effect: Effect) => {};
  const coup = { type: 'coup', owner: 'white', card: { id: 'coup-card', cardId: 'coup' },
    princeId: 'old-king', kingId: 'new-king', princeRole: 'king' } as const;
  accept(coup);
  const earthquake = { type: 'earthquake' as const, owner: 'white' as const,
    card: { id: 'earthquake-card', cardId: 'earthquake' }, direction: 'clockwise' as const,
    target: { direction: 'clockwise' as const, promotions: [] } };
  accept(earthquake);
  accept({ type: 'challenge', owner: 'white', player: 'black', pieceId: 'challenged-knight' });
  const { kingId: _kingId, ...missingKing } = coup;
  // @ts-expect-error Coup requires the replacement king ID.
  accept(missingKing);
  // @ts-expect-error A Coup prince must retain a valid chess role.
  accept({ ...coup, princeRole: 'dragon' });
  // @ts-expect-error Earthquake rotations use one of the two canonical directions.
  accept({ ...earthquake, direction: 'sideways' });
  // @ts-expect-error Canonical effects use known discriminant tags.
  accept({ type: 'unknown-canonical-effect' });
}

void checkEffectTypes;
